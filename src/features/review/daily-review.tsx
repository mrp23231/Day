"use client";

import { useI18n } from "@/components/i18n-provider";

import { useState } from "react";
import { ArrowUpRight, Check, Moon, Star } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { Button } from "@/components/ui/button";
import { dayKey } from "@/lib/domain";
import { ReviewFlow } from "./review-flow";

function DailyReviewCard({date}:{date:string}) {
  const { t, formatNumber } = useI18n();
  const {data,ready}=useDay();
  const [open,setOpen]=useState(false);
  const saved=data.reviews.find(review=>review.date===date);
  const future=ready&&date>dayKey();
  return <section className="today-card day-review-card" aria-labelledby="daily-review-heading">
    <div className="today-section-head"><div className="today-section-title"><Moon size={16}/><h2 id="daily-review-heading">{t("Итоги дня")}</h2></div>{saved?.rating?<span className="review-card-rating" aria-label={t("Оценка дня: {rating} из 5",{rating:formatNumber(saved.rating)})}><Star size={13} fill="currentColor"/>{formatNumber(saved.rating)}</span>:saved&&<Check className="review-saved-check" size={15} aria-label={t("Сохранено")}/>}</div>
    <p>{future?t("Вернитесь сюда в этот день, чтобы сохранить главное."):saved?.closedAt?t("День сохранён. Можно вернуться к результатам и дополнить впечатления."):t("Результаты, планы на потом и немного времени для себя.")}</p>
    <Button variant="outline" disabled={!ready||future} onClick={()=>setOpen(true)}>{saved?t("Открыть итоги"):t("Подвести итоги")}<ArrowUpRight size={14}/></Button>
    {open&&!future&&<ReviewFlow date={date} onClose={()=>setOpen(false)}/>}
  </section>;
}

export function DailyReview({date}:{date:string}) {
  const {user,resetVersion}=useDay();
  return <DailyReviewCard key={`${user?.id??"guest"}:${date}:${resetVersion||0}`} date={date}/>;
}
