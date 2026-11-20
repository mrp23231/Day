"use client";

import { useId, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { dateFromKey } from "@/lib/domain";
import type { ProductivityDay } from "@/lib/calendar-productivity";
import styles from "./focus-city.module.css";

type Point = [number, number];
type CityBlock = { day: ProductivityDay; base: Point[]; roof: Point[]; depth: number };
export interface FocusCityProps {
  days: ProductivityDay[];
  selectedDate: string;
  onDaySelect: (date: string) => void;
  describeDay: (day: ProductivityDay) => string;
}
const defaultYaw = Math.PI / 6;
const points = (vertices: Point[]) => vertices.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

/** Adapted from FocusCity: each building is an actual calendar day, height is completed tasks. */
function cityGeometry(days: ProductivityDay[], yaw: number) {
  const offset = (dateFromKey(days[0].date).getDay() + 6) % 7;
  const columns = Math.ceil((days.length + offset) / 7);
  const project = (x: number, y: number, z = 0): Point => [x * Math.cos(yaw) - y * Math.sin(yaw), (x * Math.sin(yaw) + y * Math.cos(yaw)) * .46 - z];
  const raw = days.map((day, index) => {
    const x = Math.floor((index + offset) / 7), y = (index + offset) % 7, size = .77;
    // A logarithmic scale keeps busy days visible without burying the rest of the calendar.
    const z = day.status === "future" ? 0 : Math.log2(day.completed + 1) * .42;
    return { day, base: [project(x, y), project(x + size, y), project(x + size, y + size), project(x, y + size)], roof: [project(x, y, z), project(x + size, y, z), project(x + size, y + size, z), project(x, y + size, z)], depth: x * Math.sin(yaw) + y * Math.cos(yaw) };
  });
  const ground = [project(-.3, -.3), project(columns, -.3), project(columns, 7.1), project(-.3, 7.1)];
  const vertices = [...ground, ...raw.flatMap(block => [...block.base, ...block.roof])];
  const minX = Math.min(...vertices.map(point => point[0])), maxX = Math.max(...vertices.map(point => point[0]));
  const minY = Math.min(...vertices.map(point => point[1])), maxY = Math.max(...vertices.map(point => point[1]));
  const width = 800, height = 300;
  const scale = Math.min((width - 50) / (maxX - minX), (height - 35) / (maxY - minY));
  const fit = ([x, y]: Point): Point => [(x - minX) * scale + (width - (maxX - minX) * scale) / 2, (y - minY) * scale + (height - (maxY - minY) * scale) / 2];
  return { ground: ground.map(fit), blocks: raw.map(block => ({ ...block, base: block.base.map(fit), roof: block.roof.map(fit) } as CityBlock)).sort((a, b) => a.depth - b.depth) };
}

export function FocusCity({ days, selectedDate, onDaySelect, describeDay }: FocusCityProps) {
  const { t } = useI18n();
  const id = useId();
  const [yaw, setYaw] = useState(defaultYaw);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ start: number; yaw: number; moved: boolean } | null>(null);
  const skipClick = useRef(false);
  const layout = useMemo(() => days.length ? cityGeometry(days, yaw) : null, [days, yaw]);
  if (!layout) return null;
  return <div className={styles.city}>
    <div className={styles.caption}><span>{t("Перетащите, чтобы повернуть")}</span><button type="button" className="icon-button" aria-label={t("Вернуть ракурс")} disabled={Math.abs(yaw - defaultYaw) < .005} onClick={() => setYaw(defaultYaw)}><RotateCcw size={14} aria-hidden="true" /></button></div>
    <svg className={`${styles.plot} ${dragging ? styles.dragging : ""}`} viewBox="0 0 800 300" role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onPointerDown={event => { if (event.button !== 0) return; drag.current = { start: event.clientX, yaw, moved: false }; skipClick.current = false; }}
      onPointerMove={event => {
        if (!drag.current) return;
        const delta = event.clientX - drag.current.start;
        if (Math.abs(delta) > 5 && !drag.current.moved) { drag.current.moved = true; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); }
        if (drag.current.moved) setYaw(Math.max(.2, Math.min(.85, drag.current.yaw + delta / 540)));
      }}
      onPointerUp={() => { skipClick.current = Boolean(drag.current?.moved); drag.current = null; setDragging(false); }}
      onPointerCancel={() => { drag.current = null; skipClick.current = true; setDragging(false); }}
      onPointerLeave={() => { if (!drag.current?.moved) drag.current = null; }}>
      <title id={`${id}-title`}>{t("Город продуктивности")}</title>
      <desc id={`${id}-description`}>{t("Город из {count} дней. Выберите дату под графиком для просмотра с клавиатуры.", { count: days.length })} {t("Один день — одно здание. Высота — выполненные задачи, цвет — доля выполнения.")}</desc>
      <polygon points={points(layout.ground)} className={styles.ground} />
      {layout.blocks.map(block => <g key={block.day.date} className={styles.block} data-date={block.day.date} data-status={block.day.status} onClick={() => { if (!skipClick.current) onDaySelect(block.day.date); skipClick.current = false; }}>
        <title>{describeDay(block.day)}</title>
        <polygon points={points([block.roof[3], block.roof[2], block.base[2], block.base[3]])} className={styles.left} />
        <polygon points={points([block.roof[1], block.roof[2], block.base[2], block.base[1]])} className={styles.right} />
        <polygon points={points(block.roof)} className={styles.roof} />
        {block.day.date === selectedDate && <polygon points={points(block.roof)} className={styles.selection} />}
      </g>)}
    </svg>
    <p className={styles.explanation}>{t("Один день — одно здание. Высота — выполненные задачи, цвет — доля выполнения.")}</p>
  </div>;
}

export default FocusCity;
