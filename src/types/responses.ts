/**
 * Upload result
 */
export interface UploadResult {
  /** Asset ID (Sui object ID) */
  assetId: string;

  /** Blob ID (Walrus reference) */
  blobId: string;

  /** Asset URL (for retrieval) */
  url: string;

  /** Whether the asset is encrypted */
  encrypted: boolean;

  /** Policy ID (if encryption enabled) */
  policyId?: string;

  /** File size in bytes */
  size: number;

  /** Content type */
  contentType: string;

  /** Creation timestamp */
  createdAt: number;
}

/**
 * Asset metadata (matches contract Asset struct)
 */
export interface AssetMetadata {
  /** Asset ID */
  assetId: string;

  /** Owner address */
  owner: string;

  /** Blob ID reference to Walrus storage */
  blobId: string;

  /** Asset URL (generated from blobId and aggregator URL) */
  url: string;

  /** Asset name */
  name: string;

  /** Content type */
  contentType: string;

  /** File size in bytes */
  size: number;

  /** Creation timestamp (milliseconds) */
  createdAt: number;

  /** Last update timestamp (milliseconds) */
  updatedAt: number;

  /** Encryption policy ID (if encrypted) */
  policyId?: string;

  /** Tags */
  tags: string[];

  /** Description */
  description: string;

  /** Category */
  category: string;

  /** Image/video width in pixels */
  width?: number;

  /** Image/video height in pixels */
  height?: number;

  /** Thumbnail blob ID */
  thumbnailBlobId?: string;

  /** Folder/collection ID */
  folderId?: string;
}

/**
 * Retrieve result
 */
export interface RetrieveResult {
  /** File data as Buffer */
  data: Buffer;

  /** Asset URL for accessing the file */
  url: string;

  /** Asset metadata */
  metadata: AssetMetadata;
}

/**
 * API Key data (matches contract ApiKey struct)
 */
export interface ApiKeyData {
  /** API key object ID */
  keyId: string;

  /** Developer address */
  developerAddress: string;

  /** API key name */
  name: string;

  /** Permission flags (bit flags) */
  permissions: number;

  /** Rate limit (requests per hour, 0 = unlimited) */
  rateLimit: number;

  /** Creation timestamp (milliseconds) */
  createdAt: number;

  /** Expiration timestamp (milliseconds, 0 = no expiration) */
  expiresAt: number;

  /** Active status */
  isActive: boolean;

  /** Usage count */
  usageCount: number;

  /** Last used timestamp (milliseconds) */
  lastUsedAt: number;
}

/**
 * Policy data (matches contract EncryptionPolicy struct)
 */
export interface PolicyData {
  /** Policy ID */
  policyId: string;

  /** Asset ID this policy applies to */
  assetId: string;

  /** Policy type (0=public, 1=wallet-gated, 2=time-limited, 3=password-protected) */
  policyType: number;

  /** Allowed wallet addresses (for wallet-gated) */
  allowedAddresses: string[];

  /** Expiration timestamp (milliseconds, 0 = no expiration) */
  expiration: number;

  /** Creation timestamp (milliseconds) */
  createdAt: number;
}

/**
 * Transform result
 */
export interface TransformResult {
  /** New asset ID after transformation */
  assetId: string;

  /** New blob ID */
  blobId: string;

  /** Transformation type */
  transformType: number;

  /** Timestamp */
  timestamp: number;
}

/**
 * Folder metadata (matches contract Folder struct)
 */
export interface FolderMetadata {
  /** Folder ID (Sui object ID) */
  folderId: string;

  /** Owner address */
  owner: string;

  /** Folder name */
  name: string;

  /** Folder description */
  description: string;

  /** Parent folder ID (for nested folders) */
  parentFolderId?: string;

  /** Number of assets in this folder */
  assetCount: number;

  /** Creation timestamp (milliseconds) */
  createdAt: number;

  /** Last update timestamp (milliseconds) */
  updatedAt: number;
}

/**
 * Bucket metadata (matches contract Bucket struct - B2B shared storage)
 */
export interface BucketMetadata {
  /** Bucket ID (Sui object ID) */
  bucketId: string;

  /** Owner address */
  owner: string;

  /** Bucket name */
  name: string;

  /** Bucket description */
  description: string;

  /** Tags for categorization */
  tags: string[];

  /** Category */
  category: string;

  /** Number of collaborators */
  collaboratorCount: number;

  /** Number of assets in this bucket */
  assetCount: number;

  /** Total storage used in bytes */
  totalSize: number;

  /** Storage limit in bytes (0 = unlimited) */
  storageLimit: number;

  /** Creation timestamp (milliseconds) */
  createdAt: number;

  /** Last update timestamp (milliseconds) */
  updatedAt: number;
}

/**
 * Collaborator permission (for buckets and collections)
 */
export interface CollaboratorPermission {
  /** Collaborator address */
  address: string;

  /** Can read assets */
  canRead: boolean;

  /** Can write (upload/delete) assets */
  canWrite: boolean;

  /** Can manage collaborators */
  canAdmin: boolean;
}

/**
 * Access grant data (for sharing)
 */
export interface AccessGrantData {
  /** Grant ID */
  grantId: string;

  /** Asset ID being shared */
  assetId: string;

  /** Address that granted access */
  grantedBy: string;

  /** Address receiving access */
  grantedTo: string;

  /** Can read */
  canRead: boolean;

  /** Can write */
  canWrite: boolean;

  /** Can admin */
  canAdmin: boolean;

  /** Expiration timestamp (0 = no expiration) */
  expiresAt: number;

  /** Creation timestamp */
  createdAt: number;
}

/**
 * Shareable link data
 */
export interface ShareableLinkData {
  /** Link ID */
  linkId: string;

  /** Asset ID */
  assetId: string;

  /** Creator address */
  creator: string;

  /** Share token (for URL) */
  shareToken: string;

  /** Can read */
  canRead: boolean;

  /** Can write */
  canWrite: boolean;

  /** Can admin */
  canAdmin: boolean;

  /** Is active */
  isActive: boolean;

  /** Expiration timestamp */
  expiresAt: number;

  /** Access count */
  accessCount: number;

  /** Last accessed timestamp */
  lastAccessedAt: number;

  /** Creation timestamp */
  createdAt: number;
}
