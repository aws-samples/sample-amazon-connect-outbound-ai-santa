// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Every string a parent sees, in English (US) and Spanish (Spain). The backend's SANTA_LANGUAGE setting
 * reaches the app as `custom.language` in amplify_outputs.json and picks the dictionary.
 *
 * Text that wraps a highlighted value is a `[before, after]` pair, so components can put the value in `<strong>`.
 */
import { language, type Language } from './config.ts';

type Wrap = readonly [before: string, after: string];

export interface Strings {
  /** Language code for `<html lang>` and the Amplify UI vocabulary. */
  htmlLang: Language;
  /** BCP 47 locale for Intl formats. */
  locale: 'en-US' | 'es-ES';
  /** First day of the week in the date picker: 0 Sunday, 1 Monday. */
  weekStartsOn: 0 | 1;

  appTitle: string;
  metaDescription: string;
  howItWorks: string;
  flow: readonly { title: string; sub: string }[];
  authHello: string;
  authSub: string;
  footer: string;

  errCodeMismatch: string;
  errExpiredCode: string;
  errTooManyAttempts: string;
  errAliasExists: string;
  errCodeDelivery: string;
  errSessionExpired: string;
  errNetwork: string;
  errGeneric: string;
  /** Shown by the form when the typed number does not pass the phone rules for `prefix`. */
  phoneInvalid: (prefix: string) => string;
  /** Shown when Cognito rejects the number. */
  phoneRejected: (prefix: string) => string;

  countdownToday: string;
  countdownTomorrow: string;
  countdownDays: (days: number) => string;
  /** `date` is already formatted, `time` too. */
  callWhen: (date: string, time: string) => string;

  pickDayDialog: string;
  prevMonth: string;
  nextMonth: string;

  verifyTitle: string;
  verifyTitleCode: string;
  verifyIntro: string;
  verifySentTo: Wrap;
  phoneLabel: string;
  countryCode: string;
  sending: string;
  sendCode: string;
  skipStep: string;
  codeLabel: string;
  checking: string;
  verify: string;
  resendCode: string;
  changeNumber: string;
  newCodeSent: string;

  celebrationTitle: (childName: string) => string;
  celebrationWhen: (when: string) => string;
  scheduleAnother: string;
  tipsTitle: string;
  tipCaller: Wrap;
  tipUnknownCaller: string;
  tips: readonly string[];
  formTitle: string;
  childNameLabel: string;
  childNamePlaceholder: string;
  notesLabel: string;
  notesCount: (length: number, max: number) => string;
  notesPlaceholder: string;
  notesHint: string;
  dayLabel: string;
  timeLabel: (city: string) => string;
  seasonOver: string;
  callWindowHint: (start: string, end: string) => string;
  santaWillCall: Wrap;
  letterGoesTo: Wrap;
  notifyingElves: string;
  submit: string;
  quickTest: string;

  status: Record<'CALLING' | 'IN_CALL' | 'NO_RESPONSE' | 'DELIVERED' | 'UNKNOWN', string>;
  emptyTitle: string;
  emptySub: string;
  hideCalls: string;
  showCalls: string;
  callsCount: (count: number) => string;
  cancelCallOf: (childName: string) => string;
  cancelCallOfQuestion: (childName: string) => string;
  cancelQuestion: string;
  cancelling: string;
  confirmCancel: string;
  no: string;
  cancel: string;

  loadingHome: string;
  back: string;
  workshop: string;
  signOut: string;
  retry: string;

  workshopLoading: string;
  workshopTitle: string;
  tiles: Record<'scheduled' | 'dialled' | 'answered' | 'lettersSent' | 'wishes' | 'giftLinks', string>;
  small: Record<'missed' | 'cutShort' | 'cancelled', string>;
  pendingSuffix: string;
  liveSuffix: string;
  avgCall: string;
  answerRate: string;
  wishesPerLetter: string;
  percent: (n: number) => string;
  funTitle: string;
  funTag: string;
  /** Distance from the call zone to the North Pole, per letter, in the unit of `sleighSuffix`. */
  sleighPerLetter: number;
  sleighSuffix: string;
  cookiesSuffix: string;
  elvesSuffix: string;
  funNote: string;
  last7Days: string;
  daysChartLabel: string;
  dayChartText: (calls: number, letters: number) => string;
  legendCalls: string;
  legendLetters: string;

