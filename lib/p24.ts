/**
 * Przelewy24 — rejestracja i weryfikacja płatności (REST API v1).
 *
 * Przebieg: rejestrujemy transakcję, odsyłamy klienta na stronę płatności,
 * Przelewy24 wywołuje nasz adres powiadomienia, a my potwierdzamy płatność
 * wywołaniem weryfikacji. Dopiero pozytywna weryfikacja oznacza, że
 * pieniądze wpłynęły.
 *
 * Kwota ZAWSZE pochodzi z naszej bazy, nigdy z powiadomienia — inaczej
 * wystarczyłoby podstawić własną kwotę, żeby zamówienie uznało się za
 * opłacone.
 */

import { createHash } from "crypto";

export interface KonfiguracjaP24 {
  merchantId: number;
  posId: number;
  apiKey: string;
  crc: string;
  sandbox: boolean;
}

/** Konfiguracja ze zmiennych środowiskowych. Brak którejkolwiek = płatności wyłączone. */
export function konfiguracja(): KonfiguracjaP24 | null {
  const merchantId = Number(process.env.P24_MERCHANT_ID || 0);
  const posId = Number(process.env.P24_POS_ID || merchantId || 0);
  const apiKey = (process.env.P24_API_KEY || "").trim();
  const crc = (process.env.P24_CRC || "").trim();
  if (!merchantId || !posId || !apiKey || !crc) return null;
  return {
    merchantId, posId, apiKey, crc,
    sandbox: String(process.env.P24_SANDBOX || "").toLowerCase() === "true"
  };
}

export function adresBazowy(k: KonfiguracjaP24): string {
  return k.sandbox ? "https://sandbox.przelewy24.pl" : "https://secure.przelewy24.pl";
}

/** Podpis SHA-384 z pól w kolejności wymaganej przez Przelewy24. */
function podpis(pola: Record<string, unknown>): string {
  return createHash("sha384").update(JSON.stringify(pola), "utf8").digest("hex");
}

function naglowki(k: KonfiguracjaP24) {
  const auth = Buffer.from(`${k.posId}:${k.apiKey}`).toString("base64");
  return { "Content-Type": "application/json", Authorization: `Basic ${auth}` };
}

/**
 * Rejestruje transakcję i zwraca adres, pod który trzeba odesłać klienta.
 * `grosze` to kwota w najmniejszej jednostce: 89,00 zł = 8900.
 */
export async function zarejestrujPlatnosc(opts: {
  sessionId: string;
  grosze: number;
  opis: string;
  email: string;
  urlPowrotu: string;
  urlPowiadomienia: string;
}): Promise<{ ok: true; url: string; token: string } | { ok: false; blad: string }> {
  const k = konfiguracja();
  if (!k) return { ok: false, blad: "P24_NIESKONFIGUROWANE" };

  const sign = podpis({
    sessionId: opts.sessionId,
    merchantId: k.merchantId,
    amount: opts.grosze,
    currency: "PLN",
    crc: k.crc
  });

  try {
    const res = await fetch(`${adresBazowy(k)}/api/v1/transaction/register`, {
      method: "POST",
      headers: naglowki(k),
      body: JSON.stringify({
        merchantId: k.merchantId,
        posId: k.posId,
        sessionId: opts.sessionId,
        amount: opts.grosze,
        currency: "PLN",
        description: opts.opis.slice(0, 120),
        email: opts.email,
        country: "PL",
        language: "pl",
        urlReturn: opts.urlPowrotu,
        urlStatus: opts.urlPowiadomienia,
        timeLimit: 30,
        encoding: "UTF-8",
        sign
      })
    });

    const dane = await res.json().catch(() => null);
    const token = dane?.data?.token;
    if (!res.ok || !token) {
      return { ok: false, blad: `Rejestracja odrzucona (${res.status}): ${JSON.stringify(dane?.error || dane)}` };
    }
    return { ok: true, token, url: `${adresBazowy(k)}/trnRequest/${token}` };
  } catch (e: any) {
    return { ok: false, blad: "Brak połączenia z Przelewy24: " + (e?.message || "") };
  }
}

/**
 * Potwierdza płatność. Kwotę podajemy z NASZEJ bazy — jeśli klient zapłacił
 * mniej albo dane się nie zgadzają, Przelewy24 odrzuci weryfikację.
 */
export async function potwierdzPlatnosc(opts: {
  sessionId: string;
  orderId: number;
  grosze: number;
}): Promise<{ ok: boolean; blad?: string }> {
  const k = konfiguracja();
  if (!k) return { ok: false, blad: "P24_NIESKONFIGUROWANE" };

  const sign = podpis({
    sessionId: opts.sessionId,
    orderId: opts.orderId,
    amount: opts.grosze,
    currency: "PLN",
    crc: k.crc
  });

  try {
    const res = await fetch(`${adresBazowy(k)}/api/v1/transaction/verify`, {
      method: "PUT",
      headers: naglowki(k),
      body: JSON.stringify({
        merchantId: k.merchantId,
        posId: k.posId,
        sessionId: opts.sessionId,
        amount: opts.grosze,
        currency: "PLN",
        orderId: opts.orderId,
        sign
      })
    });
    const dane = await res.json().catch(() => null);
    if (!res.ok || dane?.data?.status !== "success") {
      return { ok: false, blad: `Weryfikacja odrzucona (${res.status}): ${JSON.stringify(dane?.error || dane)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, blad: "Brak połączenia z Przelewy24: " + (e?.message || "") };
  }
}
