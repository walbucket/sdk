/**
 * Encryption policy type (matches contract policy types)
 * From contract: POLICY_PUBLIC = 0, POLICY_WALLET_GATED = 1, POLICY_TIME_LIMITED = 2, POLICY_PASSWORD_PROTECTED = 3
 */
export type EncryptionPolicyType = 'public' | 'wallet-gated' | 'time-limited' | 'password-protected';

/**
 * Encryption policy configuration
 * Maps to contract EncryptionPolicy struct
 */
export interface EncryptionPolicy {
  /** Policy type */
  type: EncryptionPolicyType;
  
  /** Allowed wallet addresses (for wallet-gated policies) */
  addresses?: string[];
  
  /** Expiration timestamp in milliseconds (for time-limited policies, 0 = no expiration) */
  expiration?: number;
  
  /** Password (will be hashed before sending to contract) */
  password?: string;
}

/**
 * Upload options
 */
export interface UploadOptions {
  /** Asset name */
  name?: string;
  
  /** Folder/collection ID for organization */
  folder?: string;
  
  /** Encryption policy (if encryption enabled) */
  policy?: EncryptionPolicy;
  
  /** Tags for categorization */
  tags?: string[];
  
  /** Asset description */
  description?: string;
  
  /** Asset category */
  category?: string;
  
  /** Image/video width in pixels */
  width?: number;
  
  /** Image/video height in pixels */
  height?: number;
  
  /** Thumbnail blob ID (for previews) */
  thumbnailBlobId?: string;
  
  /** Custom metadata */
  metadata?: Record<string, any>;
  
  /** Override encryption setting from config */
  encryption?: boolean;
}

/**
 * Retrieve options
 */
export interface RetrieveOptions {
  /** Decrypt the file (default: true if encrypted) */
  decrypt?: boolean;
  
  /** Password for password-protected assets */
  password?: string;
  
  /** SessionKey for decryption (required if decrypt is true and asset is encrypted) */
  sessionKey?: any; // SessionKey from @mysten/seal
}

/**
 * Transform options
 */
export interface TransformOptions {
  /** Resize width */
  width?: number;
  
  /** Resize height */
  height?: number;
  
  /** Maintain aspect ratio */
  maintainAspect?: boolean;
  
  /** Crop coordinates */
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  /** Format conversion */
  format?: 'jpg' | 'png' | 'webp' | 'gif';
  
  /** Quality (0-100) */
  quality?: number;
  
  /** Rotation degrees (0, 90, 180, 270) */
  rotate?: number;
}

/**
 * File input type (supports multiple formats)
 */
export type FileInput = File | Blob | Buffer | Uint8Array | string;
