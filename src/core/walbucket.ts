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
   * List assets owned by an address
   *
   * Fetches all assets owned by the given address from the Sui blockchain.
   * If no owner address is provided, uses the signer's address.
   *
   * @param owner - Optional owner address to query (defaults to signer's address)
   *
   * @returns Array of asset metadata
   *
   * @throws {ValidationError} If no owner provided and signer not available
   * @throws {BlockchainError} If query fails
   *
   * @example
   * ```typescript
   * // List assets for the signer
   * const assets = await walbucket.list();
   *
   * // List assets for a specific address
   * const assets = await walbucket.list('0x...');
   * ```
   */
  async list(owner?: string): Promise<AssetMetadata[]> {
    try {
      let queryAddress = owner;

      // If no owner provided, use signer's address
      if (!queryAddress) {
        if (!this.signer) {
          throw new ValidationError(
            "No owner address provided and no signer available"
          );
        }

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
      }

      // Final check to ensure we have an address
      if (!queryAddress) {
        throw new ValidationError("Unable to determine owner address");
      }

      // Query blockchain for assets
      const assets = await this.suiService.listAssets(queryAddress);

      // Generate URLs and cache assets
      for (const asset of assets) {
        asset.url = this.generateFileUrl(asset.blobId);
        this.assetCache.set(asset.assetId, asset);
      }

      return assets;
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
