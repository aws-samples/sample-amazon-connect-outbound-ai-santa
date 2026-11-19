// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import type { Ref } from 'react';
import { allowedPhonePrefixes } from '../config.ts';
import { t } from '../i18n.ts';
import { nationalLength, phonePlaceholder } from '../phone.ts';

interface Props {
  prefix: string;
  onPrefixChange: (prefix: string) => void;
  /** National number, digits only. */
  digits: string;
  onDigitsChange: (digits: string) => void;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * Country prefix plus national number. With one allowed prefix it is shown as fixed text; with several the
 * parent picks it from a small select.
 */
export function PhoneInput({ prefix, onPrefixChange, digits, onDigitsChange, className = '', inputRef, invalid, describedBy }: Props) {
  const max = nationalLength(prefix);
  return (
    <div className={`phone-input ${className}`.trim()}>
      {allowedPhonePrefixes.length > 1 ? (
        <select
          className="phone-prefix"
          aria-label={t.countryCode}
          value={prefix}
          onChange={(e) => {
            onPrefixChange(e.target.value);
            onDigitsChange(digits.slice(0, nationalLength(e.target.value)));
          }}
        >
          {allowedPhonePrefixes.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      ) : (
        <span>{prefix}</span>
      )}
      <input
        ref={inputRef}
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={max}
        value={digits}
        onChange={(e) => onDigitsChange(e.target.value.replace(/\D/g, '').slice(0, max))}
        placeholder={phonePlaceholder(prefix)}
        // With a select inside the <label>, the label would name the select, so name the input directly.
        aria-label={allowedPhonePrefixes.length > 1 ? t.phoneLabel : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        required
      />
    </div>
  );
}
