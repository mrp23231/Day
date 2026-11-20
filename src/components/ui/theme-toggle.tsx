"use client";

// Theme toggle from 000h by Cojeev — MIT licence.
// Adapted sun/moon morph and organic reveal: https://cojeev.com/ui/docs/theme-toggle/
import { useI18n } from "@/components/i18n-provider";
import type { ReactNode } from "react";
import { animate, type AnimationPlaybackControls } from "motion";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";
import "./theme-toggle.css";

export type ThemeMode = "light" | "dark";
export type ThemeRevealOrigin = { x: number; y: number };
export type ThemeChangeDetails = { origin: ThemeRevealOrigin };
export type ThemeRevealOptions = { origin?: ThemeRevealOrigin };
export type ThemeToggleProps = Omit<ButtonProps, "onChange" | "asChild" | "children"> & {
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode, details?: ThemeChangeDetails) => void;
  showLabel?: boolean;
  label?: ReactNode;
  responsive?: boolean;
};

const sun = "M12 5C15.866 5 19 8.134 19 12C19 15.866 15.866 19 12 19C8.134 19 5 15.866 5 12C5 8.134 8.134 5 12 5Z";
const moon = "M18.9 15.2C17.2 19.3 12.9 21.2 8.8 19.4C4.7 17.6 2.7 13 4.4 8.8C5.4 6.2 7.7 4.3 10.4 3.8C8.1 10.4 12.3 16.8 18.9 15.2Z";
let previousZone = -1;
let pendingActivation: { origin: ThemeRevealOrigin; element: HTMLElement; time: number } | undefined;

/** Choose corners, edges and centre without repeating the previous region. */
function variedThemeOrigin(width: number, height: number): ThemeRevealOrigin {
  const zones = [[.07, .07], [.93, .07], [.93, .93], [.07, .93], [.06, .5], [.94, .5], [.5, .06], [.5, .94], [.5, .5]];
  let zone = Math.floor(Math.random() * (previousZone >= 0 ? 8 : 9));
  if (previousZone >= 0 && zone >= previousZone) zone++;
  previousZone = zone;
  const [x, y] = zones[zone];
  const jitter = () => (Math.random() - .5) * .07;
  return { x: Math.max(12, Math.min(width - 12, width * (x + jitter()))), y: Math.max(12, Math.min(height - 12, height * (y + jitter()))) };
}

function viewport(doc: Document) {
  return { width: doc.documentElement.clientWidth || doc.defaultView?.innerWidth || 1, height: doc.documentElement.clientHeight || doc.defaultView?.innerHeight || 1 };
}

function rememberThemeOrigin(element: HTMLElement): ThemeChangeDetails {
  const { width, height } = viewport(element.ownerDocument);
  const origin = variedThemeOrigin(width, height);
  pendingActivation = { origin, element, time: performance.now() };
  return { origin };
}

/** Controlled switch: the application owns persistence and the theme scope. */
export function ThemeToggle({ mode, onModeChange, showLabel = true, label, responsive = false, className, onClick, ...props }: ThemeToggleProps) {
  const {t}=useI18n();
  const quiet = useReducedMotion();
  const dark = mode === "dark";
  const transition = quiet ? { duration: 0 } : { type: "spring" as const, stiffness: 360, damping: 32, mass: .85 };
  return <Button variant="ghost" size="sm" type="button" aria-label={t("Тёмная тема")} title={t(dark?"Включить светлую тему":"Включить тёмную тему")}
    {...props} role="switch" aria-checked={dark} data-slot="theme-toggle" data-label={showLabel ? "visible" : "hidden"} data-responsive={responsive}
    className={cn("day-theme-toggle", className)} onClick={event => {
      onClick?.(event);
      if (!event.defaultPrevented) onModeChange(dark ? "light" : "dark", rememberThemeOrigin(event.currentTarget));
    }}>
    <svg data-slot="theme-toggle-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true" focusable="false">
      <motion.g initial={false} animate={{ rotate: dark ? 45 : 0 }} transition={transition} style={{ transformOrigin: "12px 12px" }}>
        {Array.from({ length: 8 }, (_, index) => <motion.path key={index} d="M12 1.5V3" transform={`rotate(${index * 45} 12 12)`}
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" initial={false} animate={{ pathLength: dark ? 0 : 1, opacity: dark ? 0 : 1 }}
          transition={{ duration: quiet ? 0 : .2, delay: quiet ? 0 : index * .015 }} />)}
      </motion.g>
      <motion.path initial={false} d={dark ? moon : sun} animate={{ d: dark ? moon : sun, rotate: dark ? -12 : 0 }} transition={transition}
        fill="currentColor" style={{ transformOrigin: "12px 12px" }} />
    </svg>
    {showLabel && <span className="day-theme-toggle__label">{label ?? t(dark ? "Тёмная" : "Светлая")}</span>}
  </Button>;
}

