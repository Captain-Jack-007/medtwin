# PRD — MedTwin

## AI Diagnostic & Triage Network for Rural Healthcare

**Version:** 1.0 — Hackathon MVP
**Project:** MedTwin
**Tagline:** _One smartphone. One minute. The right patient reaches the right doctor faster._
**Uzbek:** _Bitta smartfon. Bir daqiqa. To‘g‘ri bemor — to‘g‘ri mutaxassisga._

---

## 1. Product Vision

MedTwin — chekka hududlarda tibbiy mutaxassislar va diagnostika imkoniyatlari yetishmasligi muammosini kamaytirishga qaratilgan **AI-powered screening, triage va remote-care platformasi**.

Platforma oddiy smartfon yordamida bemordan mavjud signallarni yig‘adi, **Digital Health Twin** yaratadi, xavf belgilarini aniqlashga yordam beradi va bemorni kerakli tibbiy yordam darajasiga yo‘naltiradi.

```text
Smartphone
     ↓
60-second Health Scan
     ↓
Digital Health Twin
     ↓
AI Risk & Triage Engine
     ↓
┌────────────┬─────────────┬──────────────┐
│ Self-care  │   Doctor    │   Emergency  │
│ / Review   │ consultation│   escalation │
└────────────┴─────────────┴──────────────┘
                         ↓
              Regional Control Tower
                         ↓
               Mobile Clinic / Hospital
```

MedTwin **shifokorni almashtirmaydi va yakuniy tashxis qo‘ymaydi**. U screening, triage, prioritization va clinical decision support uchun mo‘ljallangan.

---

# 2. Problem

Hackathon tomonidan berilgan asosiy muammo:

> O‘zbekistonning chekka qishloqlarida tor soha mutaxassislari — kardiolog, onkolog, nevrolog — va diagnostika uskunalari yetishmaydi. Aholining katta qismi ixtisoslashtirilgan tibbiy yordamdan foydalanishda qiyinchiliklarga duch keladi.

Asosiy muammolar:

- mutaxassislar markaziy shaharlarda jamlangan;
- dastlabki screening imkoniyatlari cheklangan;
- qaysi bemor shoshilinch ekanini aniqlash qiyin;
- bemor uzoq masofani keraksiz bosib o'tishi mumkin;
- shifokor kelguncha bemor holati haqida strukturali ma'lumot mavjud emas;
- mobil klinikalarni qayerga birinchi yuborish kerakligi aniq emas;
- remote specialist bemor haqida ma'lumot yig‘ishga ko‘p vaqt sarflaydi.

---

# 3. Proposed Solution

MedTwin uchta asosiy mahsulotni birlashtiradi.

### Layer 1 — MedTwin Scan

Smartfon yordamida 60–90 soniyalik guided health screening.

### Layer 2 — Digital Health Twin

Yig‘ilgan signallarni bemorning yagona vizual holatiga birlashtirish.

### Layer 3 — Health Control Tower

Ko‘plab bemorlarni hudud bo‘yicha prioritetlash va mobil klinika/shifokor resurslarini yo‘naltirish.

Shunday qilib:

> **MedTwin individual bemorni screening qilishdan butun hududdagi tibbiy resurslarni boshqarishgacha bo‘lgan zanjirni yaratadi.**

---

# 4. Target Users

### Primary

**Qishloq aholisi**

Smartfon orqali dastlabki screening.

**Patronaj hamshiralar**

Bir kunda ko‘plab bemorlarni tekshirish va xavfli holatlarni ajratish.

**Oilaviy shifokorlar**

AI yordamida bemorlarni prioritetlash.

### Secondary

**Kardiolog / nevrolog / boshqa mutaxassis**

Remote consultation oldidan strukturali clinical brief olish.

**Mobil klinika operatorlari**

Qaysi hudud va bemorlarga birinchi borishni aniqlash.

**Hududiy sog‘liqni saqlash boshqaruvi**

Population-level risk dashboard.

---

# 5. Core User Journey

## Patient flow

