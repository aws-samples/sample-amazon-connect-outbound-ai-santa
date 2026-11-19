// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineAuth } from '@aws-amplify/backend';
import { cognitoCodeEmail } from '../shared/email.js';
import { msg } from '../shared/i18n.js';
import { preSignUp } from './pre-sign-up/resource.js';

export const auth = defineAuth({
  loginWith: {
    email: {
      // Synth time: the language comes from SANTA_LANGUAGE in .env.
      verificationEmailSubject: msg().codeSubject,
      // Same design as the letter to the parents.
      verificationEmailBody: (code: () => string) => cognitoCodeEmail(code()),
    },
  },
  userAttributes: {
    // Verified by SMS code from the app before any call can be scheduled.
    phoneNumber: { required: false, mutable: true },
  },
  // Admins see the aggregate numbers in Santa's workshop. Add users to the group in the Cognito console.
  groups: ['ADMINS'],
  triggers: { preSignUp },
});
