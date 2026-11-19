// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, expect, it } from 'vitest';
import { formatNationalNumber, formatPhone, isValidPhone, nationalLength, phonePlaceholder, splitPhone } from './phone.ts';

describe('phone', () => {
  it('accepts US mobiles when +1 is allowed', () => {
    expect(isValidPhone('+12125550123', ['+1'])).toBe(true);
    // Area codes cannot start with 0 or 1.
    expect(isValidPhone('+11125550123', ['+1'])).toBe(false);
    expect(isValidPhone('+1212555012', ['+1'])).toBe(false);
    expect(isValidPhone('+34600123456', ['+1'])).toBe(false);
  });

  it('accepts Spanish mobiles starting with 6 or 7 when +34 is allowed', () => {
    expect(isValidPhone('+34600123456', ['+34'])).toBe(true);
    expect(isValidPhone('+34699123456', ['+1', '+34'])).toBe(true);
    expect(isValidPhone('+34900123456', ['+34'])).toBe(false);
  });

  it('only checks E.164 for other countries', () => {
    expect(isValidPhone('+447700900123', ['+44'])).toBe(true);
    expect(isValidPhone('+44123', ['+44'])).toBe(false);
  });

  it('splits a stored number into prefix and national digits', () => {
    expect(splitPhone('+34600123456', ['+1', '+34'])).toEqual({ prefix: '+34', digits: '600123456' });
    expect(splitPhone('+34600123456', ['+1'])).toEqual({ prefix: '+1', digits: '' });
    expect(splitPhone(null, ['+1'])).toEqual({ prefix: '+1', digits: '' });
    expect(nationalLength('+1')).toBe(10);
    expect(nationalLength('+34')).toBe(9);
    expect(nationalLength('+44')).toBe(13);
    expect(phonePlaceholder('+1')).toBe('2125550123');
  });

  it('formats +1 and +34 numbers and leaves others alone', () => {
    expect(formatPhone('+12125550123')).toBe('+1 (212) 555-0123');
    expect(formatPhone('+34600123456')).toBe('+34 600 12 34 56');
    expect(formatPhone('+441234')).toBe('+441234');
    expect(formatNationalNumber('+18005550123')).toBe('(800) 555-0123');
    expect(formatNationalNumber('+34900123456')).toBe('900 123 456');
    expect(formatNationalNumber('+4930123456')).toBe('+4930123456');
  });
});
