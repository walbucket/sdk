import type { Signer } from '@mysten/sui/cryptography';
import type { SuiClient } from '@mysten/sui/client';

/**
 * Sui network identifier
 */
export type SuiNetwork = 'testnet' | 'mainnet' | 'devnet' | 'localnet';

/**
 * Gas fee strategy
 */
export type GasStrategy = 'developer-sponsored' | 'user-pays';

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
  
  /** User signer for user-pays gas (required if gasStrategy is 'user-pays') */
  userSigner?: Signer;
  
  /** 
   * Optional SuiClient instance for wallet transaction signing
   * Only used when gasStrategy is 'user-pays'
   * If provided, will be used for wallet signAndExecuteTransaction calls
   * Useful for browser wallets that need the dapp's SuiClient context
   */
  suiClient?: SuiClient;
  
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
 * Latest testnet deployment (2024-11-29): 0x1f520a412cee6d8fb76f66bb749e1e14b2476375bc7c892d103c82f6cedf0d85
 * Includes seal_approve function for full encryption/decryption support
 */
export const DEFAULT_PACKAGE_IDS: Record<SuiNetwork, string> = {
  testnet: '0x1f520a412cee6d8fb76f66bb749e1e14b2476375bc7c892d103c82f6cedf0d85',
  mainnet: '', // To be deployed - will throw error if used
  devnet: '', // To be deployed - will throw error if used
  localnet: '', // To be deployed - will throw error if used
};

/**
 * Default Walrus URLs by network
 */
export const DEFAULT_WALRUS_URLS: Record<SuiNetwork, { publisher: string; aggregator: string }> = {
  testnet: {
    publisher: 'https://publisher.walrus-01.tududes.com',
    aggregator: 'https://aggregator.walrus-testnet.walrus.space',
  },
  mainnet: {
    publisher: 'https://publisher.mainnet.walrus.space',
    aggregator: 'https://aggregator.mainnet.walrus.space',
  },
  devnet: {
    publisher: 'https://publisher.walrus-01.tududes.com',
    aggregator: 'https://aggregator.walrus-testnet.walrus.space',
  },
  localnet: {
    publisher: 'http://localhost:8080',
    aggregator: 'http://localhost:8081',
  },
};

/**
 * Default Sui gRPC URLs by network
 */
export const DEFAULT_SUI_GRPC_URLS: Record<SuiNetwork, string> = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
  localnet: 'http://127.0.0.1:9000',
};
