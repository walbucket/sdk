import { SealClient } from '@mysten/seal';
import { Transaction } from '@mysten/sui/transactions';
import type { SuiGrpcClient } from '@mysten/sui/grpc';
import type { EncryptionPolicy } from '../types/requests.js';
import { EncryptionError } from '../types/errors.js';
import type { SuiService } from './suiService.js';
import type { Signer } from '@mysten/sui/cryptography';
import crypto from 'crypto';

/**
 * Seal Service
 * 
 * Handles encryption and decryption using the Seal SDK (@mysten/seal).
 * Seal provides client-side encryption with on-chain policy management.
 * 
 * This service integrates with:
 * - Seal SDK for encryption/decryption operations
 * - SuiService for creating encryption policies on-chain
 * - SuiGrpcClient (confirmed compatible with Seal SDK)
 * 
 * @example
 * ```typescript
 * const sealService = new SealService(grpcClient, packageId, serverIds);
 * sealService.setSuiService(suiService);
 * 
 * // Create policy on-chain
 * const policyId = await sealService.createPolicyOnChain({
 *   type: 'wallet-gated',
 *   allowedAddresses: ['0x123...'],
 * });
 * 
 * // Encrypt data
 * const encrypted = await sealService.encrypt(data, policyId);
 * 
 * // Decrypt data (requires SessionKey from Seal SDK)
 * const decrypted = await sealService.decrypt(encrypted, policyId, sessionKey);
 * ```
 */
export class SealService {
  private sealClient: SealClient | null = null;
  private grpcClient: SuiGrpcClient;
  private packageId: string;
  private serverConfigs: Array<{ objectId: string; weight: number }>;
  private suiService: SuiService | null = null;

  constructor(
    grpcClient: SuiGrpcClient,
    packageId: string,
    serverObjectIds: string[] = []
  ) {
    this.grpcClient = grpcClient;
    this.packageId = packageId;
    this.serverConfigs = serverObjectIds.map((id) => ({
      objectId: id,
      weight: 1,
    }));
  }

  /**
   * Set SuiService for on-chain policy creation
   * 
   * This method injects the SuiService into SealService, allowing it to
   * create encryption policies on the Sui blockchain.
   * 
   * @param suiService - SuiService instance for blockchain operations
   * 
   * @example
   * ```typescript
   * const sealService = new SealService(grpcClient, packageId);
   * sealService.setSuiService(suiService);
   * ```
   */
  setSuiService(suiService: SuiService): void {
    this.suiService = suiService;
  }

  /**
   * Initialize Seal client (lazy initialization)
   */
  private getClient(): SealClient {
    if (!this.sealClient) {
      // SealClient works with SuiGrpcClient (confirmed compatible)
      this.sealClient = new SealClient({
        suiClient: this.grpcClient as any, // Type assertion - confirmed compatible
        serverConfigs: this.serverConfigs,
        verifyKeyServers: false, // Set to true in production for additional security
      });
    }
    return this.sealClient;
  }

  /**
   * Encrypt data with policy
   * Note: Policy must be created on-chain first using createPolicyOnChain
   * This method only handles the encryption part
   */
  async encrypt(
    data: Buffer | Uint8Array,
    policyId: string, // Policy ID from on-chain creation
    threshold: number = 2
  ): Promise<Buffer> {
    try {
      const client = this.getClient();

      // Convert package ID to bytes
      const packageIdBytes = this.hexToBytes(this.packageId);
      
      // Convert policy ID to bytes
      const policyIdBytes = this.hexToBytes(policyId);

      // Encrypt data using Seal SDK
      // Note: Seal encrypt expects Uint8Array for packageId and id
      const { encryptedObject } = await client.encrypt({
        threshold,
        packageId: packageIdBytes as any, // Type assertion for Seal SDK compatibility
        id: policyIdBytes as any, // Type assertion for Seal SDK compatibility
        data: data instanceof Buffer ? new Uint8Array(data) : data,
      });

      return Buffer.from(encryptedObject);
    } catch (error) {
      throw new EncryptionError(
        `Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create policy on-chain and return policy ID
   * This should be called before encryption
   */
  async createPolicyOnChain(params: {
    assetId: string;
    policy: EncryptionPolicy;
    apiKeyId: string;
    apiKeyHash: string;
    developerAccountId: string;
    signer: Signer;
  }): Promise<string> {
    if (!this.suiService) {
      throw new EncryptionError('SuiService not set. Call setSuiService() first.');
    }

    // Convert policy type to contract format
    // Contract: 0=public, 1=wallet-gated, 2=time-limited, 3=password-protected
    const policyTypeMap: Record<string, number> = {
      'public': 0,
      'wallet-gated': 1,
      'time-limited': 2,
      'password-protected': 3,
    };
    const policyType = policyTypeMap[params.policy.type] ?? 0;

    // Convert addresses
    const allowedAddresses = params.policy.addresses || [];

    // Convert expiration (from milliseconds to seconds for contract)
    const expiration = params.policy.expiration || 0;

    // Hash password if provided
    const passwordHash = params.policy.password
      ? crypto.createHash('sha256').update(params.policy.password).digest('hex')
      : '';

    // Create policy on-chain
    const policyId = await this.suiService.createPolicy({
      assetId: params.assetId,
      policyType,
      allowedAddresses,
      expiration,
      passwordHash,
      apiKeyId: params.apiKeyId,
      apiKeyHash: params.apiKeyHash,
      developerAccountId: params.developerAccountId,
      signer: params.signer,
    });

    return policyId;
  }

  /**
   * Decrypt data with policy
   * Requires session key for decryption
   */
  async decrypt(
    data: Buffer | Uint8Array,
    policyId: string,
    sessionKey: any // SessionKey from Seal SDK
  ): Promise<Buffer> {
    try {
      const client = this.getClient();

      // Build transaction for seal_approve
      // seal_approve function is deployed in contract (Package ID: 0x1f520a412cee6d8fb76f66bb749e1e14b2476375bc7c892d103c82f6cedf0d85)
      // Function signature: entry fun seal_approve(policy_id: vector<u8>, policy: &EncryptionPolicy, clock: &Clock, ctx: &mut TxContext)
      // We need to pass the policy object, policy_id as bytes, and Clock object
      const tx = new Transaction();
      
      // Convert policy ID to bytes (remove 0x prefix if present)
      const policyIdBytes = Array.from(this.hexToBytes(policyId));
      
      tx.moveCall({
        target: `${this.packageId}::policy::seal_approve`,
        arguments: [
          tx.pure.vector('u8', policyIdBytes),
          tx.object(policyId), // Policy object reference
          tx.object('0x6'), // Clock object (standard Sui Clock ID)
        ],
      });

      // Build transaction bytes for Seal SDK
      const txBytes = await tx.build({ 
        client: this.grpcClient as any,
        onlyTransactionKind: true 
      });

      // Decrypt using Seal SDK
      const decrypted = await client.decrypt({
        data: data instanceof Buffer ? new Uint8Array(data) : data,
        sessionKey,
        txBytes,
      });

      return Buffer.from(decrypted);
    } catch (error) {
      throw new EncryptionError(
        `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }


  /**
   * Convert hex string to Uint8Array
   */
  private hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.replace('0x', '');
    return new Uint8Array(
      cleanHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
  }
}
