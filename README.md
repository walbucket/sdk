# Walbucket SDK

[![npm version](https://img.shields.io/npm/v/@walbucket/sdk.svg)](https://www.npmjs.com/package/@walbucket/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@walbucket/sdk.svg)](https://www.npmjs.com/package/@walbucket/sdk)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

Cloudinary-like API for decentralized media storage on Sui blockchain.

📦 **NPM Package**: [@walbucket/sdk](https://www.npmjs.com/package/@walbucket/sdk)

## About

Walbucket SDK provides a simple, developer-friendly interface for storing and managing media files on the Sui blockchain using Walrus decentralized storage. With built-in encryption support via Seal, automatic URL generation, and flexible gas payment strategies, it's designed to make decentralized storage as easy as using traditional cloud storage services.

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

// Initialize SDK
const walbucket = new Walbucket({
  apiKey: 'your-api-key',
  network: 'testnet',
  sponsorPrivateKey: 'your-private-key',
});

// Upload a file
const result = await walbucket.upload(file, {
  name: 'my-image.jpg',
  folder: 'products',
});

console.log(result.assetId); // Sui object ID
console.log(result.url); // Automatically generated file URL

// Retrieve a file
const retrieveResult = await walbucket.retrieve(result.assetId);
console.log('File data:', retrieveResult.data);
console.log('File URL:', retrieveResult.url);
console.log('Metadata:', retrieveResult.metadata);

// Delete a file
await walbucket.delete(result.assetId);
```

## Configuration

### Required Fields

- `apiKey`: Your API key for authentication
- `sponsorPrivateKey`: Required if using `gasStrategy: 'developer-sponsored'` (default)
- `userSigner`: Required if using `gasStrategy: 'user-pays'`

### Optional Fields

- `network`: Sui network - `'testnet'` (default), `'mainnet'`, `'devnet'`, or `'localnet'`
  - Package ID is automatically selected based on network
- `encryption`: Enable encryption - `true` (default) or `false`
- `gasStrategy`: Choose who pays gas fees:
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

## Gas Strategies

Walbucket supports two gas payment strategies, giving you flexibility in how transactions are paid for:

### Developer-Sponsored (Default)

The developer pays for all gas fees. This provides the best user experience as users don't need to approve gas payments.

**Benefits:**
- ✅ Better user experience (no wallet popups for gas)
- ✅ Users don't need SUI tokens
- ✅ Simplified onboarding

**Requirements:**
- `sponsorPrivateKey`: Your private key for sponsoring transactions

**Example:**
```typescript
const walbucket = new Walbucket({
  apiKey: 'your-api-key',
  network: 'testnet',
  gasStrategy: 'developer-sponsored', // Default - can omit
  sponsorPrivateKey: 'your-private-key', // Required
});
```

### User-Pays

Users pay their own gas fees. This is more decentralized and puts users in control.

**Benefits:**
- ✅ More decentralized
- ✅ Users control their own transactions
- ✅ No developer gas costs

**Requirements:**
- `userSigner`: Signer from the user's connected wallet extension
- Users need SUI tokens for gas
- Users must connect their wallet (Sui Wallet, Ethos, etc.)

**Getting the User Signer:**

Users connect their wallets through wallet extensions, and you get the signer from the connected wallet. Here are examples for different integration methods:

**Using @mysten/dapp-kit (React Apps):**

```typescript
import { useCurrentWallet } from '@mysten/dapp-kit';
import { Walbucket } from '@walbucket/sdk';
import { useEffect, useState } from 'react';

function MyComponent() {
  const { currentWallet, isConnected } = useCurrentWallet();
  const [walbucket, setWalbucket] = useState<Walbucket | null>(null);

  useEffect(() => {
    if (isConnected && currentWallet?.account) {
      // Get signer from connected wallet
      const walbucket = new Walbucket({
        apiKey: 'your-api-key',
        network: 'testnet',
        gasStrategy: 'user-pays',
        userSigner: currentWallet.account, // Signer from wallet extension
      });
      setWalbucket(walbucket);
    }
  }, [isConnected, currentWallet]);

  // When upload is called, wallet popup appears for user to sign
  const handleUpload = async (file: File) => {
    if (!walbucket) return;
    const result = await walbucket.upload(file);
    console.log('Uploaded!', result.url);
  };
}
```

**Using @mysten/wallet-standard:**

```typescript
import { getWallets } from '@mysten/wallet-standard';
import { Walbucket } from '@walbucket/sdk';

// Get available wallets
const wallets = getWallets();
const wallet = wallets[0]; // User's wallet

// Connect wallet (shows popup to user)
await wallet.features['standard:connect'].connect();

// Get signer from wallet
const accounts = await wallet.features['standard:connect'].getAccounts();
const signer = accounts[0]; // User's account signer

// Create SDK instance
const walbucket = new Walbucket({
  apiKey: 'your-api-key',
  network: 'testnet',
  gasStrategy: 'user-pays',
  userSigner: signer, // Signer from wallet extension
});

// When SDK methods are called, wallet popups appear automatically
const result = await walbucket.upload(file);
```

**Important Notes:**
- ✅ The `userSigner` comes from a connected wallet extension (Sui Wallet, Ethos, etc.)
- ✅ Wallet popups appear automatically when SDK methods are called
- ✅ Never ask users for their private keys - always use wallet extensions
- ✅ The signer is provided by the wallet after the user connects

**Note:** The `gasStrategy` field is optional and defaults to `'developer-sponsored'`. You can omit it if using the default strategy.

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
- ✅ **Network Auto-Detection** - Package IDs automatically selected based on network

## API Reference

### Upload

Upload a file to Walbucket storage.

```typescript
const result = await walbucket.upload(file, options);
```

**Parameters:**
- `file`: File input (File, Blob, Buffer, Uint8Array, or file path string)
- `options`: Upload options (optional)

**Options:**
- `name?: string` - Asset name
- `folder?: string` - Folder/collection ID
- `encryption?: boolean` - Enable encryption (default: true)
- `policy?: EncryptionPolicy` - Encryption policy (see Encryption Policies below)
- `tags?: string[]` - Tags for categorization
- `description?: string` - Asset description
- `category?: string` - Asset category
- `width?: number` - Image/video width in pixels
- `height?: number` - Image/video height in pixels

**Returns:**
- `UploadResult` object with:
  - `assetId: string` - Sui object ID
  - `blobId: string` - Walrus blob ID
  - `url: string` - Automatically generated file URL
  - `encrypted: boolean` - Whether encrypted
  - `policyId?: string` - Policy ID if encrypted
  - `size: number` - File size in bytes
  - `contentType: string` - MIME type
  - `createdAt: number` - Timestamp

**Example:**
```typescript
const result = await walbucket.upload(file, {
  name: 'photo.jpg',
  folder: 'gallery',
  encryption: true,
  policy: {
    type: 'wallet-gated',
    addresses: ['0x...']
  }
});

console.log('Uploaded!', result.url);
```

### Retrieve

Retrieve a file from Walbucket storage.

```typescript
const result = await walbucket.retrieve(assetId, options);
```

**Parameters:**
- `assetId`: Asset ID to retrieve
- `options`: Retrieve options (optional)

**Options:**
- `decrypt?: boolean` - Decrypt the file (default: true if encrypted)
- `password?: string` - Password for password-protected assets
- `sessionKey?: SessionKey` - SessionKey from @mysten/seal (required for decryption)

**Returns:**
- `RetrieveResult` object with:
  - `data: Buffer` - File data
  - `url: string` - Automatically generated file URL
  - `metadata: AssetMetadata` - Complete asset metadata

**Example:**
```typescript
// Basic retrieve
const result = await walbucket.retrieve(assetId);
console.log('File URL:', result.url);
console.log('File size:', result.metadata.size);

// Retrieve with decryption
import { SealClient } from '@mysten/seal';
const sealClient = new SealClient({ suiClient });
const sessionKey = await sealClient.getSessionKey(policyId);

const result = await walbucket.retrieve(assetId, {
  sessionKey,
});
```

### Delete

Delete an asset from Walbucket storage.

```typescript
await walbucket.delete(assetId);
```

**Parameters:**
- `assetId`: Asset ID to delete

**Example:**
```typescript
await walbucket.delete(assetId);
```

### Get Asset

Get asset metadata without retrieving the file.

```typescript
const asset = await walbucket.getAsset(assetId);
```

**Parameters:**
- `assetId`: Asset ID to query

**Returns:**
- `AssetMetadata | null` - Asset metadata including:
  - `url: string` - Automatically generated file URL
  - `assetId: string` - Asset ID
  - `blobId: string` - Blob ID from Walrus
  - `name: string` - Asset name
  - `size: number` - File size in bytes
  - `contentType: string` - MIME type
  - `createdAt: number` - Creation timestamp
  - `updatedAt: number` - Last update timestamp
  - `tags: string[]` - Tags
  - `description: string` - Description
  - `category: string` - Category
  - And more...

**Example:**
```typescript
const asset = await walbucket.getAsset(assetId);
if (asset) {
  console.log('Asset URL:', asset.url);
  console.log('Name:', asset.name);
  console.log('Size:', asset.size);
}
```

## Encryption Policies

Walbucket supports multiple encryption policy types:

### Wallet-Gated

Only specific wallet addresses can access the file:

```typescript
policy: {
  type: 'wallet-gated',
  addresses: ['0x...', '0x...']
}
```

### Time-Limited

File access expires at a specific timestamp:

```typescript
policy: {
  type: 'time-limited',
  expiration: Date.now() + 86400000 // 24 hours from now
}
```

### Password-Protected

File requires a password for access:

```typescript
policy: {
  type: 'password-protected',
  password: 'my-secret-password'
}
```

### Public

No access restrictions:

```typescript
policy: {
  type: 'public'
}
```

## Error Handling

The SDK provides typed error classes for better error handling:

```typescript
import { 
  WalbucketError, 
  ValidationError, 
  NetworkError,
  EncryptionError,
  BlockchainError,
  ConfigurationError
} from '@walbucket/sdk';

try {
  await walbucket.upload(file);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  } else if (error instanceof EncryptionError) {
    console.error('Encryption error:', error.message);
  } else if (error instanceof BlockchainError) {
    console.error('Blockchain error:', error.message);
  } else if (error instanceof ConfigurationError) {
    console.error('Configuration error:', error.message);
  } else if (error instanceof WalbucketError) {
    console.error('Error code:', error.code);
  }
}
```

## Examples

### Wallet Integration (User-Pays Gas Strategy)

**React App with @mysten/dapp-kit:**

```typescript
import { useCurrentWallet, ConnectButton } from '@mysten/dapp-kit';
import { Walbucket } from '@walbucket/sdk';
import { useState, useEffect } from 'react';

function UploadComponent() {
  const { currentWallet, isConnected } = useCurrentWallet();
  const [walbucket, setWalbucket] = useState<Walbucket | null>(null);

  useEffect(() => {
    if (isConnected && currentWallet?.account) {
      // Create SDK instance when wallet is connected
      const sdk = new Walbucket({
        apiKey: 'your-api-key',
        network: 'testnet',
        gasStrategy: 'user-pays',
        userSigner: currentWallet.account, // Signer from connected wallet
      });
      setWalbucket(sdk);
    }
  }, [isConnected, currentWallet]);

  const handleUpload = async (file: File) => {
    if (!walbucket) {
      alert('Please connect your wallet first');
      return;
    }

    // Wallet popup will appear for user to sign transaction
    try {
      const result = await walbucket.upload(file, {
        name: file.name,
      });
      console.log('Uploaded!', result.url);
    } catch (error) {
      if (error.message.includes('User rejected') || error.message.includes('rejected')) {
        console.log('User cancelled transaction');
      }
    }
  };

  return (
    <div>
      <ConnectButton />
      {!isConnected && <p>Connect your wallet to upload files</p>}
      {walbucket && (
        <input 
          type="file" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }} 
        />
      )}
    </div>
  );
}
```

**Vanilla JavaScript/TypeScript:**

```typescript
import { getWallets } from '@mysten/wallet-standard';
import { Walbucket } from '@walbucket/sdk';

