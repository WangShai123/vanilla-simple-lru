const defaultMaxAge = Number.POSITIVE_INFINITY;
const nodeInspectCustom: unique symbol = Symbol.for(
  'nodejs.util.inspect.custom'
) as never;

export type EvictionHandler<KeyType = unknown, ValueType = unknown> = (
  key: KeyType,
  value: ValueType
) => void;

type RequiredMaxSize = {
  maxSize: number;
  max?: number;
};

type RequiredLegacyMax = {
  max: number;
  maxSize?: number;
};

type LruCommonOptions<KeyType, ValueType> = {
  maxAge?: number;
  ttl?: number;
  onEviction?: EvictionHandler<KeyType, ValueType>;
};

export type LruOptions<KeyType = unknown, ValueType = unknown> = (
  | RequiredMaxSize
  | RequiredLegacyMax
) &
  LruCommonOptions<KeyType, ValueType>;

export type LruSetOptions = {
  maxAge?: number;
};

type LruOptionsShape<KeyType, ValueType> = Partial<
  RequiredMaxSize & RequiredLegacyMax & LruCommonOptions<KeyType, ValueType>
>;

type ResolvedOptions<KeyType, ValueType> = {
  maxSize: number;
  maxAge: number;
  onEviction?: EvictionHandler<KeyType, ValueType>;
};

type CacheItem<ValueType> = {
  value: ValueType;
  expiry: number;
};

const isCacheValue = <ValueType>(
  value: unknown
): value is CacheItem<ValueType> =>
  typeof value === 'object' &&
  value !== null &&
  Object.prototype.hasOwnProperty.call(value, 'value') &&
  Object.prototype.hasOwnProperty.call(value, 'expiry');

const normalizeMaxSize = (maxSize: unknown): number => {
  if (
    typeof maxSize !== 'number' ||
    !Number.isInteger(maxSize) ||
    maxSize < 1 ||
    !Number.isFinite(maxSize)
  ) {
    throw new TypeError('`maxSize` must be a positive integer.');
  }

  return maxSize;
};

const normalizeMaxAge = (maxAge: unknown): number => {
  if (typeof maxAge !== 'number' || Number.isNaN(maxAge) || maxAge <= 0) {
    throw new TypeError('`maxAge` must be a number greater than 0.');
  }

  return maxAge;
};

const resolveOptions = <KeyType, ValueType>(
  options: unknown = {}
): ResolvedOptions<KeyType, ValueType> => {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('Expected an options object.');
  }

  const typedOptions = options as LruOptionsShape<KeyType, ValueType>;
  const maxSize = typedOptions.maxSize ?? typedOptions.max;
  const maxAge = typedOptions.maxAge ?? typedOptions.ttl ?? defaultMaxAge;

  if (maxSize === undefined) {
    throw new TypeError('`maxSize` is required.');
  }

  return {
    maxSize: normalizeMaxSize(maxSize),
    maxAge: normalizeMaxAge(maxAge),
    onEviction: typedOptions.onEviction,
  };
};

const isStale = <ValueType>(item: CacheItem<ValueType>): boolean =>
  item.expiry <= Date.now();

const toCacheItem = <ValueType>(
  value: ValueType,
  maxAge = defaultMaxAge
): CacheItem<ValueType> => ({
  value,
  expiry:
    maxAge === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : Date.now() + maxAge,
});

export default class Lru<KeyType = unknown, ValueType = unknown> extends Map<
  KeyType,
  ValueType
