// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useState, type FormEvent } from 'react';
import { client, unwrap } from '../api.ts';
import { friendlyError } from '../errors.ts';
import { formatPhone } from '../format.ts';
import { PhoneIcon } from './illustrations/Icons.tsx';

interface Props {
  currentPhone: string | null;
  onVerified: () => Promise<void>;
  /** Shown only when the backend allows unverified numbers. */
  onSkip?: () => void;
}

const PREFIX = '+34';

export function PhoneVerification({ currentPhone, onVerified, onSkip }: Props) {
  const [digits, setDigits] = useState(currentPhone?.startsWith(PREFIX) ? currentPhone.slice(PREFIX.length) : '');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const phone = `${PREFIX}${digits.replace(/\D/g, '')}`;

  /** The backend sends the code with AWS End User Messaging Notify and only saves the phone once the code is valid. */
  async function requestCode() {
    unwrap(await client.mutations.sendPhoneCode({ phoneNumber: phone }));
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!/^\+34[67]\d{8}$/.test(phone)) {
      setError('Escribe un móvil español de 9 cifras que empiece por 6 o 7.');
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
      setNotice('Te hemos enviado un código nuevo.');
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
        <h2 className="verify-title">{codeSent ? 'Escribe el código' : 'Primero, verifica tu móvil'}</h2>
        <p className="verify-text">
          {codeSent ? (
            <>
              Te lo hemos enviado por SMS al <strong>{formatPhone(phone)}</strong>.
            </>
          ) : (
            'Santa solo llama a números verificados. Te enviaremos un código por SMS.'
          )}
        </p>
        {!codeSent ? (
          <form onSubmit={sendCode} className="form verify-form">
            <label className="verify-field">
              <span className="verify-label">Móvil al que llamará Santa</span>
              <div className="phone-input verify-phone">
                <span>{PREFIX}</span>
                <input
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={9}
                  value={digits}
                  onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))}
                  placeholder="600123456"
                  required
                />
              </div>
            </label>
            <button type="submit" className="btn block" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar código SMS'}
            </button>
            {onSkip && (
              <button type="button" className="btn link" onClick={onSkip}>
                Saltar este paso
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={confirm} className="form verify-form">
            <label className="verify-field">
              <span className="verify-label">Código de 6 cifras</span>
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
              {busy ? 'Comprobando…' : 'Verificar'}
            </button>
            <div className="verify-links">
              <button type="button" className="btn link" disabled={busy} onClick={resend}>
                Reenviar código
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" className="btn link" onClick={() => setCodeSent(false)}>
                Cambiar número
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
