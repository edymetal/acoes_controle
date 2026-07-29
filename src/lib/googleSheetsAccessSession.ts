export type GoogleSheetsAccess = {
  token: string;
  expiresAt: number;
};

type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY = "acoes-controle.google-sheets-access.v1";

function browserSessionStorage(): SessionStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function removeStoredAccess(storage: SessionStorage) {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // O navegador pode bloquear o armazenamento em modos de privacidade restritos.
  }
}

function isValidAccess(value: unknown, now: number): value is GoogleSheetsAccess {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GoogleSheetsAccess>;
  return typeof candidate.token === "string"
    && candidate.token.trim().length > 0
    && typeof candidate.expiresAt === "number"
    && Number.isFinite(candidate.expiresAt)
    && candidate.expiresAt > now;
}

export function loadGoogleSheetsAccessSession(
  storage: SessionStorage | null = browserSessionStorage(),
  now = Date.now(),
) {
  if (!storage) return null;
  try {
    const serialized = storage.getItem(STORAGE_KEY);
    if (!serialized) return null;
    const access: unknown = JSON.parse(serialized);
    if (isValidAccess(access, now)) return access;
  } catch {
    // Uma sessão inválida ou inacessível deve apenas exigir nova autorização.
  }
  removeStoredAccess(storage);
  return null;
}

export function saveGoogleSheetsAccessSession(
  access: GoogleSheetsAccess,
  storage: SessionStorage | null = browserSessionStorage(),
) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(access));
  } catch {
    // A aplicação continua funcional em memória quando o armazenamento não está disponível.
  }
}

export function clearGoogleSheetsAccessSession(
  storage: SessionStorage | null = browserSessionStorage(),
) {
  if (storage) removeStoredAccess(storage);
}
