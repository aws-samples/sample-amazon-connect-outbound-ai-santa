#!/usr/bin/env bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
# Creates the two AWS End User Messaging Notify resources that send and validate the phone
# verification SMS, then prints the lines to add to .env. Run it once per account and Region.
# Usage: AWS_PROFILE=<profile> npm run notify:setup [-- "<display name>"]
#
# The display name appears in the SMS ("Tu código de verificación <name> es: 123456"). It is
# reviewed automatically: generic names (e.g. "Santa") can stay in REQUIRES_VERIFICATION, which
# needs a support case. Use a distinctive name of up to 15 letters, digits, spaces, _ or -.
set -euo pipefail

REGION="${AWS_REGION:-eu-central-1}"
DISPLAY_NAME="${1:-Llamada Santa}"
TEMPLATE="${NOTIFY_TEMPLATE_ID:-notify-code-verification-spanish-005}"
CODE_CONFIG_NAME="${NOTIFY_CODE_CONFIG_NAME:-santa-phone-verify}"

if ! aws endusermessaging help > /dev/null 2>&1; then
  echo "Your AWS CLI has no 'endusermessaging' commands. Update it (2.40 or later) and try again." >&2
  exit 1
fi

echo "Creating the Notify configuration \"$DISPLAY_NAME\" (Spain, SMS) in $REGION..."
config_id="$(aws pinpoint-sms-voice-v2 create-notify-configuration --region "$REGION" \
  --display-name "$DISPLAY_NAME" --use-case CODE_VERIFICATION \
  --enabled-countries ES --enabled-channels SMS --default-template-id "$TEMPLATE" \
  --tags Key=Project,Value=santa-call-center \
  --query NotifyConfigurationId --output text)"

status=PENDING
for _ in $(seq 1 12); do
  status="$(aws pinpoint-sms-voice-v2 describe-notify-configurations --region "$REGION" \
    --notify-configuration-ids "$config_id" --query 'NotifyConfigurations[0].Status' --output text)"
  [ "$status" != PENDING ] && break
  sleep 5
done
if [ "$status" != ACTIVE ]; then
  echo "The configuration $config_id is $status, not ACTIVE." >&2
  echo "Delete it (aws pinpoint-sms-voice-v2 delete-notify-configuration --notify-configuration-id $config_id)" >&2
  echo "and try another display name, or open a support case to verify the brand name." >&2
  exit 1
fi
config_arn="$(aws pinpoint-sms-voice-v2 describe-notify-configurations --region "$REGION" \
  --notify-configuration-ids "$config_id" --query 'NotifyConfigurations[0].NotifyConfigurationArn' --output text)"

echo "Creating the code configuration (6 digits, valid 10 minutes, 5 attempts)..."
code_config_id="$(aws endusermessaging create-notify-code-configuration --region "$REGION" \
  --notify-code-configuration-name "$CODE_CONFIG_NAME" \
  --code-configuration-parameters codeType=NUMERIC,codeLength=6,validityPeriodMinutes=10,maxAttempts=5 \
  --channel-parameters "notify={notifyTemplateId=$TEMPLATE}" \
  --tags key=Project,value=santa-call-center \
  --query notifyCodeConfiguration.notifyCodeConfigurationId --output text)"

cat <<EOF

Done. Add these lines to .env and redeploy (npm run sandbox):

NOTIFY_CONFIGURATION_ARN=$config_arn
NOTIFY_CODE_CONFIGURATION_ID=$code_config_id
EOF
