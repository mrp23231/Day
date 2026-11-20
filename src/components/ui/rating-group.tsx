"use client";

import { useI18n } from "@/components/i18n-provider";
import { useId } from "react";
import { RatingGroup } from "@ark-ui/react/rating-group";
import { StarIcon } from "lucide-react";
import "./rating-group.css";

export type BasicRatingProps = {
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  label?: string;
};



export function BasicRating({ value, onValueChange, disabled = false, readOnly = false, label = "Оценка дня" }: BasicRatingProps) {
  const {t,formatNumber}=useI18n();
  const ratingText=(value:number)=>t("{value} из 5 звёзд",{value:formatNumber(value)});
  const hintId = useId();

  return <RatingGroup.Root className="day-rating" count={5} allowHalf value={value}
    disabled={disabled} readOnly={readOnly}
    translations={{ ratingValueText: ratingText }}
    onValueChange={details => onValueChange(details.value)}>
    <RatingGroup.Label className="day-rating__label">{t(label)}</RatingGroup.Label>
    <RatingGroup.Control className="day-rating__control" aria-describedby={hintId}>
      {[1, 2, 3, 4, 5].map(index => <RatingGroup.Item key={index} index={index} className="day-rating__item">
        <RatingGroup.ItemContext>{({ half, highlighted }) => <span className="day-rating__star" aria-hidden="true" data-filled={highlighted} data-half={half}>
          <StarIcon className="day-rating__outline" size={32} strokeWidth={1.4} />
          <span className="day-rating__fill"><StarIcon size={32} fill="currentColor" strokeWidth={1.4} /></span>
        </span>}</RatingGroup.ItemContext>
      </RatingGroup.Item>)}
      <RatingGroup.HiddenInput />
    </RatingGroup.Control>
    <p className="day-rating__value" aria-live="polite">{value > 0 ? ratingText(value) : t("Без оценки")}</p>
    <p className="day-rating__hint" id={hintId}>{t(readOnly ? "Сохранённая оценка дня" : "Выберите звёзды или используйте стрелки. Шаг — половина звезды.")}</p>
  </RatingGroup.Root>;
}

export default BasicRating;
