"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";
import styles from "./balloons.module.css";

export interface BalloonsHandle { launchAnimation: () => Promise<void> }
export interface BalloonsProps {
  type?: "default" | "text";
  text?: string;
  fontSize?: number;
  color?: string;
  className?: string;
  onLaunch?: () => void;
}

const colors = ["#ef6b79", "#f4bb44", "#61b8e8", "#70bb91", "#a38adb", "#ef9863"];

export const Balloons = forwardRef<BalloonsHandle, BalloonsProps>(function Balloons(
  { type = "default", text = "Day", fontSize = 100, color = "#111111", className, onLaunch }, ref,
) {
  const anchor = useRef<HTMLDivElement>(null);
  const running = useRef<Promise<void> | null>(null);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  useImperativeHandle(ref, () => ({
    launchAnimation() {
      if (running.current) return running.current;
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (!anchor.current?.isConnected || motion.matches || typeof HTMLElement.prototype.animate !== "function") {
        return Promise.resolve();
      }

      const layer = document.createElement("div");
      layer.className = styles.layer;
      layer.setAttribute("data-day-celebration", "");
      layer.setAttribute("aria-hidden", "true");
      layer.inert = true;
      const animations: Animation[] = [];
      const completions: Promise<unknown>[] = [];
      let resolve!: () => void;
      let finished = false;
      let timeout: number | undefined;
      const completion = new Promise<void>(done => { resolve = done; });
      running.current = completion;

      const finish = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        motion.removeEventListener("change", onMotionChange);
        animations.forEach(animation => animation.cancel());
        layer.remove();
        running.current = null;
        stop.current = null;
        resolve();
      };
      const onMotionChange = () => { if (motion.matches) finish(); };
      stop.current = finish;

      try {
        // A fixed number of small, unfiltered sprites: no measurement, SVG
        // filter layers, per-frame JavaScript, or persistent animation roots.
        const count = type === "text" ? 1 : 10;
        for (let index = 0; index < count; index++) {
          const sprite = document.createElement("span");
          const isText = type === "text";
          sprite.className = isText ? styles.text : styles.balloon;
          sprite.style.left = isText ? "50%" : `${6 + index * 9.6}%`;
          if (isText) {
            sprite.textContent = text;
            sprite.style.fontSize = `${Number.isFinite(fontSize) ? Math.min(128, Math.max(16, fontSize)) : 100}px`;
            sprite.style.color = color;
          } else {
            sprite.style.width = `${38 + (index % 3) * 7}px`;
            sprite.style.setProperty("--balloon-color", colors[index % colors.length]);
            const body = document.createElement("span");
            body.className = styles.body;
            const thread = document.createElement("span");
            thread.className = styles.thread;
            sprite.append(body, thread);
          }
          layer.appendChild(sprite);
        }
        document.body.appendChild(layer);
        motion.addEventListener("change", onMotionChange);
        timeout = window.setTimeout(finish, 4000);

        Array.from(layer.children).forEach((child, index) => {
          const centered = type === "text" ? "translateX(-50%) " : "";
          const drift = (index % 2 ? 1 : -1) * (18 + index * 2);
          const animation = (child as HTMLElement).animate([
            { transform: `${centered}translate3d(0, 0, 0) rotate(-6deg)`, opacity: 0 },
            { transform: `${centered}translate3d(${drift / 2}px, -25dvh, 0) rotate(5deg)`, opacity: 1, offset: 0.25 },
            { transform: `${centered}translate3d(${drift}px, calc(-100dvh - 160px), 0) rotate(-4deg)`, opacity: 0 },
          ], { duration: 2700 + (index % 3) * 160, delay: index * 45, easing: "cubic-bezier(.22,.55,.42,1)", fill: "both" });
          animations.push(animation);
          // Cancellation rejects Animation.finished; settle it at the browser
          // boundary so a decorative effect never leaks a rejected promise.
          completions.push(animation.finished.catch(() => undefined));
        });
        onLaunch?.();
        void Promise.all(completions).then(finish);
      } catch (error) {
        finish();
        console.warn("Day celebration could not be displayed", error);
      }
      return completion;
    },
  }), [type, text, fontSize, color, onLaunch]);

  return <div ref={anchor} className={cn(styles.anchor, className)} aria-hidden="true" />;
});

export default Balloons;
