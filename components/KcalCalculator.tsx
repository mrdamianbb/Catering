"use client";

import { useState } from "react";
import { Icon } from "./icons";

type Sex = "k" | "m";
type Goal = "redukcja" | "utrzymanie" | "masa";

const ACTIVITY = [
  { id: "siedzacy", label: "Siedzący", hint: "praca biurowa, bez treningów", factor: 1.2 },
  { id: "lekki", label: "Lekko aktywny", hint: "1–2 treningi w tygodniu", factor: 1.375 },
  { id: "sredni", label: "Aktywny", hint: "3–5 treningów w tygodniu", factor: 1.55 },
  { id: "wysoki", label: "Bardzo aktywny", hint: "6+ treningów lub praca fizyczna", factor: 1.725 }
] as const;

const GOALS: { id: Goal; label: string; adjust: number }[] = [
  { id: "redukcja", label: "Redukcja", adjust: -0.15 },
  { id: "utrzymanie", label: "Utrzymanie", adjust: 0 },
  { id: "masa", label: "Budowa masy", adjust: 0.1 }
];

function bmrMifflin(sex: Sex, kg: number, cm: number, age: number) {
  const base = 10 * kg + 6.25 * cm - 5 * age;
  return sex === "m" ? base + 5 : base - 161;
}

export function KcalCalculator({ options, onPick }: { options: number[]; onPick: (kcal: number) => void }) {
  const [open, setOpen] = useState(false);
  const [sex, setSex] = useState<Sex>("k");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState<string>("lekki");
  const [goal, setGoal] = useState<Goal>("utrzymanie");
  const [result, setResult] = useState<{ target: number; suggested: number; floored: boolean } | null>(null);
  const [error, setError] = useState("");

  function calculate() {
    const a = Number(age), h = Number(height), w = Number(weight);

    if (!Number.isFinite(a) || a < 18 || a > 100) {
      setResult(null);
      setError(a && a < 18
        ? "Kalkulator jest przeznaczony dla osób pełnoletnich. Dla młodszych zapotrzebowanie powinien ustalić dietetyk."
        : "Podaj wiek między 18 a 100 lat.");
      return;
    }
    if (!Number.isFinite(h) || h < 130 || h > 220) { setResult(null); setError("Podaj wzrost w centymetrach (130–220)."); return; }
    if (!Number.isFinite(w) || w < 35 || w > 250) { setResult(null); setError("Podaj wagę w kilogramach (35–250)."); return; }

    setError("");
    const factor = ACTIVITY.find(x => x.id === activity)?.factor ?? 1.375;
    const bmr = bmrMifflin(sex, w, h, a);
    const tdee = bmr * factor;
    const adjust = GOALS.find(g => g.id === goal)?.adjust ?? 0;

    // Nigdy poniżej podstawowej przemiany materii — dolna granica bezpieczeństwa.
    const raw = tdee * (1 + adjust);
    const floored = raw < bmr;
    const target = Math.round(Math.max(raw, bmr));

    const suggested = options.reduce((best, o) =>
      Math.abs(o - target) < Math.abs(best - target) ? o : best, options[0]);

    setResult({ target, suggested, floored });
  }

  if (!open) {
    return (
      <div className="kcalHint">
        <span className="kcalHintIcon"><Icon name="calculator" size={26}/></span>
        <div className="kcalHintCopy">
          <b>Nie wiesz, ile kcal wybrać?</b>
          <span>Oblicz swoje zapotrzebowanie i dobierz wariant diety.</span>
        </div>
        <button type="button" className="ghostBtn" onClick={() => setOpen(true)}>Oblicz</button>
      </div>
    );
  }

  return (
    <div className="kcalCalc">
      <div className="kcalCalcHead">
        <b><Icon name="calculator" size={20}/> Kalkulator zapotrzebowania</b>
        <button type="button" className="kcalClose" onClick={() => setOpen(false)} aria-label="Zamknij kalkulator">Zamknij</button>
      </div>

      <div className="kcalRow">
        <div className="kcalField">
          <span className="kcalLabel">Płeć</span>
          <div className="kcalToggle">
            <button type="button" className={sex === "k" ? "on" : ""} onClick={() => setSex("k")}>Kobieta</button>
            <button type="button" className={sex === "m" ? "on" : ""} onClick={() => setSex("m")}>Mężczyzna</button>
          </div>
        </div>
        <label className="kcalField">Wiek
          <input type="number" inputMode="numeric" min={18} max={100} value={age} onChange={e => setAge(e.target.value)} placeholder="lata"/>
        </label>
        <label className="kcalField">Wzrost
          <input type="number" inputMode="numeric" min={130} max={220} value={height} onChange={e => setHeight(e.target.value)} placeholder="cm"/>
        </label>
        <label className="kcalField">Waga
          <input type="number" inputMode="numeric" min={35} max={250} value={weight} onChange={e => setWeight(e.target.value)} placeholder="kg"/>
        </label>
      </div>

      <div className="kcalField">
        <span className="kcalLabel">Aktywność</span>
        <div className="kcalOptions">
          {ACTIVITY.map(a => (
            <button type="button" key={a.id} className={`kcalOption ${activity === a.id ? "on" : ""}`} onClick={() => setActivity(a.id)}>
              <b>{a.label}</b><span>{a.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="kcalField">
        <span className="kcalLabel">Cel</span>
        <div className="kcalOptions kcalGoals">
          {GOALS.map(g => (
            <button type="button" key={g.id} className={`kcalOption ${goal === g.id ? "on" : ""}`} onClick={() => setGoal(g.id)}>
              <b>{g.label}</b>
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="redBtn kcalSubmit" onClick={calculate}>Oblicz zapotrzebowanie</button>

      {error && <p className="kcalError">{error}</p>}

      {result && (
        <div className="kcalResult">
          <div className="kcalResultMain">
            <span>Twoje szacowane zapotrzebowanie</span>
            <b>{result.target} kcal</b>
          </div>
          {result.floored && (
            <p className="kcalNote">
              Wynik zatrzymaliśmy na poziomie Twojej podstawowej przemiany materii. Głębszy deficyt przy takich parametrach
              nie jest bezpieczny bez opieki specjalisty.
            </p>
          )}
          <div className="kcalPick">
            <span>Najbliższy dostępny wariant: <b>{result.suggested} kcal</b></span>
            <button type="button" className="ghostBtn" onClick={() => { onPick(result.suggested); setOpen(false); }}>
              Ustaw ten wariant
            </button>
          </div>
          <p className="kcalDisclaimer">
            To orientacyjne wyliczenie oparte na wzorze Mifflina-St Jeora. Rzeczywiste zapotrzebowanie zależy od wielu
            czynników. Jeśli chorujesz, jesteś w ciąży, karmisz piersią lub przyjmujesz leki, ustal kaloryczność
            z lekarzem lub dietetykiem.
          </p>
        </div>
      )}
    </div>
  );
}
