import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "./fetchRetry";

describe("fetchWithRetry", () => {
  it("repete respostas transitórias com backoff exponencial", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    const response = await fetchWithRetry("https://example.test", {}, {
      fetchImpl,
      sleepImpl,
      randomImpl: () => 0,
      baseDelayMs: 100,
      maxAttempts: 3,
    });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleepImpl).toHaveBeenNthCalledWith(1, 100);
    expect(sleepImpl).toHaveBeenNthCalledWith(2, 200);
  });

  it("não repete erros permanentes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 400 }));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    const response = await fetchWithRetry("https://example.test", {}, { fetchImpl, sleepImpl });

    expect(response.status).toBe(400);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).not.toHaveBeenCalled();
  });
});
