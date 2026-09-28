"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Wymaga uwagi — rzeczy, które trzeba dziś załatwić.
 *
 * Wszystko liczone z danych panelu. Alert pojawia się tylko wtedy,
 * gdy faktycznie jest problem — pusty pasek znika, żeby nie uczyć
 * ignorowania ostrzeżeń.
 */

type Waga = "pilne" | "uwaga" | "info";
type Alert = { waga: Waga; tytul: string; opis: string; akcja?: () => void; etykieta?: string };

function iso(o = 0) {
  const d = new Date();
  d.setDate(d.getDate() + o);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const pl = (i: string) => new Intl.DateTimeFormat("pl-PL").format(new Date(i + "T12:00:00"));

function jedzieWDniu(d: any, date: string) {
  if (d?.archived) return false;
  if (d.start_date > date || d.end_date < date) return false;
  const js = new Date(date + "T12:00:00").getDay();
  const dow = js === 0 ? 7 : js;
  const l = d.delivery_weekdays;
  if (Array.isArray(l) && l.length) return l.includes(dow) || l.includes(js);
  return true;
}

export function WymagaUwagi({ diets, clients, storeOrders, onPokazZamowienia, onPokazDiety }: {
  diets: any[]; clients: any[]; storeOrders: any[];
  onPokazZamowienia?: () => void; onPokazDiety?: () => void;
}) {
  // Stan integracji — SMS o nowym zamówieniu potrafił nie działać tygodniami
  // i nie było tego jak zauważyć, bo kod pomija wysyłkę po cichu.
  const [stan, setStan] = useState<{smsOZamowieniach:boolean} | null>(null);
  useEffect(() => {
    let anuluj = false;
    fetch("/api/health").then(r => r.ok ? r.json() : null).then(d => { if (!anuluj && d) setStan(d); }).catch(() => {});
    return () => { anuluj = true; };
  }, []);

  const alerty = useMemo<Alert[]>(() => {
    const dzis = iso(0), jutro = iso(1), za3 = iso(3);
    const akt = diets.filter(d => !d.archived);
    const out: Alert[] = [];

    if (stan && !stan.smsOZamowieniach) out.push({
      waga: "pilne",
      tytul: "SMS o nowych zamówieniach nie działa",
      opis: "Brakuje numeru odbiorcy albo tokenu SMSAPI na Vercelu. Zamówienia zapisują się w panelu, ale nikt nie dostaje powiadomienia."
    });

    const nowe = (storeOrders || []).filter(o => o.status === "new");
    if (nowe.length) out.push({
      waga: "pilne",
      tytul: `${nowe.length} ${nowe.length === 1 ? "zamówienie czeka" : "zamówień czeka"} na decyzję`,
      opis: nowe.slice(0, 3).map(o => o.customer_name).join(", ") + (nowe.length > 3 ? " i inni" : ""),
      akcja: onPokazZamowienia, etykieta: "Pokaż"
    });

    const bezAdresu = akt.filter(d => (jedzieWDniu(d, dzis) || jedzieWDniu(d, jutro)) && !d.clients?.street_address);
    if (bezAdresu.length) out.push({
      waga: "pilne",
      tytul: `${bezAdresu.length} ${bezAdresu.length === 1 ? "dieta bez adresu" : "diet bez adresu"}`,
      opis: "Kurier ich nie znajdzie: " + bezAdresu.slice(0, 3).map(d => d.client_name).join(", "),
      akcja: onPokazDiety, etykieta: "Popraw"
    });

    const bezTelefonu = akt.filter(d => (jedzieWDniu(d, dzis) || jedzieWDniu(d, jutro)) && !d.clients?.phone);
    if (bezTelefonu.length) out.push({
      waga: "uwaga",
      tytul: `${bezTelefonu.length} ${bezTelefonu.length === 1 ? "klient bez telefonu" : "klientów bez telefonu"}`,
      opis: "Kurier nie zadzwoni, a SMS o dostawie nie wyjdzie."
    });

    const koncza = akt.filter(d => d.end_date >= dzis && d.end_date <= za3)
      .sort((a, b) => a.end_date.localeCompare(b.end_date));
    if (koncza.length) out.push({
      waga: "uwaga",
      tytul: `${koncza.length} ${koncza.length === 1 ? "dieta kończy się" : "diet kończy się"} w ciągu 3 dni`,
      opis: koncza.slice(0, 4).map(d => `${d.client_name} (${pl(d.end_date)})`).join(", "),
      akcja: onPokazDiety, etykieta: "Odnów"
    });

    const jutroDiety = akt.filter(d => jedzieWDniu(d, jutro));
    const niegotowe = jutroDiety.filter(d => d.kitchen_status !== "ready" && d.kitchen_status !== "issued");
    if (jutroDiety.length && niegotowe.length) out.push({
      waga: niegotowe.length === jutroDiety.length ? "info" : "uwaga",
      tytul: `Kuchnia: ${niegotowe.length} z ${jutroDiety.length} diet na jutro nie jest gotowych`,
      opis: "Wydanie kurierowi obejmie tylko pozycje oznaczone jako gotowe."
    });

    const bezTrasy = akt.filter(d => (jedzieWDniu(d, dzis) || jedzieWDniu(d, jutro)) && !d.route_code);
    if (bezTrasy.length) out.push({
      waga: "pilne",
      tytul: `${bezTrasy.length} ${bezTrasy.length === 1 ? "dieta bez trasy" : "diet bez trasy"}`,
      opis: "Nie pojawią się u żadnego kuriera: " + bezTrasy.slice(0, 3).map(d => d.client_name).join(", "),
      akcja: onPokazDiety, etykieta: "Przypisz"
    });

    const kolejnosc: Record<Waga, number> = { pilne: 0, uwaga: 1, info: 2 };
    return out.sort((a, b) => kolejnosc[a.waga] - kolejnosc[b.waga]);
  }, [diets, clients, storeOrders, onPokazZamowienia, onPokazDiety, stan]);

  if (!alerty.length) {
    return (
      <section className="card uwagaOk">
        <b>Wszystko na miejscu</b>
        <span>Brak zamówień do decyzji, braków w adresach i diet kończących się w tym tygodniu.</span>
      </section>
    );
  }

  return (
    <section className="card uwagaCard">
      <small className="sekcjaEtykieta">DZIŚ</small><h2>Wymaga uwagi</h2>
      <div className="uwagaLista">
        {alerty.map((a, i) => (
          <div className={`uwagaPoz ${a.waga}`} key={i}>
            <div>
              <b>{a.tytul}</b>
              <span>{a.opis}</span>
            </div>
            {a.akcja && <button type="button" onClick={a.akcja}>{a.etykieta || "Pokaż"}</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
