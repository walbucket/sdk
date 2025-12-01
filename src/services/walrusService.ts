import axios, { AxiosInstance } from "axios";
import type { NetworkError } from "../types/errors.js";
import { NetworkError as NetworkErrorClass } from "../types/errors.js";

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

  // File size limits (based on Walrus documentation and publisher capabilities)
  // Note: Third-party publishers may have lower limits. Official Walrus publishers support up to 13.3 GiB
  private static readonly MAX_SINGLE_BLOB_SIZE = 100 * 1024 * 1024; // 100 MB recommended max for single blob
  private static readonly WALRUS_ABSOLUTE_MAX = 13.3 * 1024 * 1024 * 1024; // 13.3 GiB absolute max

  /**
   * Creates a new WalrusService instance
   *
   * @param publisherUrl - Walrus publisher endpoint URL (for uploads/deletes)
   * @param aggregatorUrl - Walrus aggregator endpoint URL (for retrieves)
   */
  constructor(publisherUrl: string, aggregatorUrl: string) {
    this.publisherClient = axios.create({
      baseURL: publisherUrl,
      timeout: 600000, // 10 minutes default (will be overridden per request)
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        "Content-Type": "application/octet-stream",
      },
    });

    this.aggregatorClient = axios.create({
      baseURL: aggregatorUrl,
      timeout: 300000, // 5 minutes for downloads
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        Accept: "application/octet-stream",
      },
    });
  }

  /**
   * Calculate appropriate timeout based on file size
   * Larger files need more time to upload
   */
  private calculateTimeout(bytes: number): number {
    const MB = bytes / (1024 * 1024);

    if (MB < 1) return 30000; // 30 seconds for < 1MB
    if (MB < 5) return 60000; // 1 minute for < 5MB
    if (MB < 10) return 120000; // 2 minutes for < 10MB
    if (MB < 50) return 300000; // 5 minutes for < 50MB
    if (MB < 100) return 600000; // 10 minutes for < 100MB
    return 900000; // 15 minutes for larger files
  }

  /**
   * Validate file size before upload
   * @throws {NetworkError} If file exceeds maximum size
   */
  private validateFileSize(bytes: number): void {
    if (bytes > WalrusService.MAX_SINGLE_BLOB_SIZE) {
      const sizeMB = (bytes / (1024 * 1024)).toFixed(2);
      const maxMB = (
        WalrusService.MAX_SINGLE_BLOB_SIZE /
        (1024 * 1024)
      ).toFixed(0);
      throw new NetworkErrorClass(
        `File size (${sizeMB} MB) exceeds maximum single blob size (${maxMB} MB). ` +
          `Large files require chunking. Please upload files smaller than ${maxMB} MB or implement chunked upload.`,
        413 // Request Entity Too Large
      );
    }

    if (bytes > WalrusService.WALRUS_ABSOLUTE_MAX) {
      const sizeGB = (bytes / (1024 * 1024 * 1024)).toFixed(2);
      throw new NetworkErrorClass(
        `File size (${sizeGB} GB) exceeds Walrus maximum blob size (13.3 GB). ` +
          `Files this large must be split into multiple blobs.`,
        413
      );
    }
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
   * @param options.onProgress - Optional callback for upload progress
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
   *
   * // Upload with progress tracking
   * const blobId = await walrusService.upload(data, {
   *   onProgress: (progress) => console.log(`${progress.percentage}%`)
   * });
   * ```
   */
  async upload(
    data: Buffer | Uint8Array,
    options?: {
      permanent?: boolean;
      onProgress?: (progress: {
        loaded: number;
        total: number;
        percentage: number;
      }) => void;
    }
  ): Promise<string> {
    try {
      const fileSize = data.length;
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);

      // Log file size for debugging
      console.log(`[Walrus] Uploading file: ${sizeMB} MB`);

      // Validate file size
      this.validateFileSize(fileSize);

      // Build URL with epochs parameter (default to 5 epochs for testnet)
      const params = new URLSearchParams();
      params.append("epochs", "5");

      const url = `/v1/blobs?${params.toString()}`;

      // Calculate dynamic timeout based on file size
      const timeout = this.calculateTimeout(fileSize);

      const response = await this.publisherClient.put<{
        newlyCreated?: {
          blobObject: {
            id: string;
            blobId: string;
            storage: {
              endEpoch: number;
            };
          };
          cost?: number;
        };
        alreadyCertified?: {
          blobId: string;
          endEpoch: number;
        };
      }>(url, data, {
        headers: {
          "Content-Type": "application/octet-stream",
        },
        timeout,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        onUploadProgress: (progressEvent) => {
          if (options?.onProgress && progressEvent.total) {
            const percentage = Math.round(
              (progressEvent.loaded / progressEvent.total) * 100
            );
            options.onProgress({
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage,
            });
          }
        },
      });

      // Extract blob ID from response (matches Walrus API v1 format)
      const blobId =
        response.data.newlyCreated?.blobObject.blobId ||
        response.data.alreadyCertified?.blobId;

      if (!blobId) {
        console.error("Walrus response:", response.data);
        throw new NetworkErrorClass("No blob ID returned from Walrus");
      }

      // Remove 0x prefix if present
      const cleanBlobId = blobId.startsWith("0x") ? blobId.slice(2) : blobId;

      console.log(`[Walrus] Upload successful: ${cleanBlobId}`);

      return cleanBlobId;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const sizeMB = (data.length / (1024 * 1024)).toFixed(2);

        // Handle 413 specifically
        if (status === 413) {
          throw new NetworkErrorClass(
            `File upload rejected by Walrus server (${sizeMB} MB). ` +
              `The publisher endpoint may have a lower size limit than expected. ` +
              `Try using a different Walrus publisher or reduce file size.`,
            413,
            error
          );
        }

        throw new NetworkErrorClass(
          `Walrus upload failed: ${error.message}`,
          status,
          error
        );
      }
      throw new NetworkErrorClass(
        `Walrus upload failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
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
      if (!blobId.startsWith("0x")) {
        url = `/v1/blobs/${blobId}`;
      }

      const response = await this.aggregatorClient.get<ArrayBuffer>(url, {
        responseType: "arraybuffer",
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
        `Walrus retrieve failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
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
        `Walrus delete failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }
}
