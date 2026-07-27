import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "./google-sheets-client.mjs";

describe("Google Sheets fetchWithRetry", () => {
  it("recupera uma leitura após falha HTTP 503", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    const response = await fetchWithRetry("https://sheets.googleapis.test", {}, {
      fetchImpl,
      sleepImpl,
      randomImpl: () => 0,
      baseDelayMs: 50,
      maxAttempts: 2,
    });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledWith(50);
  });
});
