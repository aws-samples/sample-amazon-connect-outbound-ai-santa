// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Turn an error into a message a parent can act on, in Spanish.
 * The bookings API already returns Spanish messages; Cognito and the network do not.
 */
const BY_NAME: Record<string, string> = {
  CodeMismatchException: 'Ese código no es el bueno. Mira el SMS otra vez y vuelve a escribirlo.',
  ExpiredCodeException: 'El código ha caducado. Pide uno nuevo.',
  LimitExceededException: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  TooManyRequestsException: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  TooManyFailedAttemptsException: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  InvalidParameterException: 'Revisa el número: debe ser un móvil español de 9 cifras.',
  AliasExistsException: 'Ese móvil ya está en otra cuenta. Usa otro número.',
  CodeDeliveryFailureException: 'No hemos podido enviar el SMS. Comprueba el número o prueba más tarde.',
  NotAuthorizedException: 'Tu sesión ha caducado. Sal y vuelve a entrar.',
  UserUnAuthenticatedException: 'Tu sesión ha caducado. Sal y vuelve a entrar.',
  NetworkError: 'No hay conexión con el Polo Norte. Revisa tu internet y vuelve a probar.',
};

const GENERIC = 'Un elfo se ha liado con los cables. Vuelve a probar en un momento.';

/** True for the bookings API's own messages, which are written for parents. English SDK text is not. */
function looksSpanish(message: string): boolean {
  return /[áéíóúñ¡¿]/i.test(message) || /\b(Santa|llamada|elfos|Elige|Escribe|Puedes|Solo)\b/.test(message);
}

export function friendlyError(err: unknown): string {
  const e = err as { name?: string; message?: string } | null;
  if (e?.name && BY_NAME[e.name]) return BY_NAME[e.name];
  const message = e?.message ?? '';
  if (/failed to fetch|network/i.test(message)) return BY_NAME.NetworkError;
  if (message && looksSpanish(message)) return message;
  return GENERIC;
}