```text
START SCAN
    ↓
Consent
    ↓
Basic information
    ↓
Symptoms
    ↓
Face Camera
    ↓
Finger Camera / Pulse
    ↓
Breathing
    ↓
Speech Test
    ↓
Movement Test
    ↓
Optional Medical Sensors
    ↓
AI Analysis
    ↓
DIGITAL TWIN
    ↓
TRIAGE
```

Natija:

```text
GREEN
No immediate warning detected

YELLOW
Monitoring / routine review

ORANGE
Professional assessment recommended

RED
Urgent professional assessment recommended
```

Bu ranglar **diagnosis emas, triage priority** hisoblanadi.

---

# 6. Feature — 60 Second AI Health Scan

Bu MedTwin'ning asosiy consumer experience'i.

## Step 1 — Face Scan

Front camera ochiladi.

UI:

```text
MEDTWIN SCAN

        ┌───────────────┐
        │               │
        │      FACE     │
        │               │
        └───────────────┘

Keep your face inside the frame.

Signal quality
████████████████ 92%
```

Prototype quyidagilarni ko‘rsatishi mumkin:

- face detection;
- facial symmetry;
- head movement;
- signal quality.

---

# 7. Feature — Pulse Scan

Foydalanuvchi barmog‘ini kamera/flash ustiga qo‘yadi.

PPG signal olinadi.

UI real-time waveform ko‘rsatadi:

```text
HEART SIGNAL

       /\        /\       /\
______/  \______/  \_____/  \____

Heart Rate

       82 BPM
```

Hackathon MVP'da signal sifatini ham ko‘rsatish kerak:

**Poor / Fair / Good**

Ishonchsiz signal bo‘lsa, tizim natijani uydirmaydi.

---

# 8. Feature — Breathing Analysis

Foydalanuvchi 15–20 soniya tinch holatda turadi.

System respiratory pattern uchun signal yig‘adi.

Output:

```text
RESPIRATION

Estimated rate
18 / min

Signal quality
GOOD
```

Prototype darajasida experimental estimate ekanligi ko‘rsatiladi.

---

# 9. Feature — Neurological Screening

Bu katta wow-effect beradi.

MedTwin foydalanuvchini guided testlardan o'tkazadi.

### Face

> “Tabassum qiling.”

Facial symmetry visualization.

### Arms

> “Ikkala qo‘lingizni ko‘taring.”

Camera body/pose landmarks orqali movement symmetry'ni kuzatadi.

### Speech

Foydalanuvchiga oddiy gap aytiladi.

> “Bugun havo juda yaxshi.”

System speech sample'ni tahlil qiladi.

Natija:

```text
NEURO SCREEN

Face symmetry       ✓
Arm symmetry        ✓
Speech              ✓

No obvious warning pattern detected
```

Bu **stroke diagnosis** deb ko‘rsatilmaydi.

---

# 10. Optional Medical Devices

Smartphone-only scan birinchi layer.

Professionalroq screening uchun MedTwin tashqi qurilmalarni qabul qilishi mumkin:

```text
              MedTwin
                 │
     ┌───────────┼───────────┐
     ↓           ↓           ↓
 BP Monitor   Pulse Ox.    ECG
     ↓           ↓           ↓
 Blood       SpO₂/HR      Cardiac
 Pressure                 Signal
```

Kelajakda:

- digital stethoscope;
- thermometer;
- glucose meter;
- wearable devices.

Hackathon MVP'da bularni **synthetic/simulated device streams** bilan ko‘rsatish mumkin.

---

# 11. Digital Health Twin

Scan tugagach eng muhim ekran ochiladi.

### 3D Human Model

Markazda interactive 3D human body.

Organ systems:

❤️ Cardiovascular
🧠 Neurological
🫁 Respiratory

Normal holatda neutral.

Warning mavjud bo‘lsa tegishli sistema highlight qilinadi.

Masalan:

```text
           DIGITAL TWIN

               🧍

       ❤️ Cardiovascular
             ORANGE

       🫁 Respiratory
              GREEN

       🧠 Neurological
              GREEN
```

O‘ng panel:

