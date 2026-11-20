"use client";

import { useI18n } from "@/components/i18n-provider";

import { useRef, useState, type FormEvent } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { taskSchema, type Task } from "@/lib/domain";

export function QuickTaskForm({ date, onAdd }: { date: string; onAdd: (task: Task) => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    const task = taskSchema.parse({
      id: crypto.randomUUID(), title, date, description: "", time: "",
      priority: "normal", category: "Личное", repeat: "none", completedDates: [],
    });
    onAdd(task);
    setTitle("");
    input.current?.focus();
  }

  return <form className="quick-task-form" onSubmit={submit} aria-label={t("Быстрое создание задачи")}>
    <Plus size={17} strokeWidth={1.5} aria-hidden="true" />
    <input ref={input} aria-label={t("Быстро добавить задачу")} placeholder={t("Добавить задачу…")} value={title} maxLength={180} autoComplete="off" onChange={event=>setTitle(event.target.value)} />
    <kbd aria-hidden="true">Enter</kbd>
    <button type="submit" aria-label={t("Добавить задачу в план")} disabled={!title.trim()}><ArrowUp size={16} /></button>
  </form>;
}
