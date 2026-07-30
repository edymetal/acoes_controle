import { getGoogleSheetsAccessToken } from "../firebase";
import { parseEvolutionHistoryData } from "./dataValidation";
import { fetchDataFile, usesAuthenticatedBackend } from "./dataSource";
import {
  buildEvolutionHistoryData,
  EVOLUTION_RANGE,
  type EvolutionSheetRow,
} from "./evolutionHistory";
import { fetchWithRetry } from "./fetchRetry";

const SPREADSHEET_ID = "1cdPXA3O0DoSfOILOpc7GZjWHI7tHnhgRH9aMXdU-_F0";
interface ValueRange { values?: EvolutionSheetRow[] }

export async function syncEvolutionHistory(accessToken: string, signal?: AbortSignal) {
  const search = new URLSearchParams({
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const response = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(EVOLUTION_RANGE)}?${search}`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    },
    { maxAttempts: 3, timeoutMs: 60_000 },
  );
  if (!response.ok) {
    if (response.status === 400) return buildEvolutionHistoryData([]);
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
    const message = payload.error?.message ?? `HTTP ${response.status}`;
    throw Object.assign(new Error(`Falha ao ler o histórico da planilha: ${message}`), {
      status: response.status,
    });
  }
  const payload = await response.json() as ValueRange;
  return buildEvolutionHistoryData(payload.values ?? []);
}

export async function loadEvolutionHistory(signal?: AbortSignal) {
  if (usesAuthenticatedBackend) {
    try {
      return parseEvolutionHistoryData(await fetchDataFile("evolution.json", false, signal));
    } catch (reason) {
      if (reason instanceof Error && reason.message === "HTTP 404") return buildEvolutionHistoryData([]);
      throw reason;
    }
  }
  const accessToken = await getGoogleSheetsAccessToken();
  return syncEvolutionHistory(accessToken, signal);
}
