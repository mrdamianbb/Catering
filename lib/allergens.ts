/**
 * Alergeny i wykluczenia — jedno źródło prawdy dla sklepu i kuchni.
 *
 * Dwie zasady, które rozwiązują błędy poprzedniej wersji:
 *
 * 1. Wszystko porównujemy na tekście bez polskich znaków, więc „jęczmienna"
 *    trafia w rdzeń „jeczmien". Wcześniej kasza jęczmienna przechodziła
 *    przez filtr glutenowy, bo w odmianie ginie litera „ń".
 *
 * 2. Rdzenie dopasowujemy od początku słowa (granica wyrazu), nie w środku.
 *    Wcześniej rdzeń „ser " trafiał w „deser" i oznaczał deser jako nabiał.
 */

export function normalize(v: string): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Czy w tekście występuje słowo zaczynające się od któregoś rdzenia. */
function hasStem(text: string, stems: string[]): boolean {
  const n = normalize(text);
  return stems.some(stem => new RegExp(`(^|[^a-z0-9])${normalize(stem)}`, "i").test(n));
}

export interface Allergen {
  id: string;
  /** Etykieta pokazywana kuchni — krótka, czytelna z odległości. */
  flag: string;
  /** Rdzenie, po których rozpoznajemy zgłoszenie klienta. */
  declared: string[];
  /** Rdzenie nazw składników, które przy tym wykluczeniu są zakazane. */
  ingredients: string[];
  /**
   * Rdzenie, które zwalniają składnik mimo trafienia w `ingredients`.
   * Przykład: przy braku laktozy „mleko bez laktozy" jest dozwolone.
   */
  except?: string[];
}

