# Create GitHub Release for v0.4.0

Since GitHub CLI (`gh`) is not installed, please create the release manually through GitHub web interface:

## Steps:

1. Go to: https://github.com/walbucket/sdk/releases/new

2. **Choose a tag:** Select `v0.4.0` (already pushed)

3. **Release title:** `v0.4.0 - Dual Gas Strategy Support`

4. **Describe this release:** Copy and paste the following:

````markdown
## 🎉 Major Update - New Features

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

### 🎯 What This Enables

1. **Flexible Architecture**: Same code works with both gas strategies
2. **B2C Platforms**: Let users manage their files with user-pays, or provide free tier with developer-pays
3. **Hybrid Models**: Mix strategies - user-pays for file operations, developer-pays for uploads
4. **Simplified Integration**: No need to write separate code for different gas strategies

### 📦 Installation

```bash
pnpm add @walbucket/sdk@0.4.0
# or
npm install @walbucket/sdk@0.4.0
# or
yarn add @walbucket/sdk@0.4.0
```
````

### 📝 Full Release Notes

See [RELEASE_NOTES.md](https://github.com/walbucket/sdk/blob/main/RELEASE_NOTES.md) for complete details.

### 🔗 NPM Package

https://www.npmjs.com/package/@walbucket/sdk/v/0.4.0

````

5. Click **Publish release**

## Alternative: Using GitHub CLI (if you install it later)

```bash
gh release create v0.4.0 \
  --title "v0.4.0 - Dual Gas Strategy Support" \
  --notes-file RELEASE_NOTES.md
````

## Verify Release

After publishing, the release will be available at:
https://github.com/walbucket/sdk/releases/tag/v0.4.0
