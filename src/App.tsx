// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { t } from './i18n.ts';
import { SantaHome } from './components/SantaHome.tsx';
import { Snow } from './components/Snow.tsx';
import { Elf } from './components/illustrations/Elf.tsx';
import { CalendarIcon, LetterIcon, PhoneIcon, RingingPhoneIcon } from './components/illustrations/Icons.tsx';
import { Santa } from './components/illustrations/Santa.tsx';
import { Village } from './components/illustrations/Village.tsx';

const FLOW_ICONS = [PhoneIcon, CalendarIcon, RingingPhoneIcon, LetterIcon];
const FLOW = t.flow.map((step, i) => ({ ...step, icon: FLOW_ICONS[i] }));

function Welcome() {
  return (
    <section className="welcome">
      <div className="welcome-art">
        <Santa className="welcome-santa" />
        <Elf className="welcome-elf" />
      </div>
      <div className="welcome-text">
        <h1 className="logo">{t.appTitle}</h1>
        <ol className="flow" aria-label={t.howItWorks}>
          {FLOW.map(({ icon: Icon, title, sub }, i) => (
            <li key={title} className="flow-step">
              <span className="flow-badge">
                <Icon className="flow-icon" />
                <span className="flow-num" aria-hidden="true">
                  {i + 1}
                </span>
              </span>
              <strong className="flow-title">{title}</strong>
              <span className="flow-sub">{sub}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const authHeader = () => (
  <div className="auth-header">
    <h2>{t.authHello}</h2>
    <p>{t.authSub}</p>
  </div>
);

function Layout() {
  const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus]);
  const signedIn = authStatus === 'authenticated';
  return (
    <main className={signedIn ? 'page' : 'page auth-layout'}>
      {!signedIn && <Welcome />}
      <div className={signedIn ? 'home-slot' : 'auth-card'}>
        <Authenticator loginMechanisms={['email']} hideSignUp components={{ Header: authHeader }}>
          {({ signOut, user }) => <SantaHome email={user?.signInDetails?.loginId ?? ''} onSignOut={signOut} />}
        </Authenticator>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <div className="app">
      <Snow />
      <Authenticator.Provider>
        <Layout />
      </Authenticator.Provider>
      <Village className="village" />
      <footer className="footer">{t.footer}</footer>
    </div>
  );
}
