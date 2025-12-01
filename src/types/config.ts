import type { Signer } from "@mysten/sui/cryptography";
import type { SuiClient } from "@mysten/sui/client";
import type { Transaction } from "@mysten/sui/transactions";

/**
 * Sui network identifier
 */
export type SuiNetwork = "testnet" | "mainnet" | "devnet" | "localnet";

/**
 * Function type for signing and executing transactions (user-pays mode)
 */
export type SignAndExecuteTransaction = (input: {
  transaction: Transaction;
  options?: {
    showEffects?: boolean;
    showObjectChanges?: boolean;
    showEvents?: boolean;
  };
}) => Promise<any>;

/**
 * Gas fee strategy
 */
export type GasStrategy = "developer-sponsored" | "user-pays";

/**
 * Main SDK configuration
 */
export interface WalbucketConfig {
  /** API key for authentication */
  apiKey: string;

  /** Sui network (default: 'testnet') */
  network?: SuiNetwork;

  /** Enable encryption by default (default: true) */
  encryption?: boolean;

  /** Gas fee strategy (default: 'developer-sponsored') */
  gasStrategy?: GasStrategy;

  /** Private key for developer-sponsored gas (required if gasStrategy is 'developer-sponsored') */
  sponsorPrivateKey?: string;

  /**
   * Function to sign and execute transactions (required if gasStrategy is 'user-pays')
   * This function will be called with a Transaction object and should return the execution result
   * Use @mysten/dapp-kit's useSignAndExecuteTransaction hook in your dapp
   *
   * @example
   * ```typescript
   * import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
   *
   * const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
   *
   * const walbucket = new Walbucket({
   *   gasStrategy: 'user-pays',
   *   signAndExecuteTransaction: signAndExecuteTransaction,
   *   // ...
   * });
   * ```
   */
  signAndExecuteTransaction?: SignAndExecuteTransaction;

  /**
   * User's wallet address (required if gasStrategy is 'user-pays')
   * This is the address that will pay for gas and sign transactions
   * Use @mysten/dapp-kit's useCurrentAccount hook to get this
   */
  userAddress?: string;

  /**
   * Package ID (auto-detected from network if not provided)
   * Developers don't need to provide this - it's automatically selected based on network
   */
  packageId?: string;

  /** Walrus publisher URL (auto-detected from network) */
  walrusPublisherUrl?: string;

  /** Walrus aggregator URL (auto-detected from network) */
  walrusAggregatorUrl?: string;

  /** Seal server object IDs (auto-detected from network) */
  sealServerIds?: string[];

  /** Cache TTL in seconds (default: 3600) */
  cacheTTL?: number;

  /** Use gRPC (default: true) */
  useGrpc?: boolean;
}

/**
 * Default package IDs by network
 * Automatically selected based on network configuration
 * Latest testnet deployment (2024-12-15): 0x481a774f5cf0a3437a6f9623604874681943950bb82c146051afdec74f0c9b26
 * CRITICAL FIX: Assets uploaded via API key now owned by end user (tx_context::sender) instead of developer
 */
export const DEFAULT_PACKAGE_IDS: Record<SuiNetwork, string> = {
  testnet: "0x481a774f5cf0a3437a6f9623604874681943950bb82c146051afdec74f0c9b26",
  mainnet: "", // To be deployed - will throw error if used
  devnet: "", // To be deployed - will throw error if used
  localnet: "", // To be deployed - will throw error if used
};

/**
 * Default Walrus URLs by network
 */
export const DEFAULT_WALRUS_URLS: Record<
  SuiNetwork,
  { publisher: string; aggregator: string }
> = {
  testnet: {
    publisher: "https://publisher.walrus-01.tududes.com",
    aggregator: "https://aggregator.walrus-testnet.walrus.space",
  },
  mainnet: {
    publisher: "https://publisher.mainnet.walrus.space",
    aggregator: "https://aggregator.mainnet.walrus.space",
  },
  devnet: {
    publisher: "https://publisher.walrus-01.tududes.com",
    aggregator: "https://aggregator.walrus-testnet.walrus.space",
  },
  localnet: {
    publisher: "http://localhost:8080",
    aggregator: "http://localhost:8081",
  },
};

/**
 * Default Sui gRPC URLs by network
 */
export const DEFAULT_SUI_GRPC_URLS: Record<SuiNetwork, string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
  localnet: "http://127.0.0.1:9000",
};
