import { createSign } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

function retryAfterMs(response) {
  const value = response.headers.get("retry-after");
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

export async function fetchWithRetry(url, init = {}, options = {}) {
  const {
    maxAttempts = 3,
    timeoutMs = 90_000,
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
    const timeout = setTimeout(() => controller.abort(new Error("Tempo limite da requisição excedido.")), timeoutMs);
    let retryResponse = null;

    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === maxAttempts) return response;
      retryResponse = response;
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      if (attempt === maxAttempts) throw error;
    } finally {
      clearTimeout(timeout);
    }

    const exponential = baseDelayMs * (2 ** Math.max(0, attempt - 1));
    const withJitter = Math.min(maxDelayMs, exponential + Math.floor(randomImpl() * 1_000));
    const delayMs = Math.min(maxDelayMs, Math.max(withJitter, retryResponse ? retryAfterMs(retryResponse) : 0));
    await sleepImpl(delayMs);
  }

  throw new Error("Falha inesperada ao repetir a requisição.");
}

async function findLocalCredential() {
  const authDirectory = path.resolve("auth");
  const entries = await readdir(authDirectory);
  const credentialFile = entries.find((entry) => entry.endsWith(".json"));

  if (!credentialFile) {
    throw new Error("Nenhuma credencial JSON foi encontrada na pasta auth/.");
  }

  return path.join(authDirectory, credentialFile);
}

export async function loadCredential() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }

  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : await findLocalCredential();

  return JSON.parse(await readFile(credentialPath, "utf8"));
}

async function createAccessToken(credential) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      iss: credential.client_email,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(credential.private_key, "base64url");
  const assertion = `${unsignedToken}.${signature}`;

  const response = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  }, { timeoutMs: 30_000 });

  if (!response.ok) {
    throw new Error(`Falha na autenticação do Google (${response.status}).`);
  }

  const token = await response.json();
  return token.access_token;
}

export async function batchGetValues({
  spreadsheetId,
  ranges,
  valueRenderOption = "FORMATTED_VALUE",
  dateTimeRenderOption = "FORMATTED_STRING",
}) {
  const credential = await loadCredential();
  const accessToken = await createAccessToken(credential);
  const search = new URLSearchParams({ valueRenderOption, dateTimeRenderOption });

  for (const range of ranges) {
    search.append("ranges", range);
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${search}`;
  const response = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, { timeoutMs: 90_000 });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`Falha ao ler a planilha: ${message}`);
  }

  return response.json();
}
