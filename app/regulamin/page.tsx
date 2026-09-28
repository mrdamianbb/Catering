import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regulamin sklepu | Dzika Kaczka Catering",
  description: "Regulamin sprzedaży cateringu dietetycznego Dzika Kaczka Catering — zamówienia, płatności, dostawy, anulowanie i reklamacje.",
  alternates: { canonical: "/regulamin" }
};

const UPDATED = "8 września 2026";

export default function RegulaminPage() {
  return (
    <main className="legalPage">
      <style>{`body{background:#050505}`}</style>
      <nav className="legalNav">
        <a href="/">← Wróć do sklepu</a>
      </nav>

      <header className="legalHead">
        <small>DOKUMENTY</small>
        <h1>Regulamin sklepu</h1>
        <p>Obowiązuje od {UPDATED}</p>
      </header>

      <section className="legalBody">
        <h2>§1. Postanowienia ogólne</h2>
        <p>
          Sklep internetowy działający pod adresem dzikakaczkacatering.pl prowadzi <b>FHU Damian Balcar</b>,
          ul. 1 Maja 65, 44-348 Skrzyszów, NIP 6472583650 (dalej „Sprzedawca").
        </p>
        <p>
          Kontakt: telefon 884 004 321, e-mail kontakt@balcar.com.pl. Kontakt telefoniczny możliwy
          jest w godzinach pracy Sprzedawcy; wiadomości e-mail rozpatrujemy w dni robocze.
        </p>
        <p>
          Regulamin określa zasady zamawiania, opłacania i dostarczania posiłków w ramach cateringu
          dietetycznego, a także zasady anulowania zamówień i składania reklamacji.
        </p>
        <p>
          Klientem może być osoba fizyczna posiadająca pełną zdolność do czynności prawnych, osoba prawna
          lub jednostka organizacyjna nieposiadająca osobowości prawnej.
        </p>

        <h2>§2. Przedmiot usługi</h2>
        <p>
          Sprzedawca przygotowuje i dostarcza zestawy posiłków w wybranym przez Klienta wariancie diety
          i kaloryczności, na wskazany adres i w wybranym okresie.
        </p>
        <p>
          Posiłki produkowane są w zakładzie, w którym przetwarzane są między innymi zboża zawierające gluten,
          mleko, jaja, soja, orzechy, seler, gorczyca, sezam, ryby i skorupiaki. <b>Nie możemy wykluczyć
          śladowej obecności alergenów</b> nawet w dietach z zadeklarowanym wykluczeniem. Klient z alergią
          zagrażającą zdrowiu powinien skonsultować zamówienie ze Sprzedawcą przed jego złożeniem.
        </p>
        <p>
          Catering dietetyczny nie jest usługą medyczną ani formą leczenia. Osoby chorujące przewlekle,
          kobiety w ciąży i karmiące piersią powinny dobrać kaloryczność i rodzaj diety z lekarzem
          lub dietetykiem.
        </p>

        <h2>§3. Składanie zamówień i zawarcie umowy</h2>
        <p>
          Zamówienie składa się przez formularz w sklepie. Klient wybiera wariant diety, kaloryczność,
          liczbę dni, datę startu i dni dostaw, podaje dane kontaktowe i adres dostawy oraz akceptuje
          niniejszy Regulamin.
        </p>
        <p>
          <b>Umowa zostaje zawarta z chwilą otrzymania przez Klienta potwierdzenia przyjęcia zamówienia</b>,
          wysyłanego przez Sprzedawcę po weryfikacji zamówienia oraz po zaksięgowaniu płatności.
          Samo wypełnienie formularza nie jest równoznaczne z zawarciem umowy.
        </p>
        <p>
          Sprzedawca może odmówić przyjęcia zamówienia, w szczególności gdy adres dostawy znajduje się
          poza obszarem obsługiwanym, dane są niekompletne lub realizacja jest niemożliwa z przyczyn
          organizacyjnych. O odmowie Klient jest informowany niezwłocznie, a wpłacone środki są zwracane
          w całości.
        </p>
        <p>
          Zamówienia przyjmujemy najpóźniej <b>do godziny 12:00 na dwa dni robocze przed pierwszą dostawą</b>.
          Zamówienia złożone później realizujemy w miarę możliwości produkcyjnych.
        </p>

        <h2>§4. Ceny i płatności</h2>
        <p>
          Ceny podane w sklepie są cenami brutto w złotych polskich i zawierają koszt dostawy na obszarze
          obsługiwanym przez Sprzedawcę.
        </p>
        <p>
          Płatność następuje z góry, za cały zamówiony okres, przelewem elektronicznym, BLIK-iem lub kartą
          za pośrednictwem operatora <b>Przelewy24</b> (PayPro S.A. z siedzibą w Poznaniu). Rozliczenia
          obsługuje operator płatności; Sprzedawca nie przechowuje danych kart płatniczych.
        </p>
        <p>
          Jeżeli płatność nie zostanie zaksięgowana w ciągu 24 godzin od złożenia zamówienia, zamówienie
          uznaje się za niezłożone.
        </p>
        <p>
          Rabaty z kodów promocyjnych nie łączą się, chyba że warunki promocji stanowią inaczej.
          Faktura wystawiana jest na życzenie Klienta zgłoszone przy składaniu zamówienia.
        </p>

        <h2>§5. Dostawy</h2>
        <p>
          Dostawy realizujemy <b>od godziny 19:00</b>, w dniu poprzedzającym dzień spożycia posiłków,
          na adres wskazany w zamówieniu. Dokładna godzina zależy od trasy kuriera.
        </p>
        <p>
          Klient zobowiązany jest zapewnić możliwość odbioru: podać poprawny adres, numer telefonu oraz
          ewentualny kod do klatki lub instrukcję dostępu. Jeżeli odbiór osobisty nie jest możliwy,
          posiłki mogą zostać pozostawione pod drzwiami — na ryzyko Klienta.
        </p>
        <p>
          W razie nieudanej dostawy z przyczyn leżących po stronie Klienta (błędny adres, brak dostępu,
          brak kontaktu telefonicznego) <b>zamówienie uznaje się za zrealizowane</b>, a jego wartość
          nie podlega zwrotowi.
        </p>
        <p>
          Posiłki należy niezwłocznie po odbiorze przechowywać w lodówce, w temperaturze 2–8°C, i spożyć
          w dniu, na który zostały przygotowane.
        </p>
        <p>
          Sprzedawca nie odpowiada za opóźnienia wynikające z okoliczności od niego niezależnych, takich jak
          warunki pogodowe, zamknięcia dróg czy awarie. O istotnych opóźnieniach informujemy telefonicznie
          lub SMS-em.
        </p>

        <h2>§6. Zmiana i anulowanie zamówienia</h2>
        <p>
          Klient może zawiesić dostawę na wybrany dzień, przesunąć termin lub zmienić adres,
          zgłaszając to <b>najpóźniej do godziny 12:00 na dwa dni robocze przed dniem dostawy</b>.
          Zgłoszenia przyjmujemy telefonicznie pod numerem 884 004 321 lub mailowo na kontakt@balcar.com.pl.
        </p>
        <p>
          Zgłoszenia po tym terminie nie mogą zostać uwzględnione, ponieważ posiłki są już w produkcji.
          Dzień taki traktowany jest jako zrealizowany.
        </p>
        <p>
          Dni zawieszone prawidłowo nie przepadają — przedłużają okres obowiązywania zamówienia
          o tę samą liczbę dni. Niewykorzystane dni zachowują ważność przez <b>6 miesięcy</b>
          od daty zakończenia pierwotnego okresu.
        </p>
        <p>
          Klient może zrezygnować z pozostałej części zamówienia. Sprzedawca zwraca wówczas wartość
          niewykorzystanych dni, przeliczoną według ceny obowiązującej dla faktycznie zrealizowanej liczby dni,
          pomniejszoną o wykorzystane rabaty ilościowe. Zwrot następuje w ciągu 14 dni na ten sam
          rachunek, z którego dokonano płatności.
        </p>

        <h2>§7. Prawo odstąpienia od umowy</h2>
        <p>
          Zgodnie z art. 38 ustawy o prawach konsumenta, <b>prawo odstąpienia od umowy zawartej na odległość
          nie przysługuje</b> w odniesieniu do umów, których przedmiotem jest rzecz ulegająca szybkiemu
          zepsuciu lub mająca krótki termin przydatności do spożycia, a także w odniesieniu do usług
          gastronomicznych realizowanych w oznaczonym dniu.
        </p>
        <p>
          Nie ogranicza to uprawnień Klienta wynikających z §6 niniejszego Regulaminu ani prawa
          do reklamacji.
        </p>

        <h2>§8. Reklamacje</h2>
        <p>
          Reklamacje dotyczące jakości posiłków należy zgłaszać <b>w dniu dostawy</b>, telefonicznie
          pod numerem 884 004 321 lub mailowo na kontakt@balcar.com.pl. Reklamacje dotyczące niedostarczenia
          zamówienia — niezwłocznie po upływie deklarowanego okna dostawy.
        </p>
        <p>
          W zgłoszeniu prosimy podać imię i nazwisko, adres dostawy, datę oraz opis zastrzeżeń.
          Pomocne jest dołączenie zdjęcia. Prosimy o zachowanie reklamowanego posiłku do czasu
          rozpatrzenia zgłoszenia.
        </p>
        <p>
          Reklamacje rozpatrujemy w terminie <b>14 dni</b> od otrzymania zgłoszenia. W przypadku uznania
          reklamacji Sprzedawca, w uzgodnieniu z Klientem, wymienia posiłek, przedłuża okres diety
          o dzień lub zwraca wartość reklamowanego dnia.
        </p>

        <h2>§9. Dane osobowe</h2>
        <p>
          Administratorem danych osobowych jest FHU Damian Balcar, ul. 1 Maja 65, 44-348 Skrzyszów,
          NIP 6472583650. Zasady przetwarzania opisuje Polityka prywatności dostępna
          pod adresem <a href="/polityka-prywatnosci">dzikakaczkacatering.pl/polityka-prywatnosci</a>.
        </p>

        <h2>§10. Postanowienia końcowe</h2>
        <p>
          W sprawach nieuregulowanych stosuje się przepisy prawa polskiego, w szczególności Kodeksu cywilnego
          oraz ustawy o prawach konsumenta.
        </p>
        <p>
          Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń,
          w tym z platformy internetowego rozstrzygania sporów dostępnej
          pod adresem ec.europa.eu/consumers/odr, a także z pomocy powiatowego rzecznika konsumentów.
        </p>
        <p>
          Sprzedawca zastrzega sobie prawo zmiany Regulaminu. Do zamówień złożonych przed zmianą stosuje się
          Regulamin w brzmieniu obowiązującym w chwili składania zamówienia. O zmianach informujemy
          na stronie sklepu.
        </p>
      </section>

      <footer className="legalFoot">
        <a className="redBtn" href="/">Wróć do sklepu</a>
      </footer>
    </main>
  );
}
