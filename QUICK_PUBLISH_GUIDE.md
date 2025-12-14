# Quick Publish Guide - SDK v0.5.1

## Current Status
- ✅ Version: 0.5.1
- ✅ Built successfully
- ✅ Package verified
- ⚠️ **Blocked**: NPM requires 2FA for publishing

## Quick Fix Options

### Option A: Enable 2FA (2 minutes) - RECOMMENDED

1. Go to: https://www.npmjs.com/settings/[your-username]/profile
2. Click "Enable 2FA" 
3. Scan QR code with Google Authenticator/Authy
4. Enter verification code
5. Try publishing:
   ```bash
   cd sdk
   npm publish --access public
   ```

### Option B: Use Access Token (Alternative)

1. Create token: https://www.npmjs.com/settings/[your-username]/tokens
2. Generate "Granular Access Token" with "Publish" scope
3. Login with token:
   ```bash
   npm login --auth-type=legacy
   # Username: [your-username]
   # Password: [paste token here]
   # Email: [your-email]
   ```
4. Publish:
   ```bash
   cd sdk
   npm publish --access public
   ```

## After Publishing

1. Verify: `npm view @walbucket/sdk version` (should show 0.5.1)
2. Install in dApp: `cd ../dapp && pnpm install`

---

**Note**: NPM made 2FA mandatory for package publishing for security. This is a one-time setup that protects your packages.
