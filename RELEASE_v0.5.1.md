# Release Notes - v0.5.1

**Release Date:** January 2025

## 🐛 Bug Fixes

### Fixed Move File to Folder Transaction Error

**Critical Bug**: The `moveToFolder()` function was failing with a transaction error due to incorrect type casting for the `folderId` parameter.

#### Issue
- Error: `MoveAbort(...move_asset_to_folder..., 0)` - `E_NOT_OWNER`
- The SDK was using `tx.pure.option("address", folderId)` but the Move contract expects `Option<ID>`, not `Option<address>`
- This caused transaction construction to fail during dry-run validation

#### Fix
- Changed folder ID type from `"address"` to `"id"` in both `moveAssetToFolder()` (user-pays) and `moveAssetToFolderWithApiKey()` (developer-sponsored) functions
- Fixed in: `src/services/suiService.ts` (lines 925 and 1164)

#### Impact
- Users can now successfully move files to folders
- Both user-pays and API key-based move operations now work correctly
- No breaking changes - existing code continues to work

## 📦 Installation

```bash
npm install @walbucket/sdk@0.5.1
# or
pnpm add @walbucket/sdk@0.5.1
# or
yarn add @walbucket/sdk@0.5.1
```

## 🔄 Migration

No breaking changes. Simply update to the latest version:

```bash
pnpm update @walbucket/sdk
```

## 📝 Full Changelog

- Fixed `moveToFolder()` transaction error by correcting folder ID type from "address" to "id"
- Enhanced error messages for ownership-related errors

---

**Previous Version:** [v0.5.0](../package.json)
