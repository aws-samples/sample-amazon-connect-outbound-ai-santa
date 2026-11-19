// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { client, unwrap } from '../api.ts';
import { friendlyError } from '../errors.ts';
import {
  CALL_WINDOW_END,
  CALL_WINDOW_START,
  callTimeSlots,
  defaultCallSlot,
  firstCallDay,
  formatCallWhen,
  formatNationalNumber,
  formatPhone,
  lastCallDay,
} from '../format.ts';
import { santaCallerNumber } from '../config.ts';
import { DatePicker } from './DatePicker.tsx';
import { ClockIcon, LetterIcon, StarIcon } from './illustrations/Icons.tsx';
import { Elf } from './illustrations/Elf.tsx';

interface Props {
  email: string;
  /** SMS-verified number. When null, the parent types the number in the form. */
  verifiedPhone: string | null;
  onScheduled: () => Promise<void>;
  /** Admins get a button that calls one minute from now, for quick tests. */
  isAdmin?: boolean;
}

const PREFIX = '+34';

const NOTES_MAX = 300;

interface Scheduled {
  childName: string;
  when: string;
}

function Celebration({ scheduled, onAnother }: { scheduled: Scheduled; onAnother: () => void }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titleRef.current?.focus(), []);
  return (
    <section className="card celebration" aria-live="polite">
      {/* Scrolls inside the card when the page is short, like the form, so the button never spills out. */}
      <div className="card-scroll">
        <div className="celebration-art" aria-hidden="true">
          <Elf className="celebration-elf" />
          {Array.from({ length: 7 }, (_, i) => (
            <StarIcon key={i} className={`burst burst-${i}`} />
          ))}
        </div>
        <h2 className="celebration-title" ref={titleRef} tabIndex={-1}>
          ¡Santa ya ha apuntado a {scheduled.childName} en su lista!
        </h2>
        <p className="celebration-when">Llamará el {scheduled.when}.</p>
        <button type="button" className="btn ghost" onClick={onAnother}>
          Agendar otra llamada
        </button>
      </div>
    </section>
  );
}

