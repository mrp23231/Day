"use client";
import { useI18n } from "@/components/i18n-provider";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Compass, Feather, Leaf, ListChecks, Orbit, Sparkles } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { Button } from "@/components/ui/button";
import type { Preferences } from "@/lib/domain";
import styles from "./onboarding.module.css";

const focusOptions = [
  { value: "planning", label: "Планы", description: "Освободить голову и видеть главное", icon: CalendarDays },
  { value: "habits", label: "Привычки", description: "Находить место маленьким шагам", icon: Leaf },
  { value: "balance", label: "Баланс", description: "Оставлять время и для дел, и для себя", icon: Orbit },
] as const;
const paceOptions = [
  { value: "gentle", label: "Мягко", description: "Без спешки, по одному шагу", icon: Feather },
  { value: "structured", label: "По плану", description: "С понятным порядком и ориентирами", icon: ListChecks },
  { value: "flexible", label: "Гибко", description: "Подстраиваться под каждый новый день", icon: Compass },
] as const;
const titles = ["Начнём с вас", "Что сейчас важнее?", "В каком ритме?"];
const descriptions = [
  "Имя или псевдоним — так ваше пространство станет чуть личнее.",
  "Выберите то, с чего хочется начать. Здесь нет правильного ответа.",
  "У каждого свой темп. Выберите тот, который ближе вам сейчас.",
];

export function Onboarding() {const { t } = useI18n();
  const { ready, authReady } = useDay();
  // Mount the draft only after cloud restoration: late data must not be replaced
  // by a questionnaire that captured empty preferences during sign-in.
  if (ready === false || authReady === false) return <p role="status" className="field-hint">{t("Загружаем ваше пространство…")}</p>;
  return <OnboardingContent />;
}

