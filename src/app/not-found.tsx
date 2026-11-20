"use client";
import {useI18n} from "@/components/i18n-provider";
import Link from "next/link";
export default function NotFound() { const {t}=useI18n();return <div className="empty-state"><h1>{t("Этот путь пока не найден")}</h1><p>{t("Вернёмся к вашему дню?")}</p><Link className="button button-primary" href="/">{t("На сегодня")}</Link></div>; }
