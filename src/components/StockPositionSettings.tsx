import { useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { formatCurrency } from "../lib/format";
import { translate, type AppLanguage, type TranslationKey } from "../lib/i18n";
import { getAssetStrategySettings, getPositionSizePercent, getStrategyLevelValues, normalizeStrategySettings } from "../lib/settings";
import type { Asset, StrategySettings } from "../types";

interface StockPositionSettingsProps {
  assets: Asset[];
  settings: StrategySettings;
  language: AppLanguage;
  onChange: (sizes: Record<string, number>) => void;
}

export function StockPositionSettings({ assets, settings, language, onChange }: StockPositionSettingsProps) {
  const [ticker, setTicker] = useState("");
  const t = (key: TranslationKey) => translate(language, key);
  const normalized = normalizeStrategySettings(settings);
  const percent = ticker ? getPositionSizePercent(normalized, ticker) : 100;
  const customized = Object.keys(normalized.positionSizeByTicker).sort();
  const tickers = [...new Set([...assets.map((asset) => asset.ticker), ...customized])].sort();
  const assetNames = new Map(assets.map((asset) => [asset.ticker, asset.name]));
  const adjusted = getAssetStrategySettings(normalized, ticker);
  const baseLevels = getStrategyLevelValues(normalized);
  const levels = getStrategyLevelValues(adjusted);
  const rows: Array<[TranslationKey, number, number]> = [
    ["settings.minimumValue", normalized.minimumPositionValue, adjusted.minimumPositionValue],
    ["settings.maximumValue", normalized.maximumPositionValue, adjusted.maximumPositionValue],
    ["settings.sizing.moderate", baseLevels.moderateBuyPositionValue, levels.moderateBuyPositionValue],
    ["settings.sizing.strong", baseLevels.strongBuyPositionValue, levels.strongBuyPositionValue],
    ["settings.sizing.breakdown", baseLevels.breakdownBuyPositionValue, levels.breakdownBuyPositionValue],
    ["settings.sizing.initialSale", baseLevels.initialSellAmount, levels.initialSellAmount],
    ["settings.sizing.breakoutSale", baseLevels.breakoutSellAmount, levels.breakoutSellAmount],
    ["settings.minimumSale", normalized.minimumSaleAmount, adjusted.minimumSaleAmount],
  ];

  const update = (symbol: string, value: number) => {
    const sizes = { ...settings.positionSizeByTicker };
    if (value === 100) delete sizes[symbol];
    else sizes[symbol] = value;
    onChange(sizes);
  };

  return <section className="panel settings-panel settings-anchor stock-position-settings" id="settings-stock-position">
    <div className="panel__header"><div><h2><SlidersHorizontal size={19} /> {t("settings.sizing.title")}</h2><p>{t("settings.sizing.description")}</p></div></div>
    <label className="stock-position-settings__select"><span>{t("settings.sizing.asset")}</span>
      <select value={ticker} onChange={(event) => setTicker(event.target.value)}>
        <option value="">{t("settings.sizing.choose")}</option>
        {tickers.map((symbol) => <option key={symbol} value={symbol}>{symbol}{assetNames.get(symbol) ? ` · ${assetNames.get(symbol)}` : ""}</option>)}
      </select>
    </label>
    <p className="stock-position-settings__hint">{t("settings.sizing.explanation")}</p>
    {ticker && <>
      <div className="stock-position-settings__editor">
        <div className="stock-position-settings__weight"><label htmlFor="stock-position-percent">{t("settings.sizing.weight")} · {ticker}</label>
          <span><input id="stock-position-percent" type="number" min={10} max={500} step={1}
            value={settings.positionSizeByTicker?.[ticker] ?? 100}
            onChange={(event) => update(ticker, event.target.value === "" ? 100 : Number(event.target.value))}
            onBlur={() => update(ticker, percent)} /><b>%</b></span>
        </div>
        <input type="range" min={10} max={500} step={1} value={percent} aria-label={`${t("settings.sizing.weight")} ${ticker}`} onChange={(event) => update(ticker, Number(event.target.value))} />
        <div className="stock-position-settings__presets" role="group" aria-label={t("settings.sizing.weight")}>
          {[50, 100, 150, 200].map((value) => <button key={value} type="button" aria-pressed={percent === value} onClick={() => update(ticker, value)}>{value}%</button>)}
        </div>
        <p>{t("settings.sizing.scope")}</p>
      </div>
      <div className="table-wrap stock-position-settings__preview" role="region" aria-label={t("settings.sizing.preview")} tabIndex={0}>
        <table><caption>{t("settings.sizing.preview")} · {ticker} · {percent}%</caption>
          <thead><tr><th scope="col">{t("settings.sizing.rule")}</th><th scope="col">{t("settings.sizing.base")}</th><th scope="col">{t("settings.sizing.adjusted")}</th></tr></thead>
          <tbody>{rows.map(([label, base, value]) => <tr key={label}><th scope="row">{t(label)}</th><td><span className="privacy-value">{formatCurrency(base)}</span></td><td><strong className="privacy-value">{formatCurrency(value)}</strong></td></tr>)}</tbody>
        </table>
      </div>
      <button className="text-button stock-position-settings__reset" type="button" onClick={() => update(ticker, 100)}><RotateCcw size={14} />{t("settings.sizing.reset")}</button>
      <p className="stock-position-settings__hint">{t("settings.sizing.note")}</p>
    </>}
    <div className="stock-position-settings__customized">
      <h3>{t("settings.sizing.customized")}</h3>
      {customized.length ? <ul>{customized.map((symbol) => <li key={symbol}>
        <button type="button" aria-label={`${t("settings.sizing.edit")} ${symbol}`} onClick={() => setTicker(symbol)}><strong>{symbol}</strong><span>{getPositionSizePercent(normalized, symbol)}%</span></button>
        <button type="button" aria-label={`${t("settings.sizing.remove")} ${symbol}`} onClick={() => update(symbol, 100)}><RotateCcw size={15} /></button>
      </li>)}</ul> : <p>{t("settings.sizing.empty")}</p>}
    </div>
  </section>;
}
