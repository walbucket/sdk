import { SuiService } from "../services/suiService.js";
import { WalrusService } from "../services/walrusService.js";
import {
  ApiKeyService,
  PERMISSION_UPLOAD,
  PERMISSION_READ,
  PERMISSION_DELETE,
  PERMISSION_TRANSFORM,
} from "../services/apiKeyService.js";
import { SealService } from "../services/sealService.js";
import { GasStrategyService } from "../strategies/gasStrategy.js";
import { validateConfig } from "../utils/config.js";
import { fileToBuffer, getFileName, getContentType } from "../utils/file.js";
import { Cache } from "../utils/cache.js";
import type {
  WalbucketConfig,
  UploadOptions,
  RetrieveOptions,
  TransformOptions,
  FileInput,
} from "../types/index.js";
import type {
  UploadResult,
  AssetMetadata,
  RetrieveResult,
  FolderMetadata,
  BucketMetadata,
} from "../types/responses.js";
import { ValidationError, BlockchainError } from "../types/errors.js";
import crypto from "crypto";

/**
 * Walbucket SDK
 *
 * Main entry point for interacting with the Walbucket decentralized storage system.
 * Provides a Cloudinary-like API for uploading, retrieving, and managing assets
 * on the Sui blockchain with Walrus storage.
 *
 * @example
 * ```typescript
 * import { Walbucket } from '@walbucket/sdk';
 *
 * const walbucket = new Walbucket({
 *   apiKey: 'your-api-key',
 *   network: 'testnet',
 *   packageId: '0x...',
 * });
 *
 * // Upload a file
 * const result = await walbucket.upload('path/to/file.jpg');
 * console.log('Asset ID:', result.assetId);
 * ```
 */
export class Walbucket {
  private config: Required<WalbucketConfig>;
  private suiService: SuiService;
  private walrusService: WalrusService;
  private apiKeyService: ApiKeyService;
  private sealService: SealService | null = null;
  private assetCache: Cache<AssetMetadata>;
  private signer: any; // Signer type

  /**
   * Creates a new Walbucket SDK instance
   *
   * @param config - Configuration object for the SDK
   * @param config.apiKey - Your API key for authentication (required)
   * @param config.network - Sui network to use: 'testnet', 'mainnet', 'devnet', or 'localnet' (default: 'testnet')
   * @param config.encryption - Enable Seal encryption (default: true)
   * @param config.gasStrategy - Gas payment strategy (optional, default: 'developer-sponsored')
   *   - 'developer-sponsored': Developer pays all gas fees (requires sponsorPrivateKey)
   *   - 'user-pays': Users pay their own gas fees (requires userSigner)
   * @param config.sponsorPrivateKey - Private key for developer-sponsored transactions (required if gasStrategy is 'developer-sponsored')
   * @param config.userSigner - Signer for user-pays transactions (required if gasStrategy is 'user-pays')
   * @param config.packageId - Package ID (optional - auto-detected from network)
   * @param config.walrusPublisherUrl - Custom Walrus publisher URL (optional - auto-detected from network)
   * @param config.walrusAggregatorUrl - Custom Walrus aggregator URL (optional - auto-detected from network)
   * @param config.sealServerIds - Seal server IDs for encryption (optional - auto-detected from network)
   * @param config.cacheTTL - Cache TTL in seconds (default: 3600)
   *
   * @throws {ConfigurationError} If configuration is invalid
   *
   * @example
   * ```typescript
   * // Developer-sponsored gas (default) - you pay for all transactions
   * const walbucket = new Walbucket({
   *   apiKey: 'your-api-key',
   *   network: 'testnet', // Package ID automatically selected
   *   gasStrategy: 'developer-sponsored', // Default - can omit
   *   sponsorPrivateKey: 'your-private-key', // Required
   * });
   *
   * // User-pays gas - users pay their own gas fees
   * import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
   * const userKeypair = Ed25519Keypair.fromSecretKey(/* user's key *\/);
   *
   * const walbucket = new Walbucket({
   *   apiKey: 'your-api-key',
   *   network: 'testnet',
   *   gasStrategy: 'user-pays', // Users pay gas
   *   userSigner: userKeypair, // Required
   * });
   *
   * // With encryption disabled
   * const walbucket = new Walbucket({
   *   apiKey: 'your-api-key',
   *   network: 'testnet',
   *   encryption: false,
   *   sponsorPrivateKey: 'your-private-key',
   * });
   * ```
   */
  constructor(config: WalbucketConfig) {
    // Validate and normalize configuration
    this.config = validateConfig(config) as Required<WalbucketConfig>;

    // Initialize Sui service
    // Pass signAndExecuteTransaction function for user-pays strategy
    const signAndExecuteFn =
      this.config.gasStrategy === "user-pays"
        ? this.config.signAndExecuteTransaction
        : undefined;
    const userAddress =
      this.config.gasStrategy === "user-pays"
        ? this.config.userAddress
        : undefined;
    this.suiService = new SuiService(
      this.config.network,
      this.config.packageId,
      signAndExecuteFn,
      userAddress
    );

    // Initialize Walrus service
    this.walrusService = new WalrusService(
      this.config.walrusPublisherUrl,
      this.config.walrusAggregatorUrl
    );

    // Initialize API key service
    this.apiKeyService = new ApiKeyService(
      this.suiService.getClient(),
      this.config.cacheTTL,
      this.config.network
    );

    // Initialize Seal service (lazy - only if encryption enabled)
    if (this.config.encryption) {
      this.sealService = new SealService(
        this.suiService.getClient(),
        this.config.packageId,
        this.config.sealServerIds || []
      );
      // Set SuiService for policy creation
      this.sealService.setSuiService(this.suiService);
    }

    // Initialize caches
    this.assetCache = new Cache<AssetMetadata>(this.config.cacheTTL * 1000);

    // Initialize signer based on gas strategy
    this.signer = GasStrategyService.getSigner(
      this.config.gasStrategy,
      this.config.sponsorPrivateKey
    );
  }

