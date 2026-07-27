import { describe, expect, it, vi } from "vitest";
import { clearLegacyPublicDataCache, LEGACY_PUBLIC_DATA_CACHE } from "./legacyDataCache";

describe("clearLegacyPublicDataCache", () => {
  it("remove o cache que armazenava os JSONs públicos", async () => {
    const deleteCache = vi.fn().mockResolvedValue(true);

    await expect(clearLegacyPublicDataCache({ delete: deleteCache })).resolves.toBe(true);
    expect(deleteCache).toHaveBeenCalledWith(LEGACY_PUBLIC_DATA_CACHE);
  });

  it("não falha quando Cache Storage não está disponível", async () => {
    await expect(clearLegacyPublicDataCache(undefined)).resolves.toBe(false);
  });
});
