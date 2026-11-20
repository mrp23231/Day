"use client";
import { useI18n } from "@/components/i18n-provider";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
export function Dialog({ open, onClose, title, description, children, wide = false }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; wide?: boolean }) {
  const {t}=useI18n();
  // Editors mounts a dialog for each session, without a Radix Trigger. Capture
  // its opener before React's autoFocus moves into the form during commit.
  const [opener] = useState(() => typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  return <DialogPrimitive.Root open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="dialog-overlay" /><DialogPrimitive.Content className={`dialog-content ${wide ? "dialog-wide" : ""}`} onCloseAutoFocus={event => { event.preventDefault(); if (opener?.isConnected && !document.activeElement?.closest('[role="dialog"]')) opener.focus({preventScroll:true}); }}><div className="dialog-header"><div><DialogPrimitive.Title>{title}</DialogPrimitive.Title><DialogPrimitive.Description>{description || t("Заполните данные и сохраните изменения.")}</DialogPrimitive.Description></div><DialogPrimitive.Close className="icon-button" aria-label={t("Закрыть")}><X size={20} /></DialogPrimitive.Close></div>{children}</DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>;
}
