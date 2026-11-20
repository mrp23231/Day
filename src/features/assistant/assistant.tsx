"use client";
import { useI18n } from "@/components/i18n-provider";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, CalendarDays, Check, Leaf, LogIn, RotateCcw, ShieldCheck, Sparkles, Utensils } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { foodTotals, taskDone, taskOnDate, waterTotal } from "@/lib/domain";
import styles from "./assistant.module.css";

type Message = { id: string; role: "user" | "assistant"; content: string };
type ChatError = { message: string; needsLogin: boolean };
type ChatSession = { account: string; resetVersion: number; initialDraft: string; guestLoginDraft: string | null };
const suggestions = [
  { icon: CalendarDays, title: "Разложить день по полочкам", detail: "Спокойный план без перегруза", prompt: "Помоги составить реалистичный план на день. Сначала задай мне пару вопросов." },
  { icon: Leaf, title: "Начать с маленького шага", detail: "Привычка, которую легко сохранить", prompt: "Помоги выбрать маленький первый шаг для новой привычки и встроить его в мой день." },
  { icon: Utensils, title: "Разобраться в своих записях", detail: "Идеи для дневника питания", prompt: "Как вести дневник питания без лишней сложности и на что обращать внимание в записях?" },
];

export function Assistant() {
  const day = useDay();
  const account = day.user?.id ?? "guest";
  const [session, setSession] = useState<ChatSession>({ account, resetVersion: day.resetVersion, initialDraft: "", guestLoginDraft: null });
  let current = session;
  if (session.account !== account || session.resetVersion !== day.resetVersion) {
    // Only an explicit guest login may carry a draft across the next account boundary.
    // Consume it in this transition; authenticated account switches always start empty.
    current = {
      account, resetVersion: day.resetVersion, guestLoginDraft: null,
      initialDraft: session.account === "guest" && account !== "guest" && session.resetVersion === day.resetVersion ? session.guestLoginDraft ?? "" : "",
    };
    setSession(current);
  }
  return <AssistantSession key={`${account}:${day.resetVersion}`} initialDraft={current.initialDraft} onRequestLogin={draft => {
    if (!day.user) setSession(value => ({ ...value, guestLoginDraft: draft }));
    day.openModal({ type: "auth" });
  }} onDraftChange={() => {
    // Editing after a dismissed login invalidates the previous handoff snapshot.
    if (!day.user) setSession(value => value.guestLoginDraft === null ? value : { ...value, guestLoginDraft: null });
  }} />;
}

