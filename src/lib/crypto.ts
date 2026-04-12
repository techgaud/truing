const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

let sessionKey: CryptoKey | null = null;

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
	const encoded = new TextEncoder().encode(passphrase);
	const keyMaterial = await crypto.subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
			iterations: PBKDF2_ITERATIONS,
			hash: 'SHA-256'
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

export function hasSessionKey(): boolean {
	return sessionKey !== null;
}

export function clearSessionKey(): void {
	sessionKey = null;
}

export async function unlockWithPassphrase(passphrase: string): Promise<void> {
	const stored = localStorage.getItem('truing_key_salt');
	if (stored) {
		const salt = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
		sessionKey = await deriveKey(passphrase, salt);
	} else {
		const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
		localStorage.setItem('truing_key_salt', btoa(String.fromCharCode(...salt)));
		sessionKey = await deriveKey(passphrase, salt);
	}
}

export async function encryptField(plaintext: string): Promise<Uint8Array> {
	if (!sessionKey) throw new Error('Encryption key not unlocked. Enter your passphrase first.');
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const ciphertext = await crypto.subtle.encrypt(
		{
			name: 'AES-GCM',
			iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer
		},
		sessionKey,
		new TextEncoder().encode(plaintext)
	);
	const result = new Uint8Array(IV_BYTES + ciphertext.byteLength);
	result.set(iv, 0);
	result.set(new Uint8Array(ciphertext), IV_BYTES);
	return result;
}

export async function decryptField(data: Uint8Array): Promise<string> {
	if (!sessionKey) throw new Error('Encryption key not unlocked. Enter your passphrase first.');
	if (data.length < IV_BYTES + 1) throw new Error('Invalid ciphertext. Too short.');
	const iv = data.slice(0, IV_BYTES);
	const ciphertext = data.slice(IV_BYTES);
	const plaintext = await crypto.subtle.decrypt(
		{
			name: 'AES-GCM',
			iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer
		},
		sessionKey,
		ciphertext.buffer.slice(
			ciphertext.byteOffset,
			ciphertext.byteOffset + ciphertext.byteLength
		) as ArrayBuffer
	);
	return new TextDecoder().decode(plaintext);
}
