import { createSign } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
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

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

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
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`Falha ao ler a planilha: ${message}`);
  }

  return response.json();
}

