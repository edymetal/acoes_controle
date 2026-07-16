import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bitcoin,
  BriefcaseBusiness,
  Building2,
  CalendarRange,
  ChevronDown,
  Clock3,
  Eye,
  EyeOff,
  LayoutDashboard,
  RefreshCw,
  Settings2,
  Sparkles,
  Landmark,
} from "lucide-react";
import { formatDateTime } from "../lib/format";
import { translate, type AppLanguage, type TranslationKey } from "../lib/i18n";
import packageJson from "../../package.json";

export type PageId = "overview" | "dashboard" | "portfolio" | "history" | "strategy" | "settings" | "fii-dashboard" | "fii-portfolio" | "fii-history" | "crypto-dashboard" | "crypto-portfolio" | "crypto-history" | "fixed-income-dashboard" | "fixed-income-portfolio" | "fixed-income-ladder";

type Topic = "overview" | "stocks" | "fiis" | "crypto" | "fixed-income" | "settings";
interface PageDefinition { id: PageId; labelKey: TranslationKey; descriptionKey: TranslationKey; icon: ReactNode; topic: Topic }

const overviewPage: PageDefinition = { id: "overview", labelKey: "nav.overview", descriptionKey: "nav.overview.description", icon: <LayoutDashboard size={19} />, topic: "overview" };

const stockPages: PageDefinition[] = [
  { id: "dashboard", labelKey: "page.dashboard", descriptionKey: "page.dashboard.description", icon: <LayoutDashboard size={19} />, topic: "stocks" },
  { id: "portfolio", labelKey: "page.portfolio", descriptionKey: "page.portfolio.description", icon: <BriefcaseBusiness size={19} />, topic: "stocks" },
  { id: "history", labelKey: "page.history", descriptionKey: "page.history.description", icon: <Clock3 size={19} />, topic: "stocks" },
  { id: "strategy", labelKey: "page.strategy", descriptionKey: "page.strategy.description", icon: <Sparkles size={19} />, topic: "stocks" },
];

const fiiPages: PageDefinition[] = [
  { id: "fii-dashboard", labelKey: "nav.overview", descriptionKey: "page.fiiOverview.description", icon: <LayoutDashboard size={19} />, topic: "fiis" },
  { id: "fii-portfolio", labelKey: "page.fiiPortfolio", descriptionKey: "page.fiiPortfolio.description", icon: <Building2 size={19} />, topic: "fiis" },
  { id: "fii-history", labelKey: "page.history", descriptionKey: "page.fiiHistory.description", icon: <Clock3 size={19} />, topic: "fiis" },
];

const cryptoPages: PageDefinition[] = [
  { id: "crypto-dashboard", labelKey: "nav.overview", descriptionKey: "page.cryptoOverview.description", icon: <LayoutDashboard size={19} />, topic: "crypto" },
  { id: "crypto-portfolio", labelKey: "page.cryptoPortfolio", descriptionKey: "page.cryptoPortfolio.description", icon: <Bitcoin size={19} />, topic: "crypto" },
  { id: "crypto-history", labelKey: "page.history", descriptionKey: "page.cryptoHistory.description", icon: <Clock3 size={19} />, topic: "crypto" },
];

const fixedIncomePages: PageDefinition[] = [
  { id: "fixed-income-dashboard", labelKey: "nav.overview", descriptionKey: "page.fixedIncomeOverview.description", icon: <LayoutDashboard size={19} />, topic: "fixed-income" },
  { id: "fixed-income-portfolio", labelKey: "page.fixedIncomePortfolio", descriptionKey: "page.fixedIncomePortfolio.description", icon: <Landmark size={19} />, topic: "fixed-income" },
  { id: "fixed-income-ladder", labelKey: "page.fixedIncomeLadder", descriptionKey: "page.fixedIncomeLadder.description", icon: <CalendarRange size={19} />, topic: "fixed-income" },
];