```text
HEART RATE          104 bpm
RESPIRATION          21/min
BP*                 158/96
SpO₂*                  93%

SYMPTOMS
Chest discomfort
Shortness of breath

TRIAGE

████████████████░░

HIGH PRIORITY
```

`*` external/simulated device data bo‘lsa aniq label qilinadi.

---

# 12. AI Risk Engine

AI barcha ma'lumotni birlashtiradi.

Input:

```text
Symptoms
+
Camera signals
+
Movement
+
Speech
+
Patient information
+
Optional sensors
+
Medical history
```

Output:

```json
{
  "priority": "HIGH",
  "systems": ["cardiovascular"],
  "evidence": [
    "reported chest discomfort",
    "elevated heart rate",
    "low measured oxygen saturation"
  ],
  "recommended_action": "urgent_professional_assessment"
}
```

---

# 13. Safety Architecture

Bu loyiha uchun juda muhim.

LLM o‘zi xohlagancha clinical risk score yaratmasligi kerak.

Architecture:

```text
Patient Data
     ↓
Validation
     ↓
Deterministic Clinical Rules
     +
Validated Risk Models
     ↓
Triage Result
     ↓
LLM Explanation
```

Ya'ni LLM:

**explain qiladi**, lekin prototype'dagi asosiy safety-critical triage qarorini mustaqil ravishda uydirmaydi.

Hackathon synthetic scenario'lari alohida belgilanadi.

---

# 14. Explainable AI — “WHY?”

User:

### WHY?

bosadi.

MedTwin:

```text
WHY HIGH PRIORITY?

Four warning signals contributed:

01
Chest discomfort reported

02
Heart rate elevated

03
Blood pressure elevated*

04
Oxygen saturation below configured
screening threshold*

RECOMMENDATION

Seek professional medical assessment.
```

Bu judge uchun muhim:

**AI → Evidence → Decision**

---

# 15. AI Clinical Copilot

Doctor tabiiy tilda savol bera oladi.

Masalan:

> “Eng muhim signal nima?”

> “Oxirgi 24 soatda nima o‘zgardi?”

> “Nima uchun patient high priority?”

> “Cardiology consultation uchun summary yarat.”

AI faqat mavjud evidence asosida javob berishi kerak.

---

# 16. Automatic Clinical Brief

Remote doctor uchun:

```text
MEDTWIN CLINICAL BRIEF

Patient
MT-014

Priority
HIGH

PRIMARY CONCERN
Cardiovascular screening warning

REPORTED
• Chest discomfort
• Shortness of breath

OBSERVATIONS
• HR: 112 bpm
• RR: 22/min

CONNECTED DEVICE DATA
• BP: 168/102
• SpO₂: 91%

AI TRIAGE
Urgent professional assessment recommended.

Generated:
22:14
```

Doctor 5–10 daqiqalik information gathering o‘rniga bir necha soniyada holatni tushunadi.

---

# 17. Regional Health Control Tower

Bu MedTwin'ning eng katta **WOW screen**laridan biri.

Navoiy viloyati xaritasi.

```text
MEDTWIN CONTROL TOWER

        NAVOIY REGION

         🟢 Village A
            32

 🟠 Village B              🟢 Village D
    18                         21

             🔴 Village C
                 14
              3 HIGH
```

Dashboard:

```text
PATIENTS SCREENED       1,284

HIGH PRIORITY              18

WAITING SPECIALIST         37

MOBILE CLINICS              4

OFFLINE VILLAGES            2
```

---

# 18. AI Resource Prioritization

AI faqat:

> “Village C xavfli.”

demaydi.

U tavsiya beradi:

```text
AI RECOMMENDATION

Mobile Clinic #2
→ Village C

WHY?

3 high-priority patients
2 cardiovascular
1 neurological

Estimated travel:
34 min

Recommended:
Dispatch first
```

Bu MedTwin'ni oddiy patient app'dan **healthcare operations platform**ga aylantiradi.

---

# 19. Mobile Clinic

Mobil klinika statuslari:

```text
CLINIC-01
Available

CLINIC-02
→ Village C
ETA 34 min

CLINIC-03
Cardiology mission

CLINIC-04
Offline
```

