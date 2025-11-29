# Walbucket SDK Implementation Plan
## Standalone, Lightweight, High-Performance SDK

**Date**: 2025-01-XX  
**Version**: 0.1.0  
**Status**: 📋 Planning Phase

---

## Overview

The Walbucket SDK is a **standalone, lightweight TypeScript/JavaScript library** that provides a Cloudinary-like experience for developers. It handles all operations directly without requiring a backend:

- ✅ **Direct Sui blockchain integration** (via `@mysten/sui/grpc` - gRPC for performance)
- ✅ **Direct Walrus storage** (via REST API - no auth needed)
- ✅ **Direct Seal encryption** (via `@mysten/seal`)
- ✅ **On-chain API key validation**
- ✅ **Hybrid gas fee management** (developer-sponsored or user-pays)
- ✅ **Client-side usage tracking** (optional, for analytics)
- ✅ **Zero backend dependency**

**Goal**: Fast, efficient, lightweight SDK that works standalone.

---

## Core Design Principles

### 1. **Standalone Architecture**
- No backend dependency
- Direct blockchain/storage/encryption integration
- Works in browser and Node.js
- Self-contained functionality

### 2. **Lightweight & Fast**
- Minimal dependencies
- Tree-shakeable exports
- Lazy loading where possible
- Optimized bundle size
- Fast initialization

### 3. **Efficient Operations**
- Parallel operations where possible
- Minimal network calls
- Smart caching
- Batch operations support

### 4. **Developer Experience**
- Cloudinary-like API
- Simple configuration
- Type-safe (TypeScript)
- Clear error messages
- Comprehensive documentation

---

## Architecture

### Component Structure

```
┌─────────────────────────────────────────┐
│         Walbucket SDK                    │
│  (Standalone npm package)                │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Core Class                      │  │
│  │  - Walbucket (main entry)        │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Sui Service                     │  │
│  │  - SuiGrpcClient integration    │  │
│  │  - Transaction building          │  │
│  │  - On-chain queries              │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Walrus Service                  │  │
│  │  - REST API client (axios)       │  │
│  │  - Blob upload/retrieve/delete   │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Seal Service                    │  │
│  │  - SealClient integration        │  │
│  │  - Encryption/decryption         │  │
│  │  - Policy management             │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  API Key Service                 │  │
│  │  - On-chain validation           │  │
│  │  - Permission checking           │  │
│  │  - Caching                       │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Gas Strategy                    │  │
│  │  - Developer-sponsored           │  │
│  │  - User-pays                     │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## SDK Configuration

### Minimal Configuration

```typescript
export interface WalbucketConfig {
  // Required
  apiKey: string;
  
  // Optional - with smart defaults
  network?: 'testnet' | 'mainnet' | 'devnet' | 'localnet';
  encryption?: boolean; // Default: true
  gasStrategy?: 'developer-sponsored' | 'user-pays'; // Default: 'developer-sponsored'
  
  // For developer-sponsored gas
  sponsorPrivateKey?: string; // Required if gasStrategy is 'developer-sponsored'
  
  // For user-pays gas
  userSigner?: Signer; // Required if gasStrategy is 'user-pays'
  
  // Advanced (optional)
  packageId?: string; // Auto-detected from network if not provided
  walrusPublisherUrl?: string; // Auto-detected from network
  walrusAggregatorUrl?: string; // Auto-detected from network
  sealServerIds?: string[]; // Auto-detected from network
  cacheTTL?: number; // Default: 3600 seconds
  useGrpc?: boolean; // Default: true (use gRPC, gRPC-Web fallback in browsers if needed)
}
```

### Smart Defaults

- **Network**: `testnet` (can be overridden)
- **Encryption**: `true` (secure by default)
- **Gas Strategy**: `developer-sponsored` (best UX)
- **Package ID**: Auto-detected from network
- **Walrus URLs**: Auto-detected from network
- **Seal Servers**: Auto-detected from network

---

## Core API

### Initialization

```typescript
import { Walbucket } from '@walbucket/sdk';

