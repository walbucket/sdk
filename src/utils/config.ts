import type { WalbucketConfig, SuiNetwork } from "../types/config.js";
import {
  DEFAULT_PACKAGE_IDS,
  DEFAULT_WALRUS_URLS,
  DEFAULT_SUI_GRPC_URLS,
} from "../types/config.js";
import { ConfigurationError } from "../types/errors.js";

/**
 * Validate and normalize configuration
 */
export function validateConfig(config: WalbucketConfig): WalbucketConfig {
  if (!config.apiKey || typeof config.apiKey !== "string") {
    throw new ConfigurationError("API key is required");
  }

  const network = config.network || "testnet";
  const gasStrategy = config.gasStrategy || "developer-sponsored";

  // Validate gas strategy requirements
  if (gasStrategy === "developer-sponsored" && !config.sponsorPrivateKey) {
    throw new ConfigurationError(
      'sponsorPrivateKey is required when gasStrategy is "developer-sponsored"'
    );
  }

  if (gasStrategy === "user-pays" && !config.signAndExecuteTransaction) {
    throw new ConfigurationError(
      'signAndExecuteTransaction function is required when gasStrategy is "user-pays"'
    );
  }

  // Auto-detect package ID from network if not provided
  const packageId = config.packageId || DEFAULT_PACKAGE_IDS[network];

  // Validate that package ID is available for the selected network
  if (!packageId || packageId.trim() === "") {
    throw new ConfigurationError(
      `Package ID not available for network "${network}". ` +
        `Please provide a packageId in the configuration, or use a network with a deployed contract (currently: testnet).`
    );
  }

  return {
    ...config,
    network,
    gasStrategy,
    encryption: config.encryption ?? true,
    packageId,
    walrusPublisherUrl:
      config.walrusPublisherUrl || DEFAULT_WALRUS_URLS[network].publisher,
    walrusAggregatorUrl:
      config.walrusAggregatorUrl || DEFAULT_WALRUS_URLS[network].aggregator,
    cacheTTL: config.cacheTTL || 3600,
    useGrpc: config.useGrpc ?? true,
  };
}

/**
 * Get Sui gRPC URL for network
 */
export function getSuiGrpcUrl(network: SuiNetwork): string {
  return DEFAULT_SUI_GRPC_URLS[network];
}
