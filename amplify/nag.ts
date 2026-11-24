// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Aspects } from 'aws-cdk-lib';
import type { IConstruct } from 'constructs';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';

/**
 * cdk-nag (AWS Solutions rules) at synth time, only when CDK_NAG=true: `npm run nag`.
 * Every accepted finding is listed here with its reason. IAM5 suppressions name the exact wildcard
 * (`appliesTo`), so a new wildcard still fails the check.
 */
export function applyNag(root: IConstruct): void {
  NagSuppressions.addResourceSuppressions(
    root,
    [
      {
        id: 'AwsSolutions-DDB3',
        reason:
          'No point-in-time recovery on purpose. The bookings table holds child data that must be gone once the parents are emailed; PITR would keep it 35 days. The stats table holds only aggregate counters.',
      },
      {
        id: 'AwsSolutions-COG2',
        reason:
          'Sample with admin-created accounts and an SMS-verified phone. MFA is recommended in the README before any wider use.',
      },
      {
        id: 'AwsSolutions-COG8',
        reason: 'Cognito Essentials tier to keep the sample at no extra cost; the README points to the Plus tier threat protection.',
      },
      {
        id: 'AwsSolutions-IAM4',
        reason:
          'AWS managed policies that only write logs: AWSLambdaBasicExecutionRole (each function\'s own log group, attached by Amplify and CDK) and AWSAppSyncPushToCloudWatchLogs (the AppSync logging role Amplify creates).',
        appliesTo: [
          'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSAppSyncPushToCloudWatchLogs',
        ],
      },
      {
        id: 'AwsSolutions-ASC3',
        reason:
          'AppSync logging is on at request level with fieldLogLevel NONE and no verbose content. Field-level logs can include argument values, which here are the child\'s name and the parents\' notes, so they stay off.',
      },
      {
        id: 'AwsSolutions-S1',
        reason: 'Buckets created by Amplify Data for generated GraphQL code and the model schema. No customer data.',
      },
      {
        id: 'AwsSolutions-S10',
        reason: 'Bucket created by Amplify Data for generated GraphQL code. No customer data; not configurable from the backend definition.',
      },
      {
        id: 'AwsSolutions-L1',
        reason: 'The CDK BucketDeployment helper Lambda created by Amplify Data; its runtime is set by aws-cdk-lib. Our own functions use the latest Node.js runtime.',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'Version and alias qualifiers of our own functions (`<fn>.Arn:*`), added by CDK grantInvoke. Same function only.',
        appliesTo: [{ regex: '/^Resource::<[A-Za-z0-9]+\\.Arn>:\\*$/' }],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Global secondary indexes of the bookings table (byOwner, byContact), added by CDK grantReadWriteData.',
        appliesTo: [{ regex: '/^Resource::<Bookings[A-Za-z0-9]+\\.Arn>\\/index\\/\\*$/' }],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'ses:SendEmail on every identity of the account, because in the SES sandbox SES also checks each recipient identity. A ses:FromAddress condition limits sending to the one sender address.',
        appliesTo: ['Resource::arn:<AWS::Partition>:ses:<AWS::Region>:<AWS::AccountId>:identity/*'],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'One-time schedules are created per booking with generated names, inside the sample\'s own schedule group only.',
        appliesTo: [{ regex: '/^Resource::arn:<AWS::Partition>:scheduler:<AWS::Region>:<AWS::AccountId>:schedule\\/santa-calls-[a-z0-9]+\\/\\*$/' }],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'Actions without a resource type: end-user-messaging:ValidateNotifyCodeVerification and sms-voice:DescribeNotifyTemplates (Notify phone verification).',
        appliesTo: ['Resource::*'],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'Contacts are created per call. Scoped to the one Connect instance of the sample (StartOutboundVoiceContact needs the instance and its child resources).',
        appliesTo: [
          { regex: '/^Resource::arn:<AWS::Partition>:connect:<AWS::Region>:<AWS::AccountId>:instance\\/[^/]+\\/\\*$/' },
        ],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'A cross-region inference profile (eu.*) routes to the same foundation model in several Regions, so the model ARN needs a Region wildcard. Limited to the one model.',
        appliesTo: [{ regex: '/^Resource::arn:<AWS::Partition>:bedrock:\\*::foundation-model\\/.+$/' }],
      },
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'Roles that Amplify Data creates itself: AppSync data sources invoking our function, and the CDK BucketDeployment helper that copies generated code to Amplify-managed buckets.',
        appliesTo: [
          'Action::s3:List*',
          'Action::s3:GetObject*',
          'Action::s3:GetBucket*',
          'Action::s3:DeleteObject*',
          'Action::s3:Abort*',
          { regex: '/^Resource::arn:<AWS::Partition>:s3:::cdk-[a-z0-9]+-assets-<AWS::AccountId>-<AWS::Region>\\/\\*$/' },
          { regex: '/^Resource::<[A-Za-z0-9]+Bucket[A-Za-z0-9]+\\.Arn>\\/\\*$/' },
        ],
      },
    ],
    true,
  );
  Aspects.of(root).add(new AwsSolutionsChecks({ verbose: true, reports: true }));
}