// Minimal config (uses smart defaults)
const walbucket = new Walbucket({
  apiKey: 'your-api-key',
  sponsorPrivateKey: 'your-private-key' // For developer-sponsored gas
});

// Or with user-pays
const walbucket = new Walbucket({
  apiKey: 'your-api-key',
  gasStrategy: 'user-pays',
  userSigner: userWalletSigner
});
```

### Upload

```typescript
// Simple upload
const result = await walbucket.upload(file, {
  name: 'my-image.jpg',
  folder: 'products',
  encryption: true, // Optional, defaults to config.encryption
  policy: {
    type: 'wallet-gated',
    addresses: ['0x...']
  }
});

// Result
{
  assetId: '0x...',
  blobId: '...',
  url: 'https://...',
  encrypted: true,
  policyId: '0x...'
}
```

### Retrieve

```typescript
// Retrieve file
const file = await walbucket.retrieve(assetId, {
  decrypt: true // Optional, defaults to true if encrypted
});

// Returns: Buffer (Node.js) or Blob (browser)
```

### Delete

```typescript
await walbucket.delete(assetId);
```

### Transform

```typescript
const transformed = await walbucket.transform(assetId, {
  width: 800,
  height: 600,
  format: 'webp',
  quality: 90
});
```

---

## Implementation Details

### 1. Sui Service

**Purpose**: Direct blockchain interaction via gRPC

**Key Features**:
- Uses `SuiGrpcClient` from `@mysten/sui/grpc`
- Direct gRPC calls to Sui full nodes (Protocol Buffers)
- Transaction building and signing
- On-chain queries (API keys, assets, policies)
- Real-time streaming support (SubscriptionService)

**Why gRPC?**:
- ✅ **Higher Performance**: Protocol Buffers (binary) vs JSON (text) - faster serialization
- ✅ **Smaller Payloads**: Binary format reduces network overhead
- ✅ **Future-Proof**: Sui plans to deprecate JSON-RPC by April 2026
- ✅ **Type Safety**: Strongly typed interfaces, fewer runtime errors
- ✅ **Real-Time Streaming**: Server-side streaming for live updates
- ✅ **Better for High Throughput**: Optimized for frequent blockchain queries

**Optimizations**:
- Connection pooling (HTTP/2 multiplexing)
- Request batching
- Smart caching of frequently accessed objects
- Streaming for real-time data

### 2. Walrus Service

**Purpose**: Direct blob storage

**Key Features**:
- Uses `axios` for HTTP calls
- Direct calls to Walrus REST API
- No authentication required
- Upload/retrieve/delete operations

**Optimizations**:
- Streaming for large files
- Parallel uploads for chunks
- Retry logic with exponential backoff

### 3. Seal Service

**Purpose**: Encryption/decryption

**Key Features**:
- Uses `SealClient` from `@mysten/seal`
- Policy-based encryption
- On-chain policy enforcement
- **✅ Uses `SuiGrpcClient` (gRPC)** - Full gRPC support!

**Client Strategy**:
- Uses `SuiGrpcClient` (gRPC) for Seal operations
- Same client as other services
- **Full gRPC approach**: 100% of operations use gRPC

**Why It Works**:
- `SuiGrpcClient` has `core: GrpcCoreClient`
- `GrpcCoreClient` extends `Experimental_CoreClient`
- Seal requires `ClientWithExtensions<{ core: Experimental_CoreClient }>`
- Type compatibility satisfied ✅

**Optimizations**:
- Lazy initialization (only if encryption enabled)
- Cached policy lookups
- Efficient encryption algorithms
- gRPC performance benefits (20-30% faster)

### 4. API Key Service

**Purpose**: On-chain API key validation

**Key Features**:
- Queries Sui blockchain for API key objects
- Validates permissions, expiration, active status
- Smart caching to reduce blockchain queries

**Optimizations**:
- In-memory cache with TTL
- Batch validation
- Parallel queries

### 5. Gas Strategy

**Purpose**: Flexible gas fee management

**Key Features**:
- Developer-sponsored (uses private key)
- User-pays (uses user signer)
- Automatic gas estimation
- Transaction signing

**Optimizations**:
- Gas price caching
- Batch transactions
- Smart gas estimation

---

## Performance Optimizations

### 1. Lazy Loading
- Seal SDK only loaded if encryption enabled
- Services initialized on first use
- Tree-shakeable exports

### 2. Caching
- API key validation cache (TTL: 1 hour)
- Object metadata cache
- Policy cache
- Gas price cache

### 3. Parallel Operations
- Upload: Encrypt + Prepare transaction in parallel
- Retrieve: Get metadata + Fetch blob in parallel
- Batch operations support

### 4. Bundle Size
- Minimal dependencies
- Tree-shaking support
- Separate builds for browser/Node.js
- Optional features as separate exports

### 5. Network Efficiency
- Request batching
- Connection reuse
- Smart retry logic
- Compression for large payloads

---

## Dependencies

### Core Dependencies (Required)
```json
{
  "@mysten/sui": "^1.7.0",        // Sui SDK (includes gRPC client)
  "@mysten/seal": "^0.9.4",       // Encryption (optional, lazy-loaded)
  "axios": "^1.13.2"              // Walrus REST API
}
```

**Note**: 
- `@mysten/sui` includes `SuiGrpcClient` from `@mysten/sui/grpc` - no additional gRPC dependencies needed!
- gRPC uses Protocol Buffers for efficient binary serialization
- HTTP/2 support for connection multiplexing and reuse

### Why gRPC?
- **Performance**: Protocol Buffers (binary) are faster than JSON
- **Efficiency**: Smaller payloads, reduced network overhead  
- **Future-Proof**: Sui will deprecate JSON-RPC by April 2026
- **Type Safety**: Strongly typed interfaces
- **Streaming**: Real-time updates via SubscriptionService

See `GRPC_INTEGRATION.md` for detailed gRPC implementation guide.

### Dev Dependencies
```json
{
  "typescript": "^5.7.2",
  "tsup": "^8.0.0",               // Fast bundler
  "vitest": "^1.0.0",              // Fast test runner
  "@types/node": "^22.0.0"
}
```

### Bundle Size Targets
- **Core SDK**: < 200KB (gzipped)
- **With Seal**: < 500KB (gzipped)
- **Tree-shakeable**: Remove unused features

---

## Project Structure

```
sdk/
├── package.json
├── tsconfig.json
├── tsup.config.ts              # Fast bundler config
├── vitest.config.ts            # Test config
├── README.md
├── src/
│   ├── index.ts                # Main entry point
│   ├── core/
│   │   └── walbucket.ts        # Main SDK class
│   ├── services/
│   │   ├── suiService.ts       # Sui blockchain
│   │   ├── walrusService.ts   # Walrus storage
│   │   ├── sealService.ts      # Seal encryption
│   │   └── apiKeyService.ts    # API key validation
│   ├── strategies/
│   │   └── gasStrategy.ts      # Gas fee management
│   ├── types/
│   │   ├── config.ts           # Configuration types
│   │   ├── requests.ts         # Request types
│   │   └── responses.ts        # Response types
│   └── utils/
│       ├── cache.ts            # Caching utilities
│       ├── validation.ts      # Input validation
│       └── errors.ts           # Error handling
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    ├── API.md
    ├── EXAMPLES.md
    └── MIGRATION.md
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Project setup (TypeScript, bundler, tests)
- [ ] Core SDK class structure
- [ ] Configuration management
- [ ] Error handling
- [ ] Type definitions

