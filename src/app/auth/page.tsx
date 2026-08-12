"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { useLanguage } from "@/lib/i18n";
import { isValidUsername, normalizeUsername } from "@/lib/auth/username";

export default function AuthPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    const normalizedUsername = normalizeUsername(username);
    if (!isValidUsername(normalizedUsername)) { setMessage(t("auth.usernameInvalid")); return; }
    if (mode === "signUp" && password !== confirmPassword) { setMessage(t("auth.passwordMismatch")); return; }
    setLoading(true); setMessage(null);
    try {
      if (mode === "signIn") {
        const response = await fetch("/api/auth/sign-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: normalizedUsername, password }) });
        if (!response.ok) { setMessage(t("auth.failed")); return; }
        setMessage(t("auth.signedIn"));
        router.replace(getReturnPath());
        router.refresh();
        return;
      }
      const result = await fetch("/api/auth/sign-up", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: normalizedUsername, password }) });
      if (!result.ok) { setMessage(t("auth.signUpFailed")); return; }
      setMessage(t("auth.accountCreated"));
      router.replace(getReturnPath());
      router.refresh();
    } catch {
      setMessage(t("auth.failed"));
    } finally {
      setLoading(false);
    }
  };
  const canSubmit = mode === "signIn" ? Boolean(username && password.length >= 8) : Boolean(username && password.length >= 8 && confirmPassword.length >= 8);
  return <><TopBar /><main className="mx-auto w-full max-w-md px-5 py-16"><Link href="/" className="text-sm text-[var(--accent)]">← {t("auth.back")}</Link><section className="panel mt-5 p-6"><p className="tick">{t("auth.eyebrow")}</p><h1 className="mt-2 text-2xl font-semibold">{mode === "signIn" ? t("auth.title") : t("auth.createTitle")}</h1><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{t("auth.description")}</p><div className="mt-6 grid grid-cols-2 border border-[var(--border)] p-1"><button type="button" onClick={() => { setMode("signIn"); setMessage(null); }} aria-pressed={mode === "signIn"} className={`min-h-9 text-xs font-semibold transition-colors ${mode === "signIn" ? "bg-[var(--accent)]/12 text-[var(--accent)]" : "text-[var(--muted)]"}`}>{t("auth.signIn")}</button><button type="button" onClick={() => { setMode("signUp"); setMessage(null); }} aria-pressed={mode === "signUp"} className={`min-h-9 text-xs font-semibold transition-colors ${mode === "signUp" ? "bg-[var(--accent)]/12 text-[var(--accent)]" : "text-[var(--muted)]"}`}>{t("auth.createAccount")}</button></div><form onSubmit={(event) => { event.preventDefault(); void submit(); }}><label className="mt-5 block text-sm font-medium">{t("auth.username")}<input type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={30} placeholder={t("auth.usernamePlaceholder")} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]" /></label><label className="mt-4 block text-sm font-medium">{t("auth.password")}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signIn" ? "current-password" : "new-password"} minLength={8} maxLength={128} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 outline-none focus:border-[var(--accent)]" /></label>{mode === "signUp" && <label className="mt-4 block text-sm font-medium">{t("auth.confirmPassword")}<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 outline-none focus:border-[var(--accent)]" /></label>}<button type="submit" disabled={loading || !canSubmit} className="sensor-primary-button mt-6 w-full">{loading ? t("auth.working") : mode === "signIn" ? t("auth.signIn") : t("auth.createAccount")}</button></form>{message && <p role="status" className="mt-4 text-sm text-[var(--muted)]">{message}</p>}</section></main></>;
}

function getReturnPath() {
  if (typeof window === "undefined") return "/scan";
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/scan";
}
