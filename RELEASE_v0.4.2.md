# Release Notes - v0.4.2

**Release Date:** December 1, 2025

## 🐛 Bug Fixes

### Fixed Large File Upload Issues

- **Switched to Official Walrus Publisher Endpoints**: Changed default Walrus publisher from third-party `tududes.com` to official `walrus-testnet.walrus.space` publisher, which has higher file size limits and better reliability
- **Fixed 413 Request Entity Too Large errors**: Files as small as 1.46MB were being rejected by third-party publishers. Now using official endpoints that support up to 13.3 GiB

### Upload Performance Improvements

- **Dynamic Timeout Calculation**: Upload timeout now scales with file size:

  - < 1MB: 30 seconds
  - 1-5MB: 1 minute
  - 5-10MB: 2 minutes
  - 10-50MB: 5 minutes
  - 50-100MB: 10 minutes
  - 100MB+: 15 minutes

- **Increased Max Body Length**: Added `maxBodyLength: Infinity` and `maxContentLength: Infinity` to axios clients to support large file uploads

## ✨ Enhancements

### Upload Progress Tracking

Added optional progress callback to upload methods:

```typescript
await walbucket.upload(file, {
  onProgress: (progress) => {
    console.log(
      `Upload: ${progress.percentage}% (${progress.loaded}/${progress.total} bytes)`
    );
  },
});
```

### Better File Size Validation

- Added pre-upload file size validation with clear error messages
- Increased recommended max single blob size from 10MB to 100MB (official publishers support this)
- Clear guidance when files exceed limits

### Enhanced Error Messages

- 413 errors now provide specific guidance about publisher limits
- File size logging for debugging upload issues
- Better error context for troubleshooting

## 🔧 Technical Changes

### Configuration Updates

**Before:**

```typescript
testnet: {
  publisher: "https://publisher.walrus-01.tududes.com",
  aggregator: "https://aggregator.walrus-testnet.walrus.space",
}
```

**After:**

```typescript
testnet: {
  publisher: "https://publisher.walrus-testnet.walrus.space",
  aggregator: "https://aggregator.walrus-testnet.walrus.space",
}
```

### Service Improvements

- Added file size constants: `MAX_SINGLE_BLOB_SIZE` (100MB) and `WALRUS_ABSOLUTE_MAX` (13.3 GiB)
- Implemented `calculateTimeout()` method for dynamic timeout calculation
- Implemented `validateFileSize()` method for pre-upload validation
- Enhanced upload logging for better debugging

## 📦 Installation

```bash
npm install @walbucket/sdk@0.4.2
# or
pnpm add @walbucket/sdk@0.4.2
# or
yarn add @walbucket/sdk@0.4.2
```

## 🔄 Migration Guide

### For Existing Users

No breaking changes. Simply update the package version:

```bash
pnpm update @walbucket/sdk
```

If you were explicitly setting `walrusPublisherUrl` to `tududes.com`, consider removing it to use the new official default, or update to the official endpoint:

```typescript
const walbucket = new Walbucket({
  apiKey: "your-api-key",
  network: "testnet",
  // walrusPublisherUrl is now auto-detected to official endpoint
});
```

### New Progress Tracking Feature

Optionally add progress tracking to your uploads:

```typescript
await walbucket.upload(file, {
  onProgress: (progress) => {
    updateProgressBar(progress.percentage);
  },
});
```

## 🙏 Credits

Thanks to the community for reporting the 413 upload errors with the third-party publishers!

## 📝 Full Changelog

- Fixed 413 errors for small files (< 10MB) by switching to official Walrus publishers
- Added dynamic timeout calculation based on file size
- Added upload progress tracking callback
- Enhanced file size validation and error messages
- Increased max body/content length for large uploads
- Updated default Walrus publisher URLs for testnet and devnet
- Added detailed logging for upload operations

---

**Previous Version:** [v0.4.1](./RELEASE_v0.4.1.md)
