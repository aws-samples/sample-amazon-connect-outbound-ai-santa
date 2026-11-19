// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { LOGO_PNG_BASE64 } from './email-logo.js';

export const ses = new SESv2Client({});

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

/** Where gift links point. `domain` is an Amazon store (amazon.es); `tag` is an optional Associates tracking ID. */
export interface GiftLinks {
  domain: string;
  tag?: string;
}

const STORE_DOMAIN = /^amazon\.[a-z]{2,3}(\.[a-z]{2})?$/;
const ASSOCIATE_TAG = /^[A-Za-z0-9-]{1,64}$/;

/** Gift link settings from the environment, or undefined when links are off or the values are invalid. */
export function giftLinksFromEnv(env: NodeJS.ProcessEnv = process.env): GiftLinks | undefined {
  const domain = env.GIFT_LINKS_DOMAIN?.trim() ?? '';
  if (!STORE_DOMAIN.test(domain)) return undefined;
  const tag = env.AMAZON_ASSOCIATE_TAG?.trim();
  return { domain, tag: tag && ASSOCIATE_TAG.test(tag) ? tag : undefined };
}

/** Amazon search results for a wish. No product API: the parents pick from the results. */
export function giftSearchUrl(wish: string, links: GiftLinks): string {
  const url = new URL(`https://www.${links.domain}/s`);
  url.searchParams.set('k', wish);
  if (links.tag) url.searchParams.set('tag', links.tag);
  return url.toString();
}

// Same palette as src/index.css. Email clients ignore CSS variables, SVG and web fonts, so the
// web design is rebuilt with nested tables, inline styles, emoji and font fallbacks.
const C = {
  beige: '#f6ecda',
  beigeLight: '#fff8ec',
  beigeDark: '#e8d6b8',
  red: '#c8372d',
  redDark: '#8e231b',
  green: '#2f6b3a',
  gold: '#e3a93b',
  ink: '#3b2a20',
  muted: '#7d6a58',
  stitch: '#e6aaa4',
  line: '#efdfc4',
};
const FONT_BODY = "'Nunito','Trebuchet MS',Helvetica,Arial,sans-serif";
const FONT_TITLE = "'Fredoka','Nunito','Trebuchet MS',Helvetica,Arial,sans-serif";
const FONT_LOGO = "'Mountains of Christmas','Fredoka',Georgia,serif";
// Santa with light skin tone (U+1F385 U+1F3FB) instead of the default yellow.
const SANTA = '\u{1F385}\u{1F3FB}';
// The title is an image in the web font (scripts/email-logo.sh), sent inline with the email so no
// remote image is loaded. The alt text keeps the title readable when images are blocked.
export const LOGO_CID = 'santa-logo';

function layout(preheader: string, cardHtml: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>Llamada de Santa</title></head>
<body style="margin:0;padding:0;background:${C.beige};font-family:${FONT_BODY};color:${C.ink}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.beige}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td align="center" style="padding:0 0 14px">
  <div style="font-size:56px;line-height:1">${SANTA}</div>
  <img src="cid:${LOGO_CID}" width="320" height="62" alt="Llamada de Santa" style="display:block;margin:0 auto;border:0;outline:none;width:320px;max-width:100%;height:auto;font-family:${FONT_LOGO};font-weight:700;font-size:36px;color:${C.red}">
  <div style="font-size:13px;color:${C.muted};letter-spacing:2px;padding-top:4px">❄ &nbsp; DESDE EL POLO NORTE &nbsp; ❄</div>
</td></tr>
<tr><td style="background:${C.beigeLight};border:2px solid ${C.beigeDark};border-radius:32px;padding:6px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.beigeLight};border:3px solid ${C.red};border-radius:26px"><tr><td style="padding:6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px dashed ${C.stitch};border-radius:20px"><tr><td style="padding:26px 26px 22px;font-size:16px;line-height:1.65">
${cardHtml}
    </td></tr></table>
  </td></tr></table>
</td></tr>
<tr><td align="center" style="padding:22px 0 6px;font-size:26px;letter-spacing:6px">🏠🎄🦌🎄🏠</td></tr>
<tr><td align="center" style="padding:0 24px;font-size:12px;line-height:1.5;color:${C.muted}">Recibes este correo porque agendaste una llamada de Santa.<br>Hemos borrado los datos de la llamada después de enviarlo.</td></tr>
</table></td></tr></table></body></html>`;
}

function cardTitle(icon: string, title: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr>
<td style="font-size:30px;line-height:1;padding-right:10px">${icon}</td>
<td style="font-family:${FONT_TITLE};font-weight:600;font-size:24px;line-height:1.2;color:${C.green}">${escapeHtml(title)}</td></tr></table>`;
}

function signature(): string {
  return `<p style="margin:22px 0 0;text-align:right"><span style="font-family:${FONT_LOGO};font-weight:700;font-size:28px;color:${C.red}">¡Jo, jo, jo!</span><br>
<span style="font-family:${FONT_TITLE};font-weight:600;color:${C.ink}">Santa</span> <span style="color:${C.muted}">y los elfos del Polo Norte</span></p>`;
}

