# Walbucket SDK Implementation Tasks

**Status**: 🚧 Implementation Phase - Core Features Complete  
**Architecture**: Standalone SDK (No Backend Dependency)  
**Focus**: Efficiency, Speed, Lightweight  
**Protocol**: Sui gRPC (Protocol Buffers) for blockchain interactions  
**Build Status**: ✅ Building successfully (CJS + ESM)

---

## Phase 1: Project Setup & Infrastructure

### Task 1.1: Initialize SDK Project
- [x] Create `sdk/` directory structure
- [x] Initialize `package.json` with minimal dependencies
- [x] Set up TypeScript configuration (`tsconfig.json`)
- [x] Configure `tsup` for fast bundling
- [x] Set up `vitest` for testing
- [x] Create `.gitignore`
- [x] Create `README.md` skeleton

**Dependencies**:
- `@mysten/sui`: ^1.7.0
- `@mysten/seal`: ^0.9.4 (optional, lazy-loaded)
- `axios`: ^1.13.2
- `typescript`: ^5.7.2
- `tsup`: ^8.0.0
- `vitest`: ^1.0.0

**Estimated Time**: 2-3 hours

---

### Task 1.2: Core Type Definitions
- [x] Create `src/types/config.ts` - Configuration types
- [x] Create `src/types/requests.ts` - Request types
- [x] Create `src/types/responses.ts` - Response types
- [x] Create `src/types/errors.ts` - Error types
- [x] Export all types from `src/index.ts`

**Key Types**:
- `WalbucketConfig`
- `UploadOptions`
- `RetrieveOptions`
- `GasStrategy`
- `EncryptionPolicy`

**Estimated Time**: 2-3 hours

---

### Task 1.3: Error Handling System
- [x] Create `src/utils/errors.ts` (exports from types/errors.ts)
- [x] Define custom error classes:
  - [x] `WalbucketError` (base)
  - [x] `ValidationError`
  - [x] `NetworkError`
  - [x] `EncryptionError`
  - [x] `BlockchainError`
- [x] Error code constants
- [x] Error message formatting
- [ ] Documentation links in errors (TODO: Add links)

**Estimated Time**: 2-3 hours

---

### Task 1.4: Configuration Management
- [x] Create `src/utils/config.ts`
- [x] Configuration validation
- [x] Smart defaults
- [x] Network detection
- [x] Auto-detection of package IDs, URLs
- [ ] Environment variable support (TODO: Add env var support)
- [x] Browser vs Node.js detection (via file utils)
- [ ] gRPC-Web fallback for browsers (if needed) (TODO: Evaluate need)

**Estimated Time**: 3-4 hours

---

## Phase 2: Sui Blockchain Integration

### Task 2.1: Sui Service Setup (gRPC)
- [x] Create `src/services/suiService.ts`
- [x] Initialize `SuiGrpcClient` from `@mysten/sui/grpc`
- [x] Network-based gRPC URL detection
- [x] gRPC connection setup (HTTP/2)
- [ ] Browser detection and gRPC-Web fallback (if needed) (Using JSON-RPC for now)
- [x] Error handling
- [x] Network switching support
- [x] Connection pooling (HTTP/2 multiplexing via gRPC)
- [x] Environment detection utilities
- [x] JSON-RPC client fallback for queries (more stable API)

**gRPC Setup**:
```typescript
import { SuiGrpcClient } from '@mysten/sui/grpc';

const client = new SuiGrpcClient({
  network: 'testnet', // or baseUrl for custom endpoint
});
```

**Estimated Time**: 3-4 hours

---

### Task 2.2: API Key Validation (On-Chain via gRPC)
- [x] Create `src/services/apiKeyService.ts`
- [x] Query API key object from Sui blockchain (using JSON-RPC for queries)
- [x] Parse permissions (bit flags)
- [x] Validate expiration
- [x] Check active status
- [x] Implement caching (in-memory, TTL: configurable)
- [ ] Batch validation support (TODO: Add batch support)
- [x] Type safety for API key queries

**Key Functions**:
- `validateApiKey(apiKey: string): Promise<ApiKeyData>`
- `getApiKeyObjectId(apiKeyHash: string): Promise<string | null>`
- `parsePermissions(permissions: number): string[]`

