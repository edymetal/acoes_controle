import { useEffect, useState } from "react";
import { CheckCircle2, DollarSign, RotateCcw, Save, Settings2, Target, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { DEFAULT_STRATEGY_SETTINGS } from "../lib/settings";
import type { StrategySettings } from "../types";

interface SettingsProps {
  settings: StrategySettings;
  onSave: (settings: StrategySettings) => void;
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

export function Settings({ settings, onSave }: SettingsProps) {
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

  return (
    <div className="page-stack">
      <section className="settings-hero">
        <span className="settings-hero__icon"><Settings2 size={25} /></span>
        <div><span className="eyebrow">PREFERÊNCIAS DA ESTRATÉGIA</span><h2>Valores e percentuais em um só lugar</h2><p>As alterações ficam salvas neste navegador e passam a valer no Dashboard e no Radar de 12 meses.</p></div>
      </section>

      <section className="panel settings-panel">
        <div className="panel__header"><div><h2>Faixa de valor por ação</h2><p>Compras e vendas são limitadas para manter cada posição dentro deste intervalo.</p></div></div>
        <div className="settings-list settings-list--two">
          <SettingField label="Valor mínimo" description="Piso que uma venda nunca poderá ultrapassar." value={draft.minimumPositionValue} min={1} max={10000} step={1} suffix="US$" icon={<WalletCards size={20} />} onChange={(value) => update("minimumPositionValue", value)} />
          <SettingField label="Valor máximo" description="Teto usado para limitar cada nova compra." value={draft.maximumPositionValue} min={draft.minimumPositionValue} max={20000} step={1} suffix="US$" icon={<WalletCards size={20} />} onChange={(value) => update("maximumPositionValue", value)} />
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel__header"><div><h2>Regras de venda</h2><p>Primeira realização próxima da máxima e parcela final após o rompimento.</p></div></div>
        <div className="settings-list">
          <SettingField label="Distância da máxima" description="Inicia o sinal quando faltar até este percentual para a máxima anual." value={draft.sellDistanceFromHighPercent} min={0.5} max={25} suffix="%" icon={<Target size={20} />} onChange={(value) => update("sellDistanceFromHighPercent", value)} />
          <SettingField label="Primeira parcela" description="Percentual da faixa negociável indicado antes de atingir a máxima." value={draft.initialSellPercent} min={0} max={100} step={1} suffix="%" icon={<TrendingUp size={20} />} onChange={(value) => update("initialSellPercent", value)} />
          <SettingField label="Parcela no rompimento" description="Percentual da faixa negociável indicado após romper a máxima anual." value={draft.breakoutSellPercent} min={0} max={100} step={1} suffix="%" icon={<TrendingUp size={20} />} onChange={(value) => update("breakoutSellPercent", value)} />
          <SettingField label="Venda mínima" description="Só exibe valor para venda quando a operação atingir este total." value={draft.minimumSaleAmount} min={0} max={10000} step={1} suffix="US$" icon={<DollarSign size={20} />} onChange={(value) => update("minimumSaleAmount", value)} />
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel__header"><div><h2>Regras de compra</h2><p>Percentuais representam a posição da cotação entre a mínima (0%) e a máxima (100%) dos últimos 12 meses.</p></div></div>
        <div className="settings-list">
          <SettingField label="Limite superior da primeira faixa" description="Padrão: compra entre 20% e 35% do intervalo anual." value={draft.buyZoneUpperPercent} min={1} max={100} suffix="%" icon={<TrendingDown size={20} />} onChange={(value) => update("buyZoneUpperPercent", value)} />
          <SettingField label="Divisão entre as faixas" description="Fim da compra forte e início da primeira faixa." value={draft.buyZoneMiddlePercent} min={0} max={draft.buyZoneUpperPercent} suffix="%" icon={<TrendingDown size={20} />} onChange={(value) => update("buyZoneMiddlePercent", value)} />
          <SettingField label="Limite inferior da compra forte" description="Padrão: compra forte entre 10% e 20% do intervalo anual." value={draft.buyZoneLowerPercent} min={0} max={draft.buyZoneMiddlePercent} suffix="%" icon={<TrendingDown size={20} />} onChange={(value) => update("buyZoneLowerPercent", value)} />
          <SettingField label="Compra na primeira faixa" description="Valor sugerido quando a cotação estiver na faixa superior de compra." value={draft.moderateBuyAmount} min={0} max={10000} step={1} suffix="US$" icon={<DollarSign size={20} />} onChange={(value) => update("moderateBuyAmount", value)} />
          <SettingField label="Compra forte" description="Valor sugerido quando a cotação estiver na faixa mais baixa." value={draft.strongBuyAmount} min={0} max={10000} step={1} suffix="US$" icon={<DollarSign size={20} />} onChange={(value) => update("strongBuyAmount", value)} />
          <SettingField label="Compra abaixo da mínima" description="Valor sugerido quando a cotação romper a mínima anual." value={draft.breakdownBuyAmount} min={0} max={10000} step={1} suffix="US$" icon={<DollarSign size={20} />} onChange={(value) => update("breakdownBuyAmount", value)} />
        </div>
      </section>

      <div className="settings-actions settings-actions--sticky">
        <button className="settings-button settings-button--secondary" type="button" onClick={reset}><RotateCcw size={17} /> Restaurar padrões</button>
        {saved && <span className="settings-saved" role="status"><CheckCircle2 size={16} /> Configurações salvas</span>}
        <button className="settings-button settings-button--primary" type="button" onClick={save}><Save size={17} /> Salvar configurações</button>
      </div>
    </div>
  );
}
