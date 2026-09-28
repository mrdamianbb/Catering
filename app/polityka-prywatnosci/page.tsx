import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polityka prywatności | Dzika Kaczka Catering",
  description: "Jak przetwarzamy dane osobowe klientów cateringu dietetycznego Dzika Kaczka Catering.",
  alternates: { canonical: "/polityka-prywatnosci" }
};

const UPDATED = "8 września 2026";

export default function PolitykaPage() {
  return (
    <main className="legalPage">
      <style>{`body{background:#050505}`}</style>
      <nav className="legalNav">
        <a href="/">← Wróć do sklepu</a>
      </nav>

      <header className="legalHead">
        <small>DOKUMENTY</small>
        <h1>Polityka prywatności</h1>
        <p>Obowiązuje od {UPDATED}</p>
      </header>

      <section className="legalBody">
        <h2>Administrator danych</h2>
        <p>
          Administratorem Twoich danych osobowych jest <b>FHU Damian Balcar</b>, ul. 1 Maja 65,
          44-348 Skrzyszów, NIP 6472583650. Kontakt w sprawach danych: kontakt@balcar.com.pl,
          telefon 884 004 321.
        </p>

        <h2>Jakie dane zbieramy</h2>
        <p>
          Imię i nazwisko, numer telefonu, adres e-mail, adres dostawy wraz z ewentualnym kodem do klatki,
          wybrany wariant diety i kaloryczność, informacje o wykluczeniach żywieniowych podane w zamówieniu
          oraz historia zamówień i płatności.
        </p>
        <p>
          Podanie tych danych jest dobrowolne, ale niezbędne do realizacji zamówienia — bez nich
          nie dowieziemy posiłków.
        </p>

        <h2>Po co i na jakiej podstawie</h2>
        <p>
          <b>Realizacja umowy</b> (art. 6 ust. 1 lit. b RODO) — przyjęcie i wykonanie zamówienia,
          produkcja posiłków, dostawa, kontakt w sprawie zamówienia, obsługa reklamacji.
        </p>
        <p>
          <b>Obowiązek prawny</b> (art. 6 ust. 1 lit. c RODO) — wystawianie i przechowywanie dokumentów
          księgowych.
        </p>
        <p>
          <b>Prawnie uzasadniony interes</b> (art. 6 ust. 1 lit. f RODO) — dochodzenie i obrona przed
          roszczeniami, zapewnienie bezpieczeństwa sklepu.
        </p>
        <p>
          Informacje o wykluczeniach żywieniowych przetwarzamy wyłącznie po to, by przygotować właściwy
          posiłek. Trafiają one do kuchni w zakresie niezbędnym do produkcji.
        </p>

        <h2>Jak długo przechowujemy</h2>
        <p>
          Dane zamówień — przez okres realizacji, a następnie do upływu terminu przedawnienia roszczeń,
          czyli co do zasady <b>6 lat</b>. Dokumenty księgowe — <b>5 lat</b> licząc od końca roku
          podatkowego. Korespondencję niezwiązaną z zamówieniem — do <b>12 miesięcy</b>.
        </p>

        <h2>Komu przekazujemy dane</h2>
        <p>
          Operatorowi płatności <b>PayPro S.A.</b> (Przelewy24) — w zakresie potrzebnym do rozliczenia
          transakcji. Dostawcy usługi SMS <b>SMSAPI</b> — numer telefonu, w celu wysłania powiadomienia
          o dostawie. Dostawcom infrastruktury informatycznej: <b>Vercel</b> (hosting)
          oraz <b>Supabase</b> (baza danych). Biuru rachunkowemu — w zakresie dokumentów księgowych.
          Kurierom realizującym dostawę — dane adresowe i numer telefonu.
        </p>
        <p>
          Część dostawców może przetwarzać dane poza Europejskim Obszarem Gospodarczym. Odbywa się to
          na podstawie standardowych klauzul umownych zatwierdzonych przez Komisję Europejską.
        </p>
        <p>
          Nie sprzedajemy danych i nie przekazujemy ich do celów marketingowych podmiotom trzecim.
        </p>

        <h2>Twoje prawa</h2>
        <p>
          Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania,
          przenoszenia oraz <b>wniesienia sprzeciwu</b> wobec przetwarzania opartego na prawnie
          uzasadnionym interesie.
        </p>
        <p>
          Żądania kierować możesz na kontakt@balcar.com.pl. Odpowiadamy w terminie miesiąca.
        </p>
        <p>
          Przysługuje Ci również prawo wniesienia skargi do <b>Prezesa Urzędu Ochrony Danych Osobowych</b>,
          ul. Stawki 2, 00-193 Warszawa.
        </p>

        <h2>Pliki cookies</h2>
        <p>
          Sklep korzysta z plików cookies niezbędnych do jego działania — utrzymania sesji i zapamiętania
          zawartości formularza. Cookies niezbędne nie wymagają zgody.
        </p>
        <p>
          Ustawienia cookies możesz zmienić w swojej przeglądarce. Ich zablokowanie może uniemożliwić
          złożenie zamówienia.
        </p>

        <h2>Zautomatyzowane decyzje</h2>
        <p>
          Nie podejmujemy wobec Ciebie decyzji opartych wyłącznie na zautomatyzowanym przetwarzaniu,
          w tym profilowaniu.
        </p>
      </section>

      <footer className="legalFoot">
        <a className="redBtn" href="/">Wróć do sklepu</a>
      </footer>
    </main>
  );
}
