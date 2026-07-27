const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

type Sleep = (delayMs: number) => Promise<void>;

export interface FetchRetryOptions {
  maxAttempts?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: Sleep;
  randomImpl?: () => number;
}

const sleep: Sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

function retryAfterMs(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

function backoffMs(
  attempt: number,
  response: Response | null,
  baseDelayMs: number,
  maxDelayMs: number,
  randomImpl: () => number,
) {
  const exponential = baseDelayMs * (2 ** Math.max(0, attempt - 1));
  const withJitter = Math.min(maxDelayMs, exponential + Math.floor(randomImpl() * 1_000));
  return Math.min(maxDelayMs, Math.max(withJitter, response ? retryAfterMs(response) : 0));
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchRetryOptions = {},
) {
  const {
    maxAttempts = 3,
    timeoutMs = 60_000,
    baseDelayMs = 1_000,
    maxDelayMs = 16_000,
    fetchImpl = fetch,
    sleepImpl = sleep,
    randomImpl = Math.random,
  } = options;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts deve ser um inteiro maior que zero.");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const callerSignal = init.signal;
    const abortFromCaller = () => controller.abort(callerSignal?.reason);
    if (callerSignal?.aborted) abortFromCaller();
    else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = setTimeout(() => controller.abort(new Error("Tempo limite da requisição excedido.")), timeoutMs);
    let retryResponse: Response | null = null;

    try {
      const response = await fetchImpl(input, { ...init, signal: controller.signal });
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === maxAttempts) return response;
      retryResponse = response;
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      if (callerSignal?.aborted || attempt === maxAttempts) throw error;
    } finally {
      clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }

    await sleepImpl(backoffMs(attempt, retryResponse, baseDelayMs, maxDelayMs, randomImpl));
  }

  throw new Error("Falha inesperada ao repetir a requisição.");
}
