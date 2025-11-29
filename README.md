# Walbucket SDK

Cloudinary-like API for decentralized media storage on Sui blockchain.

## Installation

```bash
pnpm add @walbucket/sdk
# or
npm install @walbucket/sdk
# or
yarn add @walbucket/sdk
```

## Quick Start

```typescript
import { Walbucket } from '@walbucket/sdk';

// Initialize SDK - packageId is automatically selected based on network
// Developer-sponsored gas (default) - you pay for all transactions
const walbucket = new Walbucket({
  apiKey: 'your-api-key',
  network: 'testnet', // Package ID auto-detected for testnet
  gasStrategy: 'developer-sponsored', // Default - you can omit this
  sponsorPrivateKey: 'your-private-key', // Required for developer-sponsored
});

// Upload a file (encryption enabled by default)
const result = await walbucket.upload(file, {
  name: 'my-image.jpg',
  folder: 'products',
  policy: {
    type: 'wallet-gated',
    addresses: ['0x...']
  }
});

console.log(result.assetId); // Sui object ID
console.log(result.url); // Asset URL

// Retrieve and decrypt a file
const retrieveResult = await walbucket.retrieve(result.assetId, {
  decrypt: true
});
console.log('File data:', retrieveResult.data);
console.log('File URL:', retrieveResult.url); // Automatically generated URL
console.log('Metadata:', retrieveResult.metadata);

// Delete a file
await walbucket.delete(result.assetId);
```

### Network Auto-Detection

The SDK automatically selects the correct contract deployment based on your network:

```typescript
// Testnet - uses latest testnet deployment automatically
const testnet = new Walbucket({
  apiKey: 'your-api-key',
  network: 'testnet', // Package ID: 0x1f520a412cee6d8fb76f66bb749e1e14b2476375bc7c892d103c82f6cedf0d85
  sponsorPrivateKey: 'your-private-key',
});

// Mainnet - will use mainnet deployment when available
// Currently throws error as mainnet is not deployed yet
const mainnet = new Walbucket({
  apiKey: 'your-api-key',
  network: 'mainnet', // Will throw error until deployed
  sponsorPrivateKey: 'your-private-key',
});
```

## Configuration

**Required Fields:**
- `apiKey`: Your API key for authentication
- `sponsorPrivateKey`: Required if using `gasStrategy: 'developer-sponsored'` (default)
- `userSigner`: Required if using `gasStrategy: 'user-pays'`

**Optional Fields (with smart defaults):**
- `network`: Sui network - `'testnet'` (default), `'mainnet'`, `'devnet'`, or `'localnet'`
  - Package ID is **automatically selected** based on network
  - Currently only `testnet` has a deployed contract
- `encryption`: Enable encryption - `true` (default) or `false`
- `gasStrategy`: Choose who pays for gas fees:
  - `'developer-sponsored'` (default) - Developer pays gas fees
  - `'user-pays'` - Users pay their own gas fees
- `packageId`: Override auto-detected package ID (usually not needed)
- `walrusPublisherUrl`: Override auto-detected Walrus publisher URL
- `walrusAggregatorUrl`: Override auto-detected Walrus aggregator URL
- `cacheTTL`: Cache TTL in seconds (default: 3600)

```typescript
interface WalbucketConfig {
  // Required
  apiKey: string;
  
  // Required based on gasStrategy choice
  sponsorPrivateKey?: string; // Required if gasStrategy is 'developer-sponsored'
  userSigner?: Signer; // Required if gasStrategy is 'user-pays'
  
  // Optional with smart defaults
  network?: 'testnet' | 'mainnet' | 'devnet' | 'localnet'; // Default: 'testnet'
  encryption?: boolean; // Default: true
  gasStrategy?: 'developer-sponsored' | 'user-pays'; // Default: 'developer-sponsored'
  
  // Auto-detected (usually don't need to set)
  packageId?: string; // Auto-detected from network
  walrusPublisherUrl?: string; // Auto-detected from network
  walrusAggregatorUrl?: string; // Auto-detected from network
  sealServerIds?: string[]; // Auto-detected from network
  cacheTTL?: number; // Default: 3600 seconds
}
```

### Gas Strategy Options

Choose the gas payment strategy that fits your use case:

**Developer-Sponsored (Default):**
- Developer pays all gas fees
- Better user experience (no wallet popups for gas)
- Requires `sponsorPrivateKey`

```typescript
const walbucket = new Walbucket({
  apiKey: 'your-api-key',
  network: 'testnet',
  gasStrategy: 'developer-sponsored', // Default
  sponsorPrivateKey: 'your-private-key', // Required
});
```

