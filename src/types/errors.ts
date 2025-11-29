/**
 * Error codes (matches contract error codes)
 */
export enum ErrorCode {
  // Asset errors
  NOT_OWNER = 'E_NOT_OWNER',
  INVALID_BLOB_ID = 'E_INVALID_BLOB_ID',
  INVALID_SIZE = 'E_INVALID_SIZE',
  ASSET_NOT_FOUND = 'E_ASSET_NOT_FOUND',
  INVALID_API_KEY = 'E_INVALID_API_KEY',
  INSUFFICIENT_PERMISSIONS = 'E_INSUFFICIENT_PERMISSIONS',
  API_KEY_REQUIRED = 'E_API_KEY_REQUIRED',
  POLICY_ACCESS_DENIED = 'E_POLICY_ACCESS_DENIED',
  
  // API Key errors
  API_KEY_EXPIRED = 'E_API_KEY_EXPIRED',
  API_KEY_INACTIVE = 'E_API_KEY_INACTIVE',
  RATE_LIMIT_EXCEEDED = 'E_RATE_LIMIT_EXCEEDED',
  
  // Policy errors
  INVALID_POLICY_TYPE = 'E_INVALID_POLICY_TYPE',
  POLICY_EXPIRED = 'E_POLICY_EXPIRED',
  ADDRESS_NOT_ALLOWED = 'E_ADDRESS_NOT_ALLOWED',
  INVALID_PASSWORD = 'E_INVALID_PASSWORD',
  
  // SDK errors
  VALIDATION_ERROR = 'E_VALIDATION_ERROR',
  NETWORK_ERROR = 'E_NETWORK_ERROR',
  ENCRYPTION_ERROR = 'E_ENCRYPTION_ERROR',
  BLOCKCHAIN_ERROR = 'E_BLOCKCHAIN_ERROR',
  CONFIGURATION_ERROR = 'E_CONFIGURATION_ERROR',
}

/**
 * Base error class for all Walbucket errors
 * 
 * All SDK errors extend this class, providing consistent error handling
 * with error codes, messages, and optional cause chains.
 * 
 * @example
 * ```typescript
 * try {
 *   await walbucket.upload(file);
 * } catch (error) {
 *   if (error instanceof WalbucketError) {
 *     console.error('Error code:', error.code);
 *     console.error('Message:', error.message);
 *     if (error.cause) {
 *       console.error('Cause:', error.cause);
 *     }
 *   }
 * }
 * ```
 */
export class WalbucketError extends Error {
  constructor(
    public code: ErrorCode | string,
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'WalbucketError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WalbucketError);
    }
  }
}

/**
 * Validation error
 */
export class ValidationError extends WalbucketError {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.VALIDATION_ERROR, message, cause);
    this.name = 'ValidationError';
  }
}

/**
 * Network error
 * 
 * Thrown when network operations fail (HTTP errors, timeouts, connection issues).
 * Includes HTTP status code when available.
 * 
 * @example
 * ```typescript
 * // HTTP error
 * throw new NetworkError('Walrus upload failed: 404 Not Found', 404);
 * 
 * // Timeout
 * throw new NetworkError('Request timeout after 60s');
 * ```
 */
export class NetworkError extends WalbucketError {
  constructor(message: string, public statusCode?: number, cause?: Error) {
    super(ErrorCode.NETWORK_ERROR, message, cause);
    this.name = 'NetworkError';
  }
}

/**
 * Encryption error
 * 
 * Thrown when encryption or decryption operations fail.
 * 
 * @example
 * ```typescript
 * // Encryption failure
 * throw new EncryptionError('Failed to encrypt data with policy');
 * 
 * // Decryption failure
 * throw new EncryptionError('Failed to decrypt: invalid session key');
 * ```
 */
export class EncryptionError extends WalbucketError {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.ENCRYPTION_ERROR, message, cause);
    this.name = 'EncryptionError';
  }
}

/**
 * Blockchain error
 * 
 * Thrown when Sui blockchain operations fail (transaction errors, query failures, etc.).
 * Includes transaction digest when available for debugging.
 * 
 * @example
 * ```typescript
 * // Transaction failure
 * throw new BlockchainError('Transaction failed', transactionDigest);
 * 
 * // Query failure
 * throw new BlockchainError('Failed to query asset: object not found');
 * ```
 */
export class BlockchainError extends WalbucketError {
  constructor(message: string, public transactionDigest?: string, cause?: Error) {
    super(ErrorCode.BLOCKCHAIN_ERROR, message, cause);
    this.name = 'BlockchainError';
  }
}

/**
 * Configuration error
 * 
 * Thrown when SDK configuration is invalid (missing required fields, invalid values, etc.).
 * 
 * @example
 * ```typescript
 * // Missing required field
 * throw new ConfigurationError('API key is required');
 * 
 * // Invalid value
 * throw new ConfigurationError('Invalid network: must be "testnet" or "mainnet"');
 * ```
 */
export class ConfigurationError extends WalbucketError {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.CONFIGURATION_ERROR, message, cause);
    this.name = 'ConfigurationError';
  }
}