**gRPC Service**: Uses `LedgerService` for object queries

**Estimated Time**: 4-5 hours

---

### Task 2.3: Asset Operations (via gRPC)
- [x] `getAsset(assetId: string): Promise<AssetMetadata>`
  - [x] Use JSON-RPC client for queries (more stable)
- [x] `createAsset(params): Promise<string>`
  - [x] Build transaction
  - [x] Use `signAndExecuteTransaction` via JSON-RPC client
- [x] `deleteAsset(params): Promise<void>`
  - [x] Use `signAndExecuteTransaction` via JSON-RPC client
- [x] Transaction building
- [x] Object reference handling
- [x] Event parsing from transaction responses

**gRPC Services Used**:
- `LedgerService`: For querying objects
- `TransactionExecutionService`: For executing transactions

**Estimated Time**: 5-6 hours

---

### Task 2.4: Policy Operations (via gRPC)
- [x] `getPolicy(policyId: string): Promise<PolicyData>`
  - [x] Use JSON-RPC client for queries
- [x] `createPolicy(params): Promise<string>`
  - [x] Use `signAndExecuteTransaction` via JSON-RPC client
- [x] `applyPolicyToAsset(params): Promise<void>`
  - [x] Matches contract function `apply_policy_to_asset_with_api_key`
- [x] Policy type conversion (0=public, 1=wallet-gated, 2=time-limited, 3=password-protected)
- [x] Address validation

**gRPC Services Used**:
- `LedgerService`: For querying policy objects
- `TransactionExecutionService`: For creating policies

**Estimated Time**: 2-3 hours

---

### Task 2.5: Bucket Operations
- [ ] `createBucket(params): Promise<string>`
- [ ] `listBuckets(developerAddress: string): Promise<Bucket[]>`
- [ ] `addAssetToBucket(params): Promise<void>`
- [ ] `removeAssetFromBucket(params): Promise<void>`

**Estimated Time**: 3-4 hours

---

## Phase 3: Walrus Storage Integration

### Task 3.1: Walrus Service Setup
- [x] Create `src/services/walrusService.ts`
- [x] Initialize `axios` client
- [x] Network-based URL detection
- [x] Error handling
- [ ] Retry logic with exponential backoff (TODO: Add retry logic)

**Estimated Time**: 2-3 hours

---

### Task 3.2: Upload Implementation
- [x] `upload(data: Buffer, options?): Promise<string>`
- [x] Handle blob ID extraction (multiple response formats)
- [x] Support permanent/deletable blobs (via options)
- [ ] Streaming for large files (TODO: Add streaming support)
- [ ] Progress tracking (optional) (TODO: Add progress callbacks)
- [x] Error handling

**Estimated Time**: 3-4 hours

---

### Task 3.3: Retrieve Implementation
- [x] `retrieve(blobId: string): Promise<Buffer>`
- [x] Support blob ID and object ID (auto-detects format)
- [ ] Streaming support (TODO: Add streaming)
- [x] Error handling
- [x] 404 handling

**Estimated Time**: 2-3 hours

---

### Task 3.4: Delete Implementation
- [x] `delete(blobId: string): Promise<void>`
- [x] Handle permanent vs deletable blobs (graceful handling of 404/405)
- [x] Error handling (404, 405)

**Estimated Time**: 1-2 hours

---

## Phase 4: Seal Encryption Integration

### Task 4.1: Seal Service Setup
- [x] Create `src/services/sealService.ts`
- [x] Lazy initialization (only if encryption enabled)
- [x] Initialize `SealClient` with SuiGrpcClient (✅ Confirmed compatible)
- [x] Server configuration (auto-detect from network)
- [x] Error handling
- [x] Integration with SuiService for policy creation

**Estimated Time**: 3-4 hours

---

### Task 4.2: Encryption Implementation
- [x] `encrypt(data: Buffer, policyId: string, threshold: number): Promise<Buffer>`
- [x] `createPolicyOnChain(params): Promise<string>` - Policy creation on-chain
- [x] Threshold configuration (default: 2)
- [x] Error handling
- [ ] Progress tracking (optional) (TODO: Add progress callbacks)
- [x] Policy type conversion (matches contract)
- [x] Password hashing (SHA-256)

