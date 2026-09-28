/**
 * Dzień produkcji — jedno źródło prawdy dla panelu, modułu kuchni i etykiet.
 *
 * Dotąd panel brał najbliższy dzień z realną dostawą (albo datę wybraną
 * w kalendarzu), a moduł kuchni miał na sztywno „jutro, w sobotę poniedziałek".
 * W sobotę etykiety pomijały więc niedzielę, a przy ręcznie wybranej dacie
 * drukowały się dla innego dnia niż ten, który kuchnia gotowała.
 */

const KLUCZ = "dk-dzien-produkcji";

function isoLokalnie(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dzisIso(): string {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  return isoLokalnie(d);
}

function plusDni(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoLokalnie(d);
}

/** Numer dnia tygodnia tak, jak zapisuje go panel: poniedziałek 1 … niedziela 7. */
export function numerDnia(iso: string): number {
  const n = new Date(iso + "T12:00:00").getDay();
  return n === 0 ? 7 : n;
}

/** Czy dieta ma dostawę w danym dniu. */
export function dostawaWDniu(d: any, iso: string): boolean {
  if (!d || d.archived) return false;
  if (iso < d.start_date || iso > d.end_date) return false;
  const dni = Array.isArray(d.delivery_weekdays) && d.delivery_weekdays.length
    ? d.delivery_weekdays : [1, 2, 3, 4, 5, 6, 7];
  return dni.includes(numerDnia(iso));
}

/** Najbliższy dzień od jutra, w którym ktokolwiek ma dostawę. */
export function najblizszaDostawa(diety: any[]): string {
  const dzis = dzisIso();
  for (let i = 1; i <= 31; i++) {
    const dzien = plusDni(dzis, i);
    if ((diety || []).some(d => dostawaWDniu(d, dzien))) return dzien;
  }
  return plusDni(dzis, 1);
}

/** Zapamiętuje dzień wybrany w panelu, żeby moduł kuchni wziął ten sam. */
export function zapiszDzienProdukcji(iso: string | null) {
  try {
    if (iso) localStorage.setItem(KLUCZ, iso);
    else localStorage.removeItem(KLUCZ);
  } catch { /* przeglądarka bez dostępu do pamięci — trudno, liczymy z diet */ }
}

/** Wybrany dzień, o ile nie minął. Przeszłe daty ignorujemy. */
export function odczytajDzienProdukcji(): string | null {
  try {
    const v = localStorage.getItem(KLUCZ);
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= dzisIso()) return v;
  } catch { /* jw. */ }
  return null;
}

/** Dzień produkcji: wybrany w panelu, a jeśli brak — najbliższa dostawa. */
export function dzienProdukcji(diety: any[]): string {
  return odczytajDzienProdukcji() || najblizszaDostawa(diety);
}

/**
 * Diety wyjeżdżające w danym dniu — jedna na osobę, nowsza wygrywa.
 *
 * Rozpoznajemy po numerze klienta RAZEM z nazwą. Samo scalanie po numerze
 * gubiło domowników: dwie osoby zamawiające pod jednym adresem mają
 * wspólny wpis w kartotece, więc jedna z nich znikała z produkcji.
 * Ta sama osoba z dwiema nakładającymi się dietami nadal dostaje jedną —
 * tę nowszą — bo wtedy zgadza się i numer, i nazwa.
 */
export function dietyNaDzien<T extends { id: any; client_id?: any; client_name?: string }>(
  diety: T[], iso: string
): T[] {
  const kandydaci = (diety || [])
    .filter(d => dostawaWDniu(d, iso))
    .sort((a, b) => Number(b.id) - Number(a.id));
  const wgKlienta = new Map<string, T>();
  for (const d of kandydaci) {
    const nazwa = String(d.client_name || "").trim().toLowerCase();
    const klucz = `${d.client_id ?? ""}|${nazwa}`;
    if (!wgKlienta.has(klucz)) wgKlienta.set(klucz, d);
  }
  return [...wgKlienta.values()];
}