function AssistantSession({ initialDraft, onRequestLogin, onDraftChange }: { initialDraft: string; onRequestLogin: (draft: string) => void; onDraftChange: () => void }) {const { t, locale } = useI18n();
  const day = useDay();
  const { data, date, user, ready } = day;
  const accountReady = ready && (!("authReady" in day) || day.authReady === true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState(initialDraft);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    const node = conversation.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, busy]);

  async function send(raw: string) {
    const content = raw.trim();
    if (!content || content.length > 4000 || pending.current || !accountReady || !user) return;
    pending.current = true;
    const request = new AbortController();
    controller.current = request;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content };
    const next = [...messages, userMessage];
    setBusy(true);
    setError(null);
    setMessages(next);
    // Keep the disabled draft until the response succeeds, so a failure never loses it.
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: request.signal,
        body: JSON.stringify({
          locale,
          messages: next.slice(-12).map(({ role, content }) => ({ role, content: role === "assistant" ? content.slice(0, 4000) : content })),
          context: share ? {
            date,
            tasks: data.tasks.filter(task => taskOnDate(task, date)).slice(0, 100).map(task => ({ title: task.title, time: task.time, priority: task.priority, done: taskDone(task, date) })),
            nutrition: foodTotals(data.foods, date), water: waterTotal(data.water, date),
          } : undefined,
        }),
      });
      const result: unknown = await response.json();
      if (!mounted.current || request.signal.aborted) return;
      if (!response.ok) {
        const detail = result && typeof result === "object" && "error" in result && typeof result.error === "string" ? t(result.error) : t("Day AI сейчас недоступен. Попробуйте позже.");
        setError({ message: detail, needsLogin: response.status === 401 });
        setMessages(messages);
        return;
      }
      if (!result || typeof result !== "object" || !("message" in result) || typeof result.message !== "string" || !result.message.trim()) {
        throw new Error(t("Day AI вернул пустой или некорректный ответ. Попробуйте ещё раз."));
      }
      setMessages([...next, { id: crypto.randomUUID(), role: "assistant", content: result.message.trim() }]);
      setText("");
    } catch (cause) {
      if (!mounted.current || request.signal.aborted) return;
      setMessages(messages);
      setError({ message: cause instanceof Error && cause.message.startsWith("Day AI") ? cause.message : t("Не удалось подключиться к Day AI. Проверьте сеть и повторите запрос."), needsLogin: false });
    } finally {
      if (mounted.current && !request.signal.aborted) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  return <section className={styles.page} aria-labelledby="day-ai-heading">
    <div className={styles.topline}><span className={styles.wordmark}>Day AI <span className={styles.beta}>Beta</span></span><span className={styles.topnote}><ShieldCheck size={13} aria-hidden="true" />{t("Вы решаете, чем поделиться")}</span></div>
    <header className={`${styles.welcome} ${messages.length ? styles.compact : ""}`}>
      <div className={styles.monogram} aria-hidden="true"><span>d</span><span className={styles.monogramDot} /><Sparkles size={18} strokeWidth={1.3} /></div>
      <p className={styles.eyebrow}>{t("Больше ясности. Меньше суеты.")}</p>
      <h1 id="day-ai-heading">{t("Давайте начнём")}<br />{t("с вашего дня.")}</h1>
      <p className={styles.intro}>{t("Помогу обдумать планы, найти первый шаг")}<br className={styles.desktopBreak} />{t("и заметить важное в повседневном.")}</p>
    </header>
    <div className={styles.betaNotice}><span className={styles.noticeMark} aria-hidden="true"><Sparkles size={14} /></span><p>{t("Это бета: советы и планы доступны при подключённом AI-сервисе. Ответы могут быть неточными. Создание задач, фото и голос появятся позже.")}</p></div>
    {messages.length === 0 && <div className={styles.suggestions} aria-label={t("Идеи для первого сообщения")}>{suggestions.map(({ icon: Icon, title, detail, prompt }) => <button key={title} type="button" className={styles.suggestion} disabled={busy} onClick={() => { setText(t(prompt)); setError(null); onDraftChange(); textarea.current?.focus(); }}>
      <Icon size={19} strokeWidth={1.4} aria-hidden="true" /><span><strong>{t(title)}</strong><small>{t(detail)}</small></span><ArrowUpRight size={15} strokeWidth={1.5} aria-hidden="true" />
    </button>)}</div>}
    {messages.length > 0 && <div ref={conversation} className={styles.conversation} role="log" aria-label={t("Переписка с Day AI")} aria-live="polite" aria-relevant="additions" aria-busy={busy} tabIndex={0}>
      {messages.map(message => <article className={`${styles.message} ${message.role === "user" ? styles.userMessage : ""}`} key={message.id}>
        <span className={styles.messageLabel}>{message.role === "user" ? t("Вы") : "Day AI"}</span><p>{message.content}</p>
      </article>)}
      {busy && <div className={styles.thinking} role="status"><span className={styles.thinkingDots} aria-hidden="true"><i /><i /><i /></span>{t("Day думает…")}</div>}
    </div>}
    <div className={styles.composeArea}>
      {!user && <div className={styles.accountNotice}><div><strong>{t("Ваш вопрос — хорошее начало")}</strong><p>{t("Для ответа войдите в аккаунт. Day AI работает при подключённом AI-сервисе.")}</p></div><button type="button" className={styles.login} onClick={() => onRequestLogin(text)}><LogIn size={14} aria-hidden="true" />{t("Войти в аккаунт")}</button></div>}
      {!accountReady && <p className={styles.restoring} role="status">{t("Подготавливаем ваше пространство…")}</p>}
      {error && <div className={styles.errorBox} role="alert"><p>{error.message}</p><button type="button" onClick={() => error.needsLogin ? onRequestLogin(text) : void send(text)} disabled={busy || (!error.needsLogin && !text.trim())}>
        {error.needsLogin ? <LogIn size={13} aria-hidden="true" /> : <RotateCcw size={13} aria-hidden="true" />}{error.needsLogin ? t("Войти в аккаунт") : t("Повторить запрос")}
      </button></div>}
      <PromptInput ref={textarea} value={text} onValueChange={value => { setText(value); if (error) setError(null); onDraftChange(); }} onSubmit={send} busy={busy} submitDisabled={!accountReady || !user} />
      <label className={styles.contextChoice}><input type="checkbox" checked={share} disabled={busy} onChange={event => setShare(event.target.checked)} /><span className={styles.checkVisual} aria-hidden="true">{share && <Check size={11} />}</span><span>{t("Добавить мои задачи и итоги питания и воды за выбранный день")}</span></label>
      <p className={styles.privacy}>{t("Сообщения и выбранный контекст отправляются в OpenAI. Day AI предлагает идеи; ваши записи меняете только вы.")}</p>
    </div>
    <div className={styles.footer}><span>{t("Место для ваших мыслей.")}</span><span>DAY / AI BETA</span></div>
  </section>;
}
