# SDK v0.5.4 Release Notes

## 🎉 Release Date: 2025-01-14

## 🐛 Critical Bug Fixes

### Fixed Folder ID Handling for Upload Operations

**Issue**: Files uploaded when a folder was open weren't being assigned to that folder, and files moved to folders weren't appearing in the destination.

**Root Cause**: The SDK was using `tx.pure.option("id", folderId)` for `Option<ID>` types, but the Sui TypeScript SDK requires using `"address"` as the type name since `ID` is essentially a wrapper around an address.

**Fix**: 
- Changed folderId handling from `tx.pure.option("id", ...)` to `tx.pure.option("address", ...)` 
- Fixed in:
  - `uploadAssetUserPays()` method (user-pays uploads)
  - `moveAssetToFolder()` method (user-pays moves)
  - `createAsset()` method (developer-sponsored uploads)

**Impact**: 
- ✅ Files uploaded when a folder is open now correctly get assigned to that folder
- ✅ Files moved to folders now correctly appear in the destination folder
- ✅ Files can be moved between folders and from folders to root correctly

### Fixed Asset Ownership for User-Pays Uploads

**Issue**: Assets uploaded in user-pays mode were owned by the developer's API key address instead of the user's wallet address.

**Root Cause**: The SDK always used `upload_asset_with_api_key` which required API key objects owned by the developer, causing ownership issues.

**Fix**:
- Added new `uploadAssetUserPays()` method that uses the `upload_asset` contract function
- No API key objects required in the transaction for user-pays mode
- Assets are created directly owned by `tx_context::sender(ctx)` (the user's wallet)

**Impact**:
- ✅ Assets uploaded in user-pays mode are now correctly owned by the user's wallet address
- ✅ Users can properly manage their own files (move, rename, delete)
- ✅ No more "E_NOT_OWNER" errors for files users upload themselves

## ✨ Enhancements

### Improved Transaction Retry Logic

**Issue**: Users had to approve transactions multiple times when transactions failed.

**Fix**:
- Updated global mutation retry logic to never retry on:
  - User rejections ("rejected", "cancelled", "User rejected")
  - Blockchain errors ("MoveAbort", "E_", transaction failures)
  - Validation/permission errors
- Only retries network errors (connection issues, timeouts) once
- All wallet transaction hooks now have `retry: false`

**Impact**:
- ✅ Users see only one wallet approval dialog per transaction attempt
- ✅ No more confusing repeated approvals when transactions fail
- ✅ Better UX - users can retry manually if needed

### Better Ownership Verification

**Enhancement**: Enhanced error messages and pre-transaction ownership checks.

**Changes**:
- Move dialog now checks ownership before attempting move
- Shows clear error messages with both file owner and user wallet addresses
- Prevents transactions from being attempted when ownership doesn't match

**Impact**:
- ✅ Clear feedback when files can't be moved due to ownership
- ✅ Better debugging information
- ✅ Prevents wasted transaction attempts

## 🔧 Technical Changes

### SDK Changes

1. **New Method**: `uploadAssetUserPays()` in `SuiService`
   - Calls `upload_asset` contract function (not `upload_asset_with_api_key`)
   - Doesn't require API key or developer account objects
   - Ensures assets are owned by the user's wallet

2. **Updated Methods**: 
   - `upload()` in `walbucket.ts` - now checks `gasStrategy` and uses appropriate method
   - `uploadAssetUserPays()` - fixed folderId type handling
   - `moveAssetToFolder()` - fixed folderId type handling  
   - `createAsset()` - fixed folderId type handling

3. **Type Fixes**:
   - Changed `Option<ID>` handling from `"id"` type to `"address"` type
   - Matches Sui TypeScript SDK requirements for object ID options

### Files Modified

- `sdk/src/services/suiService.ts`:
  - Added `uploadAssetUserPays()` method (~150 lines)
  - Fixed folderId handling in `createAsset()` (line ~222)
  - Fixed folderId handling in `uploadAssetUserPays()` (line ~432)
  - Fixed folderId handling in `moveAssetToFolder()` (line ~1102)

- `sdk/src/core/walbucket.ts`:
  - Updated `upload()` to use `uploadAssetUserPays()` for user-pays mode (line ~295-308)

- `sdk/package.json`:
  - Version bumped to `0.5.4`

## 📝 Migration Guide

No breaking changes - automatic upgrade:

```bash
pnpm add @walbucket/sdk@0.5.4
# or
npm install @walbucket/sdk@0.5.4
# or
yarn add @walbucket/sdk@0.5.4
```

## 🧪 Testing Recommendations

After updating to v0.5.4:

1. **Test Upload to Folder**:
   - Open a folder in the dApp
   - Upload a file
   - Verify file appears in that folder (not root)

2. **Test Move to Folder**:
   - Move a file from root to a folder
   - Verify file disappears from root and appears in folder

3. **Test Move from Folder to Root**:
   - Move a file from a folder to "My Files (Root)"
   - Verify file appears in root

4. **Test Ownership**:
   - Upload a file with your wallet
   - Check asset owner on Sui Explorer
   - Should be your wallet address (not developer address)

5. **Test Transaction Failures**:
   - Reject a transaction in your wallet
   - Verify you only see one approval dialog

## 🔗 Related Issues

- Fixed folder assignment for uploads
- Fixed asset ownership for user-pays uploads
- Fixed multiple transaction approval dialogs
- Improved error messages for ownership issues

## 📦 Package Info

- **NPM Package**: [@walbucket/sdk](https://www.npmjs.com/package/@walbucket/sdk)
- **Version**: `0.5.4`
- **Package Size**: ~149.3 kB compressed, ~953.7 kB unpacked

## 🙏 Acknowledgments

Thanks to all users who reported issues and helped improve the SDK!
