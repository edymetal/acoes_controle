import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, KeyRound, LoaderCircle, RotateCcw } from "lucide-react";
import { Shell, type PageId } from "./components/Shell";
import { calculatePortfolio } from "./lib/portfolio";
import { calculateFiiPortfolio } from "./lib/fiiPortfolio";
import { calculateCryptoPortfolio } from "./lib/cryptoPortfolio";
import { calculateFixedIncome } from "./lib/fixedIncome";
import { fetchDataFile, usesAuthenticatedBackend } from "./lib/dataSource";
import { parseCryptoData, parseFiiData, parseFixedIncomeData, parsePortfolioData } from "./lib/dataValidation";
import { loadStrategySettings, saveStrategySettings } from "./lib/settings";
import { loadAppLanguage, saveAppLanguage } from "./lib/i18n";
import {
  isGoogleSheetsAuthorizationError,
  syncSpreadsheetData,
  type SpreadsheetSyncResult,
} from "./lib/sheetSync";
import { clearGoogleSheetsAccessToken, getGoogleSheetsAccessToken, hasGoogleSheetsAccessToken } from "./firebase";
import { describeGoogleAuthorizationError } from "./lib/googleAuthError";
import { loadEvolutionHistory } from "./lib/evolutionSync";
import type { CryptoData, EvolutionHistoryData, FiiData, FixedIncomeData, PortfolioData, StrategySettings } from "./types";

const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const Overview = lazy(() => import("./pages/Overview").then((module) => ({ default: module.Overview })));
const Evolution = lazy(() => import("./pages/Evolution").then((module) => ({ default: module.Evolution })));
const Portfolio = lazy(() => import("./pages/Portfolio").then((module) => ({ default: module.Portfolio })));
const History = lazy(() => import("./pages/History").then((module) => ({ default: module.History })));
const Strategy = lazy(() => import("./pages/Strategy").then((module) => ({ default: module.Strategy })));
const Settings = lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings })));
const FiiDashboard = lazy(() => import("./pages/fiis/FiiDashboard").then((module) => ({ default: module.FiiDashboard })));
const FiiPortfolio = lazy(() => import("./pages/fiis/FiiPortfolio").then((module) => ({ default: module.FiiPortfolio })));
const FiiHistory = lazy(() => import("./pages/fiis/FiiHistory").then((module) => ({ default: module.FiiHistory })));
const CryptoDashboard = lazy(() => import("./pages/crypto/CryptoDashboard").then((module) => ({ default: module.CryptoDashboard })));
const CryptoPortfolio = lazy(() => import("./pages/crypto/CryptoPortfolio").then((module) => ({ default: module.CryptoPortfolio })));
const CryptoHistory = lazy(() => import("./pages/crypto/CryptoHistory").then((module) => ({ default: module.CryptoHistory })));
const FixedIncomeDashboard = lazy(() => import("./pages/fixed-income/FixedIncomeDashboard").then((module) => ({ default: module.FixedIncomeDashboard })));
const FixedIncomePortfolio = lazy(() => import("./pages/fixed-income/FixedIncomePortfolio").then((module) => ({ default: module.FixedIncomePortfolio })));
const FixedIncomeLadder = lazy(() => import("./pages/fixed-income/FixedIncomeLadder").then((module) => ({ default: module.FixedIncomeLadder })));

const validPages: PageId[] = ["overview", "evolution", "dashboard", "portfolio", "history", "strategy", "settings", "fii-dashboard", "fii-portfolio", "fii-history", "crypto-dashboard", "crypto-portfolio", "crypto-history", "fixed-income-dashboard", "fixed-income-portfolio", "fixed-income-ladder"];
type RefreshMessage = { kind: "success" | "warning" | "error"; text: string };

async function fetchPortfolio(cacheBust = false, signal?: AbortSignal) {
  return parsePortfolioData(await fetchDataFile("portfolio.json", cacheBust, signal));
}