/** Twelve smooth lobed segments, in viewport pixels, expanding beyond every corner. */
function themeRevealPath(progress: number, origin: ThemeRevealOrigin, width: number, height: number, phase: number) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const x = Math.max(0, Math.min(width, Number.isFinite(origin.x) ? origin.x : width / 2));
  const y = Math.max(0, Math.min(height, Number.isFinite(origin.y) ? origin.y : height / 2));
  const reach = Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) / .72;
  const points = Array.from({ length: 12 }, (_, index) => {
    const angle = index * Math.PI / 6;
    const radius = reach * p * (1 + .12 * Math.sin(angle * 3 + p * .65 + phase) + .065 * Math.cos(angle * 5 - p * .35 - phase * .7));
    return { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius };
  });
  const f = (n: number) => Number(n.toFixed(2));
  let path = `M${f(points[0].x)} ${f(points[0].y)}`;
  for (let index = 0; index < points.length; index++) {
    const before = points[(index + 11) % 12], start = points[index], end = points[(index + 1) % 12], after = points[(index + 2) % 12];
    path += `C${f(start.x + (end.x - before.x) / 6)} ${f(start.y + (end.y - before.y) / 6)} ${f(end.x - (after.x - start.x) / 6)} ${f(end.y - (after.y - start.y) / 6)} ${f(end.x)} ${f(end.y)}`;
  }
  return path + "Z";
}

const revealStyles = ["--day-theme-clip", "--day-theme-glyph", "--day-theme-glyph-position", "--day-theme-glyph-size", "--day-theme-glyph-mask"];
const revealAttributes = ["data-theme-reveal", "data-theme-progress", "data-theme-origin"];
type ActiveReveal = { scope: HTMLElement; mode: ThemeMode; promise: Promise<void>; finish: () => void };
const activeReveals = new WeakMap<Document, ActiveReveal>();