function Chevron() {
  return (
    <svg className="picker-chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Tips() {
  return (
    <details className="tips">
      <summary>Cómo preparar a tu peque</summary>
      <ul>
        {santaCallerNumber ? (
          <li>
            Santa llamará desde el <strong>{formatNationalNumber(santaCallerNumber)}</strong>. Guárdalo en la agenda
            como «Santa» para que salga su nombre cuando suene.
          </li>
        ) : (
          <li>Santa llamará desde un número que no tienes en la agenda. ¡Cógelo!</li>
        )}
        <li>Pon el altavoz para escucharlo juntos.</li>
        <li>Deja que hable tu peque: Santa le preguntará qué quiere pedir.</li>
        <li>Si nadie contesta, Santa lo volverá a intentar un poco más tarde.</li>
        <li>Al colgar, recibirás su carta de deseos por email.</li>
      </ul>
    </details>
  );
}

export function CallForm({ email, verifiedPhone, onScheduled, isAdmin = false }: Props) {
  const [initial] = useState(() => {
    // 18:00 today or tomorrow, but never after 24 December (late on the 24th, its first free slot).
    const slot = defaultCallSlot();
    const last = lastCallDay();
    if (slot.date <= last) return slot;
    return { date: last, time: callTimeSlots(last)[0] ?? slot.time };
  });
  const [childName, setChildName] = useState('');
  const [notes, setNotes] = useState('');
  const [callDate, setCallDate] = useState(initial.date);
  const [callTime, setCallTime] = useState(initial.time);
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [scheduled, setScheduled] = useState<Scheduled | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  // Only days and times Santa can still call; recomputed on each render so they follow the clock.
  const firstDay = firstCallDay();
  const lastDay = lastCallDay();
  // Late on 24 December there is nothing left to book until next season.
  const seasonOver = firstDay > lastDay;
  const slots = callTimeSlots(callDate);

  function pickDate(date: string) {
    setCallDate(date);
    const available = callTimeSlots(date);
    if (!available.includes(callTime)) setCallTime(available.includes('18:00') ? '18:00' : (available[0] ?? callTime));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    // The quick test button is a submit button too, so the browser still checks the required fields.
    const inOneMinute = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-quick') === 'true';
    setError('');
    setPhoneError('');
    const phoneNumber = verifiedPhone ? undefined : `${PREFIX}${digits}`;
    if (phoneNumber && !/^\+34[67]\d{8}$/.test(phoneNumber)) {
      setPhoneError('Escribe un móvil español de 9 cifras que empiece por 6 o 7.');
      phoneRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const call = unwrap(await client.mutations.scheduleCall({ childName, notes, callDate, callTime, phoneNumber, inOneMinute }));
      setScheduled({
        childName: call?.childName ?? childName,
        when: formatCallWhen(call?.callDate ?? callDate, call?.callTime ?? callTime),
      });
      setChildName('');
      setNotes('');
      await onScheduled();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (scheduled) return <Celebration scheduled={scheduled} onAnother={() => setScheduled(null)} />;

  return (
    <section className="card letter">
      <h2 className="card-title">
        <LetterIcon className="title-icon" />
        Pide la llamada de Santa
      </h2>
      <div className="card-scroll">
        <form onSubmit={submit} className="form">
          <label>
            Nombre del peque
            <input
              name="childName"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              maxLength={40}
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="Por ejemplo, Lucía…"
            />
          </label>

          <label>
            <span className="label-row">
              Cosas que Santa sabe
              <small className="muted char-count">
                (opcional, {notes.length}/{NOTES_MAX})
              </small>
            </span>
            <textarea
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
              rows={3}
              autoComplete="off"
              aria-describedby="notes-hint"
              placeholder="Le encantan los dinosaurios y este año ha aprendido a montar en bici…"
            />
            <small id="notes-hint" className="muted">
              Santa lo usará en la conversación. No incluyas apellidos, dirección ni colegio.
            </small>
          </label>

          <div className="row">
            <div className="field day-field">
              <span id="call-date-label">Día</span>
              <span className="picker">
                <DatePicker
                  value={callDate}
                  min={firstDay}
                  max={lastDay}
                  onChange={pickDate}
                  labelledBy="call-date-label"
                />
              </span>
            </div>
            <label className="time-field">
              Hora (Madrid)
              <span className="picker">
                <ClockIcon className="picker-icon" />
                <select
                  name="callTime"
                  value={callTime}
                  onChange={(e) => setCallTime(e.target.value)}
                  aria-describedby="time-hint"
                  required
                >
                  {slots.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <Chevron />
              </span>
            </label>
          </div>
          <small id="time-hint" className="muted hint-tight">
            {seasonOver
              ? 'Santa ya ha hecho todas sus llamadas de este año. ¡Vuelve en diciembre!'
              : `Santa llama hasta el 24 de diciembre, entre las ${CALL_WINDOW_START} y las ${CALL_WINDOW_END}.`}
          </small>

          {!verifiedPhone && (
            <label>
              Móvil al que llamará Santa
              <div className="phone-input">
                <span>{PREFIX}</span>
                <input
                  ref={phoneRef}
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={9}
                  value={digits}
                  onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))}
                  placeholder="600123456"
                  aria-invalid={phoneError ? true : undefined}
                  aria-describedby={phoneError ? 'phone-error' : undefined}
                  required
                />
              </div>
              {phoneError && (
                <span id="phone-error" className="field-error" role="alert">
                  {phoneError}
                </span>
              )}
            </label>
          )}

          <p className="send-info">
            {verifiedPhone && (
              <>
                Santa llamará a <strong>{formatPhone(verifiedPhone)}</strong>
                <br />
              </>
            )}
            La carta llegará a <strong className="break">{email}</strong>
          </p>

          <Tips />

          <button type="submit" className="btn big" disabled={busy || seasonOver}>
            {busy ? 'Avisando a los elfos…' : '¡Que llame Santa!'}
          </button>
          {isAdmin && (
            <button type="submit" className="btn ghost quick-test" data-quick="true" disabled={busy}>
              Prueba: llamar en 1 minuto
            </button>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