**Estimated Time**: 4-5 hours

---

### Task 4.3: Decryption Implementation
- [x] `decrypt(data: Buffer, policyId: string, sessionKey: any): Promise<Buffer>`
- [ ] Policy lookup (TODO: Add policy verification before decryption)
- [x] Session key handling (requires SessionKey from @mysten/seal)
- [x] Transaction building for approval (seal_approve)
- [x] Error handling
- [ ] Note: `seal_approve` function needs to be added to contract policy module

**Estimated Time**: 4-5 hours

---

## Phase 5: Gas Strategy Implementation

### Task 5.1: Gas Strategy Base
- [x] Create `src/strategies/gasStrategy.ts`
- [x] Define `GasStrategy` type (in config.ts)
- [x] Strategy factory pattern (GasStrategyService)
- [ ] Gas estimation utilities (TODO: Add gas estimation)

**Estimated Time**: 2-3 hours

---

### Task 5.2: Developer-Sponsored Strategy
- [x] Private key validation
- [x] Keypair derivation (Ed25519Keypair)
- [x] Transaction signing (via signAndExecuteTransaction)
- [ ] Gas coin selection (handled by Sui SDK automatically)
- [x] Error handling

**Estimated Time**: 3-4 hours

---

### Task 5.3: User-Pays Strategy
- [x] User signer validation
- [x] Transaction signing with user signer
- [ ] Gas estimation (TODO: Add gas estimation)
- [x] Error handling

**Estimated Time**: 2-3 hours

---

## Phase 6: Core SDK Class

### Task 6.1: Main SDK Class Structure
- [x] Create `src/core/walbucket.ts`
- [x] Constructor with configuration
- [x] Service initialization
- [x] Lazy loading of services (Seal service)
- [x] Error handling wrapper

**Estimated Time**: 3-4 hours

---

### Task 6.2: Upload Method
- [x] `upload(file, options): Promise<UploadResult>`
- [x] File preparation (Buffer/File/string/Blob)
- [x] API key validation
- [x] Encryption (if enabled) - with policy creation
- [x] Walrus upload
- [x] Sui asset creation
- [x] Policy creation (if encryption) - matches contract flow
- [x] Policy application to asset
- [ ] Parallel operations where possible (TODO: Optimize with parallel ops)
- [x] Error handling

**Flow**:
1. Validate API key (cached)
2. Prepare file (convert to Buffer)
3. Encrypt (if enabled) - parallel with transaction prep
4. Upload to Walrus
5. Create asset on Sui
6. Create policy (if encryption) - parallel with asset creation
7. Return result

**Estimated Time**: 6-8 hours

---

### Task 6.3: Retrieve Method
- [x] `retrieve(assetId, options): Promise<Buffer>`
- [x] API key validation
- [x] Get asset metadata from Sui
- [x] Retrieve blob from Walrus
- [x] Decrypt (if encrypted) - requires SessionKey
- [x] Return file data
- [ ] Parallel operations where possible (TODO: Optimize)
- [x] Caching (asset metadata caching)

**Flow**:
1. Validate API key (cached)
2. Get asset metadata (cached)
3. Retrieve from Walrus
4. Decrypt (if encrypted)
5. Return file

**Estimated Time**: 4-5 hours

---

### Task 6.4: Delete Method
- [x] `delete(assetId): Promise<void>`
- [x] API key validation
- [x] Get asset metadata
- [x] Delete from Walrus (graceful handling)
- [x] Delete from Sui
- [x] Error handling
- [x] Cache invalidation

**Estimated Time**: 2-3 hours

---

### Task 6.5: Transform Method
- [x] `transform(assetId, options): Promise<TransformResult>` (Placeholder - requires image processing)
- [ ] Image processing (using Sharp or similar) - Deferred (heavy dependency)
- [ ] Store transformed asset - Deferred
- [ ] Return new asset ID - Deferred
- [x] Basic structure and validation (✅ Complete)
- [x] Transformation request method in SuiService (✅ Complete)

**Note**: Transform requires image processing library (Sharp). For MVP, use backend API for transformations.
**Status**: Placeholder implemented - ready for image processing integration

**Estimated Time**: 4-5 hours (or defer)

---

