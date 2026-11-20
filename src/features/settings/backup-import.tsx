"use client";
import { useI18n } from "@/components/i18n-provider";

import { useId, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { Button } from "@/components/ui/button";
import { backupSummary, MAX_BACKUP_BYTES, parseBackup } from "@/lib/backup";
import type { AppData } from "@/lib/domain";
import styles from "./backup-import.module.css";

export function BackupImport() {
  const { data, user, resetVersion, ready, authReady, importData } = useDay();
  const scopeKey = JSON.stringify([user?.id ?? null, resetVersion, ready, authReady]);
  return <BackupImportForm key={scopeKey} data={data} enabled={ready && authReady} importData={importData} />;
}

function BackupImportForm({ data, enabled, importData }: { data: AppData; enabled: boolean; importData: (incoming: AppData) => void }) {
  const {t}=useI18n();
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const mounted = useRef(true);
  const [preview, setPreview] = useState<{ data: AppData; filename: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Invalidate reads synchronously when a scope/reset change replaces this form.
  useLayoutEffect(() => {
    const pendingRequest = request;
    mounted.current = true;
    return () => { mounted.current = false; pendingRequest.current++; };
  }, []);

  function cancel() {
    request.current++;
    setPreview(null);
    setConfirmed(false);
    setReading(false);
    setError("");
    setSuccess("");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file || !enabled) return;
    cancel();
    const token = ++request.current;
    if (file.size > MAX_BACKUP_BYTES) {
      setError("Файл слишком большой. Выберите резервную копию до 10 МБ.");
      return;
    }
    setReading(true);
    const isCurrent = () => mounted.current && request.current === token;
    let text: string;
    try {
      text = await file.text();
    } catch {
      if (isCurrent()) {
        setError("Не удалось прочитать файл. Попробуйте выбрать его снова.");
        setReading(false);
      }
      return;
    }
    if (!isCurrent()) return;
    try {
      setPreview({ data: parseBackup(text), filename: file.name });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось проверить резервную копию."));
    }
    setReading(false);
  }

  function confirmImport() {
    if (!enabled || !preview || !confirmed || reading) return;
    setError("");
    try {
      importData(preview.data);
      cancel();
      setSuccess("Копия импортирована. Предыдущие локальные записи сохранены в резерве.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось импортировать копию. Текущие записи сохранены."));
    }
  }

  const currentCounts = backupSummary(data);
  const incomingCounts = preview ? backupSummary(preview.data) : null;
  const rows = [["tasks", t("Задачи")], ["habits", t("Привычки")], ["foods", t("Питание")], ["water", t("Вода")], ["reviews", t("Итоги дня")]] as const;

  return <div className={styles.import} aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}><Upload size={14} aria-hidden="true" />{t("Восстановить из файла")}</h3>
    <p className={styles.description} id={`${id}-hint`}>{t("Выберите JSON-копию Day до 10 МБ. Файл остаётся на устройстве и не отправляется на сервер.")}</p>
    <label className={styles.file} htmlFor={`${id}-file`}>{t("JSON-копия Day")}<input ref={fileInput} id={`${id}-file`} type="file" accept=".json,application/json" disabled={!enabled} aria-describedby={`${id}-hint`} onChange={chooseFile} />
    </label>
    {reading && <p className={styles.description} role="status">{t("Проверяем файл…")}</p>}
    {preview && incomingCounts && <div className={styles.preview}>
      <p className={styles.filename}>{preview.filename}</p>
      <table className={styles.counts}>
        <caption className={styles.caption}>{t("Содержимое резервной копии")}</caption>
        <thead><tr><th scope="col">{t("Записи")}</th><th scope="col">{t("Сейчас")}</th><th scope="col">{t("В копии")}</th></tr></thead>
        <tbody>{rows.map(([key, label]) => <tr key={key}><th scope="row">{label}</th><td>{currentCounts[key]}</td><td>{incomingCounts[key]}</td></tr>)}</tbody>
      </table>
      <p className={styles.notice}>{t("Записи и настройки из файла заменят текущие записи и настройки этого пространства. Перед заменой Day сохранит предыдущую локальную копию на этом устройстве.")}</p>
      <p className={styles.description}>{t("Фотографии не входят в JSON-копию. Текущие фотографии на этом устройстве сохранятся. Аккаунт и статус знакомства с Day сохранятся.")}</p>
      <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={!enabled} onChange={event => setConfirmed(event.target.checked)} /><span>{t("Я подтверждаю: заменить текущие записи данными из файла")}</span></label>
      <Button type="button" disabled={!enabled || !confirmed || reading} onClick={confirmImport}>{t("Импортировать копию")}</Button>
    </div>}
    {(reading || preview) && <Button type="button" variant="ghost" onClick={cancel}>{t("Отмена")}</Button>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {success && <p className={styles.description} role="status">{t(success)}</p>}
  </div>;
}
