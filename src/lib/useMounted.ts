"use client";
import { useSyncExternalStore } from "react";

// True on the client, false during SSR — without setState-in-effect.
// getServerSnapshot returns false so the SSR/first-client render matches;
// getSnapshot returns true once hydrated.
const emptySubscribe = () => () => {};

export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
