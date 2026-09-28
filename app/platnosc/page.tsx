import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Płatność | Dzika Kaczka Catering",
  robots: { index: false, follow: false }
};

/**
 * Strona powrotu z Przelewy24.
 *
 * Status bierzemy z naszej bazy, a nie z adresu — to, że klient wrócił,
 * nie znaczy, że zapłacił. Potwierdzenie przychodzi osobnym powiadomieniem
 * i czasem ma kilka sekund opóźnienia, dlatego strona sama się odświeża.
 */
export default async function PlatnoscPage({
  searchParams
}: { searchParams: Promise<{ sesja?: string }> }) {
  const { sesja } = await searchParams;

  let status: string | null = null;
  let kwota = 0;
  if (sesja) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const db = createClient(url, key, { auth: { persistSession: false } });
      const { data } = await db.from("store_orders")
        .select("payment_status,payment_amount")
        .eq("payment_session", sesja).maybeSingle();
      status = data?.payment_status || null;
      kwota = Number(data?.payment_amount || 0) / 100;
    }
  }

  const oplacone = status === "paid";
  const nieudane = status === "failed";

  return (
    <main className="platnoscPage">
      {!oplacone && !nieudane && <meta httpEquiv="refresh" content="5" />}

      <div className={`platnoscKarta ${oplacone ? "ok" : nieudane ? "blad" : "czeka"}`}>
        {oplacone && <>
          <span className="ikona">✓</span>
          <h1>Dziękujemy, płatność przyjęta</h1>
          <p>Zamówienie trafiło do nas. Odezwiemy się z potwierdzeniem terminu pierwszej dostawy.</p>
        </>}

        {nieudane && <>
          <span className="ikona">✕</span>
          <h1>Płatność nie doszła do skutku</h1>
          <p>Nic nie zostało pobrane. Zamówienie mamy zapisane — zadzwoń, a dokończymy je razem.</p>
          <a className="redBtn" href="tel:+48884004321">Zadzwoń: 884 004 321</a>
        </>}

        {!oplacone && !nieudane && <>
          <span className="ikona">⏳</span>
          <h1>Sprawdzamy płatność</h1>
          <p>
            {kwota > 0 ? `Kwota ${kwota.toFixed(2)} zł. ` : ""}
            Potwierdzenie z banku potrafi zająć kilkanaście sekund. Ta strona odświeży się sama.
          </p>
        </>}

        <a className="platnoscPowrot" href="/">← Wróć na stronę główną</a>
      </div>
    </main>
  );
}
