"use client";
import { useI18n } from "@/components/i18n-provider";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { createSearchIndex, type SearchResult } from "@/lib/search";
import { SearchDialog } from "./search-dialog";

export function GlobalSearch() {const { t, locale } = useI18n();
  const { data, date, setDate, modal, openModal, ready } = useDay();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shortcut, setShortcut] = useState("Ctrl K");
  const index = useMemo(() => open ? createSearchIndex(data, date, locale) : [], [data, date, locale, open]);

  useEffect(() => { setShortcut(/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘ K" : "Ctrl K"); }, []);
  useEffect(() => {
    const toggle = (event: globalThis.KeyboardEvent) => {
      if (!ready || modal || event.repeat || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setOpen(value => !value);
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, [modal, ready]);

  function select(result: SearchResult) {
    setOpen(false);
    if (result.date) setDate(result.date);
    router.push(result.href);
    if (result.modal) openModal(result.modal);
  }

  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button type="button" className="global-search-trigger" aria-label={t("Поиск в Day")} title={t("Поиск в Day (⌘K / Ctrl+K)")} disabled={!ready || !!modal}><Search size={16} strokeWidth={1.7} /><span>{t("Найти в Day")}</span><kbd>{shortcut}</kbd></button></Dialog.Trigger>
    {open && <SearchDialog index={index} onSelect={select} />}
  </Dialog.Root>;
}
