"use client";

// requestAnimationFrame-driven position along a simulated straight-line route
// from a clinic origin to a destination location. Returns null when there is no
// active dispatch. Loops so the clinic keeps "travelling" while en route.
import { useEffect, useRef, useState } from "react";

interface Point {
  latitude: number;
  longitude: number;
}

const TRIP_MS = 4200;

export function useDispatchAnimation(
  origin?: Point,
  dest?: Point
): [number, number] | null {
  const [pos, setPos] = useState<[number, number] | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const active = !!origin && !!dest;

  useEffect(() => {
    if (!origin || !dest) return;
    startRef.current = null;

    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = (t - startRef.current) % TRIP_MS;
      const f = elapsed / TRIP_MS;
      // ease-in-out for a smoother travel feel
      const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      setPos([
        origin.latitude + (dest.latitude - origin.latitude) * e,
        origin.longitude + (dest.longitude - origin.longitude) * e,
      ]);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [origin, dest]);

  // Derive null when inactive rather than setState-ing inside the effect.
  return active ? pos : null;
}
