// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { encryptField, decryptField, unlockWithPassphrase, clearSessionKey } from './crypto';

beforeEach(() => {
	clearSessionKey();
	localStorage.removeItem('truing_key_salt');
});

describe('crypto round-trip', () => {
	it('throws when key is not unlocked', async () => {
		await expect(encryptField('hello')).rejects.toThrow('not unlocked');
	});

	it('encrypts and decrypts back to original', async () => {
		await unlockWithPassphrase('test-passphrase');
		const plaintext = 'my-secret-token-12345';
		const encrypted = await encryptField(plaintext);
		expect(encrypted).toBeInstanceOf(Uint8Array);
		expect(encrypted.length).toBeGreaterThan(plaintext.length);
		const decrypted = await decryptField(encrypted);
		expect(decrypted).toBe(plaintext);
	});

	it('produces different ciphertext each time due to fresh IV', async () => {
		await unlockWithPassphrase('test-passphrase');
		const a = await encryptField('same-input');
		const b = await encryptField('same-input');
		expect(a).not.toEqual(b);
		expect(await decryptField(a)).toBe('same-input');
		expect(await decryptField(b)).toBe('same-input');
	});

	it('fails to decrypt with wrong passphrase', async () => {
		await unlockWithPassphrase('passphrase-one');
		const encrypted = await encryptField('secret');
		clearSessionKey();
		localStorage.removeItem('truing_key_salt');
		await unlockWithPassphrase('passphrase-two');
		await expect(decryptField(encrypted)).rejects.toThrow();
	});

	it('rejects short ciphertext', async () => {
		await unlockWithPassphrase('test');
		await expect(decryptField(new Uint8Array(5))).rejects.toThrow('Too short');
	});
});
