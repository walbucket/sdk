# Walbucket SDK Architecture
## Standalone, Lightweight, High-Performance

**Version**: 0.1.0  
**Status**: 📋 Planning Phase

---

## Overview

The Walbucket SDK is a **standalone TypeScript/JavaScript library** that provides a Cloudinary-like experience for developers. It operates independently without requiring any backend infrastructure.

### Key Principles

1. **Standalone** - No backend dependency
2. **Lightweight** - Minimal bundle size (< 200KB core)
3. **Fast** - Optimized for speed and efficiency
4. **Simple** - Cloudinary-like API
5. **Type-Safe** - Full TypeScript support

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Developer Application                 │
│  (React, Next.js, Node.js, etc.)                        │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Walbucket SDK (Standalone)                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Core Class (Walbucket)                          │  │
│  │  - Configuration management                      │  │
│  │  - Service orchestration                        │  │
│  │  - Error handling                               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Sui Service  │  │Walrus Service│  │Seal Service  │ │
│  │              │  │              │  │              │ │
│  │SuiGrpcClient│  │ Axios Client │  │ SealClient   │ │
│  │              │  │              │  │              │ │
│  │ - Queries    │  │ - Upload     │  │ - Encrypt    │ │
│  │ - Transactions│  │ - Retrieve  │  │ - Decrypt    │ │
│  │ - Validation │  │ - Delete    │  │ - Policies   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │API Key Service│ │Gas Strategy  │                  │
│  │              │  │              │                  │
│  │ - Validation │  │ - Dev-Sponsor│                  │
│  │ - Caching    │  │ - User-Pays  │                  │
│  └──────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Sui Fullnode │  │ Walrus REST │  │ Seal Network │
│   (gRPC)     │  │    API      │  │   (On-Chain) │
│ Protocol     │  │             │  │              │
│ Buffers      │  │             │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Component Details

### 1. Core Class (`Walbucket`)

**Responsibilities**:
- Configuration management
- Service initialization
- Method orchestration
- Error handling
- Public API

**Key Methods**:
- `upload(file, options)`
- `retrieve(assetId, options)`
- `delete(assetId)`
- `transform(assetId, options)`

### 2. Sui Service

**Responsibilities**:
- Blockchain queries via gRPC
- Transaction building
- Transaction signing
- Object management
- Real-time streaming (optional)

**Dependencies**:
- `@mysten/sui/grpc` (SuiGrpcClient)
- Direct gRPC calls to Sui fullnodes (Protocol Buffers)

**Why gRPC?**:
- **Performance**: Protocol Buffers (binary) are faster than JSON
- **Efficiency**: Smaller payloads, reduced network overhead
- **Future-Proof**: Sui will deprecate JSON-RPC by April 2026
- **Type Safety**: Strongly typed interfaces
- **Streaming**: Real-time updates via SubscriptionService

**Key Methods**:
- `getAsset(assetId)` - Query asset via gRPC
- `createAsset(params)` - Create asset via gRPC
- `deleteAsset(params)` - Delete asset via gRPC
- `validateApiKey(apiKey)` - Validate API key via gRPC
- `subscribeToEvents()` - Real-time event streaming (optional)

### 3. Walrus Service

**Responsibilities**:
- Blob storage operations
- HTTP client management
- Error handling

**Dependencies**:
- `axios` (HTTP client)
- Direct calls to Walrus REST API

**Key Methods**:
- `upload(data, options)`
- `retrieve(blobId)`
- `delete(blobId)`

### 4. Seal Service

**Responsibilities**:
- Encryption/decryption
- Policy management
- Lazy initialization

**Dependencies**:
- `@mysten/seal` (SealClient)
- `SuiGrpcClient` (gRPC) - **✅ Works with Seal!**
- **Note**: Same gRPC client used by all services for maximum performance

**Key Methods**:
- `encrypt(data, policy)`
- `decrypt(data, policyId, sessionKey)`
- `createPolicy(policy)`

### 5. API Key Service

**Responsibilities**:
- On-chain API key validation
- Permission checking
- Caching

**Dependencies**:
- SuiGrpcClient (for on-chain queries)

**Key Methods**:
- `validateApiKey(apiKey)`
- `getPermissions(apiKey)`

### 6. Gas Strategy

**Responsibilities**:
- Transaction signing
- Gas fee management
- Strategy selection

**Dependencies**:
- SuiGrpcClient (gRPC for all operations)
- Keypair/Signer

**Key Methods**:
- `signTransaction(tx, strategy)`
- `estimateGas(tx)`

---

## Data Flow

### Upload Flow

