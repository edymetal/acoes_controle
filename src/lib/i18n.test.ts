import { describe, expect, it } from "vitest";
import { loadAppLanguage, translate } from "./i18n";

describe("i18n", () => {
  it("uses Brazilian Portuguese as the default language", () => {
    expect(loadAppLanguage()).toBe("pt-BR");
    expect(translate("pt-BR", "nav.settings")).toBe("Configurações");
  });

  it("provides the Italian navigation and settings translations", () => {
    expect(translate("it-IT", "nav.settings")).toBe("Impostazioni");
    expect(translate("it-IT", "settings.language.title")).toBe("Lingua dell'interfaccia");
    expect(translate("it-IT", "page.fixedIncomeLadder")).toBe("Scala delle scadenze");
  });
});
