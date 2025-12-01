# v0.3.4 - Asset Ownership Fix

## 🐛 Critical Fix: Asset Ownership Bug

This release fixes a critical bug where assets uploaded via API keys were owned by the developer instead of the end user, causing users to see empty file lists.

### ✅ What's Fixed

- **Asset Ownership**: Assets created with `upload_asset_with_api_key` are now correctly transferred to `tx_context::sender` (the actual uploader) instead of `dev_address`
- **Empty File List**: Users can now see their uploaded files when calling SDK list methods
- **Event Emission**: Asset upload events now emit the correct sender address
- **Contract Package ID**: Updated to `0x481a774f5cf0a3437a6f9623604874681943950bb82c146051afdec74f0c9b26`

### 🔧 Technical Details

**Contract Changes:**

- File: `contract/sources/asset.move` (line 415)
- Before: `transfer::transfer(asset, dev_address);` ❌
- After: `transfer::transfer(asset, sender);` ✅
- Also updated event emission to use correct sender

**Deployment:**

- Network: Sui Testnet
- Package ID: `0x481a774f5cf0a3437a6f9623604874681943950bb82c146051afdec74f0c9b26`
- Upgrade Cap: `0x17814c7ff4f202c43b5aaa0694c60f1a61a79f8b611127af95e0e8db4e37d229`
- Transaction: `E8ZDhUz23Vs65xiTBTtbr1C2osbLo6paumbmnNezSJeg`
- Gas Used: ~324.7M MIST

### ⚠️ Breaking Changes

- Assets uploaded with SDK v0.3.0-v0.3.3 remain owned by the developer
- Users may need to re-upload their files for them to be visible in the new version
- No automatic migration is provided (assets are still on-chain, just owned by developer)

### 📦 Installation

```bash
npm install @walbucket/sdk@0.3.4
# or
pnpm add @walbucket/sdk@0.3.4
# or
yarn add @walbucket/sdk@0.3.4
```

### 🔍 Testing the Fix

**Before (v0.3.3):**

```typescript
const files = await walbucket.list();
// Returns: { data: [] } ❌ Empty!
```

**After (v0.3.4):**

```typescript
const files = await walbucket.list();
// Returns: { data: [...uploaded files] } ✅ Correct!
```

### 📚 Documentation

- [Deployment Details](https://github.com/walbucket/sdk/blob/main/DEPLOYMENT_IDS.md)
- [Full Fix Documentation](https://github.com/walbucket/sdk/blob/main/ASSET_OWNERSHIP_FIX.md)

### 🎯 Impact

This fix ensures that the B2C platform flow works correctly, with end users properly owning the assets they upload through API keys. The SDK queries will now return the expected data instead of empty arrays.

**Full Changelog**: https://github.com/walbucket/sdk/compare/v0.3.3...v0.3.4
