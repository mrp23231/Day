"use client";
import { useI18n } from "@/components/i18n-provider";

import * as Dialog from "@radix-ui/react-dialog";
import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, CalendarDays, CornerDownLeft, FileText, Leaf, Plus, Search, Utensils, X } from "lucide-react";
import { searchDay, type SearchDocument, type SearchResult } from "@/lib/search";

const icons = { action: Plus, page: ArrowUpRight, task: CalendarDays, habit: Leaf, food: Utensils };

/** Rendered inside a Radix Root so its trigger receives focus on close. */
export function SearchDialog({ index, onSelect }: { index: SearchDocument[]; onSelect: (result: SearchResult) => void }) {const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const handingOffEditor = useRef(false);
  const id = useId();
  const results = useMemo(() => searchDay(index, query), [index, query]);
  const selected = results.length ? Math.min(activeIndex, results.length - 1) : 0;
  const activeId = results.length ? `${id}-option-${selected}` : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  function choose(result: SearchResult) {
    handingOffEditor.current = !!result.modal;
    onSelect(result);
  }
  function navigate(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
      event.preventDefault();
      setActiveIndex((selected + (event.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (results[selected]) choose(results[selected]);
    }
  }

  return <Dialog.Portal>
    <Dialog.Overlay className="dialog-overlay search-overlay" />
    <Dialog.Content className="dialog-content search-dialog" onEscapeKeyDown={event => { if (event.isComposing) event.preventDefault(); }} onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus(); }} onCloseAutoFocus={event => { if (handingOffEditor.current) event.preventDefault(); }}>
      <Dialog.Title className="sr-only">{t("Поиск в Day")}</Dialog.Title>
      <Dialog.Description className="sr-only">{t("Найдите запись за любую дату, перейдите в раздел или создайте новую запись.")}</Dialog.Description>
      <div className="search-input-line">
        <Search size={20} strokeWidth={1.6} aria-hidden="true" />
        <input ref={input} role="combobox" aria-label={t("Найти в Day")} aria-expanded="true" aria-autocomplete="list" aria-controls={`${id}-results`} aria-activedescendant={activeId} autoComplete="off" placeholder={t("Найти в Day…")} value={query} maxLength={160} onChange={event => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={navigate} />
        {query && <button className="search-clear" aria-label={t("Очистить поиск")} onClick={() => { setQuery(""); setActiveIndex(0); input.current?.focus(); }}><X size={14} /></button>}
        <Dialog.Close className="icon-button search-close" aria-label={t("Закрыть поиск")}><X size={18} /></Dialog.Close>
      </div>
      <div className="search-results" id={`${id}-results`} role="listbox" aria-label={t("Результаты поиска")}>
        {results.length ? results.map((result, position) => {
          const Icon = icons[result.kind];
          const group = result.kind === "action" ? t("Быстрые действия") : t("Разделы");
          return <Fragment key={result.id}>
            {!query.trim() && (position === 0 || results[position - 1].kind !== result.kind) && <div className="search-group-label" role="presentation">{group}</div>}
            <button type="button" role="option" aria-selected={position === selected} id={`${id}-option-${position}`} tabIndex={-1} className="search-result" data-active={position === selected} onPointerMove={() => setActiveIndex(position)} onMouseDown={event => event.preventDefault()} onClick={() => choose(result)}>
              <span className="search-result-icon"><Icon size={17} strokeWidth={1.6} /></span>
              <span className="search-result-text"><strong>{result.title}</strong><small>{result.description}</small></span>
              <CornerDownLeft size={14} className="search-result-enter" aria-hidden="true" />
            </button>
          </Fragment>;
        }) : <div className="search-empty"><FileText size={26} strokeWidth={1.3} /><strong>{t("Ничего не найдено")}</strong><p>{t("Попробуйте другое название или раздел.")}</p></div>}
      </div>
      <footer className="search-footer"><span role="status">{query.trim() ? t("Показано: {count}", {count: results.length}) : t("Поиск по всем датам")}</span><div className="search-key-hints"><span><kbd><ArrowUp size={10} /><ArrowDown size={10} /></kbd>{t("выбрать")}</span><span><kbd><CornerDownLeft size={11} /></kbd>{t("открыть")}</span><span><kbd>esc</kbd>{t("закрыть")}</span></div></footer>
    </Dialog.Content>
  </Dialog.Portal>;
}
