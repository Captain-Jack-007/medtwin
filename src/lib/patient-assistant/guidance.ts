import type {
  PatientAssistantLanguage,
  ScanAssistantSnapshot,
} from "./types";

const COPY = {
  en: {
    consent: "Review the consent information, then confirm when you are ready to begin.",
    info: "Enter only the requested age range, sex, and aggregation area. An exact home address is not needed.",
    symptoms: "Select symptoms you currently report. Leave an item unselected if it does not apply.",
    permission: "Allow access when your browser asks. The sensor is used only for this scan step.",
    permissionDenied: "Access was not granted. Enable the permission in your browser settings, then try again.",
    faceIdle: "Place your face, shoulders, and upper torso inside the camera view, then enable the camera.",
    faceMissing: "I cannot detect your face yet. Move slightly closer and keep your face inside the guide.",
    oneFace: "Keep only one person inside the camera view.",
    lighting: "Lighting appears low. Move toward a brighter area without strong backlight.",
    motion: "Keep your head and phone still while the capture continues.",
    torso: "Move back slightly so your head, shoulders, and upper torso are visible.",
    faceGood: "Good position. Breathe normally and remain still while MedTwin completes the capture.",
    pulseIdle: "Place your fingertip gently over the rear camera and flash, then start the camera PPG capture.",
    coverage: "Cover the rear camera fully with your fingertip.",
    pulseStill: "Signal quality is low. Keep your finger and phone still.",
    pulseGood: "Good signal. Keep still while MedTwin completes the measurement.",
    movementIdle: "Stand far enough back for both arms to be visible, then enable the camera.",
    raiseBoth: "Raise both arms and keep them inside the camera view.",
    movementHold: "Both arms are visible. Hold this position until the timer completes.",
    speechIdle: "When ready, enable the microphone and read the displayed phrase clearly.",
    voice: "I cannot detect your voice yet. Speak clearly toward the microphone.",
    clipping: "Your voice is clipping. Move slightly farther from the microphone and speak normally.",
    speechGood: "Voice detected. Keep speaking clearly until recording completes.",
    complete: "This scan step is complete. Continue when you are ready.",
    failed: "The sensor is unavailable. Review the error message, then retry or use the available skip option.",
  },
  uz: {
    consent: "Rozilik ma’lumotlarini o‘qing va tayyor bo‘lsangiz tasdiqlang.",
    info: "Faqat yosh oralig‘i, jins va hududni kiriting. Aniq uy manzili kerak emas.",
    symptoms: "Hozir sezayotgan alomatlaringizni belgilang. Mos kelmasa, belgilamang.",
    permission: "Brauzer so‘raganda ruxsat bering. Sensor faqat shu scan bosqichida ishlatiladi.",
    permissionDenied: "Ruxsat berilmadi. Brauzer sozlamalarida ruxsatni yoqing va qayta urinib ko‘ring.",
    faceIdle: "Yuz, yelka va gavdaning yuqori qismini kameraga joylashtiring, keyin kamerani yoqing.",
    faceMissing: "Yuzingiz hali ko‘rinmayapti. Biroz yaqinlashing va yuzingizni yo‘riqnoma ichida tuting.",
    oneFace: "Kamera tasvirida faqat bitta odam bo‘lsin.",
    lighting: "Yorug‘lik past. Orqa tomondan kuchli nur tushmaydigan yorug‘roq joyga o‘ting.",
    motion: "Scan davomida boshingiz va telefonni qimirlatmasdan ushlang.",
    torso: "Bosh, yelka va gavdaning yuqori qismi ko‘rinishi uchun biroz orqaga turing.",
    faceGood: "Holatingiz yaxshi. Tabiiy nafas oling va scan tugaguncha qimirlamang.",
    pulseIdle: "Barmog‘ingizni orqa kamera va chiroq ustiga yengil qo‘ying, keyin kamera PPG scanini boshlang.",
    coverage: "Orqa kamerani barmog‘ingiz bilan to‘liq yoping.",
    pulseStill: "Signal sifati past. Barmog‘ingiz va telefonni qimirlatmasdan ushlang.",
    pulseGood: "Signal yaxshi. O‘lchov tugaguncha qimirlamang.",
    movementIdle: "Ikki qo‘lingiz ham ko‘rinishi uchun orqaroq turing, keyin kamerani yoqing.",
    raiseBoth: "Ikki qo‘lingizni ko‘taring va kamera ichida ushlab turing.",
    movementHold: "Ikki qo‘l ko‘rinmoqda. Taymer tugaguncha shu holatda turing.",
    speechIdle: "Tayyor bo‘lsangiz mikrofonni yoqing va ko‘rsatilgan jumlani aniq o‘qing.",
    voice: "Ovozingiz hali aniqlanmadi. Mikrofonga qarab aniq gapiring.",
    clipping: "Ovoz juda baland. Mikrofondan biroz uzoqlashing va odatdagidek gapiring.",
    speechGood: "Ovoz aniqlandi. Yozuv tugaguncha aniq gapirishda davom eting.",
    complete: "Bu scan bosqichi tugadi. Tayyor bo‘lsangiz davom eting.",
    failed: "Sensor ishlamayapti. Xatoni ko‘rib chiqing, keyin qayta urinib ko‘ring yoki mavjud o‘tkazib yuborish variantidan foydalaning.",
  },
  ru: {
    consent: "Прочитайте информацию о согласии и подтвердите, когда будете готовы начать.",
    info: "Укажите только возрастной диапазон, пол и район. Точный домашний адрес не требуется.",
    symptoms: "Отметьте симптомы, которые есть сейчас. Не отмечайте то, что не относится к вам.",
    permission: "Разрешите доступ, когда браузер запросит его. Сенсор используется только на этом этапе.",
    permissionDenied: "Доступ не предоставлен. Разрешите его в настройках браузера и повторите попытку.",
    faceIdle: "Поместите лицо, плечи и верхнюю часть туловища в кадр, затем включите камеру.",
    faceMissing: "Лицо пока не обнаружено. Подойдите немного ближе и держите лицо внутри рамки.",
    oneFace: "В кадре должен находиться только один человек.",
    lighting: "Освещение слабое. Перейдите в более светлое место без яркого света за спиной.",
    motion: "Не двигайте головой и телефоном во время захвата.",
    torso: "Отойдите немного назад, чтобы были видны голова, плечи и верхняя часть туловища.",
    faceGood: "Положение хорошее. Дышите обычно и не двигайтесь до завершения захвата.",
    pulseIdle: "Мягко накройте пальцем заднюю камеру и вспышку, затем запустите камеру PPG.",
    coverage: "Полностью закройте заднюю камеру кончиком пальца.",
    pulseStill: "Качество сигнала низкое. Не двигайте палец и телефон.",
    pulseGood: "Сигнал хороший. Не двигайтесь до завершения измерения.",
    movementIdle: "Отойдите так, чтобы обе руки были видны, затем включите камеру.",
    raiseBoth: "Поднимите обе руки и держите их в кадре.",
    movementHold: "Обе руки видны. Удерживайте положение до окончания таймера.",
    speechIdle: "Когда будете готовы, включите микрофон и чётко прочитайте фразу на экране.",
    voice: "Голос пока не обнаружен. Говорите чётко в сторону микрофона.",
    clipping: "Звук слишком громкий. Немного отодвиньтесь от микрофона и говорите обычно.",
    speechGood: "Голос обнаружен. Продолжайте говорить чётко до конца записи.",
    complete: "Этот этап завершён. Продолжайте, когда будете готовы.",
    failed: "Сенсор недоступен. Проверьте сообщение об ошибке, затем повторите попытку или используйте доступный пропуск.",
  },
} as const;

