/**
 * Shake proteinowy — dane produktu w jednym miejscu.
 * Używane przez sklep, podstronę /shake i wycenę zamówienia.
 */

export const SHAKE_CENA_Z_DIETA = 15;
export const SHAKE_CENA_OSOBNO = 18;
export const SHAKE_MAX = 30;

export interface Smak {
  id: string;
  nazwa: string;
  opis: string;
  obraz: string;
  wegański?: boolean;
  /** Na 100 ml — z receptur produkcyjnych. */
  kcal: number;
  bialko: number;
  tluszcz: number;
  wegle: number;
  cukry: number;
  blonnik: number;
  sol: number;
  sklad: string;
  alergeny: string;
}

export const SMAKI: Smak[] = [
  {
    id: "malina-banan",
    nazwa: "Malina · banan",
    opis: "Na mleku, białko z serwatki",
    obraz: "/shake/malina.jpg",
    kcal: 81, bialko: 10.2, tluszcz: 0.8, wegle: 7.3, cukry: 5.0, blonnik: 1.8, sol: 0.1,
    sklad: "mleko odtłuszczone, koncentrat białka serwatkowego (z mleka), banan (12%), maliny (8%), błonnik (inulina), aromaty, substancje zagęszczające (guma guar, karagen), sól, substancja słodząca",
    alergeny: "Zawiera mleko i produkty pochodne."
  },
  {
    id: "borowka-banan",
    nazwa: "Borówka · banan",
    opis: "Na mleku, białko z serwatki",
    obraz: "/shake/borowka.jpg",
    kcal: 80, bialko: 10.1, tluszcz: 0.8, wegle: 7.4, cukry: 5.5, blonnik: 1.4, sol: 0.1,
    sklad: "mleko odtłuszczone, koncentrat białka serwatkowego (z mleka), banan (12%), borówki (8%), błonnik (inulina), aromaty, substancje zagęszczające (guma guar, karagen), sól, substancja słodząca",
    alergeny: "Zawiera mleko i produkty pochodne."
  },
  {
    id: "truskawka-wanilia",
    nazwa: "Truskawka · wanilia",
    opis: "Na mleku, białko z serwatki",
    obraz: "/shake/truskawka.jpg",
    kcal: 78, bialko: 10.2, tluszcz: 0.8, wegle: 6.9, cukry: 5.1, blonnik: 1.4, sol: 0.1,
    sklad: "mleko odtłuszczone, koncentrat białka serwatkowego (z mleka), banan (12%), truskawki (8%), błonnik (inulina), aromaty, substancje zagęszczające (guma guar, karagen), sól, substancja słodząca",
    alergeny: "Zawiera mleko i produkty pochodne."
  },
  {
    id: "czekolada-mieta",
    nazwa: "Czekolada · mięta",
    opis: "Roślinny, wegański",
    obraz: "/shake/czekolada-mieta.jpg",
    wegański: true,
    kcal: 74, bialko: 10.0, tluszcz: 1.5, wegle: 4.2, cukry: 1.1, blonnik: 1.8, sol: 0.2,
    sklad: "napój roślinny (owies), białko grochu, białko ryżu, kakao (8%), naturalny aromat miętowy, błonnik roślinny, substancja zagęszczająca: guma guar, sól himalajska, witaminy (B6, B12, D), minerały (magnez, potas, wapń)",
    alergeny: "Zawiera owies (gluten). Może zawierać śladowe ilości soi, orzechów i sezamu."
  }
];

export const SMAK_MIX = "mix";

export function nazwaSmaku(id: string): string {
  if (id === SMAK_MIX) return "Mix smaków";
  return SMAKI.find(s => s.id === id)?.nazwa || id;
}

/** Czy wybór smaku jest poprawny — sprawdzane też po stronie serwera. */
export function poprawnySmak(id: string): boolean {
  return id === SMAK_MIX || SMAKI.some(s => s.id === id);
}
