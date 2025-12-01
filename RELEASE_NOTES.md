# Release Notes

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
const assets = await walbucket.list('0x...');
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
