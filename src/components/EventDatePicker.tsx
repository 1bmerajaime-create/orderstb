import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, formatDateRange, toLocalISO } from '../lib/utils';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso || toLocalISO(new Date())}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

function startOfWeekMonday(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return toLocalISO(d);
}

export function EventDatePicker({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const today = toLocalISO(new Date());
  const effectiveStart = start || today;
  const effectiveEnd = end && end >= effectiveStart ? end : effectiveStart;
  const multi = effectiveEnd > effectiveStart;

  const [multiDay, setMultiDay] = useState(multi);
  const [pickingEnd, setPickingEnd] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const [y, m] = effectiveStart.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  const monthLabel = viewMonth.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: Array<{ iso: string | null; day: number | null }> = [];
    for (let i = 0; i < startOffset; i++) list.push({ iso: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      list.push({ iso: toLocalISO(date), day: d });
    }
    while (list.length % 7 !== 0) list.push({ iso: null, day: null });
    return list;
  }, [viewMonth]);

  function selectDay(iso: string) {
    if (!multiDay) {
      onChange(iso, iso);
      setPickingEnd(false);
      return;
    }
    if (!pickingEnd || !start || iso < start) {
      onChange(iso, iso);
      setPickingEnd(true);
      return;
    }
    onChange(start, iso);
    setPickingEnd(false);
  }

  function setMode(nextMulti: boolean) {
    setMultiDay(nextMulti);
    setPickingEnd(false);
    if (!nextMulti) {
      onChange(effectiveStart, effectiveStart);
    }
  }

  function applyPreset(kind: 'hoy' | 'manana' | 'finde') {
    if (kind === 'hoy') {
      onChange(today, today);
      setMultiDay(false);
      setPickingEnd(false);
      const [y, m] = today.split('-').map(Number);
      setViewMonth(new Date(y, m - 1, 1));
      return;
    }
    if (kind === 'manana') {
      const t = addDays(today, 1);
      onChange(t, t);
      setMultiDay(false);
      setPickingEnd(false);
      const [y, m] = t.split('-').map(Number);
      setViewMonth(new Date(y, m - 1, 1));
      return;
    }
    // Este finde: sábado–domingo de la semana actual o próxima
    const sat = addDays(startOfWeekMonday(today), 5);
    const rangeStart = sat < today ? addDays(sat, 7) : sat;
    const rangeEnd = addDays(rangeStart, 1);
    onChange(rangeStart, rangeEnd);
    setMultiDay(true);
    setPickingEnd(false);
    const [y, m] = rangeStart.split('-').map(Number);
    setViewMonth(new Date(y, m - 1, 1));
  }

  return (
    <div className="date-picker">
      <div className="date-picker-summary">
        <span className="date-picker-summary-label">Fechas del evento</span>
        <strong>
          {start
            ? formatDateRange(effectiveStart, effectiveEnd)
            : 'Elige una fecha'}
        </strong>
        {multiDay && pickingEnd && (
          <span className="date-picker-hint">Ahora elige el último día</span>
        )}
      </div>

      <div className="date-picker-presets">
        <button type="button" className="date-chip" onClick={() => applyPreset('hoy')}>
          Hoy
        </button>
        <button type="button" className="date-chip" onClick={() => applyPreset('manana')}>
          Mañana
        </button>
        <button type="button" className="date-chip" onClick={() => applyPreset('finde')}>
          Este finde
        </button>
      </div>

      <div className="view-toggle date-picker-mode">
        <button
          type="button"
          className={`view-toggle-btn${!multiDay ? ' active' : ''}`}
          onClick={() => setMode(false)}
        >
          Un día
        </button>
        <button
          type="button"
          className={`view-toggle-btn${multiDay ? ' active' : ''}`}
          onClick={() => setMode(true)}
        >
          Varios días
        </button>
      </div>

      <div className="date-picker-cal">
        <div className="calendar-toolbar">
          <button
            type="button"
            className="icon-btn"
            aria-label="Mes anterior"
            onClick={() =>
              setViewMonth(
                new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
              )
            }
          >
            <ChevronLeft size={18} />
          </button>
          <strong className="calendar-month">{monthLabel}</strong>
          <button
            type="button"
            className="icon-btn"
            aria-label="Mes siguiente"
            onClick={() =>
              setViewMonth(
                new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
              )
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="date-picker-weekdays">
          {WEEKDAYS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="date-picker-grid">
          {cells.map((cell, i) => {
            if (!cell.iso) {
              return <div key={`e-${i}`} className="date-picker-day empty" />;
            }
            const iso = cell.iso;
            const isStart = iso === effectiveStart;
            const isEnd = iso === effectiveEnd;
            const inRange =
              multiDay && iso > effectiveStart && iso < effectiveEnd;
            const isToday = iso === today;
            return (
              <button
                key={iso}
                type="button"
                className={[
                  'date-picker-day',
                  isStart || isEnd ? 'selected' : '',
                  inRange ? 'in-range' : '',
                  isToday ? 'today' : '',
                  isStart && multiDay ? 'range-start' : '',
                  isEnd && multiDay && effectiveEnd !== effectiveStart
                    ? 'range-end'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => selectDay(iso)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      {start && (
        <p className="date-picker-caption">
          {multiDay && effectiveEnd !== effectiveStart
            ? `Del ${formatDate(effectiveStart)} al ${formatDate(effectiveEnd)}`
            : formatDate(effectiveStart)}
        </p>
      )}
    </div>
  );
}
