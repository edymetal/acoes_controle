import { describe, expect, it } from "vitest";
import { describeGoogleIdentityPopupError, describeGoogleTokenError } from "./googleIdentity";

describe("Google Identity Services", () => {
  it("traduz bloqueio do popup para o código já tratado pela interface", () => {
    const error = describeGoogleIdentityPopupError("popup_failed_to_open") as Error & { code?: string };

    expect(error.code).toBe("auth/popup-blocked");
    expect(error.message).toContain("Permita pop-ups");
  });

  it("traduz o fechamento antecipado da autorização", () => {
    const error = describeGoogleIdentityPopupError("popup_closed") as Error & { code?: string };

    expect(error.code).toBe("auth/popup-closed-by-user");
    expect(error.message).toContain("fechada antes de terminar");
  });

  it("mantém uma mensagem controlada para erros futuros da biblioteca", () => {
    expect(describeGoogleIdentityPopupError("unknown").message)
      .toBe("Não foi possível abrir a autorização do Google. Tente novamente.");
  });

  it("explica quando o usuário não concede o acesso solicitado", () => {
    expect(describeGoogleTokenError("access_denied").message)
      .toContain("não foi concedida");
  });

  it("traduz configuração inválida de origem para o código tratado pela interface", () => {
    const error = describeGoogleTokenError("origin_mismatch") as Error & { code?: string };

    expect(error.code).toBe("auth/unauthorized-domain");
    expect(error.message).toContain("cliente OAuth");
  });
});
