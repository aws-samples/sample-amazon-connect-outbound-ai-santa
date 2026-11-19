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
  formatTime,
  lastCallDay,
  zoneCity,
} from '../format.ts';
import { allowedPhonePrefixes, santaCallerNumber } from '../config.ts';
import { t } from '../i18n.ts';
import { formatNationalNumber, formatPhone, isValidPhone } from '../phone.ts';
import { DatePicker } from './DatePicker.tsx';
import { PhoneInput } from './PhoneInput.tsx';
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
          {t.celebrationTitle(scheduled.childName)}
        </h2>
        <p className="celebration-when">{t.celebrationWhen(scheduled.when)}</p>
        <button type="button" className="btn ghost" onClick={onAnother}>
          {t.scheduleAnother}
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
      <summary>{t.tipsTitle}</summary>
      <ul>
        {santaCallerNumber ? (
          <li>
            {t.tipCaller[0]}
            <strong>{formatNationalNumber(santaCallerNumber)}</strong>
            {t.tipCaller[1]}
          </li>
        ) : (
          <li>{t.tipUnknownCaller}</li>
        )}
        {t.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
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
  const [prefix, setPrefix] = useState(allowedPhonePrefixes[0]);
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
    const phoneNumber = verifiedPhone ? undefined : `${prefix}${digits}`;
    if (phoneNumber && !isValidPhone(phoneNumber, allowedPhonePrefixes)) {
      setPhoneError(t.phoneInvalid(prefix));
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
        {t.formTitle}
      </h2>
      <div className="card-scroll">
        <form onSubmit={submit} className="form">
          <label>
            {t.childNameLabel}
            <input
              name="childName"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              maxLength={40}
              required
              autoComplete="off"
              spellCheck={false}
              placeholder={t.childNamePlaceholder}
            />
          </label>

          <label>
            <span className="label-row">
              {t.notesLabel}
              <small className="muted char-count">{t.notesCount(notes.length, NOTES_MAX)}</small>
            </span>
            <textarea
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
              rows={3}
              autoComplete="off"
              aria-describedby="notes-hint"
              placeholder={t.notesPlaceholder}
            />
            <small id="notes-hint" className="muted">
              {t.notesHint}
            </small>
          </label>

          <div className="row">
            <div className="field day-field">
              <span id="call-date-label">{t.dayLabel}</span>
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
              {t.timeLabel(zoneCity())}
              <span className="picker">
                <ClockIcon className="picker-icon" />
                <select
                  name="callTime"
                  value={callTime}
                  onChange={(e) => setCallTime(e.target.value)}
                  aria-describedby="time-hint"
                  required
                >
                  {slots.map((slot) => (
                    <option key={slot} value={slot}>
                      {formatTime(slot)}
                    </option>
                  ))}
                </select>
                <Chevron />
              </span>
            </label>
          </div>
          <small id="time-hint" className="muted hint-tight">
            {seasonOver
              ? t.seasonOver
              : t.callWindowHint(formatTime(CALL_WINDOW_START), formatTime(CALL_WINDOW_END))}
          </small>

          {!verifiedPhone && (
            <label>
              {t.phoneLabel}
              <PhoneInput
                prefix={prefix}
                onPrefixChange={setPrefix}
                digits={digits}
                onDigitsChange={setDigits}
                inputRef={phoneRef}
                invalid={!!phoneError}
                describedBy={phoneError ? 'phone-error' : undefined}
              />
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
                {t.santaWillCall[0]}
                <strong>{formatPhone(verifiedPhone)}</strong>
                {t.santaWillCall[1]}
                <br />
              </>
            )}
            {t.letterGoesTo[0]}
            <strong className="break">{email}</strong>
            {t.letterGoesTo[1]}
          </p>

          <Tips />

          <button type="submit" className="btn big" disabled={busy || seasonOver}>
            {busy ? t.notifyingElves : t.submit}
          </button>
          {isAdmin && (
            <button type="submit" className="btn ghost quick-test" data-quick="true" disabled={busy}>
              {t.quickTest}
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