function wishRows(wishes: string[], links?: GiftLinks): string {
  if (!wishes.length) {
    return `<p style="margin:0;color:${C.muted}">No ha pedido nada concreto. ¡Le basta con la ilusión!</p>`;
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${wishes
    .map(
      (w, i) => `<tr><td width="40" valign="top" style="padding:6px 0">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="28" height="28" align="center" valign="middle" style="width:28px;height:28px;border-radius:14px;background:${C.red};color:${C.beigeLight};font-family:${FONT_TITLE};font-weight:600;font-size:14px;line-height:28px">${i + 1}</td></tr></table>
</td><td valign="middle" style="padding:6px 0;border-bottom:${i < wishes.length - 1 ? `1px dashed ${C.beigeDark}` : '0'};font-size:16px">${escapeHtml(w)}${
        links
          ? `<br><a href="${escapeHtml(giftSearchUrl(w, links))}" style="font-size:13px;font-weight:700;color:${C.red};text-decoration:underline">Ver ideas en Amazon ›</a>`
          : ''
      }</td></tr>`,
    )
    .join('')}</table>`;
}

export function wishlistEmail(childName: string, letterParagraphs: string[], wishes: string[], links?: GiftLinks): EmailContent {
  const withLinks = links && wishes.length ? links : undefined;
  const subject = `🎁 La carta de ${childName} para Santa`;
  const greeting = `Hola, familia de ${childName}:`;
  const wishesText = wishes.length
    ? wishes.map((w, i) => `  ${i + 1}. ${w}${withLinks ? `\n     ${giftSearchUrl(w, withLinks)}` : ''}`).join('\n')
    : '  (no ha pedido nada concreto)';
  const linksIntro = withLinks ? 'Los elfos han buscado ideas en Amazon para cada deseo.' : '';
  const affiliateNote = withLinks?.tag ? 'Los enlaces a Amazon son enlaces de afiliado.' : '';
  const text = `${greeting}\n\n${letterParagraphs.join('\n\n')}\n\nLista de deseos de ${childName}:\n${
    linksIntro ? `${linksIntro}\n` : ''
  }${wishesText}\n\n¡Jo, jo, jo!\nSanta y los elfos del Polo Norte${affiliateNote ? `\n\n${affiliateNote}` : ''}`;
  const html = layout(
    `Santa ha hablado con ${childName}. Aquí tenéis su lista de deseos.`,
    `${cardTitle('✉️', `La carta de ${childName}`)}
<p style="margin:0 0 12px;font-family:${FONT_TITLE};font-weight:600;font-size:18px">${escapeHtml(greeting)}</p>
${letterParagraphs.map((p) => `<p style="margin:0 0 14px">${escapeHtml(p)}</p>`).join('')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;background:#ffffff;border:2px solid ${C.gold};border-radius:18px"><tr><td style="padding:18px 20px 14px">
${cardTitle('🎁', `Lista de deseos de ${childName}`)}
${linksIntro ? `<p style="margin:-6px 0 10px;font-size:14px;color:${C.muted}">${escapeHtml(linksIntro)}</p>` : ''}
${wishRows(wishes, withLinks)}
</td></tr></table>
${signature()}
${affiliateNote ? `<p style="margin:18px 0 0;font-size:12px;color:${C.muted};text-align:center">${escapeHtml(affiliateNote)}</p>` : ''}`,
  );
  return { subject, text, html };
}

export function missedCallEmail(childName: string, reason: 'NO_ANSWER' | 'CUT_SHORT'): EmailContent {
  const subject = `${SANTA} Santa ha intentado llamar a ${childName}`;
  const line =
    reason === 'NO_ANSWER'
      ? `Santa ha intentado llamar a ${childName} varias veces, pero nadie ha contestado. Los elfos dicen que puedes agendar otra llamada cuando quieras.`
      : `Santa ha hablado con ${childName}, pero la llamada se cortó antes de terminar la carta. Puedes agendar otra llamada cuando quieras.`;
  const title = reason === 'NO_ANSWER' ? 'Nadie ha contestado' : 'La llamada se cortó';
  return {
    subject,
    text: `${line}\n\n¡Jo, jo, jo!\nSanta y los elfos del Polo Norte`,
    html: layout(line, `${cardTitle('☎️', title)}<p style="margin:0">${escapeHtml(line)}</p>${signature()}`),
  };
}

export async function sendEmail(to: string, content: EmailContent): Promise<void> {
  const from = process.env.SENDER_EMAIL;
  if (!from) throw new Error('SENDER_EMAIL is not set');
  const logo = Buffer.from(LOGO_PNG_BASE64, 'base64');
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: `Santa <${from}>`,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: content.subject, Charset: 'UTF-8' },
          Body: { Text: { Data: content.text, Charset: 'UTF-8' }, Html: { Data: content.html, Charset: 'UTF-8' } },
          Attachments: [
            {
              RawContent: logo,
              FileName: 'llamada-de-santa.png',
              ContentType: 'image/png',
              ContentDisposition: 'INLINE',
              ContentId: LOGO_CID,
              ContentTransferEncoding: 'BASE64',
            },
          ],
        },
      },
    }),
  );
}
