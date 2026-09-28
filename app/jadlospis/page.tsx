import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Przykładowy jadłospis | Dzika Kaczka Catering",
  description:
    "Zobacz, co jesz na diecie Standard, Keto, Low Carb, bez glutenu, bez laktozy i Vege. Przykładowy dzień z rozpisaną kalorycznością każdego posiłku.",
  alternates: { canonical: "/jadlospis" }
};

type Meal = { slot: string; name: string; desc: string; kcal: number };
type Menu = { diet: string; tag: string; intro: string; meals: Meal[] };

// UWAGA: to są przykłady poglądowe. Podmień na dania, które faktycznie
// wychodzą z kuchni — klient porówna to z tym, co dostanie w pudełku.
const MENUS: Menu[] = [
  {
    diet: "Standard",
    tag: "Najpopularniejsza",
    intro: "Klasyczna kuchnia bez wyrzeczeń. To, co podajemy w restauracji, tylko policzone.",
    meals: [
      { slot: "Śniadanie", name: "Jajecznica na maśle klarowanym", desc: "z pieczywem żytnim na zakwasie, pomidorem malinowym i szczypiorkiem", kcal: 480 },
      { slot: "Drugie śniadanie", name: "Skyr z owocami", desc: "z borówkami, prażonym słonecznikiem i łyżką miodu gryczanego", kcal: 260 },
      { slot: "Obiad", name: "Pierś z kurczaka po myśliwsku", desc: "z sosem z podgrzybków, kaszą pęczak i surówką z czerwonej kapusty", kcal: 690 },
      { slot: "Podwieczorek", name: "Marchewka z hummusem", desc: "słupki marchwi i papryki z domowym hummusem", kcal: 190 },
      { slot: "Kolacja", name: "Sałatka z pieczonym łososiem", desc: "z rukolą, ogórkiem, oliwkami i dressingiem cytrynowym", kcal: 380 }
    ]
  },
  {
    diet: "Keto",
    tag: "Wysokotłuszczowa",
    intro: "Poniżej 30 g węglowodanów dziennie. Dużo dobrego tłuszczu, zero kompromisów w smaku.",
    meals: [
      { slot: "Śniadanie", name: "Omlet z boczkiem i awokado", desc: "z serem cheddar i kiełkami rzodkiewki", kcal: 520 },
      { slot: "Drugie śniadanie", name: "Deska serów", desc: "camembert, orzechy włoskie i kilka oliwek", kcal: 280 },
      { slot: "Obiad", name: "Kaczka konfitowana", desc: "z puree z kalafiora na maśle i duszoną czerwoną kapustą", kcal: 720 },
      { slot: "Podwieczorek", name: "Jajka faszerowane", desc: "z pastą z tuńczyka i majonezem domowym", kcal: 210 },
      { slot: "Kolacja", name: "Krewetki na maśle czosnkowym", desc: "z cukinią z grilla i sosem aioli", kcal: 350 }
    ]
  },
  {
    diet: "Low Carb",
    tag: "Mniej węglowodanów",
    intro: "Węglowodany ograniczone, ale nie wycięte. Dobra dieta na redukcję bez uczucia głodu.",
    meals: [
      { slot: "Śniadanie", name: "Twarożek ze szczypiorkiem", desc: "z rzodkiewką, ogórkiem i kromką chleba proteinowego", kcal: 430 },
      { slot: "Drugie śniadanie", name: "Koktajl truskawkowy", desc: "na jogurcie greckim z siemieniem lnianym", kcal: 240 },
      { slot: "Obiad", name: "Schab pieczony w ziołach", desc: "z pieczoną dynią i mizerią na jogurcie", kcal: 650 },
      { slot: "Podwieczorek", name: "Serek wiejski z pomidorkami", desc: "z bazylią i oliwą z pierwszego tłoczenia", kcal: 200 },
      { slot: "Kolacja", name: "Sałatka cezar z kurczakiem", desc: "z parmezanem i dressingiem na jogurcie, bez grzanek", kcal: 400 }
    ]
  },
  {
    diet: "Bez glutenu",
    tag: "Gluten free",
    intro: "Pełne dania bez zbóż glutenowych. Przygotowywane z uwagą na skażenie krzyżowe.",
    meals: [
      { slot: "Śniadanie", name: "Owsianka jaglana na mleku kokosowym", desc: "z bananem, masłem migdałowym i cynamonem", kcal: 470 },
      { slot: "Drugie śniadanie", name: "Kanapki na chlebie gryczanym", desc: "z pastą jajeczną i rzeżuchą", kcal: 250 },
      { slot: "Obiad", name: "Dorsz pieczony w papilotach", desc: "z ziemniakami z koperkiem i fasolką szparagową", kcal: 680 },
      { slot: "Podwieczorek", name: "Sałatka owocowa", desc: "z jogurtem kokosowym i wiórkami migdałowymi", kcal: 200 },
      { slot: "Kolacja", name: "Kotleciki z indyka", desc: "z ryżem basmati i surówką z marchwi i jabłka", kcal: 400 }
    ]
  },
  {
    diet: "Bez laktozy",
    tag: "Lactose free",
    intro: "Ta sama kuchnia, bez mleka i przetworów. Nabiał podmieniamy, nie wycinamy dania.",
    meals: [
      { slot: "Śniadanie", name: "Tofucznica z warzywami", desc: "z papryką, szpinakiem i pieczywem orkiszowym", kcal: 470 },
      { slot: "Drugie śniadanie", name: "Pudding chia na napoju kokosowym", desc: "z malinami i cynamonem", kcal: 260 },
      { slot: "Obiad", name: "Dorsz w sosie cytrynowym", desc: "z ziemniakami z koperkiem i fasolką szparagową", kcal: 690 },
      { slot: "Podwieczorek", name: "Guacamole z warzywami", desc: "awokado z pomidorem i limonką, marchew i papryka do maczania", kcal: 190 },
      { slot: "Kolacja", name: "Sałatka z grillowanym kurczakiem", desc: "z awokado, rukolą i oliwą z pierwszego tłoczenia", kcal: 390 }
    ]
  },
  {
    diet: "Vege",
    tag: "Roślinnie",
    intro: "Bez mięsa, ale z pełnym kompletem białka. Warzywa w roli głównej, nie dodatku.",
    meals: [
      { slot: "Śniadanie", name: "Tofucznica z kurkumą", desc: "z pieczywem orkiszowym, pomidorem i awokado", kcal: 490 },
      { slot: "Drugie śniadanie", name: "Koktajl szpinakowy", desc: "z bananem, mango i mlekiem owsianym", kcal: 250 },
      { slot: "Obiad", name: "Curry z ciecierzycą", desc: "na mleku kokosowym, z ryżem jaśminowym i kolendrą", kcal: 700 },
      { slot: "Podwieczorek", name: "Edamame z solą morską", desc: "z pastą z pieczonej papryki", kcal: 190 },
      { slot: "Kolacja", name: "Sałatka z soczewicą", desc: "z pieczonym batatem, rukolą i orzechami włoskimi", kcal: 370 }
    ]
  }
];

