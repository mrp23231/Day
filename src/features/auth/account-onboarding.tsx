"use client";
import { useEffect, useRef } from "react";
import { useDay } from "@/components/day-provider";
import { needsAccountOnboarding } from "@/lib/account-onboarding";

/** Offer once per sign-in. Closing leaves the introduction resumable from Profile. */
export function AccountOnboarding() {
  const { data, user, ready, authReady, modal, openModal } = useDay();
  const offered = useRef<string | null>(null);
  useEffect(() => {
    if (!user) { offered.current = null; return; }
    if (modal || offered.current === user.id) return;
    if (needsAccountOnboarding({ userId: user.id, ready, authReady, preferences: data.preferences })) {
      offered.current = user.id;
      openModal({ type: "onboarding" });
    }
  }, [user, ready, authReady, data.preferences, modal, openModal]);
  return null;
}
