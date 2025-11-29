# GitHub Release Instructions

## Creating the Release on GitHub

The git tag `v0.1.0` has been created and pushed to GitHub. Now you need to create a GitHub release:

### Option 1: Using GitHub Web Interface (Recommended)

1. Go to: https://github.com/walbucket/sdk/releases
2. Click **"Draft a new release"** or **"Create a new release"**
3. Select the tag: **v0.1.0**
4. Title: **v0.1.0 - Initial Release**
5. Copy and paste the content from `.github/RELEASE_TEMPLATE.md` into the release description
6. Click **"Publish release"**

### Option 2: Using GitHub CLI (if installed)

```bash
gh release create v0.1.0 \
  --title "v0.1.0 - Initial Release" \
  --notes-file .github/RELEASE_TEMPLATE.md
```

## What's Already Done

✅ Git tag `v0.1.0` created and pushed  
✅ README updated with npm package badges and link  
✅ Release notes template created  

## Next Steps

1. Create the GitHub release using one of the methods above
2. The release will automatically link to the npm package
3. Update the repository description/topics on GitHub to include "npm" and "walbucket-sdk"