export default function JadlospisPage() {
  return (
    <main className="menuPublic">
      <style>{`body{background:#050505}`}</style>
      <nav className="legalNav">
        <a href="/">← Wróć do sklepu</a>
      </nav>

      <header className="menuPublicHead">
        <small>JADŁOSPIS</small>
        <h1>Zobacz, co będziesz jeść.</h1>
        <p>
          Poniżej przykładowy dzień z każdej diety, w wariancie 2000 kcal i pięciu posiłkach.
          Do wyboru są też warianty trzy- i czteroposiłkowe. Przy innej kaloryczności zmieniają się
          gramatury, nie dania. Jadłospis układamy tygodniami i nie powtarzamy dań częściej
          niż raz na dwa tygodnie.
        </p>
      </header>

      {MENUS.map(menu => (
        <section className="menuBlock" key={menu.diet}>
          <div className="menuBlockHead">
            <h2>{menu.diet}</h2>
            <span className="menuTag">{menu.tag}</span>
          </div>
          <p className="menuIntro">{menu.intro}</p>

          <ol className="mealList">
            {menu.meals.map(m => (
              <li key={m.slot}>
                <div className="mealSlot">{m.slot}</div>
                <div className="mealBody">
                  <b>{m.name}</b>
                  <span>{m.desc}</span>
                </div>
                <div className="mealKcal">{m.kcal} kcal</div>
              </li>
            ))}
          </ol>

          <div className="menuSum">
            Razem: <b>{menu.meals.reduce((s, m) => s + m.kcal, 0)} kcal</b> w pięciu posiłkach
          </div>
        </section>
      ))}

      <section className="menuNote">
        <h2>Dobrze wiedzieć</h2>
        <p>
          Jadłospis układamy z sezonowych produktów, więc konkretne dania zmieniają się w ciągu roku.
          Wykluczenia żywieniowe podane w zamówieniu uwzględniamy przy każdym posiłku — podmieniamy
          składnik, nie rezygnujemy z dania.
        </p>
        <p>
          Posiłki powstają w kuchni, w której przetwarzamy między innymi gluten, mleko, jaja, ryby,
          soję, orzechy i seler. Przy alergii zagrażającej zdrowiu zadzwoń do nas przed zamówieniem.
        </p>
      </section>

      <footer className="menuPublicCta">
        <h2>Brzmi dobrze?</h2>
        <p>Wybierz dietę i kaloryczność, resztę ogarniamy my.</p>
        <a className="redBtn" href="/#zamow">Zamów dietę</a>
      </footer>
    </main>
  );
}
