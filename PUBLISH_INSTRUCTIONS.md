# Publishing SDK v0.5.1 to NPM

## Prerequisites

1. **NPM Account**: Ensure you're logged into npm with the correct account
   ```bash
   npm whoami
   ```
   If not logged in:
   ```bash
   npm login
   ```

2. **Verify Build**: The SDK has been built successfully
   ```bash
   # Already completed - dist/ folder contains compiled files
   ```

3. **Verify Version**: Check package.json version is 0.5.1
   ```bash
   cat package.json | grep version
   ```

## Publishing Steps

### 1. Verify Package Contents
```bash
cd sdk
npm pack --dry-run
```

This will show what files will be published (should include `dist/`, `README.md`, `package.json`)

### 2. Publish to NPM
```bash
npm publish --access public
```

**Note**: If this is a scoped package (`@walbucket/sdk`), you may need the `--access public` flag for the first publish or if you want it to be public.

### 3. Verify Publication
After publishing, verify on npm:
```bash
npm view @walbucket/sdk version
```

Or check on npmjs.com:
https://www.npmjs.com/package/@walbucket/sdk

## Post-Publication

After successful publication:

1. **Update dApp**: Update `dapp/package.json` to use `@walbucket/sdk@0.5.1`
2. **Install in dApp**: Run `pnpm install` in the dApp directory
3. **Test**: Verify the move file functionality works correctly

## Troubleshooting

### If you get "You do not have permission to publish"
- Ensure you're logged into the correct npm account
- Check if the package name already exists and you have access
- For scoped packages, ensure the organization/scope is correct

### If you get version already exists
- The version 0.5.1 may already be published
- Check current version: `npm view @walbucket/sdk version`
- If needed, bump to 0.5.2

### Rollback
If you need to unpublish (within 72 hours):
```bash
npm unpublish @walbucket/sdk@0.5.1
```
**Note**: Be careful with unpublishing, especially if others are using the version.
