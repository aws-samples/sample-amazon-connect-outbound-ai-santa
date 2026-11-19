// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import type { Schema } from '../../amplify/data/resource';
import { client, unwrap } from '../api.ts';
import { friendlyError } from '../errors.ts';
import { locale, t } from '../i18n.ts';
import { BellIcon, CalendarIcon, ClockIcon, GiftIcon, LetterIcon, PhoneIcon, RingingPhoneIcon, StarIcon } from './illustrations/Icons.tsx';
import { Reindeer } from './illustrations/Reindeer.tsx';

type Stats = NonNullable<Schema['WorkshopStats']['type']>;
type Counts = Stats['totals'];
type Icon = ComponentType<{ className?: string }>;

const REFRESH_MS = 30_000;

const TILES: { key: keyof Counts & keyof typeof t.tiles; icon: Icon }[] = [
  { key: 'scheduled', icon: CalendarIcon },
  { key: 'dialled', icon: PhoneIcon },
  { key: 'answered', icon: StarIcon },
  { key: 'lettersSent', icon: LetterIcon },
  { key: 'wishes', icon: BellIcon },
  { key: 'giftLinks', icon: GiftIcon },
];

const SMALL: (keyof Counts & keyof typeof t.small)[] = ['missed', 'cutShort', 'cancelled'];

const nf = new Intl.NumberFormat(locale);
const nf1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

function minutesSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.round(total % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Ratios from the counters. A dash when there is nothing to divide by yet. */
export function derived(c: Counts) {
  return {
    avgCall: c.timedCalls ? minutesSeconds(c.talkSeconds / c.timedCalls) : '–',
    answerRate: c.dialled ? t.percent(Math.round((c.answered / c.dialled) * 100)) : '–',
    wishesPerLetter: c.lettersSent ? nf1.format(c.wishes / c.lettersSent) : '–',
    sleighDistance: nf.format(c.lettersSent * t.sleighPerLetter),
    cookies: nf.format(c.wishes),
    elves: nf.format(Math.ceil(c.wishes / 3)),
  };
}
const dayLabel = (day: string) =>
  // Short weekday and day, e.g. "mié 18" or "Wed 18".
  new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));

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
        <p>{error || t.workshopLoading}</p>
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
        {t.workshopTitle}
      </h2>

      <div className="workshop-now">
        <span>
          <ClockIcon className="workshop-now-icon" />
          <strong>{nf.format(stats.pending)}</strong>
          {t.pendingSuffix}
        </span>
        <span>
          <RingingPhoneIcon className="workshop-now-icon" />
          <strong>{nf.format(stats.live)}</strong>
          {t.liveSuffix}
        </span>
      </div>

      <ul className="workshop-tiles">
        {TILES.map(({ key, icon: TileIcon }) => (
          <li key={key} className="workshop-tile">
            <TileIcon className="workshop-tile-icon" />
            <strong className="workshop-num">{nf.format(stats.totals[key])}</strong>
            <span className="workshop-label">{t.tiles[key]}</span>
          </li>
        ))}
      </ul>

      <dl className="workshop-ratios">
        <div>
          <dt>{t.avgCall}</dt>
          <dd>{d.avgCall}</dd>
        </div>
        <div>
          <dt>{t.answerRate}</dt>
          <dd>{d.answerRate}</dd>
        </div>
        <div>
          <dt>{t.wishesPerLetter}</dt>
          <dd>{d.wishesPerLetter}</dd>
        </div>
      </dl>

      <p className="workshop-small muted">
        {SMALL.map((key) => `${nf.format(stats.totals[key])} ${t.small[key]}`).join(' · ')}
      </p>

      <div className="workshop-fun">
        <h3 className="workshop-sub">
          {t.funTitle} <span className="workshop-fun-tag">{t.funTag}</span>
        </h3>
        <ul>
          <li>
            <strong>{d.sleighDistance}</strong>
            {t.sleighSuffix}
          </li>
          <li>
            <strong>{d.cookies}</strong>
            {t.cookiesSuffix}
          </li>
          <li>
            <strong>{d.elves}</strong>
            {t.elvesSuffix}
          </li>
        </ul>
        <p className="workshop-fun-note muted">{t.funNote}</p>
      </div>

      <h3 className="workshop-sub">{t.last7Days}</h3>
      <ol className="workshop-days" aria-label={t.daysChartLabel}>
        {stats.days.map((d) => (
          <li key={d.day} className="workshop-day">
            <span className="workshop-bar-wrap" aria-hidden="true">
              <span className="workshop-bar" style={{ height: pct(d.dialled) }} />
              <span className="workshop-bar letters" style={{ height: pct(d.lettersSent) }} />
            </span>
            <span className="workshop-day-label">{dayLabel(d.day)}</span>
            <span className="visually-hidden">
              {t.dayChartText(d.dialled, d.lettersSent)}
            </span>
          </li>
        ))}
      </ol>
      <p className="workshop-legend muted">
        <span className="dot" /> {t.legendCalls} <span className="dot letters" /> {t.legendLetters}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
