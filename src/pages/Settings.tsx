import { useEffect, useState } from "react";
import { Check, CheckCircle2, DollarSign, Languages, RotateCcw, Save, Settings2, Target, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { translate, type AppLanguage } from "../lib/i18n";
import { DEFAULT_STRATEGY_SETTINGS } from "../lib/settings";
import type { StrategySettings } from "../types";

interface SettingsProps {
  settings: StrategySettings;
  onSave: (settings: StrategySettings) => void;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
}

interface SettingFieldProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  icon: React.ReactNode;
  onChange: (value: number) => void;
}

function SettingField({ label, description, value, min, max, step = 0.5, suffix, icon, onChange }: SettingFieldProps) {
  return (
    <label className="setting-field">
      <span className="setting-field__icon">{icon}</span>
      <span className="setting-field__copy"><strong>{label}</strong><small>{description}</small></span>
      <span className="setting-field__input"><input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><b>{suffix}</b></span>
    </label>
  );
}

export function Settings({ settings, onSave, language, onLanguageChange }: SettingsProps) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  const update = (key: keyof StrategySettings, value: number) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    onSave(draft);
    setSaved(true);
  };

  const reset = () => {
    setDraft(DEFAULT_STRATEGY_SETTINGS);
    onSave(DEFAULT_STRATEGY_SETTINGS);
    setSaved(true);
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="page-stack">
      <section className="settings-hero">
        <span className="settings-hero__icon"><Settings2 size={25} /></span>
        <div><span className="eyebrow">{translate(language, "settings.eyebrow")}</span><h2>{translate(language, "settings.title")}</h2><p>{translate(language, "settings.description")}</p></div>
      </section>

      <nav className="panel settings-index" aria-label={translate(language, "settings.index.title")}>
        <div className="settings-index__header"><strong>{translate(language, "settings.index.title")}</strong><small>{translate(language, "settings.index.description")}</small></div>
        <div className="settings-index__items">
          <button type="button" onClick={() => scrollToSection("settings-language")}><Languages size={18} /><span>{translate(language, "settings.language.title")}</span></button>
          <button type="button" onClick={() => scrollToSection("settings-position")}><WalletCards size={18} /><span>{translate(language, "settings.position.title")}</span></button>
          <button type="button" onClick={() => scrollToSection("settings-sell")}><TrendingUp size={18} /><span>{translate(language, "settings.sell.title")}</span></button>
          <button type="button" onClick={() => scrollToSection("settings-buy")}><TrendingDown size={18} /><span>{translate(language, "settings.buy.title")}</span></button>
        </div>
      </nav>

      <div className="settings-topic-heading">
        <span className="settings-topic-heading__icon"><Settings2 size={20} /></span>
        <span><strong>{translate(language, "settings.group.general")}</strong><small>{translate(language, "settings.group.general.description")}</small></span>
      </div>

      <section className="panel settings-panel settings-anchor" id="settings-language">
        <div className="panel__header"><div><h2><Languages size={19} /> {translate(language, "settings.language.title")}</h2><p>{translate(language, "settings.language.description")}</p></div></div>
        <div className="language-options" role="radiogroup" aria-label={translate(language, "settings.language.title")}>
          {(["pt-BR", "it-IT"] as AppLanguage[]).map((option) => (
            <button className={language === option ? "active" : ""} type="button" role="radio" aria-checked={language === option} onClick={() => onLanguageChange(option)} key={option}>
              <span className="language-options__code">{option === "pt-BR" ? "PT" : "IT"}</span>
              <span><strong>{translate(language, option === "pt-BR" ? "settings.language.pt" : "settings.language.it")}</strong><small>{option}</small></span>
              {language === option && <Check size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
        <p className="settings-auto-save">{translate(language, "settings.language.saved")}</p>
      </section>

      <div className="settings-topic-heading">
        <span className="settings-topic-heading__icon"><WalletCards size={20} /></span>
        <span><strong>{translate(language, "settings.group.stocks")}</strong><small>{translate(language, "settings.group.stocks.description")}</small></span>
      </div>

      <section className="panel settings-panel settings-anchor" id="settings-position">
        <div className="panel__header"><div><h2>{translate(language, "settings.position.title")}</h2><p>{translate(language, "settings.position.description")}</p></div></div>
        <div className="settings-list settings-list--two">
          <SettingField label={translate(language, "settings.minimumValue")} description={translate(language, "settings.minimumValue.description")} value={draft.minimumPositionValue} min={1} max={10000} step={1} suffix="US$" icon={<WalletCards size={20} />} onChange={(value) => update("minimumPositionValue", value)} />
          <SettingField label={translate(language, "settings.maximumValue")} description={translate(language, "settings.maximumValue.description")} value={draft.maximumPositionValue} min={draft.minimumPositionValue} max={20000} step={1} suffix="US$" icon={<WalletCards size={20} />} onChange={(value) => update("maximumPositionValue", value)} />
        </div>
      </section>

      <section className="panel settings-panel settings-anchor" id="settings-sell">
        <div className="panel__header"><div><h2>{translate(language, "settings.sell.title")}</h2><p>{translate(language, "settings.sell.description")}</p></div></div>
        <div className="settings-list">
          <SettingField label={translate(language, "settings.highDistance")} description={translate(language, "settings.highDistance.description")} value={draft.sellDistanceFromHighPercent} min={0.5} max={25} suffix="%" icon={<Target size={20} />} onChange={(value) => update("sellDistanceFromHighPercent", value)} />
          <SettingField label={translate(language, "settings.firstShare")} description={translate(language, "settings.firstShare.description")} value={draft.initialSellPercent} min={0} max={100} step={1} suffix="%" icon={<TrendingUp size={20} />} onChange={(value) => update("initialSellPercent", value)} />
          <SettingField label={translate(language, "settings.breakoutShare")} description={translate(language, "settings.breakoutShare.description")} value={draft.breakoutSellPercent} min={0} max={100} step={1} suffix="%" icon={<TrendingUp size={20} />} onChange={(value) => update("breakoutSellPercent", value)} />
          <SettingField label={translate(language, "settings.minimumSale")} description={translate(language, "settings.minimumSale.description")} value={draft.minimumSaleAmount} min={0} max={10000} step={1} suffix="US$" icon={<DollarSign size={20} />} onChange={(value) => update("minimumSaleAmount", value)} />
        </div>
      </section>

      <section className="panel settings-panel settings-anchor" id="settings-buy">
        <div className="panel__header"><div><h2>{translate(language, "settings.buy.title")}</h2><p>{translate(language, "settings.buy.description")}</p></div></div>
        <div className="settings-list">
          <SettingField label={translate(language, "settings.upperLimit")} description={translate(language, "settings.upperLimit.description")} value={draft.buyZoneUpperPercent} min={1} max={100} suffix="%" icon={<TrendingDown size={20} />} onChange={(value) => update("buyZoneUpperPercent", value)} />
          <SettingField label={translate(language, "settings.middleLimit")} description={translate(language, "settings.middleLimit.description")} value={draft.buyZoneMiddlePercent} min={0} max={draft.buyZoneUpperPercent} suffix="%" icon={<TrendingDown size={20} />} onChange={(value) => update("buyZoneMiddlePercent", value)} />
          <SettingField label={translate(language, "settings.lowerLimit")} description={translate(language, "settings.lowerLimit.description")} value={draft.buyZoneLowerPercent} min={0} max={draft.buyZoneMiddlePercent} suffix="%" icon={<TrendingDown size={20} />} onChange={(value) => update("buyZoneLowerPercent", value)} />
          <SettingField label={translate(language, "settings.moderateBuy")} description={translate(language, "settings.moderateBuy.description")} value={draft.moderateBuyAmount} min={0} max={10000} step={1} suffix="US$" icon={<DollarSign size={20} />} onChange={(value) => update("moderateBuyAmount", value)} />
          <SettingField label={translate(language, "settings.strongBuy")} description={translate(language, "settings.strongBuy.description")} value={draft.strongBuyAmount} min={0} max={10000} step={1} suffix="US$" icon={<DollarSign size={20} />} onChange={(value) => update("strongBuyAmount", value)} />
          <SettingField label={translate(language, "settings.breakdownBuy")} description={translate(language, "settings.breakdownBuy.description")} value={draft.breakdownBuyAmount} min={0} max={10000} step={1} suffix="US$" icon={<DollarSign size={20} />} onChange={(value) => update("breakdownBuyAmount", value)} />
        </div>
      </section>

      <div className="settings-actions settings-actions--sticky">
        <button className="settings-button settings-button--secondary" type="button" onClick={reset}><RotateCcw size={17} /> {translate(language, "settings.restore")}</button>
        {saved && <span className="settings-saved" role="status"><CheckCircle2 size={16} /> {translate(language, "settings.saved")}</span>}
        <button className="settings-button settings-button--primary" type="button" onClick={save}><Save size={17} /> {translate(language, "settings.save")}</button>
      </div>
    </div>
  );
}
