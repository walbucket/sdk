import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import type { Signer } from "@mysten/sui/cryptography";
import type { SuiNetwork } from "../types/config.js";
import type { AssetMetadata } from "../types/responses.js";
import { BlockchainError } from "../types/errors.js";
import { getSuiGrpcUrl } from "../utils/config.js";

/**
 * Sui Service
 * Handles all Sui blockchain interactions via gRPC
 */
export class SuiService {
  private grpcClient: SuiGrpcClient;
  private jsonRpcClient: SuiClient; // Fallback for queries that work better with JSON-RPC
  private packageId: string;
  private network: SuiNetwork;

  constructor(network: SuiNetwork, packageId: string) {
    this.network = network;
    this.packageId = packageId;

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
          // folder_id: Option<ID> - pass as object reference if provided, or null
          // Note: In Sui, Option<ID> in Move maps to optional object reference
          // We need to handle this as an optional object argument
          // For now, using address as placeholder (backend uses same approach)
          // TODO: Fix to use proper ID type when Sui SDK supports it
          tx.pure.option("address", params.folderId || null),
          tx.object(params.apiKeyId),
          tx.pure.vector("u8", apiKeyHashBytes),
          tx.object(params.developerAccountId),
          tx.object("0x6"), // Clock shared object
        ],
      });

      // Build and sign transaction
      // Check if signer is a wallet account (has signAndExecuteTransaction method)
      // or a keypair (has toSuiAddress method)
      let result: any;

      if (
        "signAndExecuteTransaction" in params.signer &&
        typeof params.signer.signAndExecuteTransaction === "function"
      ) {
        // Wallet signer - pass transaction and client
        result = await params.signer.signAndExecuteTransaction({
          transaction: tx,
          client: this.jsonRpcClient,
        });
      } else {
        // Keypair signer - use SuiClient's signAndExecuteTransaction
        result = await this.jsonRpcClient.signAndExecuteTransaction({
          transaction: tx,
          signer: params.signer,
          options: {
            showEffects: true,
            showEvents: true,
          },
        });
      }

      // Extract asset ID from created objects
      if (result.effects?.created) {
        const created = result.effects.created;
        if (created && created.length > 0) {
          const assetId = created[0].reference?.objectId;
          if (assetId) {
            return assetId;
          }
        }
      }

      throw new BlockchainError("Failed to get asset ID from transaction");
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
   * Delete asset from Sui blockchain
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
   * List assets owned by an address
   *
   * Queries the Sui blockchain for all Asset objects owned by the given address.
   *
   * @param owner - The owner address to query assets for
   * @returns Array of asset metadata
   * @throws {BlockchainError} If the query fails
   */
  async listAssets(owner: string): Promise<AssetMetadata[]> {
    try {
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

      return assets;
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
