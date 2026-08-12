"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { APP_LANGUAGES, type AppLanguage, useLanguage } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function TopBar({
  live = false,
  right,
}: {
  live?: boolean;
  right?: React.ReactNode;
}) {
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setAuthenticated(Boolean(data.user));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAuthenticated(Boolean(session?.user));
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || signingOut) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setAuthenticated(false);
      router.replace("/auth");
      router.refresh();
    }
    setSigningOut(false);
  };

  return (
    <header className="sticky top-0 z-[2000] border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 px-4 py-3 sm:px-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-[13px] font-bold text-black">
            M
          </span>
          <span className="text-sm font-semibold tracking-wide">
            MED<span className="text-[var(--accent)]">TWIN</span>
          </span>
        </Link>
        <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="mobile-navigation" className="grid min-h-11 min-w-11 place-items-center rounded-md border border-[var(--border)] text-sm font-semibold text-[var(--muted)] sm:hidden">
          <span className="sr-only">{t("nav.menu")}</span>
          <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
        </button>
        <nav className="hidden items-center gap-4 text-sm text-[var(--muted)] sm:flex">
          <Link href="/scan" className="hover:text-[var(--text)]">
            {t("nav.scan")}
          </Link>
          <Link href="/control" className="hover:text-[var(--text)]">
            {t("nav.control")}
          </Link>
          {live && (
            <span className="flex items-center gap-1.5 text-[var(--text)]">
              <span className="live-dot h-2 w-2 rounded-full bg-[var(--green)]" />
              <span className="tick !text-[var(--text)]">{t("nav.live")}</span>
            </span>
          )}
          <label>
            <span className="sr-only">{t("language.label")}</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as AppLanguage)}
              aria-label={t("language.label")}
              className="rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-2 py-1 text-xs text-[var(--text)]"
            >
              {APP_LANGUAGES.map((item) => (
                <option key={item} value={item}>{t(`language.${item}`)}</option>
              ))}
            </select>
          </label>
          {authenticated && (
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)] transition-colors hover:border-[var(--muted)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {signingOut ? t("auth.signingOut") : t("auth.signOut")}
            </button>
          )}
          {right}
        </nav>
        <nav id="mobile-navigation" aria-label={t("nav.menu")} className={`${menuOpen ? "flex" : "hidden"} w-full flex-col gap-1 border-t border-[var(--border)] pt-3 text-sm text-[var(--muted)] sm:hidden`}>
          <Link href="/scan" onClick={() => setMenuOpen(false)} className="min-h-11 rounded-md px-3 py-2.5 hover:bg-[var(--bg-elev)] hover:text-[var(--text)]">{t("nav.scan")}</Link>
          <Link href="/control" onClick={() => setMenuOpen(false)} className="min-h-11 rounded-md px-3 py-2.5 hover:bg-[var(--bg-elev)] hover:text-[var(--text)]">{t("nav.control")}</Link>
          <label className="flex min-h-11 items-center justify-between gap-3 px-3 py-2"><span>{t("language.label")}</span><select value={language} onChange={(event) => setLanguage(event.target.value as AppLanguage)} className="min-h-10 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-2 text-sm text-[var(--text)]">{APP_LANGUAGES.map((item) => <option key={item} value={item}>{t(`language.${item}`)}</option>)}</select></label>
          {authenticated && <button type="button" onClick={() => void signOut()} disabled={signingOut} className="min-h-11 rounded-md px-3 py-2.5 text-left font-semibold text-[var(--muted)] hover:bg-[var(--bg-elev)] hover:text-[var(--text)] disabled:opacity-50">{signingOut ? t("auth.signingOut") : t("auth.signOut")}</button>}
          {right}
        </nav>
      </div>
    </header>
  );
}
