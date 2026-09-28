import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ulozTydzien, DNI_PAMIECI } from "@/lib/production";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Poniedziałek najbliższego nadchodzącego tygodnia, liczony w czasie warszawskim.
 * Zadanie startuje w sobotę, więc „następny tydzień" to ten za dwa dni —
 * w sobotę dzień tygodnia to 6, czyli 8-6=2 dni do poniedziałku.
 */
function nextMonday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  const today = new Date(`${get("year")}-${get("month")}-${get("day")}T12:00:00`);
  const dow = today.getDay() === 0 ? 7 : today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() + (8 - dow));
  return monday;
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://wqqexlsrxnlbhirzbbnh.supabase.co";
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_service_role || process.env.SUPABASE_SERVICE_KEY);
  const publicKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_gWrnpDV4vdLgQlKonfItQw_AoHIqs5q");
  const key = serviceKey || publicKey;

  // Zadanie uruchamia harmonogram Vercela albo administrator z panelu.
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  const fromCron = Boolean(cronSecret && auth === `Bearer ${cronSecret}`) || Boolean(req.headers.get("x-vercel-cron"));

  if (!fromCron) {
    if (!auth.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userClient = createClient(url, publicKey, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sesja wygasła." }, { status: 401 });
    const { data: profile } = await userClient.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "kitchen") {
      return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
    }
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const monday = nextMonday();
  const weekStart = iso(monday);
  const endDate = new Date(monday);
  endDate.setDate(monday.getDate() + 6);
  const weekEnd = iso(endDate);

  // Nie nadpisujemy tygodnia, który ktoś już ułożył — automat tylko uzupełnia puste.
  const force = new URL(req.url).searchParams.get("force") === "1";
  const { data: existing, error: existErr } = await db
    .from("weekly_menu").select("id").gte("menu_date", weekStart).lte("menu_date", weekEnd).limit(1);
  if (existErr) return NextResponse.json({ error: "Nie mogę sprawdzić menu: " + existErr.message }, { status: 500 });
  if (existing?.length && !force) {
    return NextResponse.json({ ok: true, skipped: true, weekStart, message: "Tydzień jest już ułożony — nic nie zmieniam." });
  }

  const { data: recipes, error: recErr } = await db
    .from("recipes").select("id,name,meal_type,diet_type,food_cost,active").eq("active", true);
  if (recErr) return NextResponse.json({ error: "Nie mogę pobrać receptur: " + recErr.message }, { status: 500 });
  if (!recipes?.length) return NextResponse.json({ error: "Brak aktywnych receptur." }, { status: 409 });

  // Pamięć poprzednich tygodni — ta sama logika co przy ręcznym układaniu.
  const odDnia = new Date(monday); odDnia.setDate(monday.getDate() - DNI_PAMIECI);
  const { data: wczesniej } = await db.from("weekly_menu")
    .select("recipe_id,menu_date").gte("menu_date", iso(odDnia)).lt("menu_date", weekStart);
  const ostatnio = new Map<number, string>();
  for (const w of (wczesniej || []) as any[]) {
    const prev = ostatnio.get(w.recipe_id);
    if (!prev || w.menu_date > prev) ostatnio.set(w.recipe_id, w.menu_date);
  }

  const { rows, powtorki, zaMalaBaza } = ulozTydzien({ recipes, startIso: weekStart, ostatnioUzyte: ostatnio });
  const warnings = zaMalaBaza.map(z => `za mało receptur: ${z.slot} ${z.ma}/${z.potrzeba}`);
  if (!rows.length) return NextResponse.json({ error: "Nie udało się ułożyć menu." }, { status: 500 });

  const klucze = new Set(rows.map(r => `${r.menu_date}|${r.meal_type}`));
  if (klucze.size !== rows.length) {
    return NextResponse.json({ error: "Wykryto zdublowane posiłki — przerwano zapis." }, { status: 500 });
  }

  if (force && existing?.length) {
    const { error: delErr } = await db.from("weekly_menu").delete().gte("menu_date", weekStart).lte("menu_date", weekEnd);
    if (delErr) return NextResponse.json({ error: "Nie mogę wyczyścić menu: " + delErr.message }, { status: 500 });
  }

  const { error: insErr } = await db.from("weekly_menu").insert(rows);
  if (insErr) return NextResponse.json({ error: "Nie mogę zapisać menu: " + insErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    weekStart,
    weekEnd,
    count: rows.length,
    powtorki: powtorki.length,
    warnings,
    message: `Menu na tydzień od ${weekStart} ułożone: ${rows.length} pozycji.`
  });
}
