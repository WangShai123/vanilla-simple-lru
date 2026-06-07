const defaultMaxAge = Number.POSITIVE_INFINITY;

const isCacheValue = (value) =>
  typeof value === 'object' &&
  value !== null &&
  Object.prototype.hasOwnProperty.call(value, 'value') &&
  Object.prototype.hasOwnProperty.call(value, 'expiry');

const normalizeMaxSize = (maxSize) => {
  if (!Number.isInteger(maxSize) || maxSize < 1 || !Number.isFinite(maxSize)) {
    throw new TypeError('`maxSize` must be a positive integer.');
  }

  return maxSize;
};

const normalizeMaxAge = (maxAge) => {
  if (typeof maxAge !== 'number' || Number.isNaN(maxAge) || maxAge <= 0) {
    throw new TypeError('`maxAge` must be a number greater than 0.');
  }

  return maxAge;
};

const resolveOptions = (options = {}) => {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('Expected an options object.');
  }

  const maxSize = options.maxSize ?? options.max;
  const maxAge = options.maxAge ?? options.ttl ?? defaultMaxAge;

  if (maxSize === undefined) {
    throw new TypeError('`maxSize` is required.');
  }

  return {
    maxSize: normalizeMaxSize(maxSize),
    maxAge: normalizeMaxAge(maxAge),
    onEviction: options.onEviction,
  };
};

const isStale = (item) => item.expiry <= Date.now();

const toCacheItem = (value, maxAge = defaultMaxAge) => ({
  value,
  expiry:
    maxAge === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Date.now() + maxAge,
});

export default class Lru extends Map {
  #cache = new Map();
  #oldCache = new Map();
  #maxSize;
  #maxAge;
  #onEviction;

  constructor(options) {
    super();

    const { maxSize, maxAge, onEviction } = resolveOptions(options);

    if (onEviction !== undefined && typeof onEviction !== 'function') {
      throw new TypeError('`onEviction` must be a function.');
    }

    this.#maxSize = maxSize;
    this.#maxAge = maxAge;
    this.#onEviction = onEviction;
  }

  get maxSize() {
    return this.#maxSize;
  }

  get max() {
    return this.#maxSize;
  }

  get maxAge() {
    return this.#maxAge;
  }

  get ttl() {
    return this.#maxAge;
  }