```
1. Developer calls: walbucket.upload(file, { encryption: true })
   │
   ├─► 2. Validate API key (cached)
   │      └─► Query Sui blockchain via gRPC for API key object
   │
   ├─► 3. Prepare file (convert to Buffer)
   │
   ├─► 4. Encrypt file (if encryption: true)
   │      └─► SealService.encrypt()
   │          └─► Create policy on Sui
   │          └─► Encrypt data
   │
   ├─► 5. Upload to Walrus (parallel with step 6)
   │      └─► WalrusService.upload()
   │          └─► HTTP PUT to Walrus REST API
   │          └─► Get blob ID
   │
   ├─► 6. Create asset on Sui (parallel with step 5)
   │      └─► SuiService.createAsset()
   │          └─► Build transaction
   │          └─► Sign transaction (gas strategy)
   │          └─► Submit to Sui via gRPC (TransactionExecutionService)
   │
   └─► 7. Return result
         └─► { assetId, blobId, url, encrypted, policyId }
```

### Retrieve Flow

```
1. Developer calls: walbucket.retrieve(assetId, { decrypt: true })
   │
   ├─► 2. Validate API key (cached)
   │
   ├─► 3. Get asset metadata from Sui (cached)
   │      └─► SuiService.getAsset()
   │          └─► Query via gRPC (LedgerService)
   │
   ├─► 4. Retrieve blob from Walrus
   │      └─► WalrusService.retrieve()
   │          └─► HTTP GET from Walrus REST API
   │
   ├─► 5. Decrypt (if encrypted)
   │      └─► SealService.decrypt()
   │          └─► Get policy from Sui
   │          └─► Decrypt data
   │
   └─► 6. Return file data (Buffer/Blob)
```

---

## Performance Optimizations

### 1. Lazy Loading
- Seal SDK only loaded if encryption enabled
- Services initialized on first use
- Tree-shakeable exports

### 2. Caching
- **API Key Validation**: TTL 1 hour
- **Asset Metadata**: TTL 5 minutes
- **Policies**: TTL 10 minutes
- **Gas Prices**: TTL 1 minute

### 3. Parallel Operations
- Upload: Encrypt + Prepare transaction in parallel
- Retrieve: Get metadata + Fetch blob in parallel
- Batch operations where possible

### 4. Network Efficiency
- **gRPC HTTP/2**: Multiplexing, connection reuse
- **Protocol Buffers**: Binary serialization (smaller, faster)
- Request batching
- Smart retry logic
- Compression for large payloads
- Streaming support for real-time data

### 5. Bundle Size
- Minimal dependencies
- Tree-shaking support
- Code splitting
- Optional features as separate exports

---

## Security

### Private Key Handling
- Never logged
- Clear from memory after use
- Environment variable support
- Security warnings in docs

### API Key Security
- On-chain validation (not client-side only)
- Cached validation results
- Handle expiration gracefully

### Encryption
- Secure by default (encryption: true)
- Policy-based access control
- On-chain policy enforcement

---

## Dependencies

### Core (Required)
- `@mysten/sui`: ^1.7.0 (Sui SDK - includes gRPC client)
- `axios`: ^1.13.2 (HTTP client for Walrus)

**Note**: `SuiGrpcClient` is available from `@mysten/sui/grpc` - no additional gRPC dependencies needed!

### Optional (Lazy-Loaded)
- `@mysten/seal`: ^0.9.4 (Encryption - only if encryption enabled)

### Dev
- `typescript`: ^5.7.2
- `tsup`: ^8.0.0 (Fast bundler)
- `vitest`: ^1.0.0 (Fast test runner)

---

## Bundle Size Targets

- **Core SDK**: < 200KB (gzipped)
- **With Seal**: < 500KB (gzipped)
- **Tree-shakeable**: Remove unused features

---

## Browser vs Node.js

### Browser
- Uses `fetch` API (via axios)
- Uses `Blob` for file handling
- gRPC-Web support (if available) for browsers
- Smaller bundle (no Node.js-specific code)
- See `BROWSER_SUPPORT.md` for details

### Node.js
- Uses `http`/`https` (via axios)
- Uses `Buffer` for file handling
- Can use `fs` for file paths

### Universal
- Same API for both
- Automatic detection
- Type-safe

---

## Future: REST API Layer

The REST API will be built **later** and will use the SDK internally:

```typescript
// Future REST API (Express.js)
import { Walbucket } from '@walbucket/sdk';

app.post('/v1/uploads', async (req, res) => {
  const walbucket = new Walbucket({
    apiKey: req.headers['x-api-key'],
    sponsorPrivateKey: getDeveloperKey(req.headers['x-api-key'])
  });
  
  const result = await walbucket.upload(req.file, {
    encryption: req.body.encryption,
    // ... other options
  });
  
  res.json(result);
});
```

**Benefits**:
- REST API is just a thin HTTP wrapper
- All logic in SDK (single source of truth)
- Easy to maintain
- Consistent behavior

---

## Summary

The Walbucket SDK is designed to be:
- ✅ **Standalone** - Works without backend
- ✅ **Lightweight** - Small bundle size
- ✅ **Fast** - Optimized for performance
- ✅ **Simple** - Cloudinary-like API
- ✅ **Type-Safe** - Full TypeScript support

**Ready for implementation!** 🚀

