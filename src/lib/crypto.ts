// TODO: replace with real AES-GCM encryption via crypto.subtle.
// Current implementation is encode/decode only (no encryption).
// When real encryption lands, add passphrase prompt + PBKDF2 key derivation.

export async function encryptField(plaintext: string): Promise<Uint8Array> {
	return new TextEncoder().encode(plaintext);
}

export async function decryptField(ciphertext: Uint8Array): Promise<string> {
	return new TextDecoder().decode(ciphertext);
}
