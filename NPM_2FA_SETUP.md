# NPM 2FA Setup for Publishing

## Issue
NPM requires Two-Factor Authentication (2FA) to publish packages. Error:
```
403 Forbidden - Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.
```

## Solution Options

### Option 1: Enable 2FA on NPM Account (Recommended)

This is the most secure and recommended approach.

#### Steps:

1. **Login to npmjs.com**
   - Go to: https://www.npmjs.com/login
   - Login with your npm account

2. **Navigate to Profile Settings**
   - Click on your profile picture (top right)
   - Select "Account Settings" or go to: https://www.npmjs.com/settings/[your-username]

3. **Enable Two-Factor Authentication**
   - Click on "Enable 2FA" or "Two-Factor Authentication" section
   - Choose authentication method:
     - **Auth App** (TOTP) - Recommended (Google Authenticator, Authy, 1Password, etc.)
     - **SMS** - Alternative option
   
4. **Setup Auth App** (Recommended):
   - Scan QR code with your authenticator app
   - Enter the verification code from your app
   - Save backup codes in a safe place

5. **Verify Setup**
   - Logout and login again to npm
   - You'll be prompted for 2FA code when logging in

6. **Try Publishing Again**
   ```bash
   cd sdk
   npm publish --access public
   ```

---

### Option 2: Use Granular Access Token (Alternative)

If you don't want to enable 2FA, you can use a granular access token with publish permissions.

#### Steps:

1. **Create Access Token**
   - Go to: https://www.npmjs.com/settings/[your-username]/tokens
   - Click "Generate New Token"
   - Select "Granular Access Token"
   - Choose permissions:
     - **Automation** scope: Read and write packages
     - OR **Publish** scope: Publish packages
   - Give it a name: "SDK Publishing Token"
   - Set expiration (recommended: 90 days or custom)
   - Click "Generate Token"

2. **Copy the Token**
   - **IMPORTANT**: Copy the token immediately - you won't see it again!
   - Store it securely (password manager, etc.)

3. **Login with Token**
   ```bash
   npm login --auth-type=legacy
   ```
   When prompted:
   - Username: [your npm username]
   - Password: [paste the token here - NOT your npm password]
   - Email: [your npm email]

4. **Verify Login**
   ```bash
   npm whoami
   ```

5. **Publish**
   ```bash
   cd sdk
   npm publish --access public
   ```

---

## Troubleshooting

### If 2FA is already enabled but still getting errors:

1. **Check if using correct account**
   ```bash
   npm whoami
   ```

2. **Re-authenticate**
   ```bash
   npm logout
   npm login
   ```

3. **Verify 2FA Status**
   - Check: https://www.npmjs.com/settings/[your-username]
   - Should show "2FA Enabled"

### If using access token:

1. **Token might be expired** - Generate a new one
2. **Token might not have correct permissions** - Ensure it has "Publish" or "Automation" scope
3. **Clear npm cache**
   ```bash
   npm cache clean --force
   ```

---

## Recommended Approach

**Enable 2FA** is the recommended and most secure option. It protects your account and packages from unauthorized access.

After enabling 2FA, you'll need to:
- Enter 2FA code when logging in via CLI
- Use an authenticator app or SMS code for verification