async function fetchFiis(cacheBust = false, signal?: AbortSignal) {
  return parseFiiData(await fetchDataFile("fiis.json", cacheBust, signal));
}

async function fetchCrypto(cacheBust = false, signal?: AbortSignal) {
  return parseCryptoData(await fetchDataFile("crypto.json", cacheBust, signal));
}

async function fetchFixedIncome(cacheBust = false, signal?: AbortSignal) {
  return parseFixedIncomeData(await fetchDataFile("fixed-income.json", cacheBust, signal));
}

function initialPage(): PageId {
  const hash = window.location.hash.replace("#", "") as PageId;
  return validPages.includes(hash) ? hash : "overview";
}

export default function App() {
  const [page, setPage] = useState<PageId>(initialPage);
  const [data, setData] = useState<PortfolioData | null>(null);
  const [fiiData, setFiiData] = useState<FiiData | null>(null);
  const [fiiError, setFiiError] = useState<string | null>(null);
  const [cryptoData, setCryptoData] = useState<CryptoData | null>(null);
  const [cryptoError, setCryptoError] = useState<string | null>(null);
  const [fixedIncomeData, setFixedIncomeData] = useState<FixedIncomeData | null>(null);
  const [fixedIncomeError, setFixedIncomeError] = useState<string | null>(null);
  const [evolutionData, setEvolutionData] = useState<EvolutionHistoryData | null>(null);
  const [evolutionError, setEvolutionError] = useState<string | null>(null);
  const [isEvolutionLoading, setIsEvolutionLoading] = useState(false);
  const [evolutionReload, setEvolutionReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [needsSheetAuthorization, setNeedsSheetAuthorization] = useState(false);
  const [sheetAuthorizationError, setSheetAuthorizationError] = useState<string | null>(null);
  const [isAuthorizingSheet, setIsAuthorizingSheet] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<RefreshMessage | null>(null);
  const [settings, setSettings] = useState(loadStrategySettings);
  const [language, setLanguage] = useState(loadAppLanguage);
  const model = useMemo(() => data ? calculatePortfolio(data) : null, [data]);
  const fiiModel = useMemo(() => fiiData ? calculateFiiPortfolio(fiiData) : null, [fiiData]);
  const cryptoModel = useMemo(() => cryptoData ? calculateCryptoPortfolio(cryptoData) : null, [cryptoData]);
  const fixedIncomeModel = useMemo(() => fixedIncomeData ? calculateFixedIncome(fixedIncomeData) : null, [fixedIncomeData]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (page !== "evolution") return;
    const controller = new AbortController();
    setIsEvolutionLoading(true);
    setEvolutionError(null);
    loadEvolutionHistory(controller.signal)
      .then((history) => {
        setEvolutionData(history);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setEvolutionError(reason instanceof Error ? reason.message : "Não foi possível carregar o histórico.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsEvolutionLoading(false);
      });
    return () => controller.abort();
  }, [page, data?.generatedAt, evolutionReload]);

  const applySpreadsheetData = (synchronized: SpreadsheetSyncResult) => {
    setData(synchronized.portfolio);
    setFiiData(synchronized.fiis);
    setFiiError(null);
    setCryptoData(synchronized.crypto);
    setCryptoError(null);
    setFixedIncomeData(synchronized.fixedIncome);
    setFixedIncomeError(null);
    setError(null);
    setNeedsSheetAuthorization(false);
    setSheetAuthorizationError(null);
  };

  useEffect(() => {
    const controller = new AbortController();
    if (!usesAuthenticatedBackend) {
      if (!hasGoogleSheetsAccessToken()) {
        setNeedsSheetAuthorization(true);
        return () => controller.abort();
      }

      getGoogleSheetsAccessToken()
        .then((accessToken) => syncSpreadsheetData(accessToken, null, controller.signal))
        .then(applySpreadsheetData)
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === "AbortError") return;
          if (isGoogleSheetsAuthorizationError(reason)) clearGoogleSheetsAccessToken();
          setSheetAuthorizationError(describeGoogleAuthorizationError(reason));
          setNeedsSheetAuthorization(true);
        });
      return () => controller.abort();
    }

    fetchPortfolio(false, controller.signal)
      .then((payload) => {
        setData(payload);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar os dados.");
      });
    fetchFiis(false, controller.signal)
      .then((payload) => {
        setFiiData(payload);
        setFiiError(null);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setFiiError(reason instanceof Error ? reason.message : "Não foi possível carregar os FIIs.");
      });
    fetchCrypto(false, controller.signal)
      .then((payload) => {
        setCryptoData(payload);
        setCryptoError(null);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setCryptoError(reason instanceof Error ? reason.message : "Não foi possível carregar as criptos.");
      });
    fetchFixedIncome(false, controller.signal)
      .then((payload) => {
        setFixedIncomeData(payload);
        setFixedIncomeError(null);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setFixedIncomeError(reason instanceof Error ? reason.message : "Não foi possível carregar a renda fixa.");
      });
    return () => controller.abort();
  }, []);

  const authorizePrivateSheet = async () => {
    setIsAuthorizingSheet(true);
    setSheetAuthorizationError(null);
    try {
      const accessToken = await getGoogleSheetsAccessToken();
      const synchronized = await syncSpreadsheetData(accessToken, data);
      applySpreadsheetData(synchronized);
    } catch (reason) {
      if (isGoogleSheetsAuthorizationError(reason)) clearGoogleSheetsAccessToken();
      setSheetAuthorizationError(describeGoogleAuthorizationError(reason));
      setNeedsSheetAuthorization(true);
    } finally {
      setIsAuthorizingSheet(false);
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);

    if (!usesAuthenticatedBackend) {
      if (!data) {
        setRefreshMessage({ kind: "error", text: "A base atual ainda não terminou de carregar." });
        setIsRefreshing(false);
        return;
      }
      try {
        const accessToken = await getGoogleSheetsAccessToken();
        const synchronized = await syncSpreadsheetData(accessToken, data);
        applySpreadsheetData(synchronized);
        const hasSheetWarnings = synchronized.portfolio.integrity.warnings.length > 0
          || synchronized.fiis.integrity.warnings.length > 0
          || synchronized.crypto.integrity.warnings.length > 0
          || synchronized.fixedIncome.integrity.warnings.length > 0;
        setRefreshMessage(hasSheetWarnings
          ? { kind: "warning", text: "Planilha sincronizada agora, mas alguns registros possuem avisos de validação." }
          : { kind: "success", text: "Planilha sincronizada agora com sucesso." });
      } catch (reason) {
        if (isGoogleSheetsAuthorizationError(reason)) clearGoogleSheetsAccessToken();
        const detail = describeGoogleAuthorizationError(reason);
        setRefreshMessage({ kind: "error", text: `Não foi possível sincronizar a planilha agora. ${detail}` });
      } finally {
        setIsRefreshing(false);
      }
      return;
    }

    try {
      const [stockResult, fiiResult, cryptoResult, fixedIncomeResult] = await Promise.allSettled([fetchPortfolio(true), fetchFiis(true), fetchCrypto(true), fetchFixedIncome(true)]);
      if (stockResult.status === "fulfilled") setData(stockResult.value);
      if (fiiResult.status === "fulfilled") {
        setFiiData(fiiResult.value);
        setFiiError(null);
      }
      if (cryptoResult.status === "fulfilled") {
        setCryptoData(cryptoResult.value);
        setCryptoError(null);
      }
      if (fixedIncomeResult.status === "fulfilled") {
        setFixedIncomeData(fixedIncomeResult.value);
        setFixedIncomeError(null);
      }
      if (stockResult.status === "rejected" && fiiResult.status === "rejected" && cryptoResult.status === "rejected" && fixedIncomeResult.status === "rejected") throw new Error("Falha ao atualizar as bases.");
      const hasSheetWarnings = (stockResult.status === "fulfilled" && stockResult.value.integrity.warnings.length > 0)
        || (fiiResult.status === "fulfilled" && fiiResult.value.integrity.warnings.length > 0)
        || (cryptoResult.status === "fulfilled" && cryptoResult.value.integrity.warnings.length > 0)
        || (fixedIncomeResult.status === "fulfilled" && fixedIncomeResult.value.integrity.warnings.length > 0)
        || stockResult.status === "rejected"
        || fiiResult.status === "rejected"
        || cryptoResult.status === "rejected"
        || fixedIncomeResult.status === "rejected";
      setRefreshMessage(hasSheetWarnings
        ? { kind: "warning", text: "Nem todas as bases publicadas puderam ser recarregadas. Os últimos dados válidos foram mantidos." }
        : { kind: "success", text: "Dados publicados recarregados com sucesso." });
    } catch {
      setRefreshMessage({ kind: "error", text: "Não foi possível recarregar os dados publicados. Os dados exibidos foram mantidos." });
    } finally {
      setIsRefreshing(false);
    }
  };

  const navigate = (nextPage: PageId) => {
    setPage(nextPage);
    window.location.hash = nextPage;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateSettings = (nextSettings: StrategySettings) => {
    setSettings(saveStrategySettings(nextSettings));
  };

  const updateLanguage = (nextLanguage: typeof language) => {
    setLanguage(saveAppLanguage(nextLanguage));
  };

  if (error) {
    return (
      <main className="state-screen">
        <div className="brand brand--center"><span className="brand__mark"><BarChart3 size={23} /></span><span><strong>Controle</strong><small>de Ações</small></span></div>
        <div className="state-screen__card state-screen__card--error"><AlertTriangle size={34} /><h1>Dados indisponíveis</h1><p>O painel não conseguiu carregar a base sincronizada.</p><code>{error}</code><button type="button" onClick={() => window.location.reload()}><RotateCcw size={17} /> Tentar novamente</button></div>
      </main>
    );
  }

  if (needsSheetAuthorization && !data) {
    return (
      <main className="state-screen">
        <div className="brand brand--center"><span className="brand__mark"><BarChart3 size={23} /></span><span><strong>Controle</strong><small>de Ações</small></span></div>
        <div className="state-screen__card state-screen__card--private">
          <KeyRound size={34} />
          <h1>Carregar dados privados</h1>
          <p>Autorize a leitura da planilha com sua conta Google. Os dados serão carregados somente nesta sessão e não fazem parte do site publicado.</p>
          {sheetAuthorizationError && <code>{sheetAuthorizationError}</code>}
          <button type="button" onClick={authorizePrivateSheet} disabled={isAuthorizingSheet}>
            {isAuthorizingSheet ? <LoaderCircle className="spin" size={17} /> : <KeyRound size={17} />}
            {isAuthorizingSheet ? "Carregando dados…" : "Autorizar planilha"}
          </button>
        </div>
      </main>
    );
  }

  if (!data || !model) {
    return <main className="state-screen"><div className="loader-mark"><LoaderCircle size={34} /><span>Carregando dados privados…</span></div></main>;
  }

  return (
    <Shell page={page} onPageChange={navigate} updatedAt={page.startsWith("fii-") ? fiiData?.generatedAt ?? data.generatedAt : page.startsWith("crypto-") ? cryptoData?.generatedAt ?? data.generatedAt : page.startsWith("fixed-income-") ? fixedIncomeData?.generatedAt ?? data.generatedAt : data.generatedAt} isRefreshing={isRefreshing} refreshMessage={refreshMessage} onRefresh={refreshData} language={language}>
      <Suspense fallback={<div className="page-loader"><LoaderCircle size={24} /> Carregando painel…</div>}>
        {page === "overview" && <Overview stockModel={model} fiiModel={fiiModel} cryptoModel={cryptoModel} fixedIncomeModel={fixedIncomeModel} brlPerUsd={fiiData?.exchangeRate.brlPerUsd ?? fixedIncomeData?.exchangeRate.brlPerUsd ?? null} errors={{ fiis: fiiError, crypto: cryptoError, fixedIncome: fixedIncomeError }} onNavigate={navigate} />}
        {page === "evolution" && <Evolution history={evolutionData} stocks={data} fiis={fiiData} crypto={cryptoData} fixedIncome={fixedIncomeData} brlPerUsd={fiiData?.exchangeRate.brlPerUsd ?? fixedIncomeData?.exchangeRate.brlPerUsd ?? null} isLoading={isEvolutionLoading} error={evolutionError} onRetry={() => setEvolutionReload((value) => value + 1)} />}
        {page === "dashboard" && <Dashboard data={data} model={model} settings={settings} onNavigate={navigate} />}
        {page === "portfolio" && <Portfolio model={model} />}
        {page === "history" && <History model={model} />}
        {page === "strategy" && <Strategy data={data} model={model} settings={settings} />}
        {page === "settings" && <Settings settings={settings} onSave={updateSettings} language={language} onLanguageChange={updateLanguage} />}
        {page === "fii-dashboard" && fiiModel && <FiiDashboard model={fiiModel} usdRate={fiiData?.exchangeRate.brlPerUsd ?? null} onNavigate={navigate} />}
        {page === "fii-portfolio" && fiiModel && <FiiPortfolio model={fiiModel} usdRate={fiiData?.exchangeRate.brlPerUsd ?? null} />}
        {page === "fii-history" && fiiModel && <FiiHistory model={fiiModel} usdRate={fiiData?.exchangeRate.brlPerUsd ?? null} />}
        {page.startsWith("fii-") && !fiiModel && (
          <div className="state-screen__card state-screen__card--error state-screen__card--inline">
            {fiiError ? <><AlertTriangle size={30} /><h2>Dados de FIIs indisponíveis</h2><p>O módulo de ações continua disponível normalmente.</p><code>{fiiError}</code></> : <><LoaderCircle className="spin" size={30} /><h2>Carregando FIIs…</h2></>}
          </div>
        )}
        {page === "crypto-dashboard" && cryptoModel && <CryptoDashboard model={cryptoModel} onNavigate={navigate} />}
        {page === "crypto-portfolio" && cryptoModel && <CryptoPortfolio model={cryptoModel} />}
        {page === "crypto-history" && cryptoModel && <CryptoHistory model={cryptoModel} />}
        {page.startsWith("crypto-") && !cryptoModel && (
          <div className="state-screen__card state-screen__card--error state-screen__card--inline">
            {cryptoError ? <><AlertTriangle size={30} /><h2>Dados de cripto indisponíveis</h2><p>Os módulos de ações e FIIs continuam disponíveis normalmente.</p><code>{cryptoError}</code></> : <><LoaderCircle className="spin" size={30} /><h2>Carregando criptos…</h2></>}
          </div>
        )}
        {page === "fixed-income-dashboard" && fixedIncomeModel && <FixedIncomeDashboard model={fixedIncomeModel} usdRate={fixedIncomeData?.exchangeRate.brlPerUsd ?? null} onNavigate={navigate} />}
        {page === "fixed-income-portfolio" && fixedIncomeModel && <FixedIncomePortfolio model={fixedIncomeModel} usdRate={fixedIncomeData?.exchangeRate.brlPerUsd ?? null} />}
        {page === "fixed-income-ladder" && fixedIncomeModel && <FixedIncomeLadder model={fixedIncomeModel} usdRate={fixedIncomeData?.exchangeRate.brlPerUsd ?? null} />}
        {page.startsWith("fixed-income-") && !fixedIncomeModel && (
          <div className="state-screen__card state-screen__card--error state-screen__card--inline">
            {fixedIncomeError ? <><AlertTriangle size={30} /><h2>Dados de renda fixa indisponíveis</h2><p>Os demais módulos continuam disponíveis normalmente.</p><code>{fixedIncomeError}</code></> : <><LoaderCircle className="spin" size={30} /><h2>Carregando renda fixa…</h2></>}
          </div>
        )}
      </Suspense>
    </Shell>
  );
}