/** Keep the activated glyph live in WebKit, which can freeze captured SVG paths. */
function createGlyphPainter(canvas: HTMLElement, toggle: HTMLElement | undefined, width: number, height: number) {
  const glyph = toggle?.querySelector<SVGSVGElement>("[data-slot='theme-toggle-icon']");
  const box = glyph?.getBoundingClientRect();
  if (!glyph || !box || !box.width || !box.height || !toggle) return () => {};
  const win = canvas.ownerDocument.defaultView!;
  const ratio = win.devicePixelRatio || 1;
  const x = Math.floor(box.x * ratio) / ratio, y = Math.floor(box.y * ratio) / ratio;
  const right = Math.ceil(box.right * ratio) / ratio, bottom = Math.ceil(box.bottom * ratio) / ratio;
  const image = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  canvas.style.setProperty("--day-theme-glyph-position", `${x}px ${y}px`);
  canvas.style.setProperty("--day-theme-glyph-size", `${right - x}px ${bottom - y}px`);
  return () => {
    const paint = win.getComputedStyle(toggle).backgroundColor;
    const alpha = paint.match(/(?:rgba\([^,]+,[^,]+,[^,]+,|\/)\s*([\d.]+)(%)?\s*\)/);
    const opaque = paint && paint !== "none" && paint !== "transparent" && (!alpha || Number(alpha[1]) / (alpha[2] ? 100 : 1) >= .999);
    if (!opaque) {
      canvas.style.removeProperty("--day-theme-glyph");
      canvas.style.removeProperty("--day-theme-glyph-mask");
      return;
    }
    canvas.style.setProperty("--day-theme-glyph-mask", image(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path fill="white" fill-rule="evenodd" d="M0 0H${width}V${height}H0ZM${x} ${y}H${right}V${bottom}H${x}Z"/></svg>`));
    const copy = glyph.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.style.color = win.getComputedStyle(glyph).color;
    copy.setAttribute("width", String(box.width)); copy.setAttribute("height", String(box.height));
    copy.setAttribute("x", String(box.x - x)); copy.setAttribute("y", String(box.y - y));
    canvas.style.setProperty("--day-theme-glyph", image(`<svg xmlns="http://www.w3.org/2000/svg" width="${right - x}" height="${bottom - y}"><rect width="100%" height="100%" fill="${paint}"/>${copy.outerHTML}</svg>`));
  };
}

/** Reveal the destination DOM. Unsupported or quiet clients commit immediately. */
export function applyTheme(mode: ThemeMode, quiet = false, root?: HTMLElement, options: ThemeRevealOptions = {}): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const scope = root ?? document.documentElement, doc = scope.ownerDocument, canvas = doc.documentElement, win = doc.defaultView;
  const media = win?.matchMedia?.("(prefers-reduced-motion: reduce)");
  const isQuiet = () => quiet || doc.hidden || !!media?.matches;
  const commit = () => { scope.dataset.theme = mode; scope.dataset.mode = mode; };
  const active = activeReveals.get(doc);
  if (active?.scope === scope && active.mode === mode && !isQuiet()) return active.promise;
  active?.finish();
  const activation = pendingActivation?.element.ownerDocument === doc && performance.now() - pendingActivation.time < 1500 ? pendingActivation : undefined;
  pendingActivation = undefined;
  const supportsPath = win?.CSS?.supports?.("clip-path", 'path("M0 0L1 0L1 1Z")');
  if (scope.dataset.theme === mode || isQuiet() || !win || typeof doc.startViewTransition !== "function" || !supportsPath) {
    commit();
    return Promise.resolve();
  }
  const { width, height } = viewport(doc);
  const origin = options.origin ?? activation?.origin ?? variedThemeOrigin(width, height);
  const toggle = activation?.element.isConnected ? activation.element : undefined;
  const control = toggle?.getBoundingClientRect();
  const controlPath = control ? `M${control.left + control.height / 2} ${control.top}H${control.right - control.height / 2}Q${control.right} ${control.top} ${control.right} ${control.top + control.height / 2}Q${control.right} ${control.bottom} ${control.right - control.height / 2} ${control.bottom}H${control.left + control.height / 2}Q${control.left} ${control.bottom} ${control.left} ${control.top + control.height / 2}Q${control.left} ${control.top} ${control.left + control.height / 2} ${control.top}Z` : "";
  const savedStyles = revealStyles.map(name => ({ name, value: canvas.style.getPropertyValue(name), priority: canvas.style.getPropertyPriority(name) }));
  const savedAttributes = revealAttributes.map(name => [name, canvas.getAttribute(name)] as const);
  const paintGlyph = createGlyphPainter(canvas, toggle, width, height);
  const phase = Math.random() * Math.PI * 2;
  let done = false, view: ViewTransition | undefined, animation: AnimationPlaybackControls | undefined;
  let resolve!: () => void;
  const promise = new Promise<void>(yes => { resolve = yes; });
  const paint = (progress: number) => {
    if (done) return;
    paintGlyph();
    canvas.style.setProperty("--day-theme-clip", `path("${themeRevealPath(progress, origin, width, height, phase)}${controlPath}")`);
    canvas.setAttribute("data-theme-progress", String(Number(progress.toFixed(4))));
  };
  const finish = () => {
    if (done) return;
    done = true;
    animation?.stop();
    win.clearTimeout(watchdog);
    commit();
    view?.skipTransition();
    media?.removeEventListener?.("change", quietChanged);
    doc.removeEventListener("visibilitychange", quietChanged);
    doc.removeEventListener("scroll", finish, true);
    win.removeEventListener("resize", finish);
    if (activeReveals.get(doc)?.promise === promise) {
      for (const { name, value, priority } of savedStyles) {
        if (value) canvas.style.setProperty(name, value, priority); else canvas.style.removeProperty(name);
      }
      for (const [name, value] of savedAttributes) {
        if (value === null) canvas.removeAttribute(name); else canvas.setAttribute(name, value);
      }
      activeReveals.delete(doc);
    }
    resolve();
  };
  const quietChanged = () => { if (isQuiet()) finish(); };
  // A failed capture must never strand a retained snapshot over the application.
  const watchdog = win.setTimeout(finish, 3000);
  activeReveals.set(doc, { scope, mode, promise, finish });
  canvas.setAttribute("data-theme-reveal", mode);
  canvas.setAttribute("data-theme-origin", `${origin.x} ${origin.y}`);
  paint(0);
  media?.addEventListener?.("change", quietChanged);
  doc.addEventListener("visibilitychange", quietChanged);
  doc.addEventListener("scroll", finish, { capture: true, passive: true });
  win.addEventListener("resize", finish, { passive: true });
  try {
    view = doc.startViewTransition(() => { if (!done) commit(); });
    void view.ready.then(() => {
      if (done) return;
      if (isQuiet()) { finish(); return; }
      animation = animate(0, 1, { duration: 1.2 + Math.random() * .18, ease: [.42, 0, .18, 1], onUpdate: paint, onComplete: finish });
    }, finish);
    void view.finished.then(finish, finish);
  } catch { finish(); }
  return promise;
}
