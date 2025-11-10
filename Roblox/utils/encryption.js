/**
 * KS Bot - Encryption Utilities
 * 
 * Handles encryption, hashing, and HMAC signatures for secure communication.
 */

const crypto = require('crypto');
const { roblox: logger } = require('../../shared/utils/logger');

class EncryptionUtils {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltLength = 64;
    
    // Get encryption key from environment
    this.encryptionKey = this.getEncryptionKey();
  }

  /**
   * Get encryption key from environment
   * @returns {Buffer}
   */
  getEncryptionKey() {
    const keyHex = process.env.ENCRYPTION_KEY;
    
    if (!keyHex) {
      logger.warn('ENCRYPTION_KEY not set in environment, using default (INSECURE!)');
      // Generate a temporary key for development
      return crypto.randomBytes(this.keyLength);
    }

    try {
      const key = Buffer.from(keyHex, 'hex');
      
      if (key.length !== this.keyLength) {
        throw new Error(`Encryption key must be ${this.keyLength} bytes (${this.keyLength * 2} hex characters)`);
      }

      return key;
    } catch (error) {
      logger.error('Failed to parse encryption key', { error });
      throw error;
    }
  }

  /**
   * Encrypt data
   * @param {string} plaintext - Data to encrypt
   * @returns {string} Encrypted data (base64)
   */
  encrypt(plaintext) {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Combine IV + AuthTag + Encrypted Data
      const combined = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
      ]);

      return combined.toString('base64');
    } catch (error) {
      logger.error('Encryption failed', { error });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data
   * @param {string} encryptedData - Encrypted data (base64)
   * @returns {string} Decrypted plaintext
   */
  decrypt(encryptedData) {
    try {
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract IV, AuthTag, and Encrypted Data
      const iv = combined.slice(0, this.ivLength);
      const authTag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.ivLength + this.tagLength);

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash data with SHA-256
   * @param {string} data - Data to hash
   * @returns {string} Hash (hex)
   */
  hash(data) {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Hash data with salt
   * @param {string} data - Data to hash
   * @param {string} salt - Salt (optional, will generate if not provided)
   * @returns {Object} { hash, salt }
   */
  hashWithSalt(data, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(this.saltLength).toString('hex');
    }

    const hash = crypto
      .createHash('sha256')
      .update(data + salt)
      .digest('hex');

    return { hash, salt };
  }

  /**
   * Verify hashed data
   * @param {string} data - Original data
   * @param {string} hash - Hash to verify against
   * @param {string} salt - Salt used in hashing
   * @returns {boolean}
   */
  verifyHash(data, hash, salt) {
    const computed = this.hashWithSalt(data, salt);
    return computed.hash === hash;
  }

  /**
   * Generate HMAC signature
   * @param {string} data - Data to sign
   * @param {string} secret - Secret key
   * @returns {string} HMAC signature (hex)
   */
  generateHMAC(data, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify HMAC signature
   * @param {string} data - Original data
   * @param {string} signature - Signature to verify
   * @param {string} secret - Secret key
   * @returns {boolean}
   */
  verifyHMAC(data, signature, secret) {
    const computed = this.generateHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(signature, 'hex')
    );
  }

  /**
   * Generate random token
   * @param {number} length - Token length in bytes
   * @returns {string} Random token (hex)
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate random alphanumeric string
   * @param {number} length - String length
   * @returns {string}
   */
  generateRandomString(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const bytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    
    return result;
  }

  /**
   * Generate verification code
   * @param {number} length - Code length
   * @returns {string} Verification code (alphanumeric)
   */
  generateVerificationCode(length = 8) {
    return this.generateRandomString(length).toUpperCase();
  }

  /**
   * Hash password with bcrypt-compatible PBKDF2
   * @param {string} password - Password to hash
   * @param {string} salt - Salt (optional)
   * @returns {Object} { hash, salt }
   */
  hashPassword(password, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }

    const hash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
      .toString('hex');

    return { hash, salt };
  }

  /**
   * Verify password
   * @param {string} password - Password to verify
   * @param {string} hash - Stored hash
   * @param {string} salt - Stored salt
   * @returns {boolean}
   */
  verifyPassword(password, hash, salt) {
    const computed = this.hashPassword(password, salt);
    return crypto.timingSafeEqual(
      Buffer.from(computed.hash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }

  /**
   * Create signed payload for API requests
   * @param {Object} payload - Payload data
   * @param {string} secret - Secret key
   * @returns {Object} { payload, signature, timestamp }
   */
  createSignedPayload(payload, secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadString = JSON.stringify({ ...payload, timestamp });
    const signature = this.generateHMAC(payloadString, secret);

    return {
      payload,
      signature,
      timestamp
    };
  }

  /**
   * Verify signed payload
   * @param {Object} data - { payload, signature, timestamp }
   * @param {string} secret - Secret key
   * @param {number} maxAge - Max age in seconds (default 300 = 5 minutes)
   * @returns {boolean}
   */
  verifySignedPayload(data, secret, maxAge = 300) {
    try {
      const { payload, signature, timestamp } = data;

      // Check timestamp
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > maxAge) {
        logger.warn('Signed payload expired', { 
          timestamp, 
          now, 
          age: now - timestamp 
        });
        return false;
      }

      // Verify signature
      const payloadString = JSON.stringify({ ...payload, timestamp });
      return this.verifyHMAC(payloadString, signature, secret);
    } catch (error) {
      logger.error('Failed to verify signed payload', { error });
      return false;
    }
  }

  /**
   * Encrypt sensitive application data
   * @param {Object} data - Data to encrypt
   * @returns {string} Encrypted data
   */
  encryptApplicationData(data) {
    const jsonString = JSON.stringify(data);
    return this.encrypt(jsonString);
  }

  /**
   * Decrypt sensitive application data
   * @param {string} encryptedData - Encrypted data
   * @returns {Object} Decrypted data
   */
  decryptApplicationData(encryptedData) {
    const jsonString = this.decrypt(encryptedData);
    return JSON.parse(jsonString);
  }

  /**
   * Generate API request signature
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {Object} body - Request body
   * @param {string} timestamp - Request timestamp
   * @param {string} apiKey - API key
   * @returns {string} Request signature
   */
  generateRequestSignature(method, path, body, timestamp, apiKey) {
    const bodyString = body ? JSON.stringify(body) : '';
    const signatureData = `${method}:${path}:${bodyString}:${timestamp}`;
    return this.generateHMAC(signatureData, apiKey);
  }

  /**
   * Verify API request signature
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {Object} body - Request body
   * @param {string} timestamp - Request timestamp
   * @param {string} signature - Provided signature
   * @param {string} apiKey - API key
   * @returns {boolean}
   */
  verifyRequestSignature(method, path, body, timestamp, signature, apiKey) {
    const computed = this.generateRequestSignature(method, path, body, timestamp, apiKey);
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, 'hex'),
        Buffer.from(signature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Mask sensitive data for logging
   * @param {string} data - Sensitive data
   * @param {number} visibleChars - Number of characters to show at start
   * @returns {string} Masked data
   */
  maskSensitiveData(data, visibleChars = 8) {
    if (!data || data.length <= visibleChars) {
      return '***';
    }
    
    return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars);
  }

  /**
   * Generate nonce for preventing replay attacks
   * @returns {string} Nonce
   */
  generateNonce() {
    return this.generateToken(16);
  }

  /**
   * Encrypt file data
   * @param {Buffer} fileData - File data buffer
   * @returns {Buffer} Encrypted file data
   */
  encryptFile(fileData) {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      const encrypted = Buffer.concat([
        cipher.update(fileData),
        cipher.final()
      ]);

      const authTag = cipher.getAuthTag();

      // Combine IV + AuthTag + Encrypted Data
      return Buffer.concat([iv, authTag, encrypted]);
    } catch (error) {
      logger.error('File encryption failed', { error });
      throw new Error('Failed to encrypt file');
    }
  }

  /**
   * Decrypt file data
   * @param {Buffer} encryptedFileData - Encrypted file data buffer
   * @returns {Buffer} Decrypted file data
   */
  decryptFile(encryptedFileData) {
    try {
      // Extract IV, AuthTag, and Encrypted Data
      const iv = encryptedFileData.slice(0, this.ivLength);
      const authTag = encryptedFileData.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = encryptedFileData.slice(this.ivLength + this.tagLength);

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
    } catch (error) {
      logger.error('File decryption failed', { error });
      throw new Error('Failed to decrypt file');
    }
  }

  /**
   * Generate secure session token
   * @param {Object} data - Session data
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {string} Session token
   */
  generateSessionToken(data, expiresIn = 3600) {
    const expiresAt = Date.now() + (expiresIn * 1000);
    const sessionData = {
      ...data,
      expiresAt
    };

    return this.encrypt(JSON.stringify(sessionData));
  }

  /**
   * Verify and decode session token
   * @param {string} token - Session token
   * @returns {Object|null} Session data or null if invalid/expired
   */
  verifySessionToken(token) {
    try {
      const decrypted = this.decrypt(token);
      const sessionData = JSON.parse(decrypted);

      // Check expiration
      if (sessionData.expiresAt < Date.now()) {
        logger.debug('Session token expired');
        return null;
      }

      return sessionData;
    } catch (error) {
      logger.error('Failed to verify session token', { error });
      return null;
    }
  }

  /**
   * Create JWT-like token (simplified version)
   * @param {Object} payload - Token payload
   * @param {string} secret - Secret key
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {string} Token
   */
  createToken(payload, secret, expiresIn = 3600) {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const tokenPayload = {
      ...payload,
      iat: now,
      exp: now + expiresIn
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
    
    const signature = this.generateHMAC(`${encodedHeader}.${encodedPayload}`, secret);
    const encodedSignature = Buffer.from(signature, 'hex').toString('base64url');

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  /**
   * Verify JWT-like token
   * @param {string} token - Token to verify
   * @param {string} secret - Secret key
   * @returns {Object|null} Decoded payload or null if invalid
   */
  verifyToken(token, secret) {
    try {
      const parts = token.split('.');
      
      if (parts.length !== 3) {
        return null;
      }

      const [encodedHeader, encodedPayload, encodedSignature] = parts;

      // Verify signature
      const expectedSignature = this.generateHMAC(`${encodedHeader}.${encodedPayload}`, secret);
      const providedSignature = Buffer.from(encodedSignature, 'base64url').toString('hex');

      if (!crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      )) {
        logger.warn('Token signature verification failed');
        return null;
      }

      // Decode payload
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        logger.debug('Token expired');
        return null;
      }

      return payload;
    } catch (error) {
      logger.error('Failed to verify token', { error });
      return null;
    }
  }

  /**
   * Securely compare two strings (timing-safe)
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean}
   */
  secureCompare(a, b) {
    if (a.length !== b.length) {
      return false;
    }

    try {
      return crypto.timingSafeEqual(
        Buffer.from(a),
        Buffer.from(b)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate checksum for data integrity
   * @param {string|Buffer} data - Data to checksum
   * @returns {string} Checksum (hex)
   */
  generateChecksum(data) {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Verify data integrity with checksum
   * @param {string|Buffer} data - Data to verify
   * @param {string} checksum - Expected checksum
   * @returns {boolean}
   */
  verifyChecksum(data, checksum) {
    const computed = this.generateChecksum(data);
    return this.secureCompare(computed, checksum);
  }
}

// Export singleton instance
module.exports = new EncryptionUtils();