export const ALLERGENS: Allergen[] = [
  {
    id: "gluten",
    flag: "BEZ GLUTENU",
    declared: ["gluten", "bezglut", "celiak", "pszenic", "pszenn"],
    ingredients: [
      "pszen", "maka", "makaron", "kasza manna", "kuskus", "kus-kus", "bulgur",
      "chleb", "bulk", "buleczk", "tortill", "pieczyw", "grzank", "sucharek",
      "orkisz", "jeczmien", "zyto", "zytni", "owsian", "owies", "platki owsian",
      "otreb", "seitan", "panierk", "bulka tarta", "sos sojowy", "kaszka",
      "kluski", "pierog", "nalesnik", "placki", "ciasto", "biszkopt"
    ]
  },
  {
    // Całkowity brak nabiału — alergia na białka mleka albo wybór klienta.
    // Odpada każdy produkt mleczny, także bezlaktozowy.
    id: "nabial",
    flag: "BEZ NABIALU",
    declared: ["nabial", "bez mleka", "mleczn", "kazein", "bialko mleka", "bialka mleka"],
    ingredients: [
      "mlek", "smietan", "smietank", "jogurt", "kefir", "maslank", "maslo",
      "ser", "serek", "serk", "twarog", "twarozek", "mozzarell", "feta",
      "mascarpone", "ricott", "parmezan", "cheddar", "gouda", "camembert",
      "brie", "skyr", "serwatk", "kazein", "budyn", "lody"
    ]
  },
  {
    // Nietolerancja laktozy — to NIE to samo co brak nabiału.
    // Klient może jeść nabiał bezlaktozowy, więc takie produkty przepuszczamy.
    id: "laktoza",
    flag: "BEZ LAKTOZY",
    declared: ["laktoz", "bezlakt", "nietolerancja laktozy"],
    ingredients: [
      "mlek", "smietan", "smietank", "jogurt", "kefir", "maslank",
      "serek", "serk", "twarog", "twarozek", "mozzarell", "feta",
      "mascarpone", "ricott", "skyr", "serwatk", "budyn", "lody"
    ],
    except: ["bez laktozy", "bezlaktoz", "lactose free", "laktoza free"]
  },
  {
    id: "jaja",
    flag: "BEZ JAJ",
    declared: ["jaj", "jajk", "jajec"],
    ingredients: ["jaj", "jajk", "majonez", "beza", "omlet", "jajecz"]
  },
  {
    id: "ryby",
    flag: "BEZ RYB",
    declared: ["ryb", "rybn"],
    ingredients: [
      "ryb", "losos", "dorsz", "tunczyk", "makrel", "pstrag", "sledz",
      "sardynk", "sardel", "anchois", "halibut", "mintaj", "morszczuk",
      "surimi", "sos rybny", "kawior", "wedzona ryba"
    ]
  },
  {
    id: "skorupiaki",
    flag: "BEZ SKORUPIAKOW",
    declared: ["skorupiak", "krewet", "krab", "homar", "langust", "raki"],
    ingredients: ["krewet", "krab", "homar", "langust", "raki", "owoce morza", "skorupiak"]
  },
  {
    id: "mieczaki",
    flag: "BEZ MIECZAKOW",
    declared: ["mieczak", "malz", "ostryg", "kalmar", "osmiornic", "przegrzebk"],
    ingredients: ["malz", "ostryg", "kalmar", "osmiornic", "przegrzebk", "slimak", "mieczak"]
  },
  {
    id: "orzechy",
    flag: "BEZ ORZECHOW",
    declared: ["orzech", "migdal", "nerkowc", "pistacj", "laskow", "wloski"],
    ingredients: [
      "orzech", "migdal", "nerkowc", "pistacj", "laskow", "wloskich",
      "pekan", "makadami", "marcepan", "nutell", "praline"
    ]
  },
  {
    id: "arachid",
    flag: "BEZ ARACHIDOWYCH",
    declared: ["arachid", "orzeszk", "fistasz", "peanut"],
    ingredients: ["arachid", "orzeszk", "fistasz", "maslo orzechowe"]
  },
  {
    id: "soja",
    flag: "BEZ SOI",
    declared: ["soj", "soi"],
    ingredients: ["soj", "tofu", "tempeh", "edamame", "sos sojowy", "lecytyn sojow", "miso"]
  },
  {
    id: "seler",
    flag: "BEZ SELERA",
    declared: ["seler"],
    ingredients: ["seler", "wloszczyzn", "bulion warzywny", "przyprawa warzywna", "vegeta"]
  },
  {
    id: "gorczyca",
    flag: "BEZ GORCZYCY",
    declared: ["gorczyc", "musztard"],
    ingredients: ["gorczyc", "musztard", "dijon"]
  },
  {
    id: "sezam",
    flag: "BEZ SEZAMU",
    declared: ["sezam", "tahini"],
    ingredients: ["sezam", "tahini", "hummus", "chalwa"]
  },
  {
    id: "lubin",
    flag: "BEZ LUBINU",
    declared: ["lubin"],
    ingredients: ["lubin"]
  },
  {
    id: "siarczyny",
    flag: "BEZ SIARCZYNOW",
    declared: ["siarczyn", "siarczk", "dwutlenek siarki"],
    ingredients: ["siarczyn", "suszone morel", "suszone owoce", "wino", "ocet winny"]
  },
  {
    // Grzyby nie są jednym z czternastu alergenów z rozporządzenia, ale alergia
    // na nie jest realna i klienci ją zgłaszają. Bez tego wpisu zgłoszenie
    // „grzyby" przechodziło bez śladu, a w bazie są dania z pieczarkami.
    id: "grzyby",
    flag: "BEZ GRZYBÓW",
    declared: ["grzyb", "pieczark", "bez grzyb"],
    ingredients: [
      "grzyb", "pieczark", "boczniak", "borowik", "podgrzyb", "maslak",
      "opienk", "shiitake", "kurki", "kurkami", "trufl", "suszone grzyb"
    ]
  },
  {
    // Preferencja: wyłącznie dania wytrawne. „Słodkie" to typ dania, a nie
    // jeden składnik, więc rozpoznajemy po nazwach dań i składnikach typowych
    // dla słodkich posiłków. Wolimy odrzucić za dużo niż podać deser komuś,
    // kto prosił, żeby go nie było.
    id: "slodkie",
    flag: "NIE NA SLODKO",
    declared: ["nie na slodko", "bez slodk", "bez slodycz", "nic slodkiego", "wytrawn", "nie lubi slodk"],
    ingredients: [
      "miod", "cukier", "cukr", "syrop", "dzem", "konfitur", "czekolad", "kakao",
      "daktyl", "rodzynk", "budyn", "pudding", "sernik", "brownie", "muffin",
      "ciast", "gofr", "nalesnik", "placusz", "granol", "deser", "slodk",
      "wanili", "karmel", "nutell", "lody", "owsiank", "jaglank", "koktajl",
      "smoothie", "shake", "batonik", "kulki mocy", "mus owoc", "owoc",
      "jablk", "grusz", "malin", "borowk", "truskaw", "mango", "banan",
      "ananas", "brzoskwin", "sliwk", "winogron", "jagod", "wisni"
    ],
    except: ["owoce morza", "owocow morza", "owocami morza"]
  },
  {
    // Preferencja, nie alergen — ale kuchnia obsługuje ją tym samym mechanizmem.
    id: "zupy",
    flag: "BEZ ZUP",
    declared: ["zup", "zupek", "krem z", "rosol", "rosół", "barszcz", "zure", "żure", "zurk", "żurk", "chlodnik", "chłodnik"],
    ingredients: ["zupa", "zup", "krem z", "rosol", "barszcz", "zure", "zurk", "chlodnik", "bulion", "flaki", "kapusniak", "ogorkowa", "pomidorowa", "jarzynowa"]
  },
  {
    id: "wieprzowina",
    flag: "BEZ WIEPRZOWINY",
    declared: ["wieprz", "swinin", "halal", "koszer"],
    ingredients: [
      "wieprz", "schab", "boczek", "szynk", "karkow", "karkówk", "kielbas",
      "salceson", "smalec", "slonin", "zeberk", "golonk", "pancett",
      "parowk", "kabanos", "podgardl", "mielonka"
    ]
  }
];

