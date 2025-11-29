import axios, { AxiosInstance } from 'axios';
import type { NetworkError } from '../types/errors.js';
import { NetworkError as NetworkErrorClass } from '../types/errors.js';

/**
 * Walrus Service
 * 
 * Handles blob storage operations via Walrus REST API.
 * Walrus is a public decentralized storage network that does NOT require API keys.
 * 
 * This service manages two HTTP clients:
 * - Publisher client: For uploading and deleting blobs
 * - Aggregator client: For retrieving blobs
 * 
 * @example
 * ```typescript
 * const walrusService = new WalrusService(
 *   'https://publisher.testnet.walrus.space',
 *   'https://aggregator.testnet.walrus.space'
 * );
 * 
 * // Upload a file
 * const blobId = await walrusService.upload(Buffer.from('file data'));
 * 
 * // Retrieve a file
 * const data = await walrusService.retrieve(blobId);
 * 
 * // Delete a file
 * await walrusService.delete(blobId);
 * ```
 */
export class WalrusService {
  private publisherClient: AxiosInstance;
  private aggregatorClient: AxiosInstance;

  /**
   * Creates a new WalrusService instance
   * 
   * @param publisherUrl - Walrus publisher endpoint URL (for uploads/deletes)
   * @param aggregatorUrl - Walrus aggregator endpoint URL (for retrieves)
   */
  constructor(publisherUrl: string, aggregatorUrl: string) {
    this.publisherClient = axios.create({
      baseURL: publisherUrl,
      timeout: 60000, // 60 seconds for large file uploads
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });

    this.aggregatorClient = axios.create({
      baseURL: aggregatorUrl,
      timeout: 60000,
      headers: {
        'Accept': 'application/octet-stream',
      },
    });
  }

  /**
   * Upload file to Walrus storage
   * 
   * Uploads binary data to Walrus and returns the blob ID.
   * Supports both permanent and deletable blobs.
   * 
   * @param data - File data as Buffer or Uint8Array
   * @param options - Upload options
   * @param options.permanent - If true, creates a permanent blob that cannot be deleted (default: false)
   * 
   * @returns Blob ID that can be used to retrieve the file
   * 
   * @throws {NetworkError} If upload fails (network error, timeout, etc.)
   * 
   * @example
   * ```typescript
   * // Upload deletable blob
   * const blobId = await walrusService.upload(Buffer.from('hello world'));
   * 
   * // Upload permanent blob
   * const permanentBlobId = await walrusService.upload(data, { permanent: true });
   * ```
   */
  async upload(data: Buffer | Uint8Array, options?: {
    permanent?: boolean;
  }): Promise<string> {
    try {
      const params = new URLSearchParams();
      if (options?.permanent) {
        params.append('permanent', 'true');
      }

      const url = `/v1/blobs${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await this.publisherClient.put<{
        blobId?: string;
        objectId?: string;
        blobStoreResult?: {
          newlyCreated?: {
            blobObject?: {
              blobId: string;
            };
          };
        };
        [key: string]: any;
      }>(
        url,
        data,
        {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': data.length.toString(),
          },
        }
      );

      // Extract blob ID from response (Walrus returns different formats)
      let blobId: string | undefined;
      
      if (typeof response.data === 'string') {
        blobId = response.data;
      } else if (response.data.blobId) {
        blobId = response.data.blobId;
      } else if (response.data.objectId) {
        blobId = response.data.objectId;
      } else if (response.data.blobStoreResult?.newlyCreated?.blobObject?.blobId) {
        blobId = response.data.blobStoreResult.newlyCreated.blobObject.blobId;
      }
      
      if (!blobId) {
        throw new NetworkErrorClass('No blob ID returned from Walrus');
      }

      return blobId;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new NetworkErrorClass(
          `Walrus upload failed: ${error.message}`,
          error.response?.status,
          error
        );
      }
      throw new NetworkErrorClass(
        `Walrus upload failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Retrieve file from Walrus storage
   * 
   * Retrieves binary data from Walrus using either a blob ID or object ID.
   * Automatically detects the format and uses the appropriate endpoint.
   * 
   * @param blobId - Blob ID or object ID (format is auto-detected)
   * 
   * @returns File data as Buffer
   * 
   * @throws {NetworkError} If retrieval fails (404, network error, timeout, etc.)
   * 
   * @example
   * ```typescript
   * // Retrieve by blob ID
   * const data = await walrusService.retrieve('blob_123');
   * 
   * // Retrieve by object ID (auto-detected)
   * const data = await walrusService.retrieve('0x123...');
   * ```
   */
  async retrieve(blobId: string): Promise<Buffer> {
    try {
      // Try by object ID first (if it's a Sui object ID)
      let url = `/v1/blobs/by-object-id/${blobId}`;
      
      // If blobId is not a Sui object ID format, try direct blob access
      if (!blobId.startsWith('0x')) {
        url = `/v1/blobs/${blobId}`;
      }

      const response = await this.aggregatorClient.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new NetworkErrorClass(
          `Walrus retrieve failed: ${error.message}`,
          error.response?.status,
          error
        );
      }
      throw new NetworkErrorClass(
        `Walrus retrieve failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete file from Walrus
   * DELETE /v1/blobs/<blob-id>
   * Note: Deletion may not be supported for permanent blobs
   */
  async delete(blobId: string): Promise<void> {
    try {
      await this.publisherClient.delete(`/v1/blobs/${blobId}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // If deletion is not supported, log warning but don't fail
        if (error.response?.status === 404 || error.response?.status === 405) {
          // Don't throw error for unsupported deletion
          return;
        }
        throw new NetworkErrorClass(
          `Walrus delete failed: ${error.message}`,
          error.response?.status,
          error
        );
      }
      throw new NetworkErrorClass(
        `Walrus delete failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }
}
