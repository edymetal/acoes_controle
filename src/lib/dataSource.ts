import { auth } from "../firebase";

const configuredBaseUrl = import.meta.env.VITE_DATA_BASE_URL?.trim().replace(/\/$/, "");

export const usesPublicStaticData = !configuredBaseUrl;

function dataUrl(fileName: string) {
  return configuredBaseUrl
    ? `${configuredBaseUrl}/${fileName}`
    : `${import.meta.env.BASE_URL}data/${fileName}`;
}

export async function fetchDataFile(fileName: string, cacheBust = false, signal?: AbortSignal) {
  const token = configuredBaseUrl ? await auth.currentUser?.getIdToken() : null;
  const separator = dataUrl(fileName).includes("?") ? "&" : "?";
  const suffix = cacheBust ? `${separator}refresh=${Date.now()}` : "";
  const response = await fetch(`${dataUrl(fileName)}${suffix}`, {
    cache: "no-store",
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}
