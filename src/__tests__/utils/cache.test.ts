import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Cache } from '../../utils/cache.js';

describe('Cache', () => {
  let cache: Cache<string>;
  const defaultTTL = 1000; // 1 second

  beforeEach(() => {
    cache = new Cache<string>(defaultTTL);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return null for non-existent keys', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('should expire entries after TTL', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
    
    vi.advanceTimersByTime(defaultTTL + 100);
    expect(cache.get('key1')).toBeNull();
  });

  it('should use custom TTL when provided', () => {
    const customTTL = 2000;
    cache.set('key1', 'value1', customTTL);
    
    vi.advanceTimersByTime(defaultTTL + 100);
    expect(cache.get('key1')).toBe('value1'); // Still valid
    
    vi.advanceTimersByTime(customTTL);
    expect(cache.get('key1')).toBeNull();
  });

  it('should delete entries', () => {
    cache.set('key1', 'value1');
    cache.delete('key1');
    expect(cache.get('key1')).toBeNull();
  });

  it('should clear all entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });

  it('should clean expired entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    vi.advanceTimersByTime(defaultTTL + 100);
    cache.clean();
    
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });
});
