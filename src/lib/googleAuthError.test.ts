import { describe, expect, it } from "vitest";
import { describeGoogleAuthorizationError } from "./googleAuthError";

describe("describeGoogleAuthorizationError", () => {
  it("traduz falhas de rede do Firebase sem exibir o código técnico", () => {
    expect(describeGoogleAuthorizationError({
      code: "auth/network-request-failed",
      message: "Firebase: Error (auth/network-request-failed).",
    })).toBe("Falha de conexão com o Google. Verifique a internet e tente novamente.");
  });

  it("orienta quando a janela do Google foi bloqueada", () => {
    expect(describeGoogleAuthorizationError({
      code: "auth/popup-blocked",
    })).toContain("Permita pop-ups");
  });

  it("preserva mensagens próprias da aplicação", () => {
    expect(describeGoogleAuthorizationError(new Error("Use a conta autorizada.")))
      .toBe("Use a conta autorizada.");
  });
});
