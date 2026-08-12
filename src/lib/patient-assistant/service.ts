import { getScanGuidance } from "./guidance";
import {
  getConfiguredPatientAssistantProvider,
  type PatientAssistantProvider,
} from "./provider";
import type {
  PatientAssistantAction,
  PatientAssistantContext,
  PatientAssistantLanguage,
  PatientAssistantMeasurement,
  PatientAssistantRequest,
  PatientAssistantResponse,
} from "./types";
import { validateProviderResponse } from "./validation";

export async function generatePatientAssistantResponse(
  request: PatientAssistantRequest,
  provider: PatientAssistantProvider | null =
    getConfiguredPatientAssistantProvider()
): Promise<{ response: PatientAssistantResponse; provider: string }> {
  const deterministic = deterministicResponse(request);
  if (deterministic) {
    return {
      response: enforceSafety(deterministic, request.context, request.language),
      provider: "medtwin-deterministic",
    };
  }

  if (!provider) {
    return {
      response: unavailableResponse(request.language, request.context),
      provider: "unavailable",
    };
  }

  try {
    const raw = await provider.generate(request);
    const validated = validateProviderResponse(
      raw,
      request.context.availableActions
    );
    return {
      response: enforceSafety(validated, request.context, request.language),
      provider: provider.name,
    };
  } catch {
    return {
      response: unavailableResponse(request.language, request.context),
      provider: `${provider.name}:unavailable`,
    };
  }
}

function deterministicResponse(
  request: PatientAssistantRequest
): PatientAssistantResponse | null {
  const normalized = request.message.toLocaleLowerCase();
  const { context, language } = request;

  if (contains(normalized, ["change my high", "high to low", "downgrade", "priorityni o‘zgart", "priorityni o'zgart", "приоритет на низ", "измени приоритет"])) {
    return response(
      triageBoundary(language),
      "triage_boundary",
      context.triage ? ["OPEN_WHY"] : [],
      isEscalation(context)
    );
  }

  if (contains(normalized, ["medication", "medicine", "dose", "stop taking", "tablet", "дори", "doza", "лекар", "таблет", "дозиров"])) {
    return response(
      medicationBoundary(language),
      "medication_boundary",
      [],
      isEscalation(context)
    );
  }

  if (contains(normalized, ["diagnose", "what disease", "do i have", "tashxis", "kasallik", "диагноз", "какая болезнь"])) {
    return response(
      diagnosisBoundary(language),
      "diagnosis_boundary",
      context.measurements.length ? ["SHOW_MEASUREMENTS"] : [],
      isEscalation(context)
    );
  }

  const anatomy = anatomyIntent(normalized);
  if (anatomy) {
    const measurement =
      anatomy.action === "FOCUS_HEART"
        ? context.measurements.find((item) => item.key === "heart_rate")
        : anatomy.action === "FOCUS_LUNGS"
          ? context.measurements.find((item) => item.key === "respiratory_rate")
          : null;
    return response(
      anatomyMessage(
        language,
        anatomy.organ,
        measurement ?? null,
        context.dataMode
      ),
      "anatomy_focus",
      allowed(context, anatomy.action),
      isEscalation(context)
    );
  }

  if (contains(normalized, ["why", "nega", "nima uchun", "почему", "priority", "приоритет"])) {
    return response(
      explainPriority(context, language),
      "explain_priority",
      allowed(context, "OPEN_WHY"),
      isEscalation(context)
    );
  }

  if (contains(normalized, ["not measured", "wasn't measured", "was not measured", "nima o‘lchanmadi", "nima o'lchanmadi", "что не измер", "не измерено"])) {
    return response(
      explainMissing(context, language),
      "missing_measurements",
      [],
      isEscalation(context)
    );
  }

  const measurementKey = requestedMeasurement(normalized);
  if (measurementKey) {
    return response(
      explainOneMeasurement(context, measurementKey, language),
      "explain_measurement",
      [],
      isEscalation(context)
    );
  }

  if (contains(normalized, ["result", "natija", "measurement", "o‘lchov", "o'lchov", "результат", "измерен"])) {
    return response(
      explainResults(context, language),
      "explain_results",
      allowed(context, "SHOW_MEASUREMENTS"),
      isEscalation(context)
    );
  }

  if (contains(normalized, ["next", "what happens", "keyin", "дальше", "следующ"])) {
    return response(
      explainNextStep(context, language),
      "next_step",
      context.triage?.priority === "RED"
        ? allowed(context, "REQUEST_CLINICIAN_REVIEW")
        : [],
      isEscalation(context)
    );
  }

  if (contains(normalized, ["privacy", "camera", "scan", "signal", "help", "yordam", "kamera", "maxfiy", "помощ", "камера", "конфиденц"])) {
    if (contains(normalized, ["privacy", "stored", "saql", "maxfiy", "конфиденц", "хран"] )) {
      return response(privacyMessage(language), "privacy", [], false);
    }
    const guidance = context.scan
      ? getScanGuidance(context.scan.currentStep, context.scan, language)
      : generalScanHelp(language);
    return response(
      guidance,
      "scan_guidance",
      allowed(context, "SHOW_SCAN_HELP"),
      false
    );
  }

  return null;
}

