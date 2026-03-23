import crypto from 'crypto';

// Encryption key from environment - should be 32 bytes (256 bits)
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    // Generate a default key for development
    return crypto.scryptSync('cloudflare-manager-secret', 'salt', 32);
  }
  // If key is base64 encoded
  if (key.length === 44) {
    return Buffer.from(key, 'base64');
  }
  // Derive key from string
  return crypto.scryptSync(key, 'salt', 32);
};

/**
 * Encrypt data using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @returns Object containing ciphertext and iv (both base64 encoded)
 */
export function encrypt(plaintext: string): { ciphertext: string; iv: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 12 bytes for GCM
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  // Combine ciphertext with auth tag (both base64)
  const ciphertextWithTag = Buffer.concat([
    Buffer.from(encrypted, 'base64'),
    authTag
  ]).toString('base64');
  
  return {
    ciphertext: ciphertextWithTag,
    iv: iv.toString('base64')
  };
}

/**
 * Decrypt data encrypted with AES-256-GCM
 * @param encryptedData - Object containing ciphertext and iv
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: { ciphertext: string; iv: string }): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const ciphertextWithTag = Buffer.from(encryptedData.ciphertext, 'base64');
  
  // Last 16 bytes are auth tag
  const ciphertext = ciphertextWithTag.slice(0, -16);
  const authTag = ciphertextWithTag.slice(-16);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate a random token for sessions
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(password, hash);
}
