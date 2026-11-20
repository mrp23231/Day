"use client";
import { useI18n } from "@/components/i18n-provider";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CloudOff, LoaderCircle, Mail } from "lucide-react";
import { withNetworkDeadline } from "@/lib/network-deadline";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ButtonSignIn } from "@/components/ui/button-sign-in";
import { useDay } from "@/components/day-provider";
import { recoveryRequested } from "@/lib/state-policy";
import { useAuthRequestScope, useGoogleSignIn } from "./account-entry";

type AuthMode = "login" | "signup" | "reset" | "update";
type AuthFormProps = { initialMethod?: "email"; initialMode?: "login" | "signup" };

export function AuthForm({ initialMethod, initialMode = "signup" }: AuthFormProps = {}) {const { t } = useI18n();
  const { closeModal, notify, user } = useDay();
  const [mode, setMode] = useState<AuthMode>(() => typeof window !== "undefined" && recoveryRequested(location.href, !!user) ? "update" : initialMode);
  const [method, setMethod] = useState<"email" | null>(initialMethod ?? null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const begin = useAuthRequestScope(user?.id ?? "guest");
  const google = useGoogleSignIn();
  const client = getSupabase();

  useEffect(() => {
    if (user && recoveryRequested(location.href, true)) setMode("update");
  }, [user]);

  function changeMode(next: AuthMode) {
    setMode(next);
    setError("");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || pending.current) return;
    const current = begin();
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") || "").trim();
    const password = String(fields.get("password") || "");
    pending.current = true;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await withNetworkDeadline(client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?recovery=1` }));
        if (!current()) return;
        if (error) throw error;
        setMessage(t("Если аккаунт существует, письмо для восстановления отправлено."));
      } else if (mode === "update") {
        const { error } = await withNetworkDeadline(client.auth.updateUser({ password }));
        if (!current()) return;
        if (error) throw error;
        history.replaceState(null, "", "/settings");
        closeModal();
        notify(t("Пароль обновлён"));
      } else if (mode === "signup") {
        const { data, error } = await withNetworkDeadline(client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } }));
        if (!current()) return;
        if (error) throw error;
        if (data.session) {
          closeModal();
          notify(t("Аккаунт создан"));
        } else setMessage(t("Проверьте почту и подтвердите регистрацию."));
      } else {
        const { error } = await withNetworkDeadline(client.auth.signInWithPassword({ email, password }));
        if (!current()) return;
        if (error) throw error;
        closeModal();
        notify(t("Вы вошли в Day"));
      }
    } catch {
      if (current()) setError(t("Не удалось выполнить запрос. Проверьте данные, подключение и настройку сервиса."));
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  }

  if (mode !== "update" && !method) return <div className="form-stack">
    <p className="field-hint">{t("Выберите удобный способ входа или регистрации.")}</p>
    <ButtonSignIn initiallyExpanded onGoogle={google.signIn} onEmail={() => setMethod("email")} googleBusy={google.busy} />
    {google.error && <p className="form-error" role="alert">{google.error}</p>}
    <p className="field-hint">{t("Локальное пространство и записи аккаунта хранятся отдельно.")}</p>
  </div>;

  if (!client) return <div className="form-stack">
    <div className="empty-state compact"><CloudOff size={30} aria-hidden="true" /><h3>{t("Облако пока не подключено")}</h3><p>{t("Day уже работает на этом устройстве. Вход через Google и электронную почту станет доступен после подключения облака.")}</p></div>
    <div className="form-notice">{t("Ваши локальные записи доступны без регистрации. Настройка облака описана в README проекта.")}</div>
    {mode !== "update" && <Button type="button" variant="ghost" onClick={() => setMethod(null)}><ArrowLeft size={14} aria-hidden="true" />{t("К способам входа")}</Button>}
    <Button onClick={closeModal}>{t("Продолжить на устройстве")}</Button>
  </div>;

  return <form className="form-stack" onSubmit={submit} aria-busy={busy}>
    {mode !== "update" && <>
      <button type="button" className="text-button" disabled={busy} onClick={() => { setMethod(null); setError(""); setMessage(""); }}><ArrowLeft size={13} aria-hidden="true" />{t("Другие способы входа")}</button>
      <div className="segmented" role="group" aria-label={t("Режим входа")}>
        {(["login", "signup"] as const).map(option => <button key={option} type="button" disabled={busy} aria-pressed={mode === option} className={mode === option ? "active" : ""} onClick={() => changeMode(option)}>{option === "login" ? t("Вход") : t("Регистрация")}</button>)}
      </div>
    </>}
    {mode === "reset" && <p className="field-hint">{t("Пришлём ссылку для восстановления пароля.")}</p>}
    {mode !== "update" && <label className="field">{t("Электронная почта")}<input type="email" name="email" autoComplete="email" required disabled={busy} placeholder="you@example.com" autoFocus /></label>}
    {mode !== "reset" && <label className="field">{mode === "update" ? t("Новый пароль") : t("Пароль")}<input type="password" name="password" minLength={8} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} required disabled={busy} placeholder={t("Не менее 8 символов")} autoFocus={mode === "update"} /></label>}
    {error && <div className="form-error" role="alert">{error}</div>}
    {message && <div className="form-notice" role="status">{message}</div>}
    <Button disabled={busy} type="submit">{busy ? <LoaderCircle size={14} aria-hidden="true" /> : <Mail size={14} aria-hidden="true" />}{busy ? t("Подождите…") : mode === "login" ? t("Войти") : mode === "signup" ? t("Создать аккаунт") : mode === "reset" ? t("Отправить письмо") : t("Сохранить пароль")}</Button>
    {mode === "login" && <Button type="button" variant="ghost" disabled={busy} onClick={() => changeMode("reset")}>{t("Забыли пароль?")}</Button>}
    {mode === "reset" && <Button type="button" variant="ghost" disabled={busy} onClick={() => changeMode("login")}>{t("Вернуться ко входу")}</Button>}
    <p className="field-hint">{t("Локальное пространство и записи аккаунта хранятся отдельно. Облачную копию можно сохранить в настройках.")}</p>
  </form>;
}
