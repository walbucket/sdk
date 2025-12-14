# Release Notes

## v0.5.1 - Move File Bug Fix (2025-01-XX)

### 🐛 Bug Fixes

- **Fixed Move File to Folder Transaction Error**: Corrected folder ID type from `"address"` to `"id"` in `moveAssetToFolder()` functions
  - Resolved `MoveAbort` error (E_NOT_OWNER) when moving files to folders
  - Fixed in both user-pays and API key-based move operations
  - See [RELEASE_v0.5.1.md](./RELEASE_v0.5.1.md) for details

### 📝 Migration

No breaking changes - automatic upgrade:

```bash
pnpm add @walbucket/sdk@0.5.1
```

---

## v0.4.2 - Large File Upload Fixes (2025-12-01)

### 🐛 Bug Fixes

- **Fixed 413 Request Entity Too Large errors**: Switched from third-party `tududes.com` publisher to official Walrus testnet publisher
  - Third-party publishers were rejecting files as small as 1.46MB
  - Official publisher supports up to 13.3 GiB
  - Updated default endpoints for testnet and devnet networks

### ✨ Enhancements

- **Dynamic Timeout Calculation**: Upload timeout now scales with file size (30s - 15min)
- **Upload Progress Tracking**: Added optional `onProgress` callback to monitor upload progress
- **Better Error Messages**: Enhanced error messages for 413 errors with specific guidance
- **File Size Validation**: Pre-upload validation with clear error messages
- **Increased Limits**: Max single blob size increased from 10MB to 100MB

### 🔧 Technical Changes

- Added `maxBodyLength: Infinity` and `maxContentLength: Infinity` to axios clients
- Implemented `calculateTimeout()` method for dynamic timeouts
- Implemented `validateFileSize()` method for pre-upload validation
- Enhanced upload logging for debugging

### 📝 Migration

No breaking changes - automatic upgrade:

```bash
pnpm add @walbucket/sdk@0.4.2
```

---

## v0.4.1 - Bug Fixes (2025-12-01)

### 🐛 Bug Fixes

- **Type Exports**: Fixed TypeScript type definitions for new file operation methods
  - Ensured all new methods are properly exported and typed
  - Fixed compatibility with dapp TypeScript compilation

### 📝 Migration

No breaking changes - automatic upgrade:

```bash
pnpm add @walbucket/sdk@latest
```

---

## v0.4.0 - Dual Gas Strategy Support for File Operations (2025-12-01)

### 🎉 Major Update - New Features

**NEW**: All file operation methods now support both user-pays and developer-sponsored gas strategies automatically.

### ✨ New Features

- **File Operations - User-Pays Support**: Added user-pays versions for all file management operations

  - `rename()` - Rename assets with user or developer gas
  - `copy()` - Copy assets with user or developer gas
  - `createFolder()` - Create folders with user or developer gas
  - `deleteFolder()` - Delete folders with user or developer gas
  - `moveToFolder()` - Move assets to folders with user or developer gas
  - SDK automatically chooses the correct implementation based on `gasStrategy` configuration

- **Smart Contract Integration**: Added API-key sponsored versions in SuiService
  - `renameAssetWithApiKey()` - Developer-sponsored rename
  - `copyAssetWithApiKey()` - Developer-sponsored copy
  - `createFolderWithApiKey()` - Developer-sponsored folder creation
  - `deleteFolderWithApiKey()` - Developer-sponsored folder deletion
  - `moveAssetToFolderWithApiKey()` - Developer-sponsored move to folder

### 🔄 Breaking Changes

**None** - This is a feature addition that maintains backward compatibility. Existing code continues to work without changes.

### 🔧 Technical Changes

- Updated Walbucket class methods to check `gasStrategy` and call appropriate SuiService method
- User-pays methods call contract functions ending with asset/folder function names
- Developer-sponsored methods call contract functions ending with `_with_api_key`
- All methods maintain the same public API regardless of gas strategy

### 📝 Usage Examples

**User-Pays (End User Signs & Pays):**

```typescript
const walbucket = new Walbucket({
  gasStrategy: "user-pays",
  signAndExecuteTransaction: signAndExecuteTransaction,
  network: "testnet",
});

// User signs and pays gas for these operations
await walbucket.rename(assetId, "new-name.jpg");
await walbucket.copy(assetId, "copy-of-file.jpg");
await walbucket.createFolder("My Photos", "Personal photos");
await walbucket.moveToFolder(assetId, folderId);
await walbucket.deleteFolder(folderId);
```

