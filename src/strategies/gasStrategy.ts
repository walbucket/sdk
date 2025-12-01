import type { Signer } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { GasStrategy } from "../types/config.js";
import { ConfigurationError } from "../types/errors.js";

/**
 * Gas Strategy
 * Handles transaction signing based on gas strategy
 */
export class GasStrategyService {
  /**
   * Get signer based on gas strategy
   * For user-pays, returns null as signing is handled by dapp's wallet
   */
  static getSigner(
    strategy: GasStrategy,
    sponsorPrivateKey?: string
  ): Signer | null {
    if (strategy === "developer-sponsored") {
      if (!sponsorPrivateKey) {
        throw new ConfigurationError(
          "sponsorPrivateKey is required for developer-sponsored gas strategy"
        );
      }

      // Create keypair from private key
      const keypair = Ed25519Keypair.fromSecretKey(
        Buffer.from(sponsorPrivateKey.replace("0x", ""), "hex")
      );

      return keypair;
    } else if (strategy === "user-pays") {
      // For user-pays, wallet signing is handled by signAndExecuteTransaction function
      return null;
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
        Buffer.from(privateKey.replace("0x", ""), "hex")
      );
    } catch (error) {
      throw new ConfigurationError(
        `Invalid private key: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error : undefined
      );
    }
  }
}
