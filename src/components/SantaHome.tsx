// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { useCallback, useEffect, useState } from 'react';
import { client, unwrap, type SantaCall } from '../api.ts';
import { phoneVerificationRequired } from '../config.ts';
import { friendlyError } from '../errors.ts';
import { t } from '../i18n.ts';
import { CallForm } from './CallForm.tsx';
import { CallList } from './CallList.tsx';
import { PhoneVerification } from './PhoneVerification.tsx';
import { Workshop } from './Workshop.tsx';
import { Reindeer } from './illustrations/Reindeer.tsx';
import { Santa } from './illustrations/Santa.tsx';

interface Props {
  email: string;
  onSignOut?: () => void;
}

export function SantaHome({ email, onSignOut }: Props) {
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<SantaCall[]>([]);
  const [skipped, setSkipped] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showWorkshop, setShowWorkshop] = useState(false);

  const loadAttributes = useCallback(async () => {
    const attrs = await fetchUserAttributes();
    setPhone(attrs.phone_number ?? null);
    setPhoneVerified(attrs.phone_number_verified === 'true');
    // Only shows the button; the backend checks the group again.
    const groups = (await fetchAuthSession()).tokens?.idToken?.payload['cognito:groups'];
    setIsAdmin(Array.isArray(groups) && groups.includes('ADMINS'));
  }, []);

  const loadCalls = useCallback(async () => {
    const res = await client.queries.listMyCalls();
    setCalls((unwrap(res) ?? []).filter((c): c is SantaCall => !!c));
  }, []);

  const load = useCallback(
    () =>
      loadAttributes()
        .then(loadCalls)
        .catch((err) => setLoadError(friendlyError(err)))
        .finally(() => setLoading(false)),
    [loadAttributes, loadCalls],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function retry() {
    setLoading(true);
    setLoadError('');
    void load();
  }

  if (loading) {
    // Own centred splash: the header would push the reindeer off-centre for the second or so this shows.
    return (
      <div className="splash" role="status">
        <div className="splash-art">
          <Reindeer className="splash-reindeer" />
          <span className="splash-shadow" />
        </div>
        <p className="splash-text">{t.loadingHome}</p>
        <span className="splash-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
    );
  }

  const verifying = !loadError && !showWorkshop && !phoneVerified && !skipped;

  return (
    <div className={verifying ? 'home narrow' : 'home'}>
      <header className="home-header">
        <div className="home-brand">
          <Santa className="home-santa" />
          <div className="home-title">
            <h1 className="logo">{t.appTitle}</h1>
          </div>
        </div>
        {isAdmin && (
          <button type="button" className="btn ghost small signout" aria-pressed={showWorkshop} onClick={() => setShowWorkshop((v) => !v)}>
            {showWorkshop ? t.back : t.workshop}
          </button>
        )}
        <button type="button" className="btn ghost small signout" onClick={onSignOut}>
          {t.signOut}
        </button>
      </header>

      {loadError ? (
        <div className="card center" role="alert">
          <Reindeer className="loading-reindeer still" />
          <p>{loadError}</p>
          <button type="button" className="btn" onClick={retry}>
            {t.retry}
          </button>
        </div>
      ) : showWorkshop ? (
        <Workshop />
      ) : !phoneVerified && !skipped ? (
        <PhoneVerification
          currentPhone={phone}
          onVerified={loadAttributes}
          onSkip={phoneVerificationRequired ? undefined : () => setSkipped(true)}
        />
      ) : (
        <>
          <CallForm
            email={email}
            verifiedPhone={phoneVerified ? phone : null}
            onScheduled={loadCalls}
            isAdmin={isAdmin}
          />
          <CallList calls={calls} onChanged={loadCalls} />
        </>
      )}
    </div>
  );
}
