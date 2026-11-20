import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function number(value: number) { return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value); }
