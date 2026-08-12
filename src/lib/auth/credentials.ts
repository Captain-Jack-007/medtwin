import { isValidUsername, normalizeUsername } from "./username";

const INTERNAL_AUTH_DOMAIN = "accounts.medtw-internal.invalid";

/**
 * Supabase email/password is the credential provider, but MedTwin exposes
 * usernames only. The generated address is a non-routable provider key and
 * must never be displayed, accepted, or used for communication.
 */
export function internalAuthEmail(username: string) {
  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) throw new Error("Invalid username");
  return `${normalized}@${INTERNAL_AUTH_DOMAIN}`;
}

export function isValidPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}
