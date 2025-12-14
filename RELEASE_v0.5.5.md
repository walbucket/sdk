# Release v0.5.5 - Share Feature Completeness

## 🎉 New Features

### Share Management Operations

- **Deactivate Shareable Links**: Added methods to deactivate shareable links
  - `deactivateShareableLink(linkId)` - User-pays transaction
  - `deactivateShareableLinkWithApiKey(...)` - API key-sponsored transaction
  - Prevents further access via deactivated links

- **Link Access Tracking**: Added method to track link usage statistics
  - `trackLinkAccess(linkId)` - Updates access count and last accessed timestamp
  - Useful for analytics and monitoring link usage
  - Only supports user-pays transactions

### Query Methods for Shares

- **List Access Grants**: Query all access grants for an address
  - `listAccessGrants(owner?)` - Returns all AccessGrant objects owned by address
  - Includes permissions, expiration, and grant metadata

- **List Shareable Links**: Query all shareable links created by an address
  - `listShareableLinks(owner?)` - Returns all ShareableLink objects owned by address
  - Includes token, permissions, expiration, access count, and status

- **Get Access Grant**: Retrieve specific access grant details
  - `getAccessGrant(grantId)` - Returns detailed information about a grant

- **Get Shareable Link**: Retrieve specific shareable link details
  - `getShareableLink(linkId)` - Returns detailed information about a link including statistics

## 🔧 Technical Details

### Contract Functions Implemented

All share contract functions are now fully implemented:
- ✅ `share_asset` / `share_asset_with_api_key`
- ✅ `create_shareable_link` / `create_shareable_link_with_api_key`
- ✅ `revoke_share` / `revoke_share_with_api_key`
- ✅ `deactivate_shareable_link` / `deactivate_shareable_link_with_api_key` (NEW)
- ✅ `track_link_access` (NEW)

### Query Methods

Query methods use Sui's `getOwnedObjects` and `getObject` RPC methods to fetch:
- `AccessGrant` objects - for address-to-address sharing
- `ShareableLink` objects - for public link-based sharing

## 📝 Migration

No breaking changes - automatic upgrade:

```bash
pnpm add @walbucket/sdk@0.5.5
```

## 🔗 Related

This release completes the share feature implementation, providing full CRUD operations and query capabilities for both access grants and shareable links.
