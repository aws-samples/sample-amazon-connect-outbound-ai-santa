// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineAuth } from '@aws-amplify/backend';
import { preSignUp } from './pre-sign-up/resource.js';

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailSubject: 'Tu código para hablar con Santa',
      verificationEmailBody: (code: () => string) => `Tu código de verificación es ${code()}`,
    },
  },
  userAttributes: {
    // Verified by SMS code from the app before any call can be scheduled.
    phoneNumber: { required: false, mutable: true },
  },
  // Admins see the aggregate numbers in "El taller de Santa". Add users to the group in the Cognito console.
  groups: ['ADMINS'],
  triggers: { preSignUp },
});