function enforceSafety(
  candidate: PatientAssistantResponse,
  context: PatientAssistantContext,
  language: PatientAssistantLanguage
): PatientAssistantResponse {
  const text = candidate.message.toLocaleLowerCase();
  const unsafeDiagnosis = [
    "you have heart disease",
    "you are having a stroke",
    "you have pneumonia",
    "you have hypertension",
    "you have arrhythmia",
    "у вас гипертония",
    "у вас пневмония",
    "sizda gipertoniya",
  ].some((phrase) => text.includes(phrase));
  const unsafeMedication = [
    "stop taking your",
    "increase your dose",
    "decrease your dose",
    "прекратите принимать",
    "увеличьте дозу",
    "dorini to‘xtating",
    "dorini to'xtating",
  ].some((phrase) => text.includes(phrase));
  const contradictsTriage =
    context.triage?.priority === "RED" &&
    (text.includes("low priority") || text.includes("низкий приоритет"));

  if (unsafeMedication) {
    return response(
      medicationBoundary(language),
      "medication_boundary",
      [],
      isEscalation(context)
    );
  }
  if (unsafeDiagnosis || contradictsTriage) {
    return response(
      diagnosisBoundary(language),
      "diagnosis_boundary",
      context.triage ? allowed(context, "OPEN_WHY") : [],
      isEscalation(context)
    );
  }
  return {
    ...candidate,
    suggestedActions: candidate.suggestedActions.filter((action) =>
      context.availableActions.includes(action)
    ),
    requiresEscalation: candidate.requiresEscalation || isEscalation(context),
  };
}

function explainResults(
  context: PatientAssistantContext,
  language: PatientAssistantLanguage
) {
  if (!context.measurements.length && !context.screeningSignals.length) {
    return language === "uz"
      ? "Hali o‘lchov natijalari yo‘q. Men joriy scan bosqichini bajarishga yordam bera olaman."
      : language === "ru"
        ? "Результатов измерений пока нет. Я могу помочь пройти текущий этап сканирования."
        : "There are no measurement results yet. I can help you complete the current scan step.";
  }
  const lines = context.measurements.map((measurement) =>
    formatMeasurement(measurement, language)
  );
  const prefix =
    context.dataMode === "demo"
      ? language === "uz"
        ? "Bu aniq belgilangan demo ssenariy ma’lumotlari:"
        : language === "ru"
          ? "Это явно обозначенные данные демонстрационного сценария:"
          : "These are explicitly labeled demonstration-scenario values:"
      : language === "uz"
        ? "MedTwin ushbu sessiyada quyidagilarni qayd etdi:"
        : language === "ru"
          ? "В этой сессии MedTwin зафиксировал:"
          : "MedTwin recorded the following in this session:";
  const disclaimer =
    language === "uz"
      ? "Bu screening tibbiy tashxis emas."
      : language === "ru"
        ? "Этот скрининг не является медицинским диагнозом."
        : "This screening is not a medical diagnosis.";
  return `${prefix}\n\n${lines.join("\n")}\n\n${disclaimer}`;
}

