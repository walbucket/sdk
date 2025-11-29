import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalrusService } from '../../services/walrusService.js';
import { NetworkError } from '../../types/errors.js';

// Create mock clients that will be used by the service
const mockPublisherClient = {
  put: vi.fn(),
  delete: vi.fn(),
};

const mockAggregatorClient = {
  get: vi.fn(),
};

// Mock axios module
vi.mock('axios', () => {
  const actualAxios = vi.importActual('axios');
  return {
    default: {
      ...actualAxios,
      create: vi.fn((config: any) => {
        if (config?.baseURL?.includes('publisher')) {
          return mockPublisherClient;
        } else if (config?.baseURL?.includes('aggregator')) {
          return mockAggregatorClient;
        }
        return {
          put: vi.fn(),
          get: vi.fn(),
          delete: vi.fn(),
        };
      }),
      isAxiosError: (error: any) => {
        return error && error.response !== undefined;
      },
    },
    isAxiosError: (error: any) => {
      return error && error.response !== undefined;
    },
  };
});

describe('WalrusService', () => {
  let service: WalrusService;
  const publisherUrl = 'https://publisher.testnet.walrus.space';
  const aggregatorUrl = 'https://aggregator.testnet.walrus.space';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WalrusService(publisherUrl, aggregatorUrl);
  });

  describe('upload', () => {
    it('should upload data and return blob ID', async () => {
      const testData = Buffer.from('test data');
      const mockBlobId = 'blob_123';

      mockPublisherClient.put.mockResolvedValue({
        data: { blobId: mockBlobId },
      });

      const result = await service.upload(testData);

      expect(result).toBe(mockBlobId);
      expect(mockPublisherClient.put).toHaveBeenCalledWith(
        expect.stringContaining('/v1/blobs'),
        testData,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/octet-stream',
          }),
        })
      );
    });

    it('should handle string blob ID response', async () => {
      const testData = Buffer.from('test data');
      const mockBlobId = 'blob_123';

      mockPublisherClient.put.mockResolvedValue({
        data: mockBlobId,
      });

      const result = await service.upload(testData);
      expect(result).toBe(mockBlobId);
    });

    it('should handle objectId response format', async () => {
      const testData = Buffer.from('test data');
      const mockObjectId = '0x123';

      mockPublisherClient.put.mockResolvedValue({
        data: { objectId: mockObjectId },
      });

      const result = await service.upload(testData);
      expect(result).toBe(mockObjectId);
    });

    it('should handle nested blobStoreResult format', async () => {
      const testData = Buffer.from('test data');
      const mockBlobId = 'blob_123';

      mockPublisherClient.put.mockResolvedValue({
        data: {
          blobStoreResult: {
            newlyCreated: {
              blobObject: {
                blobId: mockBlobId,
              },
            },
          },
        },
      });

      const result = await service.upload(testData);
      expect(result).toBe(mockBlobId);
    });

    it('should throw NetworkError on upload failure', async () => {
      const testData = Buffer.from('test data');

      mockPublisherClient.put.mockRejectedValue(
        new Error('Network error')
      );

      await expect(service.upload(testData)).rejects.toThrow(NetworkError);
    });

    it('should support permanent blobs', async () => {
      const testData = Buffer.from('test data');
      const mockBlobId = 'blob_123';

      mockPublisherClient.put.mockResolvedValue({
        data: { blobId: mockBlobId },
      });

      await service.upload(testData, { permanent: true });

      expect(mockPublisherClient.put).toHaveBeenCalledWith(
        expect.stringContaining('permanent=true'),
        testData,
        expect.any(Object)
      );
    });
  });

  describe('retrieve', () => {
    it('should retrieve blob by blob ID', async () => {
      const blobId = 'blob_123';
      const mockData = Buffer.from('test data');

      mockAggregatorClient.get.mockResolvedValue({
        data: mockData,
      });

      const result = await service.retrieve(blobId);

      expect(result).toEqual(mockData);
      expect(mockAggregatorClient.get).toHaveBeenCalledWith(
        `/v1/blobs/${blobId}`,
        expect.objectContaining({
          responseType: 'arraybuffer',
        })
      );
    });

    it('should retrieve blob by object ID', async () => {
      const objectId = '0x123';
      const mockData = Buffer.from('test data');

      mockAggregatorClient.get.mockResolvedValue({
        data: mockData,
      });

      const result = await service.retrieve(objectId);

      expect(result).toEqual(mockData);
      expect(mockAggregatorClient.get).toHaveBeenCalledWith(
        `/v1/blobs/by-object-id/${objectId}`,
        expect.any(Object)
      );
    });

    it('should throw NetworkError on retrieve failure', async () => {
      const blobId = 'blob_123';

      mockAggregatorClient.get.mockRejectedValue(
        new Error('Not found')
      );

      await expect(service.retrieve(blobId)).rejects.toThrow(NetworkError);
    });
  });

  describe('delete', () => {
    it('should delete blob', async () => {
      const blobId = 'blob_123';

      mockPublisherClient.delete.mockResolvedValue({});

      await service.delete(blobId);

      expect(mockPublisherClient.delete).toHaveBeenCalledWith(
        `/v1/blobs/${blobId}`
      );
    });

    it('should handle 404 gracefully (permanent blob)', async () => {
      const blobId = 'blob_123';

      const error: any = new Error('Not found');
      error.response = { status: 404 };

      mockPublisherClient.delete.mockRejectedValue(error);

      // Should not throw
      await expect(service.delete(blobId)).resolves.toBeUndefined();
    });

    it('should handle 405 gracefully (deletion not supported)', async () => {
      const blobId = 'blob_123';

      const error: any = new Error('Method not allowed');
      error.response = { status: 405 };

      mockPublisherClient.delete.mockRejectedValue(error);

      // Should not throw
      await expect(service.delete(blobId)).resolves.toBeUndefined();
    });

    it('should throw NetworkError for other errors', async () => {
      const blobId = 'blob_123';

      const error: any = new Error('Server error');
      error.response = { status: 500 };

      mockPublisherClient.delete.mockRejectedValue(error);

      await expect(service.delete(blobId)).rejects.toThrow(NetworkError);
    });
  });
});
