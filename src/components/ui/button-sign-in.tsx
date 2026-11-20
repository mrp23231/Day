"use client";
import { useI18n } from "@/components/i18n-provider";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, LoaderCircle, Mail } from "lucide-react";
import styles from "./button-sign-in.module.css";

type ButtonSignInProps = {
  onGoogle: () => void;
  onEmail: () => void;
  googleBusy?: boolean;
  initiallyExpanded?: boolean;
};

/** A compact account CTA that opens into two real authentication choices. */
export function ButtonSignIn({ onGoogle, onEmail, googleBusy = false, initiallyExpanded = false }: ButtonSignInProps) {const { t } = useI18n();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const optionsId = useId();
  const googleRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (expanded && !initiallyExpanded) googleRef.current?.focus();
  }, [expanded, initiallyExpanded]);

  function expand() {
    setExpanded(true);
  }

  function collapse() {
    if (googleBusy) return;
    setExpanded(false);
    triggerRef.current?.focus();
  }

  return <div className={styles.root} data-expanded={expanded}>
    <div className={styles.stage} onKeyDown={event => {
      if (event.key === "Escape" && expanded && !initiallyExpanded) {
        event.preventDefault();
        event.stopPropagation();
        collapse();
      }
    }}>
      <button ref={triggerRef} type="button" className={styles.trigger} aria-expanded={expanded} aria-controls={optionsId} aria-hidden={expanded} tabIndex={expanded ? -1 : 0} onClick={expand}>{t("Создать аккаунт")}<ArrowUpRight size={16} aria-hidden="true" />
      </button>
      <div id={optionsId} className={styles.options} role="group" aria-label={t("Способ входа")} aria-hidden={!expanded} inert={!expanded}>
        <button ref={googleRef} type="button" tabIndex={expanded ? 0 : -1} className={styles.google} onClick={onGoogle} disabled={googleBusy} aria-busy={googleBusy}>
          {googleBusy ? <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.35 11.1H12v2.9h5.35c-.5 2.4-2.5 3.9-5.35 3.9a6 6 0 1 1 0-12c1.5 0 2.8.55 3.85 1.45l2.1-2.1A9 9 0 1 0 12 21c5.2 0 8.6-3.65 8.6-8.8 0-.4-.05-.8-.1-1.1z" /></svg>}
          {googleBusy ? t("Открываем Google…") : t("Продолжить с Google")}
        </button>
        <button type="button" tabIndex={expanded ? 0 : -1} className={styles.email} onClick={onEmail} disabled={googleBusy}>
          <Mail size={17} aria-hidden="true" />{t("Электронная почта")}</button>
      </div>
    </div>
    {expanded && !initiallyExpanded && <button type="button" className={styles.collapse} disabled={googleBusy} onClick={collapse}>{t("Свернуть")}</button>}
  </div>;
}