**Developer-Sponsored (Developer Pays):**

```typescript
const walbucket = new Walbucket({
  gasStrategy: "developer-sponsored",
  apiKey: "your-api-key-hash",
  network: "testnet",
});

// Developer pays gas for these operations
await walbucket.rename(assetId, "new-name.jpg");
await walbucket.copy(assetId, "copy-of-file.jpg");
await walbucket.createFolder("My Photos", "Personal photos");
await walbucket.moveToFolder(assetId, folderId);
await walbucket.deleteFolder(folderId);
```

### 🎯 What This Enables

1. **Flexible Architecture**: Same code works with both gas strategies
2. **B2C Platforms**: Let users manage their files with user-pays, or provide free tier with developer-pays
3. **Hybrid Models**: Mix strategies - user-pays for file operations, developer-pays for uploads
4. **Simplified Integration**: No need to write separate code for different gas strategies

### 📝 Migration

No breaking changes - automatic upgrade:

```bash
pnpm add @walbucket/sdk@latest
```

All existing code continues to work. New methods automatically adapt to your configured gas strategy.

---

## v0.3.1 - Shared Object API Key Lookup Fix (2025-01-30)

### 🐛 Bug Fixes

- **API Key Service**: Fixed `getDeveloperAccountId()` to work with shared DeveloperAccount objects
  - Changed from `getOwnedObjects()` to event-based lookup using `DeveloperAccountCreated` events
  - Queries events and filters by owner address to find developer accounts
  - Compatible with new shared object architecture (v0.3.0+)

### 🔧 Technical Changes

- Updated `getDeveloperAccountId()` method to query blockchain events instead of owned objects
- Improved documentation to clarify shared object architecture

### 📝 Migration

No breaking changes - automatic upgrade from v0.3.0:

```bash
pnpm add @walbucket/sdk@latest
```

---

## v0.3.0 - Shared Objects for B2C Platform (2025-01-30)

### 🎉 Major Update - Breaking Changes

**BREAKING**: ApiKey and DeveloperAccount are now shared objects instead of owned objects. This enables true B2C functionality where any user can upload files using a developer's API key.

### ✨ New Features

- **Shared Object Architecture**: ApiKey and DeveloperAccount converted to shared objects
  - Any user can reference API keys in transactions (not just the developer)
  - Enables multi-user B2C platforms where end users upload files
  - Developer retains ownership and management control through on-chain validation
  - Solves "Transaction was not signed by the correct sender" error permanently

### 🔄 Breaking Changes

- **New Contract Package ID**: `0x52b1196bdce066f48bdb66d16c516bb618d4daa34f4fdad77caba426d0c03795`
  - Old package: `0x1f520a412cee6d8fb76f66bb749e1e14b2476375bc7c892d103c82f6cedf0d85`
  - Must recreate developer accounts and API keys with new contract
  - Existing API keys from old contract will not work

### 🐛 Bug Fixes

- **Multi-User Support**: Fixed ownership errors preventing end users from uploading
  - Users can now reference developer's API keys without ownership conflicts
  - Transaction sender can be anyone, not just the API key owner
  - Proper B2C functionality where developer provides infrastructure, users pay gas

### 🔧 Technical Changes