/** Wykluczenia zgłoszone przez klienta — z nazwy diety i notatek zamówienia. */
export function detectRestrictions(...sources: (string | null | undefined)[]): string[] {
  const text = sources.filter(Boolean).join(" ");
  if (!text.trim()) return [];
  return ALLERGENS.filter(a => hasStem(text, a.declared)).map(a => a.flag);
}

/** Czy składnik jest zakazany przy danym zestawie wykluczeń. */
export function ingredientBlocked(ingredientName: string, flags: string[]): boolean {
  // flags bywa niezdefiniowane, gdy dieta nie przeszła przez detectRestrictions.
  if (!flags?.length || !ingredientName) return false;
  return ALLERGENS
    .filter(a => flags.includes(a.flag))
    .some(a => hasStem(ingredientName, a.ingredients)
      && !(a.except?.length && hasStem(ingredientName, a.except)));
}

/**
 * Treść notatki, której nie udało się przypisać do żadnego znanego alergenu.
 * Kuchnia musi ją zobaczyć w całości — lista nigdy nie będzie kompletna,
 * a klient może wpisać coś własnymi słowami.
 */
/**
 * Alergeny OBECNE w daniu — wyliczone z nazw składników i opisu receptury.
 *
 * To odwrotność `ingredientBlocked`: tam pytamy „czy ten składnik jest
 * zakazany przy danym wykluczeniu", a tu „jakie alergeny zawiera to danie".
 * Nazwy odpowiadają czternastu alergenom z rozporządzenia 1169/2011.
 *
 * UWAGA: wynik powstaje automatycznie z nazw składników i bywa niepełny —
 * przyprawy, sosy i półprodukty mogą zawierać alergeny, których nie widać
 * w nazwie. Przed użyciem na etykiecie dla klienta kucharz musi to
 * potwierdzić.
 */
const NAZWY_ALERGENOW: Record<string, string> = {
  gluten: "gluten",
  nabial: "mleko",
  jaja: "jaja",
  orzechy: "orzechy",
  ryby: "ryby",
  skorupiaki: "skorupiaki",
  soja: "soja",
  seler: "seler",
  sezam: "sezam",
  gorczyca: "gorczyca",
  lupin: "łubin",
  mieczaki: "mięczaki",
  siarczyny: "siarczyny",
  migdaly: "orzechy"
};

export function allergensInDish(...sources: (string | null | undefined)[]): string[] {
  const tekst = sources.filter(Boolean).join(" ");
  if (!tekst.trim()) return [];
  const znalezione = new Set<string>();
  for (const a of ALLERGENS) {
    const nazwa = NAZWY_ALERGENOW[a.id];
    if (!nazwa) continue;                       // pomijamy wykluczenia niebędące alergenami
    if (hasStem(tekst, a.ingredients)) znalezione.add(nazwa);
  }
  return [...znalezione].sort((x, y) => x.localeCompare(y, "pl"));
}

export function unmatchedRestrictionText(notes: string | null | undefined): string {
  const m = String(notes || "").match(/ALERGENY:\s*([^·]+)/i);
  if (!m) return "";
  const raw = m[1].trim();
  if (!raw || /^brak$/i.test(raw)) return "";
  return raw;
}


/** Nazwa wykluczenia do wyświetlenia w formularzu — z polskimi znakami. */
const NAZWY_WYKLUCZEN: Record<string, string> = {
  gluten: "Bez glutenu", nabial: "Bez nabiału", laktoza: "Bez laktozy", jaja: "Bez jaj",
  ryby: "Bez ryb", skorupiaki: "Bez skorupiaków", mieczaki: "Bez mięczaków",
  orzechy: "Bez orzechów", arachid: "Bez orzeszków ziemnych", soja: "Bez soi",
  seler: "Bez selera", gorczyca: "Bez gorczycy", sezam: "Bez sezamu", lubin: "Bez łubinu",
  siarczyny: "Bez siarczynów", slodkie: "Nie na słodko", zupy: "Bez zup",
  wieprzowina: "Bez wieprzowiny"
};
export function nazwaWykluczenia(a: Allergen): string {
  return NAZWY_WYKLUCZEN[a.id] || a.flag;
}
