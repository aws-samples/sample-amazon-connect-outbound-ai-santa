#!/usr/bin/env bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
# Copies ELEVENLABS_API_KEY from .env.local into the Secrets Manager secret that Amazon Connect
# reads for the ElevenLabs voice. The key never appears on a command line or in the output.
# Usage: AWS_PROFILE=<profile> npm run elevenlabs:secret   (Region: AWS_REGION, else the one in .env)
set -euo pipefail

SECRET_ID="santa-call-center/elevenlabs-api-key"

# The secret lives in the Region of the stack: AWS_REGION from the environment, else from .env.
if [ -z "${AWS_REGION:-}" ] && [ -f .env ]; then
  AWS_REGION="$(sed -n 's/^AWS_REGION=//p' .env | tail -n 1)"
fi
if [ -z "${AWS_REGION:-}" ]; then
  echo "Set AWS_REGION (environment or .env) to the Region of your deployment." >&2
  exit 1
fi
REGION="$AWS_REGION"

if [ ! -f .env.local ]; then
  echo "No .env.local: put ELEVENLABS_API_KEY=<key> in .env.local first." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
. ./.env.local
set +a
if [ -z "${ELEVENLABS_API_KEY:-}" ]; then
  echo "ELEVENLABS_API_KEY is not set in .env.local" >&2
  exit 1
fi

umask 077
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
# The JSON form lets you add "apiTokenRegion" later (us, eu, in) if your ElevenLabs plan has data residency.
ELEVENLABS_API_KEY="$ELEVENLABS_API_KEY" node -e \
  'process.stdout.write(JSON.stringify({ apiToken: process.env.ELEVENLABS_API_KEY }))' > "$tmp"

aws secretsmanager put-secret-value --region "$REGION" --secret-id "$SECRET_ID" \
  --secret-string "file://$tmp" --query 'VersionId' --output text > /dev/null
echo "Secret $SECRET_ID updated."
