import { useEffect, useState } from "react";
import { CheckCircle2, RotateCcw, Save, Settings2, Target, TrendingDown, TrendingUp } from "lucide-react";
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
  icon: React.ReactNode;
  onChange: (value: number) => void;
}

function SettingField({ label, description, value, min, icon, onChange }: SettingFieldProps) {
  return (
    <label className="setting-field">
      <span className="setting-field__icon">{icon}</span>
      <span className="setting-field__copy"><strong>{label}</strong><small>{description}</small></span>
      <span className="setting-field__input"><input type="number" min={min} max="25" step="0.5" value={value} onChange={(event) => onChange(Number(event.target.value))} /><b>%</b></span>
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
        <div><span className="eyebrow">PREFERÊNCIAS DA ESTRATÉGIA</span><h2>Ajuste como os sinais são calculados</h2><p>Os valores ficam salvos neste navegador e passam a valer imediatamente no Dashboard e na Estratégia anual.</p></div>
      </section>

      <section className="panel settings-panel">
        <div className="panel__header"><div><h2>Limites dos sinais</h2><p>Informe distâncias percentuais entre 0,5% e 25%.</p></div></div>
        <div className="settings-list">
          <SettingField label="Venda próxima da máxima" description="Gera venda quando a cotação estiver até esta distância abaixo da máxima anual." value={draft.sellDistanceFromHighPercent} min={0.5} icon={<Target size={20} />} onChange={(value) => update("sellDistanceFromHighPercent", value)} />
          <SettingField label="Compra abaixo da média" description="Exige esta distância mínima abaixo da média anual para gerar compra. Use 0% para qualquer valor abaixo da média." value={draft.buyDistanceBelowAveragePercent} min={0} icon={<TrendingDown size={20} />} onChange={(value) => update("buyDistanceBelowAveragePercent", value)} />
          <SettingField label="Rompimento forte" description="Classifica como forte quando a cotação superar a máxima anual por este percentual." value={draft.strongBreakoutAboveHighPercent} min={0.5} icon={<TrendingUp size={20} />} onChange={(value) => update("strongBreakoutAboveHighPercent", value)} />
        </div>
        <div className="settings-actions">
          <button className="settings-button settings-button--secondary" type="button" onClick={reset}><RotateCcw size={17} /> Restaurar padrões</button>
          {saved && <span className="settings-saved" role="status"><CheckCircle2 size={16} /> Configurações salvas</span>}
          <button className="settings-button settings-button--primary" type="button" onClick={save}><Save size={17} /> Salvar configurações</button>
        </div>
      </section>
    </div>
  );
}
