import { appearanceBootstrapScript } from "@/lib/appearance";
import type { Metadata, Viewport } from "next";
import { DayProvider } from "@/components/day-provider";
import { AppShell } from "@/components/app-shell";
import { PersonalPhotosProvider } from "@/features/appearance/personal-photos";
import { FocusProvider } from "@/features/focus/focus-provider";
import "./globals.css";
import "@/design-system/day.css";
import "@/design-system/completion.css";
import "@/features/search/search.css";
import "@/features/today/today.css";
import "@/design-system/appearance.css";
import "@/features/focus/focus.css";
import "@/features/review/review.css";
import "@/features/review/review-stats.css";
import "@/design-system/personalization.css";
export const metadata: Metadata = { title: { default: "Day — планы, питание, привычки", template: "%s · Day" }, description: "Личное пространство для задач, питания, воды и привычек.", applicationName: "Day", icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" }, appleWebApp: { capable: true, statusBarStyle: "default", title: "Day" }, manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#101010" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: appearanceBootstrapScript }} /></head><body><DayProvider><PersonalPhotosProvider><FocusProvider><AppShell>{children}</AppShell></FocusProvider></PersonalPhotosProvider></DayProvider></body></html>; }
