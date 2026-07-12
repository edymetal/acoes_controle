export function FixedIncomeYearSelector({ years, value, onChange }: { years: number[]; value: number; onChange: (year: number) => void }) {
  return <div className="segmented-control fixed-income-year-selector" role="group" aria-label="Selecionar ano da renda fixa">
    {years.map((year) => <button type="button" className={value === year ? "active" : ""} onClick={() => onChange(year)} key={year}>{year}</button>)}
  </div>;
}