const settingsPage: PageDefinition = { id: "settings", labelKey: "nav.settings", descriptionKey: "nav.settings.description", icon: <Settings2 size={19} />, topic: "settings" };
const pages = [overviewPage, ...stockPages, ...fiiPages, ...cryptoPages, ...fixedIncomePages, settingsPage];

interface ShellProps {
  page: PageId;
  onPageChange: (page: PageId) => void;
  updatedAt: string;
  isRefreshing: boolean;
  refreshMessage: { kind: "success" | "warning" | "error"; text: string } | null;
  onRefresh: () => void;
  language: AppLanguage;
  children: ReactNode;
}

const PRIVACY_CREDENTIAL_KEY = "acoes-controle.privacy-credential";

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function encodeCredentialId(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeCredentialId(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function supportsDeviceAuthentication() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && Boolean(navigator.credentials);
}

export function Shell({ page, onPageChange, updatedAt, isRefreshing, refreshMessage, onRefresh, language, children }: ShellProps) {
  const current = pages.find((item) => item.id === page) ?? pages[0];
  const currentTopic = current.topic;
  const [openTopic, setOpenTopic] = useState<Topic | null>(currentTopic === "overview" || currentTopic === "settings" ? null : currentTopic);
  const [privacyCredential, setPrivacyCredential] = useState(() => localStorage.getItem(PRIVACY_CREDENTIAL_KEY));
  const [isPrivacyLocked, setIsPrivacyLocked] = useState(() => Boolean(localStorage.getItem(PRIVACY_CREDENTIAL_KEY)));
  const [privacyMessage, setPrivacyMessage] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (currentTopic === "overview" || currentTopic === "settings") setOpenTopic(null);
    else setOpenTopic(currentTopic);
  }, [currentTopic]);

  const lockValues = async () => {
    setPrivacyMessage(null);
    if (privacyCredential) {
      setIsPrivacyLocked(true);
      return;
    }
    if (!supportsDeviceAuthentication()) {
      setPrivacyMessage("Este navegador não oferece autenticação por biometria ou PIN do dispositivo.");
      return;
    }

    setIsAuthenticating(true);
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: randomBytes(32),
          rp: { name: "Controle de Investimentos" },
          user: { id: randomBytes(16), name: "investimentos", displayName: "Controle de Investimentos" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", userVerification: "required" },
          timeout: 60_000,
          attestation: "none",
        },
      });
      if (!credential) throw new Error("Cadastro não concluído.");
      const credentialId = encodeCredentialId((credential as PublicKeyCredential).rawId);
      localStorage.setItem(PRIVACY_CREDENTIAL_KEY, credentialId);
      setPrivacyCredential(credentialId);
      setIsPrivacyLocked(true);
      setPrivacyMessage("Proteção ativada. Para ver os valores novamente, confirme sua identidade no celular.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") setPrivacyMessage("A autenticação foi cancelada ou não foi autorizada no dispositivo.");
      else setPrivacyMessage("Não foi possível ativar a proteção neste dispositivo.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const unlockValues = async () => {
    if (!privacyCredential || !supportsDeviceAuthentication()) return;
    setIsAuthenticating(true);
    setPrivacyMessage(null);
    try {
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: randomBytes(32),
          allowCredentials: [{ type: "public-key", id: decodeCredentialId(privacyCredential) }],
          userVerification: "required",
          timeout: 60_000,
        },
      });
      if (!credential) throw new Error("Autenticação não concluída.");
      setIsPrivacyLocked(false);
    } catch {
      setPrivacyMessage("Não foi possível confirmar sua identidade. Tente novamente.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const renderTopic = (topic: Topic, labelKey: TranslationKey, topicPages: PageDefinition[]) => {
    const isOpen = openTopic === topic;
    const panelId = `nav-topic-${topic}`;

    return (
      <div className={`main-nav__group ${isOpen ? "main-nav__group--open" : ""}`}>
        <button
          type="button"
          className="main-nav__topic"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => {
            setOpenTopic(topic);
            onPageChange(topicPages[0].id);
          }}
        >
          <span>{translate(language, labelKey)}</span><ChevronDown size={17} aria-hidden="true" />
        </button>
        {isOpen && (
          <div className="main-nav__pages" id={panelId}>
            {topicPages.map((item) => (
              <button
                type="button"
                key={item.id}
                className={page === item.id ? "active" : ""}
                aria-current={page === item.id ? "page" : undefined}
                onClick={() => onPageChange(item.id)}
              >
                {item.icon}<span>{translate(language, item.labelKey)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark"><BarChart3 size={23} /></span>
          <span><strong>Controle</strong><small>{translate(language, "brand.subtitle")}</small><span className="brand__version">v{packageJson.version}</span></span>
        </div>
        <div className="sidebar__mobile-actions">
          <button type="button" onClick={isPrivacyLocked ? unlockValues : lockValues} disabled={isAuthenticating} aria-label={translate(language, isPrivacyLocked ? "privacy.show" : "privacy.hide")} title={translate(language, isPrivacyLocked ? "privacy.show" : "privacy.hide")}>{isPrivacyLocked ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          <button type="button" onClick={onRefresh} disabled={isRefreshing} aria-label={translate(language, "refresh.action")} title={translate(language, "refresh.action")}><RefreshCw className={isRefreshing ? "spin" : undefined} size={17} /></button>
        </div>
        <nav className="main-nav" aria-label={translate(language, "nav.aria")}>
          <button
            type="button"
            className={`main-nav__overview ${page === "overview" ? "active" : ""}`}
            aria-current={page === "overview" ? "page" : undefined}
            onClick={() => onPageChange("overview")}
          >
            {overviewPage.icon}<span>{translate(language, overviewPage.labelKey)}</span>
          </button>
          {renderTopic("stocks", "nav.stocks", stockPages)}
          {renderTopic("fiis", "nav.fiis", fiiPages)}
          {renderTopic("crypto", "nav.crypto", cryptoPages)}
          {renderTopic("fixed-income", "nav.fixedIncome", fixedIncomePages)}
          <button
            type="button"
            className={`main-nav__settings ${page === "settings" ? "active" : ""}`}
            aria-current={page === "settings" ? "page" : undefined}
            onClick={() => onPageChange("settings")}
          >
            {settingsPage.icon}<span>{translate(language, settingsPage.labelKey)}</span>
          </button>
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar__title">
            <span className="eyebrow"><Activity size={14} /> {translate(language, current.topic === "overview" ? "eyebrow.all" : current.topic === "fiis" ? "eyebrow.fiis" : current.topic === "crypto" ? "eyebrow.crypto" : current.topic === "fixed-income" ? "eyebrow.fixedIncome" : current.topic === "settings" ? "eyebrow.settings" : "eyebrow.stocks")}</span>
            <h1>{translate(language, current.labelKey)}</h1>
            <p>{translate(language, current.descriptionKey)}</p>
          </div>
          <div className="sync-status">
            <span className="sync-status__dot" aria-hidden="true" />
            <span><small>{translate(language, "sync.updated")}</small><strong>{formatDateTime(updatedAt)}</strong></span>
            <button type="button" onClick={isPrivacyLocked ? unlockValues : lockValues} disabled={isAuthenticating} aria-label={translate(language, isPrivacyLocked ? "privacy.show" : "privacy.hide")} title={translate(language, isPrivacyLocked ? "privacy.show" : "privacy.hide")}>{isPrivacyLocked ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            <button type="button" onClick={onRefresh} disabled={isRefreshing} aria-label={translate(language, "refresh.action")} title={translate(language, "refresh.action")}><RefreshCw className={isRefreshing ? "spin" : undefined} size={17} /></button>
          </div>
        </header>
        {refreshMessage && <div className={`refresh-message refresh-message--${refreshMessage.kind}`} role="status">{refreshMessage.text}</div>}
        <main className={`content ${isPrivacyLocked ? "content--protected" : ""}`}>
          {privacyMessage && <div className="privacy-notice" role="status">{privacyMessage}</div>}
          {children}
        </main>
      </div>
    </div>
  );
}
