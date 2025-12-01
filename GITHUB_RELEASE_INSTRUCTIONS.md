# GitHub Release Instructions

## Creating Releases on GitHub

Git tags for `v0.3.0` and `v0.3.1` have been created and pushed to GitHub. Now create GitHub releases:

### Option 1: Using GitHub Web Interface (Recommended)

1. Go to: https://github.com/walbucket/sdk/releases
2. Click **"Draft a new release"**
3. **For v0.3.1:**
   - Select tag: **v0.3.1**
   - Title: **v0.3.1 - Shared Object API Key Lookup Fix**
   - Description: Copy from RELEASE_NOTES.md (v0.3.1 section)
   - Click **"Publish release"**
4. **For v0.3.0:**
   - Select tag: **v0.3.0**
   - Title: **v0.3.0 - Shared Objects for B2C Platform**
   - Description: Copy from RELEASE_NOTES.md (v0.3.0 section)
   - Mark as **"Pre-release"** (breaking changes)
   - Click **"Publish release"**

### Option 2: Using GitHub CLI (if installed)

```bash
# Create v0.3.1 release
gh release create v0.3.1 \
  --title "v0.3.1 - Shared Object API Key Lookup Fix" \
  --notes "🐛 **Bug Fixes**

- Fixed getDeveloperAccountId() to work with shared DeveloperAccount objects
- Changed from getOwnedObjects() to event-based lookup
- Compatible with new shared object architecture (v0.3.0+)

📦 **Installation**
\`\`\`bash
pnpm add @walbucket/sdk@latest
\`\`\`

See [RELEASE_NOTES.md](./RELEASE_NOTES.md) for full details."

# Create v0.3.0 release (breaking changes)
gh release create v0.3.0 \
  --title "v0.3.0 - Shared Objects for B2C Platform" \
  --prerelease \
  --notes "🎉 **Major Update - Breaking Changes**

**BREAKING**: ApiKey and DeveloperAccount are now shared objects. Must recreate accounts with new contract.

✨ **New Features**
- Shared object architecture enables true B2C functionality
- Any user can upload using developer's API key
- New contract: 0x52b1196bdce066f48bdb66d16c516bb618d4daa34f4fdad77caba426d0c03795

📝 **Migration Required**
1. Update SDK: \`pnpm add @walbucket/sdk@0.3.0\`
2. Recreate developer account
3. Recreate API keys
4. Update .env with new IDs

See [RELEASE_NOTES.md](./RELEASE_NOTES.md) for migration guide."
```

## What's Done

✅ Git tags `v0.3.0` and `v0.3.1` created and pushed  
✅ RELEASE_NOTES.md updated with detailed changelogs  
✅ SDK v0.3.0 and v0.3.1 published to npm  
✅ Contract deployed with shared objects  
✅ Dapp updated to SDK v0.3.1

## Next Steps

1. Create GitHub releases for both versions using one of the methods above
2. v0.3.0 should be marked as "Pre-release" (breaking changes)
3. v0.3.1 is the stable release with bug fixes
4. Releases will automatically link to npm packages