async function setupWallet() {
  // Get available wallets
  const wallets = getWallets();
  const wallet = wallets.find(w => w.name === 'Sui Wallet');
  
  if (!wallet) {
    throw new Error('Sui Wallet not found. Please install Sui Wallet extension.');
  }

  // Connect wallet (shows popup to user)
  await wallet.features['standard:connect'].connect();
  
  // Get user's account/signer from wallet
  const accounts = await wallet.features['standard:connect'].getAccounts();
  const signer = accounts[0];

  // Create SDK with user signer
  const walbucket = new Walbucket({
    apiKey: 'your-api-key',
    network: 'testnet',
    gasStrategy: 'user-pays',
    userSigner: signer, // User will sign transactions via wallet popup
  });

  return walbucket;
}

// Usage
const walbucket = await setupWallet();
// When uploading, wallet popup appears automatically for user to sign
const result = await walbucket.upload(file);
console.log('Uploaded!', result.url);
```

**How It Works:**
1. User connects wallet → Wallet extension provides a `Signer` interface
2. Developer passes signer to SDK → SDK stores it for transaction signing
3. SDK calls transaction methods → Wallet popup appears automatically
4. User approves in wallet → Transaction is signed and executed

### Upload with Encryption

```typescript
const result = await walbucket.upload(file, {
  name: 'secret-document.pdf',
  encryption: true,
  policy: {
    type: 'wallet-gated',
    addresses: ['0x123...', '0x456...']
  }
});