### Phase 2: Sui Integration (Week 1-2)
- [ ] SuiGrpcClient initialization
- [ ] gRPC connection setup
- [ ] Transaction building
- [ ] On-chain queries via gRPC
- [ ] API key validation (on-chain)
- [ ] Asset operations (create, get, delete)
- [ ] Streaming support (optional, for real-time updates)

### Phase 3: Walrus Integration (Week 2)
- [ ] Walrus REST API client
- [ ] Upload implementation
- [ ] Retrieve implementation
- [ ] Delete implementation
- [ ] Streaming support

### Phase 4: Seal Integration (Week 2-3)
- [ ] SealClient initialization
- [ ] Encryption implementation
- [ ] Decryption implementation
- [ ] Policy management
- [ ] Lazy loading

### Phase 5: Gas Strategy (Week 3)
- [ ] Developer-sponsored implementation
- [ ] User-pays implementation
- [ ] Gas estimation
- [ ] Transaction signing

### Phase 6: Upload Flow (Week 3-4)
- [ ] Complete upload implementation
- [ ] Encryption integration
- [ ] Storage integration
- [ ] Blockchain integration
- [ ] Error handling

### Phase 7: Retrieve Flow (Week 4)
- [ ] Complete retrieve implementation
- [ ] Decryption integration
- [ ] Caching
- [ ] Error handling

