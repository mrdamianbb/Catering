/**
 * Dobór posiłków i receptur dla produkcji — jedno źródło prawdy.
 *
 * Panel, moduł kuchni i naklejki miały dotąd osobne implementacje,
 * różniące się w trzech miejscach: sposobie wyboru zamiennika, liczbie
 * slotów przy pięciu posiłkach i zachowaniu, gdy żadna receptura nie była
 * bezpieczna. W efekcie kuchnia mogła gotować jedno danie, a naklejka
 * pokazywać inne. Teraz wszystkie trzy miejsca wołają te same funkcje.
 */

import { ingredientBlocked } from "./allergens";

/** Sloty układane w menu tygodniowym. Kolejność = kolejność w ciągu dnia. */
export const SLOTY_MENU = ["breakfast", "second_breakfast", "lunch", "snack", "dinner"] as const;

/** Posiłki przypadające klientowi przy danej liczbie posiłków. */
export function slotsForDiet(mealCount: number, dietType: string): string[] {
  const n = Number(mealCount) || 4;
  if (n === 3) return ["breakfast", "lunch", "dinner"];
  if (n === 5) return ["breakfast", "second_breakfast", "lunch", "snack", "dinner"];
  if (dietType === "Keto") return ["breakfast", "lunch", "snack", "dinner"];
  return ["breakfast", "second_breakfast", "lunch", "dinner"];
}

/**
 * Wiersze menu przypadające klientowi — dokładnie jeden na slot.
 * Starsze menu mogło mieć shake zapisany jako osobny typ posiłku;
 * wtedy traktujemy go jako zamiennik slotu, żeby posiłek nie wypadł.
 */
export function rowsForSlots<T extends { meal_type: string }>(wiersze: T[], sloty: string[]): (T & { slot: string })[] {
  const wolne = wiersze.slice();
  const wynik: (T & { slot: string })[] = [];
  for (const slot of sloty) {
    let i = wolne.findIndex(w => w.meal_type === slot);
    if (i < 0 && (slot === "second_breakfast" || slot === "snack" || slot === "dinner")) {
      i = wolne.findIndex(w => w.meal_type === "shake");
    }
    if (i >= 0) wynik.push({ ...wolne.splice(i, 1)[0], slot });
  }
  return wynik;
}

/** Czy receptura pasuje do slotu. Shake może zastąpić drugi posiłek i podwieczorek. */
export function pasujeDoSlotu(r: any, slot: string): boolean {
  if (!r) return false;
  if (r.meal_type === slot) return true;
  return (slot === "second_breakfast" || slot === "snack") && r.meal_type === "shake";
}