function explainPriority(
  context: PatientAssistantContext,
  language: PatientAssistantLanguage
) {
  const triage = context.triage;
  if (!triage) {
    return language === "uz"
      ? "Triage natijasi hali yaratilmagan. Priority faqat MedTwin qoidalar tizimi tomonidan scan tugagach hisoblanadi."
      : language === "ru"
        ? "Результат триажа ещё не создан. Приоритет рассчитывает только система правил MedTwin после завершения сканирования."
        : "A triage result is not available yet. Only the MedTwin rules engine calculates priority after the scan is complete.";
  }
  const reasons = triage.reasons.length
    ? triage.reasons.map((reason) => `• ${reason}`).join("\n")
    : language === "uz"
      ? "• Mavjud signallarda ogohlantirish topilmadi."
      : language === "ru"
        ? "• В доступных сигналах предупреждений не обнаружено."
        : "• No warning signal was found in the available data.";
  const introduction =
    language === "uz"
      ? `MedTwin qoidalar tizimi bu screeningni ${triage.headline} deb belgiladi.`
      : language === "ru"
        ? `Система правил MedTwin отметила этот скрининг как ${triage.headline}.`
        : `The MedTwin rules engine marked this screening ${triage.headline}.`;
  const disclaimer =
    language === "uz"
      ? "Men priorityni o‘zgartira olmayman. Bu screening tashxis emas."
      : language === "ru"
        ? "Я не могу изменить приоритет. Этот скрининг не является диагнозом."
        : "I cannot change this priority. This screening is not a diagnosis.";
  return `${introduction}\n\n${reasons}\n\n${triage.recommendedAction}\n\n${disclaimer}`;
}

function explainMissing(
  context: PatientAssistantContext,
  language: PatientAssistantLanguage
) {
  const missing = context.measurements.filter(
    (measurement) => measurement.value === null
  );
  if (!missing.length) {
    return language === "uz"
      ? "Kontekstdagi o‘lchovlarning barchasida qiymat mavjud."
      : language === "ru"
        ? "Для всех измерений в текущем контексте есть значения."
        : "All measurements in the current context have values.";
  }
  const labels = missing
    .map((measurement) => `• ${measurement.label}: ${statusLabel(measurement, language)}`)
    .join("\n");
  const ending =
    language === "uz"
      ? "O‘lchanmagan qiymat normal degani emas."
      : language === "ru"
        ? "Отсутствующее измерение не означает норму."
        : "A missing measurement does not mean it was normal.";
  return `${labels}\n\n${ending}`;
}

function explainOneMeasurement(
  context: PatientAssistantContext,
  key: PatientAssistantMeasurement["key"],
  language: PatientAssistantLanguage
) {
  const measurement = context.measurements.find((item) => item.key === key);
  if (!measurement || measurement.value === null) {
    const label = measurement?.label ?? key.replaceAll("_", " ");
    return language === "uz"
      ? `${label} bu sessiyada o‘lchanmagan. Menda uning normal ekanini aytish uchun qiymat yo‘q.`
      : language === "ru"
        ? `${label} в этой сессии не измерялось. У меня нет значения, чтобы назвать его нормальным.`
        : `${label} was not measured in this session. I do not have a value that could be described as normal.`;
  }
  return formatMeasurement(measurement, language);
}

function explainNextStep(
  context: PatientAssistantContext,
  language: PatientAssistantLanguage
) {
  if (context.triage) {
    return language === "uz"
      ? `${context.triage.recommendedAction} Priority MedTwin qoidalar tizimidan olingan va men uni o‘zgartira olmayman.`
      : language === "ru"
        ? `${context.triage.recommendedAction} Приоритет получен от системы правил MedTwin, и я не могу его изменить.`
        : `${context.triage.recommendedAction} The priority comes from the MedTwin rules engine and I cannot change it.`;
  }
  if (context.scan) {
    return getScanGuidance(context.scan.currentStep, context.scan, language);
  }
  return generalScanHelp(language);
}

function formatMeasurement(
  measurement: PatientAssistantMeasurement,
  language: PatientAssistantLanguage
) {
  if (measurement.value === null) {
    return `${measurement.label}: ${statusLabel(measurement, language)}`;
  }
  const quality =
    measurement.quality === null
      ? ""
      : ` · ${language === "uz" ? "sifat" : language === "ru" ? "качество" : "quality"} ${Math.round(measurement.quality * 100)}%`;
  return `${measurement.label}: ${measurement.value} ${measurement.unit} · ${sourceLabel(measurement.source, language)}${quality}`;
}

function sourceLabel(
  source: PatientAssistantMeasurement["source"],
  language: PatientAssistantLanguage
) {
  const labels = {
    camera_ppg: "Camera PPG",
    camera_pose: language === "ru" ? "оценка камеры / позы" : language === "uz" ? "kamera / poza bahosi" : "camera / pose estimate",
    external_device: language === "ru" ? "внешнее устройство" : language === "uz" ? "tashqi qurilma" : "external device",
    demo_scenario: language === "ru" ? "демо-сценарий" : language === "uz" ? "demo ssenariy" : "demo scenario",
    not_measured: language === "ru" ? "не измерено" : language === "uz" ? "o‘lchanmagan" : "not measured",
    user_reported: language === "ru" ? "со слов пациента" : language === "uz" ? "foydalanuvchi kiritgan" : "user reported",
    health_station: "Health Station",
    camera_face_landmarks: language === "ru" ? "камера / точки лица" : language === "uz" ? "kamera / yuz nuqtalari" : "camera / face landmarks",
    camera_pose_landmarks: language === "ru" ? "камера / точки позы" : language === "uz" ? "kamera / poza nuqtalari" : "camera / pose landmarks",
    microphone_voice_activity: language === "ru" ? "микрофон / голосовая активность" : language === "uz" ? "mikrofon / ovoz faolligi" : "microphone / voice activity",
    derived: language === "ru" ? "расчётное" : language === "uz" ? "hisoblangan" : "derived",
  } as const;
  return labels[source];
}