  /**
   * Upload file
   * Complete flow: validate API key -> encrypt (if enabled) -> upload to Walrus -> create asset on Sui
   */
  async upload(
    file: FileInput,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      // 1. Validate API key
      const apiKeyData = await this.apiKeyService.validateApiKey(
        this.config.apiKey,
        this.config.packageId
      );

      if (!this.apiKeyService.hasPermission(apiKeyData, PERMISSION_UPLOAD)) {
        throw new ValidationError("API key does not have upload permission");
      }

      // 2. Prepare file
      const fileData = await fileToBuffer(file);
      const fileName = options.name || getFileName(file);
      const contentType = getContentType(file);

      // 3. Get developer account ID
      const developerAccountId = await this.apiKeyService.getDeveloperAccountId(
        apiKeyData.developerAddress,
        this.config.packageId
      );
      if (!developerAccountId) {
        throw new ValidationError("Developer account not found");
      }

      const apiKeyHash = this.hashApiKey(this.config.apiKey);
      const encryptionEnabled = options.encryption ?? this.config.encryption;
      let policyId: string | undefined;
      let blobId: string;
      let assetId: string;

      // 4. Handle encryption flow
      if (encryptionEnabled && options.policy) {
        if (!this.sealService) {
          throw new ValidationError(
            "Seal service not initialized. Encryption requires Seal SDK."
          );
        }

        // For encryption, we need to:
        // 1. Upload plain file to get blobId
        // 2. Create asset (contract requires asset before policy)
        // 3. Create policy on-chain
        // 4. Encrypt with policy ID
        // 5. Upload encrypted file
        // Note: Asset will have plain blobId, but we'll use encrypted for retrieval

        // Step 1: Upload plain file first
        const plainBlobId = await this.walrusService.upload(fileData, {
          permanent: false,
        });

        // Step 2: Create asset on Sui (required before policy creation per contract)
        // For encryption flow, we still need to use API key path for now
        // because policy creation requires API key objects
        // TODO: Consider if we can support user-pays with encryption
        assetId = await this.suiService.createAsset({
          blobId: plainBlobId,
          name: fileName,
          contentType,
          size: fileData.length,
          tags: options.tags || [],
          description: options.description || "",
          category: options.category || "",
          width: options.width,
          height: options.height,
          thumbnailBlobId: options.thumbnailBlobId,
          folderId: options.folder,
          apiKeyId: apiKeyData.keyId,
          apiKeyHash,
          developerAccountId,
          signer: this.signer,
        });

        // Step 3: Create policy on-chain (requires assetId)
        policyId = await this.sealService.createPolicyOnChain({
          assetId,
          policy: options.policy,
          apiKeyId: apiKeyData.keyId,
          apiKeyHash,
          developerAccountId,
          signer: this.signer,
        });

        // Step 4: Apply policy to asset
        await this.suiService.applyPolicyToAsset({
          assetId,
          policyId,
          apiKeyId: apiKeyData.keyId,
          apiKeyHash,
          developerAccountId,
          signer: this.signer,
        });

        // Step 5: Encrypt file with policy ID
        const encryptedData = await this.sealService.encrypt(
          fileData,
          policyId,
          2 // threshold
        );

        // Step 6: Upload encrypted file to Walrus
        blobId = await this.walrusService.upload(encryptedData, {
          permanent: false,
        });

        // Note: Asset has plain blobId, but encrypted version is in blobId
        // For retrieval, we'll use the encrypted blobId
        // In production, you might want to store both or handle differently
      } else {
        // No encryption: Simple flow
        // 5. Upload to Walrus
        blobId = await this.walrusService.upload(fileData, {
          permanent: false,
        });

        // 6. Create asset on Sui
        // Use user-pays upload path when gasStrategy is user-pays
        // This ensures assets are owned by the user's wallet address
        if (this.config.gasStrategy === "user-pays") {
          assetId = await this.suiService.uploadAssetUserPays({
            blobId,
            name: fileName,
            contentType,
            size: fileData.length,
            tags: options.tags || [],
            description: options.description || "",
            category: options.category || "",
            width: options.width,
            height: options.height,
            thumbnailBlobId: options.thumbnailBlobId,
            folderId: options.folder,
          });
        } else {
          // Developer-sponsored: use API key path
          assetId = await this.suiService.createAsset({
            blobId,
            name: fileName,
            contentType,
            size: fileData.length,
            tags: options.tags || [],
            description: options.description || "",
            category: options.category || "",
            width: options.width,
            height: options.height,
            thumbnailBlobId: options.thumbnailBlobId,
            folderId: options.folder,
            apiKeyId: apiKeyData.keyId,
            apiKeyHash,
            developerAccountId,
            signer: this.signer,
          });
        }
      }

      // 7. Return result
      return {
        assetId,
        blobId,
        url: this.generateFileUrl(blobId),
        encrypted: encryptionEnabled,
        policyId,
        size: fileData.length,
        contentType,
        createdAt: Date.now(),
      };
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Upload failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Retrieve a file from Walbucket
   *
   * Complete flow:
   * 1. Validates API key and permissions
   * 2. Fetches asset metadata from Sui (cached)
   * 3. Retrieves file data from Walrus storage
   * 4. Decrypts file if encrypted (requires SessionKey)
   *
   * @param assetId - Asset ID to retrieve
   * @param options - Retrieve options
   * @param options.decrypt - Whether to decrypt the file (default: true if encrypted)
   * @param options.password - Password for password-protected assets
   * @param options.sessionKey - SessionKey from @mysten/seal (required for decryption)
   *
   * @returns RetrieveResult with file data, URL, and metadata
   *
   * @throws {ValidationError} If API key is invalid, lacks read permission, or SessionKey is missing for encrypted assets
   * @throws {NetworkError} If Walrus retrieval fails
   * @throws {BlockchainError} If asset not found on Sui
   * @throws {EncryptionError} If decryption fails
   *
   * @example
   * ```typescript
   * // Basic retrieve
   * const result = await walbucket.retrieve(assetId);
   * console.log('File data:', result.data);
   * console.log('File URL:', result.url);
   * console.log('Metadata:', result.metadata);
   *
   * // Retrieve with decryption
   * import { SealClient } from '@mysten/seal';
   * const sealClient = new SealClient(...);
   * const sessionKey = await sealClient.getSessionKey(policyId);
   * const result = await walbucket.retrieve(assetId, {
   *   sessionKey,
   * });
   * ```
   */
  async retrieve(
    assetId: string,
    options: RetrieveOptions = {}
  ): Promise<RetrieveResult> {
    try {
      // 1. Validate API key
      const apiKeyData = await this.apiKeyService.validateApiKey(
        this.config.apiKey,
        this.config.packageId
      );

      if (!this.apiKeyService.hasPermission(apiKeyData, PERMISSION_READ)) {
        throw new ValidationError("API key does not have read permission");
      }

      // 2. Get asset metadata (cached)
      let asset = this.assetCache.get(assetId);
      if (!asset) {
        asset = await this.suiService.getAsset(assetId);
        if (!asset) {
          throw new ValidationError("Asset not found");
        }
        // Generate URL for the asset
        asset.url = this.generateFileUrl(asset.blobId);
        this.assetCache.set(assetId, asset);
      }

      // 3. Retrieve blob from Walrus
      const encryptedData = await this.walrusService.retrieve(asset.blobId);

      // 4. Decrypt if encrypted and decrypt option is true
      const shouldDecrypt = options.decrypt ?? asset.policyId !== undefined;

      if (shouldDecrypt && asset.policyId) {
        if (!this.sealService) {
          throw new ValidationError(
            "Seal service not initialized. Decryption requires Seal SDK."
          );
        }

        if (!options.sessionKey) {
          throw new ValidationError(
            "SessionKey is required for decryption. " +
              "Create a SessionKey using @mysten/seal SessionKey.create() and provide it in retrieve options."
          );
        }

        // Decrypt using Seal SDK
        const decryptedData = await this.sealService.decrypt(
          encryptedData,
          asset.policyId,
          options.sessionKey
        );

        return {
          data: decryptedData,
          url: this.generateFileUrl(asset.blobId),
          metadata: asset,
        };
      }

      return {
        data: encryptedData,
        url: this.generateFileUrl(asset.blobId),
        metadata: asset,
      };
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Retrieve failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete asset
   * Complete flow: validate API key -> get asset metadata -> delete from Walrus -> delete from Sui
   */
  async delete(assetId: string): Promise<void> {
    try {
      // 1. Validate API key
      const apiKeyData = await this.apiKeyService.validateApiKey(
        this.config.apiKey,
        this.config.packageId
      );

      if (!this.apiKeyService.hasPermission(apiKeyData, PERMISSION_DELETE)) {
        throw new ValidationError("API key does not have delete permission");
      }

      // 2. Get asset metadata
      let asset = this.assetCache.get(assetId);
      if (!asset) {
        asset = await this.suiService.getAsset(assetId);
        if (!asset) {
          throw new ValidationError("Asset not found");
        }
      }

      // 3. Get developer account ID
      const developerAccountId = await this.apiKeyService.getDeveloperAccountId(
        apiKeyData.developerAddress,
        this.config.packageId
      );
      if (!developerAccountId) {
        throw new ValidationError("Developer account not found");
      }

      // 4. Delete from Sui (this will fail if not owner, which is correct)
      const apiKeyHash = this.hashApiKey(this.config.apiKey);
      await this.suiService.deleteAsset({
        assetId,
        apiKeyHash,
        apiKeyId: apiKeyData.keyId,
        developerAccountId,
        signer: this.signer,
      });

      // 5. Delete from Walrus (optional - may not be supported for permanent blobs)
      try {
        await this.walrusService.delete(asset.blobId);
      } catch (error) {
        // Ignore Walrus deletion errors (may not be supported)
      }

      // 6. Clear cache
      this.assetCache.delete(assetId);
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Delete failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Transform an asset (placeholder)
   *
   * Creates a transformation request on-chain for tracking.
   * **Note**: Actual image processing requires an external service (backend API) or
   * an image processing library like Sharp. This method is a placeholder that
   * validates the request and explains the limitation.
   *
   * @param assetId - Asset ID to transform
   * @param options - Transform options
   * @param options.width - Resize width
   * @param options.height - Resize height
   * @param options.maintainAspect - Maintain aspect ratio (default: true)
   * @param options.crop - Crop coordinates { x, y, width, height }
   * @param options.format - Format conversion ('jpg', 'png', 'webp', 'gif')
   * @param options.quality - Quality 0-100
   * @param options.rotate - Rotation degrees (0, 90, 180, 270)
   *
   * @returns Transformation result (currently throws error explaining limitation)
   *
   * @throws {ValidationError} If API key lacks transform permission or transform requires external processing
   *
   * @example
   * ```typescript
   * // Note: This will throw an error explaining that image processing
   * // requires external service. Use backend API for transformations.
   * try {
   *   const result = await walbucket.transform(assetId, {
   *     width: 800,
   *     height: 600,
   *     format: 'webp',
   *     quality: 80,
   *   });
   * } catch (error) {
   *   // Use backend API for transformations
   * }
   * ```
   */
  async transform(
    assetId: string,
    options: TransformOptions
  ): Promise<{ assetId: string; blobId: string; requestId: string }> {
    try {
      // 1. Validate API key
      const apiKeyData = await this.apiKeyService.validateApiKey(
        this.config.apiKey,
        this.config.packageId
      );

      if (!this.apiKeyService.hasPermission(apiKeyData, PERMISSION_TRANSFORM)) {
        throw new ValidationError("API key does not have transform permission");
      }

      // 2. Get asset metadata
      const asset = await this.suiService.getAsset(assetId);
      if (!asset) {
        throw new ValidationError("Asset not found");
      }

      // 3. Get developer account ID
      const developerAccountId = await this.apiKeyService.getDeveloperAccountId(
        apiKeyData.developerAddress,
        this.config.packageId
      );
      if (!developerAccountId) {
        throw new ValidationError("Developer account not found");
      }

      // 4. Determine transformation type and encode parameters
      // Contract: TRANSFORM_RESIZE=0, TRANSFORM_CROP=1, TRANSFORM_FORMAT=2, TRANSFORM_QUALITY=3, TRANSFORM_ROTATE=4
      let transformType = 0; // Default to resize
      const parameters: number[] = [];

      if (options.width || options.height) {
        transformType = 0; // RESIZE
        // Parameters: width (u64), height (u64), maintain_aspect (bool)
        // BCS encoding would be done by the contract, but we need to prepare the data
        // For now, we'll create a simple request
      } else if (options.crop) {
        transformType = 1; // CROP
        // Parameters: x, y, width, height
      } else if (options.format) {
        transformType = 2; // FORMAT
        // Parameters: format string
      } else if (options.quality !== undefined) {
        transformType = 3; // QUALITY
        // Parameters: quality (u8)
      } else if (options.rotate !== undefined) {
        transformType = 4; // ROTATE
        // Parameters: degrees (u64)
      }

      // 5. Create transformation request on-chain
      // Note: This creates a request for tracking. Actual processing happens off-chain
      // The contract function: request_transformation_with_api_key
      const apiKeyHash = this.hashApiKey(this.config.apiKey);

      // For MVP: Return the asset ID and note that transformation requires external processing
      // In production, you would:
      // 1. Process the image (using Sharp or similar)
      // 2. Upload transformed blob to Walrus
      // 3. Call transform_asset_with_api_key with the new blob ID

      throw new ValidationError(
        "Transform functionality requires image processing library (e.g., Sharp). " +
          "For now, use the backend API for transformations, or implement client-side processing."
      );
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Transform failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get asset metadata from Sui blockchain
   *
   * Fetches asset metadata including blob ID, name, size, content type, tags, etc.
   * Results are cached to reduce blockchain queries.
   *
   * @param assetId - Asset ID to query
   *
   * @returns Asset metadata or null if not found
   *
   * @throws {BlockchainError} If query fails
   *
   * @example
   * ```typescript
   * const asset = await walbucket.getAsset(assetId);
   * if (asset) {
   *   console.log('Name:', asset.name);
   *   console.log('Size:', asset.size);
   *   console.log('Blob ID:', asset.blobId);
   * }
   * ```
   */
  async getAsset(assetId: string): Promise<AssetMetadata | null> {
    // Check cache first
    const cached = this.assetCache.get(assetId);
    if (cached) {
      return cached;
    }

    // Get from blockchain
    const asset = await this.suiService.getAsset(assetId);
    if (asset) {
      // Generate URL for the asset
      asset.url = this.generateFileUrl(asset.blobId);
      this.assetCache.set(assetId, asset);
    }

    return asset;
  }

  /**
   * Rename an asset
   *
   * Renames an asset on the Sui blockchain. Supports both user-pays and developer-sponsored gas strategies.
   *
   * @param assetId - Asset ID to rename
   * @param newName - New name for the asset
   *
   * @throws {ValidationError} If configuration is invalid
   * @throws {BlockchainError} If rename fails
   *
   * @example
   * ```typescript
   * await walbucket.rename('0x...', 'new-name.jpg');
   * ```
   */
  async rename(assetId: string, newName: string): Promise<void> {
    try {
      if (this.config.gasStrategy === "user-pays") {
        // User-pays transaction
        await this.suiService.renameAsset({
          assetId,
          newName,
        });
      } else {
        // Developer-sponsored transaction
        const apiKeyData = await this.apiKeyService.validateApiKey(
          this.config.apiKey,
          this.config.packageId
        );

        const developerAccountId =
          await this.apiKeyService.getDeveloperAccountId(
            apiKeyData.developerAddress,
            this.config.packageId
          );
        if (!developerAccountId) {
          throw new ValidationError("Developer account not found");
        }

        await this.suiService.renameAssetWithApiKey({
          assetId,
          newName,
          apiKeyHash: this.config.apiKey,
          apiKeyId: apiKeyData.keyId,
          developerAccountId,
          signer: this.signer,
        });
      }

      // Clear cache to force refresh
      this.assetCache.delete(assetId);
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Rename failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Copy an asset
   *
   * Creates a duplicate of an asset with a new name. Supports both user-pays and developer-sponsored gas strategies.
   *
   * @param assetId - Asset ID to copy
   * @param newName - Name for the copied asset
   *
   * @throws {ValidationError} If configuration is invalid
   * @throws {BlockchainError} If copy fails
   *
   * @example
   * ```typescript
   * await walbucket.copy('0x...', 'copy-of-file.jpg');
   * ```
   */
  async copy(assetId: string, newName: string): Promise<void> {
    try {
      if (this.config.gasStrategy === "user-pays") {
        // User-pays transaction
        await this.suiService.copyAsset({
          assetId,
          newName,
        });
      } else {
        // Developer-sponsored transaction
        const apiKeyData = await this.apiKeyService.validateApiKey(
          this.config.apiKey,
          this.config.packageId
        );

        const developerAccountId =
          await this.apiKeyService.getDeveloperAccountId(
            apiKeyData.developerAddress,
            this.config.packageId
          );
        if (!developerAccountId) {
          throw new ValidationError("Developer account not found");
        }

        await this.suiService.copyAssetWithApiKey({
          assetId,
          newName,
          apiKeyHash: this.config.apiKey,
          apiKeyId: apiKeyData.keyId,
          developerAccountId,
          signer: this.signer,
        });
      }
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Copy failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete an asset (user-pays version)
   *
   * Deletes an asset where the user pays gas fees. For developer-pays, use delete().
   *
   * @param assetId - Asset ID to delete
   *
   * @throws {ValidationError} If user-pays strategy not configured
   * @throws {BlockchainError} If deletion fails
   *
   * @example
   * ```typescript
   * await walbucket.deleteUserPays('0x...');
   * ```
   */
  async deleteUserPays(assetId: string): Promise<void> {
    try {
      if (this.config.gasStrategy !== "user-pays") {
        throw new ValidationError(
          "deleteUserPays requires user-pays gas strategy (user must sign)"
        );
      }

      // Get asset metadata
      let asset = this.assetCache.get(assetId);
      if (!asset) {
        asset = await this.suiService.getAsset(assetId);
        if (!asset) {
          throw new ValidationError("Asset not found");
        }
      }

      // Delete from Sui blockchain
      await this.suiService.deleteAssetUserPays({ assetId });

      // Delete from Walrus (optional - may not be supported for permanent blobs)
      try {
        await this.walrusService.delete(asset.blobId);
      } catch (error) {
        // Ignore Walrus deletion errors (may not be supported)
      }

      // Clear cache
      this.assetCache.delete(assetId);
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Delete failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a folder
   *
   * Creates a new folder for organizing assets. Supports both user-pays and developer-sponsored gas strategies.
   *
   * @param name - Folder name
   * @param description - Folder description
   * @param parentFolderId - Optional parent folder ID for nested folders
   *
   * @throws {ValidationError} If configuration is invalid
   * @throws {BlockchainError} If creation fails
   *
   * @example
   * ```typescript
   * await walbucket.createFolder('My Photos', 'Personal photo collection');
   * ```
   */
  async createFolder(
    name: string,
    description: string = "",
    parentFolderId?: string
  ): Promise<void> {
    try {
      if (this.config.gasStrategy === "user-pays") {
        // User-pays transaction
        await this.suiService.createFolder({
          name,
          description,
          parentFolderId,
        });
      } else {
        // Developer-sponsored transaction
        const apiKeyData = await this.apiKeyService.validateApiKey(
          this.config.apiKey,
          this.config.packageId
        );

        const developerAccountId =
          await this.apiKeyService.getDeveloperAccountId(
            apiKeyData.developerAddress,
            this.config.packageId
          );
        if (!developerAccountId) {
          throw new ValidationError("Developer account not found");
        }

        await this.suiService.createFolderWithApiKey({
          name,
          description,
          parentFolderId,
          apiKeyHash: this.config.apiKey,
          apiKeyId: apiKeyData.keyId,
          developerAccountId,
          signer: this.signer,
        });
      }
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Create folder failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete a folder
   *
   * Deletes an empty folder. Supports both user-pays and developer-sponsored gas strategies.
   * Note: Folder must be empty before deletion.
   *
   * @param folderId - Folder ID to delete
   *
   * @throws {ValidationError} If configuration is invalid or folder not empty
   * @throws {BlockchainError} If deletion fails
   *
   * @example
   * ```typescript
   * await walbucket.deleteFolder('0x...');
   * ```
   */
  async deleteFolder(folderId: string): Promise<void> {
    try {
      if (this.config.gasStrategy === "user-pays") {
        // User-pays transaction
        await this.suiService.deleteFolder({ folderId });
      } else {
        // Developer-sponsored transaction
        const apiKeyData = await this.apiKeyService.validateApiKey(
          this.config.apiKey,
          this.config.packageId
        );

        const developerAccountId =
          await this.apiKeyService.getDeveloperAccountId(
            apiKeyData.developerAddress,
            this.config.packageId
          );
        if (!developerAccountId) {
          throw new ValidationError("Developer account not found");
        }

        await this.suiService.deleteFolderWithApiKey({
          folderId,
          apiKeyHash: this.config.apiKey,
          apiKeyId: apiKeyData.keyId,
          developerAccountId,
          signer: this.signer,
        });
      }
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Delete folder failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List all folders
   *
   * Retrieves all folders owned by the current user or a specified owner.
   * Returns folder metadata including name, description, asset count, and timestamps.
   *
   * @param owner - Optional owner address (defaults to current user)
   * @returns Array of folder metadata
   *
   * @throws {BlockchainError} If query fails
   *
   * @example
   * ```typescript
   * // List current user's folders
   * const folders = await walbucket.listFolders();
   *
   * // List specific user's folders
   * const userFolders = await walbucket.listFolders('0x...');
   *
   * for (const folder of folders) {
   *   console.log(`${folder.name}: ${folder.assetCount} assets`);
   * }
   * ```
   */
  async listFolders(owner?: string): Promise<FolderMetadata[]> {
    return this.suiService.listFolders(owner);
  }

  /**
   * Move asset to folder
   *
   * Moves an asset into a folder or removes it from a folder. Supports both user-pays and developer-sponsored gas strategies.
   *
   * @param assetId - Asset ID to move
   * @param folderId - Folder ID to move to (undefined to remove from folder)
   *
   * @throws {ValidationError} If configuration is invalid
   * @throws {BlockchainError} If move fails
   *
   * @example
   * ```typescript
   * // Move to folder
   * await walbucket.moveToFolder('0x...asset', '0x...folder');
   *
   * // Remove from folder
   * await walbucket.moveToFolder('0x...asset', undefined);
   * ```
   */
  async moveToFolder(assetId: string, folderId?: string): Promise<void> {
    try {
      if (this.config.gasStrategy === "user-pays") {
        // User-pays transaction
        await this.suiService.moveAssetToFolder({
          assetId,
          folderId,
        });
      } else {
        // Developer-sponsored transaction
        const apiKeyData = await this.apiKeyService.validateApiKey(
          this.config.apiKey,
          this.config.packageId
        );

        const developerAccountId =
          await this.apiKeyService.getDeveloperAccountId(
            apiKeyData.developerAddress,
            this.config.packageId
          );
        if (!developerAccountId) {
          throw new ValidationError("Developer account not found");
        }

        await this.suiService.moveAssetToFolderWithApiKey({
          assetId,
          folderId,
          apiKeyHash: this.config.apiKey,
          apiKeyId: apiKeyData.keyId,
          developerAccountId,
          signer: this.signer,
        });
      }

      // Clear cache to force refresh
      this.assetCache.delete(assetId);
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Move to folder failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  // ============================================================================
  // B2B Bucket Operations
  // ============================================================================

  /**
   * Create a new shared bucket for B2B collaborative storage
   *
   * Creates a shared bucket that can have multiple collaborators.
   * Note: Only user-pays mode is supported for bucket creation.
   *
   * @param name - Bucket name
   * @param options - Bucket options
   * @param options.description - Bucket description
   * @param options.tags - Tags for categorization
   * @param options.category - Bucket category
   * @param options.storageLimit - Storage limit in bytes (0 = unlimited)
   *
   * @throws {BlockchainError} If creation fails
   *
   * @example
   * ```typescript
   * await walbucket.createBucket('Team Assets', {
   *   description: 'Shared storage for team assets',
   *   tags: ['team', 'assets'],
   *   category: 'work'
   * });
   * ```
   */
  async createBucket(
    name: string,
    options: {
      description?: string;
      tags?: string[];
      category?: string;
      storageLimit?: number;
    } = {}
  ): Promise<void> {
    return this.suiService.createBucket({
      name,
      description: options.description || "",
      tags: options.tags,
      category: options.category,
      storageLimit: options.storageLimit,
    });
  }

  /**
   * List all buckets owned by the user
   *
   * @param owner - Optional owner address (defaults to current user)
   * @returns Array of bucket metadata
   *
   * @throws {BlockchainError} If query fails
   *
   * @example
   * ```typescript
   * const buckets = await walbucket.listBuckets();
   * for (const bucket of buckets) {
   *   console.log(`${bucket.name}: ${bucket.assetCount} assets, ${bucket.collaboratorCount} collaborators`);
   * }
   * ```
   */
  async listBuckets(owner?: string): Promise<BucketMetadata[]> {
    return this.suiService.listOwnedBuckets(owner);
  }

  /**
   * Get a specific bucket by ID
   *
   * @param bucketId - Bucket ID to fetch
   * @returns Bucket metadata or null if not found
   *
   * @throws {BlockchainError} If query fails
   *
   * @example
   * ```typescript
   * const bucket = await walbucket.getBucket('0x...');
   * if (bucket) {
   *   console.log(`${bucket.name}: ${bucket.assetCount} assets`);
   * }
   * ```
   */
  async getBucket(bucketId: string): Promise<BucketMetadata | null> {
    return this.suiService.getBucket(bucketId);
  }

  /**
   * Add a collaborator to a bucket
   *
   * @param bucketId - Bucket ID
   * @param collaborator - Address of the collaborator
   * @param permissions - Permission settings
   *
   * @throws {BlockchainError} If operation fails
   *
   * @example
   * ```typescript
   * // Add read-only collaborator
   * await walbucket.addCollaborator('0x...bucket', '0x...user', {
   *   canRead: true,
   *   canWrite: false,
   *   canAdmin: false
   * });
   *
   * // Add full-access collaborator
   * await walbucket.addCollaborator('0x...bucket', '0x...user', {
   *   canRead: true,
   *   canWrite: true,
   *   canAdmin: true
   * });
   * ```
   */
  async addCollaborator(
    bucketId: string,
    collaborator: string,
    permissions: {
      canRead?: boolean;
      canWrite?: boolean;
      canAdmin?: boolean;
    } = {}
  ): Promise<void> {
    return this.suiService.addCollaborator({
      bucketId,
      collaborator,
      canRead: permissions.canRead ?? true,
      canWrite: permissions.canWrite ?? false,
      canAdmin: permissions.canAdmin ?? false,
    });
  }

  /**
   * Remove a collaborator from a bucket
   *
   * @param bucketId - Bucket ID
   * @param collaborator - Address of the collaborator to remove
   *
   * @throws {BlockchainError} If operation fails
   *
   * @example
   * ```typescript
   * await walbucket.removeCollaborator('0x...bucket', '0x...user');
   * ```
   */
  async removeCollaborator(
    bucketId: string,
    collaborator: string
  ): Promise<void> {
    return this.suiService.removeCollaborator({ bucketId, collaborator });
  }

  /**
   * Update collaborator permissions
   *
   * @param bucketId - Bucket ID
   * @param collaborator - Address of the collaborator
   * @param permissions - New permission settings
   *
   * @throws {BlockchainError} If operation fails
   *
   * @example
   * ```typescript
   * // Upgrade to write access
   * await walbucket.updateCollaboratorPermissions('0x...bucket', '0x...user', {
   *   canRead: true,
   *   canWrite: true,
   *   canAdmin: false
   * });
   * ```
   */
  async updateCollaboratorPermissions(
    bucketId: string,
    collaborator: string,
    permissions: {
      canRead?: boolean;
      canWrite?: boolean;
      canAdmin?: boolean;
    }
  ): Promise<void> {
    return this.suiService.updateCollaboratorPermissions({
      bucketId,
      collaborator,
      canRead: permissions.canRead ?? true,
      canWrite: permissions.canWrite ?? false,
      canAdmin: permissions.canAdmin ?? false,
    });
  }

  /**
   * Add an asset to a bucket
   *
   * @param bucketId - Bucket ID
   * @param assetId - Asset ID to add
   *
   * @throws {BlockchainError} If operation fails
   *
   * @example
   * ```typescript
   * await walbucket.addAssetToBucket('0x...bucket', '0x...asset');
   * ```
   */
  async addAssetToBucket(bucketId: string, assetId: string): Promise<void> {
    return this.suiService.addAssetToBucket({ bucketId, assetId });
  }

  /**
   * Remove an asset from a bucket
   *
   * @param bucketId - Bucket ID
   * @param assetId - Asset ID to remove
   *
   * @throws {BlockchainError} If operation fails
   *
   * @example
   * ```typescript
   * await walbucket.removeAssetFromBucket('0x...bucket', '0x...asset');
   * ```
   */
  async removeAssetFromBucket(
    bucketId: string,
    assetId: string
  ): Promise<void> {
    return this.suiService.removeAssetFromBucket({ bucketId, assetId });
  }

  /**
   * Share an asset with a specific address
   *
   * Creates an access grant for another user to access your asset. Supports both user-pays and developer-sponsored gas strategies.
   *
   * @param assetId - Asset ID to share
   * @param grantedTo - Address of the user receiving access
   * @param options - Sharing options
   * @param options.canRead - Allow read access (default: true)
   * @param options.canWrite - Allow write access (default: false)
   * @param options.canAdmin - Allow admin access (default: false)
   * @param options.expiresAt - Expiration timestamp in ms (optional)
   * @param options.passwordHash - Password hash for protection (optional)
   *
   * @throws {ValidationError} If configuration is invalid
   * @throws {BlockchainError} If sharing fails
   *
   * @example
   * ```typescript
   * // Share with read-only access
   * await walbucket.shareAsset('0x...asset', '0x...recipient', {
   *   canRead: true,
   *   canWrite: false,
   *   canAdmin: false
   * });
   *
   * // Share with expiration (7 days)
   * const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
   * await walbucket.shareAsset('0x...asset', '0x...recipient', {
   *   canRead: true,
   *   expiresAt
   * });
   * ```
   */
  async shareAsset(
    assetId: string,
    grantedTo: string,
    options: {
      canRead?: boolean;
      canWrite?: boolean;
      canAdmin?: boolean;
      expiresAt?: number;
      passwordHash?: string;
    } = {}
  ): Promise<void> {
    try {
      const {
        canRead = true,
        canWrite = false,
        canAdmin = false,
        expiresAt,
        passwordHash,
      } = options;

      if (this.config.gasStrategy === "user-pays") {
        // User-pays transaction
        await this.suiService.shareAsset({
          assetId,
          grantedTo,
          canRead,
          canWrite,
          canAdmin,
          expiresAt,
          passwordHash,
        });
      } else {
        // Developer-sponsored transaction
        const apiKeyData = await this.apiKeyService.validateApiKey(
          this.config.apiKey,
          this.config.packageId
        );

        const developerAccountId =
          await this.apiKeyService.getDeveloperAccountId(
            apiKeyData.developerAddress,
            this.config.packageId
          );
        if (!developerAccountId) {
          throw new ValidationError("Developer account not found");
        }

        await this.suiService.shareAssetWithApiKey({
          assetId,
          grantedTo,
          canRead,
          canWrite,
          canAdmin,
          expiresAt,
          passwordHash,
          apiKeyHash: this.config.apiKey,
          apiKeyId: apiKeyData.keyId,
          developerAccountId,
          signer: this.signer,
        });
      }
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Share asset failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a shareable link for an asset
   *
   * Creates a public shareable link that anyone with the link can use to access the asset. Supports both user-pays and developer-sponsored gas strategies.
   *
   * @param assetId - Asset ID to create link for
   * @param options - Link options
   * @param options.shareToken - Unique token for the link (will be in URL)
   * @param options.canRead - Allow read access (default: true)
   * @param options.canWrite - Allow write access (default: false)
   * @param options.canAdmin - Allow admin access (default: false)
   * @param options.expiresAt - Expiration timestamp in ms (optional)
   * @param options.passwordHash - Password hash for protection (optional)
   *
   * @throws {ValidationError} If configuration is invalid
   * @throws {BlockchainError} If link creation fails
   *
   * @example
   * ```typescript
   * // Create a read-only shareable link
   * const token = crypto.randomUUID();
   * await walbucket.createShareableLink('0x...asset', {
   *   shareToken: token,
   *   canRead: true
   * });
   *
   * // Link URL would be: https://yourapp.com/share/{token}
   * ```
   */
  async createShareableLink(
    assetId: string,
    options: {
      shareToken: string;
      canRead?: boolean;
      canWrite?: boolean;
      canAdmin?: boolean;
      expiresAt?: number;
      passwordHash?: string;
    }
  ): Promise<void> {
    try {
      const {
        shareToken,
        canRead = true,
        canWrite = false,
        canAdmin = false,
        expiresAt,
        passwordHash,
      } = options;

      if (!shareToken) {
        throw new ValidationError("shareToken is required");
      }

      if (this.config.gasStrategy === "user-pays") {
        // User-pays transaction
        await this.suiService.createShareableLink({
          assetId,
          shareToken,
          canRead,
          canWrite,
          canAdmin,
          expiresAt,
          passwordHash,
        });
      } else {
        // Developer-sponsored transaction
        const apiKeyData = await this.apiKeyService.validateApiKey(
          this.config.apiKey,
          this.config.packageId
        );

        const developerAccountId =
          await this.apiKeyService.getDeveloperAccountId(
            apiKeyData.developerAddress,
            this.config.packageId
          );
        if (!developerAccountId) {
          throw new ValidationError("Developer account not found");
        }

        await this.suiService.createShareableLinkWithApiKey({
          assetId,
          shareToken,
          canRead,
          canWrite,
          canAdmin,
          expiresAt,
          passwordHash,
          apiKeyHash: this.config.apiKey,
          apiKeyId: apiKeyData.keyId,
          developerAccountId,
          signer: this.signer,
        });
      }
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Create shareable link failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Revoke an access grant or shareable link
   *
   * Revokes previously granted access to an asset. Supports both user-pays and developer-sponsored gas strategies.
   *
   * @param grantId - ID of the AccessGrant or ShareableLink to revoke
   *
   * @throws {ValidationError} If configuration is invalid
   * @throws {BlockchainError} If revocation fails
   *
   * @example
   * ```typescript
   * await walbucket.revokeShare('0x...grantId');
   * ```
   */
  async revokeShare(grantId: string): Promise<void> {
    try {
      if (this.config.gasStrategy === "user-pays") {
        // User-pays transaction
        await this.suiService.revokeShare({ grantId });
      } else {
        // Developer-sponsored transaction
        const apiKeyData = await this.apiKeyService.validateApiKey(
          this.config.apiKey,
          this.config.packageId
        );

        const developerAccountId =
          await this.apiKeyService.getDeveloperAccountId(
            apiKeyData.developerAddress,
            this.config.packageId
          );
        if (!developerAccountId) {
          throw new ValidationError("Developer account not found");
        }

        await this.suiService.revokeShareWithApiKey({
          grantId,
          apiKeyHash: this.config.apiKey,
          apiKeyId: apiKeyData.keyId,
          developerAccountId,
          signer: this.signer,
        });
      }
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Revoke share failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deactivate a shareable link
   *
   * Deactivates a shareable link, preventing further access via that link.
   *
   * @param linkId - ID of the ShareableLink to deactivate
   *
   * @throws {ValidationError} If configuration is invalid
   * @throws {BlockchainError} If deactivation fails
   *
   * @example
   * ```typescript
   * await walbucket.deactivateShareableLink('0x...linkId');
   * ```
   */
  async deactivateShareableLink(linkId: string): Promise<void> {
    try {
      if (this.config.gasStrategy === "user-pays") {
        // User-pays transaction
        await this.suiService.deactivateShareableLink({ linkId });
      } else {
        // Developer-sponsored transaction
        const apiKeyData = await this.apiKeyService.validateApiKey(
          this.config.apiKey,
          this.config.packageId
        );

        const developerAccountId =
          await this.apiKeyService.getDeveloperAccountId(
            apiKeyData.developerAddress,
            this.config.packageId
          );
        if (!developerAccountId) {
          throw new ValidationError("Developer account not found");
        }

        await this.suiService.deactivateShareableLinkWithApiKey({
          linkId,
          apiKeyHash: this.config.apiKey,
          apiKeyId: apiKeyData.keyId,
          developerAccountId,
          signer: this.signer,
        });
      }
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Deactivate shareable link failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Track shareable link access
   *
   * Updates the access statistics for a shareable link (access count, last accessed time).
   * Call this when a link is accessed to update the tracking information.
   *
   * @param linkId - ID of the ShareableLink to track access for
   *
   * @throws {ValidationError} If configuration is invalid
   * @throws {BlockchainError} If tracking fails
   *
   * @example
   * ```typescript
   * await walbucket.trackLinkAccess('0x...linkId');
   * ```
   */
  async trackLinkAccess(linkId: string): Promise<void> {
    try {
      // This method only supports user-pays transactions
      if (this.config.gasStrategy !== "user-pays") {
        throw new ValidationError(
          "trackLinkAccess only supports user-pays gas strategy"
        );
      }

      await this.suiService.trackLinkAccess({ linkId });
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `Track link access failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List access grants for an address
   *
   * Queries all AccessGrant objects owned by the given address.
   *
   * @param owner - Optional owner address (defaults to signer's address)
   *
   * @returns Array of access grant metadata
   *
   * @throws {ValidationError} If no owner provided and signer not available
   * @throws {BlockchainError} If query fails
   *
   * @example
   * ```typescript
   * const grants = await walbucket.listAccessGrants();
   * ```
   */
  async listAccessGrants(owner?: string): Promise<any[]> {
    try {
      const ownerAddress = owner || this.config.userAddress;
      if (!ownerAddress) {
        throw new ValidationError(
          "Owner address required. Provide owner parameter or configure userAddress."
        );
      }
      return await this.suiService.listAccessGrants(ownerAddress);
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `List access grants failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List shareable links created by an address
   *
   * Queries all ShareableLink objects owned by the given address.
   *
   * @param owner - Optional owner address (defaults to signer's address)
   *
   * @returns Array of shareable link metadata
   *
   * @throws {ValidationError} If no owner provided and signer not available
   * @throws {BlockchainError} If query fails
   *
   * @example
   * ```typescript
   * const links = await walbucket.listShareableLinks();
   * ```
   */
  async listShareableLinks(owner?: string): Promise<any[]> {
    try {
      const ownerAddress = owner || this.config.userAddress;
      if (!ownerAddress) {
        throw new ValidationError(
          "Owner address required. Provide owner parameter or configure userAddress."
        );
      }
      return await this.suiService.listShareableLinks(ownerAddress);
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `List shareable links failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a specific access grant by ID
   *
   * @param grantId - ID of the AccessGrant to retrieve
   *
   * @returns Access grant metadata
   *
   * @throws {BlockchainError} If query fails or grant not found
   *
   * @example
   * ```typescript
   * const grant = await walbucket.getAccessGrant('0x...grantId');
   * ```
   */
  async getAccessGrant(grantId: string): Promise<any> {
    try {
      return await this.suiService.getAccessGrant(grantId);
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Get access grant failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a specific shareable link by ID
   *
   * @param linkId - ID of the ShareableLink to retrieve
   *
   * @returns Shareable link metadata
   *
   * @throws {BlockchainError} If query fails or link not found
   *
   * @example
   * ```typescript
   * const link = await walbucket.getShareableLink('0x...linkId');
   * ```
   */
  async getShareableLink(linkId: string): Promise<any> {
    try {
      return await this.suiService.getShareableLink(linkId);
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Get shareable link failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List assets owned by an address
   *
   * Fetches all assets owned by the given address from the Sui blockchain.
   * If no owner address is provided, uses the signer's address.
   * Supports pagination via cursor.
   *
   * @param owner - Optional owner address to query (defaults to signer's address)
   * @param cursor - Optional cursor for pagination
   * @param limit - Optional limit for number of items per page (default: 20, max: 50)
   *
   * @returns Object with assets array, hasNextPage flag, and nextCursor for pagination
   *
   * @throws {ValidationError} If no owner provided and signer not available
   * @throws {BlockchainError} If query fails
   *
   * @example
   * ```typescript
   * // List assets for the signer (first page)
   * const result = await walbucket.list();
   * console.log(result.assets); // Array of assets
   * console.log(result.hasNextPage); // true if more pages available
   *
   * // List next page
   * if (result.hasNextPage) {
   *   const nextPage = await walbucket.list(undefined, result.nextCursor);
   * }
   *
   * // List assets for a specific address
   * const result = await walbucket.list('0x...');
   * ```
   */
  async list(
    owner?: string,
    cursor?: string | null,
    limit?: number | null
  ): Promise<{
    assets: AssetMetadata[];
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    try {
      let queryAddress = owner;

      // If no owner provided, try to determine from config or signer
      if (!queryAddress) {
        // First try userAddress from config (user-pays mode)
        if (this.config.userAddress) {
          queryAddress = this.config.userAddress;
        }
        // Then try signer (developer-sponsored mode)
        else if (this.signer) {
          // Get address from signer
          // The signer should have a method to get the address
          // For Ed25519Keypair, it's getPublicKey().toSuiAddress()
          // For wallet signers from dapp-kit, the address is in the account object
          if ("address" in this.signer) {
            queryAddress = this.signer.address as string;
          } else if (
            "getPublicKey" in this.signer &&
            typeof this.signer.getPublicKey === "function"
          ) {
            const publicKey = this.signer.getPublicKey();
            if (
              publicKey &&
              "toSuiAddress" in publicKey &&
              typeof publicKey.toSuiAddress === "function"
            ) {
              queryAddress = publicKey.toSuiAddress();
            } else {
              throw new ValidationError("Unable to get address from signer");
            }
          } else {
            throw new ValidationError("Unable to get address from signer");
          }
        } else {
          throw new ValidationError(
            "No owner address provided and no signer or userAddress available"
          );
        }
      }

      // Final check to ensure we have an address
      if (!queryAddress) {
        throw new ValidationError("Unable to determine owner address");
      }

      // Query blockchain for assets with pagination
      const result = await this.suiService.listAssets(
        queryAddress,
        cursor,
        limit
      );

      // Generate URLs and cache assets
      for (const asset of result.assets) {
        asset.url = this.generateFileUrl(asset.blobId);
        this.assetCache.set(asset.assetId, asset);
      }

      return result;
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BlockchainError
      ) {
        throw error;
      }
      throw new BlockchainError(
        `List failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate file URL from blob ID
   * Creates a URL that can be used to access the file via Walrus aggregator
   *
   * @param blobId - Blob ID from Walrus storage
   * @returns Full URL to access the file
   */
  private generateFileUrl(blobId: string): string {
    return `${this.config.walrusAggregatorUrl}/v1/blobs/${blobId}`;
  }

  /**
   * Hash API key (SHA-256)
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash("sha256").update(apiKey).digest("hex");
  }
}
