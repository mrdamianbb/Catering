import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSms } from "@/lib/smsapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function warsawDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(d);
  const g = (t: string) => p.find(x => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

function bezOgonkow(v: string) {
  return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L");
}

/** Bez polskich znaków — z ogonkami SMS kosztuje dwa razy więcej. */
function tresc(imie: string, data: string) {
  const dzien = data.slice(8) + "." + data.slice(5, 7);
  const kto = imie ? ` ${imie},` : "";
  return `Dzika Kaczka Catering:${kto} Twoja dieta konczy sie ${dzien}. Gdybys chcial ja przedluzyc, zadzwon: 884004321.`;
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://wqqexlsrxnlbhirzbbnh.supabase.co";
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_gWrnpDV4vdLgQlKonfItQw_AoHIqs5q");
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_service_role || process.env.SUPABASE_SERVICE_KEY);

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Sesja wygasła." }, 401);
  const { data: profile } = await userClient.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return json({ error: "Tylko administrator może wysyłać przypomnienia." }, 403);

  const db = createClient(url, serviceKey || anon, { auth: { persistSession: false, autoRefreshToken: false } });

  const od = warsawDate(0), do_ = warsawDate(3);
  const { data: diety, error } = await db
    .from("diets")
    .select("id,client_id,client_name,end_date,archived,clients(name,phone)")
    .eq("archived", false)
    .gte("end_date", od)
    .lte("end_date", do_);
  if (error) return json({ error: "Nie mogę pobrać diet: " + error.message }, 500);

  const { data: juz } = await db.from("diet_reminders").select("diet_id").eq("kind", "koniec");
  const wyslane = new Set((juz || []).map((x: any) => Number(x.diet_id)));

  const doWyslania = (diety || []).filter((d: any) => !wyslane.has(Number(d.id)));
  if (!doWyslania.length) {
    return json({ ok: true, wyslano: 0, message: "Wszystkie kończące się diety mają już wysłane przypomnienie." });
  }

  const wyniki: string[] = [];
  let ok = 0;

  for (const d of doWyslania as any[]) {
    const tel = String(d.clients?.phone || "").trim();

    // Wpis rezerwujemy PRZED wysyłką — drugie kliknięcie nie wyśle dubletu.
    const { error: insErr } = await db.from("diet_reminders").insert({ diet_id: d.id, kind: "koniec" });
    if (insErr) { if (insErr.code !== "23505") wyniki.push(`${d.client_name}: błąd zapisu`); continue; }

    if (!tel) {
      await db.from("diet_reminders").update({ sms_status: "no_phone" }).eq("diet_id", d.id).eq("kind", "koniec");
      wyniki.push(`${d.client_name}: brak telefonu`);
      continue;
    }

    const imie = bezOgonkow(String(d.clients?.name || d.client_name || "").trim().split(/\s+/)[0] || "");
    const res = await sendSms({ to: tel, message: tresc(imie, d.end_date), idx: `koniec-${d.id}` });

    if (res.ok) {
      ok++;
      await db.from("diet_reminders").update({ sms_status: "sent" }).eq("diet_id", d.id).eq("kind", "koniec");
    } else {
      await db.from("diet_reminders").update({ sms_status: "failed" }).eq("diet_id", d.id).eq("kind", "koniec");
      wyniki.push(`${d.client_name}: SMS nie wyszedł`);
    }
  }

  return json({
    ok: true,
    wyslano: ok,
    pominieto: wyniki,
    message: `Wysłano ${ok} ${ok === 1 ? "przypomnienie" : "przypomnień"}.` + (wyniki.length ? ` Pominięto ${wyniki.length}.` : "")
  });
}
