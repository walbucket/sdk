# Release Notes

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
