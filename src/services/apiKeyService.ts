import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import type { ApiKeyData } from "../types/responses.js";
import { BlockchainError, ValidationError } from "../types/errors.js";
import crypto from "crypto";

/**
 * Permission flags (matches contract constants)
 * From contract: PERMISSION_UPLOAD = 1, PERMISSION_READ = 2, PERMISSION_DELETE = 4, PERMISSION_TRANSFORM = 8, PERMISSION_ADMIN = 16
 */
export const PERMISSION_UPLOAD = 1;
export const PERMISSION_READ = 2;
export const PERMISSION_DELETE = 4;
export const PERMISSION_TRANSFORM = 8;
export const PERMISSION_ADMIN = 16;

/**
 * API Key Service
 *
 * Handles on-chain API key validation and permission checking.
 * Validates API keys by querying the Sui blockchain and checks permissions
 * using bit flags that match the contract implementation.
 *
 * Note: ApiKey and DeveloperAccount are shared objects (v0.3.0+), allowing
 * any user to reference them in transactions while maintaining access control
 * through on-chain validation.
 *
 * Features:
 * - On-chain validation via Sui blockchain queries
 * - Permission checking (upload, read, delete, transform, admin)
 * - Caching to reduce blockchain queries
 * - Developer account ID resolution via events
 *
 * @example
 * ```typescript
 * const apiKeyService = new ApiKeyService(grpcClient, 3600, 'testnet');
 *
 * // Validate API key
 * const apiKeyData = await apiKeyService.validateApiKey(apiKey, packageId);
 *
 * // Check permissions
 * if (apiKeyService.hasPermission(apiKeyData, PERMISSION_UPLOAD)) {
 *   // User has upload permission
 * }
 *
 * // Get developer account ID
 * const devAccountId = await apiKeyService.getDeveloperAccountId(address, packageId);
 * ```
 */
export class ApiKeyService {
  private grpcClient: SuiGrpcClient;
  private jsonRpcClient: SuiClient;
  private cache: Map<string, { data: ApiKeyData; expiresAt: number }> =
    new Map();
  private cacheTTL: number;
  private network: string;

  constructor(
    client: SuiGrpcClient,
    cacheTTL: number = 3600,
    network: string = "testnet"
  ) {
    this.grpcClient = client;
    this.network = network;
    this.cacheTTL = cacheTTL * 1000; // Convert to milliseconds

    // Use JSON-RPC for queries (more stable)
    this.jsonRpcClient = new SuiClient({
      url: getFullnodeUrl(network as any),
    });
  }

  /**
   * Validate API key on-chain
   *
   * Validates an API key by querying the Sui blockchain. Checks:
   * - API key hash matches
   * - API key is active
   * - API key has not expired
   *
   * Results are cached to reduce blockchain queries.
   *
   * @param apiKey - The API key string to validate
   * @param packageId - Package ID of the deployed contract
   * @param apiKeyId - Optional API key object ID (if known, skips lookup)
   *
   * @returns API key data including permissions, expiration, and developer address
   *
   * @throws {ValidationError} If API key is invalid, expired, or inactive
   * @throws {BlockchainError} If blockchain query fails
   *
   * @example
   * ```typescript
   * const apiKeyData = await apiKeyService.validateApiKey('your-api-key', packageId);
   * console.log('Permissions:', apiKeyData.permissions);
   * console.log('Expires:', new Date(apiKeyData.expiration));
   * ```
   */
  async validateApiKey(
    apiKey: string,
    packageId: string,
    apiKeyId?: string
  ): Promise<ApiKeyData> {
    // Check cache first
    const cacheKey = this.getCacheKey(apiKey);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      // Hash API key for lookup
      const apiKeyHash = this.hashApiKey(apiKey);

      // Find API key object by querying events or using a registry
      // For now, we'll need to find the API key object ID
      // This is a simplified approach - in production, you might have a registry
      let keyId: string | null = apiKeyId || null;
      if (!keyId) {
        keyId = await this.findApiKeyObjectId(apiKeyHash, packageId);
      }

      if (!keyId) {
        throw new ValidationError("API key not found");
      }

      // Get API key object from Sui using JSON-RPC
      const object = await this.jsonRpcClient.getObject({
        id: keyId,
        options: {
          showContent: true,
        },
      });

      if (!object.data || !("content" in object.data)) {
        throw new ValidationError("API key object not found");
      }

      const content = object.data.content as any;
      const fields = content.fields || {};

      // Verify hash matches
      const storedHash = this.bytesToString(fields.api_key_hash || []);
      if (storedHash !== apiKeyHash) {
        throw new ValidationError("Invalid API key hash");
      }

      const currentTime = Date.now();
      const expiresAt = Number(fields.expires_at || 0) * 1000; // Convert to milliseconds

      // Check if expired
      if (expiresAt > 0 && currentTime >= expiresAt) {
        throw new ValidationError("API key has expired");
      }

      // Check if active
      if (!fields.is_active) {
        throw new ValidationError("API key is not active");
      }

      const apiKeyData: ApiKeyData = {
        keyId,
        developerAddress: fields.developer_address || "",
        name: fields.name || "",
        permissions: Number(fields.permissions || 0),
        rateLimit: Number(fields.rate_limit || 0),
        createdAt: Number(fields.created_at || 0) * 1000,
        expiresAt,
        isActive: fields.is_active || false,
        usageCount: Number(fields.usage_count || 0),
        lastUsedAt: Number(fields.last_used_at || 0) * 1000,
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: apiKeyData,
        expiresAt: Date.now() + this.cacheTTL,
      });

