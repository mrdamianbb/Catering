import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { kluczTelefonu, poziomDla, doNastepnegoProgu } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

/**
 * Zwraca poziom lojalnościowy dla numeru telefonu.
 *
 * Świadomie nie zwracamy imienia, adresu ani historii — tylko liczbę dni
 * i rabat. Endpoint jest publiczny, więc nie może potwierdzać, kto jest
 * naszym klientem ani ujawniać jego danych.
 */
export async function POST(req: NextRequest) {
  let telefon = "";
  try {
    const body = await req.json();
    telefon = kluczTelefonu(String(body?.phone || ""));
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  if (telefon.length !== 9) return NextResponse.json({ dni: 0, procent: 0 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ dni: 0, procent: 0 });

  const db = createClient(url, key, { auth: { persistSession: false } });

  // Klienci o tym numerze — numer bywa zapisany z prefiksem i spacjami,
  // więc porównujemy po ostatnich dziewięciu cyfrach.
  const { data: klienci } = await db.from("clients").select("id,phone");
  const ids = (klienci || [])
    .filter((c: any) => kluczTelefonu(c.phone) === telefon)
    .map((c: any) => c.id);

  let dni = 0;

  if (ids.length) {
    const { data: diety } = await db
      .from("diets")
      .select("start_date,end_date,client_id")
      .in("client_id", ids);
    for (const d of (diety || []) as any[]) {
      const od = Date.parse(d.start_date + "T12:00:00");
      const do_ = Date.parse(d.end_date + "T12:00:00");
      if (!Number.isFinite(od) || !Number.isFinite(do_) || do_ < od) continue;
      // Liczymy tylko dni, które już minęły — rabat należy się za historię,
      // a nie za zamówienie złożone na trzy miesiące do przodu.
      const koniec = Math.min(do_, Date.now());
      if (koniec < od) continue;
      dni += Math.floor((koniec - od) / 86400000) + 1;
    }
  }

  const poziom = poziomDla(dni);
  const nastepny = doNastepnegoProgu(dni);

  return NextResponse.json({
    dni,
    procent: poziom?.procent || 0,
    nazwa: poziom?.nazwa || null,
    doNastepnego: nastepny ? { brakuje: nastepny.brakuje, procent: nastepny.prog.procent } : null
  });
}