**User-Pays:**
- Users pay their own gas fees
- More decentralized
- Requires `userSigner` (from user's wallet)

```typescript
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const userKeypair = Ed25519Keypair.fromSecretKey(/* user's key */);

const walbucket = new Walbucket({
  apiKey: 'your-api-key',
  network: 'testnet',
  gasStrategy: 'user-pays',
  userSigner: userKeypair, // Required
});
```

## Features

- ✅ **Standalone SDK** - No backend dependency
- ✅ **Direct Sui Integration** - Uses Sui gRPC and JSON-RPC clients
- ✅ **Walrus Storage** - Direct blob storage integration
- ✅ **Seal Encryption** - Optional client-side encryption
- ✅ **API Key Authentication** - On-chain API key validation
- ✅ **Gas Strategies** - Developer-sponsored or user-pays
- ✅ **Type-Safe** - Full TypeScript support
- ✅ **Cloudinary-like API** - Familiar developer experience
- ✅ **Automatic URL Generation** - File URLs automatically generated and returned

## API Reference

### Upload

```typescript
const result = await walbucket.upload(file, options);
```

**Options:**
- `name?: string` - Asset name
- `folder?: string` - Folder/collection ID
- `encryption?: boolean` - Enable encryption (default: true)
- `policy?: EncryptionPolicy` - Encryption policy
- `tags?: string[]` - Tags for categorization
- `description?: string` - Asset description
- `category?: string` - Asset category
- `width?: number` - Image/video width
- `height?: number` - Image/video height

**Returns:**
- `UploadResult` object with:
  - `assetId: string` - Sui object ID
  - `blobId: string` - Walrus blob ID
  - `url: string` - **Automatically generated file URL** (e.g., `https://aggregator.testnet.walrus.space/v1/blobs/{blobId}`)
  - `encrypted: boolean` - Whether encrypted
  - `policyId?: string` - Policy ID if encrypted
  - `size: number` - File size in bytes
  - `contentType: string` - MIME type
  - `createdAt: number` - Timestamp

**Note:** The `url` field is automatically generated from the blob ID and Walrus aggregator URL. You don't need to construct it manually!

### Retrieve

```typescript
const result = await walbucket.retrieve(assetId, options);
// result.data - File data as Buffer
// result.url - Automatically generated file URL
// result.metadata - Complete asset metadata
```

**Options:**
- `decrypt?: boolean` - Decrypt the file (default: true if encrypted)
- `password?: string` - Password for password-protected assets
- `sessionKey?: SessionKey` - SessionKey from @mysten/seal (required for decryption)

**Returns:**
- `RetrieveResult` object with:
  - `data: Buffer` - File data
  - `url: string` - **Automatically generated file URL** (e.g., `https://aggregator.testnet.walrus.space/v1/blobs/{blobId}`)
  - `metadata: AssetMetadata` - Complete asset metadata including name, size, contentType, etc.

**Note:** The `url` field is automatically generated from the blob ID and Walrus aggregator URL. You can use it directly to access the file!

### Delete

```typescript
await walbucket.delete(assetId);
```

### Get Asset

```typescript
const asset = await walbucket.getAsset(assetId);
if (asset) {
  console.log('Asset URL:', asset.url); // Automatically generated URL
  console.log('Name:', asset.name);
  console.log('Size:', asset.size);
}
```

**Returns:**
- `AssetMetadata | null` - Asset metadata including:
  - `url: string` - Automatically generated file URL
  - `assetId: string` - Asset ID
  - `blobId: string` - Blob ID from Walrus
  - `name: string` - Asset name
  - `size: number` - File size in bytes
  - `contentType: string` - MIME type
  - And more...

### Transform Asset

```typescript
// Note: Transform requires image processing library (e.g., Sharp)
// For now, use backend API for transformations
// This method is a placeholder for future implementation
try {
  const result = await walbucket.transform(assetId, {
    width: 800,
    height: 600,
    format: 'webp',
    quality: 80
  });
} catch (error) {
  // Transform requires external image processing
  // Use backend API or implement client-side processing
}
```

## Encryption Policies

```typescript
// Wallet-gated (specific addresses only)
policy: {
  type: 'wallet-gated',
  addresses: ['0x...', '0x...']
}

// Time-limited (expires at timestamp)
policy: {
  type: 'time-limited',
  expiration: Date.now() + 86400000 // 24 hours
}

// Password-protected
policy: {
  type: 'password-protected',
  password: 'my-secret-password'
}

// Public (no restrictions)
policy: {
  type: 'public'
}
```

## Gas Strategies

### Developer-Sponsored (Default)

Developer pays for all gas fees:

```typescript
const walbucket = new Walbucket({
  apiKey: 'your-api-key',
  sponsorPrivateKey: 'your-private-key',
  gasStrategy: 'developer-sponsored'
});
```

### User-Pays

User pays their own gas fees:

```typescript
const walbucket = new Walbucket({
  apiKey: 'your-api-key',
  gasStrategy: 'user-pays',
  userSigner: userWalletSigner
});
```

## Error Handling

```typescript
import { WalbucketError, ValidationError, NetworkError } from '@walbucket/sdk';

try {
  await walbucket.upload(file);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  } else if (error instanceof WalbucketError) {
    console.error('Error code:', error.code);
  }
}
```

## Contract Integration

The SDK integrates with the Walbucket smart contracts deployed on Sui:

- **Package ID**: `0x882f1d0b25b5b58fc948ca7f633a42cacc88a9e96245ed5a3867f2c23fe1e6e1` (testnet)
- **Network**: Sui Testnet
- **Modules**: `asset`, `apikey`, `bucket`, `policy`, `transform`, `folder`, `share`

All operations match the contract function signatures exactly.

## License

ISC
