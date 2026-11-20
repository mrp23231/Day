"use client";
import { useI18n } from "./i18n-provider";
export function AppLoadingSkeleton() {
  const {t}=useI18n();
  return <div className="page-stack" role="status" aria-label={t("Загрузка пространства")} aria-busy="true">
    <span className="sr-only">{t("Загружаем ваши записи…")}</span>
    <div className="skeleton" aria-hidden="true" style={{ height: 90 }} />
    <div className="skeleton" aria-hidden="true" style={{ height: 190 }} />
    <div className="dashboard-grid" aria-hidden="true">
      <div className="skeleton" style={{ height: 300 }} />
      <div className="skeleton" style={{ height: 300 }} />
    </div>
  </div>;
}
