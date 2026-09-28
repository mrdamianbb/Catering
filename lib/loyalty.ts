/**
 * Program lojalnościowy — rabat rośnie z łączną liczbą zamówionych dni.
 *
 * Liczymy dni z historii, nie długość jednego zamówienia: nagradzamy tych,
 * którzy wracają, a nie tych, którzy raz kupili dużo. Duże cateringi zbijają
 * cenę stałym klientom, więc nasz musi mieć powód, żeby nie sprawdzać
 * konkurencji po roku.
 */

export interface Prog {
  dni: number;
  procent: number;
  nazwa: string;
}

export const PROGI: Prog[] = [
  { dni: 180, procent: 7, nazwa: "Stały klient" },
  { dni: 90, procent: 5, nazwa: "Wierny klient" },
  { dni: 30, procent: 3, nazwa: "Nasz klient" }
];

/** Rabat przysługujący przy danej liczbie dni w historii. */
export function poziomDla(dni: number): Prog | null {
  return PROGI.find(p => dni >= p.dni) || null;
}

/** Ile dni brakuje do kolejnego progu — do pokazania w sklepie. */
export function doNastepnegoProgu(dni: number): { brakuje: number; prog: Prog } | null {
  const wyzsze = PROGI.filter(p => p.dni > dni).sort((a, b) => a.dni - b.dni);
  const prog = wyzsze[0];
  return prog ? { brakuje: prog.dni - dni, prog } : null;
}

/**
 * Za polecenie obie strony dostają dzień diety gratis.
 * Dzień kosztuje nas składniki, a nie pełną cenę — przy podobnym koszcie
 * brzmi hojniej niż rabat kwotowy i zatrzymuje klienta o dzień dłużej.
 */
export const BONUS_DNI_ZA_POLECENIE = 1;

/** Polecona osoba musi zamówić tyle dni, żeby bonus się należał. */
export const MIN_DNI_POLECONEGO = 7;

/**
 * Numer telefonu do porównań: same cyfry, bez prefiksu kraju.
 * „+48 884 004 321", „884-004-321" i „884004321" to ten sam klient.
 */
export function kluczTelefonu(tel: string): string {
  const cyfry = String(tel || "").replace(/\D/g, "");
  return cyfry.length > 9 ? cyfry.slice(-9) : cyfry;
}
