"use client";
import { useI18n } from "@/components/i18n-provider";

import { forwardRef, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, LoaderCircle, Sparkles, X } from "lucide-react";
import styles from "./ai-chat-input.module.css";

export type PromptInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  submitDisabled?: boolean;
  busy?: boolean;
};

/** A controlled text composer. Media and model controls belong here only when supported by the API. */
export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(function PromptInput({
  value, onValueChange, onSubmit, placeholder, disabled = false, submitDisabled = false, busy = false,
}, forwardedRef) {const { t, formatNumber } = useI18n();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const id = useId();
  const expanded = focused || value.length > 0 || busy;
  const blocked = disabled || busy;
  const canSend = !blocked && !submitDisabled && value.trim().length > 0;
  useImperativeHandle(forwardedRef, () => textarea.current!, []);

  useLayoutEffect(() => {
    const node = textarea.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.max(52, Math.min(node.scrollHeight, 192))}px`;
    node.style.overflowY = node.scrollHeight > 192 ? "auto" : "hidden";
  }, [value]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (canSend) onSubmit(value.trim());
  }

  return <form className={styles.composer} data-expanded={expanded} aria-label={t("Новое сообщение")} aria-busy={busy} onSubmit={submit}
    onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <label className="sr-only" htmlFor={id}>{t("Сообщение Day AI")}</label>
    <div className={styles.inputRow}>
      <textarea ref={textarea} id={id} className={styles.textarea} value={value} onChange={event => onValueChange(event.target.value)}
        placeholder={placeholder ?? t("С чего начнём? Напишите Day…")} maxLength={4000} rows={1} disabled={blocked} aria-describedby={`${id}-hint`} onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
            event.preventDefault();
            submit();
          }
          if (event.key === "Escape" && !value) textarea.current?.blur();
        }} />
      <div className={styles.actions}>
        {value && <button type="button" className={styles.clear} aria-label={t("Очистить сообщение")} disabled={blocked} onClick={() => {
          onValueChange("");
          textarea.current?.focus();
        }}><X size={15} aria-hidden="true" /></button>}
        <button type="submit" className={styles.send} disabled={!canSend} aria-label={t("Отправить сообщение")}>
          {busy ? <LoaderCircle size={18} className={styles.spinner} aria-hidden="true" /> : <ArrowUp size={19} aria-hidden="true" />}
        </button>
      </div>
    </div>
    <div className={styles.details}><div className={styles.detailsInner}>
      <span className={styles.mode}><Sparkles size={12} aria-hidden="true" />{t("Текстовый запрос")}</span>
      <span className={styles.count} aria-label={t("{count} из 4000 символов", {count: value.length})}>{formatNumber(value.length)} / {formatNumber(4000)}</span>
      <span id={`${id}-hint`} className={styles.hint}>{t("Enter — отправить · Shift + Enter — новая строка")}</span>
    </div></div>
  </form>;
});