  signNorthPole: string;
  signWorkshop: string;
  signReindeer: string;
}

const en: Strings = {
  htmlLang: 'en',
  locale: 'en-US',
  weekStartsOn: 0,

  appTitle: "Santa's Call",
  metaDescription: 'Santa phones your little one and emails you their wish list.',
  howItWorks: 'How it works',
  flow: [
    { title: 'Verify your phone', sub: 'We text you a code' },
    { title: 'Pick a day and time', sub: 'And tell Santa a little about your child' },
    { title: 'Santa calls', sub: 'He chats with your little one in English' },
    { title: 'Get the letter', sub: 'With their wishes, in your inbox' },
  ],
  authHello: 'Hi there, family!',
  authSub: 'Sign in to let Santa know',
  footer: 'An Amazon Connect demo · Santa never records calls',

  errCodeMismatch: "That code isn't quite right. Check the text message and type it again.",
  errExpiredCode: 'That code has expired. Ask for a new one.',
  errTooManyAttempts: 'Too many tries. Wait a few minutes and try again.',
  errAliasExists: 'That number is already on another account. Please use a different one.',
  errCodeDelivery: "We couldn't send the text message. Check the number or try again later.",
  errSessionExpired: 'Your session has expired. Sign out and sign back in.',
  errNetwork: "We can't reach the North Pole. Check your internet connection and try again.",
  errGeneric: 'An elf got tangled up in the wires. Try again in a moment.',
  phoneInvalid: (prefix) =>
    prefix === '+1'
      ? 'Enter a 10-digit US or Canadian mobile number.'
      : prefix === '+34'
        ? 'Enter a 9-digit Spanish mobile number starting with 6 or 7.'
        : 'Enter a valid mobile number.',
  phoneRejected: (prefix) =>
    prefix === '+1'
      ? 'Check the number: it must be a 10-digit US or Canadian mobile number.'
      : prefix === '+34'
        ? 'Check the number: it must be a 9-digit Spanish mobile number.'
        : 'Check the number: it must be a valid mobile number.',

  countdownToday: "It's today!",
  countdownTomorrow: "It's tomorrow!",
  countdownDays: (days) => `${days} days to go`,
  callWhen: (date, time) => `${date} at ${time}`,

  pickDayDialog: 'Pick the day of the call',
  prevMonth: 'Previous month',
  nextMonth: 'Next month',

  verifyTitle: 'First, verify your phone',
  verifyTitleCode: 'Enter the code',
  verifyIntro: "Santa only calls verified numbers. We'll text you a code.",
  verifySentTo: ['We texted it to ', '.'],
  phoneLabel: 'Mobile number Santa will call',
  countryCode: 'Country code',
  sending: 'Sending…',
  sendCode: 'Text me a code',
  skipStep: 'Skip this step',
  codeLabel: '6-digit code',
  checking: 'Checking…',
  verify: 'Verify',
  resendCode: 'Resend code',
  changeNumber: 'Change number',
  newCodeSent: 'We sent you a new code.',

  celebrationTitle: (childName) => `Santa has put ${childName} on his list!`,
  celebrationWhen: (when) => `He'll call on ${when}.`,
  scheduleAnother: 'Schedule another call',
  tipsTitle: 'How to get your little one ready',
  tipCaller: ['Santa will call from ', '. Save it in your contacts as "Santa" so his name shows up when it rings.'],
  tipUnknownCaller: "Santa will call from a number that isn't in your contacts. Be sure to pick up!",
  tips: [
    'Put the call on speaker so you can listen together.',
    "Let your little one do the talking: Santa will ask what they're wishing for.",
    'If nobody answers, Santa will try again a little later.',
    "When the call ends, you'll get their wish list by email.",
  ],
  formTitle: 'Ask Santa to call',
  childNameLabel: "Child's first name",
  childNamePlaceholder: 'For example, Emma…',
  notesLabel: 'Things Santa knows',
  notesCount: (length, max) => `(optional, ${length}/${max})`,
  notesPlaceholder: 'Loves dinosaurs and learned to ride a bike this year…',
  notesHint: "Santa will bring this up in the chat. Please don't include last names, addresses or schools.",
  dayLabel: 'Day',
  timeLabel: (city) => `Time (${city})`,
  seasonOver: 'Santa has made all his calls for this year. Come back in December!',
  callWindowHint: (start, end) => `Santa calls until December 24, between ${start} and ${end}.`,
  santaWillCall: ['Santa will call ', ''],
  letterGoesTo: ['The letter will go to ', ''],
  notifyingElves: 'Telling the elves…',
  submit: 'Have Santa call!',
  quickTest: 'Test: call in 1 minute',

  status: {
    CALLING: 'Santa is dialing…',
    IN_CALL: 'Talking with Santa!',
    NO_RESPONSE: 'Santa will try again',
    DELIVERED: 'The letter is flying to your inbox',
    UNKNOWN: 'The elves are on it',
  },
  emptyTitle: "You haven't told Santa yet.",
  emptySub: 'Fill in the letter and a reindeer will carry the message.',
  hideCalls: 'Hide scheduled calls',
  showCalls: 'See scheduled calls',
  callsCount: (count) => `${count} ${count === 1 ? 'call' : 'calls'}`,
  cancelCallOf: (childName) => `Cancel ${childName}'s call`,
  cancelCallOfQuestion: (childName) => `Cancel ${childName}'s call?`,
  cancelQuestion: 'Cancel?',
  cancelling: 'Canceling…',
  confirmCancel: 'Yes, cancel',
  no: 'No',
  cancel: 'Cancel',

  loadingHome: 'The elves are getting everything ready…',
  back: 'Back',
  workshop: 'Workshop',
  signOut: 'Sign out',
  retry: 'Try again',

  workshopLoading: 'Counting letters in the workshop…',
  workshopTitle: "Santa's Workshop",
  tiles: {
    scheduled: 'Calls scheduled',
    dialled: 'Calls made',
    answered: 'Kids who talked with Santa',
    lettersSent: 'Letters delivered',
    wishes: 'Wishes written down',
    giftLinks: 'Gift links sent',
  },
  small: { missed: 'no answer', cutShort: 'hung up before the letter', cancelled: 'canceled' },
  pendingSuffix: ' calls waiting for their time',
  liveSuffix: ' happening now',
  avgCall: 'Average call length',
  answerRate: 'Answer rate',
  wishesPerLetter: 'Wishes per letter',
  percent: (n) => `${n}%`,
  funTitle: 'North Pole facts',
  funTag: 'just for fun',
  // New York to the North Pole, roughly: 49.3 degrees of latitude at 69 miles each.
  sleighPerLetter: 3400,
  sleighSuffix: ' miles of sleigh rides',
  cookiesSuffix: ' cookies for the reindeer',
  elvesSuffix: ' elves at work',
  funNote: 'Worked out from the letters and wishes: one cookie per wish, one elf for every three.',
  last7Days: 'Last 7 days',
  daysChartLabel: 'Calls made and letters per day',
  dayChartText: (calls, letters) => `${calls} calls, ${letters} letters`,
  legendCalls: 'calls made',
  legendLetters: 'letters delivered',

  signNorthPole: 'NORTH POLE',
  signWorkshop: 'Workshop',
  signReindeer: 'Reindeer',
};