function statusLabel(
  measurement: PatientAssistantMeasurement,
  language: PatientAssistantLanguage
) {
  if (measurement.status === "external_device_required") {
    return language === "uz"
      ? "tashqi qurilma kerak"
      : language === "ru"
        ? "требуется внешнее устройство"
        : "external device required";
  }
  if (measurement.status === "insufficient_signal") {
    return language === "uz"
      ? "signal yetarli emas"
      : language === "ru"
        ? "недостаточный сигнал"
        : "insufficient signal";
  }
  return language === "uz"
    ? "o‘lchanmagan"
    : language === "ru"
      ? "не измерено"
      : "not measured";
}

function unavailableResponse(
  language: PatientAssistantLanguage,
  context: PatientAssistantContext
): PatientAssistantResponse {
  const message =
    language === "uz"
      ? "AI izohi hozircha mavjud emas. Scan, Digital Twin, triage, WHY va Clinical Brief ishlashda davom etadi. Quyidagi aniq amallardan foydalanishingiz mumkin."
      : language === "ru"
        ? "Объяснение AI временно недоступно. Сканирование, Digital Twin, триаж, WHY и Clinical Brief продолжают работать. Используйте доступные точные действия."
        : "AI explanation is temporarily unavailable. Scan, Digital Twin, triage, WHY, and Clinical Brief continue to work. You can use the available explicit actions.";
  return response(
    message,
    "assistant_unavailable",
    context.currentRoute === "scan"
      ? allowed(context, "SHOW_SCAN_HELP")
      : allowed(context, "OPEN_WHY"),
    isEscalation(context)
  );
}

function diagnosisBoundary(language: PatientAssistantLanguage) {
  return language === "uz"
    ? "Men tashxis qo‘ymayman va bu screening kasallik sababini aniqlay olmaydi. Men faqat MedTwin qayd etgan o‘lchovlar, mavjud triage natijasi va keyingi qadamni tushuntira olaman."
    : language === "ru"
      ? "Я не ставлю диагнозы, и этот скрининг не определяет причину заболевания. Я могу объяснить только измерения MedTwin, существующий результат триажа и следующий шаг."
      : "I cannot diagnose disease, and this screening cannot determine a cause. I can explain only the measurements MedTwin recorded, the existing triage result, and the configured next step.";
}

function medicationBoundary(language: PatientAssistantLanguage) {
  return language === "uz"
    ? "Men retsept bilan beriladigan dorini boshlash, to‘xtatish yoki dozasini o‘zgartirishni tavsiya qila olmayman. Bunday o‘zgarishni sizni davolayotgan tibbiy mutaxassis bilan muhokama qiling."
    : language === "ru"
      ? "Я не могу советовать начинать, прекращать или менять дозу рецептурного лекарства. Обсудите такие изменения с медицинским специалистом, который вас лечит."
      : "I cannot advise starting, stopping, or changing the dose of prescription medication. Discuss medication changes with an appropriate medical professional.";
}

function triageBoundary(language: PatientAssistantLanguage) {
  return language === "uz"
    ? "Men MedTwin priority natijasini o‘zgartira olmayman. Priority faqat mavjud o‘lchovlar va tuzilgan alomatlar asosida ishlaydigan qoidalar tizimidan keladi."
    : language === "ru"
      ? "Я не могу изменить приоритет MedTwin. Его определяет только система правил на основе доступных измерений и структурированных симптомов."
      : "I cannot change the MedTwin priority. It comes only from the rules engine using available measurements and structured symptoms.";
}

