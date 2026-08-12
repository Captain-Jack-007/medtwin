This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Visualization & map data

MedTwin uses two visualization stacks:

- **3D Digital Twin** — [Three.js](https://threejs.org) via
  [`@react-three/fiber`](https://github.com/pmndrs/react-three-fiber) and
  [`@react-three/drei`](https://github.com/pmndrs/drei), with a graceful
  fallback to a 2D SVG figure when WebGL is unavailable.
- **Control Tower map** — [Leaflet](https://leafletjs.com) via
  [`react-leaflet`](https://react-leaflet.js.org), rendering the real Navoiy
  region on **© OpenStreetMap contributors** raster tiles. The OSM attribution
  is shown in the map and must remain visible. If tiles fail to load, the map
  falls back to a synthetic SVG control map.

**Geography is real; Control Tower population data is synthetic demo data.** It
is explicitly isolated from the personal `/scan` workflow. Coordinate sources,
the internal-id / presentation-layer split, and the demo-data boundary are
documented in [`docs/GEOGRAPHY.md`](docs/GEOGRAPHY.md).

## Real-device screening

The normal `/scan` route uses browser device APIs and local computation:

- front-camera MediaPipe face and pose landmarks for face quality, an
  experimental facial-symmetry screening signal, and respiration estimation;
- rear-camera pixel sampling for a real PPG trace and quality-gated heart-rate
  estimate;
- pose landmarks for the five-second bilateral arm task;
- Web Audio API samples for live speech-task waveform and voice activity.

No camera-derived blood pressure or phone-camera SpO₂ is produced. Those fields
remain `NOT MEASURED` or `EXTERNAL DEVICE REQUIRED`. Missing values stay unknown
in triage. Raw camera frames and microphone audio are not persisted. In demo
mode, only the derived result and provenance are stored in `sessionStorage` for
the current browser tab.

## Supabase production data mode

Production mode persists a completed screening result only after a signed-in
patient submits it. The server validates the payload, reruns deterministic
triage, stores the record through a server-only Supabase service-role client,
and writes an audit event. The browser never receives the service-role key.

The database schema and row-level security policies are in
[`supabase/migrations/20260812_medtwins_production_foundation.sql`](supabase/migrations/20260812_medtwins_production_foundation.sql).

### Enable it

1. Create the Supabase project and confirm its region, data residency,
   retention, and legal basis are appropriate for Uzbekistan operations before
   accepting patient data.
2. Copy `.env.example` to `.env.local` and set the Supabase URL, anonymous
   key, service-role key, and Anthropic server key. Never commit `.env.local`.
3. Apply the migrations. Add `SUPABASE_DB_URL` to `.env.local` (Supabase →
   Project Settings → Database → Connection string → URI), then run:

   ```bash
   npm run db:status   # lists migrations and whether each is applied
   npm run db:push     # applies pending migrations in filename order
   ```

   Migrations are tracked in a `public.schema_migrations` table, so `db:push`
   is idempotent and safe to re-run. Alternatively, paste each file in
   `supabase/migrations/` into the Supabase SQL editor in filename order.
4. Configure Supabase Auth email confirmation, allowed redirect URLs, and the
   production HTTPS domain.
5. Enable production mode only after steps 1–4 are live. The preflight verifies
   required env vars and confirms the schema is present before flipping the two
   flags in `.env.local`:

   ```bash
   npm run prod:preflight   # report readiness (no changes)
   npm run prod:enable      # flip both flags to true when all checks pass
   ```

   Restart the server after enabling. This sets `MEDTWIN_PRODUCTION_MODE=true`
   and `NEXT_PUBLIC_MEDTWIN_PRODUCTION_MODE=true`.
6. Assign `clinician` and `admin` roles only through trusted server-side
   Supabase Auth app metadata. A browser user must never be allowed to assign
   their own role.

In production mode:

- a patient can read only their own screening record;
- a clinician can read only records explicitly granted to them (admins may
  inspect records through the controlled API);
- access and sharing actions are recorded in `audit_events`;
- results are re-derived by the deterministic screening rules on the server;
- the existing demo scenarios remain available only when production data mode
  is off.

### Clinical safety boundary

The current camera, PPG, pose, and microphone tasks are screening inputs; they
are not clinically validated diagnostic devices. MedTwin must not be presented
as making a diagnosis, prescribing medication, or guaranteeing an outcome.
Production clinical use additionally requires validated data sources, clinical
validation, clinician oversight, incident response, privacy governance, and
applicable regulatory approval. Until those controls are in place, use this as
screening and decision-support software only.

### Claude / MedTwin Intelligence

Set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` only on the server. MedTwin AI
receives structured screening or simulation context and explains it; it must
not create measurements, diagnoses, treatment changes, or scores. If the AI
service is unavailable, deterministic screening results continue to work.

The scan-time Patient Assistant also uses these Claude settings automatically.
Its output must pass the existing structured-response and safety validation;
deterministic scan guidance and safety boundaries remain available if Claude is
unavailable.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

`npm run dev` automatically stops an existing Next development server that is
already running from this MedTwin workspace, then starts a clean server on port
3000. It deliberately leaves unrelated applications using port 3000 alone.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# medtwin
