import type { Metadata } from "next";
import { SMAKI, SHAKE_CENA_Z_DIETA, SHAKE_CENA_OSOBNO } from "@/lib/shake";

export const metadata: Metadata = {
  title: "Shake proteinowy 30 g białka | Dzika Kaczka Catering",
  description:
    "Shake proteinowy 300 ml z 30 g białka, robiony na prawdziwych owocach w naszej kuchni. Cztery smaki, w tym wegański. Dowozimy razem z dietą.",
  alternates: { canonical: "/shake" }
};

export default function ShakePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Shake proteinowy Dzika Kaczka",
    description: "Shake proteinowy 300 ml z 30 g białka, na mleku i prawdziwych owocach.",
    brand: { "@type": "Brand", name: "Dzika Kaczka Catering" },
    offers: {
      "@type": "Offer",
      price: SHAKE_CENA_OSOBNO,
      priceCurrency: "PLN",
      availability: "https://schema.org/InStock"
    }
  };

  return (
    <main className="shakePage">
      <style>{`body{background:#050505}`}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="legalNav"><a href="/">← Wróć do sklepu</a></nav>

      <section className="shakeHero">
        <div>
          <small className="sekcjaEtykieta">SHAKE PROTEINOWY</small>
          <h1>Posiłek, nie napój.<br /><em>30 g białka</em> w 300 ml.</h1>
          <p>
            Robimy je w tej samej kuchni, z której wychodzą nasze diety — na mleku
            i prawdziwych owocach, nie na samej wodzie z odżywką. Jedna butelka
            spokojnie zastępuje drugie śniadanie.
          </p>
          <div className="shakeCta">
            <a className="redBtn" href="/#zamow">Dorzuć do diety — {SHAKE_CENA_Z_DIETA} zł</a>
            <a className="ghostBtn" href="tel:+48884004321">Zamów bez diety — {SHAKE_CENA_OSOBNO} zł</a>
          </div>
          <div className="shakeFakty">
            <div><b>30 g</b><span>białka w butelce</span></div>
            <div><b>~240 kcal</b><span>pełny posiłek</span></div>
            <div><b>300 ml</b><span>gotowy do picia</span></div>
            <div><b>0 g</b><span>cukru dodanego</span></div>
          </div>
        </div>
        <figure>
          <img src="/shake/klientka.jpg" alt="Shake proteinowy Dzika Kaczka w dłoni" />
        </figure>
      </section>

      <section className="shakeSekcja">
        <small className="sekcjaEtykieta">SMAKI</small>
        <h2>Cztery do wyboru</h2>
        <div className="smakiSiatka">
          {SMAKI.map(s => (
            <article className="smakKafel" key={s.id}>
              <img src={s.obraz} alt={s.nazwa} loading="lazy" />
              <h3>{s.nazwa}</h3>
              <span>{s.opis}</span>
              <b>30 g białka</b>
            </article>
          ))}
        </div>
      </section>

      <section className="shakeSekcja">
        <small className="sekcjaEtykieta">WARTOŚCI ODŻYWCZE</small>
        <h2>Co jest w butelce</h2>
        <div className="odzywczeScroll">
          <table className="odzywcze">
            <thead>
              <tr>
                <th>Na 100 ml</th>
                {SMAKI.map(s => <th key={s.id}>{s.nazwa}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr><td>Energia</td>{SMAKI.map(s => <td key={s.id}>{s.kcal} kcal</td>)}</tr>
              <tr><td>Białko</td>{SMAKI.map(s => <td key={s.id}><b>{s.bialko.toFixed(1)} g</b></td>)}</tr>
              <tr><td>Tłuszcz</td>{SMAKI.map(s => <td key={s.id}>{s.tluszcz.toFixed(1)} g</td>)}</tr>
              <tr><td>Węglowodany</td>{SMAKI.map(s => <td key={s.id}>{s.wegle.toFixed(1)} g</td>)}</tr>
              <tr><td>w tym cukry</td>{SMAKI.map(s => <td key={s.id}>{s.cukry.toFixed(1)} g</td>)}</tr>
              <tr><td>Błonnik</td>{SMAKI.map(s => <td key={s.id}>{s.blonnik.toFixed(1)} g</td>)}</tr>
              <tr><td>Sól</td>{SMAKI.map(s => <td key={s.id}>{s.sol.toFixed(2)} g</td>)}</tr>
            </tbody>
          </table>
        </div>

        <div className="skladList">
          {SMAKI.map(s => (
            <details key={s.id}>
              <summary>{s.nazwa} — skład</summary>
              <p>{s.sklad}.</p>
              <p className="alergen"><b>{s.alergeny}</b></p>
            </details>
          ))}
        </div>
        <p className="shakeMuted">
          Przechowywać w temperaturze 2–8°C. Przed spożyciem wstrząsnąć.
          Po otwarciu spożyć w ciągu 24 godzin.
        </p>
      </section>

      <section className="shakeStopka">
        <h2>Dorzuć do najbliższego zamówienia</h2>
        <p>Przyjadą razem z dietą, tym samym kurierem. Bez dodatkowej opłaty za dowóz.</p>
        <a className="redBtn" href="/#zamow">Zamów dietę z shakami</a>
      </section>
    </main>
  );
}