### Phase 8: Additional Features (Week 4-5)
- [ ] Delete implementation
- [ ] Transform implementation
- [ ] Bucket operations
- [ ] Policy operations

### Phase 9: Optimization (Week 5)
- [ ] Performance optimization
- [ ] Bundle size optimization
- [ ] Caching improvements
- [ ] Parallel operations

### Phase 10: Testing & Documentation (Week 5-6)
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] API documentation
- [ ] Examples
- [ ] Migration guide

---

## Performance Targets

### Speed
- **Initialization**: < 50ms
- **Upload (1MB)**: < 2s (with gRPC)
- **Retrieve (1MB)**: < 1s (with gRPC)
- **API Key Validation**: < 100ms (cached: < 1ms)
- **gRPC Queries**: 20-30% faster than JSON-RPC

### Bundle Size
- **Core**: < 200KB gzipped
- **With Seal**: < 500KB gzipped
- **Tree-shakeable**: Remove unused features

### Memory
- **Base**: < 10MB
- **With cache**: < 50MB
- **Efficient cleanup**: Automatic cache eviction

---

## Security Considerations

### Private Key Handling
- Never log private keys
- Clear from memory after use
- Support environment variables
- Warn about security in docs

### API Key Security
- Validate on-chain (not client-side only)
- Cache validation results
- Handle expiration gracefully

### Encryption
- Secure by default (encryption: true)
- Policy-based access control
- On-chain policy enforcement

---

## Developer Experience

### Simple API
```typescript
// Minimal code to get started
const walbucket = new Walbucket({
  apiKey: process.env.WALBUCKET_API_KEY,
  sponsorPrivateKey: process.env.PRIVATE_KEY
});

await walbucket.upload(file);
```

### Type Safety
- Full TypeScript support
- Exported types
- IntelliSense support
- Compile-time error checking

### Error Messages
- Clear, actionable errors
- Error codes
- Documentation links
- Examples in error messages

### Documentation
- Comprehensive README
- API documentation
- Examples for common use cases
- Migration guide from Cloudinary

---

## Testing Strategy

### Unit Tests
- All services tested independently
- Mock external dependencies
- Fast execution (< 1s)

### Integration Tests
- Test with real Sui testnet
- Test with real Walrus
- Test encryption/decryption

### E2E Tests
- Complete upload flow
- Complete retrieve flow
- Error scenarios

---

## Next Steps

1. **Create SDK project structure**
2. **Set up build system** (tsup for fast builds)
3. **Implement core services**
4. **Add tests**
5. **Optimize performance**
6. **Write documentation**

---

**Ready to implement!** 🚀

