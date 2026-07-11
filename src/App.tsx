import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, LoaderCircle, RotateCcw } from "lucide-react";
import { Shell, type PageId } from "./components/Shell";
import { calculatePortfolio } from "./lib/portfolio";
import type { PortfolioData } from "./types";

const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const Portfolio = lazy(() => import("./pages/Portfolio").then((module) => ({ default: module.Portfolio })));
const History = lazy(() => import("./pages/History").then((module) => ({ default: module.History })));
const Strategy = lazy(() => import("./pages/Strategy").then((module) => ({ default: module.Strategy })));

const validPages: PageId[] = ["dashboard", "portfolio", "history", "strategy"];

function initialPage(): PageId {
  const hash = window.location.hash.replace("#", "") as PageId;
  return validPages.includes(hash) ? hash : "dashboard";
}

export default function App() {
  const [page, setPage] = useState<PageId>(initialPage);
  const [data, setData] = useState<PortfolioData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const model = useMemo(() => data ? calculatePortfolio(data) : null, [data]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/portfolio.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<PortfolioData>;
      })
      .then((payload) => {
        if (payload.schemaVersion !== 1 || !Array.isArray(payload.assets)) {
          throw new Error("O arquivo de dados está em um formato incompatível.");
        }
        setData(payload);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar os dados.");
      });
    return () => controller.abort();
  }, []);

  const navigate = (nextPage: PageId) => {
    setPage(nextPage);
    window.location.hash = nextPage;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (error) {
    return (
      <main className="state-screen">
        <div className="brand brand--center"><span className="brand__mark"><BarChart3 size={23} /></span><span><strong>Controle</strong><small>de Ações</small></span></div>
        <div className="state-screen__card state-screen__card--error"><AlertTriangle size={34} /><h1>Dados indisponíveis</h1><p>O painel não conseguiu carregar a base sincronizada.</p><code>{error}</code><button type="button" onClick={() => window.location.reload()}><RotateCcw size={17} /> Tentar novamente</button></div>
      </main>
    );
  }

  if (!data || !model) {
    return <main className="state-screen"><div className="loader-mark"><LoaderCircle size={34} /><span>Preparando sua carteira…</span></div></main>;
  }

  return (
    <Shell page={page} onPageChange={navigate} updatedAt={data.generatedAt}>
      <Suspense fallback={<div className="page-loader"><LoaderCircle size={24} /> Carregando painel…</div>}>
        {page === "dashboard" && <Dashboard data={data} model={model} onNavigate={navigate} />}
        {page === "portfolio" && <Portfolio model={model} />}
        {page === "history" && <History model={model} />}
        {page === "strategy" && <Strategy data={data} />}
      </Suspense>
    </Shell>
  );
}