function nazwySkladnikow(r: any): string[] {
  return (r?.recipe_ingredients || [])
    .map((x: any) => String(x?.ingredients?.name || "").trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Czy receptura jest bezpieczna przy danych wykluczeniach.
 * Sprawdzamy nazwę, opis i powiązane składniki — wystarczy, że alergen
 * pojawi się w którymkolwiek z tych miejsc, żeby danie odpadło.
 */
export function isRecipeSafe(r: any, flags: string[]): boolean {
  if (!r) return false;
  if (!flags?.length) return true;
  // Opis dzielimy na pojedyncze składniki. Inaczej wyjątek „bez laktozy"
  // przy jednym składniku zwolniłby cały opis — razem ze skyrem obok.
  const zOpisu = String(r.notes || "").split(",").map(x => x.trim()).filter(Boolean);
  const zrodla = [r.name, ...zOpisu, ...nazwySkladnikow(r)].filter(Boolean).map(String);
  return !zrodla.some(z => ingredientBlocked(z, flags));
}

/** Podobieństwo dwóch dań po składnikach — do wyboru zamiennika. */
/**
 * Główny składnik dania — pierwszy wpis w opisie albo najcięższy z powiązanych.
 * Po nim pilnujemy, żeby jedno mięso nie wracało codziennie.
 */
export function glownySkladnik(r: any): string {
  const linked = (r?.recipe_ingredients || [])
    .slice()
    .sort((x: any, y: any) => Number(y?.grams || 0) - Number(x?.grams || 0));
  const zPowiazan = String(linked[0]?.ingredients?.name || "").trim().toLowerCase();
  if (zPowiazan) return zPowiazan;
  return String(r?.notes || "").split(",")[0].trim().toLowerCase();
}

function podobienstwo(a: any, b: any): number {
  const A = new Set(nazwySkladnikow(a)), B = new Set(nazwySkladnikow(b));
  if (!A.size || !B.size) return 0;
  let wspolne = 0;
  A.forEach(x => { if (B.has(x)) wspolne++; });
  return wspolne / Math.max(A.size, B.size);
}

const koszt = (r: any) => Number(r?.food_cost || 0);

/**
 * Numer dnia do rotacji zamienników. Liczony z daty posiłku, więc panel
 * i etykiety — które dostają ten sam wiersz menu — wybiorą to samo danie.
 */
function numerDniaRotacji(wiersz: { menu_date?: string; slot?: string; meal_type: string }): number {
  const dzien = wiersz.menu_date
    ? Math.floor(Date.parse(wiersz.menu_date + "T12:00:00Z") / 86400000)
    : 0;
  // Przesunięcie dla slotu, żeby drugi posiłek i podwieczorek — które
  // dzielą shake'i — nie wzięły tego samego shake'a jednego dnia.
  const slot = wiersz.slot || wiersz.meal_type;
  const przesuniecie = Math.max(0, (SLOTY_MENU as readonly string[]).indexOf(slot));
  return dzien + przesuniecie;
}

/** Wybór z listy z rotacją — kolejne dni dostają kolejne pozycje. */
function zRotacja<T>(lista: T[], nr: number): T | null {
  if (!lista.length) return null;
  return lista[((nr % lista.length) + lista.length) % lista.length];
}

/**
 * Receptura, którą kuchnia faktycznie gotuje dla danej grupy klientów.
 *
 * Reguła, jedna dla wszystkich ekranów:
 *  1. Bazą jest danie ze wspólnego menu, o ile jest bezpieczne; jeśli nie —
 *     najtańsze bezpieczne danie Standard w tym slocie.
 *  2. Dieta Standard dostaje bazę.
 *  3. Inne diety dostają własną recepturę, najbardziej podobną do bazy,
 *     a przy remisie tańszą.
 *  4. Gdy diecie brakuje własnej receptury, sięga po bazę — z wyjątkiem
 *     keto, dla którego Standard łamałby założenia diety.
 *  5. NIGDY nie zwracamy dania z wykluczonym składnikiem. Brak bezpiecznej
 *     receptury oznacza null i ostrzeżenie dla kuchni.
 */
export function chooseRecipe(
  wiersz: { meal_type: string; recipes?: any; slot?: string; menu_date?: string },
  grupa: { dietType: string; flags?: string[]; mealCount?: number },
  wszystkie: any[],
  menuTygodnia?: any[]
): any | null {
  // Z kontekstem tygodnia liczymy plan klienta dzień po dniu, żeby
  // zamienniki nie powtarzały dań z innych dni tego samego tygodnia.
  if (menuTygodnia?.length && wiersz.menu_date) {
    const plan = planTygodniaKlienta(menuTygodnia, grupa, wszystkie);
    const klucz = `${wiersz.menu_date}|${wiersz.slot || wiersz.meal_type}`;
    if (plan.has(klucz)) return plan.get(klucz);
  }
  return wybierzBezKontekstu(wiersz, grupa, wszystkie, new Set());
}

/** Wybór dla jednego wiersza; `uzyte` to dania, które klient już dostał w tym tygodniu. */
function wybierzBezKontekstu(
  wiersz: { meal_type: string; recipes?: any; slot?: string; menu_date?: string },
  grupa: { dietType: string; flags?: string[] },
  wszystkie: any[],
  uzyte: Set<number>
): any | null {
  const slot = wiersz.slot || wiersz.meal_type;
  const flagi = grupa.flags || [];
  const aktywne = (wszystkie || []).filter(r => r?.active !== false);

  const nr = numerDniaRotacji(wiersz);
  const zMenu = wiersz.recipes || null;
  const bazaZMenu = zMenu && zMenu.diet_type === "Standard" && isRecipeSafe(zMenu, flagi) ? zMenu : null;

  // Zamiennik Standardu rotuje z dnia na dzień. Dawniej zawsze wypadało
  // najtańsze danie — klient z wykluczeniem jadł to samo przez cały tydzień.
  // Świeże najpierw — dania, których klient jeszcze w tym tygodniu nie jadł.
  const swieze = <T extends { id: any }>(lista: T[]) => {
    const nowe = lista.filter(r => !uzyte.has(Number(r.id)));
    return nowe.length ? nowe : lista;
  };
  const zamiennikStandard = () => zRotacja(
    swieze(aktywne
      .filter(r => r.diet_type === "Standard" && pasujeDoSlotu(r, slot) && isRecipeSafe(r, flagi))
      .sort((a, b) => koszt(a) - koszt(b) || Number(a.id) - Number(b.id))),
    nr);
  const bazaNieuzyta = bazaZMenu && !uzyte.has(Number(bazaZMenu.id)) ? bazaZMenu : null;
  const baza = bazaNieuzyta || zamiennikStandard() || bazaZMenu;

  if (grupa.dietType === "Standard") return baza;

  const wlasne = aktywne.filter(r =>
    r.diet_type === grupa.dietType && pasujeDoSlotu(r, slot) && isRecipeSafe(r, flagi));

  if (wlasne.length) {
    // Najpierw porządek wg podobieństwa do bazy, potem rotacja — żeby
    // klient keto nie jadł tego samego omletu przez siedem dni.
    const wzor = baza || zMenu;
    const uporzadkowane = wlasne.slice().sort((a, b) =>
      (wzor ? podobienstwo(b, wzor) - podobienstwo(a, wzor) : 0) ||
      koszt(a) - koszt(b) || Number(a.id) - Number(b.id));
    return zRotacja(swieze(uporzadkowane), nr);
  }

  if (grupa.dietType !== "Keto") return baza;
  return null;
}

/* ═══════════════════════════════════════════════════════════
   UKŁADANIE TYGODNIA
   Wspólne dla przycisku „Ułóż ten tydzień" i sobotniego automatu.
   ═══════════════════════════════════════════════════════════ */

/** Ile dni wstecz sprawdzamy, żeby dania nie wracały z tygodnia na tydzień. */
export const DNI_PAMIECI = 14;

export interface WynikTygodnia {
  rows: { menu_date: string; diet_type: string; meal_type: string; recipe_id: number }[];
  /** Dania, które musiały się powtórzyć z poprzednich tygodni — za mała baza. */
  powtorki: { slot: string; danie: string }[];
  /** Sloty, w których baza jest za mała na dwa tygodnie bez powtórek. */
  zaMalaBaza: { slot: string; ma: number; potrzeba: number }[];
}

function isoDnia(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Układa tydzień tak, żeby dania nie powtarzały się ani w obrębie tygodnia,
 * ani z poprzednimi tygodniami.
 *
 * Kolejność preferencji przy każdym wyborze:
 *  1. danie nieużyte w tym tygodniu,
 *  2. danie niewidziane najdłużej (nigdy — najlepiej),
 *  3. danie zużywające nadmiar z magazynu,
 *  4. tańsze.
 *
 * Wcześniej wybór szedł głównie po koszcie, więc co tydzień wypadały
 * te same najtańsze dania.
 */
export function ulozTydzien(opts: {
  recipes: any[];
  startIso: string;
  ostatnioUzyte: Map<number, string>;
  surplusScore?: (r: any) => number;
}): WynikTygodnia {
  const standard = opts.recipes.filter(r => r?.diet_type === "Standard" && r?.active !== false);
  const nadmiar = opts.surplusScore || (() => 0);
  const start = new Date(opts.startIso + "T12:00:00");

  const rows: WynikTygodnia["rows"] = [];
  const powtorki: WynikTygodnia["powtorki"] = [];
  const wTymTygodniu = new Set<number>();
  // Ile razy dany surowiec wystąpił w tygodniu — bez tego jedno mięso
  // potrafiło wejść na cały tydzień, zwłaszcza po dużym uzupełnieniu bazy.
  const licznikSurowca = new Map<string, number>();
  const MAX_SUROWCA = 2;
  // Ostatni dzień, w którym surowiec wystąpił — żeby to samo mięso
  // nie wypadło dwa dni pod rząd. Dwa razy w tygodniu jest w porządku,
  // ale nie w poniedziałek i wtorek.
  const surowiecOstatniDzien = new Map<string, number>();
  const ostatniWSlocie = new Map<string, any>();
  const tydzienWczesniej = new Date(start); tydzienWczesniej.setDate(start.getDate() - 7);
  const poprzedniTydzienOd = isoDnia(tydzienWczesniej);

  // Brak powtórek z tygodnia na tydzień wymaga 14 dań na slot.

  // Pełna rotacja na dwa tygodnie wymaga 14 różnych dań na slot.
  // Progi sprawdzone symulacją sześciu tygodni. Podwieczorek potrzebuje
  // więcej, bo shake'i dzieli z drugim posiłkiem.
  const PROG: Record<string, number> = { snack: 16 };
  const zaMalaBaza = SLOTY_MENU
    .map(slot => ({ slot, ma: standard.filter(r => pasujeDoSlotu(r, slot)).length, potrzeba: PROG[slot] ?? 15 }))
    .filter(x => x.ma < x.potrzeba);

  for (let di = 0; di < 7; di++) {
    const dzien = new Date(start); dzien.setDate(start.getDate() + di);
    const data = isoDnia(dzien);

    for (const slot of SLOTY_MENU) {
      const pula = standard.filter(r => pasujeDoSlotu(r, slot));
      if (!pula.length) continue;

      const ostatnio = (r: any) => opts.ostatnioUzyte.get(r.id) || "0000-00-00";

      const nadUzyty = (r: any) =>
        (licznikSurowca.get(glownySkladnik(r)) || 0) >= MAX_SUROWCA ? 1 : 0;
      const wczoraj = (r: any) =>
        di - (surowiecOstatniDzien.get(glownySkladnik(r)) ?? -99) <= 1 ? 1 : 0;

      let wybor = pula.slice().sort((a, b) =>
        Number(wTymTygodniu.has(a.id)) - Number(wTymTygodniu.has(b.id)) ||
        wczoraj(a) - wczoraj(b) ||
        nadUzyty(a) - nadUzyty(b) ||
        ostatnio(a).localeCompare(ostatnio(b)) ||
        nadmiar(b) - nadmiar(a) ||
        Number(a.food_cost || 0) - Number(b.food_cost || 0)
      );

      // Dwa shake'i pod rząd w tym samym slocie wyglądają jak pomyłka.
      const poprzedni = ostatniWSlocie.get(slot);
      if (poprzedni?.meal_type === "shake" && wybor[0]?.meal_type === "shake") {
        const innyNiz = wybor.find(r => r.meal_type !== "shake" && !wTymTygodniu.has(r.id));
        if (innyNiz) wybor = [innyNiz, ...wybor.filter(r => r !== innyNiz)];
      }

      const r = wybor[0];
      // Powtórka to danie z poprzedniego tygodnia — z tego, co było dwa
      // tygodnie temu, rotacja celowo korzysta ponownie.
      const ostatnioData = opts.ostatnioUzyte.get(r.id);
      if (ostatnioData && ostatnioData >= poprzedniTydzienOd) powtorki.push({ slot, danie: r.name });
      rows.push({ menu_date: data, diet_type: "Standard", meal_type: slot, recipe_id: r.id });
      wTymTygodniu.add(r.id);
      const sur = glownySkladnik(r);
      licznikSurowca.set(sur, (licznikSurowca.get(sur) || 0) + 1);
      surowiecOstatniDzien.set(sur, di);
      ostatniWSlocie.set(slot, r);
    }
  }

  return { rows, powtorki, zaMalaBaza };
}


/**
 * Plan klienta na cały tydzień — dzień po dniu, z pamięcią tego, co już
 * dostał. Dzięki temu zamiennik nie trafia w danie podane innego dnia.
 * Deterministyczny: panel i etykiety z tym samym menu dostaną ten sam plan.
 */
const pamiecPlanow = new Map<string, Map<string, any>>();

export function planTygodniaKlienta(
  menuTygodnia: any[],
  grupa: { dietType: string; flags?: string[]; mealCount?: number },
  wszystkie: any[]
): Map<string, any> {
  const flagi = grupa.flags || [];
  const sloty = slotsForDiet(grupa.mealCount || 4, grupa.dietType);
  const klucz = [
    grupa.dietType, flagi.join("+"), sloty.join(","),
    menuTygodnia.map(m => `${m.menu_date}:${m.meal_type}:${m.recipe_id ?? m.recipes?.id}`).join(";"),
    wszystkie.length
  ].join("|");
  const z = pamiecPlanow.get(klucz);
  if (z) return z;

  const plan = new Map<string, any>();
  const uzyte = new Set<number>();
  const dni = [...new Set(menuTygodnia.map(m => m.menu_date))].sort();
  for (const dzien of dni) {
    const wiersze = rowsForSlots(menuTygodnia.filter(m => m.menu_date === dzien), sloty);
    for (const w of wiersze) {
      const r = wybierzBezKontekstu(w, grupa, wszystkie, uzyte);
      plan.set(`${dzien}|${w.slot}`, r);
      if (r) uzyte.add(Number(r.id));
    }
  }
  if (pamiecPlanow.size > 200) pamiecPlanow.clear();
  pamiecPlanow.set(klucz, plan);
  return plan;
}

/** Poniedziałek i niedziela tygodnia, do którego należy dzień. */
export function zakresTygodnia(iso: string): { od: string; do: string } {
  const d = new Date(iso + "T12:00:00");
  const n = d.getDay() === 0 ? 7 : d.getDay();
  const pon = new Date(d); pon.setDate(d.getDate() - (n - 1));
  const nd = new Date(pon); nd.setDate(pon.getDate() + 6);
  const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { od: f(pon), do: f(nd) };
}

/**
 * Układa JEDEN dzień na nowo, nie ruszając reszty tygodnia.
 *
 * Nowe dania nie powtarzają tego, co jest w pozostałych dniach, pilnują
 * limitu surowca i nie stawiają tego samego mięsa obok dnia sąsiedniego.
 * Gdy w slocie nie ma z czego wybierać, zostawia to, co było.
 */
export function ulozDzien(opts: {
  recipes: any[];
  data: string;
  /** Wiersze całego tygodnia, razem z dniem przebudowywanym. */
  tydzien: { menu_date: string; meal_type: string; recipe_id: number }[];
  ostatnioUzyte?: Map<number, string>;
  surplusScore?: (r: any) => number;
}): { rows: { meal_type: string; recipe_id: number }[]; bezZmian: string[] } {
  const standard = opts.recipes.filter(r => r?.diet_type === "Standard" && r?.active !== false);
  const nadmiar = opts.surplusScore || (() => 0);
  const ostatnioMapa = opts.ostatnioUzyte || new Map<number, string>();

  const inneDni = opts.tydzien.filter(w => w.menu_date !== opts.data);
  const zajete = new Set(inneDni.map(w => Number(w.recipe_id)));

  const dzienNr = (d: string) => Math.floor(Date.parse(d + "T12:00:00Z") / 86400000);
  const ten = dzienNr(opts.data);

  // Surowce z pozostałych dni: ile razy w tygodniu i czy w dniu sąsiednim.
  const licznikSurowca = new Map<string, number>();
  const sasiednie = new Set<string>();
  for (const w of inneDni) {
    const r = standard.find(x => x.id === w.recipe_id);
    if (!r) continue;
    const sur = glownySkladnik(r);
    licznikSurowca.set(sur, (licznikSurowca.get(sur) || 0) + 1);
    if (Math.abs(dzienNr(w.menu_date) - ten) <= 1) sasiednie.add(sur);
  }

  const teraz = new Map(opts.tydzien.filter(w => w.menu_date === opts.data).map(w => [w.meal_type, Number(w.recipe_id)]));
  const rows: { meal_type: string; recipe_id: number }[] = [];
  const bezZmian: string[] = [];
  const MAX = 2;

  for (const slot of SLOTY_MENU) {
    const obecne = teraz.get(slot);
    const pula = standard.filter(r =>
      pasujeDoSlotu(r, slot) && !zajete.has(Number(r.id)) && Number(r.id) !== obecne);

    if (!pula.length) {
      if (obecne) { rows.push({ meal_type: slot, recipe_id: obecne }); bezZmian.push(slot); }
      continue;
    }

    const ostatnio = (r: any) => ostatnioMapa.get(r.id) || "0000-00-00";
    const wybor = pula.slice().sort((a, b) =>
      (sasiednie.has(glownySkladnik(a)) ? 1 : 0) - (sasiednie.has(glownySkladnik(b)) ? 1 : 0) ||
      ((licznikSurowca.get(glownySkladnik(a)) || 0) >= MAX ? 1 : 0) -
      ((licznikSurowca.get(glownySkladnik(b)) || 0) >= MAX ? 1 : 0) ||
      ostatnio(a).localeCompare(ostatnio(b)) ||
      nadmiar(b) - nadmiar(a) ||
      Number(a.food_cost || 0) - Number(b.food_cost || 0)
    );

    const r = wybor[0];
    rows.push({ meal_type: slot, recipe_id: r.id });
    zajete.add(Number(r.id));
    const sur = glownySkladnik(r);
    licznikSurowca.set(sur, (licznikSurowca.get(sur) || 0) + 1);
  }

  return { rows, bezZmian };
}
