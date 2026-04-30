import { TTLCache } from '../../src/utils/cache';

describe('TTLCache', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns undefined on miss without throwing', () => {
    const cache = new TTLCache<string, string>(1000);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('expires entries after TTL', () => {
    const cache = new TTLCache<string, string>(1000);
    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');
    jest.advanceTimersByTime(1001);
    expect(cache.get('k')).toBeUndefined();
  });

  it('evicts oldest entries when maxSize is exceeded', () => {
    const cache = new TTLCache<string, number>(60_000, 2);
    cache.set('a', 1);
    jest.advanceTimersByTime(1);
    cache.set('b', 2);
    jest.advanceTimersByTime(1);
    cache.set('c', 3);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.size()).toBe(2);
  });

  it('supports delete and clear', () => {
    const cache = new TTLCache<string, number>(1000);
    cache.set('x', 1);
    cache.delete('x');
    expect(cache.get('x')).toBeUndefined();

    cache.set('y', 2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
