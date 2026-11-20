import { describe, expect, it } from "vitest";
import { emptyData, preferencesSchema, readSavedData } from "./domain";
import { needsAccountOnboarding } from "./account-onboarding";

describe("account welcome preferences", () => {
  it("migrates older guest data without treating its intro as account completion", () => {
    const old = JSON.parse(JSON.stringify(emptyData()));
    delete old.preferences.accountOnboardingDone;
    delete old.preferences.onboardingFocus;
    delete old.preferences.onboardingPace;
    old.preferences.onboardingDone = true;
    old.preferences.name = "Локальный профиль";
    const restored = readSavedData(JSON.stringify(old));
    expect(restored.preferences.name).toBe("Локальный профиль");
    expect(restored.preferences.accountOnboardingDone).toBe(false);
    expect(restored.preferences.onboardingFocus).toBe("planning");
    expect(restored.preferences.onboardingPace).toBe("gentle");
    expect(needsAccountOnboarding({ userId: "account", ready: true, authReady: true, preferences: restored.preferences })).toBe(true);
  });

  it("waits for auth restoration and never starts the account welcome for guests", () => {
    const preferences = emptyData().preferences;
    expect(needsAccountOnboarding({ userId: null, ready: true, authReady: true, preferences })).toBe(false);
    expect(needsAccountOnboarding({ userId: "account", ready: false, authReady: true, preferences })).toBe(false);
    expect(needsAccountOnboarding({ userId: "account", ready: true, authReady: false, preferences })).toBe(false);
    preferences.accountOnboardingDone = true;
    expect(needsAccountOnboarding({ userId: "account", ready: true, authReady: true, preferences })).toBe(false);
  });

  it("validates only supported focus and rhythm preferences", () => {
    expect(preferencesSchema.safeParse({ ...emptyData().preferences, onboardingFocus: "health-records" }).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...emptyData().preferences, onboardingPace: "always-on" }).success).toBe(false);
  });
});
