# Walbucket SDK

[![npm version](https://img.shields.io/npm/v/@walbucket/sdk.svg)](https://www.npmjs.com/package/@walbucket/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@walbucket/sdk.svg)](https://www.npmjs.com/package/@walbucket/sdk)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

Cloudinary-like API for decentralized media storage on Sui blockchain with advanced sharing and permission management.

📦 **NPM Package**: [@walbucket/sdk](https://www.npmjs.com/package/@walbucket/sdk)

## About

Walbucket SDK provides a simple, developer-friendly interface for storing and managing media files on the Sui blockchain using Walrus decentralized storage. With built-in encryption support via Seal, automatic URL generation, flexible gas payment strategies, and granular access control, it's designed to make decentralized storage as easy as using traditional cloud storage services.

## Features

- ✅ **Standalone SDK** - No backend dependency
- ✅ **Direct Sui Integration** - Uses Sui gRPC and JSON-RPC clients
- ✅ **Walrus Storage** - Direct blob storage integration
- ✅ **Seal Encryption** - Optional client-side encryption
- ✅ **API Key Authentication** - On-chain API key validation
- ✅ **Gas Strategies** - Developer-sponsored or user-pays
- ✅ **Granular Permissions** - Read, write, and admin access control
- ✅ **Access Grants** - Share with specific wallet addresses
- ✅ **Shareable Links** - Create public links with optional expiration
- ✅ **Password Protection** - Secure shares with passwords
- ✅ **Time-Based Expiration** - Auto-expiring access
- ✅ **Folder Organization** - Organize assets in folders
- ✅ **Type-Safe** - Full TypeScript support
- ✅ **Cloudinary-like API** - Familiar developer experience
- ✅ **Automatic URL Generation** - File URLs automatically generated and returned
- ✅ **Network Auto-Detection** - Package IDs automatically selected based on network

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

// Share with specific user
await walbucket.shareAsset(result.assetId, recipientAddress, {
  canRead: true,
  expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
});

// Create public shareable link
const shareToken = crypto.randomUUID();
await walbucket.createShareableLink(result.assetId, {
  shareToken,
  canRead: true,
  expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
});

// Retrieve a file
const retrieveResult = await walbucket.retrieve(result.assetId);
console.log('File data:', retrieveResult.data);
console.log('File URL:', retrieveResult.url);
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

## API Reference

### Core Operations

#### Upload

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
- `policy?: EncryptionPolicy` - Encryption policy
- `tags?: string[]` - Tags for categorization
- `description?: string` - Asset description
- `category?: string` - Asset category
- `width?: number` - Image/video width in pixels
- `height?: number` - Image/video height in pixels

**Returns:** `UploadResult` with `assetId`, `url`, `blobId`, `size`, etc.

#### Retrieve

Retrieve a file from storage.

```typescript
const result = await walbucket.retrieve(assetId, options);
```

**Returns:** `RetrieveResult` with `data`, `url`, and `metadata`

#### Delete

Delete an asset.

```typescript
await walbucket.delete(assetId);
```

#### Get Asset

Get asset metadata without retrieving the file.

```typescript
const asset = await walbucket.getAsset(assetId);
```

#### List Assets

List all assets for an address.

```typescript
const assets = await walbucket.list(ownerAddress?);
```

### File Operations

#### Rename

```typescript
await walbucket.rename(assetId, newName);
```

#### Copy

```typescript
await walbucket.copy(assetId, newName);
```

### Folder Management

#### Create Folder

```typescript
const folderId = await walbucket.createFolder(name, parentFolderId?);
```

#### Delete Folder

```typescript
await walbucket.deleteFolder(folderId);
```

#### Move to Folder

```typescript
await walbucket.moveToFolder(assetId, folderId?);
```

#### List Folders

```typescript
const folders = await walbucket.listFolders(ownerAddress?);
```

### Sharing & Permissions

#### Access Grants (Private Sharing)

**Share Asset** - Grant access to specific wallet address

```typescript
await walbucket.shareAsset(assetId, recipientAddress, {
  canRead?: boolean;      // Default: true
  canWrite?: boolean;     // Default: false
  canAdmin?: boolean;     // Default: false
  expiresAt?: number;     // Expiration timestamp in ms
  passwordHash?: string;  // Password hash for protection
});
```

**Permission Levels:**
- `canRead: true` - View and download
- `canWrite: true` - Modify asset
- `canAdmin: true` - Full control including re-sharing

**Example:**

```typescript
// Read-only access for 7 days
await walbucket.shareAsset(assetId, '0x123...', {
  canRead: true,
  expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
});

// Editor access (read + write)
await walbucket.shareAsset(assetId, '0x456...', {
  canRead: true,
  canWrite: true
});

// Admin access (full control)
await walbucket.shareAsset(assetId, '0x789...', {
  canRead: true,
  canWrite: true,
  canAdmin: true
});
```

**Revoke Share** - Revoke access grant

```typescript
await walbucket.revokeShare(grantId);
```

**List Access Grants** - View all grants

```typescript
const grants = await walbucket.listAccessGrants(ownerAddress?);
```

**Get Access Grant** - Get grant details

```typescript
const grant = await walbucket.getAccessGrant(grantId);
```

#### Shareable Links (Public Sharing)

**Create Shareable Link** - Create public share link

```typescript
const shareToken = crypto.randomUUID();
await walbucket.createShareableLink(assetId, {
  shareToken: string;     // Required: unique token for URL
  canRead?: boolean;      // Default: true
  canWrite?: boolean;     // Default: false
  canAdmin?: boolean;     // Default: false
  expiresAt?: number;     // Expiration timestamp in ms
  passwordHash?: string;  // Password hash for protection
});

// Share the URL
const shareUrl = `https://yourapp.com/share/${shareToken}`;
```

**Example:**

```typescript
// Create link that expires in 24 hours
const token = crypto.randomUUID();
await walbucket.createShareableLink(assetId, {
  shareToken: token,
  canRead: true,
  expiresAt: Date.now() + (24 * 60 * 60 * 1000)
});

// Password-protected link
import { createHash } from 'crypto';
const passwordHash = createHash('sha256').update('secret123').digest('hex');

await walbucket.createShareableLink(assetId, {
  shareToken: crypto.randomUUID(),
  canRead: true,
  passwordHash
});
```

**Deactivate Shareable Link** - Disable a link

```typescript
await walbucket.deactivateShareableLink(linkId);
```

**Track Link Access** - Monitor usage (user-pays only)

```typescript
await walbucket.trackLinkAccess(linkId);
```

**List Shareable Links** - View all links

```typescript
const links = await walbucket.listShareableLinks(ownerAddress?);
```

**Get Shareable Link** - Get link details with stats

```typescript
const link = await walbucket.getShareableLink(linkId);
console.log(`Accessed ${link.accessCount} times`);
```

## Sharing Workflows

### Private Sharing (Access Grants)

Use when sharing with specific wallet addresses:

```typescript
// 1. Upload file
const { assetId } = await walbucket.upload(file);

// 2. Share with team member (read + write)
await walbucket.shareAsset(assetId, teamMemberAddress, {
  canRead: true,
  canWrite: true,
  expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
});

// 3. Monitor all grants
const grants = await walbucket.listAccessGrants();
console.log(`Shared with ${grants.length} users`);

// 4. Revoke access when needed
await walbucket.revokeShare(grantId);
```

### Public Sharing (Shareable Links)

Use for creating public share links:

```typescript
// 1. Upload file
const { assetId } = await walbucket.upload(file);

// 2. Create shareable link
const token = crypto.randomUUID();
await walbucket.createShareableLink(assetId, {
  shareToken: token,
  canRead: true,
  expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
});

// 3. Share the URL
const shareUrl = `https://yourapp.com/share/${token}`;
console.log('Share this link:', shareUrl);

// 4. Track access (in user-pays mode)
// When someone accesses the link:
await walbucket.trackLinkAccess(linkId);

// 5. Monitor usage
const links = await walbucket.listShareableLinks();
links.forEach(link => {
  console.log(`${link.shareToken}: ${link.accessCount} accesses`);
});

// 6. Deactivate when no longer needed
await walbucket.deactivateShareableLink(linkId);
```

## Gas Strategies

### Developer-Sponsored (Default)

Developer pays for all gas fees - best user experience.

```typescript
const walbucket = new Walbucket({
  apiKey: 'your-api-key',
  network: 'testnet',
  gasStrategy: 'developer-sponsored', // Default
  sponsorPrivateKey: 'your-private-key', // Required
});
```

**Benefits:**
- ✅ Better UX (no wallet popups for gas)
- ✅ Users don't need SUI tokens
- ✅ Simplified onboarding

### User-Pays

Users pay their own gas fees - more decentralized.

```typescript
import { useCurrentWallet } from '@mysten/dapp-kit';

const { currentWallet } = useCurrentWallet();

const walbucket = new Walbucket({
  apiKey: 'your-api-key',
  network: 'testnet',
  gasStrategy: 'user-pays',
  userSigner: currentWallet.account, // From connected wallet
});
```

**Benefits:**
- ✅ More decentralized
- ✅ Users control transactions
- ✅ No developer gas costs

## Examples

### Complete Upload & Share Flow

```typescript
import { Walbucket } from '@walbucket/sdk';

const walbucket = new Walbucket({
  apiKey: 'your-api-key',
  network: 'testnet',
  sponsorPrivateKey: 'your-private-key',
});

// 1. Upload file
const { assetId, url } = await walbucket.upload(file, {
  name: 'team-report.pdf',
  folder: 'documents',
  category: 'reports'
});

console.log('Uploaded:', url);

// 2. Share with team (private)
await walbucket.shareAsset(assetId, teamLeadAddress, {
  canRead: true,
  canWrite: true,
  canAdmin: true
});

await walbucket.shareAsset(assetId, teamMemberAddress, {
  canRead: true,
  canWrite: false
});

// 3. Create public link for clients
const token = crypto.randomUUID();
await walbucket.createShareableLink(assetId, {
  shareToken: token,
  canRead: true,
  expiresAt: Date.now() + (14 * 24 * 60 * 60 * 1000) // 14 days
});

const shareUrl = `https://yourapp.com/share/${token}`;
console.log('Client link:', shareUrl);

// 4. Monitor access
const grants = await walbucket.listAccessGrants();
const links = await walbucket.listShareableLinks();

console.log(`Shared with ${grants.length} users`);
console.log(`${links.length} public links created`);
```

### Wallet Integration (User-Pays)

```typescript
import { useCurrentWallet } from '@mysten/dapp-kit';
import { Walbucket } from '@walbucket/sdk';
import { useState, useEffect } from 'react';

function UploadComponent() {
  const { currentWallet, isConnected } = useCurrentWallet();
  const [walbucket, setWalbucket] = useState<Walbucket | null>(null);

  useEffect(() => {
    if (isConnected && currentWallet?.account) {
      const sdk = new Walbucket({
        apiKey: 'your-api-key',
        network: 'testnet',
        gasStrategy: 'user-pays',
        userSigner: currentWallet.account,
      });
      setWalbucket(sdk);
    }
  }, [isConnected, currentWallet]);

  const handleUpload = async (file: File) => {
    if (!walbucket) {
      alert('Please connect your wallet first');
      return;
    }

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

### Access Management Dashboard

```typescript
// View all sharing activity
async function showAccessDashboard() {
  const grants = await walbucket.listAccessGrants();
  const links = await walbucket.listShareableLinks();
  
  // Group grants by asset
  const grantsByAsset = grants.reduce((acc, grant) => {
    if (!acc[grant.assetId]) acc[grant.assetId] = [];
    acc[grant.assetId].push(grant);
    return acc;
  }, {});
  
  // Show stats
  console.log('=== Access Dashboard ===');
  console.log(`Total grants: ${grants.length}`);
  console.log(`Total links: ${links.length}`);
  console.log(`Active links: ${links.filter(l => l.isActive).length}`);
  
  // Show link stats
  const totalAccesses = links.reduce((sum, l) => sum + l.accessCount, 0);
  console.log(`Total link accesses: ${totalAccesses}`);
  
  // Show most accessed links
  const topLinks = links
    .sort((a, b) => b.accessCount - a.accessCount)
    .slice(0, 5);
    
  console.log('\nTop 5 Links:');
  topLinks.forEach((link, i) => {
    console.log(`${i + 1}. ${link.shareToken}: ${link.accessCount} accesses`);
  });
}
```

### Folder Organization

```typescript
// Create folder structure
const projectFolderId = await walbucket.createFolder('Project Alpha');
const docsFolderId = await walbucket.createFolder('Documents', projectFolderId);
const imagesFolderId = await walbucket.createFolder('Images', projectFolderId);

// Upload to folders
const doc = await walbucket.upload(docFile, {
  name: 'requirements.pdf',
  folder: docsFolderId
});

const image = await walbucket.upload(imageFile, {
  name: 'mockup.png',
  folder: imagesFolderId
});

// Move files between folders
await walbucket.moveToFolder(doc.assetId, imagesFolderId);

// List folders
const folders = await walbucket.listFolders();
console.log(`${folders.length} folders created`);
```

## Error Handling

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
  }
}
```

## TypeScript Support

The SDK is fully typed:

```typescript
import type { 
  WalbucketConfig,
  UploadResult,
  RetrieveResult,
  AssetMetadata,
  EncryptionPolicy,
  AccessGrant,
  ShareableLink
} from '@walbucket/sdk';
```

## Documentation

Full documentation available at [docs.walbucket.com](https://docs.walbucket.com)

## License

ISC
