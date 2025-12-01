/**
 * Test setup and utilities
 * Provides mocks and test helpers for SDK tests
 */

import { vi } from "vitest";
import type { SuiClient } from "@mysten/sui/client";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import type { SealClient } from "@mysten/seal";
import axios from "axios";

/**
 * Mock Sui JSON-RPC Client
 */
export function createMockSuiClient(): Partial<SuiClient> {
  return {
    getObject: vi.fn(),
    getOwnedObjects: vi.fn(),
    queryEvents: vi.fn(),
    signAndExecuteTransaction: vi.fn(),
  };
}

/**
 * Mock Sui gRPC Client
 */
export function createMockSuiGrpcClient(): Partial<SuiGrpcClient> {
  return {
    ledger: {
      getObject: vi.fn(),
    } as any,
    transaction: {
      executeTransaction: vi.fn(),
    } as any,
  };
}

/**
 * Mock Seal Client
 */
export function createMockSealClient(): Partial<SealClient> {
  return {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
  };
}

/**
 * Mock Axios instance
 */
export function createMockAxiosInstance() {
  return {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    post: vi.fn(),
  };
}

/**
 * Test constants
 */
export const TEST_CONSTANTS = {
  PACKAGE_ID:
    "0x481a774f5cf0a3437a6f9623604874681943950bb82c146051afdec74f0c9b26",
  NETWORK: "testnet" as const,
  API_KEY: "test_api_key_123",
  API_KEY_HASH:
    "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3", // SHA-256 of '123'
  DEVELOPER_ADDRESS: "0x1234567890abcdef1234567890abcdef12345678",
  DEVELOPER_ACCOUNT_ID: "0xdev_account_123",
  ASSET_ID: "0xasset_123",
  BLOB_ID: "blob_123",
  POLICY_ID: "0xpolicy_123",
};

/**
 * Mock API Key Data
 */
export const MOCK_API_KEY_DATA = {
  keyId: "0xapi_key_123",
  developerAddress: TEST_CONSTANTS.DEVELOPER_ADDRESS,
  name: "Test API Key",
  permissions: 31, // All permissions
  rateLimit: 1000,
  createdAt: Date.now() - 86400000, // 1 day ago
  expiresAt: 0, // No expiration
  isActive: true,
  usageCount: 0,
  lastUsedAt: 0,
};

/**
 * Mock Asset Metadata
 */
export const MOCK_ASSET_METADATA = {
  assetId: TEST_CONSTANTS.ASSET_ID,
  owner: TEST_CONSTANTS.DEVELOPER_ADDRESS,
  blobId: TEST_CONSTANTS.BLOB_ID,
  name: "test-image.jpg",
  contentType: "image/jpeg",
  size: 1024,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  tags: ["test"],
  description: "Test asset",
  category: "image",
};

/**
 * Mock Policy Data
 */
export const MOCK_POLICY_DATA = {
  policyId: TEST_CONSTANTS.POLICY_ID,
  assetId: TEST_CONSTANTS.ASSET_ID,
  policyType: 1, // wallet-gated
  allowedAddresses: [TEST_CONSTANTS.DEVELOPER_ADDRESS],
  expiration: 0,
  createdAt: Date.now(),
};
