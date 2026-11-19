// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { addDays, formatCallDate } from '../format.ts';
import { CalendarIcon } from './illustrations/Icons.tsx';

interface Props {
  /** `YYYY-MM-DD`. */
  value: string;
  /** First and last day that can be picked, `YYYY-MM-DD`. */
  min: string;
  max: string;
  onChange: (date: string) => void;
  labelledBy: string;
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const PANEL_WIDTH = 300;

const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const monthOf = (date: string) => ({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 });
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The days of a month in Monday-first weeks, with `null` for the blanks before the 1st. */
function monthCells(y: number, m: number): (string | null)[] {
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => ymd(y, m, i + 1))];
}

/**
 * Button that opens a month calendar. The panel is rendered in a portal with fixed positioning so the
 * scrolling card around the form does not clip it.
 */
export function DatePicker({ value, min, max, onChange, labelledBy }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthOf(value));
  const [focused, setFocused] = useState(value);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const height = panelRef.current?.offsetHeight ?? 340;
    const below = r.bottom + 8;
    const above = r.top - 8 - height;
    const fitsBelow = below + height <= window.innerHeight - 8;
    // On short phone screens neither side may fit: keep the panel inside the viewport, over the trigger if need be.
    const top = fitsBelow ? below : above >= 8 ? above : Math.max(8, window.innerHeight - height - 8);
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPos({ top, left });
  }, []);

  function show() {
    setView(monthOf(value));
    setFocused(value);
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function pick(date: string) {
    onChange(date);
    close();
  }

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Keep keyboard focus on the highlighted day while the panel is open.
  useEffect(() => {
    if (open && pos) panelRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [open, pos, focused, view]);

  function moveFocus(days: number) {
    let next = addDays(focused, days);
    if (next < min) next = min;
    if (next > max) next = max;
    setFocused(next);
    setView(monthOf(next));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in moves) {
      e.preventDefault();
      moveFocus(moves[e.key]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  }

  const first = monthOf(min);
  const last = monthOf(max);
  const canPrev = view.y > first.y || (view.y === first.y && view.m > first.m);
  const canNext = view.y < last.y || (view.y === last.y && view.m < last.m);
  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(view.y, view.m + delta, 1));
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-labelledby={`${labelledBy} ${panelId}-value`}
        onClick={() => (open ? close() : show())}
      >
        <CalendarIcon className="picker-icon" />
        <span id={`${panelId}-value`} className="picker-value">
          {capitalise(formatCallDate(value))}
        </span>
        <svg className="picker-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            className="calendar"
            role="dialog"
            aria-modal="false"
            aria-label="Elige el día de la llamada"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: PANEL_WIDTH }}
            onKeyDown={onKeyDown}
          >
            <div className="calendar-head">
              <button
                type="button"
                className="calendar-nav"
                aria-label="Mes anterior"
                disabled={!canPrev}
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </button>
              <span className="calendar-month" aria-live="polite">
                {capitalise(monthName.format(Date.UTC(view.y, view.m, 1)))}
              </span>
              <button
                type="button"
                className="calendar-nav"
                aria-label="Mes siguiente"
                disabled={!canNext}
                onClick={() => shiftMonth(1)}
              >
                ›
              </button>
            </div>
            <div className="calendar-grid">
              {WEEKDAYS.map((d) => (
                <span key={d} className="calendar-weekday" aria-hidden="true">
                  {d}
                </span>
              ))}
              {monthCells(view.y, view.m).map((date, i) => {
                if (!date) return <span key={`blank-${i}`} />;
                const disabled = date < min || date > max;
                const classes = ['calendar-day'];
                if (date === value) classes.push('selected');
                if (date.endsWith('-12-24')) classes.push('christmas-eve');
                return (
                  <button
                    key={date}
                    type="button"
                    data-date={date}
                    className={classes.join(' ')}
                    disabled={disabled}
                    tabIndex={date === focused ? 0 : -1}
                    aria-pressed={date === value}
                    aria-label={capitalise(formatCallDate(date))}
                    onClick={() => pick(date)}
                  >
                    {Number(date.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
