"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getScanGuidance } from "@/lib/patient-assistant/guidance";
import type {
  PatientAssistantAction,
  PatientAssistantContext,
  PatientAssistantLanguage,
  PatientAssistantResponse,
} from "@/lib/patient-assistant/types";
import type { StructuredSymptomAnswer } from "@/lib/measurements/types";

interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: PatientAssistantAction[];
  escalation?: boolean;
}

export interface StructuredSymptomPrompt {
  questionId: string;
  symptom: string;
  question: Record<PatientAssistantLanguage, string>;
}

export function PatientAssistant({
  context,
  language,
  onLanguageChange,
  onAction,
  structuredPrompt,
  onStructuredAnswer,
  className = "",
}: {
  context: PatientAssistantContext;
  language: PatientAssistantLanguage;
  onLanguageChange?: (language: PatientAssistantLanguage) => void;
  onAction?: (action: PatientAssistantAction) => void;
  structuredPrompt?: StructuredSymptomPrompt | null;
  onStructuredAnswer?: (
    answer: StructuredSymptomAnswer["answer"]
  ) => void;
  className?: string;
}) {
  const [messages, setMessages] = useState<AssistantMessage[]>(() => [
    initialMessage(context, language),
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [reviewRequested, setReviewRequested] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const storageKey = `medtwin.patient-assistant.v1.${context.sessionId}`;
  const copy = UI_COPY[language];

  const guidance = context.scan
    ? getScanGuidance(context.scan.currentStep, context.scan, language)
    : null;
  const quickActions = useMemo(
    () => getQuickActions(context, language),
    [context, language]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = sessionStorage.getItem(storageKey);
      const restored = stored ? parseStoredMessages(stored) : [];
      if (restored.length) setMessages(restored);
      setReviewRequested(
        sessionStorage.getItem(`${storageKey}.review-requested`) === "1"
      );
      setHistoryReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!historyReady) return;
    sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-20)));
  }, [historyReady, messages, storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [loading, messages]);

  const send = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    const userMessage: AssistantMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const conversation = messages
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/patient-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          context,
          language,
          message: trimmed,
          conversation,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Assistant request failed: ${response.status}`);
      const result = (await response.json()) as PatientAssistantResponse;
      setMessages((current) => [
        ...current,
        {
          id: result.requestId ?? crypto.randomUUID(),
          role: "assistant",
          content: result.message,
          actions: result.suggestedActions,
          escalation: result.requiresEscalation,
        },
      ]);
      result.suggestedActions
        .filter((action) =>
          [
            "FOCUS_HEART",
            "FOCUS_LUNGS",
            "FOCUS_BRAIN",
            "RESET_ANATOMY_VIEW",
          ].includes(action)
        )
        .forEach((action) => onAction?.(action));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: copy.unavailable,
        },
      ]);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  };

  const handleAction = (action: PatientAssistantAction) => {
    if (action === "REQUEST_CLINICIAN_REVIEW") {
      setReviewRequested(true);
      sessionStorage.setItem(`${storageKey}.review-requested`, "1");
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: copy.reviewRequested,
        },
      ]);
    }
    onAction?.(action);
  };

  return (
    <section
      aria-label={copy.title}
      className={`flex min-h-[380px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] sm:min-h-[460px] ${className}`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-xs font-bold text-black"
          >
            M
          </span>
          <div>
            <h2 className="text-sm font-semibold">{copy.title}</h2>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
              {copy.subtitle}
            </p>
          </div>
        </div>
        {onLanguageChange && <label className="shrink-0">
          <span className="sr-only">{copy.language}</span>
          <select
            value={language}
            onChange={(event) =>
              onLanguageChange(event.target.value as PatientAssistantLanguage)
            }
            className="rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-2 py-1 text-[11px]"
            aria-label={copy.language}
          >
            <option value="uz">UZ</option>
            <option value="ru">RU</option>
            <option value="en">EN</option>
          </select>
        </label>}
      </header>

      {context.triage?.priority === "RED" && (
        <div
          role="status"
          className="border-b border-[var(--red)]/35 bg-[var(--red)]/10 px-4 py-3"
        >
          <div className="text-xs font-bold text-[var(--red)]">
            {context.triage.headline}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text)]">
            {context.triage.recommendedAction}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <ActionButton action="OPEN_WHY" onClick={handleAction} language={language} />
            <ActionButton action="OPEN_CLINICAL_BRIEF" onClick={handleAction} language={language} />
            {context.availableActions.includes("REQUEST_CLINICIAN_REVIEW") && (
              <ActionButton
                action="REQUEST_CLINICIAN_REVIEW"
                onClick={handleAction}
                language={language}
                disabled={reviewRequested}
              />
            )}
          </div>
          {reviewRequested && (
            <p className="mt-2 text-[10px] text-[var(--muted)]">
              {copy.noClinicianConnected}
            </p>
          )}
        </div>
      )}

      {guidance && (
        <div className="border-b border-[var(--border)] bg-[var(--accent)]/[0.055] px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            {copy.liveGuidance}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed">{guidance}</p>
        </div>
      )}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "assistant"
                ? "max-w-[92%]"
                : "ml-auto max-w-[86%]"
            }
          >
            <div
              className={`rounded-lg px-3 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                message.role === "assistant"
                  ? message.escalation
                    ? "border border-[var(--red)]/40 bg-[var(--red)]/[0.07]"
                    : "bg-[var(--bg-elev)]"
                  : "bg-[var(--accent)]/12 text-[var(--text)]"
              }`}
            >
              {message.content}
            </div>
            {message.role === "assistant" && message.actions?.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {message.actions
                  .filter((action) => action !== "NONE")
                  .map((action) => (
                    <ActionButton
                      key={action}
                      action={action}
                      onClick={handleAction}
                      language={language}
                      disabled={
                        action === "REQUEST_CLINICIAN_REVIEW" && reviewRequested
                      }
                    />
                  ))}
              </div>
            ) : null}
          </div>
        ))}
        {loading && (
          <div role="status" className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span className="mt-spin h-3 w-3 rounded-full border border-[var(--accent)] border-t-transparent" />
            {copy.explaining}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border)] px-4 py-3">
        {structuredPrompt && onStructuredAnswer && (
          <div className="mb-3 rounded-lg border border-[var(--accent-2)]/35 bg-[var(--accent-2)]/[0.055] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-2)]">
              {copy.structuredFollowUp}
            </div>
            <p className="mt-1.5 text-sm">{structuredPrompt.question[language]}</p>
            <div className="mt-2 flex gap-2">
              {(["yes", "no", "unsure"] as const).map((answer) => (
                <button
                  key={answer}
                  type="button"
                  onClick={() => onStructuredAnswer(answer)}
                  className="min-h-9 rounded-md border border-[var(--border)] px-3 text-xs hover:border-[var(--accent-2)] hover:text-[var(--accent-2)]"
                >
                  {copy.answers[answer]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pb-2">
          {quickActions.map((action) => (
            <button
              key={action.prompt}
              type="button"
              onClick={() => void send(action.prompt)}
              disabled={loading}
              className="min-h-9 shrink-0 rounded-md border border-[var(--border)] px-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] transition-colors hover:border-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
            >
              {action.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
          className="flex gap-2"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">{copy.ask}</span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={800}
              placeholder={copy.ask}
              className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-3 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-2)]"
            />
          </label>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--accent)] font-bold text-black transition-[filter,opacity] hover:brightness-110 disabled:opacity-40"
            aria-label={copy.send}
          >
            →
          </button>
        </form>
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
          {copy.privacy}
        </p>
      </div>
    </section>
  );
}

function ActionButton({
  action,
  onClick,
  language,
  disabled = false,
}: {
  action: PatientAssistantAction;
  onClick: (action: PatientAssistantAction) => void;
  language: PatientAssistantLanguage;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(action)}
      disabled={disabled}
      className="min-h-9 rounded-md border border-[var(--border)] px-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text)] transition-colors hover:border-[var(--accent-2)] hover:text-[var(--accent-2)] disabled:opacity-45"
    >
      {ACTION_LABELS[language][action]}
    </button>
  );
}

function initialMessage(
  context: PatientAssistantContext,
  language: PatientAssistantLanguage
): AssistantMessage {
  const captured = context.measurements.filter(
    (measurement) => measurement.value !== null
  ).length;
  const missing = context.measurements.filter(
    (measurement) => measurement.value === null
  ).length;
  let content: string;
  if (context.currentRoute === "scan") {
    content = UI_COPY[language].scanInitial;
  } else if (context.dataMode === "demo") {
    content = UI_COPY[language].demoInitial(captured, missing);
  } else if (context.triage?.priority === "RED") {
    content = UI_COPY[language].highInitial;
  } else {
    content = UI_COPY[language].resultInitial(captured, missing);
  }
  return { id: crypto.randomUUID(), role: "assistant", content };
}

function getQuickActions(
  context: PatientAssistantContext,
  language: PatientAssistantLanguage
) {
  const copy = QUICK_ACTIONS[language];
  if (context.currentRoute === "scan") {
    if (context.scan?.currentStep === "pulse") {
      return [copy.finger, copy.signal, copy.privacy];
    }
    return [copy.scan, copy.camera, copy.privacy];
  }
  return [copy.results, copy.missing, copy.why, copy.next, copy.heart];
}

function parseStoredMessages(raw: string): AssistantMessage[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (message): message is AssistantMessage =>
          typeof message === "object" &&
          message !== null &&
          "id" in message &&
          typeof message.id === "string" &&
          "role" in message &&
          (message.role === "user" || message.role === "assistant") &&
          "content" in message &&
          typeof message.content === "string" &&
          message.content.length <= 1600
      )
      .slice(-20);
  } catch {
    return [];
  }
}

const UI_COPY = {
  en: {
    title: "MedTwin Assistant",
    subtitle: "A guide for scans, results, and next steps — not a doctor.",
    language: "Assistant language",
    liveGuidance: "Live scan guidance",
    structuredFollowUp: "Structured symptom follow-up",
    explaining: "MedTwin is explaining…",
    ask: "Ask about this scan or result…",
    send: "Send message",
    privacy: "Bound to this session. Raw camera frames, video, and audio are never sent to the assistant.",
    unavailable: "AI explanation is temporarily unavailable. The scan, triage, WHY, and Clinical Brief still work.",
    reviewRequested: "A clinician review request is recorded for this browser session. No clinician connection has been established.",
    noClinicianConnected: "Request recorded · no clinician connected",
    scanInitial: "I will guide you through the current MedTwin scan step. Sensor guidance comes directly from the scan state, not from a diagnosis model.",
    demoInitial: (captured: number, missing: number) => `This is a labeled demo scenario, not a personal scan. It contains ${captured} example measurements and ${missing} unavailable measurements for product demonstration.`,
    highInitial: "Your MedTwin screening is marked HIGH PRIORITY for professional review. I can explain the authoritative reasons and open the next-step tools.",
    resultInitial: (captured: number, missing: number) => `Your screening is complete. ${captured} measurements were captured and ${missing} were unavailable. I can explain what MedTwin recorded.`,
    answers: { yes: "Yes", no: "No", unsure: "Unsure" },
  },
  uz: {
    title: "MedTwin yordamchisi",
    subtitle: "Tekshiruv, natija va keyingi qadamlar bo‘yicha yo‘riqchi — shifokor emas.",
    language: "Yordamchi tili",
    liveGuidance: "Jonli tekshiruv yo‘riqnomasi",
    structuredFollowUp: "Tuzilgan alomat savoli",
    explaining: "MedTwin tushuntirmoqda…",
    ask: "Tekshiruv yoki natija haqida so‘rang…",
    send: "Xabar yuborish",
    privacy: "Faqat shu sessiyaga bog‘langan. Xom kamera kadrlari, video va audio yordamchiga yuborilmaydi.",
    unavailable: "Sun’iy intellekt izohi hozircha mavjud emas. Tekshiruv, triaj, sabablar va klinik ma’lumotnoma ishlashda davom etadi.",
    reviewRequested: "Tibbiy ko‘rib chiqish so‘rovi shu brauzer sessiyasida qayd etildi. Hozircha shifokor bilan aloqa o‘rnatilmadi.",
    noClinicianConnected: "So‘rov qayd etildi · shifokor ulanmagan",
    scanInitial: "Men joriy MedTwin tekshiruv bosqichida yordam beraman. Sensor yo‘riqnomasi tashxis modelidan emas, haqiqiy tekshiruv holatidan keladi.",
    demoInitial: (captured: number, missing: number) => `Bu shaxsiy tekshiruv emas, belgilangan demo ssenariy. Unda mahsulot namoyishi uchun ${captured} ta namunaviy o‘lchov va ${missing} ta mavjud bo‘lmagan o‘lchov bor.`,
    highInitial: "MedTwin tekshiruv natijasi professional ko‘rib chiqish uchun YUQORI USTUVORLIK deb belgilangan. Men qoidalar tizimidagi sabablarni tushuntira olaman.",
    resultInitial: (captured: number, missing: number) => `Tekshiruv yakunlandi. ${captured} ta o‘lchov olindi, ${missing} tasi mavjud emas. MedTwin qayd etgan natijalarni tushuntira olaman.`,
    answers: { yes: "Ha", no: "Yo‘q", unsure: "Bilmayman" },
  },
  ru: {
    title: "MedTwin Assistant",
    subtitle: "Помощник по сканированию, результатам и следующим шагам — не врач.",
    language: "Язык ассистента",
    liveGuidance: "Подсказка по сканированию",
    structuredFollowUp: "Структурированный вопрос о симптоме",
    explaining: "MedTwin объясняет…",
    ask: "Спросите о сканировании или результате…",
    send: "Отправить сообщение",
    privacy: "Привязано только к этой сессии. Кадры камеры, видео и аудио не отправляются ассистенту.",
    unavailable: "Объяснение AI временно недоступно. Сканирование, триаж, WHY и Clinical Brief продолжают работать.",
    reviewRequested: "Запрос на клинический обзор записан в этой браузерной сессии. Соединение с врачом не установлено.",
    noClinicianConnected: "Запрос записан · врач не подключён",
    scanInitial: "Я помогу пройти текущий этап MedTwin. Подсказки сенсора основаны на реальном состоянии сканирования, а не на диагностической модели.",
    demoInitial: (captured: number, missing: number) => `Это обозначенный демо-сценарий, а не личное сканирование. Для демонстрации продукта он содержит ${captured} примерных измерений; недоступно: ${missing}.`,
    highInitial: "Скрининг MedTwin отмечен как HIGH PRIORITY для профессионального рассмотрения. Я могу объяснить причины из системы правил.",
    resultInitial: (captured: number, missing: number) => `Скрининг завершён. Получено измерений: ${captured}; недоступно: ${missing}. Я могу объяснить данные MedTwin.`,
    answers: { yes: "Да", no: "Нет", unsure: "Не знаю" },
  },
} as const;

const QUICK_ACTIONS = {
  en: {
    scan: { label: "How does scan work?", prompt: "How does this scan step work?" },
    camera: { label: "Why camera?", prompt: "Why does MedTwin need the camera?" },
    privacy: { label: "Is my data stored?", prompt: "How is my scan data stored and protected?" },
    finger: { label: "Finger position", prompt: "How do I position my finger?" },
    signal: { label: "Low signal", prompt: "Why is signal quality low?" },
    results: { label: "Explain results", prompt: "Explain my results" },
    missing: { label: "Not measured", prompt: "What was not measured?" },
    why: { label: "Why priority?", prompt: "Why this priority?" },
    next: { label: "What next?", prompt: "What happens next?" },
    heart: { label: "Show heart", prompt: "Show my heart" },
  },
  uz: {
    scan: { label: "Tekshiruv qanday ishlaydi?", prompt: "MedTwin tekshiruvi qanday ishlaydi?" },
    camera: { label: "Kamera nima uchun?", prompt: "Kamera nima uchun kerak?" },
    privacy: { label: "Ma’lumot saqlanadimi?", prompt: "Ma’lumotlarim qanday saqlanadi?" },
    finger: { label: "Barmoq holati", prompt: "Barmog‘imni qanday joylashtiraman?" },
    signal: { label: "Signal past", prompt: "Nega signal sifati past?" },
    results: { label: "Natijani tushuntir", prompt: "Natijamni tushuntir" },
    missing: { label: "Nima o‘lchanmadi?", prompt: "Nima o‘lchanmadi?" },
    why: { label: "Nega ustuvor?", prompt: "Nega bu ustuvor?" },
    next: { label: "Keyin nima?", prompt: "Keyin nima qilaman?" },
    heart: { label: "Yurakni ko‘rsat", prompt: "Yuragimni ko‘rsat" },
  },
  ru: {
    scan: { label: "Как работает скан?", prompt: "Как работает этот этап сканирования?" },
    camera: { label: "Зачем камера?", prompt: "Зачем MedTwin нужна камера?" },
    privacy: { label: "Данные хранятся?", prompt: "Как хранятся и защищаются мои данные?" },
    finger: { label: "Положение пальца", prompt: "Как правильно положить палец?" },
    signal: { label: "Слабый сигнал", prompt: "Почему качество сигнала низкое?" },
    results: { label: "Объяснить результат", prompt: "Объясни мой результат" },
    missing: { label: "Что не измерено?", prompt: "Что не измерено?" },
    why: { label: "Почему приоритет?", prompt: "Почему такой приоритет?" },
    next: { label: "Что дальше?", prompt: "Что делать дальше?" },
    heart: { label: "Показать сердце", prompt: "Покажи сердце" },
  },
} as const;

const ACTION_LABELS: Record<
  PatientAssistantLanguage,
  Record<PatientAssistantAction, string>
> = {
  en: {
    NONE: "Done",
    OPEN_WHY: "View WHY",
    OPEN_CLINICAL_BRIEF: "Clinical Brief",
    SHOW_MEASUREMENTS: "Show measurements",
    SHOW_SCAN_HELP: "Scan help",
    UPDATE_STRUCTURED_SYMPTOM: "Update symptom",
    REQUEST_CLINICIAN_REVIEW: "Request clinician review",
    FOCUS_HEART: "Focus heart",
    FOCUS_LUNGS: "Focus lungs",
    FOCUS_BRAIN: "Focus brain",
    RESET_ANATOMY_VIEW: "Clinical view",
  },
  uz: {
    NONE: "Tayyor",
    OPEN_WHY: "Sabablarni ko‘rish",
    OPEN_CLINICAL_BRIEF: "Klinik ma’lumotnoma",
    SHOW_MEASUREMENTS: "O‘lchovlarni ko‘rish",
    SHOW_SCAN_HELP: "Tekshiruv yordami",
    UPDATE_STRUCTURED_SYMPTOM: "Alomatni yangilash",
    REQUEST_CLINICIAN_REVIEW: "Shifokor ko‘rib chiqishini so‘rash",
    FOCUS_HEART: "Yurakka fokus",
    FOCUS_LUNGS: "O‘pkaga fokus",
    FOCUS_BRAIN: "Miyaga fokus",
    RESET_ANATOMY_VIEW: "Klinik ko‘rinish",
  },
  ru: {
    NONE: "Готово",
    OPEN_WHY: "Открыть WHY",
    OPEN_CLINICAL_BRIEF: "Clinical Brief",
    SHOW_MEASUREMENTS: "Показать измерения",
    SHOW_SCAN_HELP: "Помощь со сканом",
    UPDATE_STRUCTURED_SYMPTOM: "Обновить симптом",
    REQUEST_CLINICIAN_REVIEW: "Запросить клинический обзор",
    FOCUS_HEART: "Фокус на сердце",
    FOCUS_LUNGS: "Фокус на лёгких",
    FOCUS_BRAIN: "Фокус на мозге",
    RESET_ANATOMY_VIEW: "Клинический вид",
  },
};
