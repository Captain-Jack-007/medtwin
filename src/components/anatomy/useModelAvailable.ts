"use client";

// useModelAvailable — probes whether the anatomical GLB actually exists before
// we hand it to useGLTF(). This lets a MISSING model demote cleanly to the
// procedural hologram fallback (spec §30–§31) instead of throwing inside the
// R3F tree and flashing a blank card.
//
// States:
//   "checking"     — HEAD request in flight (show premium loading state)
//   "available"    — GLB present → render AnatomicalGLBViewer
//   "unavailable"  — GLB missing/errored → render procedural fallback
import { useEffect, useState } from "react";

export type ModelAvailability = "checking" | "available" | "unavailable";

// Track availability per-url in a module cache so remounts don't re-probe and
// so we can seed initial state as "checking" without a synchronous setState in
// the effect body (react-hooks/set-state-in-effect).
const CACHE = new Map<string, ModelAvailability>();

export function useModelAvailable(url: string): ModelAvailability {
  const [status, setStatus] = useState<ModelAvailability>(
    () => CACHE.get(url) ?? "checking"
  );

  useEffect(() => {
    let cancelled = false;
    // Already resolved for this url — nothing to probe (no setState needed).
    const cached = CACHE.get(url);
    if (cached === "available" || cached === "unavailable") return;

    // HEAD is cheap and avoids downloading the (potentially large) GLB twice;
    // useGLTF will hit the browser cache / same URL right after. All setState
    // happens inside async callbacks, never synchronously in the effect body.
    fetch(url, { method: "HEAD" })
      .then((res) => {
        // A 200 with a non-HTML content-type is a real asset. A dev server may
        // return 200 + text/html for a missing file (SPA fallback), so guard.
        const type = res.headers.get("content-type") || "";
        const ok = res.ok && !type.includes("text/html");
        const result: ModelAvailability = ok ? "available" : "unavailable";
        CACHE.set(url, result);
        if (!cancelled) setStatus(result);
      })
      .catch(() => {
        CACHE.set(url, "unavailable");
        if (!cancelled) setStatus("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return status;
}
