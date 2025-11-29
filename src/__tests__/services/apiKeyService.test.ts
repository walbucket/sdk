import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiKeyService, PERMISSION_UPLOAD, PERMISSION_READ, PERMISSION_DELETE, PERMISSION_TRANSFORM, PERMISSION_ADMIN } from '../../services/apiKeyService.js';
import { ValidationError, BlockchainError } from '../../types/errors.js';
import { createMockSuiGrpcClient, createMockSuiClient, TEST_CONSTANTS, MOCK_API_KEY_DATA } from '../setup.js';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// Mock SuiClient
vi.mock('@mysten/sui/client', () => ({
  SuiClient: vi.fn(),
  getFullnodeUrl: vi.fn(() => 'https://fullnode.testnet.sui.io'),
}));

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let mockGrpcClient: any;
  let mockJsonRpcClient: any;

  beforeEach(() => {
    mockGrpcClient = createMockSuiGrpcClient();
    mockJsonRpcClient = createMockSuiClient();
    
    (SuiClient as any).mockImplementation(() => mockJsonRpcClient);
    
    service = new ApiKeyService(mockGrpcClient as any, 3600, 'testnet');
    vi.clearAllMocks();
  });

  describe('validateApiKey', () => {
    it('should validate a valid API key', async () => {
      const apiKey = TEST_CONSTANTS.API_KEY;
      const packageId = TEST_CONSTANTS.PACKAGE_ID;

      // Mock getting API key object (when apiKeyId is provided, queryEvents is not called)
      // The service hashes the API key and compares with stored hash
      // We need to provide the hash of the actual API key
      const crypto = await import('crypto');
      const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      (mockJsonRpcClient.getObject as any).mockResolvedValue({
        data: {
          objectId: MOCK_API_KEY_DATA.keyId,
          content: {
            fields: {
              developer_address: MOCK_API_KEY_DATA.developerAddress,
              api_key_hash: Array.from(Buffer.from(apiKeyHash, 'hex')),
              name: MOCK_API_KEY_DATA.name,
              permissions: MOCK_API_KEY_DATA.permissions,
              rate_limit: MOCK_API_KEY_DATA.rateLimit,
              created_at: Math.floor(MOCK_API_KEY_DATA.createdAt / 1000),
              expires_at: MOCK_API_KEY_DATA.expiresAt,
              is_active: MOCK_API_KEY_DATA.isActive,
              usage_count: MOCK_API_KEY_DATA.usageCount,
              last_used_at: Math.floor(MOCK_API_KEY_DATA.lastUsedAt / 1000),
            },
          },
        },
      });

      const result = await service.validateApiKey(apiKey, packageId, MOCK_API_KEY_DATA.keyId);

      expect(result).toBeDefined();
      expect(result.keyId).toBe(MOCK_API_KEY_DATA.keyId);
      expect(result.developerAddress).toBe(MOCK_API_KEY_DATA.developerAddress);
      expect(result.permissions).toBe(MOCK_API_KEY_DATA.permissions);
    });

    it('should throw error for expired API key', async () => {
      const apiKey = TEST_CONSTANTS.API_KEY;
      const packageId = TEST_CONSTANTS.PACKAGE_ID;
      const expiredTime = Math.floor((Date.now() - 86400000) / 1000); // 1 day ago
      const crypto = await import('crypto');
      const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      (mockJsonRpcClient.getObject as any).mockResolvedValue({
        data: {
          objectId: MOCK_API_KEY_DATA.keyId,
          content: {
            fields: {
              developer_address: MOCK_API_KEY_DATA.developerAddress,
              api_key_hash: Array.from(Buffer.from(apiKeyHash, 'hex')),
              expires_at: expiredTime,
              is_active: true,
            },
          },
        },
      });

      await expect(
        service.validateApiKey(apiKey, packageId, MOCK_API_KEY_DATA.keyId)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error for inactive API key', async () => {
      const apiKey = TEST_CONSTANTS.API_KEY;
      const packageId = TEST_CONSTANTS.PACKAGE_ID;
      const crypto = await import('crypto');
      const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      (mockJsonRpcClient.getObject as any).mockResolvedValue({
        data: {
          objectId: MOCK_API_KEY_DATA.keyId,
          content: {
            fields: {
              developer_address: MOCK_API_KEY_DATA.developerAddress,
              api_key_hash: Array.from(Buffer.from(apiKeyHash, 'hex')),
              expires_at: 0,
              is_active: false,
            },
          },
        },
      });

      await expect(
        service.validateApiKey(apiKey, packageId, MOCK_API_KEY_DATA.keyId)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('hasPermission', () => {
    it('should check upload permission', () => {
      const hasPermission = service.hasPermission(MOCK_API_KEY_DATA, PERMISSION_UPLOAD);
      expect(hasPermission).toBe(true); // permissions = 31 (all permissions)
    });

    it('should check read permission', () => {
      const hasPermission = service.hasPermission(MOCK_API_KEY_DATA, PERMISSION_READ);
      expect(hasPermission).toBe(true);
    });

    it('should return false for missing permission', () => {
      const limitedKey = { ...MOCK_API_KEY_DATA, permissions: PERMISSION_READ };
      const hasPermission = service.hasPermission(limitedKey, PERMISSION_UPLOAD);
      expect(hasPermission).toBe(false);
    });
  });

  describe('getDeveloperAccountId', () => {
    it('should get developer account ID', async () => {
      const developerAddress = TEST_CONSTANTS.DEVELOPER_ADDRESS;
      const packageId = TEST_CONSTANTS.PACKAGE_ID;

      (mockJsonRpcClient.getOwnedObjects as any).mockResolvedValue({
        data: [{
          data: {
            objectId: TEST_CONSTANTS.DEVELOPER_ACCOUNT_ID,
          },
        }],
      });

      const result = await service.getDeveloperAccountId(developerAddress, packageId);
      expect(result).toBe(TEST_CONSTANTS.DEVELOPER_ACCOUNT_ID);
    });

    it('should return null if no developer account found', async () => {
      const developerAddress = TEST_CONSTANTS.DEVELOPER_ADDRESS;
      const packageId = TEST_CONSTANTS.PACKAGE_ID;

      (mockJsonRpcClient.getOwnedObjects as any).mockResolvedValue({
        data: [],
      });

      const result = await service.getDeveloperAccountId(developerAddress, packageId);
      expect(result).toBeNull();
    });
  });
});
