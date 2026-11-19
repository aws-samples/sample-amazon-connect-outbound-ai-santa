// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { deleteBooking, getBooking } from '../../shared/bookings.js';
import { giftLinksFromEnv, sendEmail, wishlistEmail } from '../../shared/email.js';
import { bedrock, checkText, guardrailConfig } from '../../shared/guardrail.js';
import { msg } from '../../shared/i18n.js';
import { bumpStats } from '../../shared/stats.js';

/** Keep only wishes the guardrail allows, with PII masked. */
export async function screenWishes(wishes: string[]): Promise<string[]> {
  if (!wishes.length) return [];
  const all = await checkText(wishes.join('\n'), 'OUTPUT');
  if (all.allowed) return all.output.split('\n').map((w) => w.trim()).filter(Boolean);
  const kept: string[] = [];
  for (const w of wishes) {
    const r = await checkText(w, 'OUTPUT');
    if (r.allowed) kept.push(r.output.trim());
  }
  return kept;
}

export function fallbackLetter(childName: string): string[] {
  return msg().fallbackLetter(childName);
}

export async function writeLetter(childName: string, behaviour: string, summary: string, wishes: string[]): Promise<string[]> {
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId) return fallbackLetter(childName);
  const data = msg().letterData(childName, behaviour, summary, wishes);
  try {
    const res = await bedrock.send(
      new ConverseCommand({
        modelId,
        system: [{ text: msg().letterSystemPrompt }],
        messages: [{ role: 'user', content: [{ text: data }] }],
        inferenceConfig: { maxTokens: 400, temperature: 0.7 },
        guardrailConfig: guardrailConfig(),
      }),
    );
    if (res.stopReason === 'guardrail_intervened') return fallbackLetter(childName);
    const text = res.output?.message?.content?.map((c) => c.text ?? '').join('').trim();
    const paragraphs = (text ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).slice(0, 3);
    return paragraphs.length ? paragraphs : fallbackLetter(childName);
  } catch (err) {
    console.error('letter generation failed, using fallback', { error: (err as Error).name });
    return fallbackLetter(childName);
  }
}

export const handler = async (event: { bookingId?: string }) => {
  if (!event.bookingId) return;
  const booking = await getBooking(event.bookingId);
  if (!booking || booking.status !== 'DELIVERED') return;

  const wishes = await screenWishes(booking.wishes ?? []);
  const letter = await writeLetter(booking.childName, booking.behaviour ?? '', booking.summary ?? '', wishes);
  const links = giftLinksFromEnv();
  await sendEmail(booking.parentEmail, wishlistEmail(booking.childName, letter, wishes, links));
  await bumpStats({ lettersSent: 1, wishes: wishes.length, giftLinks: links ? wishes.length : 0 });
  // GDPR: nothing about the child is kept once the parent has the letter.
  await deleteBooking(booking.bookingId);
  console.log('letter sent and booking deleted', { bookingId: booking.bookingId, wishes: wishes.length });
};