function OnboardingContent() {const { t } = useI18n();
  const { data, user, setPreferences, closeModal, notify } = useDay();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState(data.preferences.name);
  const [focus, setFocus] = useState<Preferences["onboardingFocus"]>(data.preferences.onboardingFocus);
  const [pace, setPace] = useState<Preferences["onboardingPace"]>(data.preferences.onboardingPace);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const composing = useRef(false);
  const id = useId();
  const reduced = useReducedMotion();
  const finished = step === 3;
  const chosenFocus = focusOptions.find(option => option.value === focus)!;
  const chosenPace = paceOptions.find(option => option.value === pace)!;

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);

  function back() {
    setError("");
    setDirection(-1);
    setStep(current => Math.max(0, current - 1));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing.current) return;
    setDirection(1);
    if (step < 2) {
      setStep(current => current + 1);
      return;
    }
    try {
      const trimmedName = name.trim().slice(0, 60);
      setPreferences({ name: trimmedName, onboardingFocus: focus, onboardingPace: pace, onboardingDone: true, ...(user ? { accountOnboardingDone: true } : {}) });
      setName(trimmedName);
      setError("");
      setStep(3);
    } catch {
      const message = t("Не удалось сохранить настройки. Попробуйте ещё раз.");
      setError(message);
      notify(message, { kind: "error" });
    }
  }

  return <div className={styles.onboarding}>
    <div className={styles.topline}>
      <span className={styles.wordmark}>Day<span>.</span></span>
      <span className={styles.stepCount}>{finished ? t("Ваше пространство") : `${String(step + 1).padStart(2, "0")} / 03`}</span>
    </div>
    {!finished && <ol className={styles.progress} aria-label={t("Знакомство с Day")}>
      {[t("Обращение"), t("Ваш фокус"), t("Ваш ритм")].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={index <= step ? styles.progressActive : ""}><span className="sr-only">{t(label)}{index < step ? t(", пройдено") : ""}</span></li>)}
    </ol>}
    <motion.section key={step} className={`${styles.stage} ${finished ? styles.welcome : ""}`} aria-labelledby={`${id}-heading`} initial={reduced ? false : { opacity: 0, x: direction * 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduced ? 0 : .24, ease: [.22, .68, 0, 1] }}>
      {finished ? <>
        <div className={styles.welcomeArt} aria-hidden="true">
          <span className={styles.orbitOuter} />
          <span className={styles.orbitInner} />
          <motion.span className={styles.welcomeMark} initial={reduced ? false : { scale: .88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: reduced ? 0 : .35, delay: reduced ? 0 : .08 }}><Sparkles size={31} strokeWidth={1.25} /></motion.span>
          <span className={styles.welcomeDot} />
          <span className={styles.welcomeCross}>+</span>
        </div>
        <p className={styles.eyebrow}>{t("Новый день. Ваше начало.")}</p>
        <h3 ref={heading} tabIndex={-1} id={`${id}-heading`} className={styles.title}>{name ? t("Добро пожаловать, {name}", {name}) : t("Добро пожаловать в Day")}</h3>
        <p className={styles.description}>{t("Место для важных дел, маленьких привычек и времени для себя. Начните с того, что важно сегодня.")}</p>
        <div className={styles.receipt} aria-label={t("Ваши предпочтения")}><span><chosenFocus.icon size={13} />{t(chosenFocus.label)}</span><span><chosenPace.icon size={13} />{t(chosenPace.label)}</span></div>
        <Button className={styles.primary} onClick={() => { closeModal(); router.push("/"); }}>{t("Перейти к моему дню")}<ArrowRight size={15} /></Button>
        <p className={styles.footnote}>{t("Это только начало. Дальше — в вашем темпе.")}</p>
      </> : <form onSubmit={submit} className={styles.form} onKeyDown={event => { if (event.key === "Enter" && (event.nativeEvent.isComposing || composing.current)) event.preventDefault(); }}>
        <header className={styles.heading}>
          <p className={styles.eyebrow}>{t("Давайте познакомимся")}</p>
          <h3 ref={heading} tabIndex={-1} id={`${id}-heading`} className={styles.title}>{t(titles[step])}</h3>
          <p className={styles.description}>{t(descriptions[step])}</p>
        </header>
        {step === 0 ? <div className={styles.nameSection}>
          <div className={styles.nameArt} aria-hidden="true"><span>{name.trim() ? name.trim().slice(0, 1).toUpperCase() : t("Я")}</span><i><Sparkles size={14} strokeWidth={1.5} /></i></div>
          <label htmlFor={`${id}-name`} className={styles.label}>{t("Как к вам обращаться?")}</label>
          <input id={`${id}-name`} name="name" maxLength={60} autoComplete="nickname" aria-describedby={`${id}-name-hint`} value={name} onChange={event => setName(event.target.value.slice(0, 60))} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} placeholder={t("Имя или псевдоним")} className={styles.nameInput} />
          <p id={`${id}-name-hint`} className={styles.hint}>{t("Необязательно. Можно оставить пустым.")}</p>
        </div> : <fieldset className={styles.choices}>
          <legend className="sr-only">{t(titles[step])}</legend>
          {step === 1 ? focusOptions.map(option => <label key={option.value} className={`${styles.option} ${focus === option.value ? styles.selected : ""}`}>
            <input type="radio" name="onboarding-focus" value={option.value} checked={focus === option.value} onChange={() => setFocus(option.value)} />
            <span className={styles.optionIcon} aria-hidden="true"><option.icon size={20} strokeWidth={1.4} /></span>
            <span className={styles.optionText}><strong>{t(option.label)}</strong><small>{t(option.description)}</small></span>
            <span className={styles.optionCheck} aria-hidden="true">{focus === option.value && <Check size={11} strokeWidth={2} />}</span>
          </label>) : paceOptions.map(option => <label key={option.value} className={`${styles.option} ${pace === option.value ? styles.selected : ""}`}>
            <input type="radio" name="onboarding-pace" value={option.value} checked={pace === option.value} onChange={() => setPace(option.value)} />
            <span className={styles.optionIcon} aria-hidden="true"><option.icon size={20} strokeWidth={1.4} /></span>
            <span className={styles.optionText}><strong>{t(option.label)}</strong><small>{t(option.description)}</small></span>
            <span className={styles.optionCheck} aria-hidden="true">{pace === option.value && <Check size={11} strokeWidth={2} />}</span>
          </label>)}
        </fieldset>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          {step > 0 && <Button type="button" variant="ghost" className={styles.back} onClick={back}><ArrowLeft size={14} />{t("Назад")}</Button>}
          <Button type="submit" className={styles.primary}>{step === 2 ? t("Сохранить и продолжить") : t("Продолжить")}<ArrowRight size={15} /></Button>
        </div>
        <div className={styles.footer}><span>{t("Всё можно изменить позже.")}</span><button type="button" onClick={closeModal}>{t("Продолжить позже")}</button></div>
      </form>}
    </motion.section>
  </div>;
}
