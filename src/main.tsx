// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Amplify } from 'aws-amplify';
import { I18n } from 'aws-amplify/utils';
import { translations } from '@aws-amplify/ui-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import outputs from '../amplify_outputs.json';
import App from './App.tsx';
// Fonts are bundled with the app so no visitor data goes to a third-party font CDN.
import '@fontsource/mountains-of-christmas/700.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@aws-amplify/ui-react/styles.css';
import './index.css';

Amplify.configure(outputs);
I18n.putVocabularies(translations);
I18n.setLanguage('es');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
