"use client";

import { useI18n } from "@/components/i18n-provider";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { CheckIcon, FingerprintIcon, LoaderCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import "./motion-hold-to-confirm.css";

export type HoldToConfirmProps = {
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  confirmedLabel?: string;
  durationMs?: number;
  className?: string;
};

type HoldSource = { type: "pointer"; pointerId: number } | { type: "keyboard"; key: string };

export function HoldToConfirm({ onConfirm, disabled = false, label = "Удерживайте, чтобы завершить день", confirmedLabel = "День завершён", durationMs = 2000, className }: HoldToConfirmProps) {
  const {t,formatNumber}=useI18n();
  const [state, setState] = useState<"idle" | "holding" | "pending" | "confirmed" | "error">("idle");
  const progress = useMotionValue(0);
  const scale = useTransform(progress, [0, 1], [1, .97]);
  const ringStrokeWidth = useTransform(progress, [0, 1], [2, 5]);
  const ringOpacity = useTransform(progress, [0, .05, 1], [0, 1, 1]);
  const reducedMotion = useReducedMotion();
  const hintId = useId();
  const activeRef = useRef<HoldSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const mountedRef = useRef(false);
  const lockedRef = useRef(false);
  const onConfirmRef = useRef(onConfirm);
  const disabledRef = useRef(disabled);

  const cancel = useCallback(() => {
    const wasHolding = activeRef.current !== null;
    activeRef.current = null;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    animationRef.current?.stop();
    if (wasHolding) progress.set(0);
    if (mountedRef.current) setState(current => current === "holding" ? "idle" : current);
  }, [progress]);

  useLayoutEffect(() => {
    onConfirmRef.current = onConfirm;
    disabledRef.current = disabled;
    if (disabled) cancel();
  }, [onConfirm, disabled, cancel]);

  useEffect(() => {
    mountedRef.current = true;
    const onHidden = () => { if (document.hidden) cancel(); };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      mountedRef.current = false;
      cancel();
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [cancel]);

  function begin(source: HoldSource) {
    if (disabledRef.current || lockedRef.current || activeRef.current || document.hidden) return;
    activeRef.current = source;
    setState("holding");
    const duration = Math.max(1, Number.isFinite(durationMs) ? durationMs : 2000);
    const deadline = performance.now() + duration;
    progress.set(0);
    animationRef.current = animate(progress, 1, { duration: duration / 1000, ease: "linear" });

    // Confirmation has its own monotonic deadline; visual frames never commit data.
    const finish = () => {
      if (!mountedRef.current || !activeRef.current || disabledRef.current || lockedRef.current || document.hidden) { cancel(); return; }
      const remaining = deadline - performance.now();
      if (remaining > 0) { timerRef.current = setTimeout(finish, remaining); return; }
      timerRef.current = null;
      activeRef.current = null;
      lockedRef.current = true;
      animationRef.current?.stop();
      progress.set(1);
      setState("pending");
      void (async () => {
        try {
          await onConfirmRef.current();
          if (mountedRef.current) setState("confirmed");
        } catch {
          if (mountedRef.current) {
            lockedRef.current = false;
            progress.set(0);
            setState("error");
          }
        }
      })();
    };
    timerRef.current = setTimeout(finish, duration);
  }

  const confirmed = state === "confirmed";
  const pending = state === "pending";
  const durationSeconds = formatNumber(Math.max(1, Number.isFinite(durationMs) ? durationMs : 2000) / 1000);
  const hint = state === "error" ? t("Не удалось сохранить. Попробуйте ещё раз.") : confirmed ? t("Ваш день сохранён") : pending ? t("Сохраняем день…") : t("Удерживайте {seconds} с. Можно зажать пробел или Enter.",{seconds:durationSeconds});

  return <div className={cn("day-hold", className)} data-state={state}>
    <div className="day-hold__frame">
      <motion.button type="button" className="day-hold__button" style={{ scale: reducedMotion || pending || confirmed ? 1 : scale }}
        disabled={disabled || pending || confirmed} aria-describedby={hintId} aria-busy={pending}
        onPointerDown={event => {
          if (event.button !== 0 || event.isPrimary === false) return;
          event.preventDefault();
          event.currentTarget.focus();
          begin({ type: "pointer", pointerId: event.pointerId });
          if (activeRef.current?.type === "pointer") event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerUp={event => { if (activeRef.current?.type === "pointer" && activeRef.current.pointerId === event.pointerId) cancel(); }}
        onPointerMove={event => {
          if (activeRef.current?.type !== "pointer" || activeRef.current.pointerId !== event.pointerId) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) cancel();
        }}
        onPointerLeave={cancel} onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel}
        onKeyDown={event => {
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          if (!event.repeat) begin({ type: "keyboard", key: event.key });
        }}
        onKeyUp={event => {
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          if (activeRef.current?.type === "keyboard" && activeRef.current.key === event.key) cancel();
        }}
        onClick={event => event.preventDefault()} onContextMenu={event => event.preventDefault()}>
        <motion.span className="day-hold__fill" style={{ scaleX: progress }} aria-hidden="true" />
        <span className="day-hold__content">
          {confirmed ? <CheckIcon size={20} aria-hidden="true" /> : pending ? <LoaderCircleIcon size={20} className="day-hold__spinner" aria-hidden="true" /> : <FingerprintIcon size={22} aria-hidden="true" />}
          <span>{t(confirmed ? confirmedLabel : pending ? "Сохраняем…" : label)}</span>
        </span>
      </motion.button>
      <svg className="day-hold__ring" viewBox="0 0 320 320" aria-hidden="true">
        <circle cx="160" cy="160" r="120" className="day-hold__ring-track" />
        <motion.circle cx="160" cy="160" r="120" style={{ pathLength: progress, strokeWidth: ringStrokeWidth, opacity: ringOpacity }} className="day-hold__ring-progress" />
      </svg>
    </div>
    <p id={hintId} className="day-hold__hint" aria-live="polite">{hint}</p>
  </div>;
}

export default HoldToConfirm;
