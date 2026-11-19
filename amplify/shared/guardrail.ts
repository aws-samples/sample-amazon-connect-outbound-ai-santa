// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { ApplyGuardrailCommand, BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

export const bedrock = new BedrockRuntimeClient({});

export function guardrailConfig() {
  const id = process.env.GUARDRAIL_ID;
  const version = process.env.GUARDRAIL_VERSION;
  if (!id || !version) throw new Error('GUARDRAIL_ID and GUARDRAIL_VERSION must be set');
  return { guardrailIdentifier: id, guardrailVersion: version };
}

/**
 * Run text through the Bedrock guardrail. Returns `allowed: false` when the guardrail intervened.
 * `output` is the text after masking (for example anonymised addresses), or the original when nothing changed.
 */
export async function checkText(text: string, source: 'INPUT' | 'OUTPUT'): Promise<{ allowed: boolean; output: string }> {
  if (!text.trim()) return { allowed: true, output: text };
  const res = await bedrock.send(
    new ApplyGuardrailCommand({
      ...guardrailConfig(),
      source,
      content: [{ text: { text } }],
    }),
  );
  if (res.action !== 'GUARDRAIL_INTERVENED') return { allowed: true, output: text };
  // When only PII masking happened, the guardrail returns the masked text and no blocked assessment.
  const blocked = (res.assessments ?? []).some(
    (a) =>
      a.contentPolicy?.filters?.some((f) => f.action === 'BLOCKED') ||
      a.topicPolicy?.topics?.some((t) => t.action === 'BLOCKED') ||
      a.wordPolicy?.customWords?.some((w) => w.action === 'BLOCKED') ||
      a.wordPolicy?.managedWordLists?.some((w) => w.action === 'BLOCKED') ||
      a.sensitiveInformationPolicy?.piiEntities?.some((p) => p.action === 'BLOCKED') ||
      a.sensitiveInformationPolicy?.regexes?.some((r) => r.action === 'BLOCKED'),
  );
  const masked = res.outputs?.map((o) => o.text ?? '').join('') || text;
  return { allowed: !blocked, output: masked };
}
