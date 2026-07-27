export const LEGACY_PUBLIC_DATA_CACHE = "investment-data";

export async function clearLegacyPublicDataCache(
  cacheStorage: Pick<CacheStorage, "delete"> | undefined =
    typeof caches === "undefined" ? undefined : caches,
) {
  if (!cacheStorage) return false;
  return cacheStorage.delete(LEGACY_PUBLIC_DATA_CACHE);
}
