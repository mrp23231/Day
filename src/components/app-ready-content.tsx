"use client";

import type { ReactNode } from "react";
import { useDay } from "./day-provider";
import { AppLoadingSkeleton } from "./app-loading-skeleton";

export function AppReadyContent({ children }: { children: ReactNode }) {
  const { ready } = useDay();
  return ready ? children : <AppLoadingSkeleton />;
}
