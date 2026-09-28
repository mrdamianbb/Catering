# SMSAPI — konfiguracja Vercel

Dodaj w Vercel → Project → Settings → Environment Variables:

- `SMSAPI_TOKEN` — token API z uprawnieniem do wysyłki SMS.
- `SMSAPI_ADMIN_PHONE` — Twój numer telefonu, na który ma przychodzić SMS o nowym zamówieniu.
- `SMSAPI_FROM` — opcjonalna zatwierdzona nazwa nadawcy w SMSAPI, np. `DzikaKaczka`.

Po dodaniu zmiennych zrób Redeploy.

## Co wysyła v8.7.3

Po każdym poprawnie zapisanym zamówieniu SMS trafia wyłącznie na `SMSAPI_ADMIN_PHONE`.

SMS zawiera:
- numer zamówienia,
- imię i nazwisko klienta,
- telefon klienta,
- dietę i kaloryczność,
- liczbę dni,
- datę startu,
- pełny adres,
- kod rabatowy, jeśli był użyty.

Klient NIE dostaje SMS-a.

Brak tokena lub chwilowy błąd SMSAPI nie blokuje zapisania zamówienia.
