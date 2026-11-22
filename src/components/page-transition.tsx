"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function PageTransition({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  const content = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = content.current;
    if (!element || typeof element.animate !== "function") return;
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (preference?.matches) return;

    // Animate the current node without keying or retaining an App Router tree.
    // No fill means a finished entry leaves no transform on fixed descendants.
    const animation = element.animate([
      { opacity: .5, transform: "translateY(6px)" },
      { opacity: 1, transform: "none" },
    ], { duration: 220, easing: "cubic-bezier(.22, 1, .36, 1)" });
    const stopIfReduced = () => { if (preference?.matches) animation.cancel(); };
    preference?.addEventListener("change", stopIfReduced);
    return () => {
      preference?.removeEventListener("change", stopIfReduced);
      animation.cancel();
    };
  }, [routeKey]);

  return <div ref={content} className="page-transition">{children}</div>;
}
