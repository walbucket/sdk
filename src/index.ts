/**
 * Walbucket SDK
 * Cloudinary-like API for decentralized media storage on Sui
 */

// Main SDK class
export { Walbucket } from './core/walbucket.js';

// Types
export type {
  WalbucketConfig,
  SuiNetwork,
  GasStrategy,
  UploadOptions,
  RetrieveOptions,
  TransformOptions,
  FileInput,
  EncryptionPolicy,
  EncryptionPolicyType,
  UploadResult,
  AssetMetadata,
  RetrieveResult,
  ApiKeyData,
  PolicyData,
  TransformResult,
} from './types/index.js';

// Errors
export {
  WalbucketError,
  ValidationError,
  NetworkError,
  EncryptionError,
  BlockchainError,
  ConfigurationError,
  ErrorCode,
} from './types/errors.js';

// Services (for advanced usage)
export { SuiService } from './services/suiService.js';
export { WalrusService } from './services/walrusService.js';
export { ApiKeyService, PERMISSION_UPLOAD, PERMISSION_READ, PERMISSION_DELETE, PERMISSION_TRANSFORM, PERMISSION_ADMIN } from './services/apiKeyService.js';
export { SealService } from './services/sealService.js';
export { GasStrategyService } from './strategies/gasStrategy.js';
