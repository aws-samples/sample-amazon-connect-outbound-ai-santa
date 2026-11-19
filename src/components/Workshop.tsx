// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import type { Schema } from '../../amplify/data/resource';
import { client, unwrap } from '../api.ts';
import { friendlyError } from '../errors.ts';
import { BellIcon, CalendarIcon, ClockIcon, GiftIcon, LetterIcon, PhoneIcon, RingingPhoneIcon, StarIcon } from './illustrations/Icons.tsx';
import { Reindeer } from './illustrations/Reindeer.tsx';

type Stats = NonNullable<Schema['WorkshopStats']['type']>;
type Counts = Stats['totals'];
type Icon = ComponentType<{ className?: string }>;

const REFRESH_MS = 30_000;

const TILES: { key: keyof Counts; label: string; icon: Icon }[] = [
  { key: 'scheduled', label: 'Llamadas agendadas', icon: CalendarIcon },
  { key: 'dialled', label: 'Llamadas hechas', icon: PhoneIcon },
  { key: 'answered', label: 'Niños que hablaron con Santa', icon: StarIcon },
  { key: 'lettersSent', label: 'Cartas repartidas', icon: LetterIcon },
  { key: 'wishes', label: 'Deseos apuntados', icon: BellIcon },
  { key: 'giftLinks', label: 'Enlaces de regalo enviados', icon: GiftIcon },
];

const SMALL: { key: keyof Counts; label: string }[] = [
  { key: 'missed', label: 'sin respuesta' },
  { key: 'cutShort', label: 'colgadas antes de la carta' },
  { key: 'cancelled', label: 'canceladas' },
];

const nf = new Intl.NumberFormat('es-ES');
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

/** Madrid to the North Pole, roughly: 49.6 degrees of latitude at 111 km each. */
const KM_TO_NORTH_POLE = 5500;

function minutesSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.round(total % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Ratios from the counters. A dash when there is nothing to divide by yet. */
export function derived(t: Counts) {
  return {
    avgCall: t.timedCalls ? minutesSeconds(t.talkSeconds / t.timedCalls) : '–',
    answerRate: t.dialled ? `${Math.round((t.answered / t.dialled) * 100)} %` : '–',
    wishesPerLetter: t.lettersSent ? nf1.format(t.wishes / t.lettersSent) : '–',
    sleighKm: nf.format(t.lettersSent * KM_TO_NORTH_POLE),
    cookies: nf.format(t.wishes),
    elves: nf.format(Math.ceil(t.wishes / 3)),
  };
}
const dayLabel = (day: string) =>
  // Short weekday and day, e.g. "mié 18".
  new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));

/** Admin-only view with aggregate numbers. It never shows names, notes or wishes. */
export function Workshop() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setStats(unwrap(await client.queries.workshopStats()) ?? null);
      setError('');
    } catch (err) {
      setError(friendlyError(err));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!stats) {
    return (
      <section className="card center workshop-loading" role={error ? 'alert' : 'status'}>
        <Reindeer className={error ? 'loading-reindeer still' : 'loading-reindeer'} />
        <p>{error || 'Contando cartas en el taller…'}</p>
      </section>
    );
  }

  // Both series share the scale, so neither bar can grow past the chart.
  const d = derived(stats.totals);
  const max = Math.max(1, ...stats.days.flatMap((d) => [d.dialled, d.lettersSent]));
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;

  return (
    <section className="card workshop">
      <h2 className="card-title">
        <GiftIcon className="title-icon" />
        El taller de Santa
      </h2>

      <div className="workshop-now">
        <span>
          <ClockIcon className="workshop-now-icon" />
          <strong>{nf.format(stats.pending)}</strong> llamadas esperando su hora
        </span>
        <span>
          <RingingPhoneIcon className="workshop-now-icon" />
          <strong>{nf.format(stats.live)}</strong> en curso ahora
        </span>
      </div>

      <ul className="workshop-tiles">
        {TILES.map(({ key, label, icon: TileIcon }) => (
          <li key={key} className="workshop-tile">
            <TileIcon className="workshop-tile-icon" />
            <strong className="workshop-num">{nf.format(stats.totals[key])}</strong>
            <span className="workshop-label">{label}</span>
          </li>
        ))}
      </ul>

      <dl className="workshop-ratios">
        <div>
          <dt>Duración media de la llamada</dt>
          <dd>{d.avgCall}</dd>
        </div>
        <div>
          <dt>Tasa de respuesta</dt>
          <dd>{d.answerRate}</dd>
        </div>
        <div>
          <dt>Deseos por carta</dt>
          <dd>{d.wishesPerLetter}</dd>
        </div>
      </dl>

      <p className="workshop-small muted">
        {SMALL.map(({ key, label }) => `${nf.format(stats.totals[key])} ${label}`).join(' · ')}
      </p>

      <div className="workshop-fun">
        <h3 className="workshop-sub">
          Datos del Polo Norte <span className="workshop-fun-tag">de cuento</span>
        </h3>
        <ul>
          <li>
            <strong>{d.sleighKm}</strong> km de trineo
          </li>
          <li>
            <strong>{d.cookies}</strong> galletas para los renos
          </li>
          <li>
            <strong>{d.elves}</strong> elfos trabajando
          </li>
        </ul>
        <p className="workshop-fun-note muted">Calculados a partir de las cartas y los deseos: una galleta por deseo, un elfo cada tres.</p>
      </div>

      <h3 className="workshop-sub">Últimos 7 días</h3>
      <ol className="workshop-days" aria-label="Llamadas hechas y cartas por día">
        {stats.days.map((d) => (
          <li key={d.day} className="workshop-day">
            <span className="workshop-bar-wrap" aria-hidden="true">
              <span className="workshop-bar" style={{ height: pct(d.dialled) }} />
              <span className="workshop-bar letters" style={{ height: pct(d.lettersSent) }} />
            </span>
            <span className="workshop-day-label">{dayLabel(d.day)}</span>
            <span className="visually-hidden">
              {d.dialled} llamadas, {d.lettersSent} cartas
            </span>
          </li>
        ))}
      </ol>
      <p className="workshop-legend muted">
        <span className="dot" /> llamadas hechas <span className="dot letters" /> cartas repartidas
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
