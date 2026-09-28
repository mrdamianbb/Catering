# Zmiany z audytu — bazowane na v8.7.3

**UWAGA: ten ZIP to v8.7.3, a na produkcji stoi v8.7.7.** Nie wgrywaj go w całości na Vercel — cofnąłbyś cztery wersje zmian. Poniżej dokładna lista, żeby dało się ją nanieść na aktualną wersję.

---

## Pliki nowe

### `lib/deliveryZones.ts`
Strefy dostaw i walidacja kodów pocztowych. Dwie strefy: A (powiat wodzisławski + Jastrzębie, 19:00–21:00), B (Rybnik + Żory, 20:00–22:00). Gliwice pominięte zgodnie z ustaleniami.

**Kody pocztowe wymagają weryfikacji** w bazie Poczty Polskiej przed produkcją. Adres spoza listy nie jest odrzucany — dostaje status do ręcznej weryfikacji, więc błędny kod nie kosztuje zamówienia.

### `app/robots.ts`
Blokuje indeksowanie `/panel` i `/api/`, wskazuje sitemapę.

### `app/sitemap.ts`
Trzy adresy: strona główna, `/menu`, `/regulamin`. Dopisz podstrony miast, gdy powstaną.

---

## Pliki zmienione

### `app/layout.tsx` — przepisany
Metadane zależne od hosta. Publiczna domena dostaje tytuł i opis cateringu plus Open Graph; każdy inny host (czyli panel) dostaje `noindex`.

Wcześniej cała strona miała tytuł „Diety — Kuchnia i Kurierzy" i opis panelu administracyjnego — to trafiało do Google i do podglądu linków na Facebooku.

### `lib/orderValidation.ts` — 3 miejsca
- `OrderInput` dostaje pole `terms_accepted: boolean`
- `normalizeOrder` przepisuje je z formularza
- `validateOrder` zwraca błąd, jeśli regulamin nie został zaakceptowany

### `app/api/order/route.ts` — 2 miejsca
- `terms_accepted` wyłączone z `dbOrder` (nie ma kolumny w bazie — patrz SQL niżej)
- akceptacja regulaminu ląduje w `notes` ze znacznikiem czasu

### `app/sklep/page.tsx` — 10 miejsc
1. Import `deliveryZones`
2. Stan `terms` i `postal`
3. `validateForm(form, submitting)` — błąd regulaminu tylko przy wysyłce, nie przy każdym wpisanym znaku
4. `terms_accepted` w payloadzie
5. Usunięty badge `v8.7.3` z hero
6. Usunięty `v8.7.3` ze stopki
7. Kod pocztowy sprawdza strefę i pokazuje komunikat na żywo
8. **Checkbox akceptacji regulaminu** z linkiem do `/regulamin` — wymóg Przelewy24
9. **Przycisk „ZAMAWIAM I PŁACĘ"** zamiast „ZAMAWIAM DIETĘ" — wymóg ustawy o prawach konsumenta
10. Nowa sekcja „Obszar dostaw" + JSON-LD `FoodEstablishment` + link w nawigacji

### `app/globals.css`
Dopisane na końcu: style sekcji dostaw, komunikatów strefowych i boxa regulaminu. Nic nie nadpisane.

---

## Zanim wdrożysz

1. **`npm install && npm run build`** — nie mogłem tego uruchomić (brak dostępu do sieci przy pracy nad plikami), więc build trzeba sprawdzić u siebie.
2. **`/regulamin` musi istnieć.** W tym ZIP-ie tej podstrony nie ma, a checkbox do niej linkuje. Na produkcji ona działa, więc po naniesieniu zmian na 8.7.7 problem znika.
3. **Zweryfikuj kody pocztowe** w `lib/deliveryZones.ts`.
4. **Ustaw `NEXT_PUBLIC_TURNSTILE_SITE_KEY` na Vercel** — bez tego formularz w ogóle nie wysyła zamówień. To jest przyczyna komunikatu widocznego dziś na żywej stronie. Zmienna musi być ustawiona dla środowiska Production **przed** buildem, bo `NEXT_PUBLIC_*` jest wstrzykiwane w czasie kompilacji. Po dodaniu zmiennej zrób redeploy.
5. **Złóż testowe zamówienie** i sprawdź, czy dochodzi do panelu i czy przychodzi SMS.

---

## Opcjonalnie: kolumna w bazie

Akceptacja regulaminu trafia teraz do `notes`. Jeśli wolisz osobną kolumnę:

```sql
alter table store_orders
  add column terms_accepted_at timestamptz;
```

Potem w `app/api/order/route.ts` zamień dopisek w `noteParts` na `terms_accepted_at: new Date().toISOString()` w obiekcie `insert`.

---

## Czego NIE zrobiłem

- **Kaloryczności 1400 i 1500** — wymagają cen i receptur w bazie, nie samego kodu.
- **Podstron SEO dla miast** — treści są w osobnym pliku `teksty-obszar-dostaw.md`, ale każda podstrona potrzebuje unikalnego tekstu, nie klonu z podmienioną nazwą.
- **Sekcji opinii** — w tej wersji są placeholdery z pięcioma gwiazdkami i podpisem „PRZYKŁADOWA OPINIA". Publikowanie fikcyjnych opinii, nawet oznaczonych, jest ryzykowne pod dyrektywą Omnibus. Na produkcji już to zmieniłeś, więc zostawiam.
- **Jadłospisu i zdjęć jedzenia** — największa dziura konwersyjna, ale to nie jest zadanie programistyczne.
