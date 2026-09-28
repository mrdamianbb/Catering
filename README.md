# Dzika Kaczka Catering

Sklep, panel administracyjny i moduł kuchni dla cateringu dietetycznego.
Next.js 15 + Supabase, hostowane na Vercelu.

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env.local   # uzupełnij własnymi wartościami
npm run dev
```

## Struktura

| Katalog | Co zawiera |
|---|---|
| `app/sklep` | strona sprzedażowa i formularz zamówienia |
| `app/zamow` | ten sam formularz pod osobnym adresem |
| `app/panel` | panel administratora: diety, klienci, produkcja, koszty |
| `app/menu` | moduł kuchni: układanie tygodnia, produkcja, etykiety |
| `app/shake` | podstrona shake'ów proteinowych |
| `app/api` | zamówienia, płatności, SMS, układanie menu |
| `lib` | wspólna logika — patrz niżej |
| `supabase` | migracje i zapytania pomocnicze (uruchamiane ręcznie) |

## Wspólna logika — jedno źródło prawdy

Te pliki są używane jednocześnie przez panel, moduł kuchni i etykiety.
Historia projektu pokazała, że każda kopia tej logiki prędzej czy później
rozjeżdża się z resztą i kuchnia gotuje co innego, niż mówi naklejka.

| Plik | Odpowiada za |
|---|---|
| `lib/production.ts` | dobór receptur, sloty posiłków, układanie tygodnia i pojedynczego dnia |
| `lib/mealShares.ts` | udział posiłków w kaloryczności dnia |
| `lib/productionDay.ts` | dzień produkcji i lista diet na ten dzień |
| `lib/allergens.ts` | wykluczenia i alergeny |
| `lib/pricing.ts` | cennik i wycena zamówienia (także po stronie serwera) |
| `lib/loyalty.ts` | progi rabatu lojalnościowego |
| `lib/p24.ts` | płatności Przelewy24 |

**Zasada:** nie dopisuj drugiej wersji tych wyliczeń w komponencie.
Jeśli czegoś brakuje, dodaj to w `lib` i użyj w obu miejscach.

## Baza danych

Pliki w `supabase/` uruchamia się ręcznie w panelu Supabase, w edytorze SQL.
Nie ma automatycznych migracji — kolejność wynika z dat w historii zmian.

## Zmienne środowiskowe

Wszystkie wymienione w `.env.example`. Prawdziwe wartości żyją wyłącznie
w ustawieniach Vercela. Po dodaniu zmiennej trzeba zbudować projekt ponownie,
bo wczytują się przy budowaniu.

Brak `SMSAPI_ADMIN_PHONE` oznacza, że SMS o nowym zamówieniu nie wyjdzie —
panel pokazuje wtedy ostrzeżenie na górze zakładki „Dziś".