      return apiKeyData;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to validate API key: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if API key has permission
   * Matches contract function: check_permission
   */
  hasPermission(apiKeyData: ApiKeyData, permission: number): boolean {
    return (apiKeyData.permissions & permission) !== 0;
  }

  /**
   * Get developer account ID from developer address
   * Uses event lookup to find DeveloperAccount (shared object)
   */
  async getDeveloperAccountId(
    developerAddress: string,
    packageId: string
  ): Promise<string | null> {
    try {
      // Query DeveloperAccountCreated events to find the account for this developer
      const events = await this.jsonRpcClient.queryEvents({
        query: {
          MoveEventType: `${packageId}::events::DeveloperAccountCreated`,
        },
        limit: 100,
        order: "descending",
      });

      if (!events.data || events.data.length === 0) {
        return null;
      }

      // Find the event for this developer's address
      for (const event of events.data) {
        const parsedJson = event.parsedJson as any;
        if (parsedJson?.owner === developerAddress) {
          return parsedJson?.account_id || null;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Hash API key (SHA-256)
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash("sha256").update(apiKey).digest("hex");
  }

  /**
   * Find API key object ID by hash
   * Queries all ApiKey objects and checks their hashes
   * Note: This requires checking multiple objects - consider caching or using a registry
   */
  private async findApiKeyObjectId(
    apiKeyHash: string,
    packageId: string
  ): Promise<string | null> {
    try {
      // First, get all ApiKeyCreated events to find potential API key IDs
      const events = await this.jsonRpcClient.queryEvents({
        query: {
          MoveEventType: `${packageId}::events::ApiKeyCreated`,
        },
        limit: 1000, // May need pagination for production
        order: "descending", // Get most recent first
      });

      if (!events.data || events.data.length === 0) {
        return null;
      }

      // Check each API key object to find one with matching hash
      for (const event of events.data) {
        const parsedJson = event.parsedJson as any;
        const apiKeyId = parsedJson?.api_key_id;

        if (!apiKeyId) {
          continue;
        }

        try {
          // Get the API key object and check its hash
          const object = await this.jsonRpcClient.getObject({
            id: apiKeyId,
            options: {
              showContent: true,
            },
          });

          if (object.data && "content" in object.data) {
            const content = object.data.content as any;
            const fields = content.fields || {};
            const storedHash = this.bytesToString(fields.api_key_hash || []);

            // Check if this is the API key we're looking for
            if (storedHash === apiKeyHash && fields.is_active) {
              return apiKeyId;
            }
          }
        } catch (error) {
          // Skip this API key if we can't fetch it (might be deleted)
          continue;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get cache key for API key
   */
  private getCacheKey(apiKey: string): string {
    return this.hashApiKey(apiKey);
  }

  /**
   * Convert bytes array to string
   */
  private bytesToString(bytes: number[] | Uint8Array): string {
    if (Array.isArray(bytes)) {
      return Buffer.from(bytes).toString("hex");
    }
    return Buffer.from(bytes).toString("hex");
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
