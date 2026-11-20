"use client";
import {useI18n} from "@/components/i18n-provider";
export default function ErrorPage({retry}:{error:unknown;retry:()=>void}){const {t}=useI18n();return <section className="panel"><div className="empty-state"><h1>{t("Нужна небольшая пауза")}</h1><p>{t("Не удалось открыть этот экран. Попробуйте ещё раз; сохранённые записи остаются в вашем пространстве.")}</p><button className="button button-primary" onClick={retry}>{t("Попробовать снова")}</button></div></section>;}
