import type { Preferences } from "./domain";

/** Guest introduction and first-account introduction are separate milestones. */
export function needsAccountOnboarding({ userId, ready, authReady, preferences }: {
  userId: string | null;
  ready: boolean;
  authReady: boolean;
  preferences: Preferences;
}): boolean {
  return Boolean(userId && ready && authReady && !preferences.accountOnboardingDone);
}
