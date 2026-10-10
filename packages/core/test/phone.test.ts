import { describe, expect, it } from 'vitest';
import { formatIndianMobile, maskPhone, normalizeIndianMobile } from '../src';

describe('normalizeIndianMobile', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['+91-98765-43210', '+919876543210'],
    ['91 98765 43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['(+91) 70000.00001', '+917000000001'],
    ['  6123456789  ', '+916123456789'],
    ['9198765432', '+919198765432'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each([
    ['', 'empty'],
    ['12345', 'too short'],
    ['5876543210', 'starts with 5'],
    ['98765432101', 'eleven digits'],
    ['+44 7911 123456', 'foreign number'],
    ['98765abcde', 'letters'],
    ['022 2345 6789', 'Mumbai landline'],
  ])('rejects %s (%s)', (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });
});

describe('phone display helpers', () => {
  it('formats and masks', () => {
    expect(formatIndianMobile('+919876543210')).toBe('+91 98765 43210');
    expect(maskPhone('+919876543210')).toBe('+91 ••••• •3210');
    expect(maskPhone('+919876543210')).not.toContain('98765');
  });
});
