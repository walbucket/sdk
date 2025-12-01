# Release Notes

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
