import type { City } from "@/lib/cities";
import { ALL_LOCALITY_NAMES } from "@/lib/deliveryZones";

const DIETS = ["Standard", "Keto", "Low Carb", "Bez glutenu", "Bez laktozy", "Vege"];
const PRICES: [number, number][] = [
  [1200, 65], [1300, 69], [1400, 73], [1500, 76], [1600, 79], [1800, 84],
  [2000, 89], [2100, 91], [2200, 93], [2500, 99], [3000, 109]
];

export function CityPage({ city }: { city: City }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: `Dzika Kaczka Catering — ${city.name}`,
    description: city.description,
    url: `https://www.dzikakaczkacatering.pl/${city.slug}`,
    telephone: "+48884004321",
    priceRange: "65-109 PLN",
    address: {
      "@type": "PostalAddress",
      streetAddress: "ul. 1 Maja 65",
      addressLocality: "Skrzyszów",
      postalCode: "44-348",
      addressCountry: "PL"
    },
    areaServed: { "@type": "City", name: city.name },
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: city.faq.map(f => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a }
      }))
    }
  };

  return (
    <main className="cityPage">
      <style>{`body{background:#050505}`}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="legalNav">
        <a href="/">← Wróć do sklepu</a>
      </nav>

      <header className="cityHead">
        <small>CATERING DIETETYCZNY</small>
        <h1>Catering dietetyczny {city.locative}</h1>
        <p>{city.lead}</p>
        <div className="cityFacts">
          <div><b>{city.window}</b><span>okno dostaw</span></div>
          <div><b>od 65 zł</b><span>za dzień</span></div>
          <div><b>5 diet</b><span>do wyboru</span></div>
          <div><b>0 zł</b><span>za dowóz</span></div>
        </div>
        <a className="redBtn" href="/#zamow">Zamów dietę</a>
      </header>

      <section className="cityBlock">
        <h2>{city.angle.heading}</h2>
        <p>{city.angle.body}</p>
      </section>

      <section className="cityBlock">
        <h2>Gdzie dowozimy {city.locative}</h2>
        <p className="cityDistricts">{city.districts.join(" · ")}</p>
        <p className="cityMuted">
          Nie ma Twojej dzielnicy? Zadzwoń pod <a href="tel:+48884004321">884 004 321</a> —
          obsługujemy całe miasto, a listę podajemy poglądowo.
        </p>
      </section>

      <section className="cityBlock">
        <h2>Diety i ceny</h2>
        <p className="cityDiets">{DIETS.join(" · ")}</p>
        <div className="cityPrices">
          {PRICES.map(([kcal, price]) => (
            <div key={kcal}><b>{kcal} kcal</b><span>{price} zł / dzień</span></div>
          ))}
        </div>
        <p className="cityMuted">
          Nie wiesz, ile kcal wybrać? W formularzu zamówienia znajdziesz kalkulator zapotrzebowania.
          Możesz też zobaczyć <a href="/jadlospis">przykładowy jadłospis</a>.
        </p>
      </section>

      <section className="cityBlock">
        <h2>Częste pytania — {city.name}</h2>
        <div className="cityFaq">
          {city.faq.map(f => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cityBlock">
        <h2>Pozostałe miejscowości</h2>
        <p className="cityMuted">{ALL_LOCALITY_NAMES.join(" · ")}</p>
      </section>

      <footer className="cityCta">
        <h2>Zaczynamy?</h2>
        <p>Wybierz dietę, kaloryczność i datę startu. Resztą zajmujemy się my.</p>
        <a className="redBtn" href="/#zamow">Zamów dietę</a>
      </footer>
    </main>
  );
}
