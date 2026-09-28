"use client";

import { useMemo, useState } from "react";
import { detectRestrictions } from "@/lib/allergens";

/**
 * Kaczorek — asystent panelu.
 *
 * Liczy wyłącznie z danych, które panel już ma wczytane. Nie pyta modelu
 * językowego, więc nie kosztuje, nie wymaga klucza i nigdy nie zmyśli liczby.
 * Rozumie tylko to, co ma wpisane niżej — i mówi wprost, gdy czegoś nie wie.
 */

type Odp = { tytul: string; linie: string[]; uwaga?: string };

const norm = (v: string) =>
  String(v ?? "").toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function iso(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const pl = (i: string) => new Intl.DateTimeFormat("pl-PL").format(new Date(i + "T12:00:00"));
const dniTyg = ["nd", "pn", "wt", "sr", "cz", "pt", "so"];

function jedzieWDniu(d: any, date: string) {
  if (d?.archived) return false;
  if (d.start_date > date || d.end_date < date) return false;
  const js = new Date(date + "T12:00:00").getDay();
  const dow = js === 0 ? 7 : js;              // panel zapisuje niedzielę jako 7, JS jako 0
  const lista = d.delivery_weekdays;
  if (Array.isArray(lista) && lista.length) return lista.includes(dow) || lista.includes(js) || lista.includes(dniTyg[js]);
  return true;
}

export function Kaczorek({ diets, clients, storeOrders, dietPrices }: {
  diets: any[]; clients: any[]; storeOrders: any[]; dietPrices: Record<number, number>;
}) {
  const [otwarty, setOtwarty] = useState(false);
  const [pytanie, setPytanie] = useState("");
  const [odp, setOdp] = useState<Odp | null>(null);

  const aktywne = useMemo(() => diets.filter(d => !d.archived), [diets]);

  function naDzien(date: string) {
    return aktywne.filter(d => jedzieWDniu(d, date));
  }

  function odpowiedz(q: string): Odp {
    const n = norm(q);
    const dzis = iso(0), jutro = iso(1);

    // ── Wykluczenia i alergie ──
    if (/alerg|wykluc|uczul|nie je|nietoler|bez |diet.*bez/.test(n)) {
      const dzien = /dzis|dzisiaj/.test(n) ? dzis : jutro;
      const lista = naDzien(dzien)
        .map(d => ({ d, f: detectRestrictions(d.diet_name, d.notes, d.clients?.kitchen_notes) }))
        .filter(x => x.f.length);
      if (!lista.length) return { tytul: `Wykluczenia na ${pl(dzien)}`, linie: ["Nikt nie ma zgłoszonych wykluczeń."] };
      return {
        tytul: `Wykluczenia na ${pl(dzien)} — ${lista.length} os.`,
        linie: lista.map(x => `${x.d.client_name} · ${x.f.join(" / ")}`),
        uwaga: "Sprawdź też pole „Zgłoszenie klienta” przy pozycji — klient mógł wpisać coś własnymi słowami."
      };
    }

    // ── Kończące się diety ──
    if (/koncz|konca|koniec|wygasa|przedluz|odnow|zostal|ostatni dzien/.test(n)) {
      const za7 = iso(7);
      const lista = aktywne.filter(d => d.end_date >= dzis && d.end_date <= za7)
        .sort((a, b) => a.end_date.localeCompare(b.end_date));
      if (!lista.length) return { tytul: "Kończące się diety", linie: ["W najbliższym tygodniu nic się nie kończy."] };
      return {
        tytul: `Kończą się w ciągu 7 dni — ${lista.length}`,
        linie: lista.map(d => `${pl(d.end_date)} · ${d.client_name} · ${d.diet_name} ${d.kcal} kcal`),
        uwaga: "Zadzwoń dzień wcześniej. Przedłużenie jest tańsze niż pozyskanie nowego klienta."
      };
    }

    // ── Nowe zamówienia ──
    if (/zamowien|sklep|nowe|nowy klient|czeka/.test(n)) {
      const nowe = (storeOrders || []).filter(o => o.status === "new");
      if (!nowe.length) return { tytul: "Zamówienia ze strony", linie: ["Brak nowych zamówień."] };
      return {
        tytul: `Nowe zamówienia — ${nowe.length}`,
        linie: nowe.map(o => `${o.customer_name} · ${o.diet_name} ${o.kcal} kcal · ${o.days} dni · start ${pl(o.start_date)}`)
      };
    }

    // ── Trasy ──
    if (/tras|kurier|dowoz|dostaw|rozwoz|jedzie/.test(n)) {
      const dzien = /jutro/.test(n) ? jutro : dzis;
      const lista = naDzien(dzien);
      const wg: Record<string, number> = {};
      for (const d of lista) wg[d.route_code || "—"] = (wg[d.route_code || "—"] || 0) + 1;
      const bezAdresu = lista.filter(d => !d.clients?.street_address).length;
      return {
        tytul: `Trasy na ${pl(dzien)} — ${lista.length} dostaw`,
        linie: Object.entries(wg).sort().map(([t, n2]) => `Trasa ${t}: ${n2} ${n2 === 1 ? "dostawa" : "dostaw"}`),
        uwaga: bezAdresu ? `Uwaga: ${bezAdresu} poz. bez adresu — kurier ich nie znajdzie.` : undefined
      };
    }

    // ── Pieniądze ──
    if (/zarob|przychod|utarg|kasa|pienia|zloty|zl\b|ile wyjdzie|obrot/.test(n)) {
      const dzien = /jutro/.test(n) ? jutro : dzis;
      const lista = naDzien(dzien);
      const suma = lista.reduce((s, d) => s + (Number(dietPrices?.[d.kcal]) || 0), 0);
      const mies = aktywne.reduce((s, d) => {
        let dni = 0;
        for (let i = 0; i < 31; i++) if (jedzieWDniu(d, iso(i))) dni++;
        return s + dni * (Number(dietPrices?.[d.kcal]) || 0);
      }, 0);
      return {
        tytul: `Przychód`,
        linie: [
          `${pl(dzien)}: ${suma.toFixed(2)} zł z ${lista.length} diet`,
          `Najbliższe 31 dni z obecnych diet: ${mies.toFixed(2)} zł`
        ],
        uwaga: "To przychód brutto z cennika, bez rabatów i kosztów produkcji."
      };
    }

    // ── Produkcja: ile i czego ──
    if (/ile|produkcj|posilk|porcj|kuchni|gotow|robimy|wydajemy|pudel/.test(n)) {
      const dzien = /dzis|dzisiaj/.test(n) ? dzis : jutro;
      const lista = naDzien(dzien);
      const wgDiety: Record<string, number> = {};
      const wgKcal: Record<string, number> = {};
      let posilki = 0;
      for (const d of lista) {
        wgDiety[d.diet_name || "—"] = (wgDiety[d.diet_name || "—"] || 0) + 1;
        wgKcal[String(d.kcal)] = (wgKcal[String(d.kcal)] || 0) + 1;
        posilki += Number(d.meal_count) || 4;
      }
      if (!lista.length) return { tytul: `Produkcja na ${pl(dzien)}`, linie: ["Brak diet na ten dzień."] };
      return {
        tytul: `Produkcja na ${pl(dzien)} — ${lista.length} diet, ${posilki} posiłków`,
        linie: [
          ...Object.entries(wgDiety).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`),
          "—",
          ...Object.entries(wgKcal).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => `${k} kcal: ${v}`)
        ]
      };
    }

    // ── Klienci ──
    if (/klient|ilu|baza/.test(n)) {
      const zDieta = new Set(aktywne.map(d => d.client_id)).size;
      return {
        tytul: "Klienci",
        linie: [`W kartotece: ${clients.length}`, `Z aktywną dietą: ${zDieta}`, `Aktywnych diet: ${aktywne.length}`]
      };
    }

    return {
      tytul: "Nie rozumiem tego pytania",
      linie: [
        "Umiem policzyć: produkcję na dziś i jutro, wykluczenia żywieniowe,",
        "trasy kurierskie, kończące się diety, nowe zamówienia i przychód.",
        "Spróbuj kliknąć jedną z podpowiedzi poniżej."
      ]
    };
  }

  const podpowiedzi = [
    "Ile diet na jutro?",
    "Kto ma wykluczenia jutro?",
    "Komu kończy się dieta?",
    "Jak wyglądają trasy jutro?",
    "Nowe zamówienia",
    "Ile zarobię jutro?"
  ];

  function zapytaj(q: string) {
    setPytanie(q);
    try {
      setOdp(odpowiedz(q));
    } catch (e: any) {
      // Bez tego awaria wyglądała jak martwy przycisk.
      setOdp({
        tytul: "Nie udało się policzyć",
        linie: [String(e?.message || "nieznany błąd")],
        uwaga: "Pokaż ten komunikat przy zgłaszaniu problemu."
      });
    }
  }

  if (!otwarty) {
    return (
      <button className="kaczorekBtn" onClick={() => setOtwarty(true)} aria-label="Otwórz asystenta Kaczorek">
        🦆 Kaczorek
      </button>
    );
  }

  return (
    <div className="kaczorek">
      <div className="kaczorekHead">
        <b>🦆 Kaczorek</b>
        <button type="button" onClick={() => setOtwarty(false)} aria-label="Zamknij">×</button>
      </div>

      <div className="kaczorekBody">
        {odp ? (
          <div className="kaczorekOdp">
            <b>{odp.tytul}</b>
            {odp.linie.map((l, i) => l === "—" ? <hr key={i} /> : <span key={i}>{l}</span>)}
            {odp.uwaga && <em>{odp.uwaga}</em>}
          </div>
        ) : (
          <p className="muted">Zapytaj o produkcję, wykluczenia, trasy albo pieniądze. Liczę z danych panelu.</p>
        )}

        <div className="kaczorekChipsy">
          {podpowiedzi.map(p => (
            <button type="button" key={p} onClick={() => zapytaj(p)}>{p}</button>
          ))}
        </div>
      </div>

      <form
        className="kaczorekForm"
        onSubmit={e => { e.preventDefault(); if (pytanie.trim()) zapytaj(pytanie); }}
      >
        <input
          value={pytanie}
          onChange={e => setPytanie(e.target.value)}
          placeholder="Zapytaj Kaczorka…"
        />
        <button
          className="primary"
          type="submit"
          onPointerDown={e => { e.preventDefault(); if (pytanie.trim()) zapytaj(pytanie); }}
        >
          Pytaj
        </button>
      </form>
    </div>
  );
}
