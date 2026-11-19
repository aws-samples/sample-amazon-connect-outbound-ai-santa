// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useState, type FormEvent } from 'react';
import { client, unwrap } from '../api.ts';
import { friendlyError } from '../errors.ts';
import { allowedPhonePrefixes } from '../config.ts';
import { t } from '../i18n.ts';
import { formatPhone, isValidPhone, splitPhone } from '../phone.ts';
import { PhoneIcon } from './illustrations/Icons.tsx';
import { PhoneInput } from './PhoneInput.tsx';

interface Props {
  currentPhone: string | null;
  onVerified: () => Promise<void>;
  /** Shown only when the backend allows unverified numbers. */
  onSkip?: () => void;
}

export function PhoneVerification({ currentPhone, onVerified, onSkip }: Props) {
  const [initial] = useState(() => splitPhone(currentPhone, allowedPhonePrefixes));
  const [prefix, setPrefix] = useState(initial.prefix);
  const [digits, setDigits] = useState(initial.digits);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const phone = `${prefix}${digits.replace(/\D/g, '')}`;

  /** The backend sends the code with AWS End User Messaging Notify and only saves the phone once the code is valid. */
  async function requestCode() {
    unwrap(await client.mutations.sendPhoneCode({ phoneNumber: phone }));
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!isValidPhone(phone, allowedPhonePrefixes)) {
      setError(t.phoneInvalid(prefix));
      return;
    }
    setBusy(true);
    try {
      await requestCode();
      setCodeSent(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await requestCode();
      setNotice(t.newCodeSent);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      unwrap(await client.mutations.verifyPhoneCode({ phoneNumber: phone, code: code.trim() }));
      await onVerified();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card verify">
      <div className="card-scroll">
        <div className="verify-badge" aria-hidden="true">
          <PhoneIcon className="verify-icon" />
        </div>
        <h2 className="verify-title">{codeSent ? t.verifyTitleCode : t.verifyTitle}</h2>
        <p className="verify-text">
          {codeSent ? (
            <>
              {t.verifySentTo[0]}
              <strong>{formatPhone(phone)}</strong>
              {t.verifySentTo[1]}
            </>
          ) : (
            t.verifyIntro
          )}
        </p>
        {!codeSent ? (
          <form onSubmit={sendCode} className="form verify-form">
            <label className="verify-field">
              <span className="verify-label">{t.phoneLabel}</span>
              <PhoneInput
                className="verify-phone"
                prefix={prefix}
                onPrefixChange={setPrefix}
                digits={digits}
                onDigitsChange={setDigits}
              />
            </label>
            <button type="submit" className="btn block" disabled={busy}>
              {busy ? t.sending : t.sendCode}
            </button>
            {onSkip && (
              <button type="button" className="btn link" onClick={onSkip}>
                {t.skipStep}
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={confirm} className="form verify-form">
            <label className="verify-field">
              <span className="verify-label">{t.codeLabel}</span>
              <input
                className="code-input"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                required
              />
            </label>
            <button type="submit" className="btn block" disabled={busy}>
              {busy ? t.checking : t.verify}
            </button>
            <div className="verify-links">
              <button type="button" className="btn link" disabled={busy} onClick={resend}>
                {t.resendCode}
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" className="btn link" onClick={() => setCodeSent(false)}>
                {t.changeNumber}
              </button>
            </div>
          </form>
        )}
        <div aria-live="polite" className="verify-messages">
          {notice && <p className="success">{notice}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </section>
  );
}
