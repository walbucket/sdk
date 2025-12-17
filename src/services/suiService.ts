import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import type { Signer } from "@mysten/sui/cryptography";
import type { SuiNetwork, SignAndExecuteTransaction } from "../types/config.js";
import type {
  AssetMetadata,
  FolderMetadata,
  BucketMetadata,
} from "../types/responses.js";
import { BlockchainError } from "../types/errors.js";
import { getSuiGrpcUrl } from "../utils/config.js";

/**
 * Sui Service
 * Handles all Sui blockchain interactions via gRPC
 */
export class SuiService {
  private grpcClient: SuiGrpcClient;
  private jsonRpcClient: SuiClient; // Fallback for queries that work better with JSON-RPC
  private signAndExecuteFn: SignAndExecuteTransaction | null; // Function for user-pays transactions
  private userAddress: string | null; // User address for user-pays transactions
  private packageId: string;
  private network: SuiNetwork;

  constructor(
    network: SuiNetwork,
    packageId: string,
    signAndExecuteFn?: SignAndExecuteTransaction,
    userAddress?: string
  ) {
    this.network = network;
    this.packageId = packageId;
    this.signAndExecuteFn = signAndExecuteFn || null;
    this.userAddress = userAddress || null;

    // Initialize gRPC client for transactions
    this.grpcClient = new SuiGrpcClient({
      network,
      baseUrl: getSuiGrpcUrl(network),
    });

    // Initialize JSON-RPC client for queries (more stable API)
    // TODO: Migrate to full gRPC once API is stable
    this.jsonRpcClient = new SuiClient({
      url: getFullnodeUrl(network),
    });
  }