> {
  #cache = new Map<KeyType, CacheItem<ValueType>>();
  #oldCache = new Map<KeyType, CacheItem<ValueType>>();
  #maxSize: number;
  #maxAge: number;
  #onEviction?: EvictionHandler<KeyType, ValueType>;

  constructor(options: LruOptions<KeyType, ValueType>) {
    super();

    const { maxSize, maxAge, onEviction } = resolveOptions<KeyType, ValueType>(
      options
    );

    if (onEviction !== undefined && typeof onEviction !== 'function') {
      throw new TypeError('`onEviction` must be a function.');
    }

    this.#maxSize = maxSize;
    this.#maxAge = maxAge;
    this.#onEviction = onEviction;
  }

  get maxSize(): number {
    return this.#maxSize;
  }

  get max(): number {
    return this.#maxSize;
  }

  get maxAge(): number {
    return this.#maxAge;
  }

  get ttl(): number {
    return this.#maxAge;
  }

  get size(): number {
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

  get(key: KeyType): ValueType | undefined {
    if (this.#cache.has(key)) {
      const item = this.#cache.get(key);

      if (item !== undefined) {
        return this.#getItemValue(key, item);
      }
    }

    if (this.#oldCache.has(key)) {
      const item = this.#oldCache.get(key);

      if (item !== undefined && !this.#deleteIfStale(key, item)) {
        this.#moveToRecent(key, item);
        return item.value;
      }
    }

    return undefined;
  }

  set(key: KeyType, value: ValueType, options: LruSetOptions = {}): this {
    const maxAge = normalizeMaxAge(options.maxAge ?? this.#maxAge);
    const item = toCacheItem(value, maxAge);

    if (this.#cache.has(key)) {
      this.#cache.set(key, item);
    } else {
      this.#setItem(key, item);
    }

    return this;
  }

  has(key: KeyType): boolean {
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

  peek(key: KeyType): ValueType | undefined {
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

  delete(key: KeyType): boolean {
    const deletedFromCache = this.#cache.delete(key);
    const deletedFromOldCache = this.#oldCache.delete(key);

    return deletedFromCache || deletedFromOldCache;
  }

  clear(): void {
    this.#cache.clear();
    this.#oldCache.clear();
  }

  resize(maxSize: number): void {
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

  evict(count = 1): void {
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

  expiresIn(key: KeyType): number | undefined {
    const item = this.#peekItem(key);

    if (item === undefined) {
      return undefined;
    }

    const expiresIn = item.expiry - Date.now();

    return expiresIn === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : expiresIn;
  }

  *entriesAscending(): IterableIterator<[KeyType, ValueType]> {
    for (const [key, item] of this.#entriesAscending()) {
      if (!isStale(item)) {
        yield [key, item.value];
      }
    }
  }

  *entriesDescending(): IterableIterator<[KeyType, ValueType]> {
    const items = [...this.#entriesAscending()];

    for (let index = items.length - 1; index >= 0; index--) {
      const [key, item] = items[index];

      if (!isStale(item)) {
        yield [key, item.value];
      }
    }
  }

  *keys(): IterableIterator<KeyType> {
    for (const [key] of this.entriesAscending()) {
      yield key;
    }
  }

  *values(): IterableIterator<ValueType> {
    for (const [, value] of this.entriesAscending()) {
      yield value;
    }
  }

  *entries(): IterableIterator<[KeyType, ValueType]> {
    yield* this.entriesAscending();
  }

  *[Symbol.iterator](): IterableIterator<[KeyType, ValueType]> {
    yield* this.entriesAscending();
  }

  forEach(
    callback: (value: ValueType, key: KeyType, cache: this) => void,
    thisArgument?: unknown
  ): void {
    for (const [key, value] of this.entriesAscending()) {
      callback.call(thisArgument, value, key, this);
    }
  }

  get [Symbol.toStringTag](): string {
    return 'Lru';
  }

  toString(): string {
    return `Lru(${this.size}/${this.#maxSize})`;
  }

  [nodeInspectCustom](): string {
    return this.toString();
  }

  #getItemValue(
    key: KeyType,
    item: CacheItem<ValueType>
  ): ValueType | undefined {
    if (!this.#deleteIfStale(key, item)) {
      return item.value;
    }

    return undefined;
  }

  #setItem(key: KeyType, item: CacheItem<ValueType>): void {
    this.#cache.set(key, item);

    if (this.#cache.size >= this.#maxSize) {
      this.#rotate();
    }
  }

  #moveToRecent(key: KeyType, item: CacheItem<ValueType>): void {
    this.#oldCache.delete(key);
    this.#setItem(key, item);
  }

  #peekItem(key: KeyType): CacheItem<ValueType> | undefined {
    if (this.#cache.has(key)) {
      return this.#cache.get(key);
    }

    return this.#oldCache.get(key);
  }

  #rotate(): void {
    this.#emitEvictions(this.#oldCache);

    this.#oldCache = this.#cache;
    this.#cache = new Map();
  }

  #deleteIfStale(key: KeyType, item: CacheItem<ValueType>): boolean {
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

  #emitEvictions(entries: Iterable<[KeyType, CacheItem<ValueType>]>): void {
    for (const [key, item] of entries) {
      this.#emitEviction(key, item);
    }
  }

  #emitEviction(key: KeyType, item: CacheItem<ValueType>): void {
    if (isCacheValue<ValueType>(item) && this.#onEviction) {
      this.#onEviction(key, item.value);
    }
  }

  *#entriesAscending(): IterableIterator<[KeyType, CacheItem<ValueType>]> {
    const newerKeys = new Set<KeyType>(this.#cache.keys());

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
