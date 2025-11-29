import type { Signer } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { GasStrategy } from '../types/config.js';
import { ConfigurationError } from '../types/errors.js';

/**
 * Gas Strategy
 * Handles transaction signing based on gas strategy
 */
export class GasStrategyService {
  /**
   * Get signer based on gas strategy
   */
  static getSigner(
    strategy: GasStrategy,
    sponsorPrivateKey?: string,
    userSigner?: Signer
  ): Signer {
    if (strategy === 'developer-sponsored') {
      if (!sponsorPrivateKey) {
        throw new ConfigurationError(
          'sponsorPrivateKey is required for developer-sponsored gas strategy'
        );
      }
      
      // Create keypair from private key
      const keypair = Ed25519Keypair.fromSecretKey(
        Buffer.from(sponsorPrivateKey.replace('0x', ''), 'hex')
      );
      
      return keypair;
    } else if (strategy === 'user-pays') {
      if (!userSigner) {
        throw new ConfigurationError(
          'userSigner is required for user-pays gas strategy'
        );
      }
      
      return userSigner;
    } else {
      throw new ConfigurationError(`Unknown gas strategy: ${strategy}`);
    }
  }

  /**
   * Create keypair from private key
   */
  static createKeypairFromPrivateKey(privateKey: string): Ed25519Keypair {
    try {
      return Ed25519Keypair.fromSecretKey(
        Buffer.from(privateKey.replace('0x', ''), 'hex')
      );
    } catch (error) {
      throw new ConfigurationError(
        `Invalid private key: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }
}