Mapda ambulance/mobile clinic animation qilish mumkin.

MineOS'dagi truck animation kabi:

**Village → Mobile Clinic → Patient → Hospital**

Bu hackathon demo uchun juda kuchli vizual layer.

---

# 20. Offline Mode

Chekka hudud uchun bu critical requirement.

MedTwin:

```text
PHONE
  ↓
Local screening
  ↓
Encrypted local queue
  ↓
Internet available?
  │
 ┌┴─────────┐
NO          YES
│            │
Store       Sync
locally      ↓
          Control Tower
```

Internet bo‘lmasa:

- screening davom etadi;
- ma'lumot local saqlanadi;
- internet qaytganda sync qilinadi.

---

# 21. Hackathon MVP Scope

48–72 soatda **hammasini real medical AI qilib qurishga urinmaslik kerak**.

### P0 — Must Have

1. Patient onboarding
2. Consent screen
3. Camera scan
4. Real face detection
5. Pulse waveform demo / real PPG prototype
6. Symptom questionnaire
7. Digital Health Twin
8. Deterministic triage engine
9. Green / Yellow / Orange / Red priority
10. WHY explanation
11. Synthetic high-risk scenario
12. Clinical Brief
13. Navoiy Control Tower
14. Village prioritization
15. Mobile Clinic dispatch simulation

### P1

Pose/arm analysis, speech screening, respiratory-rate prototype, specialist dashboard and offline simulation.

### P2

External ECG, BP and SpO₂ devices, real telemedicine, wearables and clinically validated models.

---

# 22. Demo Data

Because real patient data should not be required for the hackathon:

```text
ALL DEMO PATIENT DATA IS
SYNTHETIC / SIMULATED
```

Create approximately:

**100–500 synthetic patients**

across:

**8–12 Navoiy locations.**

Example distribution:

```text
72% Green
17% Yellow
8% Orange
3% Red
```

Add controlled scenarios:

**Patient A:** normal
**Patient B:** cardiovascular warning
**Patient C:** neurological warning
**Patient D:** respiratory warning

This gives a deterministic demo.

---

# 23. Technical Architecture

Recommended:

```text
                 MEDTWIN

                    │
              Next.js / React
                    │
          ┌─────────┴─────────┐
          │                   │
     Patient App        Control Tower
          │                   │
          └─────────┬─────────┘
                    ↓
               API Layer
                    │
       ┌────────────┼────────────┐
       ↓            ↓            ↓
   Screening     Triage       AI Copilot
    Engine        Engine
       │            │
       └──────┬─────┘
              ↓
        Patient Twin
              ↓
          Database
```

### Frontend

- Next.js
- React
- TypeScript
- Tailwind
- Three.js / React Three Fiber

### AI / Vision

Depending on implementation:

- MediaPipe
- OpenCV
- browser camera APIs
- Web Audio API
- LLM for grounded explanation

### Backend

- FastAPI or Node.js
- PostgreSQL or lightweight hackathon database
- WebSocket for real-time simulated signals

---

# 24. Suggested Data Model

```text
Patient

id
ageRange
sex
location
symptoms
consent
createdAt


ScreeningSession

id
patientId
heartRate
respiratoryRate
faceSymmetry
speechResult
movementResult
signalQuality


DeviceMeasurement

type
value
unit
source
timestamp
isSynthetic


TriageResult

priority
systems[]
evidence[]
recommendedAction
ruleVersion


DigitalTwin

patientId
cardiovascularState
neurologicalState
respiratoryState


Clinic

id
location
status
capabilities


Dispatch

clinicId
villageId
priority
reason
eta
```

---

# 25. UI Structure

### Patient

```text
/scan
/scan/face
/scan/pulse
/scan/movement
/scan/symptoms
/twin/:id
/result/:id
```

### Medical

```text
/doctor
/patient/:id
/clinical-brief/:id
```

### Control Tower

```text
/control
/control/map
/control/patients
/control/clinics
```

---

# 26. Main Dashboard Design

Visually I would keep the same **command-center feeling** that works well in MineOS, but make MedTwin cleaner and more clinical.