- Contract changes: `ApiKey` and `DeveloperAccount` use `transfer::share_object()` instead of `transfer::transfer()`
- Removed `store` ability from both structs (shared objects don't need `store`)
- Updated DEFAULT_PACKAGE_IDS in SDK configuration
- Contract maintains access control through internal validation

### 📝 Migration Guide

**Step 1: Update SDK**

```bash
pnpm add @walbucket/sdk@0.3.0
```

**Step 2: Recreate Developer Account**

The old developer account is an owned object and won't work with the new contract. Create a new one:

```typescript
const walbucket = new Walbucket({ network: "testnet" });
const account = await walbucket.createDeveloperAccount("My Account");
```

**Step 3: Recreate API Keys**

Create new API keys with the new developer account:

```typescript
const apiKey = await walbucket.createApiKey("Production Key", accountId);
```

**Step 4: Update Environment Variables**

Update your `.env` with new IDs from Step 2 and 3.

### 🎯 What This Enables

1. **True B2C Platform**: Developers provide API keys, end users upload files
2. **User-Pays Gas**: End users pay their own gas fees
3. **Scalability**: No ownership bottlenecks for multi-user applications
4. **Developer Control**: Developers still own and manage API keys on-chain

---

## v0.2.3 - Debug Logging and Transaction Wait Fix (2024-12-01)

### 🐛 Bug Fixes

- **Transaction Indexing**: Increased wait time from 1s to 3s for transaction indexing
  - Gives blockchain more time to index transaction results
  - Always queries transaction after wallet execution for complete data
- **Enhanced Debugging**: Added comprehensive console logging for transaction execution
  - Logs transaction digest, response structure, and extraction attempts
  - Helps diagnose asset ID extraction issues
  - Detailed error messages with full response data

### 🔧 Technical Changes

- Improved transaction result handling for wallet-signed transactions
- Added fallback extraction from both `effects.created` and `objectChanges`
- Better error messages with transaction digest included

### 📝 Testing Instructions

After updating to v0.2.3, check your browser console during file upload to see:

- `[SDK] Transaction executed, digest: ...`
- `[SDK] Initial result structure: ...`
- `[SDK] Waiting for transaction to be indexed...`
- `[SDK] Transaction result received: ...`
- `[SDK] Extracted asset ID from ...`

If the error persists, the console logs will show exactly what data is being received, which will help us fix the issue permanently.

```bash
pnpm add @walbucket/sdk@latest
```

---

## v0.2.2 - Transaction Execution Fixes (2024-12-01)

### 🐛 Critical Bug Fixes

- **Ownership Error**: Fixed "Transaction was not signed by the correct sender" error
  - Removed `tx.setSender()` call to allow Sui to infer sender from transaction signature
  - Any user can now upload files using developer's API key (as intended)
  - API key and developer account objects can be referenced by any transaction
- **Asset ID Extraction**: Fixed "Failed to get asset ID from transaction" error
  - Added `options` parameter to `SignAndExecuteTransaction` type for requesting transaction effects
  - SDK now passes `showEffects`, `showObjectChanges`, and `showEvents` options to wallet
  - Added `waitForTransaction` fallback to handle async transaction indexing
  - Supports both `effects.created` and `objectChanges` response formats

### 🔧 Technical Changes

- Updated `SignAndExecuteTransaction` type to accept options parameter
- Removed `userAddress` requirement from SDK configuration (no longer needed)
- Added automatic transaction result waiting and querying
- Improved asset ID extraction with multiple fallback strategies

### 📝 Migration Guide

**No breaking changes** - This is a bug fix release. If you were using v0.2.1, simply update:

```bash
pnpm add @walbucket/sdk@latest
```

**Optional**: You can now remove `userAddress` from your SDK configuration (it's ignored):

```typescript
const walbucket = await createWalbucket({
  apiKey: "your-api-key",
  network: "testnet",
  gasStrategy: "user-pays",
  signAndExecuteTransaction: signAndExecuteTransaction,
  // userAddress: currentAccount.address, ← Can be removed
});
```

### 🎯 What This Fixes

1. **Multi-user support**: Different users can now upload files using the same developer API key
2. **Transaction completion**: Uploads now properly complete and return asset IDs
3. **Wallet compatibility**: Better handling of different wallet response formats

---

## v0.2.1 - Transaction Sender Fix (2024-12-01)

### 🐛 Bug Fixes

- **Transaction Sender**: Fixed "Transaction was not signed by the correct sender" error
  - Added `userAddress` parameter to SDK configuration
  - SDK now calls `tx.setSender(userAddress)` to properly attribute transactions
  - Allows users to pay gas while using developer's API key objects
  - Resolves sender address mismatch when wallet signs transactions

### 🔧 Technical Changes

- Added optional `userAddress?: string` field to `WalbucketConfig`
- Updated `SuiService` constructor to accept `userAddress` parameter
- Modified `createAsset` to set transaction sender before signing
- Added validation: `userAddress` required when `gasStrategy` is `'user-pays'`
- Dapp integration now passes `currentAccount.address` from `useCurrentAccount()` hook

### 📝 Migration Guide

Update your SDK initialization to include the user's address:

```typescript
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";

const currentAccount = useCurrentAccount();
const { mutateAsync: signAndExecuteTransaction } =
  useSignAndExecuteTransaction();

const walbucket = await createWalbucket({
  apiKey: "your-api-key",
  network: "testnet",
  gasStrategy: "user-pays",
  signAndExecuteTransaction: signAndExecuteTransaction,
  userAddress: currentAccount.address, // ✅ Add this
});
```

---

## v0.2.0 - SignAndExecuteTransaction Function API (2024-12-01)

### 🎉 Major Update - Breaking Changes

**BREAKING**: Completely redesigned user-pays wallet integration API for maximum simplicity and compatibility.

### ✨ New Features

- **SignAndExecuteTransaction Function**: SDK now accepts a `signAndExecuteTransaction` function instead of signer objects
  - Pass the function directly from `@mysten/dapp-kit`'s `useSignAndExecuteTransaction` hook
  - SDK handles transaction building, dapp handles wallet signing
  - Clean separation of concerns - SDK doesn't need wallet internals
  - Works with all browser wallets without special handling

### 🔄 Breaking Changes

- **Removed**: `userSigner` parameter (no longer needed)
- **Removed**: `suiClient` parameter (no longer needed)
- **Added**: `signAndExecuteTransaction` function parameter for user-pays mode
- **Updated**: `GasStrategyService.getSigner()` returns `null` for user-pays (signing handled by function)

### 📝 Migration Guide

**Before (v0.1.x):**

```typescript
const walbucket = new Walbucket({
  gasStrategy: "user-pays",
  userSigner: walletAccount,
  suiClient: suiClient,
});
```

**After (v0.2.0):**

```typescript
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";

const { mutateAsync: signAndExecuteTransaction } =
  useSignAndExecuteTransaction();

const walbucket = new Walbucket({
  gasStrategy: "user-pays",
  signAndExecuteTransaction: signAndExecuteTransaction,
});
```

### 🐛 Bug Fixes

- **Wallet Compatibility**: Eliminates all `signer.toSuiAddress is not a function` errors
- **Transaction Signing**: Direct wallet communication ensures proper signing flow
- **Type Safety**: Simplified API reduces type casting and improves DX

### 🔧 Technical Changes

- SDK builds transactions internally, passes to dapp's wallet for signing
- Removed complex signer detection logic
- Simplified transaction execution flow
- Better error messages and debugging

---

## v0.1.5 - External SuiClient Support (2024-12-01)

### ✨ New Features

- **External SuiClient Integration**: SDK now accepts an optional `suiClient` parameter for user-pays transactions
  - Pass your dapp's `SuiClient` instance for proper wallet context
  - Only used when `gasStrategy` is `'user-pays'`
  - Enables correct wallet transaction signing with browser wallets
  - Developer-sponsored transactions continue using internal client

### 🐛 Bug Fixes

- **Wallet Transaction Signing**: Fixed wallet signer detection and transaction routing
  - Properly detects wallet signers with `signAndExecuteTransaction` method
  - Uses external client for wallet transactions when provided
  - Falls back to internal client for keypair signers
  - Resolves persistent `signer.toSuiAddress is not a function` error

### 🔧 Technical Changes

- Added `externalClient` parameter to `SuiService` constructor
- Updated `createAsset` to use external client for wallet signers
- Modified `WalbucketConfig` to include optional `suiClient` parameter
- Enhanced dapp integration to pass `useSuiClient()` hook result

### 📝 Usage Example

```typescript
import { useSuiClient } from "@mysten/dapp-kit";

const suiClient = useSuiClient();
const walbucket = new Walbucket({
  apiKey: "your-api-key",
  network: "testnet",
  gasStrategy: "user-pays",
  userSigner: walletAccount,
  suiClient: suiClient, // Pass dapp's client
});
```

---

## v0.1.4 - Wallet Signer Support (2024-12-01)

### 🐛 Bug Fixes

- **Browser Wallet Support**: Fixed `signer.toSuiAddress is not a function` error when using browser wallets
  - Added detection for wallet signers with `signAndExecuteTransaction` method
  - Properly routes transaction signing to wallet or keypair based on signer type
  - Wallet signers now use their own `signAndExecuteTransaction` method
  - Keypair signers continue using `SuiClient.signAndExecuteTransaction`
  - Resolves upload failures when using Sui Wallet, Suiet, or other browser wallets

### 🔧 Technical Changes

- Updated `SuiService.createAsset` to detect signer type at runtime
- Added client parameter passing for wallet-based transaction execution
- Improved compatibility with `@mysten/dapp-kit` wallet integration

---

## v0.1.3 - Walrus API Fix (2024-12-01)

### 🐛 Bug Fixes

- **Walrus Upload**: Fixed blob ID extraction from Walrus API v1 response
  - Updated response type to match actual Walrus API structure
  - Properly handles `newlyCreated.blobObject.blobId` and `alreadyCertified.blobId` fields
  - Removes `0x` prefix from blob IDs for consistency
  - Removed unsafe `Content-Length` header (axios sets it automatically)
  - Resolves "No blob ID returned from Walrus" error

### 🔧 Technical Changes

- Changed Walrus upload to use `epochs=5` parameter instead of `permanent` flag
- Updated response interface to match Walrus testnet API v1 specification
- Improved error logging for debugging upload issues

---

## v0.1.2 - API Key Validation Fix (2024-12-01)

### 🐛 Bug Fixes

- **API Key Lookup**: Fixed API key validation to properly query blockchain objects by hash
  - Changed event-based lookup to object-based lookup
  - Queries all `ApiKeyCreated` events to get API key IDs
  - Fetches and validates each API key object's hash
  - Ensures only active API keys are returned
  - Resolves "API key not found" error when using SDK with valid API keys

### 🔧 Technical Changes

- Updated `findApiKeyObjectId` method in `ApiKeyService` to use `MoveEventType` query
- Added object fetching and hash comparison for each potential API key
- Improved error handling for deleted or inaccessible API keys

---

## v0.1.1 - Asset Listing Feature (2024-12-01)

### ✨ New Features

- **Asset Listing**: Added `list(owner?: string)` method to query and retrieve all assets owned by a user
  - Queries the Sui blockchain for Asset objects owned by the specified address
  - Defaults to using the signer's address if no owner is provided
  - Returns array of `AssetMetadata` with full file information
  - Results are automatically cached to reduce blockchain queries
  - Supports filtering by folder ID in the dapp hooks layer

### 🔧 Improvements

- **SuiService**: Added `listAssets(owner: string)` method for querying owned objects
- **Type Safety**: Improved address extraction from different signer types (Ed25519Keypair, wallet signers)
- **Caching**: List results are cached with automatic URL generation

### 📝 API Changes

**New Method:**

```typescript
// List assets for the signer
const assets = await walbucket.list();

// List assets for a specific address
const assets = await walbucket.list("0x...");
```

### 🐛 Bug Fixes

None in this release.

---

## v0.1.0 - Initial Release (2024-11-29)

### 🎉 First Public Release

The initial release of Walbucket SDK, providing a Cloudinary-like API for decentralized media storage on the Sui blockchain.

### ✨ Features

- **File Upload**: Upload files to Walrus decentralized storage with automatic on-chain metadata registration
- **File Retrieval**: Retrieve files by asset ID with automatic URL generation
- **Encryption Support**: Built-in Seal encryption for client-side encryption/decryption with on-chain policies
- **Flexible Gas Strategies**:
  - Developer-sponsored gas (default)
  - User-pays gas (decentralized)
- **Network Auto-Detection**: Automatic package ID detection based on network (testnet, mainnet, devnet)
- **Automatic URL Generation**: URLs automatically generated for all uploaded and retrieved assets
- **TypeScript Support**: Full TypeScript definitions included
- **Wallet Integration**: Seamless integration with Sui wallet extensions (@mysten/dapp-kit, @mysten/wallet-standard)

### 📦 Installation

```bash
npm install @walbucket/sdk
# or
pnpm add @walbucket/sdk
# or
yarn add @walbucket/sdk
```

### 🔗 Links

- **NPM Package**: https://www.npmjs.com/package/@walbucket/sdk
- **GitHub Repository**: https://github.com/walbucket/sdk
- **Documentation**: See [README.md](./README.md)

### 📝 Breaking Changes

None - This is the initial release.

### 🐛 Known Issues

None at this time.

### 🙏 Acknowledgments

Built with:

- [Sui Blockchain](https://sui.io/)
- [Walrus](https://walrus.space/) - Decentralized blob storage
- [Seal](https://github.com/MystenLabs/seal) - Client-side encryption
