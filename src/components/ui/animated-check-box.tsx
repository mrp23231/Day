"use client";

import { forwardRef, useState, type CSSProperties, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type NeonCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  label?: string;
  size?: "sm" | "md";
};

/** A native, focusable input with the supplied check / glow / particle treatment. */
export const NeonCheckbox = forwardRef<HTMLInputElement, NeonCheckboxProps>(function NeonCheckbox(
  { checked, defaultChecked = false, onChange, label, size = "sm", className, disabled, style, ...props }, ref,
) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const [burst, setBurst] = useState(0);
  const isChecked = checked ?? internalChecked;

  return <label className={cn("day-check", `day-check-${size}`, className)} style={style} data-checked={isChecked} data-disabled={!!disabled}>
    <span className="day-check-target">
      <input {...props} ref={ref} type="checkbox" className="day-check-input" checked={isChecked} disabled={disabled}
        onChange={event => {
          if (checked === undefined) setInternalChecked(event.target.checked);
          if (event.target.checked) setBurst(value => value + 1);
          onChange?.(event);
        }} />
      <span className="day-check-frame" aria-hidden="true">
        <Check className="day-check-mark" size={15} strokeWidth={2.4} />
        {isChecked && burst > 0 && <span className="day-check-burst" key={burst}>
          <span className="day-check-ring" />
          {Array.from({ length: 8 }, (_, index) => <i key={index} style={{ "--particle-angle": `${index * 45}deg` } as CSSProperties} />)}
        </span>}
      </span>
    </span>
    {label && <span className="day-check-label">{label}</span>}
  </label>;
});

export default NeonCheckbox;