const es: Strings = {
  htmlLang: 'es',
  locale: 'es-ES',
  weekStartsOn: 1,

  appTitle: 'Llamada de Santa',
  metaDescription: 'Santa llama por teléfono a tu peque y te envía su carta de deseos por email.',
  howItWorks: 'Cómo funciona',
  flow: [
    { title: 'Verifica tu móvil', sub: 'Te llega un código por SMS' },
    { title: 'Elige día y hora', sub: 'Y cuéntale a Santa algo de tu peque' },
    { title: 'Santa llama', sub: 'Charla con tu peque en español' },
    { title: 'Recibe la carta', sub: 'Con sus deseos, en tu email' },
  ],
  authHello: '¡Hola, familia!',
  authSub: 'Entra con tu cuenta para avisar a Santa',
  footer: 'Demo con Amazon Connect · Santa no graba las llamadas',

  errCodeMismatch: 'Ese código no es el bueno. Mira el SMS otra vez y vuelve a escribirlo.',
  errExpiredCode: 'El código ha caducado. Pide uno nuevo.',
  errTooManyAttempts: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  errAliasExists: 'Ese móvil ya está en otra cuenta. Usa otro número.',
  errCodeDelivery: 'No hemos podido enviar el SMS. Comprueba el número o prueba más tarde.',
  errSessionExpired: 'Tu sesión ha caducado. Sal y vuelve a entrar.',
  errNetwork: 'No hay conexión con el Polo Norte. Revisa tu internet y vuelve a probar.',
  errGeneric: 'Un elfo se ha liado con los cables. Vuelve a probar en un momento.',
  phoneInvalid: (prefix) =>
    prefix === '+34'
      ? 'Escribe un móvil español de 9 cifras que empiece por 6 o 7.'
      : prefix === '+1'
        ? 'Escribe un móvil de EE. UU. o Canadá de 10 cifras.'
        : 'Escribe un número de móvil válido.',
  phoneRejected: (prefix) =>
    prefix === '+34'
      ? 'Revisa el número: debe ser un móvil español de 9 cifras.'
      : prefix === '+1'
        ? 'Revisa el número: debe ser un móvil de EE. UU. o Canadá de 10 cifras.'
        : 'Revisa el número: debe ser un móvil válido.',

  countdownToday: '¡Es hoy!',
  countdownTomorrow: '¡Es mañana!',
  countdownDays: (days) => `Faltan ${days} días`,
  callWhen: (date, time) => `${date} a las ${time}`,

  pickDayDialog: 'Elige el día de la llamada',
  prevMonth: 'Mes anterior',
  nextMonth: 'Mes siguiente',

  verifyTitle: 'Primero, verifica tu móvil',
  verifyTitleCode: 'Escribe el código',
  verifyIntro: 'Santa solo llama a números verificados. Te enviaremos un código por SMS.',
  verifySentTo: ['Te lo hemos enviado por SMS al ', '.'],
  phoneLabel: 'Móvil al que llamará Santa',
  countryCode: 'Prefijo',
  sending: 'Enviando…',
  sendCode: 'Enviar código SMS',
  skipStep: 'Saltar este paso',
  codeLabel: 'Código de 6 cifras',
  checking: 'Comprobando…',
  verify: 'Verificar',
  resendCode: 'Reenviar código',
  changeNumber: 'Cambiar número',
  newCodeSent: 'Te hemos enviado un código nuevo.',

  celebrationTitle: (childName) => `¡Santa ya ha apuntado a ${childName} en su lista!`,
  celebrationWhen: (when) => `Llamará el ${when}.`,
  scheduleAnother: 'Agendar otra llamada',
  tipsTitle: 'Cómo preparar a tu peque',
  tipCaller: ['Santa llamará desde el ', '. Guárdalo en la agenda como «Santa» para que salga su nombre cuando suene.'],
  tipUnknownCaller: 'Santa llamará desde un número que no tienes en la agenda. ¡Cógelo!',
  tips: [
    'Pon el altavoz para escucharlo juntos.',
    'Deja que hable tu peque: Santa le preguntará qué quiere pedir.',
    'Si nadie contesta, Santa lo volverá a intentar un poco más tarde.',
    'Al colgar, recibirás su carta de deseos por email.',
  ],
  formTitle: 'Pide la llamada de Santa',
  childNameLabel: 'Nombre del peque',
  childNamePlaceholder: 'Por ejemplo, Lucía…',
  notesLabel: 'Cosas que Santa sabe',
  notesCount: (length, max) => `(opcional, ${length}/${max})`,
  notesPlaceholder: 'Le encantan los dinosaurios y este año ha aprendido a montar en bici…',
  notesHint: 'Santa lo usará en la conversación. No incluyas apellidos, dirección ni colegio.',
  dayLabel: 'Día',
  timeLabel: (city) => `Hora (${city})`,
  seasonOver: 'Santa ya ha hecho todas sus llamadas de este año. ¡Vuelve en diciembre!',
  callWindowHint: (start, end) => `Santa llama hasta el 24 de diciembre, entre las ${start} y las ${end}.`,
  santaWillCall: ['Santa llamará a ', ''],
  letterGoesTo: ['La carta llegará a ', ''],
  notifyingElves: 'Avisando a los elfos…',
  submit: '¡Que llame Santa!',
  quickTest: 'Prueba: llamar en 1 minuto',

  status: {
    CALLING: 'Santa está marcando…',
    IN_CALL: '¡Hablando con Santa!',
    NO_RESPONSE: 'Santa lo volverá a intentar',
    DELIVERED: 'La carta va volando a tu email',
    UNKNOWN: 'Los elfos están en ello',
  },
  emptyTitle: 'Todavía no has avisado a Santa.',
  emptySub: 'Rellena la carta y el reno le llevará el recado.',
  hideCalls: 'Ocultar llamadas agendadas',
  showCalls: 'Ver llamadas agendadas',
  callsCount: (count) => `${count} ${count === 1 ? 'llamada' : 'llamadas'}`,
  cancelCallOf: (childName) => `Cancelar la llamada de ${childName}`,
  cancelCallOfQuestion: (childName) => `¿Cancelar la llamada de ${childName}?`,
  cancelQuestion: '¿Cancelar?',
  cancelling: 'Cancelando…',
  confirmCancel: 'Sí, cancelar',
  no: 'No',
  cancel: 'Cancelar',

  loadingHome: 'Los elfos están preparando todo…',
  back: 'Volver',
  workshop: 'Taller',
  signOut: 'Salir',
  retry: 'Volver a intentarlo',

  workshopLoading: 'Contando cartas en el taller…',
  workshopTitle: 'El taller de Santa',
  tiles: {
    scheduled: 'Llamadas agendadas',
    dialled: 'Llamadas hechas',
    answered: 'Niños que hablaron con Santa',
    lettersSent: 'Cartas repartidas',
    wishes: 'Deseos apuntados',
    giftLinks: 'Enlaces de regalo enviados',
  },
  small: { missed: 'sin respuesta', cutShort: 'colgadas antes de la carta', cancelled: 'canceladas' },
  pendingSuffix: ' llamadas esperando su hora',
  liveSuffix: ' en curso ahora',
  avgCall: 'Duración media de la llamada',
  answerRate: 'Tasa de respuesta',
  wishesPerLetter: 'Deseos por carta',
  percent: (n) => `${n} %`,
  funTitle: 'Datos del Polo Norte',
  funTag: 'de cuento',
  // Madrid to the North Pole, roughly: 49.6 degrees of latitude at 111 km each.
  sleighPerLetter: 5500,
  sleighSuffix: ' km de trineo',
  cookiesSuffix: ' galletas para los renos',
  elvesSuffix: ' elfos trabajando',
  funNote: 'Calculados a partir de las cartas y los deseos: una galleta por deseo, un elfo cada tres.',
  last7Days: 'Últimos 7 días',
  daysChartLabel: 'Llamadas hechas y cartas por día',
  dayChartText: (calls, letters) => `${calls} llamadas, ${letters} cartas`,
  legendCalls: 'llamadas hechas',
  legendLetters: 'cartas repartidas',

  signNorthPole: 'POLO NORTE',
  signWorkshop: 'Taller',
  signReindeer: 'Renos',
};

export const dictionaries: Record<Language, Strings> = { en, es };

/** The active dictionary. */
export const t: Strings = dictionaries[language];

/** The active locale for Intl formats. */
export const locale = t.locale;