console.log('Encrypted asset:', result.assetId);
console.log('Policy ID:', result.policyId);
```

### Retrieve and Decrypt

```typescript
import { SealClient } from '@mysten/seal';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const suiClient = new SuiClient({
  url: getFullnodeUrl('testnet'),
});

const sealClient = new SealClient({ suiClient });
const sessionKey = await sealClient.getSessionKey(policyId);

const result = await walbucket.retrieve(assetId, {
  sessionKey,
});

// Use the file data
const fileContent = result.data.toString('utf8');
```

### Working with URLs

```typescript
// Upload returns URL automatically
const uploadResult = await walbucket.upload(file);
console.log('File URL:', uploadResult.url);

// Retrieve also returns URL
const retrieveResult = await walbucket.retrieve(assetId);
console.log('File URL:', retrieveResult.url);

// Get asset metadata includes URL
const asset = await walbucket.getAsset(assetId);
if (asset) {
  console.log('Asset URL:', asset.url);
  // Use URL directly in your app
  // <img src={asset.url} />
}
```

## Wallet Integration Guide

### How User-Pays Gas Strategy Works

When using `gasStrategy: 'user-pays'`, users sign transactions through their wallet extensions. Here's the complete flow:

1. **User Connects Wallet**: User connects their Sui wallet (Sui Wallet, Ethos, etc.) to your app
2. **Get Signer from Wallet**: The wallet provides a `Signer` interface after connection
3. **Pass Signer to SDK**: Provide the signer to the SDK configuration
4. **Transactions Trigger Wallet Popups**: When SDK methods are called, wallet popups appear for user approval

### Complete Setup Example

**Step 1: Install Wallet Dependencies**

```bash
pnpm add @mysten/dapp-kit @mysten/sui @tanstack/react-query
```

**Step 2: Setup Wallet Provider (React)**

```typescript
import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider>
          <YourApp />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
