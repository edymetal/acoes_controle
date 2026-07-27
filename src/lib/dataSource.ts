import { auth } from "../firebase";

const configuredBaseUrl = import.meta.env.VITE_DATA_BASE_URL?.trim().replace(/\/$/, "");

export const usesAuthenticatedBackend = Boolean(configuredBaseUrl);

function dataUrl(fileName: string) {
  if (!configuredBaseUrl) throw new Error("Backend autenticado não configurado.");
  return `${configuredBaseUrl}/${fileName}`;
}

export async function fetchDataFile(fileName: string, cacheBust = false, signal?: AbortSignal) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sessão autenticada indisponível.");
  const separator = dataUrl(fileName).includes("?") ? "&" : "?";
  const suffix = cacheBust ? `${separator}refresh=${Date.now()}` : "";
  const response = await fetch(`${dataUrl(fileName)}${suffix}`, {
    cache: "no-store",
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}
