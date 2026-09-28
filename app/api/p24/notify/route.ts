import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { potwierdzPlatnosc, konfiguracja } from "@/lib/p24";

export const dynamic = "force-dynamic";

/**
 * Powiadomienie od Przelewy24 o zakończonej płatności.
 *
 * Nie ufamy niczemu, co przychodzi w powiadomieniu poza identyfikatorami.
 * Kwotę bierzemy z naszej bazy i wysyłamy ją do weryfikacji — jeśli klient
 * zapłacił mniej albo ktoś podszywa się pod Przelewy24, weryfikacja padnie
 * i zamówienie nie zostanie oznaczone jako opłacone.
 */
export async function POST(req: NextRequest) {
  const k = konfiguracja();
  if (!k) return NextResponse.json({ error: "Płatności nieskonfigurowane." }, { status: 503 });

  let body: any = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Złe dane." }, { status: 400 }); }

  const sessionId = String(body?.sessionId || "").trim();
  const orderId = Number(body?.orderId || 0);
  if (!sessionId || !orderId) return NextResponse.json({ error: "Brak danych." }, { status: 400 });
  if (Number(body?.merchantId) !== k.merchantId) {
    return NextResponse.json({ error: "Nie nasze." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Brak dostępu do bazy." }, { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: zam } = await db
    .from("store_orders")
    .select("id,payment_status,payment_amount,customer_name")
    .eq("payment_session", sessionId)
    .maybeSingle();

  if (!zam) return NextResponse.json({ error: "Nieznana płatność." }, { status: 404 });

  // Powtórzone powiadomienie dla już opłaconego zamówienia — odpowiadamy OK,
  // żeby Przelewy24 przestało ponawiać, ale nic nie zmieniamy.
  if (zam.payment_status === "paid") return NextResponse.json({ ok: true });

  const wynik = await potwierdzPlatnosc({
    sessionId,
    orderId,
    grosze: Number(zam.payment_amount) || 0
  });

  if (!wynik.ok) {
    await db.from("store_orders")
      .update({ payment_status: "failed", payment_error: (wynik.blad || "").slice(0, 300) })
      .eq("id", zam.id);
    return NextResponse.json({ error: "Weryfikacja nieudana." }, { status: 400 });
  }

  await db.from("store_orders")
    .update({ payment_status: "paid", payment_order_id: orderId, paid_at: new Date().toISOString() })
    .eq("id", zam.id);

  return NextResponse.json({ ok: true });
}