## Phase 7: Caching & Optimization

### Task 7.1: Caching System
- [x] Create `src/utils/cache.ts`
- [x] In-memory cache with TTL
- [x] Cache for API key validation (in ApiKeyService)
- [x] Cache for asset metadata (in Walbucket class)
- [ ] Cache for policies (TODO: Add policy caching)
- [x] Cache eviction strategy (TTL-based)
- [ ] Size limits (TODO: Add size limits)

**Estimated Time**: 3-4 hours

---

### Task 7.4: Usage Tracking (Client-Side)
- [ ] Create `src/utils/usageTracking.ts` (Not implemented - optional feature)
- [ ] Track API calls (upload, retrieve, delete)
- [ ] Track file sizes
- [ ] Track encryption usage
- [ ] In-memory storage (optional persistence)
- [ ] Export usage stats
- [ ] Privacy-focused (no PII)

**Note**: Client-side only, optional feature for developers

**Estimated Time**: 2-3 hours

---

### Task 7.2: Performance Optimization
- [ ] Parallel operations (upload flow)
- [ ] Request batching
- [ ] Connection reuse
- [ ] Lazy loading improvements
- [ ] Bundle size optimization
- [ ] Tree-shaking verification

**Estimated Time**: 4-5 hours

---

### Task 7.3: Bundle Size Optimization
- [ ] Analyze bundle size
- [ ] Remove unused dependencies
- [ ] Code splitting
- [ ] Tree-shaking configuration
- [ ] Separate builds (browser/Node.js)
- [ ] Optional features as separate exports

**Targets**:
- Core: < 200KB gzipped
- With Seal: < 500KB gzipped

**Estimated Time**: 3-4 hours

---

## Phase 8: Testing

### Task 8.1: Unit Tests Setup
- [x] Configure Vitest
- [x] Mock SuiGrpcClient (test utilities created)
- [x] Mock Walrus API (test utilities created)
- [x] Mock SealClient (test utilities created)
- [x] Test utilities (setup.ts with mocks and constants)

**Estimated Time**: 2-3 hours

---

### Task 8.2: Service Unit Tests
- [x] Test GasStrategy (✅ Complete - 8 tests)
- [x] Test Cache utility (✅ Complete - 7 tests)
- [x] Test File utility (✅ Complete - 8 tests)
- [x] Test Config utility (✅ Complete - 13 tests)
- [x] Test ApiKeyService (✅ Complete - 8 tests)
- [x] Test WalrusService (✅ Complete - 13 tests)
- [ ] Test SuiService (TODO - complex, requires transaction mocking)
- [ ] Test SealService (TODO - requires Seal SDK mocking)

**Target**: > 80% coverage

**Current Coverage**: ~40% (utilities, gas strategy, config utils, API key service, Walrus service)
**Test Status**: ✅ 57 tests passing (6 test files)

**Estimated Time**: 8-10 hours

---

### Task 8.3: Integration Tests
- [ ] Test with real Sui testnet
- [ ] Test with real Walrus
- [ ] Test encryption/decryption
- [ ] Test complete upload flow
- [ ] Test complete retrieve flow

**Estimated Time**: 6-8 hours

---

### Task 8.4: E2E Tests
- [ ] Complete upload flow
- [ ] Complete retrieve flow
- [ ] Error scenarios
- [ ] Performance tests

**Estimated Time**: 4-5 hours

---

## Phase 9: Documentation

### Task 9.1: README
- [x] Installation instructions
- [x] Quick start guide
- [x] Configuration options
- [x] API reference (basic)
- [x] Examples (basic)
- [ ] Migration guide (from Cloudinary) (TODO: Add migration guide)

**Estimated Time**: 4-5 hours

---

### Task 9.2: API Documentation
- [ ] Generate API docs (TypeDoc)
- [ ] Method documentation
- [ ] Type documentation
- [ ] Examples for each method

**Estimated Time**: 3-4 hours

---

### Task 9.3: Examples
- [ ] Basic upload example
- [ ] Upload with encryption
- [ ] Retrieve example
- [ ] Delete example
- [ ] React example
- [ ] Node.js example
- [ ] Next.js example

**Estimated Time**: 3-4 hours

---

## Phase 10: Polish & Release