export function getScanGuidance(
  currentStep: string,
  scan: ScanAssistantSnapshot | null,
  language: PatientAssistantLanguage
) {
  const copy = COPY[language];
  if (currentStep === "consent") return copy.consent;
  if (currentStep === "info") return copy.info;
  if (currentStep === "symptoms") return copy.symptoms;
  if (currentStep === "result") return copy.complete;
  if (!scan) return copy.failed;
  if (scan.permissions.camera === "denied" || scan.permissions.microphone === "denied") {
    return copy.permissionDenied;
  }
  if (scan.status === "requesting_permission" || scan.status === "preparing") {
    return copy.permission;
  }
  if (scan.status === "failed" || scan.status === "unsupported") return copy.failed;
  if (scan.status === "success" || scan.status === "low_quality" || scan.status === "complete") {
    return copy.complete;
  }

  if (currentStep === "face_breathing") {
    if (scan.status === "idle" || scan.status === "not_started") return copy.faceIdle;
    if (!scan.indicators.faceDetected) return copy.faceMissing;
    if (!scan.indicators.exactlyOneFace) return copy.oneFace;
    if (!scan.indicators.lightingGood) return copy.lighting;
    if (!scan.indicators.motionLow) return copy.motion;
    if (!scan.indicators.upperBodyDetected) return copy.torso;
    return copy.faceGood;
  }
  if (currentStep === "pulse") {
    if (scan.status === "idle" || scan.status === "not_started") return copy.pulseIdle;
    if ((scan.indicators.fingerCoverage ?? 0) < 0.48) return copy.coverage;
    if ((scan.signalQuality ?? 0) < 0.55) return copy.pulseStill;
    return copy.pulseGood;
  }
  if (currentStep === "movement") {
    if (scan.status === "idle" || scan.status === "not_started") return copy.movementIdle;
    if (!scan.indicators.leftArmRaised || !scan.indicators.rightArmRaised) {
      return copy.raiseBoth;
    }
    return copy.movementHold;
  }
  if (currentStep === "speech") {
    if (scan.status === "idle" || scan.status === "not_started") return copy.speechIdle;
    if (!scan.indicators.voiceDetected) return copy.voice;
    if (scan.indicators.audioClipping) return copy.clipping;
    return copy.speechGood;
  }
  return copy.complete;
}