```

**Step 3: Use SDK with Wallet Signer**

```typescript
import { useCurrentWallet, ConnectButton } from '@mysten/dapp-kit';
import { Walbucket } from '@walbucket/sdk';
import { useEffect, useState } from 'react';

function YourApp() {
  const { currentWallet, isConnected } = useCurrentWallet();
  const [walbucket, setWalbucket] = useState<Walbucket | null>(null);

  useEffect(() => {
    if (isConnected && currentWallet?.account) {
      // Create SDK instance with user's wallet signer
      const sdk = new Walbucket({
        apiKey: 'your-api-key',
        network: 'testnet',
        gasStrategy: 'user-pays',
        userSigner: currentWallet.account, // Signer from connected wallet
      });
      setWalbucket(sdk);
    }
  }, [isConnected, currentWallet]);

  const handleUpload = async (file: File) => {
    if (!walbucket) {
      alert('Please connect your wallet');
      return;
    }

    // Wallet popup will appear for user to approve transaction
    try {
      const result = await walbucket.upload(file, {
        name: file.name,
      });
      console.log('Uploaded!', result.url);
    } catch (error) {
      if (error.message.includes('User rejected')) {
        console.log('User cancelled transaction');
      }
    }
  };

  return (
    <div>
      <ConnectButton />
      {!isConnected && <p>Connect your wallet to continue</p>}
      {walbucket && (
        <input 
          type="file" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }} 
        />
      )}
    </div>
  );
}
```

### Important Notes

- **Never ask for private keys**: Always use wallet extensions to get signers
- **Wallet popups are automatic**: When SDK methods are called, the wallet extension will show popups for user approval
- **User must have SUI tokens**: For `user-pays` strategy, users need SUI tokens in their wallet for gas
- **Signer comes from wallet**: The `userSigner` is provided by the wallet after connection, not from private keys
- **Multiple transactions**: Each SDK method call (upload, delete, etc.) will trigger a wallet popup for user approval

## TypeScript Support

The SDK is fully typed with TypeScript:

```typescript
import type { 
  WalbucketConfig,
  UploadResult,
  RetrieveResult,
  AssetMetadata,
  EncryptionPolicy
} from '@walbucket/sdk';

const config: WalbucketConfig = {
  apiKey: 'your-api-key',
  network: 'testnet',
  sponsorPrivateKey: 'your-private-key',
};

const walbucket = new Walbucket(config);
```

## License

ISC