  /**
   * Get asset metadata from Sui blockchain
   *
   * Queries the Sui blockchain for asset metadata including blob ID, name, size,
   * content type, tags, and other metadata.
   *
   * @param assetId - The asset object ID on Sui
   * @returns Asset metadata or null if not found
   * @throws {BlockchainError} If the query fails
   */
  async getAsset(assetId: string): Promise<AssetMetadata | null> {
    try {
      // Use JSON-RPC client for queries (more stable API)
      const object = await this.jsonRpcClient.getObject({
        id: assetId,
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (!object.data || !("content" in object.data)) {
        return null;
      }

      const content = object.data.content as any;
      const fields = content.fields || {};

      const blobId = this.bytesToString(fields.blob_id || []);

      return {
        assetId,
        owner: fields.owner || "",
        blobId,
        url: "", // Will be set by Walbucket class using generateFileUrl
        name: fields.name || "",
        contentType: fields.content_type || "application/octet-stream",
        size: Number(fields.size || 0),
        createdAt: Number(fields.created_at || 0) * 1000, // Convert to milliseconds
        updatedAt: Number(fields.updated_at || fields.created_at || 0) * 1000,
        policyId: fields.policy_id?.fields?.id || undefined,
        tags: (fields.tags || []).map((tag: any) => tag || ""),
        description: fields.description || "",
        category: fields.category || "",
        width: fields.width ? Number(fields.width) : undefined,
        height: fields.height ? Number(fields.height) : undefined,
        thumbnailBlobId: fields.thumbnail_blob_id
          ? this.bytesToString(fields.thumbnail_blob_id)
          : undefined,
        folderId: fields.folder_id?.fields?.id || undefined,
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get asset: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create asset on Sui blockchain
   *
   * Creates a new asset record on the Sui blockchain using the contract's
   * `upload_asset_with_api_key` function. This records the asset metadata
   * and links it to the blob stored in Walrus.
   *
   * @param params - Asset creation parameters
   * @param params.blobId - Blob ID from Walrus storage
   * @param params.name - Asset name/filename
   * @param params.contentType - MIME type of the asset
   * @param params.size - File size in bytes
   * @param params.tags - Tags for categorization
   * @param params.description - Asset description
   * @param params.category - Asset category
   * @param params.width - Image width (optional, for images)
   * @param params.height - Image height (optional, for images)
   * @param params.thumbnailBlobId - Thumbnail blob ID (optional)
   * @param params.folderId - Folder ID for organization (optional)
   * @param params.apiKeyId - API key object ID
   * @param params.apiKeyHash - Hashed API key
   * @param params.developerAccountId - Developer account object ID
   * @param params.signer - Transaction signer
   *
   * @returns The created asset object ID
   *
   * @throws {BlockchainError} If transaction fails or required objects not found
   *
   * @example
   * ```typescript
   * const assetId = await suiService.createAsset({
   *   blobId: 'blob_123',
   *   name: 'image.jpg',
   *   contentType: 'image/jpeg',
   *   size: 1024,
   *   tags: ['photo'],
   *   apiKeyId: '0x...',
   *   apiKeyHash: '0x...',
   *   developerAccountId: '0x...',
   *   signer: keypair,
   * });
   * ```
   */
  async createAsset(params: {
    blobId: string;
    name: string;
    contentType: string;
    size: number;
    tags: string[];
    description: string;
    category: string;
    width?: number;
    height?: number;
    thumbnailBlobId?: string;
    folderId?: string;
    apiKeyId: string;
    apiKeyHash: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<string> {
    try {
      // Get required objects using JSON-RPC
      const [apiKeyObj, devAccountObj] = await Promise.all([
        this.jsonRpcClient.getObject({ id: params.apiKeyId }),
        this.jsonRpcClient.getObject({ id: params.developerAccountId }),
      ]);

      if (!apiKeyObj.data || !devAccountObj.data) {
        throw new BlockchainError("Required objects not found");
      }

      const tx = new Transaction();

      // Don't set sender explicitly - let Sui infer it from object ownership
      // This allows both developer and user accounts to work correctly
      // When user pays gas, they sign the transaction which sets them as sender
      // When developer sponsors gas, the signer's address is used

      // Convert strings to vectors (as required by contract)
      const blobIdBytes = Array.from(Buffer.from(params.blobId));
      const nameBytes = Array.from(Buffer.from(params.name));
      const contentTypeBytes = Array.from(Buffer.from(params.contentType));
      const apiKeyHashBytes = Array.from(
        Buffer.from(params.apiKeyHash.replace("0x", ""), "hex")
      );
      const tagsBytes = params.tags.map((tag) => Array.from(Buffer.from(tag)));
      const descBytes = Array.from(Buffer.from(params.description));
      const catBytes = Array.from(Buffer.from(params.category));

      // Call contract function: upload_asset_with_api_key
      tx.moveCall({
        target: `${this.packageId}::asset::upload_asset_with_api_key`,
        arguments: [
          tx.pure.vector("u8", blobIdBytes),
          tx.pure.vector("u8", nameBytes),
          tx.pure.vector("u8", contentTypeBytes),
          tx.pure.u64(BigInt(params.size)),
          tx.pure.vector("vector<u8>", tagsBytes),
          tx.pure.vector("u8", descBytes),
          tx.pure.vector("u8", catBytes),
          tx.pure.option("u64", params.width ? BigInt(params.width) : null),
          tx.pure.option("u64", params.height ? BigInt(params.height) : null),
          tx.pure.option(
            "vector<u8>",
            params.thumbnailBlobId
              ? Array.from(Buffer.from(params.thumbnailBlobId))
              : null
          ),
          // folder_id: Option<ID> - For Option<ID>, pass object ID as string (ID is essentially an address)
          params.folderId
            ? tx.pure.option("address", params.folderId)
            : tx.pure.option("address", null),
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock shared object
        ],
      });

      // Build and sign transaction
      let result: any;
      let digest: string | undefined;

      if (this.signAndExecuteFn) {
        // User-pays mode: use provided signAndExecuteTransaction function
        try {
          result = await this.signAndExecuteFn({
            transaction: tx,
          });

          // Extract digest from various possible response formats
          digest = result.digest || result.effects?.transactionDigest;

          console.log("[SDK] Transaction executed, digest:", digest);
          console.log("[SDK] Initial result structure:", {
            hasEffects: !!result.effects,
            hasObjectChanges: !!result.objectChanges,
            hasDigest: !!digest,
            effectsKeys: result.effects ? Object.keys(result.effects) : [],
          });

          // Always query the transaction to get complete data
          if (digest) {
            console.log("[SDK] Waiting for transaction to be indexed...");
            // Wait longer for transaction indexing (3 seconds)
            await new Promise((resolve) => setTimeout(resolve, 3000));

            console.log("[SDK] Querying transaction result...");
            const txResult = await this.jsonRpcClient.waitForTransaction({
              digest: digest,
              options: {
                showEffects: true,
                showObjectChanges: true,
                showEvents: true,
              },
            });

            console.log("[SDK] Transaction result received:", {
              hasEffects: !!txResult.effects,
              hasObjectChanges: !!txResult.objectChanges,
              effectsStatus: txResult.effects?.status,
              objectChangesCount: txResult.objectChanges?.length || 0,
            });

            result = txResult;
          }
        } catch (error) {
          console.error("[SDK] Error during transaction execution:", error);
          throw error;
        }
      } else {
        // Developer-sponsored mode: use keypair signer with internal client
        result = await this.jsonRpcClient.signAndExecuteTransaction({
          transaction: tx,
          signer: params.signer,
          options: {
            showEffects: true,
            showObjectChanges: true,
            showEvents: true,
          },
        });
        digest = result.digest || result.effects?.transactionDigest;
      }

      // Extract asset ID from created objects in effects
      if (result.effects?.created) {
        const created = result.effects.created;
        console.log("[SDK] Found created objects in effects:", created.length);
        if (created && created.length > 0) {
          const assetId = created[0].reference?.objectId;
          console.log(
            "[SDK] Extracted asset ID from effects.created:",
            assetId
          );
          if (assetId) {
            return assetId;
          }
        }
      }

      // Fallback: try objectChanges if effects.created is not available
      if (result.objectChanges) {
        console.log(
          "[SDK] Checking objectChanges, count:",
          result.objectChanges.length
        );
        const createdObjects = result.objectChanges.filter((change: any) => {
          console.log("[SDK] ObjectChange:", {
            type: change.type,
            objectType: change.objectType,
          });
          return change.type === "created";
        });
        console.log(
          "[SDK] Found created objects in objectChanges:",
          createdObjects.length
        );
        if (createdObjects.length > 0) {
          const assetId = createdObjects[0].objectId;
          console.log("[SDK] Extracted asset ID from objectChanges:", assetId);
          if (assetId) {
            return assetId;
          }
        }
      }

      // If we still don't have the asset ID, log detailed info
      console.error(
        "[SDK] Failed to extract asset ID. Full result:",
        JSON.stringify(
          {
            digest,
            hasEffects: !!result.effects,
            hasObjectChanges: !!result.objectChanges,
            effects: result.effects,
            objectChanges: result.objectChanges,
          },
          null,
          2
        )
      );

      throw new BlockchainError(
        `Failed to get asset ID from transaction. Digest: ${
          digest || "unknown"
        }`
      );
    } catch (error) {
      throw new BlockchainError(
        `Failed to create asset: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Upload asset for user-pays mode (no API key objects required)
   *
   * Creates a new asset using the `upload_asset` function which doesn't require
   * API key objects. This ensures the asset is owned by the user's wallet address
   * from the start.
   *
   * @param params - Asset creation parameters
   * @param params.blobId - Blob ID from Walrus storage
   * @param params.name - Asset name/filename
   * @param params.contentType - MIME type of the asset
   * @param params.size - File size in bytes
   * @param params.tags - Tags for categorization
   * @param params.description - Asset description
   * @param params.category - Asset category
   * @param params.width - Image width (optional, for images)
   * @param params.height - Image height (optional, for images)
   * @param params.thumbnailBlobId - Thumbnail blob ID (optional)
   * @param params.folderId - Folder ID for organization (optional)
   *
   * @returns The created asset object ID
   *
   * @throws {BlockchainError} If transaction fails
   *
   * @example
   * ```typescript
   * const assetId = await suiService.uploadAssetUserPays({
   *   blobId: 'blob_123',
   *   name: 'image.jpg',
   *   contentType: 'image/jpeg',
   *   size: 1024,
   *   tags: ['photo'],
   * });
   * ```
   */
  async uploadAssetUserPays(params: {
    blobId: string;
    name: string;
    contentType: string;
    size: number;
    tags: string[];
    description: string;
    category: string;
    width?: number;
    height?: number;
    thumbnailBlobId?: string;
    folderId?: string;
  }): Promise<string> {
    try {
      const tx = new Transaction();

      // Convert strings to vectors (as required by contract)
      const blobIdBytes = Array.from(Buffer.from(params.blobId));
      const nameBytes = Array.from(Buffer.from(params.name));
      const contentTypeBytes = Array.from(Buffer.from(params.contentType));
      const tagsBytes = params.tags.map((tag) => Array.from(Buffer.from(tag)));
      const descBytes = Array.from(Buffer.from(params.description));
      const catBytes = Array.from(Buffer.from(params.category));

      // Call contract function: upload_asset (user-pays, no API key objects)
      // For Option<ID>, pass object ID as string wrapped in option (ID is essentially an address)
      const folderIdArg = params.folderId
        ? tx.pure.option("address", params.folderId)
        : tx.pure.option("address", null);

      tx.moveCall({
        target: `${this.packageId}::asset::upload_asset`,
        arguments: [
          tx.pure.vector("u8", blobIdBytes),
          tx.pure.vector("u8", nameBytes),
          tx.pure.vector("u8", contentTypeBytes),
          tx.pure.u64(BigInt(params.size)),
          tx.pure.vector("vector<u8>", tagsBytes),
          tx.pure.vector("u8", descBytes),
          tx.pure.vector("u8", catBytes),
          tx.pure.option("u64", params.width ? BigInt(params.width) : null),
          tx.pure.option("u64", params.height ? BigInt(params.height) : null),
          tx.pure.option(
            "vector<u8>",
            params.thumbnailBlobId
              ? Array.from(Buffer.from(params.thumbnailBlobId))
              : null
          ),
          folderIdArg,
          tx.object("0x6"), // Clock shared object
        ],
      });

      // Build and sign transaction
      let result: any;
      let digest: string | undefined;

      if (this.signAndExecuteFn) {
        // User-pays mode: use provided signAndExecuteTransaction function
        try {
          result = await this.signAndExecuteFn({
            transaction: tx,
          });

          digest = result.digest || result.effects?.transactionDigest;

          if (digest) {
            // Wait for transaction to be indexed
            await new Promise((resolve) => setTimeout(resolve, 3000));

            const txResult = await this.jsonRpcClient.waitForTransaction({
              digest: digest,
              options: {
                showEffects: true,
                showObjectChanges: true,
                showEvents: true,
              },
            });

            result = txResult;
          }
        } catch (error) {
          console.error("[SDK] Error during transaction execution:", error);
          throw error;
        }
      } else {
        // Developer-sponsored mode: This path should not be used with uploadAssetUserPays
        // If we reach here without signAndExecuteFn, it means we're in developer-sponsored mode
        // but uploadAssetUserPays is designed for user-pays. Throw an error.
        throw new BlockchainError(
          "uploadAssetUserPays requires user-pays gas strategy with signAndExecuteFn. " +
            "For developer-sponsored mode, use createAsset instead."
        );
      }

      // Extract asset ID from created objects
      if (result.objectChanges) {
        for (const change of result.objectChanges) {
          if (
            change.type === "created" &&
            change.objectType &&
            change.objectType.includes("asset::Asset")
          ) {
            return change.objectId;
          }
        }
      }

      // Fallback: try to extract from effects
      if (result.effects?.created) {
        for (const created of result.effects.created) {
          if (
            created.reference?.objectId &&
            created.owner &&
            typeof created.owner === "object" &&
            "AddressOwner" in created.owner
          ) {
            // Verify it's an Asset object by checking the type
            const obj = await this.jsonRpcClient.getObject({
              id: created.reference.objectId,
              options: { showType: true },
            });
            if (
              obj.data &&
              "type" in obj.data &&
              typeof obj.data.type === "string" &&
              obj.data.type.includes("asset::Asset")
            ) {
              return created.reference.objectId;
            }
          }
        }
      }

      throw new BlockchainError(
        "Failed to extract asset ID from transaction result"
      );
    } catch (error) {
      throw new BlockchainError(
        `Failed to upload asset: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete asset from Sui blockchain (developer-pays with API key)
   * Matches contract function: delete_asset_with_api_key
   */
  async deleteAsset(params: {
    assetId: string;
    apiKeyHash: string;
    apiKeyId: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<void> {
    try {
      // Get required objects using JSON-RPC
      const [assetObj, apiKeyObj, devAccountObj] = await Promise.all([
        this.jsonRpcClient.getObject({ id: params.assetId }),
        this.jsonRpcClient.getObject({ id: params.apiKeyId }),
        this.jsonRpcClient.getObject({ id: params.developerAccountId }),
      ]);

      if (!assetObj.data || !apiKeyObj.data || !devAccountObj.data) {
        throw new BlockchainError("Required objects not found");
      }

      const tx = new Transaction();

      const apiKeyHashBytes = Array.from(
        Buffer.from(params.apiKeyHash.replace("0x", ""), "hex")
      );

      tx.moveCall({
        target: `${this.packageId}::asset::delete_asset_with_api_key`,
        arguments: [
          tx.object(params.assetId),
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock
        ],
      });

      // Build and sign transaction
      await this.jsonRpcClient.signAndExecuteTransaction({
        transaction: tx,
        signer: params.signer,
      });
    } catch (error) {
      throw new BlockchainError(
        `Failed to delete asset: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete asset (wallet-based user-pays transaction)
   * Matches contract function: delete_asset
   */
  async deleteAssetUserPays(params: { assetId: string }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::asset::delete_asset`,
        arguments: [tx.object(params.assetId), tx.object("0x6")], // Clock
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to delete asset: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create encryption policy on Sui blockchain
   * Matches contract function: create_encryption_policy_with_api_key
   * Policy types: 0=public, 1=wallet-gated, 2=time-limited, 3=password-protected
   */
  async createPolicy(params: {
    assetId: string;
    policyType: number; // 0=public, 1=wallet-gated, 2=time-limited, 3=password-protected
    allowedAddresses: string[];
    expiration: number; // milliseconds, 0 = no expiration
    passwordHash: string; // hex string, empty = no password
    apiKeyId: string;
    apiKeyHash: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<string> {
    try {
      // Get required objects
      const [assetObj, apiKeyObj, devAccountObj] = await Promise.all([
        this.jsonRpcClient.getObject({ id: params.assetId }),
        this.jsonRpcClient.getObject({ id: params.apiKeyId }),
        this.jsonRpcClient.getObject({ id: params.developerAccountId }),
      ]);

      if (!assetObj.data || !apiKeyObj.data || !devAccountObj.data) {
        throw new BlockchainError("Required objects not found");
      }

      const tx = new Transaction();

      // Convert policy type to u8
      const policyType = params.policyType;

      // Convert addresses (remove 0x prefix if present)
      const addresses = params.allowedAddresses.map((addr) =>
        addr.replace("0x", "")
      );

      // Convert expiration (from milliseconds to seconds)
      const expiration =
        params.expiration > 0
          ? BigInt(Math.floor(params.expiration / 1000))
          : BigInt(0);

      // Convert password hash to bytes
      const passwordHashBytes = params.passwordHash
        ? Array.from(Buffer.from(params.passwordHash.replace("0x", ""), "hex"))
        : [];

      // Call contract function: create_encryption_policy_with_api_key
      tx.moveCall({
        target: `${this.packageId}::policy::create_encryption_policy_with_api_key`,
        arguments: [
          tx.object(params.assetId),
          tx.pure.u8(policyType),
          tx.pure.vector("address", addresses),
          tx.pure.u64(expiration),
          tx.pure.vector("u8", passwordHashBytes),
          tx.object(params.apiKeyId),
          tx.pure.vector(
            "u8",
            Array.from(Buffer.from(params.apiKeyHash.replace("0x", ""), "hex"))
          ),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock
        ],
      });

      // Build and sign transaction
      const result = await this.jsonRpcClient.signAndExecuteTransaction({
        transaction: tx,
        signer: params.signer,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      // Extract policy ID from created objects
      if (result.effects?.created) {
        const created = result.effects.created;
        if (created && created.length > 0) {
          const policyId = created[0].reference?.objectId;
          if (policyId) {
            return policyId;
          }
        }
      }

      throw new BlockchainError("Failed to get policy ID from transaction");
    } catch (error) {
      throw new BlockchainError(
        `Failed to create policy: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Apply policy to asset
   * Matches contract function: apply_policy_to_asset_with_api_key
   */
  async applyPolicyToAsset(params: {
    assetId: string;
    policyId: string;
    apiKeyId: string;
    apiKeyHash: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<void> {
    try {
      // Get required objects
      const [assetObj, policyObj, apiKeyObj, devAccountObj] = await Promise.all(
        [
          this.jsonRpcClient.getObject({ id: params.assetId }),
          this.jsonRpcClient.getObject({ id: params.policyId }),
          this.jsonRpcClient.getObject({ id: params.apiKeyId }),
          this.jsonRpcClient.getObject({ id: params.developerAccountId }),
        ]
      );

      if (
        !assetObj.data ||
        !policyObj.data ||
        !apiKeyObj.data ||
        !devAccountObj.data
      ) {
        throw new BlockchainError("Required objects not found");
      }

      const tx = new Transaction();

      const apiKeyHashBytes = Array.from(
        Buffer.from(params.apiKeyHash.replace("0x", ""), "hex")
      );

      // Call contract function: apply_policy_to_asset_with_api_key
      tx.moveCall({
        target: `${this.packageId}::policy::apply_policy_to_asset_with_api_key`,
        arguments: [
          tx.object(params.assetId),
          tx.object(params.policyId),
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock
        ],
      });

      // Build and sign transaction
      await this.jsonRpcClient.signAndExecuteTransaction({
        transaction: tx,
        signer: params.signer,
      });
    } catch (error) {
      throw new BlockchainError(
        `Failed to apply policy: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get policy from Sui blockchain
   */
  async getPolicy(policyId: string): Promise<{
    policyId: string;
    assetId: string;
    policyType: number;
    allowedAddresses: string[];
    expiration: number;
    createdAt: number;
  } | null> {
    try {
      const object = await this.jsonRpcClient.getObject({
        id: policyId,
        options: {
          showContent: true,
        },
      });

      if (!object.data || !("content" in object.data)) {
        return null;
      }

      const content = object.data.content as any;
      const fields = content.fields || {};

      return {
        policyId,
        assetId: fields.asset_id?.fields?.id || "",
        policyType: Number(fields.policy_type || 0),
        allowedAddresses: (fields.allowed_addresses || []).map(
          (addr: any) => addr || ""
        ),
        expiration: Number(fields.expiration || 0) * 1000, // Convert to milliseconds
        createdAt: Number(fields.created_at || 0) * 1000,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Create transformation request on-chain
   * Matches contract function: request_transformation_with_api_key
   * Note: Actual image processing must be done off-chain (requires Sharp or similar)
   */
  async createTransformationRequest(params: {
    assetId: string;
    transformType: number; // 0=resize, 1=crop, 2=format, 3=quality, 4=rotate
    parameters: number[]; // BCS encoded parameters
    apiKeyId: string;
    apiKeyHash: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<string> {
    try {
      // Get required objects
      const [assetObj, apiKeyObj, devAccountObj] = await Promise.all([
        this.jsonRpcClient.getObject({ id: params.assetId }),
        this.jsonRpcClient.getObject({ id: params.apiKeyId }),
        this.jsonRpcClient.getObject({ id: params.developerAccountId }),
      ]);

      if (!assetObj.data || !apiKeyObj.data || !devAccountObj.data) {
        throw new BlockchainError("Required objects not found");
      }

      const tx = new Transaction();

      const apiKeyHashBytes = Array.from(
        Buffer.from(params.apiKeyHash.replace("0x", ""), "hex")
      );

      // Call contract function: request_transformation_with_api_key
      tx.moveCall({
        target: `${this.packageId}::transform::request_transformation_with_api_key`,
        arguments: [
          tx.object(params.assetId),
          tx.pure.u8(params.transformType),
          tx.pure.vector("u8", params.parameters),
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock
        ],
      });

      // Build and sign transaction
      const result = await this.jsonRpcClient.signAndExecuteTransaction({
        transaction: tx,
        signer: params.signer,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      // Extract request ID from created objects
      if (result.effects?.created) {
        const created = result.effects.created;
        if (created && created.length > 0) {
          const requestId = created[0].reference?.objectId;
          if (requestId) {
            return requestId;
          }
        }
      }

      throw new BlockchainError(
        "Failed to get transformation request ID from transaction"
      );
    } catch (error) {
      throw new BlockchainError(
        `Failed to create transformation request: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Rename asset (wallet-based user-pays transaction)
   * Matches contract function: rename_asset
   */
  async renameAsset(params: {
    assetId: string;
    newName: string;
  }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      const newNameBytes = Array.from(Buffer.from(params.newName, "utf-8"));

      tx.moveCall({
        target: `${this.packageId}::asset::rename_asset`,
        arguments: [
          tx.object(params.assetId),
          tx.pure.vector("u8", newNameBytes),
          tx.object("0x6"), // Clock
        ],
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to rename asset: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Copy asset (wallet-based user-pays transaction)
   * Matches contract function: copy_asset
   */
  async copyAsset(params: { assetId: string; newName: string }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      const newNameBytes = Array.from(Buffer.from(params.newName, "utf-8"));

      tx.moveCall({
        target: `${this.packageId}::asset::copy_asset`,
        arguments: [
          tx.object(params.assetId),
          tx.pure.vector("u8", newNameBytes),
          tx.object("0x6"), // Clock
        ],
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to copy asset: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create folder (wallet-based user-pays transaction)
   * Matches contract function: create_folder
   */
  async createFolder(params: {
    name: string;
    description: string;
    parentFolderId?: string;
  }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      const nameBytes = Array.from(Buffer.from(params.name, "utf-8"));
      const descriptionBytes = Array.from(
        Buffer.from(params.description, "utf-8")
      );

      const parentFolderIdArg = params.parentFolderId
        ? tx.pure.option("address", params.parentFolderId)
        : tx.pure.option("address", null);

      tx.moveCall({
        target: `${this.packageId}::folder::create_folder`,
        arguments: [
          tx.pure.vector("u8", nameBytes),
          tx.pure.vector("u8", descriptionBytes),
          parentFolderIdArg,
          tx.object("0x6"), // Clock
        ],
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to create folder: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete folder (wallet-based user-pays transaction)
   * Matches contract function: delete_folder
   * Note: Folder must be empty
   */
  async deleteFolder(params: { folderId: string }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::folder::delete_folder`,
        arguments: [tx.object(params.folderId), tx.object("0x6")], // Clock
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to delete folder: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Move asset to folder (wallet-based user-pays transaction)
   * Matches contract function: move_asset_to_folder
   */
  async moveAssetToFolder(params: {
    assetId: string;
    folderId?: string; // undefined means remove from folder
  }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      const folderIdArg = params.folderId
        ? tx.pure.option("id", params.folderId)
        : tx.pure.option("id", null);

      tx.moveCall({
        target: `${this.packageId}::asset::move_asset_to_folder`,
        arguments: [
          tx.object(params.assetId),
          folderIdArg,
          tx.object("0x6"), // Clock
        ],
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to move asset to folder: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Rename asset with API key (Developer-sponsored)
   * Matches contract function: rename_asset_with_api_key
   */
  async renameAssetWithApiKey(params: {
    assetId: string;
    newName: string;
    apiKeyHash: string;
    apiKeyId: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<void> {
    try {
      const tx = new Transaction();

      const newNameBytes = Array.from(Buffer.from(params.newName, "utf-8"));
      const apiKeyHashBytes = Array.from(
        Buffer.from(params.apiKeyHash.replace("0x", ""), "hex")
      );

      tx.moveCall({
        target: `${this.packageId}::asset::rename_asset_with_api_key`,
        arguments: [
          tx.object(params.assetId),
          tx.pure.vector("u8", newNameBytes),
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock
        ],
      });

      await this.jsonRpcClient.signAndExecuteTransaction({
        transaction: tx,
        signer: params.signer,
      });
    } catch (error) {
      throw new BlockchainError(
        `Failed to rename asset: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Copy asset with API key (Developer-sponsored)
   * Matches contract function: copy_asset_with_api_key
   */
  async copyAssetWithApiKey(params: {
    assetId: string;
    newName: string;
    apiKeyHash: string;
    apiKeyId: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<void> {
    try {
      const tx = new Transaction();

      const newNameBytes = Array.from(Buffer.from(params.newName, "utf-8"));
      const apiKeyHashBytes = Array.from(
        Buffer.from(params.apiKeyHash.replace("0x", ""), "hex")
      );

      tx.moveCall({
        target: `${this.packageId}::asset::copy_asset_with_api_key`,
        arguments: [
          tx.object(params.assetId),
          tx.pure.vector("u8", newNameBytes),
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock
        ],
      });

      await this.jsonRpcClient.signAndExecuteTransaction({
        transaction: tx,
        signer: params.signer,
      });
    } catch (error) {
      throw new BlockchainError(
        `Failed to copy asset: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create folder with API key (Developer-sponsored)
   * Matches contract function: create_folder_with_api_key
   */
  async createFolderWithApiKey(params: {
    name: string;
    description: string;
    parentFolderId?: string;
    apiKeyHash: string;
    apiKeyId: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<void> {
    try {
      const tx = new Transaction();

      const nameBytes = Array.from(Buffer.from(params.name, "utf-8"));
      const descriptionBytes = Array.from(
        Buffer.from(params.description, "utf-8")
      );
      const apiKeyHashBytes = Array.from(
        Buffer.from(params.apiKeyHash.replace("0x", ""), "hex")
      );

      const parentFolderIdArg = params.parentFolderId
        ? tx.pure.option("address", params.parentFolderId)
        : tx.pure.option("address", null);

      tx.moveCall({
        target: `${this.packageId}::folder::create_folder_with_api_key`,
        arguments: [
          tx.pure.vector("u8", nameBytes),
          tx.pure.vector("u8", descriptionBytes),
          parentFolderIdArg,
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock
        ],
      });

      await this.jsonRpcClient.signAndExecuteTransaction({
        transaction: tx,
        signer: params.signer,
      });
    } catch (error) {
      throw new BlockchainError(
        `Failed to create folder: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete folder with API key (Developer-sponsored)
   * Matches contract function: delete_folder_with_api_key
   * Note: Folder must be empty
   */
  async deleteFolderWithApiKey(params: {
    folderId: string;
    apiKeyHash: string;
    apiKeyId: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<void> {
    try {
      const tx = new Transaction();

      const apiKeyHashBytes = Array.from(
        Buffer.from(params.apiKeyHash.replace("0x", ""), "hex")
      );

      tx.moveCall({
        target: `${this.packageId}::folder::delete_folder_with_api_key`,
        arguments: [
          tx.object(params.folderId),
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock
        ],
      });

      await this.jsonRpcClient.signAndExecuteTransaction({
        transaction: tx,
        signer: params.signer,
      });
    } catch (error) {
      throw new BlockchainError(
        `Failed to delete folder: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Move asset to folder with API key (Developer-sponsored)
   * Matches contract function: move_asset_to_folder_with_api_key
   */
  async moveAssetToFolderWithApiKey(params: {
    assetId: string;
    folderId?: string; // undefined means remove from folder
    apiKeyHash: string;
    apiKeyId: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<void> {
    try {
      const tx = new Transaction();

      const apiKeyHashBytes = Array.from(
        Buffer.from(params.apiKeyHash.replace("0x", ""), "hex")
      );

      const folderIdArg = params.folderId
        ? tx.pure.option("id", params.folderId)
        : tx.pure.option("id", null);

      tx.moveCall({
        target: `${this.packageId}::asset::move_asset_to_folder_with_api_key`,
        arguments: [
          tx.object(params.assetId),
          folderIdArg,
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock
        ],
      });

      await this.jsonRpcClient.signAndExecuteTransaction({
        transaction: tx,
        signer: params.signer,
      });
    } catch (error) {
      throw new BlockchainError(
        `Failed to move asset to folder: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Share asset with specific address (user-pays transaction)
   * Matches contract function: share_asset
   */
  async shareAsset(params: {
    assetId: string;
    grantedTo: string;
    canRead: boolean;
    canWrite: boolean;
    canAdmin: boolean;
    expiresAt?: number; // timestamp in ms, undefined = no expiration
    passwordHash?: string; // hex string, undefined = no password
  }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      const expiresAtArg = params.expiresAt
        ? tx.pure.option("u64", params.expiresAt)
        : tx.pure.option("u64", null);

      const passwordHashArg = params.passwordHash
        ? tx.pure.option(
            "vector<u8>",
            Array.from(
              Buffer.from(params.passwordHash.replace("0x", ""), "hex")
            )
          )
        : tx.pure.option("vector<u8>", null);

      tx.moveCall({
        target: `${this.packageId}::share::share_asset`,
        arguments: [
          tx.pure.id(params.assetId),
          tx.pure.address(params.grantedTo),
          tx.pure.bool(params.canRead),
          tx.pure.bool(params.canWrite),
          tx.pure.bool(params.canAdmin),
          expiresAtArg,
          passwordHashArg,
          tx.object("0x6"), // Clock
        ],
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to share asset: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Share asset with specific address (API key-sponsored)
   * Matches contract function: share_asset_with_api_key
   */
  async shareAssetWithApiKey(params: {
    assetId: string;
    grantedTo: string;
    canRead: boolean;
    canWrite: boolean;
    canAdmin: boolean;
    expiresAt?: number;
    passwordHash?: string;
    apiKeyHash: string;
    apiKeyId: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<void> {
    try {
      const tx = new Transaction();

      const apiKeyHashBytes = Array.from(
        Buffer.from(params.apiKeyHash.replace("0x", ""), "hex")
      );

      const expiresAtArg = params.expiresAt
        ? tx.pure.option("u64", params.expiresAt)
        : tx.pure.option("u64", null);

      const passwordHashArg = params.passwordHash
        ? tx.pure.option(
            "vector<u8>",
            Array.from(
              Buffer.from(params.passwordHash.replace("0x", ""), "hex")
            )
          )
        : tx.pure.option("vector<u8>", null);

      tx.moveCall({
        target: `${this.packageId}::share::share_asset_with_api_key`,
        arguments: [
          tx.pure.id(params.assetId),
          tx.pure.address(params.grantedTo),
          tx.pure.bool(params.canRead),
          tx.pure.bool(params.canWrite),
          tx.pure.bool(params.canAdmin),
          expiresAtArg,
          passwordHashArg,
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock
        ],
      });

      await this.jsonRpcClient.signAndExecuteTransaction({
        transaction: tx,
        signer: params.signer,
      });
    } catch (error) {
      throw new BlockchainError(
        `Failed to share asset: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create shareable link (user-pays transaction)
   * Matches contract function: create_shareable_link
   */
  async createShareableLink(params: {
    assetId: string;
    shareToken: string;
    canRead: boolean;
    canWrite: boolean;
    canAdmin: boolean;
    expiresAt?: number;
    passwordHash?: string;
  }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      const shareTokenBytes = Array.from(
        Buffer.from(params.shareToken, "utf-8")
      );

      const expiresAtArg = params.expiresAt
        ? tx.pure.option("u64", params.expiresAt)
        : tx.pure.option("u64", null);

      const passwordHashArg = params.passwordHash
        ? tx.pure.option(
            "vector<u8>",
            Array.from(
              Buffer.from(params.passwordHash.replace("0x", ""), "hex")
            )
          )
        : tx.pure.option("vector<u8>", null);

      tx.moveCall({
        target: `${this.packageId}::share::create_shareable_link`,
        arguments: [
          tx.pure.id(params.assetId),
          tx.pure.vector("u8", shareTokenBytes),
          tx.pure.bool(params.canRead),
          tx.pure.bool(params.canWrite),
          tx.pure.bool(params.canAdmin),
          expiresAtArg,
          passwordHashArg,
          tx.object("0x6"), // Clock
        ],
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to create shareable link: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create shareable link (API key-sponsored)
   * Matches contract function: create_shareable_link_with_api_key
   */
  async createShareableLinkWithApiKey(params: {
    assetId: string;
    shareToken: string;
    canRead: boolean;
    canWrite: boolean;
    canAdmin: boolean;
    expiresAt?: number;
    passwordHash?: string;
    apiKeyHash: string;
    apiKeyId: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<void> {
    try {
      const tx = new Transaction();

      const shareTokenBytes = Array.from(
        Buffer.from(params.shareToken, "utf-8")
      );
      const apiKeyHashBytes = Array.from(
        Buffer.from(params.apiKeyHash.replace("0x", ""), "hex")
      );

      const expiresAtArg = params.expiresAt
        ? tx.pure.option("u64", params.expiresAt)
        : tx.pure.option("u64", null);

      const passwordHashArg = params.passwordHash
        ? tx.pure.option(
            "vector<u8>",
            Array.from(
              Buffer.from(params.passwordHash.replace("0x", ""), "hex")
            )
          )
        : tx.pure.option("vector<u8>", null);

      tx.moveCall({
        target: `${this.packageId}::share::create_shareable_link_with_api_key`,
        arguments: [
          tx.pure.id(params.assetId),
          tx.pure.vector("u8", shareTokenBytes),
          tx.pure.bool(params.canRead),
          tx.pure.bool(params.canWrite),
          tx.pure.bool(params.canAdmin),
          expiresAtArg,
          passwordHashArg,
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock
        ],
      });

      await this.jsonRpcClient.signAndExecuteTransaction({
        transaction: tx,
        signer: params.signer,
      });
    } catch (error) {
      throw new BlockchainError(
        `Failed to create shareable link: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Revoke share/access grant (user-pays transaction)
   * Matches contract function: revoke_share
   */
  async revokeShare(params: { grantId: string }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::share::revoke_share`,
        arguments: [tx.object(params.grantId), tx.object("0x6")], // Clock
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to revoke share: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Revoke share/access grant (API key-sponsored)
   * Matches contract function: revoke_share_with_api_key
   */
  async revokeShareWithApiKey(params: {
    grantId: string;
    apiKeyHash: string;
    apiKeyId: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<void> {
    try {
      const tx = new Transaction();

      const apiKeyHashBytes = Array.from(
        Buffer.from(params.apiKeyHash.replace("0x", ""), "hex")
      );

      tx.moveCall({
        target: `${this.packageId}::share::revoke_share_with_api_key`,
        arguments: [
          tx.object(params.grantId),
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock
        ],
      });

      await this.jsonRpcClient.signAndExecuteTransaction({
        transaction: tx,
        signer: params.signer,
      });
    } catch (error) {
      throw new BlockchainError(
        `Failed to revoke share: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deactivate shareable link (user-pays transaction)
   * Matches contract function: deactivate_shareable_link
   */
  async deactivateShareableLink(params: { linkId: string }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::share::deactivate_shareable_link`,
        arguments: [tx.object(params.linkId), tx.object("0x6")], // Clock
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to deactivate shareable link: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deactivate shareable link (API key-sponsored)
   * Matches contract function: deactivate_shareable_link_with_api_key
   */
  async deactivateShareableLinkWithApiKey(params: {
    linkId: string;
    apiKeyHash: string;
    apiKeyId: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<void> {
    try {
      const tx = new Transaction();

      const apiKeyHashBytes = Array.from(
        Buffer.from(params.apiKeyHash.replace("0x", ""), "hex")
      );

      tx.moveCall({
        target: `${this.packageId}::share::deactivate_shareable_link_with_api_key`,
        arguments: [
          tx.object(params.linkId),
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock
        ],
      });

      await this.jsonRpcClient.signAndExecuteTransaction({
        transaction: tx,
        signer: params.signer,
      });
    } catch (error) {
      throw new BlockchainError(
        `Failed to deactivate shareable link: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Track shareable link access (user-pays transaction)
   * Matches contract function: track_link_access
   * Updates link statistics when accessed
   */
  async trackLinkAccess(params: { linkId: string }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::share::track_link_access`,
        arguments: [tx.object(params.linkId), tx.object("0x6")], // Clock
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to track link access: ${
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
   * Queries the Sui blockchain for all Asset objects owned by the given address.
   * Supports pagination via cursor.
   *
   * @param owner - The owner address to query assets for
   * @param cursor - Optional cursor for pagination
   * @param limit - Optional limit for number of items per page (default: 20, max: 50)
   * @returns Object with assets array, hasNextPage flag, and nextCursor for pagination
   * @throws {BlockchainError} If the query fails
   */
  async listAssets(
    owner: string,
    cursor?: string | null,
    limit?: number | null
  ): Promise<{
    assets: AssetMetadata[];
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    try {
      console.log("[SDK] Listing assets for owner:", owner);
      console.log("[SDK] Using package ID:", this.packageId);
      console.log("[SDK] Cursor:", cursor);
      console.log(
        "[SDK] Asset type filter:",
        `${this.packageId}::asset::Asset`
      );

      // Query for all objects owned by the address with Asset type filter
      const response = await this.jsonRpcClient.getOwnedObjects({
        owner,
        filter: {
          StructType: `${this.packageId}::asset::Asset`,
        },
        options: {
          showContent: true,
          showType: true,
        },
        cursor: cursor || null,
        limit: limit || null,
      });

      console.log("[SDK] getOwnedObjects response:", {
        count: response.data.length,
        hasNextPage: response.hasNextPage,
        nextCursor: response.nextCursor,
      });

      const assets: AssetMetadata[] = [];

      for (const item of response.data) {
        if (!item.data || !("content" in item.data)) {
          continue;
        }

        const content = item.data.content as any;
        const fields = content.fields || {};
        const assetId = item.data.objectId;

        const blobId = this.bytesToString(fields.blob_id || []);

        assets.push({
          assetId,
          owner: fields.owner || owner,
          blobId,
          url: "", // Will be set by Walbucket class using generateFileUrl
          name: fields.name || "",
          contentType: fields.content_type || "application/octet-stream",
          size: Number(fields.size || 0),
          createdAt: Number(fields.created_at || 0) * 1000, // Convert to milliseconds
          updatedAt: Number(fields.updated_at || fields.created_at || 0) * 1000,
          policyId: fields.policy_id?.fields?.id || undefined,
          tags: (fields.tags || []).map((tag: any) => tag || ""),
          description: fields.description || "",
          category: fields.category || "",
          width: fields.width ? Number(fields.width) : undefined,
          height: fields.height ? Number(fields.height) : undefined,
          thumbnailBlobId: fields.thumbnail_blob_id
            ? this.bytesToString(fields.thumbnail_blob_id)
            : undefined,
          folderId: fields.folder_id?.fields?.id || undefined,
        });
      }

      return {
        assets,
        hasNextPage: response.hasNextPage,
        nextCursor: response.nextCursor || null,
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to list assets: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List access grants for an address
   * Queries Sui blockchain for AccessGrant objects owned by the specified address
   */
  async listAccessGrants(owner?: string): Promise<any[]> {
    const ownerAddress = owner || this.userAddress;

    if (!ownerAddress) {
      throw new BlockchainError(
        "Owner address required. Provide owner parameter or configure userAddress."
      );
    }

    try {
      const response = await this.jsonRpcClient.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${this.packageId}::share::AccessGrant`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      const grants: any[] = [];

      for (const item of response.data) {
        if (
          !item.data?.content ||
          item.data.content.dataType !== "moveObject"
        ) {
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fields = item.data.content.fields as any;

        grants.push({
          grantId: item.data.objectId,
          assetId: fields.asset_id?.fields?.id || fields.asset_id,
          grantedBy: fields.granted_by,
          grantedTo: fields.granted_to,
          canRead: fields.permission?.fields?.can_read || false,
          canWrite: fields.permission?.fields?.can_write || false,
          canAdmin: fields.permission?.fields?.can_admin || false,
          expiresAt: parseInt(fields.expires_at || "0", 10),
          createdAt: parseInt(fields.created_at || "0", 10),
        });
      }

      return grants;
    } catch (error) {
      throw new BlockchainError(
        `Failed to list access grants: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List shareable links created by an address
   * Queries Sui blockchain for ShareableLink objects owned by the specified address
   */
  async listShareableLinks(owner?: string): Promise<any[]> {
    const ownerAddress = owner || this.userAddress;

    if (!ownerAddress) {
      throw new BlockchainError(
        "Owner address required. Provide owner parameter or configure userAddress."
      );
    }

    try {
      const response = await this.jsonRpcClient.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${this.packageId}::share::ShareableLink`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      const links: any[] = [];

      for (const item of response.data) {
        if (
          !item.data?.content ||
          item.data.content.dataType !== "moveObject"
        ) {
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fields = item.data.content.fields as any;

        // Convert share_token vector<u8> to string
        const shareTokenBytes = fields.share_token || [];
        const shareToken = Buffer.from(shareTokenBytes).toString("utf-8");

        links.push({
          linkId: item.data.objectId,
          assetId: fields.asset_id?.fields?.id || fields.asset_id,
          creator: fields.creator,
          shareToken,
          canRead: fields.permission?.fields?.can_read || false,
          canWrite: fields.permission?.fields?.can_write || false,
          canAdmin: fields.permission?.fields?.can_admin || false,
          expiresAt: parseInt(fields.expires_at || "0", 10),
          isActive: fields.is_active || false,
          createdAt: parseInt(fields.created_at || "0", 10),
          lastAccessedAt: parseInt(fields.last_accessed_at || "0", 10),
          accessCount: parseInt(fields.access_count || "0", 10),
        });
      }

      return links;
    } catch (error) {
      throw new BlockchainError(
        `Failed to list shareable links: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a specific access grant by ID
   */
  async getAccessGrant(grantId: string): Promise<any> {
    try {
      const response = await this.jsonRpcClient.getObject({
        id: grantId,
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (
        !response.data?.content ||
        response.data.content.dataType !== "moveObject"
      ) {
        throw new BlockchainError("Access grant not found");
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields = response.data.content.fields as any;

      return {
        grantId: response.data.objectId,
        assetId: fields.asset_id?.fields?.id || fields.asset_id,
        grantedBy: fields.granted_by,
        grantedTo: fields.granted_to,
        canRead: fields.permission?.fields?.can_read || false,
        canWrite: fields.permission?.fields?.can_write || false,
        canAdmin: fields.permission?.fields?.can_admin || false,
        expiresAt: parseInt(fields.expires_at || "0", 10),
        createdAt: parseInt(fields.created_at || "0", 10),
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get access grant: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a specific shareable link by ID
   */
  async getShareableLink(linkId: string): Promise<any> {
    try {
      const response = await this.jsonRpcClient.getObject({
        id: linkId,
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (
        !response.data?.content ||
        response.data.content.dataType !== "moveObject"
      ) {
        throw new BlockchainError("Shareable link not found");
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields = response.data.content.fields as any;

      // Convert share_token vector<u8> to string
      const shareTokenBytes = fields.share_token || [];
      const shareToken = Buffer.from(shareTokenBytes).toString("utf-8");

      return {
        linkId: response.data.objectId,
        assetId: fields.asset_id?.fields?.id || fields.asset_id,
        creator: fields.creator,
        shareToken,
        canRead: fields.permission?.fields?.can_read || false,
        canWrite: fields.permission?.fields?.can_write || false,
        canAdmin: fields.permission?.fields?.can_admin || false,
        expiresAt: parseInt(fields.expires_at || "0", 10),
        isActive: fields.is_active || false,
        createdAt: parseInt(fields.created_at || "0", 10),
        lastAccessedAt: parseInt(fields.last_accessed_at || "0", 10),
        accessCount: parseInt(fields.access_count || "0", 10),
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get shareable link: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List all folders owned by the user
   * Queries Sui blockchain for Folder objects owned by the specified address
   */
  async listFolders(owner?: string): Promise<FolderMetadata[]> {
    const ownerAddress = owner || this.userAddress;

    if (!ownerAddress) {
      throw new BlockchainError(
        "Owner address required. Provide owner parameter or configure userAddress."
      );
    }

    try {
      const response = await this.jsonRpcClient.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${this.packageId}::folder::Folder`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      const folders: FolderMetadata[] = [];

      for (const item of response.data) {
        if (
          !item.data?.content ||
          item.data.content.dataType !== "moveObject"
        ) {
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fields = item.data.content.fields as any;

        // Parse folder data from Sui object
        folders.push({
          folderId: item.data.objectId,
          owner: ownerAddress,
          name: this.bytesToString(fields.name || []),
          description: this.bytesToString(fields.description || []),
          parentFolderId: fields.parent_folder_id?.fields?.id || undefined,
          assetCount: parseInt(fields.asset_count || "0", 10),
          createdAt: parseInt(fields.created_at || "0", 10),
          updatedAt: parseInt(fields.updated_at || "0", 10),
        });
      }

      return folders;
    } catch (error) {
      throw new BlockchainError(
        `Failed to list folders: ${
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
   * Matches contract function: create_bucket
   */
  async createBucket(params: {
    name: string;
    description: string;
    tags?: string[];
    category?: string;
    storageLimit?: number; // 0 = unlimited
  }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      const nameBytes = Array.from(Buffer.from(params.name, "utf-8"));
      const descriptionBytes = Array.from(
        Buffer.from(params.description, "utf-8")
      );

      // Convert tags to vector of vector<u8>
      const tagsArg = (params.tags || []).map((tag) =>
        Array.from(Buffer.from(tag, "utf-8"))
      );

      const categoryBytes = Array.from(
        Buffer.from(params.category || "", "utf-8")
      );

      tx.moveCall({
        target: `${this.packageId}::bucket::create_bucket`,
        arguments: [
          tx.pure.vector("u8", nameBytes),
          tx.pure.vector("u8", descriptionBytes),
          tx.pure("vector<vector<u8>>", tagsArg),
          tx.pure.vector("u8", categoryBytes),
          tx.pure.u64(params.storageLimit || 0),
          tx.object("0x6"), // Clock
        ],
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to create bucket: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List all buckets where user is owner or collaborator
   * Note: For owned buckets, queries owned objects.
   * For shared buckets where user is collaborator, we need to use events or an indexer.
   */
  async listOwnedBuckets(owner?: string): Promise<BucketMetadata[]> {
    const ownerAddress = owner || this.userAddress;

    if (!ownerAddress) {
      throw new BlockchainError(
        "Owner address required. Provide owner parameter or configure userAddress."
      );
    }

    try {
      // Note: Buckets are shared objects, so they don't appear in getOwnedObjects
      // We need to query by the bucket's owner field using an indexer or events
      // For now, we can query all Bucket objects and filter by owner
      // This is a simplified implementation - production should use events/indexer

      const response = await this.jsonRpcClient.queryEvents({
        query: {
          MoveEventType: `${this.packageId}::events::BucketCreatedEvent`,
        },
        limit: 100,
      });

      const buckets: BucketMetadata[] = [];

      for (const event of response.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eventData = event.parsedJson as any;

        // Filter by owner
        if (eventData.owner !== ownerAddress) {
          continue;
        }

        // Fetch the actual bucket object for full metadata
        try {
          const bucketObj = await this.jsonRpcClient.getObject({
            id: eventData.bucket_id,
            options: { showContent: true },
          });

          if (
            bucketObj.data?.content &&
            bucketObj.data.content.dataType === "moveObject"
          ) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fields = bucketObj.data.content.fields as any;

            buckets.push({
              bucketId: eventData.bucket_id,
              owner: eventData.owner,
              name: this.bytesToString(fields.name || []),
              description: this.bytesToString(fields.description || []),
              tags: (fields.tags || []).map((t: number[]) =>
                this.bytesToString(t)
              ),
              category: this.bytesToString(fields.category || []),
              collaboratorCount: parseInt(
                fields.collaborators?.length || "0",
                10
              ),
              assetCount: parseInt(fields.asset_ids?.length || "0", 10),
              totalSize: parseInt(fields.total_size || "0", 10),
              storageLimit: parseInt(fields.storage_limit || "0", 10),
              createdAt: parseInt(fields.created_at || "0", 10),
              updatedAt: parseInt(fields.updated_at || "0", 10),
            });
          }
        } catch {
          // Bucket may have been deleted, skip
          continue;
        }
      }

      return buckets;
    } catch (error) {
      throw new BlockchainError(
        `Failed to list buckets: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a specific bucket by ID
   */
  async getBucket(bucketId: string): Promise<BucketMetadata | null> {
    try {
      const bucketObj = await this.jsonRpcClient.getObject({
        id: bucketId,
        options: { showContent: true, showOwner: true },
      });

      if (
        !bucketObj.data?.content ||
        bucketObj.data.content.dataType !== "moveObject"
      ) {
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields = bucketObj.data.content.fields as any;

      return {
        bucketId,
        owner: fields.owner,
        name: this.bytesToString(fields.name || []),
        description: this.bytesToString(fields.description || []),
        tags: (fields.tags || []).map((t: number[]) => this.bytesToString(t)),
        category: this.bytesToString(fields.category || []),
        collaboratorCount: parseInt(fields.collaborators?.length || "0", 10),
        assetCount: parseInt(fields.asset_ids?.length || "0", 10),
        totalSize: parseInt(fields.total_size || "0", 10),
        storageLimit: parseInt(fields.storage_limit || "0", 10),
        createdAt: parseInt(fields.created_at || "0", 10),
        updatedAt: parseInt(fields.updated_at || "0", 10),
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get bucket: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Add collaborator to bucket
   * Matches contract function: add_collaborator
   */
  async addCollaborator(params: {
    bucketId: string;
    collaborator: string;
    canRead: boolean;
    canWrite: boolean;
    canAdmin: boolean;
  }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::bucket::add_collaborator`,
        arguments: [
          tx.object(params.bucketId),
          tx.pure.address(params.collaborator),
          tx.pure.bool(params.canRead),
          tx.pure.bool(params.canWrite),
          tx.pure.bool(params.canAdmin),
          tx.object("0x6"), // Clock
        ],
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to add collaborator: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Remove collaborator from bucket
   * Matches contract function: remove_collaborator
   */
  async removeCollaborator(params: {
    bucketId: string;
    collaborator: string;
  }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::bucket::remove_collaborator`,
        arguments: [
          tx.object(params.bucketId),
          tx.pure.address(params.collaborator),
          tx.object("0x6"), // Clock
        ],
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to remove collaborator: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Update collaborator permissions
   * Matches contract function: update_collaborator_permissions
   */
  async updateCollaboratorPermissions(params: {
    bucketId: string;
    collaborator: string;
    canRead: boolean;
    canWrite: boolean;
    canAdmin: boolean;
  }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::bucket::update_collaborator_permissions`,
        arguments: [
          tx.object(params.bucketId),
          tx.pure.address(params.collaborator),
          tx.pure.bool(params.canRead),
          tx.pure.bool(params.canWrite),
          tx.pure.bool(params.canAdmin),
          tx.object("0x6"), // Clock
        ],
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to update collaborator permissions: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Add asset to bucket
   * Matches contract function: add_asset_to_bucket
   */
  async addAssetToBucket(params: {
    bucketId: string;
    assetId: string;
  }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::bucket::add_asset_to_bucket`,
        arguments: [
          tx.object(params.bucketId),
          tx.object(params.assetId),
          tx.object("0x6"), // Clock
        ],
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to add asset to bucket: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Remove asset from bucket
   * Matches contract function: remove_asset_from_bucket
   */
  async removeAssetFromBucket(params: {
    bucketId: string;
    assetId: string;
  }): Promise<void> {
    if (!this.signAndExecuteFn || !this.userAddress) {
      throw new BlockchainError(
        "User-pays transaction not supported. signAndExecuteFn and userAddress required."
      );
    }

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::bucket::remove_asset_from_bucket`,
        arguments: [
          tx.object(params.bucketId),
          tx.object(params.assetId),
          tx.object("0x6"), // Clock
        ],
      });

      await this.signAndExecuteFn({ transaction: tx });
    } catch (error) {
      throw new BlockchainError(
        `Failed to remove asset from bucket: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Convert bytes array to string
   */
  private bytesToString(bytes: number[] | Uint8Array): string {
    if (Array.isArray(bytes)) {
      return Buffer.from(bytes).toString("utf-8");
    }
    return Buffer.from(bytes).toString("utf-8");
  }

  /**
   * Get gRPC client (for use by other services like Seal)
   */
  getClient(): SuiGrpcClient {
    return this.grpcClient;
  }

  /**
   * Get JSON-RPC client (for queries)
   */
  getJsonRpcClient(): SuiClient {
    return this.jsonRpcClient;
  }
}
