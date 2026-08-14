import { afterEach, describe, expect, it } from 'vitest';
import { decryptText, encryptText } from './crypto';

const originalKey = process.env.ENCRYPTION_KEY;

afterEach(() => {
  process.env.ENCRYPTION_KEY = originalKey;
});

describe('credential encryption', () => {
  it('round-trips credentials with AES-GCM', () => {
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
    const encrypted = encryptText('secret-api-key');
    expect(encrypted).not.toContain('secret-api-key');
    expect(decryptText(encrypted)).toBe('secret-api-key');
  });

  it('rejects missing or weak encryption keys', () => {
    process.env.ENCRYPTION_KEY = 'too-short';
    expect(() => encryptText('secret')).toThrow(/at least 32 characters/);
  });

  it('does not return ciphertext as if it were plaintext when decryption fails', () => {
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
    expect(() => decryptText('broken:cipher:text')).toThrow(/could not be decrypted/);
  });
});
