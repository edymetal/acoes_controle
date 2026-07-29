import { describe, expect, it } from "vitest";
import {
  clearGoogleSheetsAccessSession,
  loadGoogleSheetsAccessSession,
  saveGoogleSheetsAccessSession,
} from "./googleSheetsAccessSession";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  };
}

describe("sessão do token da planilha", () => {
  it("restaura um token válido depois que a aplicação é recarregada", () => {
    const storage = createStorage();
    const access = { token: "token-temporario", expiresAt: 10_000 };

    saveGoogleSheetsAccessSession(access, storage);

    expect(loadGoogleSheetsAccessSession(storage, 5_000)).toEqual(access);
  });

  it("remove um token expirado", () => {
    const storage = createStorage();
    saveGoogleSheetsAccessSession({ token: "token-expirado", expiresAt: 5_000 }, storage);

    expect(loadGoogleSheetsAccessSession(storage, 5_000)).toBeNull();
    expect(storage.values.size).toBe(0);
  });

  it("descarta conteúdo malformado sem interromper a aplicação", () => {
    const storage = createStorage();
    storage.setItem("acoes-controle.google-sheets-access.v1", "{inválido");

    expect(loadGoogleSheetsAccessSession(storage, 1_000)).toBeNull();
    expect(storage.values.size).toBe(0);
  });

  it("descarta uma estrutura que não representa um token válido", () => {
    const storage = createStorage();
    storage.setItem("acoes-controle.google-sheets-access.v1", JSON.stringify({
      token: "",
      expiresAt: 10_000,
    }));

    expect(loadGoogleSheetsAccessSession(storage, 1_000)).toBeNull();
    expect(storage.values.size).toBe(0);
  });

  it("limpa explicitamente o token da sessão", () => {
    const storage = createStorage();
    saveGoogleSheetsAccessSession({ token: "token-temporario", expiresAt: 10_000 }, storage);

    clearGoogleSheetsAccessSession(storage);

    expect(loadGoogleSheetsAccessSession(storage, 1_000)).toBeNull();
  });

  it("continua funcionando quando o navegador bloqueia o armazenamento", () => {
    const storage = {
      getItem: () => { throw new DOMException("bloqueado"); },
      setItem: () => { throw new DOMException("bloqueado"); },
      removeItem: () => { throw new DOMException("bloqueado"); },
    };

    expect(() => saveGoogleSheetsAccessSession({ token: "token", expiresAt: 10_000 }, storage)).not.toThrow();
    expect(loadGoogleSheetsAccessSession(storage, 1_000)).toBeNull();
    expect(() => clearGoogleSheetsAccessSession(storage)).not.toThrow();
  });
});
