// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useEffect, useState, type ComponentType } from 'react';
import { client, unwrap, type SantaCall } from '../api.ts';
import { friendlyError } from '../errors.ts';
import { countdownLabel, formatCallWhen } from '../format.ts';
import { BellIcon, LetterIcon, PhoneIcon, StarIcon } from './illustrations/Icons.tsx';
import { Reindeer } from './illustrations/Reindeer.tsx';

type Icon = ComponentType<{ className?: string }>;

const STATUS: Record<string, { label: string; icon: Icon }> = {
  CALLING: { label: 'Santa está marcando…', icon: PhoneIcon },
  IN_CALL: { label: '¡Hablando con Santa!', icon: StarIcon },
  NO_RESPONSE: { label: 'Santa lo volverá a intentar', icon: PhoneIcon },
  DELIVERED: { label: 'La carta va volando a tu email', icon: LetterIcon },
};
const UNKNOWN = { label: 'Los elfos están en ello', icon: StarIcon };

/** While a call is under way the status changes on its own, so refresh in the background. */
const LIVE = new Set(['CALLING', 'IN_CALL', 'NO_RESPONSE', 'DELIVERED']);
const POLL_MS = 20_000;

interface Props {
  calls: SantaCall[];
  onChanged: () => Promise<void>;
}

export function CallList({ calls, onChanged }: Props) {
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const live = calls.some((c) => LIVE.has(c.status));
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => void onChanged().catch(() => undefined), POLL_MS);
    return () => clearInterval(id);
  }, [live, onChanged]);

  async function cancel(bookingId: string) {
    setError('');
    setCancelling(bookingId);
    try {
      unwrap(await client.mutations.cancelCall({ bookingId }));
      await onChanged();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setCancelling(null);
      setConfirming(null);
    }
  }

  if (!calls.length) {
    return (
      <section className="card empty">
        <Reindeer className="empty-reindeer" />
        <p>
          <strong>Todavía no has avisado a Santa.</strong>
          <br />
          <span className="muted">Rellena la carta y el reno le llevará el recado.</span>
        </p>
      </section>
    );
  }

  return (
    <section className={open ? 'card calls-card open' : 'card calls-card'}>
      <h2 className="card-title">
        <button
          type="button"
          className="calls-toggle"
          aria-expanded={open}
          aria-controls="calls-list"
          onClick={() => setOpen((o) => !o)}
        >
          <BellIcon className="title-icon" />
          <span className="calls-toggle-text">{open ? 'Ocultar llamadas agendadas' : 'Ver llamadas agendadas'}</span>
          <span className="calls-count" aria-label={`${calls.length} ${calls.length === 1 ? 'llamada' : 'llamadas'}`}>
            {calls.length}
          </span>
          <svg className="calls-chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h2>
      <div className="card-scroll" id="calls-list" hidden={!open}>
        <ul className="calls">
          {calls.map((c) => {
            const status = STATUS[c.status] ?? UNKNOWN;
            const StatusIcon = status.icon;
            const countdown = c.status === 'SCHEDULED' ? countdownLabel(c.callDate) : '';
            return (
              <li key={c.bookingId}>
                <div className="call-main">
                  <strong className="break">{c.childName}</strong>
                  <div className="muted">{formatCallWhen(c.callDate, c.callTime)}</div>
                  {countdown && <div className="countdown">{countdown}</div>}
                </div>
                {/* A scheduled call already shows its countdown, so it gets no status badge. */}
                {c.status !== 'SCHEDULED' && (
                  <span className={`badge badge-${c.status.toLowerCase()}`}>
                    <StatusIcon className="badge-icon" />
                    {status.label}
                  </span>
                )}
                {c.status === 'SCHEDULED' &&
                  (confirming === c.bookingId ? (
                    <span className="confirm" role="group" aria-label={`¿Cancelar la llamada de ${c.childName}?`}>
                      <span className="confirm-q">¿Cancelar?</span>
                      <button
                        type="button"
                        className="btn small"
                        disabled={cancelling === c.bookingId}
                        onClick={() => cancel(c.bookingId)}
                      >
                        {cancelling === c.bookingId ? 'Cancelando…' : 'Sí, cancelar'}
                      </button>
                      <button type="button" className="btn ghost small" onClick={() => setConfirming(null)}>
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn ghost small"
                      aria-label={`Cancelar la llamada de ${c.childName}`}
                      onClick={() => setConfirming(c.bookingId)}
                    >
                      Cancelar
                    </button>
                  ))}
              </li>
            );
          })}
        </ul>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
