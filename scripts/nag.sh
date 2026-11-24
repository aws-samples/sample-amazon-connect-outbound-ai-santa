#!/usr/bin/env sh
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
# Synthesize the backend with cdk-nag (AWS Solutions rules) and fail on any unsuppressed finding.
# Needs no AWS credentials: placeholder IDs are used when .env does not set them. Reports: cdk.out/*NagReport.csv
set -eu
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091 # .env and .env.example are sourced on purpose
if [ -f .env ]; then set -a; . ./.env; set +a; else set -a; . ./.env.example; set +a; fi
: "${CONNECT_INSTANCE_ID:=11111111-1111-4111-8111-aaaaaaaaaaa0}"
: "${CONNECT_CONTACT_FLOW_ID:=11111111-1111-4111-8111-aaaaaaaaaaa1}"
: "${SANTA_SENDER_EMAIL:=santa@example.com}"
: "${CONNECT_SOURCE_PHONE_NUMBER:=+34900000000}"
: "${NOTIFY_CONFIGURATION_ARN:=arn:aws:sms-voice:eu-central-1:111111111111:notify-configuration/notify-example}"
: "${NOTIFY_CODE_CONFIGURATION_ID:=code-example}"
export CONNECT_INSTANCE_ID CONNECT_CONTACT_FLOW_ID SANTA_SENDER_EMAIL CONNECT_SOURCE_PHONE_NUMBER \
  NOTIFY_CONFIGURATION_ARN NOTIFY_CODE_CONFIGURATION_ID
export CDK_NAG=true CDK_DEFAULT_ACCOUNT="${CDK_DEFAULT_ACCOUNT:-111111111111}" CDK_DEFAULT_REGION="${CDK_DEFAULT_REGION:-eu-central-1}"
npx --no-install cdk synth --app "npx --no-install tsx amplify/backend.ts" -o cdk.out -q \
  -c amplify-backend-namespace=santacallcenter -c amplify-backend-name=nag -c amplify-backend-type=sandbox
echo "cdk-nag: no unsuppressed findings. Reports in cdk.out/*NagReport.csv"
