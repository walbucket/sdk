import { describe, it, expect, vi } from 'vitest';
import { GasStrategyService } from '../../strategies/gasStrategy.js';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { ConfigurationError } from '../../types/errors.js';

describe('GasStrategyService', () => {
  describe('getSigner', () => {
    it('should create signer for developer-sponsored strategy', () => {
      const keypair = Ed25519Keypair.generate();
      const bech32SecretKey = keypair.getSecretKey();
      // Decode Bech32 to get raw private key bytes
      const { secretKey } = decodeSuiPrivateKey(bech32SecretKey);
      const privateKeyHex = Buffer.from(secretKey).toString('hex');
      
      const signer = GasStrategyService.getSigner(
        'developer-sponsored',
        `0x${privateKeyHex}`,
        undefined
      );
      
      expect(signer).toBeDefined();
      expect(signer.getPublicKey()).toBeDefined();
    });

    it('should throw error if private key missing for developer-sponsored', () => {
      expect(() => {
        GasStrategyService.getSigner('developer-sponsored', undefined, undefined);
      }).toThrow(ConfigurationError);
    });

    it('should return user signer for user-pays strategy', () => {
      const mockSigner = {
        getPublicKey: vi.fn(),
        signPersonalMessage: vi.fn(),
        signTransactionBlock: vi.fn(),
      } as any;

      const signer = GasStrategyService.getSigner(
        'user-pays',
        undefined,
        mockSigner
      );

      expect(signer).toBe(mockSigner);
    });

    it('should throw error if user signer missing for user-pays', () => {
      expect(() => {
        GasStrategyService.getSigner('user-pays', undefined, undefined);
      }).toThrow(ConfigurationError);
    });

    it('should throw error for unknown strategy', () => {
      expect(() => {
        GasStrategyService.getSigner('unknown' as any, undefined, undefined);
      }).toThrow(ConfigurationError);
    });
  });

  describe('createKeypairFromPrivateKey', () => {
    it('should create keypair from valid private key', () => {
      const keypair = Ed25519Keypair.generate();
      const bech32SecretKey = keypair.getSecretKey();
      // Decode Bech32 to get raw private key bytes
      const { secretKey } = decodeSuiPrivateKey(bech32SecretKey);
      const privateKeyHex = Buffer.from(secretKey).toString('hex');
      
      const result = GasStrategyService.createKeypairFromPrivateKey(`0x${privateKeyHex}`);
      expect(result).toBeDefined();
      expect(result.getPublicKey()).toBeDefined();
    });

    it('should handle private key without 0x prefix', () => {
      const keypair = Ed25519Keypair.generate();
      const bech32SecretKey = keypair.getSecretKey();
      // Decode Bech32 to get raw private key bytes
      const { secretKey } = decodeSuiPrivateKey(bech32SecretKey);
      const privateKeyHex = Buffer.from(secretKey).toString('hex');
      
      const result = GasStrategyService.createKeypairFromPrivateKey(privateKeyHex);
      expect(result).toBeDefined();
    });

    it('should throw error for invalid private key', () => {
      expect(() => {
        GasStrategyService.createKeypairFromPrivateKey('invalid');
      }).toThrow(ConfigurationError);
    });
  });
});