function privacyMessage(language: PatientAssistantLanguage) {
  return language === "uz"
    ? "Assistantga xom video, kamera kadrlari yoki audio yuborilmaydi. U faqat o‘lchovlar, manba, sifat, alomatlar va joriy UI holati kabi cheklangan kontekstni oladi. Suhbat shu brauzer tabidagi sessiyada saqlanadi."
    : language === "ru"
      ? "Ассистент не получает необработанное видео, кадры камеры или аудио. Ему передаётся только ограниченный контекст: измерения, источник, качество, симптомы и состояние интерфейса. История разговора хранится только в сессии этой вкладки."
      : "The assistant does not receive raw video, camera frames, or audio. It receives only bounded context such as measurements, source, quality, symptoms, and current UI state. Conversation history stays in this browser-tab session.";
}

function generalScanHelp(language: PatientAssistantLanguage) {
  return language === "uz"
    ? "MedTwin scan bosqichlarini ketma-ket bajaring. Kamera va mikrofon faqat tegishli bosqichda ishlaydi; xom media saqlanmaydi."
    : language === "ru"
      ? "Проходите этапы MedTwin по порядку. Камера и микрофон используются только на соответствующем этапе; необработанные медиа не сохраняются."
      : "Complete the MedTwin steps in order. Camera and microphone are used only during the relevant step, and raw media is not stored.";
}

function anatomyMessage(
  language: PatientAssistantLanguage,
  organ: "heart" | "lungs" | "brain" | "body",
  measurement: PatientAssistantMeasurement | null,
  dataMode: PatientAssistantContext["dataMode"]
) {
  const organLabel =
    language === "uz"
      ? { heart: "yurak", lungs: "o‘pka", brain: "miya", body: "tana" }[organ]
      : language === "ru"
        ? { heart: "сердце", lungs: "лёгкие", brain: "мозг", body: "тело" }[organ]
        : organ;
  const opening =
    language === "uz"
      ? `${organLabel} ko‘rinishi ochilmoqda.`
      : language === "ru"
        ? `Открываю вид: ${organLabel}.`
        : `Opening the ${organLabel} view.`;
  if (!measurement) return opening;
  const value = formatMeasurement(measurement, language);
  const demo =
    dataMode === "demo"
      ? language === "uz"
        ? " Bu demo ssenariy qiymati."
        : language === "ru"
          ? " Это значение демонстрационного сценария."
          : " This is a demonstration-scenario value."
      : "";
  return `${opening}\n\n${value}.${demo}`;
}

function anatomyIntent(message: string): {
  action: PatientAssistantAction;
  organ: "heart" | "lungs" | "brain" | "body";
} | null {
  if (contains(message, ["show my heart", "show heart", "yuragimni ko‘rsat", "yuragimni ko'rsat", "покажи сердце"])) {
    return { action: "FOCUS_HEART", organ: "heart" };
  }
  if (contains(message, ["show my lungs", "show lungs", "o‘pkamni ko‘rsat", "o'pkamni ko'rsat", "покажи лёгкие", "покажи легкие"])) {
    return { action: "FOCUS_LUNGS", organ: "lungs" };
  }
  if (contains(message, ["show my brain", "show brain", "miyamni ko‘rsat", "miyamni ko'rsat", "покажи мозг"])) {
    return { action: "FOCUS_BRAIN", organ: "brain" };
  }
  if (contains(message, ["reset anatomy", "show body", "tanani ko‘rsat", "tanani ko'rsat", "покажи тело"])) {
    return { action: "RESET_ANATOMY_VIEW", organ: "body" };
  }
  return null;
}

function requestedMeasurement(
  message: string
): PatientAssistantMeasurement["key"] | null {
  if (contains(message, ["blood pressure", "bp", "qon bosim", "давлен"])) {
    return "blood_pressure";
  }
  if (contains(message, ["spo2", "oxygen", "kislorod", "кислород", "сатурац"])) {
    return "spo2";
  }
  if (contains(message, ["heart rate", "pulse", "yurak ur", "puls", "пульс", "частот серд"])) {
    return "heart_rate";
  }
  if (contains(message, ["respirat", "breathing rate", "nafas", "дыхани"])) {
    return "respiratory_rate";
  }
  return null;
}

function response(
  message: string,
  intent: PatientAssistantResponse["intent"],
  suggestedActions: PatientAssistantAction[],
  requiresEscalation: boolean
): PatientAssistantResponse {
  return { message, intent, suggestedActions, requiresEscalation };
}

function allowed(
  context: PatientAssistantContext,
  action: PatientAssistantAction
) {
  return context.availableActions.includes(action) ? [action] : [];
}

function isEscalation(context: PatientAssistantContext) {
  return context.triage?.priority === "RED";
}

function contains(message: string, phrases: string[]) {
  return phrases.some((phrase) => message.includes(phrase));
}
