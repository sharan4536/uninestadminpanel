/**
 * UniNest Message Encryption Utilities
 * 
 * Encrypts messages at rest in Firestore for backend privacy.
 * Uses a deterministic AES-GCM key derived from the conversation participants' UIDs,
 * so messages are always decryptable by both participants regardless of device or session.
 * 
 * This is NOT end-to-end encryption (the key is derived from known data),
 * but it ensures messages are not stored as plain text in the database.
 */

// Key Pair Interface (kept for API compatibility with existing code)
export interface KeyPair {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
}

// Storage Keys (kept for backward compat — will be cleaned up)
const PRIV_KEY_STORAGE = 'uninest_priv_key';
const PUB_KEY_STORAGE = 'uninest_pub_key';

// Fixed app-level salt for key derivation (not secret — just ensures uniqueness)
const APP_SALT = 'UniNest-Chat-Encryption-2024';

/**
 * Derive a deterministic AES-GCM key from two user UIDs.
 * The key is always the same for a given pair of users, regardless of
 * which device or session they're on.
 */
export const deriveConversationKey = async (uid1: string, uid2: string): Promise<CryptoKey> => {
    // Sort UIDs so the key is the same regardless of who initiates
    const sorted = [uid1, uid2].sort();
    const keyMaterial = `${APP_SALT}:${sorted[0]}:${sorted[1]}`;
    
    // Import the key material as raw bits
    const encoder = new TextEncoder();
    const rawKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(keyMaterial),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    
    // Derive the actual AES-GCM key using PBKDF2
    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode(APP_SALT),
            iterations: 100000,
            hash: 'SHA-256',
        },
        rawKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

// Encrypt Message
export const encryptMessage = async (text: string, sharedKey: CryptoKey): Promise<string> => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
    const encodedText = new TextEncoder().encode(text);

    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        sharedKey,
        encodedText
    );

    // Combine IV and Ciphertext for storage: IV (12 bytes) + Ciphertext
    const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Convert to Base64
    return btoa(String.fromCharCode(...combined));
};

// Decrypt Message
export const decryptMessage = async (encryptedBase64: string, sharedKey: CryptoKey): Promise<string> => {
    try {
        const combinedStr = atob(encryptedBase64);
        const combined = new Uint8Array(combinedStr.length);
        for (let i = 0; i < combinedStr.length; i++) {
            combined[i] = combinedStr.charCodeAt(i);
        }

        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            sharedKey,
            ciphertext
        );

        return new TextDecoder().decode(decrypted);
    } catch (e) {
        // Decryption failed — this message might be:
        // 1. Plain text (legacy/unencrypted)
        // 2. Encrypted with old ECDH keys that are now lost
        // Return fallback marker
        return "[E2EE Error: Decryption Failed]";
    }
};

// ---- Legacy API kept for backward compatibility ----
// These are no-ops or stubs so existing imports don't break

export const generateKeyPair = async (): Promise<KeyPair> => {
    return window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
    ) as Promise<KeyPair>;
};

export const exportKey = async (key: CryptoKey): Promise<JsonWebKey> => {
    return window.crypto.subtle.exportKey("jwk", key);
};

export const importKey = async (jwk: JsonWebKey, type: 'public' | 'private'): Promise<CryptoKey> => {
    return window.crypto.subtle.importKey(
        "jwk", jwk,
        { name: "ECDH", namedCurve: "P-256" },
        type === 'private',
        type === 'private' ? ["deriveKey", "deriveBits"] : []
    );
};

export const storeLocalKeys = async (_keyPair: KeyPair) => {
    // No longer needed — keys are derived deterministically
};

export const getLocalKeys = async (): Promise<KeyPair | null> => {
    // Clean up old stored keys
    try {
        localStorage.removeItem(PRIV_KEY_STORAGE);
        localStorage.removeItem(PUB_KEY_STORAGE);
    } catch {}
    return null;
};

export const deriveSharedKey = async (_privateKey: CryptoKey, _publicKey: CryptoKey): Promise<CryptoKey> => {
    // This is a stub — real key derivation now uses deriveConversationKey
    throw new Error('deriveSharedKey is deprecated — use deriveConversationKey instead');
};

export const initializeE2EE = async (): Promise<JsonWebKey | null> => {
    // Clean up old stored keys
    try {
        localStorage.removeItem(PRIV_KEY_STORAGE);
        localStorage.removeItem(PUB_KEY_STORAGE);
    } catch {}
    return null;
};