### Task 10.1: Error Messages
- [x] Review all error messages (✅ Complete)
- [x] Add error codes (✅ Complete - ErrorCode enum defined)
- [ ] Add documentation links (TODO: Add links to docs site)
- [x] Add examples in errors (✅ Complete - JSDoc examples added)

**Estimated Time**: 2-3 hours

---

### Task 10.2: TypeScript Types
- [x] Export all types
- [x] Ensure type safety
- [x] Add JSDoc comments (✅ Complete - Main SDK class, service classes, and error classes documented)
- [x] Verify IntelliSense (types are exported correctly)

**Estimated Time**: 2-3 hours

---

### Task 10.3: Build & Publish
- [x] Configure build scripts
- [x] Test builds (CJS + ESM formats)
- [x] Create npm package structure
- [ ] Publish to npm (or private registry) (Ready for publish)
- [x] Version management (0.1.0)

**Estimated Time**: 2-3 hours

---

## Summary

### Total Estimated Time
- **Phase 1**: 8-12 hours
- **Phase 2**: 15-20 hours
- **Phase 3**: 8-12 hours
- **Phase 4**: 11-14 hours
- **Phase 5**: 7-10 hours
- **Phase 6**: 17-25 hours
- **Phase 7**: 10-13 hours
- **Phase 8**: 20-26 hours
- **Phase 9**: 10-13 hours
- **Phase 10**: 6-9 hours

**Total**: ~112-152 hours (~3-4 weeks full-time)

### Priority Order
1. **Phase 1**: Infrastructure (Foundation)
2. **Phase 2**: Sui Integration (Core blockchain)
3. **Phase 3**: Walrus Integration (Storage)
4. **Phase 6**: Core SDK Class (Main functionality)
5. **Phase 4**: Seal Integration (Encryption)
6. **Phase 5**: Gas Strategy (Flexibility)
7. **Phase 7**: Optimization (Performance)
8. **Phase 8**: Testing (Quality)
9. **Phase 9**: Documentation (Developer experience)
10. **Phase 10**: Polish (Release readiness)

---

## Quick Start Checklist

### MVP Features (Must Have)
- [x] Project setup
- [x] Sui blockchain integration
- [x] Walrus storage integration
- [x] Basic upload (no encryption)
- [x] Basic retrieve
- [x] API key validation
- [x] Developer-sponsored gas

### Enhanced Features (Should Have)
- [x] Seal encryption integration
- [x] User-pays gas strategy
- [x] Delete functionality
- [x] Caching system
- [x] Error handling

### Nice to Have (Can Defer)
- [x] Transform functionality (Placeholder implemented - structure complete, requires image processing library)
- [ ] Bucket operations (Not implemented)
- [x] Policy operations (Create, apply, get)
- [ ] Advanced optimizations (Partial - caching done)

---

**Status**: ✅ Core Implementation Complete! 🎉 **Contract Deployed with `seal_approve`!**

### Implementation Summary
- **Core Features**: ✅ Complete
- **Build System**: ✅ Working (CJS + ESM)
- **Contract Alignment**: ✅ All function calls match contract signatures
- **Contract Deployment**: ✅ Deployed with `seal_approve` function (Package ID: `0x1f520a412cee6d8fb76f66bb749e1e14b2476375bc7c892d103c82f6cedf0d85`)
- **Testing**: 🚧 In Progress (~40% coverage - 57 tests passing: utilities, gas strategy, config, API key service, Walrus service)
- **Documentation**: ✅ Complete (README + comprehensive JSDoc for all public APIs)

### Next Steps
1. ✅ Add `seal_approve` function to contract policy module - **COMPLETED & DEPLOYED**
   - Package ID: `0x1f520a412cee6d8fb76f66bb749e1e14b2476375bc7c892d103c82f6cedf0d85`
   - Transaction: `6zmHAU26TjrXXQUvT3hqRRcJJnjcM3zaqdmbhsswj8ME`
2. Add unit tests (Phase 8) - ✅ Started (utilities complete, services in progress)
3. Add integration tests
4. Optimize parallel operations
5. ✅ Add comprehensive JSDoc comments - **COMPLETE** (All public APIs documented with examples)
6. Add usage tracking (optional)
7. Add streaming support for large files