```text
┌──────────────────────────────────────────────────┐
│ MEDTWIN                  NAVOIY • LIVE       ●   │
├─────────────────────────────┬────────────────────┤
│                             │ HIGH PRIORITY   18 │
│                             │ WAITING          37 │
│        NAVOIY MAP           │ CLINICS           4 │
│                             │                   │
│     🟢        🔴            │ AI PRIORITY       │
│          🟠                 │                   │
│                             │ Send Clinic #2    │
│                             │ → Village C       │
├─────────────────────────────┴────────────────────┤
│ LIVE PATIENT / CLINIC ACTIVITY                  │
└──────────────────────────────────────────────────┘
```

---

# 27. Demo Script

### Scene 1 — Problem

> “Navoiydagi chekka hududda bemor bor, ammo kardiolog yo‘q.”

### Scene 2 — Smartphone

`START 60 SECOND SCAN`

Live camera opens.

### Scene 3 — Signals

Pulse waveform appears.

Face/movement/symptom checks complete.

### Scene 4 — Twin

3D Digital Health Twin appears.

### Scene 5 — Warning

> **CARDIOVASCULAR — HIGH PRIORITY**

Heart highlights.

### Scene 6 — Explain

Judge clicks `WHY?`.

Evidence appears.

### Scene 7 — Control Tower

Zoom out:

**one patient → entire Navoiy region.**

Multiple villages appear.

### Scene 8 — AI decision

> **Dispatch Mobile Clinic #2 → Village C**

Animated clinic starts moving.

### Scene 9 — Specialist

Clinical brief automatically generated.

### Scene 10 — Closing

> **“MedTwin doesn't replace the doctor. It helps the right patient reach the right doctor faster.”**

---

# 28. Key Differentiator

MedTwin is **not**:

❌ another medical chatbot
❌ telemedicine video calling app
❌ symptom checker
❌ fake AI diagnosis tool

It is:

### **Smartphone Screening + Digital Twin + AI Triage + Healthcare Control Tower**

That combination is the product.

---

# 29. Success Metrics

Hackathon MVP:

- scan completion < 90 sec;
- Digital Twin generated < 3 sec after scan;
- 100% deterministic reproduction of demo scenarios;
- all AI recommendations traceable to evidence;
- patient priority visible instantly;
- mobile clinic dispatch generated automatically;
- zero fabricated sensor readings when signal is unavailable.

Long-term:

- time-to-triage;
- high-priority referral completion;
- unnecessary referral reduction;
- specialist response time;
- rural screening coverage.

---

# 30. Safety Requirements

MedTwin must prominently state:

> **MedTwin is a screening and clinical decision-support system. It does not replace professional diagnosis or emergency medical care.**

Additionally:

- no unsupported diagnosis;
- uncertain signals → `Unable to determine`;
- distinguish measured vs estimated vs synthetic data;
- AI recommendations require evidence;
- emergency escalation cannot be suppressed by LLM;
- consent before camera/microphone collection;
- encrypt stored/transmitted patient information;
- role-based doctor/admin access;
- audit important decisions.

---

# 31. Future Vision

Eventually:

```text
                MEDTWIN NETWORK

 Smartphone ─┐
 BP Cuff ────┤
 ECG ────────┤
 Wearable ───┼→ Patient Digital Twin
 Lab ────────┤          ↓
 Hospital ───┘      Health AI
                         ↓
               National Health Map
```

Every patient can have a longitudinal Digital Twin.

Every rural clinic becomes an intelligent screening point.

Every specialist receives structured information before consultation.

And health authorities can understand **where care is needed most**, rather than only where hospitals happen to be located.

## Final product statement

> **MedTwin is an AI-powered rural healthcare intelligence network that turns smartphones into accessible screening points, creates patient Digital Health Twins, prioritizes medical risk, and coordinates specialists and mobile clinics across underserved regions.**

For this hackathon, the strongest scope is **one genuinely impressive smartphone scan + one excellent Digital Twin + one deterministic high-risk scenario + the Navoiy Control Tower**. That is much more convincing than attempting ten half-working medical AI features.
