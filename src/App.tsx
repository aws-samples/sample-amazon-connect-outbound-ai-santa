// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { SantaHome } from './components/SantaHome.tsx';
import { Snow } from './components/Snow.tsx';
import { Elf } from './components/illustrations/Elf.tsx';
import { CalendarIcon, LetterIcon, PhoneIcon, RingingPhoneIcon } from './components/illustrations/Icons.tsx';
import { Santa } from './components/illustrations/Santa.tsx';
import { Village } from './components/illustrations/Village.tsx';

const FLOW = [
  { icon: PhoneIcon, title: 'Verifica tu móvil', sub: 'Te llega un código por SMS' },
  { icon: CalendarIcon, title: 'Elige día y hora', sub: 'Y cuéntale a Santa algo de tu peque' },
  { icon: RingingPhoneIcon, title: 'Santa llama', sub: 'Charla con tu peque en español' },
  { icon: LetterIcon, title: 'Recibe la carta', sub: 'Con sus deseos, en tu email' },
];

function Welcome() {
  return (
    <section className="welcome">
      <div className="welcome-art">
        <Santa className="welcome-santa" />
        <Elf className="welcome-elf" />
      </div>
      <div className="welcome-text">
        <h1 className="logo">Llamada de Santa</h1>
        <ol className="flow" aria-label="Cómo funciona">
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
    <h2>¡Hola, familia!</h2>
    <p>Entra con tu cuenta para avisar a Santa</p>
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
      <footer className="footer">Demo con Amazon Connect · Santa no graba las llamadas</footer>
    </div>
  );
}
