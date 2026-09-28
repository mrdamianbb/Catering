export interface City {
  slug: string;
  name: string;
  locative: string;      // „w Jastrzębiu-Zdroju"
  title: string;
  description: string;
  lead: string;
  window: string;
  districts: string[];
  angle: { heading: string; body: string };
  faq: { q: string; a: string }[];
}

export const CITIES: City[] = [
  {
    slug: "catering-dietetyczny-jastrzebie-zdroj",
    name: "Jastrzębie-Zdrój",
    locative: "w Jastrzębiu-Zdroju",
    title: "Catering dietetyczny Jastrzębie-Zdrój | Dzika Kaczka",
    description:
      "Dieta pudełkowa z dostawą w Jastrzębiu-Zdroju. Standard, keto, low carb, bez glutenu i vege od 65 zł/dzień. Dowóz pod drzwi od 19:00.",
    lead:
      "Do Jastrzębia jedziemy jako do jednego z pierwszych miast na trasie — nasza kuchnia jest w Skrzyszowie, kwadrans drogi stąd. Dzięki temu posiłki trafiają pod drzwi wcześnie wieczorem, a nie po nocy.",
    window: "19:00 – 21:00",
    districts: ["Zdrój", "Zofiówka", "Osiedle Pionierów", "Arki Bożka", "Bzie", "Ruptawa", "Szeroka"],
    angle: {
      heading: "Praca zmianowa a regularne posiłki",
      body:
        "W Jastrzębiu spora część naszych klientów pracuje na zmiany. Przy takim rytmie najtrudniej nie jest schudnąć — najtrudniej jest ugotować cokolwiek sensownego po dwunastu godzinach na dole. Pudełka czekają w lodówce gotowe, więc plan nie rozsypuje się na trzeciej nocce z rzędu."
    },
    faq: [
      { q: "O której dostarczacie w Jastrzębiu?", a: "Zwykle między 19:00 a 21:00. Jastrzębie jest blisko kuchni, więc trafia na wczesną część trasy." },
      { q: "Dowozicie na Zofiówkę i Ruptawę?", a: "Tak, obsługujemy całe miasto łącznie z dzielnicami peryferyjnymi." },
      { q: "Co jeśli nie ma mnie w domu?", a: "Kurier zostawia paczkę pod drzwiami albo w miejscu, które wskażesz w zamówieniu. Wystarczy podać kod do klatki." }
    ]
  },
  {
    slug: "catering-dietetyczny-wodzislaw-slaski",
    name: "Wodzisław Śląski",
    locative: "w Wodzisławiu Śląskim",
    title: "Catering dietetyczny Wodzisław Śląski | Dzika Kaczka",
    description:
      "Dieta pudełkowa z dowozem w Wodzisławiu Śląskim i całym powiecie. Pięć rodzajów diet, od 1200 do 3000 kcal, dostawa w cenie.",
    lead:
      "Wodzisław to nasze podwórko. Kuchnia stoi w Skrzyszowie, kilka kilometrów stąd, więc trasa zaczyna się praktycznie za rogiem — posiłki jadą najkrócej ze wszystkich obsługiwanych miejscowości.",
    window: "19:00 – 21:00",
    districts: ["Centrum", "Nowe Miasto", "Wilchwy", "Radlin II", "Jedłownik", "Kokoszyce", "Zawada"],
    angle: {
      heading: "Cały powiat, nie tylko miasto",
      body:
        "Obok Wodzisławia dowozimy do Radlina, Rydułtów, Pszowa, Marklowic, Mszany, Godowa, Gorzyc i Lubomi. Jeśli mieszkasz w powiecie wodzisławskim, prawie na pewno jesteś w zasięgu — a jeśli Twojej miejscowości nie ma na liście, zadzwoń, bo trasy stale rozszerzamy."
    },
    faq: [
      { q: "Czy dowozicie do mniejszych miejscowości w powiecie?", a: "Tak. Obsługujemy Radlin, Rydułtowy, Pszów, Marklowice, Mszanę, Godów, Skrzyszów, Gorzyce i Lubomię." },
      { q: "Ile kosztuje dostawa?", a: "Nic. Dowóz jest wliczony w cenę diety na całym obsługiwanym obszarze." },
      { q: "Kiedy najpóźniej mogę zamówić?", a: "Do 12:00 na dwa dni robocze przed pierwszą dostawą. Później realizujemy w miarę możliwości kuchni." }
    ]
  },
  {
    slug: "catering-dietetyczny-rybnik",
    name: "Rybnik",
    locative: "w Rybniku",
    title: "Catering dietetyczny Rybnik | Dzika Kaczka",
    description:
      "Dieta pudełkowa z dostawą w Rybniku. Catering tworzony przez restauratorów — restauracyjny smak, policzone kalorie, dowóz pod drzwi.",
    lead:
      "W Rybniku wyboru cateringów nie brakuje. Nas odróżnia to, skąd pochodzimy: prowadzimy restaurację i to z jej kuchni wychodzą te posiłki. Diety układa ktoś, kto na co dzień gotuje dla gości przy stoliku, a nie tylko liczy makro w arkuszu.",
    window: "20:00 – 22:00",
    districts: ["Śródmieście", "Boguszowice", "Niedobczyce", "Chwałowice", "Maroko-Nowiny", "Paruszowiec", "Zamysłów"],
    angle: {
      heading: "Dlaczego smakuje inaczej",
      body:
        "Większość cateringów dietetycznych gotuje pod tabelę kalorii i dopiero potem próbuje to uratować przyprawami. My zaczynamy od dania, które chcielibyśmy podać w restauracji, a dopiero potem dopasowujemy gramatury. Stąd sosy, które faktycznie mają smak, i mięso, którego nie trzeba popijać."
    },
    faq: [
      { q: "O której dowozicie do Rybnika?", a: "Orientacyjnie między 20:00 a 22:00 — Rybnik jest na dalszej części trasy." },
      { q: "Czy mogę zmienić dietę w trakcie?", a: "Tak, zadzwoń najpóźniej do 12:00 na dwa dni robocze przed dniem, od którego ma obowiązywać zmiana." },
      { q: "Ile posiłków jest w zestawie?", a: "Do wyboru trzy, cztery albo pięć posiłków dziennie — wybierasz przy zamówieniu." }
    ]
  },
  {
    slug: "catering-dietetyczny-zory",
    name: "Żory",
    locative: "w Żorach",
    title: "Catering dietetyczny Żory | Dzika Kaczka",
    description:
      "Dieta pudełkowa z dowozem w Żorach. Standard, keto, low carb, bez glutenu i vege od 65 zł/dzień. Dostawa pod drzwi w cenie.",
    lead:
      "Do Żor dojeżdżamy przez Jastrzębie, na dalszej części trasy. Posiłki trafiają pod drzwi wieczorem, gotowe na następny dzień — wystarczy przełożyć je do lodówki.",
    window: "20:00 – 22:00",
    districts: ["Śródmieście", "Osiedle Sikorskiego", "Osiedle Korfantego", "Osiedle Pawlikowskiego", "Księcia Władysława", "Rogoźna", "Baranowice"],
    angle: {
      heading: "Catering do zakładu pracy",
      body:
        "W Żorach działa strefa ekonomiczna i coraz częściej dowozimy nie pod dom, a pod zakład. Jeśli chcecie zamówić diety dla kilku osób pod jeden adres, zadzwońcie — przy większej liczbie zestawów ustalamy indywidualne warunki."
    },
    faq: [
      { q: "Dowozicie pod adres firmowy?", a: "Tak. Wystarczy podać adres zakładu i godziny, w których ktoś odbierze paczkę." },
      { q: "Czy dieta jest dostępna w weekendy?", a: "Tak, dostawy realizujemy również w soboty i niedziele — wybierasz to przy zamówieniu." },
      { q: "Jak długo posiłki są świeże?", a: "Przygotowujemy je na konkretny dzień. Po odbiorze trzymaj je w lodówce w temperaturze 2–8°C i zjedz tego dnia." }
    ]
  }
];

export function cityBySlug(slug: string) {
  return CITIES.find(c => c.slug === slug);
}
