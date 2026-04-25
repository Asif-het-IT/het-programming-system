/**
 * Enhanced password hashing and storage security
 * Uses subtle crypto API for better security than base64
 */

/**
 * Hash password using SubtleCrypto (browser native)
 * For production, use bcryptjs library
 */
export async function hashPassword(password) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (err) {
    console.error('Password hashing failed:', err);
    // Fallback to base64 for browsers without SubtleCrypto
    return btoa(password);
  }
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password, hash) {
  try {
    const newHash = await hashPassword(password);
    return newHash === hash;
  } catch {
    return false;
  }
}

/**
 * Generate random token for API keys
 */
export function generateSecureToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    token += chars[array[i] % chars.length];
  }
  return token;
}

/**
 * Mask sensitive value (for logs)
 */
export function maskSensitive(value, showChars = 4) {
  if (!value || value.length <= showChars) return '*'.repeat(value?.length || 0);
  const hidden = '*'.repeat(value.length - showChars);
  return hidden + value.slice(-showChars);
}

/**
 * Clear sensitive data from memory (best effort)
 */
export function clearSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') return;
  Object.keys(obj).forEach(key => {
    if (obj[key] && typeof obj[key] === 'object') {
      clearSensitiveData(obj[key]);
    } else if (['password', 'token', 'secret', 'key'].some(k => key.includes(k))) {
      obj[key] = null;
    }
  });
}
