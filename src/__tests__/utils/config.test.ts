import { describe, it, expect } from "vitest";
import { validateConfig, getSuiGrpcUrl } from "../../utils/config.js";
import { ConfigurationError } from "../../types/errors.js";
import {
  DEFAULT_PACKAGE_IDS,
  DEFAULT_WALRUS_URLS,
  DEFAULT_SUI_GRPC_URLS,
} from "../../types/config.js";

describe("Config Utils", () => {
  describe("validateConfig", () => {
    it("should validate minimal config", () => {
      const config = {
        apiKey: "test-api-key",
        sponsorPrivateKey: "0x" + "0".repeat(64), // Mock private key (32 bytes hex)
      };

      const result = validateConfig(config);
      expect(result.apiKey).toBe("test-api-key");
      expect(result.network).toBe("testnet");
      expect(result.gasStrategy).toBe("developer-sponsored");
      expect(result.encryption).toBe(true);
    });

    it("should throw error if API key missing", () => {
      expect(() => {
        validateConfig({} as any);
      }).toThrow(ConfigurationError);
    });

    it("should throw error if sponsorPrivateKey missing for developer-sponsored", () => {
      expect(() => {
        validateConfig({
          apiKey: "test",
          gasStrategy: "developer-sponsored",
        });
      }).toThrow(ConfigurationError);
    });

    it("should throw error if userSigner missing for user-pays", () => {
      expect(() => {
        validateConfig({
          apiKey: "test",
          gasStrategy: "user-pays",
        });
      }).toThrow(ConfigurationError);
    });

    it("should use provided package ID", () => {
      const customPackageId = "0xcustom123";
      const result = validateConfig({
        apiKey: "test",
        sponsorPrivateKey: "0x" + "0".repeat(64),
        packageId: customPackageId,
      });

      expect(result.packageId).toBe(customPackageId);
    });

    it("should use default package ID for network", () => {
      const result = validateConfig({
        apiKey: "test",
        sponsorPrivateKey: "0x" + "0".repeat(64),
        network: "testnet",
      });

      expect(result.packageId).toBe(DEFAULT_PACKAGE_IDS.testnet);
      expect(result.packageId).toBe(
        "0x481a774f5cf0a3437a6f9623604874681943950bb82c146051afdec74f0c9b26"
      ); // Latest testnet deployment with asset ownership fix
    });

    it("should throw error if network has no package ID", () => {
      expect(() => {
        validateConfig({
          apiKey: "test",
          sponsorPrivateKey: "0x" + "0".repeat(64),
          network: "mainnet", // Not deployed yet
        });
      }).toThrow(ConfigurationError);
    });

    it("should use default Walrus URLs for network", () => {
      const result = validateConfig({
        apiKey: "test",
        sponsorPrivateKey: "0x" + "0".repeat(64),
        network: "testnet",
      });

      expect(result.walrusPublisherUrl).toBe(
        DEFAULT_WALRUS_URLS.testnet.publisher
      );
      expect(result.walrusAggregatorUrl).toBe(
        DEFAULT_WALRUS_URLS.testnet.aggregator
      );
    });

    it("should use custom cache TTL", () => {
      const result = validateConfig({
        apiKey: "test",
        sponsorPrivateKey: "0x" + "0".repeat(64),
        cacheTTL: 7200,
      });

      expect(result.cacheTTL).toBe(7200);
    });

    it("should use default cache TTL if not provided", () => {
      const result = validateConfig({
        apiKey: "test",
        sponsorPrivateKey: "0x" + "0".repeat(64),
      });

      expect(result.cacheTTL).toBe(3600);
    });
  });

  describe("getSuiGrpcUrl", () => {
    it("should return correct gRPC URL for testnet", () => {
      const url = getSuiGrpcUrl("testnet");
      expect(url).toBe(DEFAULT_SUI_GRPC_URLS.testnet);
    });

    it("should return correct gRPC URL for mainnet", () => {
      const url = getSuiGrpcUrl("mainnet");
      expect(url).toBe(DEFAULT_SUI_GRPC_URLS.mainnet);
    });

    it("should return correct gRPC URL for devnet", () => {
      const url = getSuiGrpcUrl("devnet");
      expect(url).toBe(DEFAULT_SUI_GRPC_URLS.devnet);
    });

    it("should return correct gRPC URL for localnet", () => {
      const url = getSuiGrpcUrl("localnet");
      expect(url).toBe(DEFAULT_SUI_GRPC_URLS.localnet);
    });
  });
});