  get size() {
    if (!this.#cache.size) {
      return this.#oldCache.size;
    }

    let oldCacheSize = 0;

    for (const key of this.#oldCache.keys()) {
      if (!this.#cache.has(key)) {
        oldCacheSize++;
      }
    }

    return Math.min(this.#cache.size + oldCacheSize, this.#maxSize);
  }

  get(key) {
    if (this.#cache.has(key)) {
      const item = this.#cache.get(key);
      return this.#getItemValue(key, item);
    }

    if (this.#oldCache.has(key)) {
      const item = this.#oldCache.get(key);

      if (!this.#deleteIfStale(key, item)) {
        this.#moveToRecent(key, item);
        return item.value;
      }
    }

    return undefined;
  }

  set(key, value, { maxAge = this.#maxAge } = {}) {
    maxAge = normalizeMaxAge(maxAge);

    const item = toCacheItem(value, maxAge);

    if (this.#cache.has(key)) {
      this.#cache.set(key, item);
    } else {
      this.#setItem(key, item);
    }

    return this;
  }

  has(key) {
    const item = this.#peekItem(key);

    if (item === undefined) {
      return false;
    }

    if (isStale(item)) {
      this.#deleteIfStale(key, item);
      return false;
    }

    return true;
  }

  peek(key) {
    const item = this.#peekItem(key);

    if (item === undefined) {
      return undefined;
    }

    if (isStale(item)) {
      this.#deleteIfStale(key, item);
      return undefined;
    }

    return item.value;
  }

  delete(key) {
    const deletedFromCache = this.#cache.delete(key);
    const deletedFromOldCache = this.#oldCache.delete(key);

    return deletedFromCache || deletedFromOldCache;
  }

  clear() {
    this.#cache.clear();
    this.#oldCache.clear();
  }

  resize(maxSize) {
    maxSize = normalizeMaxSize(maxSize);

    const items = [...this.#entriesAscending()];
    const removeCount = items.length - maxSize;

    this.#maxSize = maxSize;

    if (removeCount < 0) {
      this.#cache = new Map(items);
      this.#oldCache = new Map();
      return;
    }

    if (removeCount > 0) {
      this.#emitEvictions(items.slice(0, removeCount));
    }

    this.#oldCache = new Map(items.slice(removeCount));
    this.#cache = new Map();
  }

  evict(count = 1) {
    const requested = Number(count);

    if (!requested || requested <= 0) {
      return;
    }

    const items = [...this.#entriesAscending()];
    const evictCount = Math.trunc(
      Math.min(requested, Math.max(items.length - 1, 0))
    );

    if (evictCount <= 0) {
      return;
    }

    this.#emitEvictions(items.slice(0, evictCount));
    this.#oldCache = new Map(items.slice(evictCount));
    this.#cache = new Map();
  }

  expiresIn(key) {
    const item = this.#peekItem(key);

    if (item === undefined) {
      return undefined;
    }

    const expiresIn = item.expiry - Date.now();

    return expiresIn === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : expiresIn;
  }

  *entriesAscending() {
    for (const [key, item] of this.#entriesAscending()) {
      if (!isStale(item)) {
        yield [key, item.value];
      }
    }
  }

  *entriesDescending() {
    const items = [...this.#entriesAscending()];

    for (let index = items.length - 1; index >= 0; index--) {
      const [key, item] = items[index];

      if (!isStale(item)) {
        yield [key, item.value];
      }
    }
  }

  *keys() {
    for (const [key] of this.entriesAscending()) {
      yield key;
    }
  }

  *values() {
    for (const [, value] of this.entriesAscending()) {
      yield value;
    }
  }

  *entries() {
    yield* this.entriesAscending();
  }

  *[Symbol.iterator]() {
    yield* this.entriesAscending();
  }

  forEach(callback, thisArgument = this) {
    for (const [key, value] of this.entriesAscending()) {
      callback.call(thisArgument, value, key, this);
    }
  }

  get [Symbol.toStringTag]() {
    return 'Lru';
  }

  toString() {
    return `Lru(${this.size}/${this.#maxSize})`;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toString();
  }

  #getItemValue(key, item) {
    if (!this.#deleteIfStale(key, item)) {
      return item.value;
    }

    return undefined;
  }

  #setItem(key, item) {
    this.#cache.set(key, item);

    if (this.#cache.size >= this.#maxSize) {
      this.#rotate();
    }
  }

  #moveToRecent(key, item) {
    this.#oldCache.delete(key);
    this.#setItem(key, item);
  }

  #peekItem(key) {
    if (this.#cache.has(key)) {
      return this.#cache.get(key);
    }

    return this.#oldCache.get(key);
  }

  #rotate() {
    this.#emitEvictions(this.#oldCache);

    this.#oldCache = this.#cache;
    this.#cache = new Map();
  }

  #deleteIfStale(key, item) {
    if (!isStale(item)) {
      return false;
    }

    const deletedFromCache =
      this.#cache.get(key) === item && this.#cache.delete(key);
    const deletedFromOldCache =
      this.#oldCache.get(key) === item && this.#oldCache.delete(key);

    const deleted = deletedFromCache || deletedFromOldCache;

    if (deleted) {
      this.#emitEviction(key, item);
    }

    return deleted;
  }

  #emitEvictions(entries) {
    for (const [key, item] of entries) {
      this.#emitEviction(key, item);
    }
  }

  #emitEviction(key, item) {
    if (isCacheValue(item) && this.#onEviction) {
      this.#onEviction(key, item.value);
    }
  }

  *#entriesAscending() {
    const newerKeys = new Set(this.#cache.keys());

    for (const [key, item] of this.#oldCache) {
      if (!newerKeys.has(key) && !this.#deleteIfStale(key, item)) {
        yield [key, item];
      }
    }

    for (const [key, item] of this.#cache) {
      if (!this.#deleteIfStale(key, item)) {
        yield [key, item];
      }
    }
  }
}
