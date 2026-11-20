"use client";
import { useI18n } from "@/components/i18n-provider";

import { useEffect, useRef, useState } from "react";
import { useDay } from "@/components/day-provider";
import { ButtonSignIn } from "@/components/ui/button-sign-in";
import { withNetworkDeadline } from "@/lib/network-deadline";
import { getSupabase } from "@/lib/supabase/client";

/** Ignore requests completed after dismissal or an account scope change. */
export function useAuthRequestScope(scope: string) {
  const state = useRef({ generation: 0, mounted: true });
  useEffect(() => {
    const lifecycle = state.current;
    lifecycle.mounted = true;
    return () => { lifecycle.mounted = false; lifecycle.generation++; };
  }, [scope]);
  return () => {
    const started = ++state.current.generation;
    return () => state.current.mounted && state.current.generation === started;
  };
}

export function useGoogleSignIn() {const { t } = useI18n();
  const { user } = useDay();
  const begin = useAuthRequestScope(user?.id ?? "guest");
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    if (pending.current) return;
    setError("");
    const client = getSupabase();
    if (!client) {
      setError(t("Вход через Google пока не подключён. Вы можете продолжить пользоваться Day на этом устройстве."));
      return;
    }
    const current = begin();
    pending.current = true;
    setBusy(true);
    try {
      const { data, error } = await withNetworkDeadline(client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${location.origin}/auth/callback`, skipBrowserRedirect: true },
      }));
      if (!current()) return;
      if (error || !data.url) throw error ?? new Error("Missing OAuth URL");
      location.assign(data.url);
    } catch {
      if (current()) setError(t("Не удалось открыть вход через Google. Попробуйте ещё раз или выберите электронную почту."));
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  }

  return { signIn, busy, error };
}

export function AccountEntry() {const { t } = useI18n();
  const { openModal } = useDay();
  const google = useGoogleSignIn();
  return <div className="form-stack">
    <ButtonSignIn onGoogle={google.signIn} onEmail={() => openModal({ type: "auth", method: "email", mode: "signup" })} googleBusy={google.busy} />
    {google.error && <p className="form-error" role="alert">{google.error}</p>}
    <button type="button" className="text-button" disabled={google.busy} onClick={() => openModal({ type: "auth", method: "email", mode: "login" })}>{t("Уже есть аккаунт? Войти")}</button>
  </div>;
}
