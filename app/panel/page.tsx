"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { nazwaSmaku } from "@/lib/shake";
import { MIN_DNI_POLECONEGO } from "@/lib/loyalty";
import { ALLERGENS, nazwaWykluczenia, detectRestrictions, ingredientBlocked as blockedByAllergen, unmatchedRestrictionText } from "@/lib/allergens";
import { Kaczorek } from "@/components/Kaczorek";
import { WymagaUwagi } from "@/components/WymagaUwagi";
import { normalizedMealShare as udzialPosilku } from "@/lib/mealShares";
import { slotsForDiet, rowsForSlots, chooseRecipe, zakresTygodnia } from "@/lib/production";
import { zapiszDzienProdukcji, odczytajDzienProdukcji, najblizszaDostawa, dostawaWDniu, dietyNaDzien } from "@/lib/productionDay";
import { checkDelivery } from "@/lib/deliveryZones";

type Role = "admin" | "kitchen" | "courier";
type Status = "todo" | "prep" | "ready" | "issued";

type Profile = { id:string; full_name:string|null; role:Role; route_code:string|null; route_codes?:string[]|null };
type Client = {
  id:number; name:string; phone:string|null; street_address:string|null; postal_code:string|null; city:string|null;
  kitchen_notes:string|null; courier_notes:string|null;
};
type Diet = {
  id:number; client_id:number|null; client_name:string; diet_name:string; kcal:number; bags:number;meal_count?:number; route_code:string;
  start_date:string; end_date:string; kitchen_status:Status; notes:string|null;
  delivery_weekdays?:number[]|null;
  archived?:boolean;
  archived_at?:string|null;
  clients?:Client|null;
};

const statusText:Record<Status,string>={todo:"Do zrobienia",prep:"W przygotowaniu",ready:"Gotowe",issued:"Wydane kurierowi"};
const today=()=>{
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Warsaw",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const y=parts.find(x=>x.type==="year")?.value||"";
  const m=parts.find(x=>x.type==="month")?.value||"";
  const d=parts.find(x=>x.type==="day")?.value||"";
  return `${y}-${m}-${d}`;
};
const lifecycle=(d:Diet)=> today()<d.start_date?"future":today()>d.end_date?"expired":"active";
const weekdayToday=()=>{
  const name=new Intl.DateTimeFormat("en-US",{timeZone:"Europe/Warsaw",weekday:"short"}).format(new Date());
  return ({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7} as Record<string,number>)[name]||1;
};
const deliversToday=(d:Diet)=>!d.archived&&lifecycle(d)==="active"&&(d.delivery_weekdays??[1,2,3,4,5,6,7]).includes(weekdayToday());
const pl=(iso:string)=>new Intl.DateTimeFormat("pl-PL").format(new Date(iso+"T12:00:00"));
const fullAddress=(c?:Client|null)=>c?[c.street_address,[c.postal_code,c.city].filter(Boolean).join(" ")].filter(Boolean).join(", "):"";
const mapsUrl=(c?:Client|null)=>`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress(c))}`;
const BASE_ADDRESS="Dębowa 14B, 44-348 Skrzyszów";

// Jedyne dopuszczalne kody tras. Wcześniej pole przyjmowało dowolny tekst,
// a literówka („AA" zamiast „A") sprawiała, że dieta znikała kurierowi
// z listy bez żadnego komunikatu.
const ROUTE_CODES=["A","B"] as const;
const routeAddresses=(items:Diet[])=>{
  const seen=new Set<string>();
  return items
    .map(d=>fullAddress(d.clients).trim())
    .filter(Boolean)
    .filter(a=>{
      const key=a.toLowerCase();
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};
type RouteSegment={url:string;from:string;stops:string[];to:string};
const routeSegments=(items:Diet[],ordered?:string[]|null):RouteSegment[]=>{
  const addresses=ordered?.length?ordered:routeAddresses(items);
  if(!addresses.length)return [];
  // Do 9 delivery points per link so normal catering routes stay in one Google Maps route.
  // If there are more, create a second stage instead of dropping addresses.
  const chunks:string[][]=[];
  for(let i=0;i<addresses.length;i+=9)chunks.push(addresses.slice(i,i+9));
  const result:RouteSegment[]=[];
  let origin=BASE_ADDRESS;
  for(const chunk of chunks){
    const destination=chunk[chunk.length-1];
    const waypoints=chunk.slice(0,-1);
    const params=new URLSearchParams({
      api:"1",
      origin,
      destination,
      travelmode:"driving"
    });
    if(waypoints.length)params.set("waypoints",waypoints.join("|"));
    result.push({
      url:`https://www.google.com/maps/dir/?${params.toString()}`,
      from:origin,
      stops:chunk,
      to:destination
    });
    origin=destination;
  }
  return result;
};
const wholeRouteUrl=(items:Diet[])=>routeSegments(items)[0]?.url||"";

const ADMIN_DIET_TYPES=["Standard","Keto","Low Carb","Bez glutenu","3 posiłki"] as const;
export default function Home(){
  const [loading,setLoading]=useState(true);
  const [userId,setUserId]=useState<string|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [diets,setDiets]=useState<Diet[]>([]);
  const [clients,setClients]=useState<Client[]>([]);
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [msg,setMsg]=useState("");
  const [showAll,setShowAll]=useState(false); const [busy,setBusy]=useState(false);
  const [editingDiet,setEditingDiet]=useState<Diet|null>(null);
  const [renewingDiet,setRenewingDiet]=useState<Diet|null>(null);
  const [courierProfiles,setCourierProfiles]=useState<Profile[]>([]);
  const [selectedCourierRoute,setSelectedCourierRoute]=useState<string|null>(null);
  const [courierRouteDiagnostics,setCourierRouteDiagnostics]=useState<any>(null);
  const [deliveredIds,setDeliveredIds]=useState<number[]>([]);
  const [clientSearch,setClientSearch]=useState("");
  const [showWeekPlan,setShowWeekPlan]=useState(false);
  const [cardSearch,setCardSearch]=useState("");
  const [adminTab,setAdminTab]=useState<"dzis"|"diety"|"klienci"|"kuchnia"|"ustawienia">("dzis");
  const [kitchenTab,setKitchenTab]=useState<"produkcja"|"plan">("produkcja");
  const [weekOffset,setWeekOffset]=useState(0);
  const filteredClients=useMemo(()=>{
    const q=clientSearch.trim().toLowerCase();
    if(!q)return clients;
    return clients.filter(c=>
      `${c.name} ${c.phone||""} ${c.city||""} ${c.street_address||""}`.toLowerCase().includes(q)
    );
  },[clients,clientSearch]);
  const [routeOrder,setRouteOrder]=useState<string[]|null>(null);
  const [routeOptimized,setRouteOptimized]=useState<boolean>(false);
  const [offlineCopy,setOfflineCopy]=useState<boolean>(false);
  const [deliveringId,setDeliveringId]=useState<number|null>(null);
  const [storeOrders,setStoreOrders]=useState<any[]>([]);
  const [showArchive,setShowArchive]=useState(false);
  const [todayProduction,setTodayProduction]=useState<any[]>([]);
  const [tydzienProdukcji,setTydzienProdukcji]=useState<any[]>([]);
  const [allRecipes,setAllRecipes]=useState<any[]>([]);
  const [productionTarget,setProductionTargetRaw]=useState("");
  // Wybrany dzień zapisujemy, żeby moduł kuchni i etykiety wzięły ten sam.
  const setProductionTarget=(v:string)=>{setProductionTargetRaw(v);zapiszDzienProdukcji(v||null);};
  useEffect(()=>{const z=odczytajDzienProdukcji();if(z)setProductionTargetRaw(z);},[]);
  const [productionDateTick,setProductionDateTick]=useState(0);
  const [dietPrices,setDietPrices]=useState<Record<number,number>>({1200:65,1300:69,1400:73,1500:76,1600:79,1800:84,2000:89,2100:91,2200:93,2500:99,3000:109});
  const [dietPriceDrafts,setDietPriceDrafts]=useState<Record<number,string>>({1200:"65,00",1300:"69,00",1600:"79,00",1800:"84,00",2000:"89,00",2500:"99,00",3000:"109,00"});
  const [ingredientPrices,setIngredientPrices]=useState<any[]>([]);
  const [costSettings,setCostSettings]=useState({packaging_per_meal:0,transport_per_day:0});
  const [forecastMenus,setForecastMenus]=useState<any[]>([]);
  const [forecastHorizon,setForecastHorizon]=useState<1|7|30>(7);
  const [kitchenWeekOffset,setKitchenWeekOffset]=useState(0);
  const [selectedKitchenDay,setSelectedKitchenDay]=useState<string>("");
  const [priceSources,setPriceSources]=useState<any[]>([]);
  const [monitorBusy,setMonitorBusy]=useState(false);

  async function autoArchiveExpired(showMessage=false){
    if(profile?.role!=="admin"&&profile!==null)return 0;
    const cutoff=today();
    const expired=diets.filter(d=>!d.archived&&d.end_date<cutoff);
    if(!expired.length)return 0;
    const ids=expired.map(d=>d.id);
    const archivedAt=new Date().toISOString();
    const {error}=await supabase.from("diets")
      .update({archived:true,archived_at:archivedAt})
      .in("id",ids);
    if(error){
      if(showMessage)setMsg("Błąd automatycznego archiwum: "+error.message);
      return 0;
    }
    setDiets(list=>list.map(d=>ids.includes(d.id)?{...d,archived:true,archived_at:archivedAt}:d));
    if(showMessage)setMsg(`Automatycznie zarchiwizowano ${ids.length} zakończonych diet ✓`);
    return ids.length;
  }

  /**
   * Usunięcie pojedynczej diety. W większości przypadków wystarcza archiwizacja —
   * usuwamy tylko wpisy zrobione przez pomyłkę, bo razem z dietą znika historia
   * klienta, a na niej opiera się rabat lojalnościowy.
   */
  async function usunDiete(d:Diet){
    if(busy)return;
    const dzis=today();
    const trwa=!d.archived&&d.end_date>=dzis&&d.start_date<=dzis;
    const dni=Math.max(0,Math.floor(
      (Math.min(Date.parse(d.end_date+"T12:00:00"),Date.now())-Date.parse(d.start_date+"T12:00:00"))/86400000)+1);

    let pytanie=`Usunąć dietę: ${d.client_name} — ${d.diet_name} ${d.kcal} kcal?`;
    pytanie+=`\n\nOkres: ${d.start_date} – ${d.end_date}`;
    if(dni>0)pytanie+=`\nKlient straci ${dni} ${dni===1?"dzień":"dni"} historii, co może obniżyć jego rabat lojalnościowy.`;
    if(trwa)pytanie+="\n\nUWAGA: ta dieta właśnie trwa.";
    pytanie+="\n\nJeśli chcesz tylko schować ją z listy, użyj archiwizacji.";
    if(!confirm(pytanie))return;
    if(trwa&&(prompt("Dieta trwa. Wpisz USUN, żeby potwierdzić.")||"").trim().toUpperCase()!=="USUN"){
      setMsg("Anulowano — dieta nie została usunięta.");return;
    }

    setBusy(true);
    try{
      const {error}=await supabase.from("diets").delete().eq("id",d.id);
      if(error){setMsg("Nie mogę usunąć diety: "+error.message);return;}
      setDiets(l=>l.filter(x=>x.id!==d.id));
      setMsg(`Usunięto dietę: ${d.client_name} — ${d.diet_name}`);
    }finally{ setBusy(false); }
  }

  async function archiveExpiredFromRows(rows:Diet[],showMessage=false){
    const cutoff=today();
    const expired=rows.filter(d=>!d.archived&&d.end_date<cutoff);
    if(!expired.length){if(showMessage)setMsg("Nie ma zakończonych diet do archiwizacji.");return rows;}
    if(showMessage&&!confirm(`Zarchiwizować ${expired.length} zakończonych diet?\n\nZnikną z listy aktywnych, ale zostaną w archiwum.`))return rows;
    const ids=expired.map(d=>d.id);
    const archivedAt=new Date().toISOString();
    const {error}=await supabase.from("diets")
      .update({archived:true,archived_at:archivedAt})
      .in("id",ids);
    if(error){
      if(showMessage)setMsg("Błąd automatycznego archiwum: "+error.message);
      return rows;
    }
    if(showMessage)setMsg(`Automatycznie zarchiwizowano ${ids.length} zakończonych diet ✓`);
    return rows.map(d=>ids.includes(d.id)?{...d,archived:true,archived_at:archivedAt}:d);
  }

  // Poniedziałek tygodnia przesuniętego o weekOffset względem bieżącego.
  const weekDates=useMemo(()=>{
    const now=new Date();
    const dow=now.getDay()===0?7:now.getDay();
    const monday=new Date(now);
    monday.setDate(now.getDate()-(dow-1)+weekOffset*7);
    return Array.from({length:7},(_,i)=>{
      const d=new Date(monday);
      d.setDate(monday.getDate()+i);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    });
  },[weekOffset]);

  // Wiersz na klienta, kolumna na dzień — układ planu lekcji.
  const weekPlan=useMemo(()=>{
    const rows=new Map<string,{name:string;route:string;cells:(Diet|null)[]}>();
    for(const d of diets){
      if(d.archived)continue;
      const hit=weekDates.map(date=>deliversOnDate(d,date)?d:null);
      if(!hit.some(Boolean))continue;
      const key=`${d.client_id}|${d.client_name}`;
      const row=rows.get(key)||{name:d.client_name,route:d.route_code,cells:Array(7).fill(null)};
      hit.forEach((v,i)=>{if(v&&!row.cells[i])row.cells[i]=v});
      rows.set(key,row);
    }
    return [...rows.values()].sort((a,b)=>a.route.localeCompare(b.route)||a.name.localeCompare(b.name,"pl"));
  },[diets,weekDates]);

  async function wyslijPrzypomnienia(){
    if(busy)return;
    const dzis=today();
    const za3=(()=>{const d=new Date();d.setDate(d.getDate()+3);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`})();
    const lista=diets.filter(d=>!d.archived&&d.end_date>=dzis&&d.end_date<=za3);
    if(!lista.length)return setMsg("Żadna dieta nie kończy się w ciągu 3 dni.");
    if(!confirm(
      `Wysłać SMS do ${lista.length} ${lista.length===1?"klienta":"klientów"}?\n\n`+
      lista.slice(0,8).map(d=>`• ${d.client_name} — koniec ${pl(d.end_date)}`).join("\n")+
      (lista.length>8?`\n…i ${lista.length-8} więcej`:"")+
      `\n\nKażdy klient dostanie jedną wiadomość o swojej diecie. Powtórne kliknięcie nie wyśle dubletu.`
    ))return;

    setBusy(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session){setMsg("Sesja wygasła.");return;}
      const res=await fetch("/api/diet-reminders",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`}});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)return setMsg(data?.error||"Nie udało się wysłać przypomnień.");
      setMsg(data?.message||"Gotowe.");
      if(data?.pominieto?.length)console.warn("pominięte przypomnienia",data.pominieto);
    }catch{
      setMsg("Brak połączenia. Spróbuj ponownie.");
    }finally{ setBusy(false); }
  }

  async function archiveExpiredNow(){
    if(busy)return;
    setBusy(true);
    const next=await archiveExpiredFromRows(diets,true);
    setDiets(next);
    setBusy(false);
  }

  async function loadForUser(uid:string,silent=false){
    if(!silent)setLoading(true);
    try{
      const profileReq=supabase.from("profiles").select("id,full_name,role,route_code,route_codes").eq("id",uid).single();
      const profileTimeout=new Promise<any>((_,reject)=>window.setTimeout(()=>reject(new Error("Timeout profilu")),25000));
      const {data:p,error:pe}=await Promise.race([profileReq,profileTimeout]) as any;
      if(pe)throw new Error(pe.message);
      const prof=p as Profile;
      setProfile(prof);

      let dq=supabase.from("diets")
        .select("*, clients(id,name,phone,street_address,postal_code,city,kitchen_notes,courier_notes)")
        .order("route_code").order("client_name").order("id");

      if(prof.role==="courier"){
        const routes=(prof.route_codes?.length?prof.route_codes:(prof.route_code?[prof.route_code]:[])).map(r=>r.toUpperCase());
        if(routes.length)dq=dq.in("route_code",routes).eq("kitchen_status","issued");
        const stored=typeof window!=="undefined"?window.localStorage.getItem("courier_selected_route"):null;
        const storedAllowed=!!stored&&(routes.includes(stored)||(stored==="A+B"&&routes.includes("A")&&routes.includes("B")));
        const fallback=storedAllowed?stored:(routes.includes("A")&&routes.includes("B")?"A+B":(routes[0]||null));
        setSelectedCourierRoute(prev=>prev&&(routes.includes(prev)||(prev==="A+B"&&routes.includes("A")&&routes.includes("B")))?prev:fallback);
      }

      let loadedDiets:Diet[]=[];
      let loadedClients:Client[]=[];

      if(prof.role==="courier"){
        const dietReq=dq;
        const dataTimeout=new Promise<any>((_,reject)=>window.setTimeout(()=>reject(new Error("Timeout danych kuriera")),30000));
        const dietResult=await Promise.race([dietReq,dataTimeout]) as any;
        if(dietResult?.error)throw new Error(dietResult.error.message);
        loadedDiets=(dietResult?.data||[]) as Diet[];
        loadedClients=loadedDiets.map(d=>d.clients).filter(Boolean) as Client[];
        setCourierRouteDiagnostics(null);
        setOfflineCopy(false);
        try{
          window.localStorage.setItem("courier_route_cache",JSON.stringify({
            date:today(),diets:loadedDiets
          }));
        }catch{}
      }else{
        const dietReq=dq;
        const clientsReq=supabase.from("clients").select("*").order("name");
        const dataTimeout=new Promise<any>((_,reject)=>window.setTimeout(()=>reject(new Error("Timeout danych")),30000));
        const results=await Promise.race([Promise.all([dietReq,clientsReq]),dataTimeout]) as any;
        const [dietResult,clientResult]=results;
        if(dietResult?.error)throw new Error(dietResult.error.message);
        loadedDiets=(dietResult?.data||[]) as Diet[];
        loadedClients=(clientResult?.data||[]) as Client[];
        // Archiwizacja nie dzieje się już sama przy wejściu — decyduje admin.
      }

      setDiets(loadedDiets);
      setClients(loadedClients);

      if(!(prof.role==="kitchen"||prof.role==="admin")){
        setTodayProduction([]);
        setAllRecipes([]);
      }

      if(prof.role==="admin"){
        const forecastEnd=dateIsoLocal(30);
        const [cpRes,ordersRes,pricesRes,ingredientsRes,costRes,forecastRes]=await Promise.all([
          supabase.from("profiles").select("id,full_name,role,route_code,route_codes").eq("role","courier").order("created_at"),
          supabase.from("store_orders").select("*").order("created_at",{ascending:false}).limit(100),
          supabase.from("diet_prices").select("kcal,price_per_day").order("kcal"),
          supabase.from("ingredients").select("id,name,unit,price_per_kg,actual_price_per_kg,web_price_per_kg,web_price_source,web_price_checked_at,calc_price_mode").order("name"),
          supabase.from("cost_settings").select("packaging_per_meal,transport_per_day").eq("id",1).single(),
          supabase.from("weekly_menu").select("id,menu_date,diet_type,meal_type,recipe_id,recipes(id,name,meal_type,diet_type,base_kcal,food_cost,recipe_ingredients(grams,ingredients(id,name,unit,price_per_kg,actual_price_per_kg,web_price_per_kg,calc_price_mode)))").gte("menu_date",today()).lte("menu_date",forecastEnd)
        ]);
        if(cpRes.error)setMsg(cpRes.error.message); else setCourierProfiles((cpRes.data||[]) as Profile[]);
        if(ordersRes.error)setMsg("Nie mogę odczytać zamówień ze sklepu: "+ordersRes.error.message);
        setStoreOrders(ordersRes.data||[]);
        setIngredientPrices(ingredientsRes.data||[]);
        if(costRes.data)setCostSettings({packaging_per_meal:Number(costRes.data.packaging_per_meal||0),transport_per_day:Number(costRes.data.transport_per_day||0)});
        setForecastMenus(forecastRes.data||[]);
        const {data:{session}}=await supabase.auth.getSession();
        if(session?.access_token){
          const rs=await fetch("/api/price-sources",{headers:{Authorization:`Bearer ${session.access_token}`}});
          const rj=await rs.json().catch(()=>({}));
          if(rs.ok)setPriceSources(rj.data||[]);
        }
        {
          const defaults={1200:65,1300:69,1400:73,1500:76,1600:79,1800:84,2000:89,2100:91,2200:93,2500:99,3000:109};
          const loaded={...defaults} as Record<number,number>;
          for(const x of (pricesRes.data||[])){const k=Number(x.kcal),v=Number(x.price_per_day);if(Number.isFinite(v)&&v>0)loaded[k]=v;}
          setDietPrices(loaded);
          setDietPriceDrafts(Object.fromEntries(Object.entries(loaded).map(([k,v])=>[Number(k),String(Number(v).toFixed(2)).replace(".",",")])));
        }
      }else{
        setCourierProfiles([]);
      }
    }catch(err:any){
      console.error("loadForUser",err);
      // Brak sieci w trasie nie może zostawić kuriera z pustym ekranem.
      let restored=false;
      try{
        const raw=window.localStorage.getItem("courier_route_cache");
        if(raw){
          const cached=JSON.parse(raw);
          if(cached?.date===today()&&Array.isArray(cached.diets)&&cached.diets.length){
            setDiets(cached.diets as Diet[]);
            setClients((cached.diets as Diet[]).map(d=>d.clients).filter(Boolean) as Client[]);
            setOfflineCopy(true);
            restored=true;
          }
        }
      }catch{}
      setMsg(restored
        ? "Brak połączenia — pokazuję ostatnio pobraną trasę z tego dnia."
        : "Nie udało się wczytać panelu: "+(err?.message||"nieznany błąd"));
    }finally{
      if(!silent)setLoading(false);
    }
  }

  async function refresh(){
    if(!userId)return;
    setMsg("Odświeżanie trasy…");
    await loadForUser(userId,true);
    setMsg(offlineCopy?"Brak połączenia — trasa z kopii lokalnej.":"Trasa odświeżona ✓");
  }
  useEffect(()=>{
    let mounted=true;
    const boot=async()=>{
      try{
        const {data,error}=await supabase.auth.getSession();
        if(error)throw error;
        if(!mounted)return;
        const uid=data.session?.user.id||null;
        setUserId(uid);
        if(uid)await loadForUser(uid);
        else setLoading(false);
      }catch(err:any){
        if(mounted){
          setMsg("Błąd sesji: "+(err?.message||"nieznany błąd"));
          setLoading(false);
        }
      }
    };
    boot();
    const {data:l}=supabase.auth.onAuthStateChange((_e,session)=>{
      const uid=session?.user.id||null;
      setUserId(uid);
      if(!uid){
        setProfile(null);setDiets([]);setClients([]);setCourierProfiles([]);setSelectedCourierRoute(null);setLoading(false);
      }
    });
    return()=>{mounted=false;l.subscription.unsubscribe()};
  },[]);

  // Dostawy potwierdzone dzisiaj — żeby oznaczenia przetrwały odświeżenie.
  useEffect(()=>{
    if(profile?.role!=="courier"&&profile?.role!=="admin")return;
    if(!userId)return;
    let cancelled=false;
    (async()=>{
      const {data,error}=await supabase.from("deliveries").select("diet_id").eq("delivery_date",today());
      if(cancelled||error||!data)return;
      setDeliveredIds(data.map((x:any)=>Number(x.diet_id)).filter(Boolean));
    })();
    return()=>{cancelled=true};
  },[profile?.role,userId]);

  useEffect(()=>{
    if(!userId)return;
    if(profile?.role!=="courier"&&profile?.role!=="admin")return;
    const refresh=()=>loadForUser(userId,true);
    const timer=window.setInterval(refresh,60000);
    const focus=()=>refresh();
    window.addEventListener("focus",focus);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",focus)};
  },[profile?.role,userId]);



  useEffect(()=>{
    if(profile?.role!=="admin")return;
    const timer=window.setInterval(()=>{autoArchiveExpired(false)},60*60*1000);
    return()=>window.clearInterval(timer);
  },[profile?.role,diets]);



  useEffect(()=>{
    if(!userId)return;
    const update=()=>loadForUser(userId,true);
    const onFocus=()=>update();
    const onVisibility=()=>{if(document.visibilityState==="visible")update()};
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{
      window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[userId]);

  async function login(e:FormEvent){
    e.preventDefault();
    if(busy)return;
    setBusy(true);
    setMsg("Logowanie…");
    try{
      const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
      if(error){
        setMsg("Błąd logowania: "+error.message);
        return;
      }
      if(data.user){
        setUserId(data.user.id);
        await loadForUser(data.user.id);
      }else{
        setMsg("Nie udało się pobrać użytkownika po logowaniu.");
      }
    }catch(err){
      setMsg("Błąd połączenia podczas logowania.");
    }finally{
      setBusy(false);
    }
  }
  async function logout(){await supabase.auth.signOut()}
  async function setStatus(id:number,status:Status){
    const previous=diets.find(d=>d.id===id)?.kitchen_status;
    setDiets(list=>list.map(d=>d.id===id?{...d,kitchen_status:status}:d));
    setBusy(true);
    const payload:any={kitchen_status:status,status_changed_at:new Date().toISOString(),status_changed_by:userId};
    if(status==="issued"){payload.issued_at=payload.status_changed_at;payload.issued_by=userId;}
    const {error}=await supabase.from("diets").update(payload).eq("id",id);
    setBusy(false);
    if(error){
      if(previous)setDiets(list=>list.map(d=>d.id===id?{...d,kitchen_status:previous}:d));
      return setMsg("Błąd zapisu: "+error.message);
    }
    setMsg("Status zapisany ✓");
  }

  async function issueProductionToCourier(){
    if(profile?.role!=="kitchen"||busy)return;
    const target=productionDate();
    const pending=diets.filter(d=>!d.archived&&deliversOnDate(d,target)&&d.kitchen_status!=="issued");
    if(!pending.length){
      setMsg(`Wszystkie diety na ${pl(target)} są już wydane kurierowi.`);
      return;
    }
    // Wydajemy wyłącznie pozycje oznaczone jako gotowe — inaczej kurier
    // dostaje trasę z dietami, których fizycznie nie ma w aucie.
    const rows=pending.filter(d=>d.kitchen_status==="ready");
    const notReady=pending.filter(d=>d.kitchen_status!=="ready");
    if(!rows.length){
      setMsg(`Żadna dieta na ${pl(target)} nie jest jeszcze oznaczona jako gotowa. Oznacz je najpierw statusem „Gotowe”.`);
      return;
    }
    const warning=notReady.length
      ? `\n\nUWAGA: ${notReady.length} poz. nie jest gotowych i zostanie pominiętych:\n${notReady.slice(0,8).map(d=>`• ${d.client_name} (${statusText[d.kitchen_status]})`).join("\n")}${notReady.length>8?`\n…i ${notReady.length-8} więcej`:""}`
      : "";
    if(!confirm(`Wydać kurierowi ${rows.length} diet na ${pl(target)}?${warning}`))return;
    const ids=rows.map(d=>d.id);
    setBusy(true);
    setMsg(`Wydawanie ${ids.length} diet kurierowi…`);
    const stamp={kitchen_status:"issued" as Status,issued_at:new Date().toISOString(),issued_by:userId};
    const {error}=await supabase.from("diets").update(stamp).in("id",ids);
    setBusy(false);
    if(error)return setMsg("Błąd wydania kurierowi: "+error.message);
    setDiets(list=>list.map(d=>ids.includes(d.id)?{...d,...stamp}:d));
    setMsg(`Wydano kurierowi ${ids.length} diet na ${pl(target)}${notReady.length?`, pominięto ${notReady.length} niegotowych`:""} ✓`);
  }

  async function addClient(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy)return;
    setBusy(true);
    const form=e.currentTarget;
    const f=new FormData(form);
    const name=String(f.get("name")||"").trim();
    const phoneDigits=String(f.get("phone")||"").replace(/\D/g,"");
    const postal=String(f.get("postal_code")||"").trim();

    if(name.length<2){setBusy(false);return setMsg("Podaj imię lub nazwę klienta.");}
    if(phoneDigits&&!(phoneDigits.length===9||(phoneDigits.length===11&&phoneDigits.startsWith("48")))){
      setBusy(false);return setMsg("Numer telefonu powinien mieć 9 cyfr.");
    }
    const duplicate=clients.find(c=>c.name.trim().toLowerCase()===name.toLowerCase());
    if(duplicate&&!confirm(`Klient „${duplicate.name}" już istnieje.\n\nDodać drugiego o tej samej nazwie?`)){
      setBusy(false);return setMsg("Anulowano — klient o tej nazwie już istnieje.");
    }
    const zone=postal?checkDelivery(postal):null;
    if(zone&&zone.status==="review"&&!confirm(`Kod pocztowy ${postal} jest poza listą obsługiwanych miejscowości.\n\nDodać klienta mimo to?`)){
      setBusy(false);return setMsg("Anulowano — adres poza obszarem dostaw.");
    }

    const payload={name,phone:String(f.get("phone")||""),street_address:String(f.get("street_address")||""),postal_code:postal,city:String(f.get("city")||""),kitchen_notes:String(f.get("kitchen_notes")||""),courier_notes:String(f.get("courier_notes")||"")};
    setMsg("Zapisywanie klienta…");
    const {data,error}=await supabase.from("clients").insert(payload).select("*").single();
    setBusy(false);
    if(error)return setMsg("Błąd zapisu klienta: "+error.message);
    const saved=data as Client;
    setClients(list=>[...list,saved].sort((a,b)=>a.name.localeCompare(b.name,"pl")));
    form.reset();
    setMsg("Klient dodany ✓");
  }

  /**
   * Usunięcie klienta razem z jego dietami.
   * Przy aktywnej diecie wymagamy wpisania słowa USUŃ — pomyłkowe kliknięcie
   * nie może skasować klienta, któremu jutro wyjeżdża jedzenie.
   */
  async function deleteClient(c:Client){
    if(busy)return;
    const jegoDiety=diets.filter(d=>d.client_id===c.id);
    const aktywne=jegoDiety.filter(d=>!d.archived&&d.end_date>=today());
    let pytanie=`Usunąć klienta „${c.name}"?`;
    if(jegoDiety.length)pytanie+=`\n\nRazem z nim zostanie usuniętych ${jegoDiety.length} ${jegoDiety.length===1?"dieta":"diet"}${aktywne.length?`, w tym ${aktywne.length} AKTYWNYCH`:""}.`;
    pytanie+="\n\nTej operacji nie da się cofnąć.";
    if(!confirm(pytanie))return;
    if(aktywne.length){
      const wpis=prompt(`${c.name} ma aktywną dietę. Wpisz USUŃ, żeby potwierdzić.`);
      if((wpis||"").trim().toUpperCase()!=="USUŃ"){setMsg("Anulowano — klient nie został usunięty.");return;}
    }
    setBusy(true);
    try{
      if(jegoDiety.length){
        const {error:e1}=await supabase.from("diets").delete().eq("client_id",c.id);
        if(e1){setMsg("Nie mogę usunąć diet klienta: "+e1.message);return;}
      }
      const {error:e2}=await supabase.from("clients").delete().eq("id",c.id);
      if(e2){setMsg("Nie mogę usunąć klienta: "+e2.message);return;}
      setClients(l=>l.filter(x=>x.id!==c.id));
      setDiets(l=>l.filter(d=>d.client_id!==c.id));
      setMsg(`Usunięto klienta ${c.name}${jegoDiety.length?` i ${jegoDiety.length} ${jegoDiety.length===1?"dietę":"diet"}`:""} ✓`);
    }finally{ setBusy(false); }
  }

  async function saveClient(c:Client){
    if(busy)return;

    const name=String(c.name||"").trim();
    if(name.length<2){setMsg("Podaj imię lub nazwę klienta.");return;}

    // Dieta wydana kurierowi na dziś — kurier może mieć już pobraną trasę.
    const issuedToday=diets.filter(d=>!d.archived&&d.client_id===c.id&&deliversToday(d)&&d.kitchen_status==="issued");
    if(issuedToday.length&&!confirm(
      `Ten klient ma dziś dietę wydaną kurierowi.\n\nZmiana danych nie zaktualizuje trasy, którą kurier już pobrał — jeśli zmieniasz adres, zadzwoń do niego.\n\nZapisać mimo to?`
    ))return;

    setBusy(true);
    setMsg("Zapisywanie klienta…");
    const {error}=await supabase.from("clients").update({name,phone:c.phone,street_address:c.street_address,postal_code:c.postal_code,city:c.city,kitchen_notes:c.kitchen_notes,courier_notes:c.courier_notes}).eq("id",c.id);
    if(error){setBusy(false);return setMsg("Błąd zapisu klienta: "+error.message);}

    // Nazwisko jest kopiowane do rekordu diety przy jej tworzeniu. Bez tej
    // aktualizacji kurier, kuchnia i etykiety pokazywałyby starą wersję.
    const stale=diets.filter(d=>d.client_id===c.id&&d.client_name!==name).map(d=>d.id);
    if(stale.length){
      const {error:e2}=await supabase.from("diets").update({client_name:name}).in("id",stale);
      if(e2){setBusy(false);return setMsg("Klient zapisany, ale nie udało się odświeżyć nazwy w dietach: "+e2.message);}
      setDiets(list=>list.map(d=>stale.includes(d.id)?{...d,client_name:name}:d));
    }

    setClients(list=>list.map(x=>x.id===c.id?{...x,...c,name}:x));
    setBusy(false);
    setMsg(stale.length?`Klient zapisany, zaktualizowano nazwę w ${stale.length} dietach ✓`:"Klient zapisany ✓");
  }

  async function addDiet(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy)return;
    setBusy(true);
    const form=e.currentTarget;
    const f=new FormData(form);
    const clientId=Number(f.get("client_id"));
    const c=clients.find(x=>x.id===clientId);
    if(!c){setBusy(false);return setMsg("Najpierw wybierz klienta.");}
    const payload={client_id:clientId,client_name:c.name,diet_name:String(f.get("diet_name")),kcal:Number(f.get("kcal")),bags:Number(f.get("bags")),meal_count:([3,4,5].includes(Number(f.get("meal_count")))?Number(f.get("meal_count")):4),route_code:String(f.get("route_code")).toUpperCase(),start_date:String(f.get("start_date")),end_date:String(f.get("end_date")),notes:notesWithRestrictions(String(f.get("notes")||""),f),delivery_weekdays:[
      1,2,3,4,5,
      ...(f.get("saturday_delivery")?[6]:[]),
      ...(f.get("sunday_delivery")?[7]:[])
    ],kitchen_status:"todo" as Status};
    if(payload.end_date<payload.start_date){setBusy(false);return setMsg("Data końcowa nie może być wcześniejsza niż początkowa.");}
    if(!ROUTE_CODES.includes(payload.route_code as any)){setBusy(false);return setMsg("Wybierz trasę z listy.");}

    // Dwie aktywne diety na te same dni = podwójna produkcja i podwójna dostawa.
    const overlap=diets.filter(d=>
      !d.archived&&d.client_id===clientId&&
      d.start_date<=payload.end_date&&d.end_date>=payload.start_date
    );
    if(overlap.length&&!confirm(
      `${c.name} ma już dietę w tym okresie:\n\n${overlap.map(d=>`• ${d.diet_name} ${d.kcal} kcal, ${pl(d.start_date)} – ${pl(d.end_date)}`).join("\n")}\n\nKuchnia wyprodukuje oba zestawy, a kurier zawiezie dwa komplety. Dodać mimo to?`
    )){setBusy(false);return setMsg("Anulowano — dieta nakładałaby się z istniejącą.");}

    setMsg("Zapisywanie diety…");
    const {data,error}=await supabase.from("diets").insert(payload).select("*").single();
    setBusy(false);
    if(error)return setMsg("Błąd zapisu diety: "+error.message);
    const saved={...(data as Omit<Diet,"clients">),clients:c} as Diet;
    setDiets(list=>[...list,saved].sort((a,b)=>a.route_code.localeCompare(b.route_code)||a.client_name.localeCompare(b.client_name,"pl")));
    form.reset();
    setRenewingDiet(null);
    setMsg("Dieta dodana ✓");
  }

  function renewDiet(d:Diet){
    setRenewingDiet(d);
    setShowArchive(false);
    setShowAll(true);
    // Formularz dodawania jest w zakładce „Diety". Bez przełączenia
    // przycisk wyglądał na martwy — przewijaliśmy do ukrytej sekcji.
    setAdminTab("diety");
    setMsg(`Wczytano poprzednią dietę ${d.client_name}. Ustaw nowe daty i kliknij „Odnów dietę”.`);
    window.setTimeout(()=>document.getElementById("add-diet-card")?.scrollIntoView({behavior:"smooth",block:"start"}),120);
  }

  function selectedRouteMatches(routeCode:string){
    if(!selectedCourierRoute)return true;
    if(selectedCourierRoute==="A+B")return routeCode==="A"||routeCode==="B";
    return routeCode===selectedCourierRoute;
  }

  const clientDietHistory=useMemo(()=>{
    const byClient=new Map<number,Diet[]>();
    for(const d of diets.filter(x=>x.archived)){
      const key=Number(d.client_id||0);
      if(!key)continue;
      const arr=byClient.get(key)||[];
      arr.push(d);
      byClient.set(key,arr);
    }
    for(const arr of byClient.values())arr.sort((a,b)=>b.end_date.localeCompare(a.end_date)||b.id-a.id);
    return byClient;
  },[diets]);

  const visible=useMemo(()=>{
    if(profile?.role==="admin"&&showArchive)return diets.filter(d=>d.archived);
    const base=diets.filter(d=>!d.archived);
    if(profile?.role==="courier"){
      return base.filter(d=>deliversToday(d)&&d.kitchen_status==="issued"&&selectedRouteMatches(d.route_code));
    }
    if(profile?.role==="kitchen"){
      const target=productionDate();
      return base.filter(d=>deliversOnDate(d,target));
    }
    return showAll?base:base.filter(d=>deliversToday(d));
  },[diets,showAll,showArchive,profile?.role,selectedCourierRoute,productionTarget,productionDateTick]);
  const courierRoute=useMemo(()=>diets.filter(d=>!d.archived&&deliversToday(d)&&d.kitchen_status==="issued"&&!!fullAddress(d.clients)&&selectedRouteMatches(d.route_code)),[diets,selectedCourierRoute]);
  const courierRouteSegments=useMemo(()=>routeSegments(courierRoute,routeOrder),[courierRoute,routeOrder]);
  const routeUrl=courierRouteSegments[0]?.url||"";
  const routeStopCount=routeAddresses(courierRoute).length;
  const courierMissingAddress=useMemo(()=>diets.filter(d=>!d.archived&&deliversToday(d)&&d.kitchen_status==="issued"&&selectedRouteMatches(d.route_code)&&!fullAddress(d.clients)),[diets,selectedCourierRoute]);

  // Kolejność objazdu liczona po stronie serwera. Bez klucza Google
  // endpoint zwraca kolejność wejściową, więc aplikacja działa jak dotąd.
  useEffect(()=>{
    if(profile?.role!=="courier")return;
    const addresses=routeAddresses(courierRoute);
    if(addresses.length<3){setRouteOrder(null);setRouteOptimized(false);return;}
    let cancelled=false;
    (async()=>{
      try{
        const {data:{session}}=await supabase.auth.getSession();
        if(!session)return;
        const res=await fetch("/api/courier-optimize",{
          method:"POST",
          headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},
          body:JSON.stringify({origin:BASE_ADDRESS,stops:addresses})
        });
        const data=await res.json().catch(()=>({}));
        if(cancelled||!res.ok||!Array.isArray(data?.order))return;
        setRouteOrder(data.order.map((i:number)=>addresses[i]).filter(Boolean));
        setRouteOptimized(!!data.optimized);
      }catch{}
    })();
    return()=>{cancelled=true};
  },[profile?.role,courierRoute]);


  function notesWithRestrictions(base:string,form:FormData){
    const clean=(base||"")
      .replace(/\bBEZ LAKTOZY\b/gi,"")
      .replace(/\bBEZ RYB\b/gi,"")
      .replace(/\bBEZ GLUTENU\b/gi,"")
      .replace(/\bBEZ WIEPRZOWINY\b/gi,"")
      .replace(/\s{2,}/g," ")
      .trim();
    // Flagi bierzemy wprost z modułu alergenów. Wcześniej były wpisane
    // ręcznie i jedna z nich („BEZ LAKTOZY") nie istniała w module —
    // przez co nabiał NIE był odfiltrowywany takiemu klientowi.
    const flags:string[]=ALLERGENS
      .filter(a=>form.get(`excl_${a.id}`))
      .map(a=>a.flag);
    return [clean,...flags].filter(Boolean).join(" · ");
  }

  function hasRestriction(d:Diet,label:string){
    const txt=`${d.diet_name||""} ${d.notes||""}`.toUpperCase();
    return txt.includes(label);
  }

  async function setDietMealCount(d:Diet,count:3|4|5){
    if(busy)return;
    const previous=effectiveMealCount(d);
    // Zmień UI od razu — select nie może wracać do starej wartości podczas zapisu.
    setDiets(list=>list.map(x=>x.id===d.id?{...x,meal_count:count}:x));
    setBusy(true);
    setMsg(`Zapisywanie ${count} posiłków dla ${d.client_name}…`);

    const {data,error}=await supabase
      .from("diets")
      .update({meal_count:count})
      .eq("id",d.id)
      .select("id,meal_count")
      .maybeSingle();

    setBusy(false);

    if(error){
      setDiets(list=>list.map(x=>x.id===d.id?{...x,meal_count:previous}:x));
      return setMsg("Błąd zapisu liczby posiłków: "+error.message);
    }
    if(!data||Number((data as any).meal_count)!==count){
      setDiets(list=>list.map(x=>x.id===d.id?{...x,meal_count:previous}:x));
      return setMsg("Nie zapisano liczby posiłków w bazie. Sprawdź kolumnę meal_count / RLS w Supabase.");
    }

    // Utrzymaj dokładnie wartość potwierdzoną przez bazę.
    setDiets(list=>list.map(x=>x.id===d.id?{...x,meal_count:Number((data as any).meal_count)}:x));
    setMsg(`${d.client_name}: zapisano ${count} posiłków ✓`);
  }

  async function saveDietEdit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!editingDiet||busy)return;
    setBusy(true);
    const f=new FormData(e.currentTarget);
    const clientId=Number(f.get("client_id"));
    const c=clients.find(x=>x.id===clientId);
    if(!c){setBusy(false);return setMsg("Wybierz klienta.");}
    const update={client_id:clientId,client_name:c.name,diet_name:String(f.get("diet_name")),kcal:Number(f.get("kcal")),bags:Number(f.get("bags")),meal_count:([3,4,5].includes(Number(f.get("meal_count")))?Number(f.get("meal_count")):4),route_code:String(f.get("route_code")).toUpperCase(),start_date:String(f.get("start_date")),end_date:String(f.get("end_date")),notes:notesWithRestrictions(String(f.get("notes")||""),f),delivery_weekdays:[1,2,3,4,5,...(f.get("saturday_delivery")?[6]:[]),...(f.get("sunday_delivery")?[7]:[])]};
    if(update.end_date<update.start_date){setBusy(false);return setMsg("Data końcowa nie może być wcześniejsza niż początkowa.");}
    setMsg("Zapisywanie zmian…");
    const {data,error}=await supabase.from("diets").update(update).eq("id",editingDiet.id).select("*,meal_count").single();
    setBusy(false);
    if(error)return setMsg("Błąd edycji: "+error.message);
    if(Number((data as any)?.meal_count)!==Number(update.meal_count)){
      return setMsg("Błąd: baza nie zapisała liczby posiłków. Uruchom migrację meal_count w Supabase.");
    }
    const saved={...(data as Omit<Diet,"clients">),clients:c} as Diet;
    setDiets(list=>list.map(d=>d.id===saved.id?saved:d));
    setEditingDiet(null);
    setMsg("Dieta zaktualizowana ✓");
  }

  async function markDelivered(dietId:number,clientName:string){
    if(deliveringId)return;
    if(!confirm(`Potwierdzasz dostawę dla: ${clientName}?\n\nKlient dostanie SMS, że dieta czeka pod drzwiami.`))return;
    setDeliveringId(dietId);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session){setMsg("Sesja wygasła. Zaloguj się ponownie.");return;}
      const res=await fetch("/api/courier-delivered",{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({diet_id:dietId})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok){setMsg(data?.error||"Nie udało się potwierdzić dostawy.");return;}
      setDeliveredIds(list=>list.includes(dietId)?list:[...list,dietId]);
      setMsg(data?.message||"Dostawa potwierdzona ✓");
    }catch{
      setMsg("Brak połączenia. Spróbuj ponownie.");
    }finally{
      setDeliveringId(null);
    }
  }

  async function saveCourierRoutes(courier:Profile,routes:string[]){
    if(busy)return;
    setBusy(true);
    const clean=[...new Set(routes.map(r=>r.trim().toUpperCase()).filter(Boolean))].sort();
    setCourierProfiles(list=>list.map(p=>p.id===courier.id?{...p,route_codes:clean,route_code:clean[0]||null}:p));
    const {error}=await supabase.from("profiles").update({route_codes:clean,route_code:clean[0]||null}).eq("id",courier.id);
    setBusy(false);
    if(error){
      setMsg("Błąd przypisania tras: "+error.message);
      await refresh();
      return;
    }
    setMsg(`Trasy kuriera zapisane: ${clean.join(", ")||"brak"} ✓`);
  }

  function chooseCourierRoute(route:string){
    const r=route.toUpperCase();
    setSelectedCourierRoute(r);
    if(typeof window!=="undefined")window.localStorage.setItem("courier_selected_route",r);
  }

  const addDeliveryDays=(start:string,days:number,saturday:boolean,sunday:boolean)=>{
    const allowed=new Set<number>([1,2,3,4,5,...(saturday?[6]:[]),...(sunday?[0]:[])]);
    let d=new Date(start+"T12:00:00");
    let count=0;
    while(count<Math.max(1,days)){
      if(allowed.has(d.getDay()))count++;
      if(count<Math.max(1,days))d.setDate(d.getDate()+1);
    }
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  };

  const routeForOrder=(o:any)=>{
    const text=`${o.postal_code||""} ${o.city||""} ${o.street_address||""}`.toLowerCase();
    // Zachowujemy prostą regułę startową; trasę można od razu zmienić w diecie.
    if(text.includes("żory")||text.includes("zory")||text.includes("jastrzęb")||text.includes("jastrzeb"))return "B";
    return "A";
  };

  async function acceptStoreOrder(o:any){
    if(busy)return;
    setBusy(true);
    setMsg(`Przyjmuję zamówienie ${o.customer_name}…`);

    try{
      // Nie twórz drugi raz tego samego zamówienia.
      if(o.status==="accepted"){setMsg("To zamówienie jest już przyjęte.");return;}

      const sameClient=clients.find(c=>
        c.name.trim().toLowerCase()===String(o.customer_name||"").trim().toLowerCase()&&
        String(c.street_address||"").trim().toLowerCase()===String(o.street_address||"").trim().toLowerCase()&&
        String(c.postal_code||"").trim()===String(o.postal_code||"").trim()&&
        String(c.city||"").trim().toLowerCase()===String(o.city||"").trim().toLowerCase()
      );

      let client:Client;
      if(sameClient){
        client=sameClient;
      }else{
        const notes=String(o.notes||"");
        const allergenMatch=notes.match(/ALERGENY:\s*([^·]+)/i);
        const kitchenNotes=allergenMatch?`ALERGENY: ${allergenMatch[1].trim()}`:"";
        const accessMatch=notes.match(/WEJŚCIE DO KLATKI:\s*([^·]+)/i);
        const {data:createdClient,error:clientError}=await supabase.from("clients").insert({
          name:o.customer_name,
          phone:o.phone||"",
          street_address:o.street_address||"",
          postal_code:o.postal_code||"",
          city:o.city||"",
          kitchen_notes:kitchenNotes,
          courier_notes:accessMatch?`WEJŚCIE: ${accessMatch[1].trim()}`:""
        }).select("*").single();
        if(clientError)throw new Error("Klient: "+clientError.message);
        client=createdClient as Client;
        setClients(list=>[...list,client].sort((a,b)=>a.name.localeCompare(b.name,"pl")));
      }

      const mealCount=([3,4,5].includes(Number(o.meal_count))?Number(o.meal_count):4);
      const dietName=String(o.diet_name||"Standard");
      const start=String(o.start_date);
      const end=addDeliveryDays(start,Number(o.days||1),!!o.saturday_delivery,!!o.sunday_delivery);
      const route=routeForOrder(o);
      const deliveryWeekdays=[1,2,3,4,5,...(o.saturday_delivery?[6]:[]),...(o.sunday_delivery?[7]:[])];

      const {data:createdDiet,error:dietError}=await supabase.from("diets").insert({
        client_id:client.id,
        client_name:client.name,
        diet_name:dietName,
        kcal:Number(o.kcal),
        bags:1,
        meal_count:mealCount,
        route_code:route,
        start_date:start,
        end_date:end,
        notes:o.notes||null,
        delivery_weekdays:deliveryWeekdays,
        kitchen_status:"todo"
      }).select("*").single();
      if(dietError)throw new Error("Dieta: "+dietError.message);

      const {error:orderError}=await supabase.from("store_orders").update({status:"accepted"}).eq("id",o.id);
      if(orderError){
        await supabase.from("diets").delete().eq("id",createdDiet.id);
        throw new Error("Status zamówienia: "+orderError.message);
      }

      const saved={...(createdDiet as Omit<Diet,"clients">),clients:client} as Diet;
      setDiets(list=>[...list,saved].sort((a,b)=>a.route_code.localeCompare(b.route_code)||a.client_name.localeCompare(b.client_name,"pl")));
      setStoreOrders(list=>list.map(x=>x.id===o.id?{...x,status:"accepted"}:x));
      setProductionDateTick(x=>x+1);
      setMsg(`✓ ${o.customer_name}: klient i dieta utworzone automatycznie · trasa ${route}`);
    }catch(err:any){
      setMsg("Błąd przyjmowania zamówienia: "+(err?.message||String(err)));
    }finally{
      setBusy(false);
    }
  }

  async function setStoreOrderStatus(id:number,status:"accepted"|"rejected"){setBusy(true);const{error}=await supabase.from("store_orders").update({status}).eq("id",id);setBusy(false);if(error)return setMsg("Błąd: "+error.message);setStoreOrders(list=>list.map(o=>o.id===id?{...o,status}:o));}

  const prodMealLabel=(m:string)=>({breakfast:"Śniadanie",second_breakfast:"II posiłek",lunch:"Obiad",dinner:"Kolacja",shake:"🥤 Shake"} as Record<string,string>)[m]||m;
  const prodDietType=(name:string)=>{
    const n=(name||"").trim().toLowerCase();
    if(n.includes("low carb")||n.includes("low-carb")||n.includes("lowcarb"))return "Low Carb";
    if(n.includes("keto"))return "Keto";
    if(n.includes("vege")||n.includes("wege"))return "Vege";
    return "Standard";
  };
  const effectiveMealCount=(d:Diet)=>{
    const raw=Number(d.meal_count);
    if(raw===3||raw===4||raw===5)return raw;
    // tylko stare rekordy bez meal_count
    const legacyName=String(d.diet_name||"").toLowerCase();
    return legacyName.includes("3 posiłki")||legacyName.includes("3 posilki")||legacyName.includes("3 dania")?3:4;
  };

  const canonicalDietLabel=(d:Diet)=>{
    const type=prodDietType(d.diet_name);
    return `${type} · ${Number(d.kcal)} kcal · ${effectiveMealCount(d)} posiłki`;
  };
  /**
   * Plan posiłków z udziałem w kaloryczności dnia.
   * Proporcje bierzemy ze wspólnej tabeli — wcześniej panel miał własną,
   * inną niż moduł kuchni, przez co ten sam posiłek miał dwie różne
   * kaloryczności w zależności od ekranu.
   */
  const mealPlanFor=(count:number,dietType:string)=>{
    const sloty=slotsForDiet(count,dietType);
    const pozycje=sloty.map(m=>({meal_type:m}));
    return sloty.map(m=>({meal_type:m,share:udzialPosilku(m,dietType,pozycje)}));
  };
  const mealSlotsForCount=(count:number,dietType:string)=>mealPlanFor(count,dietType).map(x=>x.meal_type);
  const mealShareForCount=(meal:string,count:number,dietType:string)=>mealPlanFor(count,dietType).find(x=>x.meal_type===meal)?.share||0;
  // Liczymy wprost ze wspólnej tabeli, po posiłkach faktycznie zaplanowanych.
  const normalizedMealShare=(meal:string,g:any,rows:any[]):number=>
    udzialPosilku(meal,g?.dietType,rows||[]);
  const mealShare=(m:string,dietType:string)=>mealShareForCount(m,dietType==="3 posiłki"?3:4,dietType);
  const LOW_CARB_GRAMS:Record<string,Array<{name:string;grams:number}>>={
  "Jajka z twarożkiem i warzywami":[{name:"Jajka",grams:120},{name:"Twaróg półtłusty",grams:100},{name:"Pomidor",grams:100},{name:"Ogórek",grams:100},{name:"Szczypiorek",grams:10},{name:"Oliwa",grams:5}],
  "Omlet ze szpinakiem i fetą":[{name:"Jajka",grams:150},{name:"Szpinak",grams:70},{name:"Feta",grams:50},{name:"Pomidor",grams:100},{name:"Oliwa",grams:5}],
  "Jajecznica z indykiem i cukinią":[{name:"Jajka",grams:150},{name:"Indyk",grams:80},{name:"Cukinia",grams:120},{name:"Szczypiorek",grams:10},{name:"Oliwa",grams:5}],
  "Frittata z brokułem i mozzarellą":[{name:"Jajka",grams:150},{name:"Brokuł",grams:120},{name:"Mozzarella",grams:60},{name:"Pomidor",grams:100}],
  "Serek wiejski z jajkiem i warzywami":[{name:"Serek wiejski",grams:200},{name:"Jajko",grams:60},{name:"Ogórek",grams:100},{name:"Pomidor",grams:100},{name:"Pestki dyni",grams:15}],
  "Szakszuka z fetą":[{name:"Jajka",grams:150},{name:"Pomidor",grams:180},{name:"Papryka",grams:100},{name:"Feta",grams:50},{name:"Oliwa",grams:5}],
  "Skyr z malinami i migdałami":[{name:"Skyr",grams:200},{name:"Maliny",grams:80},{name:"Migdały",grams:25},{name:"Chia",grams:10}],
  "Skyr z borówkami i orzechami":[{name:"Skyr",grams:200},{name:"Borówki",grams:80},{name:"Orzechy włoskie",grams:25}],
  "Twaróg z rzodkiewką i pestkami":[{name:"Twaróg półtłusty",grams:180},{name:"Rzodkiewka",grams:80},{name:"Ogórek",grams:100},{name:"Pestki dyni",grams:20}],
  "Pudding chia ze skyrem i malinami":[{name:"Skyr",grams:180},{name:"Chia",grams:25},{name:"Maliny",grams:80},{name:"Migdały",grams:15}],
  "Serek wiejski z ogórkiem i orzechami":[{name:"Serek wiejski",grams:200},{name:"Ogórek",grams:120},{name:"Orzechy włoskie",grams:25},{name:"Szczypiorek",grams:10}],
  "Roladki z indyka z serkiem i warzywami":[{name:"Indyk",grams:130},{name:"Serek śmietankowy",grams:50},{name:"Ogórek",grams:100},{name:"Papryka",grams:100}],
  "Kurczak z brokułem i cukinią":[{name:"Pierś z kurczaka",grams:180},{name:"Brokuł",grams:180},{name:"Cukinia",grams:180},{name:"Oliwa",grams:15},{name:"Jogurt naturalny",grams:50}],
  "Indyk z fasolką i pieczarkami":[{name:"Indyk",grams:180},{name:"Fasolka szparagowa",grams:180},{name:"Pieczarki",grams:150},{name:"Oliwa",grams:15},{name:"Jogurt naturalny",grams:50}],
  "Łosoś z warzywami i sosem jogurtowym":[{name:"Łosoś",grams:170},{name:"Brokuł",grams:160},{name:"Cukinia",grams:160},{name:"Jogurt naturalny",grams:70},{name:"Oliwa",grams:10}],
  "Kurczak curry z kalafiorem":[{name:"Pierś z kurczaka",grams:180},{name:"Kalafior",grams:220},{name:"Cukinia",grams:120},{name:"Jogurt naturalny",grams:70},{name:"Oliwa",grams:15},{name:"Curry",grams:5}],
  "Pulpeciki z indyka z cukinią":[{name:"Indyk mielony",grams:180},{name:"Cukinia",grams:180},{name:"Pomidor",grams:150},{name:"Brokuł",grams:120},{name:"Oliwa",grams:12}],
  "Kurczak po śródziemnomorsku":[{name:"Pierś z kurczaka",grams:180},{name:"Cukinia",grams:140},{name:"Papryka",grams:120},{name:"Pomidor",grams:120},{name:"Feta",grams:50},{name:"Oliwa",grams:10}],
  "Dorsz z puree kalafiorowym":[{name:"Dorsz",grams:200},{name:"Kalafior",grams:250},{name:"Brokuł",grams:150},{name:"Masło",grams:15}],
  "Wołowina z fasolką i papryką":[{name:"Wołowina",grams:170},{name:"Fasolka szparagowa",grams:170},{name:"Papryka",grams:130},{name:"Cukinia",grams:130},{name:"Oliwa",grams:15}],
  "Indyk w sosie pieczarkowym z brokułem":[{name:"Indyk",grams:180},{name:"Pieczarki",grams:180},{name:"Brokuł",grams:180},{name:"Jogurt naturalny",grams:80},{name:"Oliwa",grams:12}],
  "Kurczak caprese z cukinią":[{name:"Pierś z kurczaka",grams:180},{name:"Mozzarella",grams:70},{name:"Pomidor",grams:150},{name:"Cukinia",grams:180},{name:"Oliwa",grams:10}],
  "Schab z kapustą i fasolką":[{name:"Schab",grams:180},{name:"Kapusta",grams:180},{name:"Fasolka szparagowa",grams:180},{name:"Oliwa",grams:15}],
  "Kurczak z warzywami stir-fry":[{name:"Pierś z kurczaka",grams:180},{name:"Brokuł",grams:150},{name:"Papryka",grams:120},{name:"Cukinia",grams:150},{name:"Sezam",grams:15},{name:"Oliwa",grams:10}],
  "Sałatka z kurczakiem i fetą":[{name:"Pierś z kurczaka",grams:140},{name:"Feta",grams:50},{name:"Sałata",grams:80},{name:"Pomidor",grams:120},{name:"Ogórek",grams:120},{name:"Oliwa",grams:10}],
  "Omlet warzywny z mozzarellą":[{name:"Jajka",grams:150},{name:"Mozzarella",grams:60},{name:"Szpinak",grams:70},{name:"Pieczarki",grams:120},{name:"Oliwa",grams:5}],
  "Twaróg z warzywami i pestkami":[{name:"Twaróg półtłusty",grams:180},{name:"Pomidor",grams:100},{name:"Ogórek",grams:100},{name:"Papryka",grams:80},{name:"Pestki dyni",grams:20}],
  "Sałatka z tuńczykiem i jajkiem":[{name:"Tuńczyk",grams:120},{name:"Jajko",grams:60},{name:"Sałata",grams:80},{name:"Ogórek",grams:100},{name:"Pomidor",grams:100},{name:"Oliwa",grams:10}],
  "Sałatka grecka z kurczakiem":[{name:"Pierś z kurczaka",grams:130},{name:"Feta",grams:60},{name:"Ogórek",grams:100},{name:"Pomidor",grams:120},{name:"Oliwki",grams:30},{name:"Oliwa",grams:10}],
  "Cukinia faszerowana indykiem":[{name:"Cukinia",grams:250},{name:"Indyk mielony",grams:150},{name:"Pomidor",grams:120},{name:"Mozzarella",grams:50},{name:"Oliwa",grams:8}],
  "Jajka z łososiem i sałatą":[{name:"Jajka",grams:120},{name:"Łosoś",grams:100},{name:"Sałata",grams:80},{name:"Ogórek",grams:100},{name:"Oliwa",grams:8}],
  "Kurczak z tzatziki i warzywami":[{name:"Pierś z kurczaka",grams:150},{name:"Jogurt naturalny",grams:100},{name:"Ogórek",grams:120},{name:"Sałata",grams:80},{name:"Pomidor",grams:100},{name:"Oliwa",grams:8}],
 };
  const ingredientsForRecipe=(r:any)=>{
    const linked=r?.recipe_ingredients||[];
    if(linked.length)return linked;
    return (LOW_CARB_GRAMS[r?.name]||[]).map((x:any)=>({grams:x.grams,ingredients:{id:`fallback-${x.name}`,name:x.name,unit:"g"}}));
  };
  const fmtWeight=(g:number)=>g>=1000?`${(g/1000).toFixed(g>=10000?1:2)} kg`:`${Math.round(g)} g`;

  function dateIsoLocal(offsetDays=0){
    const d=new Date();
    d.setHours(12,0,0,0);
    d.setDate(d.getDate()+offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function weekdayNumberFor(dateStr:string){
    const d=new Date(dateStr+"T12:00:00");
    const js=d.getDay();
    return js===0?7:js;
  }
  // Ta sama reguła co w module kuchni: zakres dat i dni tygodnia 1–7.
  function deliversOnDate(d:Diet,dateStr:string){
    return dostawaWDniu({...d,archived:false},dateStr);
  }
  // Wspólna logika z modułem kuchni i etykietami — lib/productionDay.ts.
  function findNextDeliveryDate(items:Diet[]){
    return najblizszaDostawa((items||[]).filter(d=>!d.archived));
  }
  function productionDate(){
    return productionTarget||findNextDeliveryDate(diets);
  }


  const datePlusDays=(days:number)=>{
    const d=new Date();
    d.setHours(12,0,0,0);
    d.setDate(d.getDate()+days);
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,"0");
    const day=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  };

  // Najbliższy REALNY dzień, na który trzeba przygotować catering.
  // Nie zakładamy już sztywno „jutro”. Jeśli np. w piątek nie ma wyjazdu,
  // a są diety na sobotę, dashboard automatycznie pokaże sobotę.
  const nextDeliveryDate=useMemo(()=>{
    for(let offset=1;offset<=14;offset++){
      const target=datePlusDays(offset);
      if(diets.some(d=>!d.archived&&deliversOnDate(d,target)))return target;
    }
    return datePlusDays(1);
  },[diets,productionDateTick]);

  const nextDeliveryDiets=useMemo(()=>{
    // Wspólna reguła z produkcją i etykietami — lib/productionDay.ts.
    return dietyNaDzien<Diet>(diets,nextDeliveryDate).sort((a,b)=>
      a.route_code.localeCompare(b.route_code)||
      a.client_name.localeCompare(b.client_name,"pl")||
      a.kcal-b.kcal
    );
  },[diets,nextDeliveryDate,productionDateTick]);

  const tomorrowDashboard=useMemo(()=>{
    const clientsCount=nextDeliveryDiets.length;
    const boxes=nextDeliveryDiets.reduce((sum,d)=>sum+Math.max(1,Number(d.bags||1))*effectiveMealCount(d),0);
    const byType=new Map<string,number>();
    const byKcal=new Map<number,number>();
    const byMeals=new Map<number,number>();
    const warnings:string[]=[];

    for(const d of nextDeliveryDiets){
      const type=prodDietType(d.diet_name);
      const mealCount=effectiveMealCount(d);
      byType.set(type,(byType.get(type)||0)+1);
      byKcal.set(Number(d.kcal),(byKcal.get(Number(d.kcal))||0)+1);
      byMeals.set(mealCount,(byMeals.get(mealCount)||0)+1);

      if(!fullAddress(d.clients))warnings.push(`${d.client_name}: brak adresu`);

      // Wspólna baza produkcji: Standard jest źródłem menu dnia także dla Keto i Low Carb.
      // Osobne weekly_menu dla tych diet nie jest wymagane.
      const ownRows=forecastMenus.filter((x:any)=>x.menu_date===nextDeliveryDate&&x.diet_type===type);
      const standardRows=forecastMenus.filter((x:any)=>x.menu_date===nextDeliveryDate&&x.diet_type==="Standard");
      const rows=ownRows.length?ownRows:standardRows;

      if(!rows.length){
        warnings.push(`Brak ułożonego menu bazowego na ${pl(nextDeliveryDate)}`);
        continue;
      }

      for(const row of rows){
        const recipe=row.recipes;
        if(!recipe)warnings.push(`Brak receptury bazowej — ${prodMealLabel(row.meal_type)}`);
        else if(!recipe.recipe_ingredients?.length)warnings.push(`Brak gramatury — ${recipe.name}`);
      }
    }

    return {
      clientsCount,boxes,
      types:[...byType.entries()].sort(),
      kcals:[...byKcal.entries()].sort((a,b)=>a[0]-b[0]),
      meals:[...byMeals.entries()].sort((a,b)=>a[0]-b[0]),
      warnings:[...new Set(warnings)]
    };
  },[nextDeliveryDiets,nextDeliveryDate,forecastMenus]);

  const productionDietsActual=useMemo(()=>{
    // Wspólna reguła z modułem kuchni i etykietami — lib/productionDay.ts.
    return dietyNaDzien<Diet>(diets,productionDate())
      .sort((a,b)=>a.route_code.localeCompare(b.route_code)||a.client_name.localeCompare(b.client_name,"pl")||a.kcal-b.kcal);
  },[diets,productionTarget,productionDateTick]);

  const productionDuplicateCount=useMemo(()=>{
    const target=productionDate();
    const all=diets.filter(d=>!d.archived&&deliversOnDate(d,target));
    return Math.max(0,all.length-productionDietsActual.length);
  },[diets,productionDietsActual,productionTarget,productionDateTick]);

  const outboundDietSummary=useMemo(()=>{
    const map=new Map<string,number>();
    for(const d of productionDietsActual){
      const type=prodDietType(String(d.diet_name||""));
      const key=`${type}|${d.kcal}|${effectiveMealCount(d)}`;
      map.set(key,(map.get(key)||0)+Math.max(1,Number(d.bags||1)));
    }
    return [...map.entries()].map(([key,count])=>{
      const [dietType,kcal,mealCount]=key.split("|");
      return {dietType,kcal:Number(kcal),mealCount:Number(mealCount),count};
    }).sort((a,b)=>a.dietType.localeCompare(b.dietType)||a.kcal-b.kcal||a.mealCount-b.mealCount);
  },[productionDietsActual]);

  const kitchenDietGroups=useMemo(()=>{
    const groups=new Map<string,{dietType:string;kcal:number;count:number;flags:string[];mealCount:number;clients:string[];dietIds:number[]}>();
    for(const d of productionDietsActual){
      const dietType=prodDietType(String(d.diet_name||""));
      const flags=restrictionFlags(d);
      const mealCount=effectiveMealCount(d);
      const flagKey=flags.join("+")||"NORMAL";
      const key=`${dietType}|${d.kcal}|${mealCount}|${flagKey}`;
      const cur=groups.get(key)||{dietType,kcal:Number(d.kcal),count:0,flags,mealCount,clients:[],dietIds:[]};
      cur.count+=Math.max(1,Number(d.bags||1));
      if(!cur.clients.includes(d.client_name))cur.clients.push(d.client_name);
      cur.dietIds.push(d.id);
      groups.set(key,cur);
    }
    return [...groups.values()].sort((a,b)=>a.dietType.localeCompare(b.dietType)||a.kcal-b.kcal||a.mealCount-b.mealCount||(a.flags.join(",")).localeCompare(b.flags.join(",")));
  },[productionDietsActual]);

  // Wiersze dla grupy — ta sama logika co moduł kuchni i naklejki.
  const productionRowsForGroup=(g:{dietType:string;kcal:number;count:number;flags:string[];mealCount:number})=>{
    const baza=todayProduction.filter((x:any)=>x.diet_type==="Standard");
    return rowsForSlots(baza,slotsForDiet(g.mealCount,g.dietType))
      .map((x:any)=>({...x,productionDietType:g.dietType}));
  };

  const recipeIngredientNames=(r:any)=>(r?.recipe_ingredients||[]).map((ri:any)=>(ri?.ingredients?.name||"").toString().trim().toLowerCase()).filter(Boolean);
  const recipeOverlap=(a:any,b:any)=>{
    const A=new Set(recipeIngredientNames(a)),B=new Set(recipeIngredientNames(b));
    if(!A.size||!B.size)return 0;
    let common=0; A.forEach(x=>{if(B.has(x))common++});
    return common/Math.max(A.size,B.size);
  };
  // Ta sama reguła doboru co moduł kuchni i naklejki. Nigdy nie zwraca
  // dania z wykluczonym składnikiem — brak bezpiecznej receptury to null.
  const commonRecipeForGroup=(x:any,g:any)=>
    chooseRecipe(x,{dietType:g.dietType,flags:g.flags||[],mealCount:Number(g.mealCount)||4},allRecipes as any[],tydzienProdukcji);

  async function loadProductionFor(dateStr:string){
    if(!(profile?.role==="kitchen"||profile?.role==="admin"))return;
    try{
      const req=Promise.all([
        supabase.from("weekly_menu")
          .select("id,menu_date,diet_type,meal_type,recipe_id,recipes(id,name,meal_type,diet_type,base_kcal,protein,fat,carbs,food_cost,notes,recipe_ingredients(grams,ingredients(id,name,unit,price_per_kg,actual_price_per_kg,web_price_per_kg,web_price_source,web_price_checked_at,calc_price_mode)))")
          .eq("menu_date",dateStr),
        supabase.from("recipes")
          .select("id,name,meal_type,diet_type,base_kcal,protein,fat,carbs,food_cost,notes,active,recipe_ingredients(grams,ingredients(id,name,unit,price_per_kg,actual_price_per_kg,web_price_per_kg,web_price_source,web_price_checked_at,calc_price_mode)))")
          .eq("active",true)
      ]);
      const timeout=new Promise<any>((_,reject)=>window.setTimeout(()=>reject(new Error("Timeout menu kuchni")),12000));
      const [menuRes,recipesRes]=await Promise.race([req,timeout]) as any;
      if(menuRes?.error||recipesRes?.error)throw new Error(menuRes?.error?.message||recipesRes?.error?.message||"Błąd receptur");
      setTodayProduction(menuRes?.data||[]);
      setAllRecipes(recipesRes?.data||[]);
      // Cały tydzień — tło dla zamienników, ten sam zakres co w module kuchni.
      const {od,do:doDnia}=zakresTygodnia(dateStr);
      const tyg=await supabase.from("weekly_menu")
        .select("id,menu_date,diet_type,meal_type,recipe_id,recipes(id,name,meal_type,diet_type,base_kcal,protein,fat,carbs,food_cost,notes,recipe_ingredients(grams,ingredients(id,name,unit)))")
        .gte("menu_date",od).lte("menu_date",doDnia);
      setTydzienProdukcji(tyg.data||[]);
    }catch(err:any){
      console.error("loadProductionFor",err);
      setTodayProduction([]);
      setAllRecipes([]);
      setMsg("Nie udało się wczytać menu kuchni: "+(err?.message||"nieznany błąd"));
    }
  }

  useEffect(()=>{
    if(!(profile?.role==="kitchen"||profile?.role==="admin")||!diets.length)return;
    const target=findNextDeliveryDate(diets);
    setProductionTarget(target);
    loadProductionFor(target);
  },[profile?.role,diets]);

  useEffect(()=>{
    const timer=window.setInterval(()=>{
      setProductionDateTick(v=>v+1);
      if((profile?.role==="kitchen"||profile?.role==="admin")&&diets.length){
        const target=findNextDeliveryDate(diets);
        setProductionTarget(target);
        loadProductionFor(target);
      }
    },60000);
    return()=>window.clearInterval(timer);
  },[profile?.role,diets]);

  function printProduction(){
    if(!kitchenDietGroups.length){setMsg("Brak pozycji produkcyjnych do wydruku.");return;}
    window.print();
  }

  function restrictionFlags(d:Diet){
    return detectRestrictions(d.diet_name,d.notes,d.clients?.kitchen_notes);
  }

  // Treść wykluczeń wpisana przez klienta własnymi słowami. Lista rdzeni
  // nigdy nie będzie kompletna, więc kuchnia musi widzieć oryginał.
  function rawRestrictionText(d:Diet){
    return unmatchedRestrictionText(d.notes)||unmatchedRestrictionText(d.clients?.kitchen_notes||"");
  }

  function ingredientBlocked(name:string,flags:string[]){
    return blockedByAllergen(name,flags);
  }

  function recipeExplicitlyMatchesFlags(r:any,flags:string[]){
    const notes=(r?.notes||"").toUpperCase();
    return flags.every(f=>notes.includes(f));
  }

  function recipeAllowedForFlags(r:any,flags:string[]){
    if(!flags.length)return true;
    const ris=r?.recipe_ingredients||[];
    return !ris.some((ri:any)=>ingredientBlocked(ri?.ingredients?.name||"",flags));
  }

  async function setDietArchived(diet:Diet,archived:boolean){
    if(profile?.role!=="admin"||busy)return;
    setBusy(true);
    const payload={archived,archived_at:archived?new Date().toISOString():null};
    const {error}=await supabase.from("diets").update(payload).eq("id",diet.id);
    setBusy(false);
    if(error)return setMsg("Błąd archiwum: "+error.message);
    setDiets(list=>list.map(d=>d.id===diet.id?{...d,...payload}:d));
    setMsg(archived?"Dieta przeniesiona do archiwum ✓":"Dieta przywrócona z archiwum ✓");
  }

  function kitchenIngredientRows(r:any,factor:number,count:number){
    const rows=ingredientsForRecipe(r).map((ri:any)=>{
      const one=Number(ri.grams||0)*factor;
      const total=one*count;
      return {
        id:`${r.id}-${ri.ingredients?.id}`,
        name:ri.ingredients?.name||"Składnik",
        one,
        total,
        unit:ri.ingredients?.unit||"g"
      };
    });
    return rows;
  }

  async function addPriceSource(ingredientId:number,retailer:string,url:string,packageGrams:string){
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token)return setMsg("Brak sesji admina.");
    const res=await fetch("/api/price-sources",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({ingredient_id:ingredientId,retailer,url,package_grams:packageGrams?Number(packageGrams):null})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)return setMsg(data?.error||"Nie udało się dodać źródła.");
    setPriceSources(list=>[...list.filter(x=>x.id!==data.data.id),data.data]);
    setMsg("Źródło ceny dodane ✓");
  }

  async function runPriceMonitor(){
    setMonitorBusy(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)return setMsg("Sesja wygasła — zaloguj się ponownie.");
      const res=await fetch("/api/price-monitor",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`}});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)return setMsg(data?.error||`Błąd monitora cen (${res.status}).`);
      const ok=(data.results||[]).filter((x:any)=>x.status==="ok").length;
      const bad=(data.results||[]).length-ok;
      setMsg(`Ceny sprawdzone ✓ poprawne: ${ok}, błędy: ${bad}`);
      if(userId)await loadForUser(userId,true);
    }catch(err:any){
      setMsg("Błąd połączenia monitora: "+(err?.message||"nieznany"));
    }finally{setMonitorBusy(false)}
  }

  function calcIngredientPrice(i:any){
    const actual=Number(i?.actual_price_per_kg||i?.price_per_kg||0);
    const web=Number(i?.web_price_per_kg||0);
    const mode=i?.calc_price_mode||"actual";
    if(mode==="web"&&web>0)return web;
    if(mode==="higher")return Math.max(actual,web);
    if(mode==="lower"){
      const vals=[actual,web].filter(v=>v>0);
      return vals.length?Math.min(...vals):0;
    }
    return actual>0?actual:web;
  }

  async function saveIngredientPrice(i:any, patch:any){
    if(profile?.role!=="admin"||busy)return;
    setBusy(true);
    const payload={...patch};
    if("actual_price_per_kg" in payload)payload.actual_price_per_kg=Number(String(payload.actual_price_per_kg).replace(",","."));
    if("web_price_per_kg" in payload)payload.web_price_per_kg=Number(String(payload.web_price_per_kg).replace(",","."));
    if("web_price_per_kg" in payload)payload.web_price_checked_at=new Date().toISOString();
    const {data,error}=await supabase.from("ingredients")
      .update(payload).eq("id",i.id)
      .select("id,name,unit,price_per_kg,actual_price_per_kg,web_price_per_kg,web_price_source,web_price_checked_at,calc_price_mode")
      .single();
    setBusy(false);
    if(error)return setMsg("Błąd zapisu ceny składnika: "+error.message);
    setIngredientPrices(list=>list.map(x=>x.id===i.id?data:x));
    setMsg(`Cena ${i.name} zapisana ✓`);
  }

  async function saveCostSettings(next:any){
    if(profile?.role!=="admin"||busy)return;
    const payload={
      id:1,
      packaging_per_meal:Number(String(next.packaging_per_meal??0).replace(",",".")),
      transport_per_day:Number(String(next.transport_per_day??0).replace(",","."))
    };
    if(!Number.isFinite(payload.packaging_per_meal)||payload.packaging_per_meal<0||!Number.isFinite(payload.transport_per_day)||payload.transport_per_day<0){
      return setMsg("Nieprawidłowe koszty opakowań lub transportu.");
    }
    setBusy(true);
    const {data,error}=await supabase.from("cost_settings").upsert(payload,{onConflict:"id"}).select().single();
    setBusy(false);
    if(error)return setMsg("Błąd zapisu kosztów stałych: "+error.message);
    setCostSettings({packaging_per_meal:Number(data.packaging_per_meal||0),transport_per_day:Number(data.transport_per_day||0)});
    setMsg("Koszty stałe zapisane ✓");
  }

  function ingredientCostForRecipe(r:any,factor:number,portions:number){
    let total=0;
    for(const ri of ingredientsForRecipe(r)){
      const grams=Number(ri.grams||0)*factor*portions;
      const price=calcIngredientPrice(ri.ingredients);
      total+=(grams/1000)*price;
    }
    return total;
  }

  function dateRange(days:number){
    return Array.from({length:days},(_,idx)=>dateIsoLocal(idx));
  }

  const kitchenWeekPlan=useMemo(()=>{
    const now=new Date();
    now.setHours(12,0,0,0);
    const js=now.getDay();
    const mondayShift=js===0?-6:1-js;
    const monday=new Date(now);
    monday.setDate(now.getDate()+mondayShift+kitchenWeekOffset);

    return Array.from({length:7},(_,idx)=>{
      const d=new Date(monday);
      d.setDate(monday.getDate()+idx);
      const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

      // Najnowszy aktywny rekord klienta — ta sama reguła co produkcja i etykiety.
      const dayDiets=dietyNaDzien<Diet>(diets,date).sort((a,b)=>a.client_name.localeCompare(b.client_name,"pl"));

      const typeMap=new Map<string,{count:number;kcals:Set<number>;meals:Set<number>}>();
      const groupMap=new Map<string,{dietType:string;kcal:number;mealCount:number;count:number;flags:string[]}>();
      for(const diet of dayDiets){
        const type=prodDietType(diet.diet_name);
        const portions=Math.max(1,Number(diet.bags||1));
        const mealCount=effectiveMealCount(diet);
        const flags=restrictionFlags(diet);

        const cur=typeMap.get(type)||{count:0,kcals:new Set<number>(),meals:new Set<number>()};
        cur.count+=portions;
        cur.kcals.add(Number(diet.kcal));
        cur.meals.add(mealCount);
        typeMap.set(type,cur);

        const key=`${type}|${Number(diet.kcal)}|${mealCount}|${flags.join("+")||"NORMAL"}`;
        const g=groupMap.get(key)||{dietType:type,kcal:Number(diet.kcal),mealCount,count:0,flags};
        g.count+=portions;
        groupMap.set(key,g);
      }

      const groups=[...groupMap.values()].sort((a,b)=>
        a.dietType.localeCompare(b.dietType)||
        a.kcal-b.kcal||
        a.mealCount-b.mealCount
      );

      const menuRows=forecastMenus.filter((x:any)=>x.menu_date===date);
      const baseRows=menuRows.filter((x:any)=>x.diet_type==="Standard");

      const menu=baseRows.map((x:any)=>({
        meal:x.meal_type,
        name:x.recipes?.name||"BRAK RECEPTURY",
        recipe:x.recipes||null
      }));

      const gramPlan=baseRows.map((baseRow:any)=>{
        const variants=groups.flatMap(g=>{
          const requested=mealPlanFor(g.mealCount,g.dietType);
          const requestedSlots=requested.map(x=>x.meal_type);

          // Tylko posiłki faktycznie należące do planu 3/4/5.
          const slotMatches=requestedSlots.includes(baseRow.meal_type)||
            (baseRow.meal_type==="shake"&&requestedSlots.includes("second_breakfast"));
          if(!slotMatches)return [];

          // Wszystkie dostępne bazowe sloty dla tej grupy — do normalizacji kcal dnia.
          const actualRows=baseRows.filter((row:any)=>
            requestedSlots.includes(row.meal_type)||
            (row.meal_type==="shake"&&requestedSlots.includes("second_breakfast"))
          );
          const rawShares=actualRows.map((row:any)=>{
            const logicalMeal=(row.meal_type==="shake"&&requestedSlots.includes("second_breakfast")&&!requestedSlots.includes("shake"))
              ?"second_breakfast":row.meal_type;
            return requested.find(pp=>pp.meal_type===logicalMeal)?.share||0;
          });
          const totalShare=rawShares.reduce((sum:number,v:number)=>sum+Number(v||0),0)||1;
          const logicalMeal=(baseRow.meal_type==="shake"&&requestedSlots.includes("second_breakfast")&&!requestedSlots.includes("shake"))
            ?"second_breakfast":baseRow.meal_type;
          const rawShare=requested.find(pp=>pp.meal_type===logicalMeal)?.share||0;
          const targetKcal=Math.round(g.kcal*(rawShare/totalShare));

          const baseRecipe=baseRow.recipes;
          let recipe=baseRecipe;

          // Standard zawsze używa wspólnej receptury bazowej.
          // Keto / Low Carb / Vege: najpierw szukamy wariantu tego samego rodzaju posiłku.
          if(g.dietType!=="Standard"){
            const sameMeal=allRecipes.filter((r:any)=>
              r.diet_type===g.dietType&&
              (r.meal_type===baseRow.meal_type||
                (logicalMeal==="second_breakfast"&&r.meal_type==="shake"))&&
              recipeAllowedForFlags(r,g.flags||[])
            );
            if(sameMeal.length)recipe=sameMeal[0];
            else if(baseRecipe&&!recipeAllowedForFlags(baseRecipe,g.flags||[]))recipe=null;
          }else if(baseRecipe&&!recipeAllowedForFlags(baseRecipe,g.flags||[])){
            const alt=allRecipes.find((r:any)=>
              r.diet_type==="Standard"&&r.meal_type===baseRow.meal_type&&recipeAllowedForFlags(r,g.flags||[])
            );
            recipe=alt||null;
          }

          if(!recipe){
            return [{
              dietType:g.dietType,kcal:g.kcal,mealCount:g.mealCount,count:g.count,
              flags:g.flags,targetKcal,recipe:null,recipeName:"BRAK ZAMIENNIKA",ingredients:[]
            }];
          }

          const factor=targetKcal/Math.max(1,Number(recipe.base_kcal||targetKcal));
          const ingredients=(recipe.recipe_ingredients||[]).map((ri:any)=>({
            name:String(ri?.ingredients?.name||"Składnik"),
            grams:Math.max(0,Math.round(Number(ri?.grams||0)*factor))
          }));

          return [{
            dietType:g.dietType,kcal:g.kcal,mealCount:g.mealCount,count:g.count,
            flags:g.flags,targetKcal,recipe,
            recipeName:String(recipe.name||"Receptura"),
            ingredients
          }];
        });

        return {
          meal:baseRow.meal_type,
          baseName:baseRow.recipes?.name||"BRAK RECEPTURY",
          variants
        };
      });

      return {
        date,
        dayDiets,
        groups,
        types:[...typeMap.entries()],
        menu,
        gramPlan
      };
    });
  },[diets,forecastMenus,allRecipes,kitchenWeekOffset,productionDateTick]);


  const selectedKitchenProduction=useMemo(()=>{
    const fallback=kitchenWeekPlan.find((d:any)=>d.dayDiets.length)?.date||kitchenWeekPlan[0]?.date||"";
    const date=selectedKitchenDay&&kitchenWeekPlan.some((d:any)=>d.date===selectedKitchenDay)?selectedKitchenDay:fallback;
    const day=kitchenWeekPlan.find((d:any)=>d.date===date)||null;
    if(!day)return {date:"",day:null,boxes:0,ingredients:[] as any[]};

    const ingredientMap=new Map<string,{name:string;grams:number}>();
    for(const meal of day.gramPlan||[]){
      for(const v of meal.variants||[]){
        for(const ing of v.ingredients||[]){
          const key=String(ing.name||"").trim().toLowerCase();
          if(!key)continue;
          const cur=ingredientMap.get(key)||{name:String(ing.name||""),grams:0};
          cur.grams+=Number(ing.grams||0)*Number(v.count||0);
          ingredientMap.set(key,cur);
        }
      }
    }
    const boxes=day.dayDiets.reduce((sum:number,d:any)=>sum+Math.max(1,Number(d.bags||1))*effectiveMealCount(d),0);
    return {date,day,boxes,ingredients:[...ingredientMap.values()].sort((a,b)=>a.name.localeCompare(b.name,"pl"))};
  },[kitchenWeekPlan,selectedKitchenDay]);

  function printKitchenProductionPlan(){
    const prod=selectedKitchenProduction;
    if(!prod.day)return setMsg("Brak dnia produkcyjnego do wydruku.");
    const clients=prod.day.dayDiets.map((d:any)=>`<tr><td>${d.client_name}</td><td>${prodDietType(d.diet_name)}</td><td>${d.kcal} kcal</td><td>${effectiveMealCount(d)}</td><td>${Math.max(1,Number(d.bags||1))}</td><td>${restrictionFlags(d).join(" / ")||"-"}</td></tr>`).join("");
    const ingredients=prod.ingredients.map((i:any)=>`<tr><td>${i.name}</td><td><b>${fmtWeight(i.grams)}</b></td></tr>`).join("");
    const meals=(prod.day.gramPlan||[]).map((meal:any)=>`<section><h2>${prodMealLabel(meal.meal)} — ${meal.baseName}</h2>${(meal.variants||[]).map((v:any)=>`<div class="variant"><b>${v.dietType} · ${v.kcal} kcal · ${v.mealCount} posiłki · ${v.count}×</b><div>${v.recipeName} · ${v.targetKcal} kcal</div>${v.ingredients?.length?`<table>${v.ingredients.map((ing:any)=>`<tr><td>${ing.name}</td><td>${ing.grams} g / porcję</td><td><b>${ing.grams*v.count} g łącznie</b></td></tr>`).join("")}</table>`:`<p><b>⚠ BRAK GRAMATURY / ZAMIENNIKA</b></p>`}</div>`).join("")}</section>`).join("");
    const w=window.open("","_blank");
    if(!w)return setMsg("Przeglądarka zablokowała okno wydruku.");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Plan kuchni ${pl(prod.date)}</title><style>body{font-family:Arial;padding:22px;color:#111}table{border-collapse:collapse;width:100%;margin:8px 0 18px}td,th{border:1px solid #ccc;padding:6px;text-align:left;font-size:12px}section{page-break-inside:avoid;border-top:2px solid #111;margin-top:16px;padding-top:8px}.variant{margin:10px 0}</style></head><body><h1>Plan produkcji — ${pl(prod.date)}</h1><p><b>${prod.day.dayDiets.length}</b> klientów · <b>${prod.boxes}</b> pudełek</p><h2>Klienci</h2><table><tr><th>Klient</th><th>Dieta</th><th>Kcal</th><th>Posiłki</th><th>Porcje</th><th>Wykluczenia</th></tr>${clients}</table><h2>Łączna lista składników</h2><table><tr><th>Składnik</th><th>Łącznie</th></tr>${ingredients}</table>${meals}<script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
    w.document.close();
  }

  const detailedForecast=useMemo(()=>{
    let revenue=0,raw=0,packaging=0,transport=0,meals=0,deliveries=0;
    const dates=dateRange(forecastHorizon);
    for(const date of dates){
      const dayDiets=diets.filter(d=>!d.archived&&deliversOnDate(d,date));
      if(!dayDiets.length)continue;
      deliveries++;
      const dayMenu=forecastMenus.filter((x:any)=>x.menu_date===date);
      for(const d of dayDiets){
        const portions=Math.max(1,Number(d.bags||1));
        const dtype=prodDietType(d.diet_name);
        const flags=restrictionFlags(d);
        revenue+=(dietPrices[d.kcal]||0)*portions;
        const rows=dayMenu.filter((x:any)=>x.diet_type===dtype);
        meals+=rows.length*portions;
        for(const x of rows){
          let r=x.recipes;
          if(!r)continue;
          if(!recipeAllowedForFlags(r,flags)){
            const alt=allRecipes.filter((y:any)=>y.diet_type===dtype&&(y.meal_type===x.meal_type||(x.meal_type==="second_breakfast"&&y.meal_type==="shake"))&&recipeAllowedForFlags(y,flags)).sort((a:any,b:any)=>Number(a.food_cost||0)-Number(b.food_cost||0))[0];
            if(alt)r=alt;
          }
          // Bez normalizacji udziały nie sumowały się do pełnego dnia,
          // więc koszt składników wychodził zaniżony.
          const target=Math.round(Number(d.kcal)*udzialPosilku(x.meal_type,dtype,rows));
          const factor=target/Math.max(1,Number(r.base_kcal||target));
          const priced=ingredientCostForRecipe(r,factor,portions);
          raw+=priced>0?priced:Number(r.food_cost||0)*factor*portions;
        }
      }
      transport+=Number(costSettings.transport_per_day||0);
    }
    packaging=meals*Number(costSettings.packaging_per_meal||0);
    const total=raw+packaging+transport;
    return {revenue,raw,packaging,transport,total,profit:revenue-total,margin:revenue>0?((revenue-total)/revenue)*100:0,meals,deliveries};
  },[forecastHorizon,diets,forecastMenus,dietPrices,costSettings,allRecipes]);

  async function saveDietPrice(kcal:number,raw?:string){
    if(profile?.role!=="admin"||busy)return;
    const source=(raw??dietPriceDrafts[kcal]??String(dietPrices[kcal]??0)).trim().replace(",",".");
    const value=Number(source);
    if(!Number.isFinite(value)||value<0||value>1000){
      setMsg(`Nieprawidłowa cena dla ${kcal} kcal.`);
      return;
    }
    const rounded=Math.round(value*100)/100;
    setBusy(true);
    const {data,error}=await supabase.from("diet_prices")
      .upsert({kcal,price_per_day:rounded,updated_at:new Date().toISOString()},{onConflict:"kcal"})
      .select("kcal,price_per_day")
      .single();
    setBusy(false);
    if(error)return setMsg("Błąd zapisu ceny: "+error.message);
    const saved=Number(data?.price_per_day??rounded);
    setDietPrices(prev=>({...prev,[kcal]:saved}));
    setDietPriceDrafts(prev=>({...prev,[kcal]:saved.toFixed(2).replace(".",",")}));
    setMsg(`Cena ${kcal} kcal zapisana: ${saved.toFixed(2)} zł ✓`);
  }

  function chosenRecipeForGroup(x:any,g:any){
    return commonRecipeForGroup(x,g);
  }

  const shoppingList=useMemo(()=>{
    const sums=new Map<string,{id:number;name:string;grams:number;actual:number;web:number;source:string;calc:number}>();
    for(const g of kitchenDietGroups){
      for(const x of productionRowsForGroup(g)){
        const r=chosenRecipeForGroup(x,g); if(!r)continue;
        const rows=productionRowsForGroup(g); const share=normalizedMealShare(x.meal_type,g,rows); const target=Math.round(g.kcal*share);
        const factor=target/Math.max(1,Number(r.base_kcal||target));
        for(const ri of ingredientsForRecipe(r)){
          const ing=ri.ingredients||{};
          const name=ing.name||"Składnik";
          const key=String(ing.id||name.toLowerCase());
          const cur=sums.get(key)||{id:Number(ing.id||0),name,grams:0,actual:Number(ing.actual_price_per_kg||ing.price_per_kg||0),web:Number(ing.web_price_per_kg||0),source:String(ing.web_price_source||""),calc:calcIngredientPrice(ing)};
          cur.grams+=Number(ri.grams||0)*factor*g.count;
          sums.set(key,cur);
        }
      }
    }
    return [...sums.values()].sort((a,b)=>a.name.localeCompare(b.name));
  },[kitchenDietGroups,todayProduction,allRecipes]);

  const profitForecast=useMemo(()=>{
    let revenue=0,foodCost=0;
    for(const g of kitchenDietGroups){
      revenue+=(dietPrices[g.kcal]||0)*g.count;
      for(const x of productionRowsForGroup(g)){
        const r=chosenRecipeForGroup(x,g); if(!r)continue;
        const rows=productionRowsForGroup(g); const share=normalizedMealShare(x.meal_type,g,rows); const target=Math.round(g.kcal*share);
        const factor=target/Math.max(1,Number(r.base_kcal||target));
        foodCost+=Number(r.food_cost||0)*factor*g.count;
      }
    }
    return {revenue,foodCost,profit:revenue-foodCost};
  },[kitchenDietGroups,todayProduction,allRecipes,dietPrices]);

  function printShoppingList(){
    if(!shoppingList.length)return setMsg("Brak listy zakupów do wydruku.");
    const rows=shoppingList.map(i=>`<tr><td>${i.name}</td><td><b>${fmtWeight(i.grams)}</b></td></tr>`).join("");
    const w=window.open("","_blank"); if(!w)return;
    w.document.write(`<html><head><title>Lista zakupów</title><style>body{font-family:Arial;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:8px;text-align:left}</style></head><body><h1>Lista zakupów — ${pl(productionDate())}</h1><table><thead><tr><th>Składnik</th><th>Łącznie</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  function plannedDayKcalForGroup(g:any){
    const rows=productionRowsForGroup(g);
    if(!rows.length)return 0;
    // Po normalizacji wszystkie faktycznie wydawane posiłki razem mają dokładnie kcal diety.
    return Number(g.kcal);
  }

  if(loading)return <main className="center"><div className="card">Ładowanie…</div></main>;
  if(!userId)return <main className="center"><form className="card login" onSubmit={login}><div className="logo">🥗</div><h1>Diety</h1><p className="muted">Kuchnia, klienci i kurierzy</p><label>E-mail</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><label>Hasło</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="primary" type="submit" disabled={busy}>{busy?"Logowanie…":"Zaloguj"}</button>{msg&&<p className="error">{msg}</p>}</form></main>;

  return <div className="shell">
    <header><div><b>🥗 Diety</b><span className="muted"> {profile?.full_name||"Użytkownik"} · {profile?.role}{profile?.role==="courier"&&selectedCourierRoute?` · trasa ${selectedCourierRoute}`:((profile?.route_codes?.length?profile.route_codes:(profile?.route_code?[profile.route_code]:[]))).length?` · trasy ${(profile?.route_codes?.length?profile.route_codes:(profile?.route_code?[profile.route_code]:[])).join("+")}`:""}</span></div><button onClick={logout}>Wyloguj</button></header>
    <main data-tab={profile?.role==="admin"?adminTab:profile?.role==="kitchen"?kitchenTab:"all"}>
      {msg&&<div className="toast">{msg}</div>}

      {profile?.role==="kitchen"&&<nav className="panelTabs">
        {([["produkcja","Produkcja"],["plan","Plan tygodnia"]] as const).map(([id,label])=>(
          <button key={id} className={kitchenTab===id?"on":""} onClick={()=>{setKitchenTab(id);setShowWeekPlan(id==="plan")}}>{label}</button>
        ))}
      </nav>}

      {profile?.role==="admin"&&<nav className="panelTabs">
        {([
          ["dzis","Dziś"],
          ["diety","Diety"],
          ["klienci","Klienci"],
          ["kuchnia","Kuchnia i koszty"],
          ["ustawienia","Ustawienia"]
        ] as const).map(([id,label])=>(
          <button key={id} className={adminTab===id?"on":""} onClick={()=>setAdminTab(id)}>{label}</button>
        ))}
      </nav>}

      {profile?.role==="admin"&&<>
        <div className="tabsec tabsec-dzis"><WymagaUwagi
          diets={diets}
          clients={clients}
          storeOrders={storeOrders}
          onPokazZamowienia={()=>{setAdminTab("dzis");window.setTimeout(()=>document.querySelector(".storeOrdersCard")?.scrollIntoView({behavior:"smooth",block:"start"}),80)}}
          onPokazDiety={()=>setAdminTab("diety")}
        /></div>

        <section className="card adminStats tabsec tabsec-dzis"><div className="row"><div><h2>📊 Statystyki</h2><p className="muted">Bieżący podgląd cateringu.</p></div><a href="/menu"><button className="primary">🍽️ Menu i gramatury PDF</button></a></div>
          <div className="statsGrid">
            <div><b>{diets.filter(d=>!d.archived&&lifecycle(d)==="active").length}</b><span>Aktywne diety</span></div>
            <div><b>{clients.length}</b><span>Klienci</span></div>
            <div><b>{diets.filter(d=>!d.archived&&deliversOnDate(d,productionDate())).reduce((n,d)=>n+Math.max(1,Number(d.bags||1)),0)}</b><span>Porcje na {pl(productionDate())}</span></div>
            <div><b>{storeOrders.filter(o=>o.status==="new").length}</b><span>Nowe zamówienia</span></div>
            <div><b>{diets.filter(d=>d.archived).length}</b><span>Archiwum diet</span></div>
            <div><b>{courierProfiles.length}</b><span>Kurierzy</span></div>
          </div>
        </section>

        <section className="card tabsec tabsec-kuchnia"><div className="row"><div><small className="sekcjaEtykieta">KUCHNIA</small><h2>Lista zakupów</h2><p className="muted">Suma składników na całą produkcję na {pl(productionDate())}.</p></div><button onClick={printShoppingList}>🖨️ Drukuj / PDF</button></div>
          <div className="shoppingGrid">{shoppingList.map(i=><div className="shoppingItem" key={i.name}><div><span>{i.name}</span></div><div><b>{fmtWeight(i.grams)}</b></div></div>)}{!shoppingList.length&&<p className="muted">Brak danych — najpierw ułóż menu na ten dzień.</p>}</div>
        </section>

        <section className="card">
          <div className="row">
            <div><h2>💰 Prognoza zysku — realne koszty</h2><p className="muted">Przychód minus surowce, opakowania i transport. Surowce liczone z ceny wybranej przy składniku.</p></div>
            <div className="horizonBtns">
              {[1,7,30].map(n=><button key={n} type="button" className={forecastHorizon===n?"primary":""} onClick={()=>setForecastHorizon(n as 1|7|30)}>{n===1?"Dzień":n===7?"Tydzień":"Miesiąc"}</button>)}
            </div>
          </div>
          <div className="profitGrid detailed">
            <div><span>Przychód</span><b>{detailedForecast.revenue.toFixed(2)} zł</b></div>
            <div><span>Surowce</span><b>{detailedForecast.raw.toFixed(2)} zł</b></div>
            <div><span>Opakowania</span><b>{detailedForecast.packaging.toFixed(2)} zł</b></div>
            <div><span>Transport</span><b>{detailedForecast.transport.toFixed(2)} zł</b></div>
            <div><span>Koszt całkowity</span><b>{detailedForecast.total.toFixed(2)} zł</b></div>
            <div><span>Prognozowany zysk</span><b>{detailedForecast.profit.toFixed(2)} zł</b><small>marża {detailedForecast.margin.toFixed(1)}%</small></div>
          </div>

          <h3>Koszty stałe</h3>
          <div className="costSettings">
            <label>Opakowanie / pudełko [zł]<input type="number" min="0" step="0.01" value={costSettings.packaging_per_meal} onChange={e=>setCostSettings(v=>({...v,packaging_per_meal:Number(e.target.value)}))}/></label>
            <label>Transport / dzień [zł]<input type="number" min="0" step="0.01" value={costSettings.transport_per_day} onChange={e=>setCostSettings(v=>({...v,transport_per_day:Number(e.target.value)}))}/></label>
            <button type="button" onClick={()=>saveCostSettings(costSettings)}>Zapisz koszty</button>
          </div>

          <h3>Ceny sprzedaży za 1 dzień</h3>
          <div className="priceGrid">{[1200,1300,1400,1500,1600,1800,2000,2100,2200,2500,3000].map(k=><label key={k}>{k} kcal
            <div className="priceInput"><input type="text" inputMode="decimal" value={dietPriceDrafts[k]??String((dietPrices[k]??0).toFixed(2)).replace(".",",")} onChange={e=>setDietPriceDrafts(p=>({...p,[k]:e.target.value}))} onBlur={e=>saveDietPrice(k,e.target.value)}/><button type="button" disabled={busy} onClick={()=>saveDietPrice(k)}>Zapisz</button></div>
            <small className="savedPrice">Zapisane: {(dietPrices[k]??0).toFixed(2)} zł</small>
          </label>)}</div>
        </section>

        

        <section className="card kitchenWeekCard tabsec tabsec-kuchnia">
          <div className="row kitchenWeekHead">
            <div><h2>🗓️ PLAN KUCHNI — TYDZIEŃ + GRAMATURY</h2><p className="muted">Poniedziałek–niedziela · dokładnie kto, jaka dieta, kcal i liczba posiłków. Wspólne menu bazowe dla produkcji.</p></div>
            <div className="actions"><button type="button" onClick={()=>setKitchenWeekOffset(v=>v-7)}>← Poprzedni</button><button type="button" onClick={()=>setKitchenWeekOffset(0)}>Ten tydzień</button><button type="button" className="primary" onClick={()=>setKitchenWeekOffset(v=>v+7)}>Następny →</button></div>
          </div>
          <div className="kitchenWeekGrid">
            {kitchenWeekPlan.map((day,idx)=>{
              const names=["Poniedziałek","Wtorek","Środa","Czwartek","Piątek","Sobota","Niedziela"];
              return <article className={`kitchenDay ${day.dayDiets.length?"hasDelivery":"emptyDay"}`} key={day.date}>
                <div className="kitchenDayHead"><b>{names[idx]}</b><span>{pl(day.date)}</span></div>
                {!day.dayDiets.length?<p className="muted">Brak dostaw</p>:<>
                  <div className="kitchenDayTotals"><strong>{day.dayDiets.length} klientów</strong><span>{day.types.map(([type,v])=>`${type} ${v.count}×`).join(" · ")}</span></div>
                  <div className="kitchenCommonMenu"><b>Wspólne dania</b>{day.menu.length?day.menu.map((m:any)=><span key={m.meal}>{prodMealLabel(m.meal)}: <strong>{m.name}</strong></span>):<span className="warnText">⚠️ Brak menu bazowego</span>}<small>Jedno danie bazowe. Kaloryczność zmienia gramaturę; Keto / Low Carb / Vege dostają zamiennik tylko gdy jest potrzebny.</small></div>

                  <details className="weekGramDetails">
                    <summary>⚖️ Gramatury dla wszystkich kaloryczności</summary>
                    <div className="weekGramMeals">
                      {day.gramPlan.map((meal:any)=><div className="weekGramMeal" key={`${day.date}-${meal.meal}`}>
                        <h4>{prodMealLabel(meal.meal)} — {meal.baseName}</h4>
                        {!meal.variants.length&&<p className="muted">Ten posiłek nie jest używany przez aktywne diety tego dnia.</p>}
                        {meal.variants.map((v:any,vi:number)=><div className={`weekGramVariant ${!v.recipe?"missingRecipe":""}`} key={`${v.dietType}-${v.kcal}-${v.mealCount}-${vi}`}>
                          <div className="weekGramVariantHead">
                            <b>{v.dietType} · {v.kcal} kcal · {v.mealCount} posiłki</b>
                            <span>{v.count}× porcja · ten posiłek: <strong>{v.targetKcal} kcal</strong></span>
                          </div>
                          <div className="weekRecipeName">{v.recipeName}{v.flags.length?` · ${v.flags.join(" / ")}`:""}</div>
                          {v.recipe?<div className="weekIngredientTable">
                            {v.ingredients.map((ing:any)=><div key={ing.name}><span>{ing.name}</span><b>{ing.grams} g / 1 porcję</b><em>łącznie {ing.grams*v.count} g</em></div>)}
                            {!v.ingredients.length&&<div><span>⚠️ Brak składników/gramatur w recepturze</span></div>}
                          </div>:<p className="warnText">⚠️ Brak bezpiecznego zamiennika dla tej diety / wykluczeń.</p>}
                        </div>)}
                      </div>)}
                    </div>
                  </details>

                  <details><summary>👥 Dokładna rozpiska klientów</summary><div className="kitchenClientList">{day.dayDiets.map(d=><div key={d.id}><b>{d.client_name}</b><span>{prodDietType(d.diet_name)} · {d.kcal} kcal · {effectiveMealCount(d)} posiłki · {Math.max(1,Number(d.bags||1))} porcja</span>{restrictionFlags(d).length>0&&<small>{restrictionFlags(d).join(" / ")}</small>}</div>)}</div></details>
                </>}
              </article>
            })}
          </div>
        </section>

        <section className="card kitchenProductionScreen tabsec tabsec-kuchnia">
          <div className="row">
            <div><h2>👨‍🍳 PLAN PRODUKCJI — WYBRANY DZIEŃ</h2><p className="muted">Klienci, pudełka, wspólne dania, zamienniki i łączne składniki w jednym miejscu.</p></div>
            <div className="actions">
              <select value={selectedKitchenProduction.date} onChange={e=>setSelectedKitchenDay(e.target.value)}>
                {kitchenWeekPlan.map((day:any)=><option key={day.date} value={day.date}>{pl(day.date)} · {day.dayDiets.length} klientów</option>)}
              </select>
              <button type="button" className="primary" onClick={printKitchenProductionPlan}>🖨️ Drukuj plan kuchni</button>
            </div>
          </div>
          {selectedKitchenProduction.day&&<>
            <div className="productionBigStats">
              <div><strong>{selectedKitchenProduction.day.dayDiets.length}</strong><span>klientów</span></div>
              <div><strong>{selectedKitchenProduction.boxes}</strong><span>pudełek</span></div>
              <div><strong>{selectedKitchenProduction.ingredients.length}</strong><span>składników</span></div>
            </div>
            <div className="productionScreenGrid">
              <div className="productionClients"><h3>👥 Kto jedzie</h3>{selectedKitchenProduction.day.dayDiets.map((d:any)=><div className="productionClientRow" key={d.id}><b>{d.client_name}</b><span>{prodDietType(d.diet_name)} · {d.kcal} kcal · {effectiveMealCount(d)} posiłki · {Math.max(1,Number(d.bags||1))} porcja</span>{restrictionFlags(d).length>0&&<em>{restrictionFlags(d).join(" / ")}</em>}</div>)}</div>
              <div className="productionIngredients"><h3>🧺 Łącznie przygotuj</h3>{selectedKitchenProduction.ingredients.map((i:any)=><div key={i.name}><span>{i.name}</span><b>{fmtWeight(i.grams)}</b></div>)}{!selectedKitchenProduction.ingredients.length&&<p className="warnText">⚠️ Brak gramatur — sprawdź receptury.</p>}</div>
            </div>
            <div className="productionMeals"><h3>🍽️ Produkcja według posiłków</h3>{(selectedKitchenProduction.day.gramPlan||[]).map((meal:any)=><div className="productionMealCard" key={meal.meal}><div className="productionMealHead"><b>{prodMealLabel(meal.meal)}</b><span>{meal.baseName}</span></div>{(meal.variants||[]).map((v:any,idx:number)=><div className={`productionVariant ${!v.recipe?"missingRecipe":""}`} key={`${v.dietType}-${v.kcal}-${idx}`}><div><b>{v.dietType} · {v.kcal} kcal · {v.mealCount} posiłki</b><span>{v.count}× · {v.recipeName} · {v.targetKcal} kcal</span></div>{v.ingredients?.length?<div className="productionVariantIngredients">{v.ingredients.map((ing:any)=><span key={ing.name}>{ing.name}: <b>{ing.grams} g</b> / porcję · razem <b>{ing.grams*v.count} g</b></span>)}</div>:<span className="warnText">⚠️ BRAK GRAMATURY / ZAMIENNIKA</span>}</div>)}</div>)}</div>
          </>}
        </section>

        <section className="card tomorrowAdminDashboard tabsec tabsec-dzis">
          <div className="row"><div><h2>📊 NAJBLIŻSZA PRODUKCJA — CENTRUM DOWODZENIA</h2><p className="muted">{pl(nextDeliveryDate)} · najbliższy dzień z aktywnymi dietami</p></div><a href="/menu"><button className="primary">Otwórz kuchnię</button></a></div>
          <div className="tomorrowStats">
            <div><strong>{tomorrowDashboard.clientsCount}</strong><span>klientów</span></div>
            <div><strong>{tomorrowDashboard.boxes}</strong><span>pudełek</span></div>
            <div><strong>{tomorrowDashboard.warnings.length}</strong><span>ostrzeżeń</span></div>
          </div>
          <div className="tomorrowBreakdowns">
            <div><b>Diety</b><p>{tomorrowDashboard.types.map(([k,v])=>`${k}: ${v}`).join(" · ")||"brak"}</p></div>
            <div><b>Kaloryczności</b><p>{tomorrowDashboard.kcals.map(([k,v])=>`${k}: ${v}`).join(" · ")||"brak"}</p></div>
            <div><b>Liczba posiłków</b><p>{tomorrowDashboard.meals.map(([k,v])=>`${k} posiłki: ${v}`).join(" · ")||"brak"}</p></div>
          </div>
          <div className={`tomorrowWarnings ${tomorrowDashboard.warnings.length?"hasWarnings":"allGood"}`}>
            <b>{tomorrowDashboard.warnings.length?"⚠️ Rzeczy wymagające uwagi":`✅ ${pl(nextDeliveryDate)} wygląda poprawnie`}</b>
            {tomorrowDashboard.warnings.slice(0,20).map((w,i)=><span key={i}>{w}</span>)}
            {tomorrowDashboard.warnings.length>20&&<span>+ {tomorrowDashboard.warnings.length-20} kolejnych ostrzeżeń</span>}
          </div>
        </section>

        <section className="card storeOrdersCard tabsec tabsec-dzis"><div className="row"><div><small className="sekcjaEtykieta">ZE STRONY</small><h2>Nowe zamówienia</h2><p className="muted">Tutaj wpada każda dieta zamówiona przez formularz na stronie WWW. Nowe zamówienie ma status NOWE — zaakceptuj je, aby obsłużyć klienta.</p></div><div className="actions"><a href="/sklep" target="_blank"><button>Otwórz sklep</button></a><a href="/menu"><button>🍽️ Menu kuchni</button></a></div></div><div className="orderList">{(()=>{
          const widoczne=storeOrders.filter(o=>o.status!=="rejected");
          const nowe=widoczne.filter(o=>o.status==="new");
          if(!widoczne.length)return <p className="muted">Brak zamówień ze strony. Nowe pojawią się tutaj automatycznie.</p>;
          return <>
            {nowe.length>0&&<div className="newOrdersBadge">{nowe.length} {nowe.length===1?"nowe zamówienie":"nowych zamówień"} czeka na decyzję</div>}
            {widoczne.map(o=><div className={`orderCard ${o.status==="new"?"isNew":""}`} key={o.id}><div><b>{o.customer_name}</b> · {o.diet_name} {o.kcal} kcal · {o.days} dni · <b>{o.status==="new"?"NOWE":o.status==="accepted"?"PRZYJĘTE":"ODRZUCONE"}</b></div><div className="muted">{o.phone} · {o.street_address}, {o.postal_code} {o.city} · start {o.start_date}</div>{o.payment_status&&o.payment_status!=="offline"&&<div className={"platnoscPlakietka "+o.payment_status}>{o.payment_status==="paid"?`Zapłacono ${(Number(o.payment_amount||0)/100).toFixed(2)} zł`:o.payment_status==="failed"?"Płatność nieudana":`Czeka na płatność · ${(Number(o.payment_amount||0)/100).toFixed(2)} zł`}</div>}{o.referrer&&<div className="polecenieInfo">Polecenie od: <b>{o.referrer}</b>{Number(o.days)>=MIN_DNI_POLECONEGO?" — dopisz dzień gratis obojgu":` — bonus od ${MIN_DNI_POLECONEGO} dni, to zamówienie ma ${o.days}`}</div>}{Number(o.loyalty_percent)>0&&<div className="lojalnoscInfoPanel">★ Stały klient · {o.loyalty_days} dni · rabat {o.loyalty_percent}%</div>}{Number(o.shake_qty)>0&&<div className="shakeInfo">🥤 Shake × {o.shake_qty} · {nazwaSmaku(String(o.shake_flavour||"mix"))}</div>}{o.status==="new"&&<div className="actions"><button className="primary" onClick={()=>acceptStoreOrder(o)}>✓ Przyjmij i utwórz dietę</button><button onClick={()=>{if(confirm(`Odrzucić zamówienie: ${o.customer_name}?\n\nZniknie z listy.`))setStoreOrderStatus(o.id,"rejected")}}>Odrzuć</button></div>}</div>)}
          </>;
        })()}</div></section>

        <section className="card tabsec tabsec-ustawienia"><small className="sekcjaEtykieta">ZESPÓŁ</small><h2>Kurierzy i trasy</h2><p className="muted">Każdy kurier może mieć jedną lub kilka tras. Zmiana zapisuje się od razu.</p>
          <div className="courierGrid">{courierProfiles.map(c=>{
            const routes=c.route_codes?.length?c.route_codes:(c.route_code?[c.route_code]:[]);
            const has=(r:string)=>routes.includes(r);
            return <div className="courierCard" key={c.id}><div><b>{c.full_name||"Kurier"}</b><div className="muted">Przypisane: {routes.join(", ")||"brak"}</div></div>
              <div className="actions">
                <button className={has("A")?"primary":""} onClick={()=>saveCourierRoutes(c,has("A")?routes.filter(x=>x!=="A"):[...routes,"A"])}>Trasa A {has("A")?"✓":""}</button>
                <button className={has("B")?"primary":""} onClick={()=>saveCourierRoutes(c,has("B")?routes.filter(x=>x!=="B"):[...routes,"B"])}>Trasa B {has("B")?"✓":""}</button>
              </div>
            </div>
          })}{!courierProfiles.length&&<p className="muted">Brak kont kurierów.</p>}</div>
        </section>

        <section className="card tabsec tabsec-klienci"><small className="sekcjaEtykieta">BAZA</small><h2>Dodaj klienta</h2><form className="formgrid" onSubmit={addClient}><input name="name" placeholder="Klient" required/><input name="phone" placeholder="Telefon"/><input name="street_address" placeholder="Ulica i numer"/><input name="postal_code" placeholder="Kod pocztowy"/><input name="city" placeholder="Miasto"/><input name="kitchen_notes" placeholder="Uwagi dla kuchni"/><input name="courier_notes" placeholder="Uwagi dla kuriera"/><button className="primary" disabled={busy}>{busy?"Zapisywanie…":"Dodaj klienta"}</button></form></section>

        <section className="card tabsec tabsec-klienci">
          <div className="row">
            <div><small className="sekcjaEtykieta">BAZA</small><h2>Kartoteka klientów</h2><p className="muted">Kliknij nazwisko, żeby rozwinąć dane.</p></div>
            <input
              type="search"
              className="cardSearch"
              placeholder="Szukaj — nazwisko, telefon, miasto"
              value={cardSearch}
              onChange={e=>setCardSearch(e.target.value)}
            />
          </div>
          <div className="clientAccordion">
            {(()=>{
              const q=cardSearch.trim().toLowerCase();
              const list=q?clients.filter(c=>`${c.name} ${c.phone||""} ${c.city||""} ${c.street_address||""}`.toLowerCase().includes(q)):clients;
              if(!list.length)return <p className="muted">Brak klientów pasujących do wyszukiwania.</p>;
              return list.map(c=>(
                <details className="clientFold" key={c.id} open={!!q&&list.length<=3}>
                  <summary>
                    <b>{c.name}</b>
                    <span>{[c.city,c.phone].filter(Boolean).join(" · ")||"brak danych kontaktowych"}</span>
                  </summary>
                  <div className="clientFoldBody">
                    <ClientEditor client={c} onChange={next=>setClients(list2=>list2.map(x=>x.id===next.id?next:x))} onSave={saveClient} onDelete={deleteClient}/>
                  </div>
                </details>
              ));
            })()}
          </div>
        </section>
        <section className="card tabsec tabsec-klienci">
          <div className="row">
            <div><small className="sekcjaEtykieta">ARCHIWUM</small><h2>Historia diet</h2><p className="muted">Zakończone diety trafiają tu automatycznie. Możesz odtworzyć poprzednie ustawienia jednym kliknięciem.</p></div>
            <button type="button" onClick={()=>autoArchiveExpired(true)}>↻ Sprawdź archiwum teraz</button>
          </div>
          <div className="historyClients">
            {clients.map(c=>{
              const hist=clientDietHistory.get(c.id)||[];
              if(!hist.length)return null;
              return <details className="historyClient clientFold" key={c.id}>
                <summary><b>{c.name}</b><span>{hist.length} {hist.length===1?"poprzednia dieta":"poprzednich diet"}</span></summary>
                {hist.slice(0,5).map(d=><div className="historyDiet" key={d.id}>
                  <div>
                    <b>{d.diet_name} · {d.kcal} kcal</b>
                    <span>{pl(d.start_date)} – {pl(d.end_date)} · {d.bags} {d.bags===1?"porcja":"porcji"} · {d.meal_count??4} posiłki · trasa {d.route_code}</span>
                    {d.notes&&<small>{d.notes}</small>}
                  </div>
                  <button type="button" className="primary" onClick={()=>renewDiet(d)}>↩️ Odnów tę dietę</button>
                </div>)}
              </details>
            })}
            {![...clientDietHistory.values()].some(x=>x.length)&&<p className="muted">Historia jest jeszcze pusta.</p>}
          </div>
        </section>

        <section className="card tabsec tabsec-diety" id="add-diet-card">
          <div className="row">
            <div>
              <h2>{renewingDiet?"↩️ Odnów poprzednią dietę":"Dodaj dietę"}</h2>
              {renewingDiet&&<p className="muted">Wczytano ustawienia z diety zakończonej {pl(renewingDiet.end_date)}. Ustaw tylko nowe daty.</p>}
            </div>
            {renewingDiet&&<button type="button" onClick={()=>setRenewingDiet(null)}>✕ Anuluj odnawianie</button>}
          </div>
          <form key={renewingDiet?.id??"new-diet"} className="formgrid" onSubmit={addDiet}>
            <input
              type="search"
              className="clientSearch"
              placeholder="Szukaj klienta — nazwa, telefon lub miasto"
              value={clientSearch}
              onChange={e=>setClientSearch(e.target.value)}
            />
            <select name="client_id" required defaultValue={renewingDiet?.client_id??""}>
              <option value="" disabled>{filteredClients.length?`Wybierz klienta (${filteredClients.length})`:"Brak pasujących klientów"}</option>{filteredClients.map(c=><option key={c.id} value={c.id}>{c.name}{c.city?` — ${c.city}`:""}</option>)}
            </select>
            <select name="diet_name" required defaultValue={renewingDiet?.diet_name||"Standard"}>
              {renewingDiet?.diet_name&&!ADMIN_DIET_TYPES.includes(renewingDiet.diet_name as any)&&<option value={renewingDiet.diet_name}>{renewingDiet.diet_name}</option>}
              {ADMIN_DIET_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <input name="kcal" type="number" defaultValue={renewingDiet?.kcal??1800} min="1" required/>
            <input name="bags" type="number" defaultValue={renewingDiet?.bags??1} min="1" required/><label>Liczba posiłków
              <select name="meal_count" defaultValue={renewingDiet?.meal_count??4} required>
                <option value="3">3 posiłki</option>
                <option value="4">4 posiłki</option>
                <option value="5">5 posiłków</option>
              </select>
            </label>
            <select name="route_code" required defaultValue={renewingDiet?.route_code||""}><option value="" disabled>Wybierz trasę</option>{ROUTE_CODES.map(r=><option key={r} value={r}>Trasa {r}</option>)}</select>
            <input name="start_date" type="date" min={today()} required/>
            <input name="end_date" type="date" min={today()} required/>
            <input name="notes" placeholder="Uwagi do diety" defaultValue={renewingDiet?.notes||""}/>
            <div className="restrictionBox"><b>Wykluczenia / alergeny</b><small className="muted">Dotyczą tylko tej diety.</small>
              <div className="exclGrid">
                {ALLERGENS.map(a=>(
                  <label className="check" key={a.id}>
                    <input type="checkbox" name={`excl_${a.id}`} defaultChecked={renewingDiet?hasRestriction(renewingDiet,a.flag):false}/>
                    {nazwaWykluczenia(a)}
                  </label>
                ))}
              </div>
            </div>
            <label className="check"><input type="checkbox" name="saturday_delivery" defaultChecked={renewingDiet?(renewingDiet.delivery_weekdays??[]).includes(6):true}/> Dostawa w sobotę</label>
            <label className="check"><input type="checkbox" name="sunday_delivery" defaultChecked={renewingDiet?(renewingDiet.delivery_weekdays??[]).includes(7):true}/> Dostawa w niedzielę</label>
            <button className="primary" disabled={busy}>{busy?"Zapisywanie…":renewingDiet?"Odnów dietę":"Dodaj dietę"}</button>
          </form>
        </section>
      </>}

      {profile?.role==="kitchen"&&<section className="card kitchenProd tabsec tabsec-produkcja"><div className="printOnly"><h1>Produkcja kuchni</h1><p>Data dostawy: {pl(productionDate())}</p></div>
        <div className="row noPrint"><div><h2>👨‍🍳 Produkcja na najbliższą dostawę</h2><p className="muted">Produkujemy na najbliższy dzień, w którym ktokolwiek ma dostawę — również w niedzielę. Datę możesz zmienić poniżej. Statusy poniżej dotyczą dokładnie tej daty produkcji.</p></div><div className="actions"><button className="primary" disabled={busy} onClick={issueProductionToCourier}>🚚 Wydaj wszystkie do kuriera</button><button onClick={printProduction}>🖨️ PDF / Drukuj</button><a href="/menu"><button className="primary">🧠 Ułóż diety</button></a><a href="/menu"><button>Menu i układanie diet →</button></a></div></div>
        <div className="prodDateBadge">Dostawa / produkcja: <b>{pl(productionDate())}</b> · <b>{productionDietsActual.length} diet klientów</b></div>
        <div className="nextDayKitchen">
          <div className="nextDayKitchenHead">
            <div>
              <h3>📅 Diety na najbliższą produkcję</h3>
              <p className="muted">{pl(nextDeliveryDate)} · {nextDeliveryDiets.length} diet klientów</p>
            </div>
          </div>
          {!nextDeliveryDiets.length&&<p className="muted">Brak diet zaplanowanych na najbliższą produkcję.</p>}
          {!!nextDeliveryDiets.length&&<div className="nextDayDietList">
            {nextDeliveryDiets.map(d=><div className="nextDayDietRow" key={`tomorrow-${d.id}`}>
              <b>{d.client_name}</b>
              <span>{prodDietType(d.diet_name)} · {d.kcal} kcal · {effectiveMealCount(d)} posiłki · {Math.max(1,Number(d.bags||1))} porcja</span>
              <span>{restrictionFlags(d).length?restrictionFlags(d).join(" / "):"bez wykluczeń"}</span>
              {rawRestrictionText(d)&&<em className="rawRestriction">Zgłoszenie klienta: {rawRestrictionText(d)}</em>}
              <em>trasa {d.route_code}</em>
            </div>)}
          </div>}
        </div>
        <div className="outboundTruth">
          <div className="outboundTruthHead"><h3>✅ To realnie ma wyjechać</h3>{productionDuplicateCount>0&&<small>Ukryto {productionDuplicateCount} starych/nakładających się wpisów</small>}</div>
          {productionDietsActual.map(d=><div className="outboundTruthRow" key={d.id}>
            <b>{d.client_name}</b>
            <span>{prodDietType(d.diet_name)} · {d.kcal} kcal · <b>{effectiveMealCount(d)} posiłki</b> · {Math.max(1,Number(d.bags||1))} porcja · trasa {d.route_code}</span>
            <em>{statusText[d.kitchen_status]}</em>
          </div>)}
        </div>
        <div className="outboundSummary">
          <b>Podsumowanie wyjazdu wg diet klientów</b>
          {outboundDietSummary.map(x=><span key={`${x.dietType}-${x.kcal}-${x.mealCount}`}>{x.dietType} {x.kcal} kcal · {x.mealCount} posiłki × {x.count}</span>)}
        </div>
        {!kitchenDietGroups.length&&<p className="muted">Brak aktywnych diet na najbliższy dzień dostawy.</p>}
        {kitchenDietGroups.map(g=><div className="prodDietBlock" key={`${g.dietType}-${g.kcal}-${g.mealCount}`}>
          <div className="prodDietHead"><div><h3>{g.dietType} — {g.kcal} kcal {g.flags.length?`— ${g.flags.join(" / ")}`:""}</h3><p className="muted">{g.count} {g.count===1?"porcja":"porcji"} · {g.mealCount} posiłki · plan dnia: <b>{plannedDayKcalForGroup(g)} kcal</b></p><p className="kitchenClients">Wyjeżdża dla: <b>{g.clients.join(", ")}</b></p><p className="muted">Typ z diety klienta: <b>{g.dietType}</b></p></div></div>
          <div className="prodMeals">
            {productionRowsForGroup(g).map((x:any)=>{
              let r=commonRecipeForGroup(x,g);
              if(!r)return <div className="prodMeal blockedMeal" key={`${g.dietType}-${g.kcal}-${x.id}`}><b>⚠️ Brak zgodnego zamiennika</b><span>{x.recipes?.name||x.meal_type}</span></div>;
              const rows=productionRowsForGroup(g); const share=normalizedMealShare(x.meal_type,g,rows); const target=Math.round(g.kcal*share);
              const factor=target/Math.max(1,Number(r.base_kcal||target));
              return <div className="prodMeal" key={`${g.dietType}-${g.kcal}-${x.id}`}>
                <div className="prodMealTop"><div><b>{prodMealLabel(x.meal_type)}</b><h4>{r.name}</h4>{g.flags.length>0&&<div className="restrictionBadge">✓ {g.flags.join(" / ")}</div>}{x.meal_type==="shake"&&<div className="bottleCount">🥤 {g.count} butelek</div>}</div><div className="macro"><span>{target} kcal</span><span>B {(Number(r.protein)*factor).toFixed(0)}g</span><span>T {(Number(r.fat)*factor).toFixed(0)}g</span><span>W {(Number(r.carbs)*factor).toFixed(0)}g</span></div></div>
                <div className="kitchenIngredients">
                  <div className="kitchenIngHead"><b>Gramatury tej diety — {g.kcal} kcal</b><span>na 1 porcję</span></div>
                  <table className="prodTable">
                    <thead><tr><th>Składnik</th><th>Gramatura</th></tr></thead>
                    <tbody>
                      {kitchenIngredientRows(r,factor,1).map((ri:any)=><tr key={ri.id}>
                        <td>{ri.name}</td>
                        <td><b>{fmtWeight(ri.one)}</b></td>
                      </tr>)}
                    </tbody>
                  </table>
                  {!kitchenIngredientRows(r,factor,g.count).length&&<p className="muted">Brak wpisanych składników w tej recepturze.</p>}
                </div>
                <table className="prodTable"><thead><tr><th>Składnik</th><th>1 porcja</th><th>Łącznie × {g.count}</th></tr></thead>
                <tbody>{ingredientsForRecipe(r).map((ri:any)=>{
                  const one=Number(ri.grams)*factor;
                  const total=one*g.count;
                  return <tr key={`${x.id}-${ri.ingredients?.id}`}><td>{ri.ingredients?.name||"Składnik"}</td><td>{fmtWeight(one)}</td><td><b>{fmtWeight(total)}</b></td></tr>
                })}</tbody></table>
              </div>
            })}
            {!productionRowsForGroup(g).length&&<p className="muted">Brak receptur/menu dla tej konkretnej konfiguracji na {pl(productionDate())}.</p>}
          </div>
        </div>)}
      </section>}

      {showWeekPlan&&profile?.role!=="courier"&&<section className="card weekPlanCard tabsec tabsec-diety tabsec-plan">
        <div className="row">
          <div>
            <small className="sekcjaEtykieta">PRZEGLĄD</small><h2>Plan tygodnia</h2>
            <p className="muted">Kto, kiedy i jaką dietę ma dostać. Kaloryczność w nawiasie.</p>
          </div>
          <div className="weekNav">
            <button onClick={()=>setWeekOffset(v=>v-1)}>← Poprzedni</button>
            <button onClick={()=>setWeekOffset(0)} disabled={weekOffset===0}>Ten tydzień</button>
            <button onClick={()=>setWeekOffset(v=>v+1)}>Następny →</button>
          </div>
        </div>

        {!weekPlan.length
          ? <p className="muted">Brak diet w tym tygodniu.</p>
          : <div className="weekScroll"><table className="weekTable">
              <thead><tr>
                <th className="stickyCol">Klient</th>
                {["Pon","Wt","Śr","Czw","Pt","Sob","Nd"].map((lbl,i)=>(
                  <th key={lbl} className={weekDates[i]===today()?"isToday":""}>
                    <b>{lbl}</b><span>{weekDates[i].slice(8)}.{weekDates[i].slice(5,7)}</span>
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {weekPlan.map(row=>(
                  <tr key={row.name+row.route}>
                    <td className="stickyCol"><b>{row.name}</b><span className="routeTag">{row.route}</span></td>
                    {row.cells.map((d,i)=>(
                      <td key={i} className={`${weekDates[i]===today()?"isToday":""} ${d?"has":"none"}`}>
                        {d?<><b>{d.diet_name}</b><span>{d.kcal} kcal</span>{restrictionFlags(d).length>0&&<em>{restrictionFlags(d).join(" / ")}</em>}</>:<span className="dash">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table></div>}
      </section>}

      <section className={`card ${profile?.role==="admin"?"tabsec tabsec-diety":profile?.role==="kitchen"?"tabsec tabsec-produkcja":""}`}><div className="row"><div><h2>{profile?.role==="admin"&&showArchive?"📦 Archiwum diet":profile?.role==="courier"?(selectedCourierRoute?`Trasa ${selectedCourierRoute} na dziś`:"Wybierz trasę"):"Produkcja i wydania"}</h2><p className="muted">{profile?.role==="courier"?`Start: ${BASE_ADDRESS}. Trasa obejmuje wszystkie wydane diety na dziś z wybranej trasy.`:profile?.role==="kitchen"?`Poniżej są diety na ${pl(productionDate())}. Każdą możesz wydać osobno albo wszystkie naraz.`:"Kurier widzi dopiero pozycje oznaczone jako wydane."}</p></div>{profile?.role==="admin"&&<button onClick={()=>setShowArchive(v=>!v)}>{showArchive?"← Aktywne diety":"📦 Archiwum diet"}</button>}{profile?.role==="admin"&&!showArchive&&<button disabled={busy} onClick={archiveExpiredNow}>🧹 Archiwizuj zakończone</button>}{profile?.role==="admin"&&<button disabled={busy} onClick={wyslijPrzypomnienia}>✉️ Przypomnij o końcu diety</button>}
        {profile?.role!=="courier"&&<button className={showWeekPlan?"primary":""} onClick={()=>setShowWeekPlan(v=>!v)}>📅 {showWeekPlan?"Ukryj plan tygodnia":"Plan tygodnia"}</button>}
        {profile?.role==="kitchen"&&<label className="dayPicker">Dzień produkcji
          <input type="date" value={productionDate()} onChange={e=>setProductionTarget(e.target.value)}/>
          {productionTarget&&<button type="button" onClick={()=>setProductionTarget("")}>Wróć do najbliższego</button>}
        </label>}{profile?.role!=="courier"&&!showArchive&&<button onClick={()=>setShowAll(v=>!v)}>{showAll?"Tylko aktywne":"Pokaż przyszłe/wygasłe"}</button>}</div>{profile?.role==="courier"&&<div className="routePicker"><button className={selectedCourierRoute==="A"?"primary":""} onClick={()=>chooseCourierRoute("A")}>Trasa A</button><button className={selectedCourierRoute==="B"?"primary":""} onClick={()=>chooseCourierRoute("B")}>Trasa B</button><button className={selectedCourierRoute==="A+B"?"primary":""} onClick={()=>chooseCourierRoute("A+B")}>Trasa A+B</button></div>}
        {profile?.role==="courier"&&offlineCopy&&<div className="offlineBanner">Brak połączenia — pokazujesz kopię trasy z tego dnia. Potwierdzenia dostaw wyślą się dopiero po odzyskaniu zasięgu.</div>}
        {profile?.role==="courier"&&routeOptimized&&<div className="routeOptimizedBanner">Kolejność punktów ułożona pod najkrótszy przejazd.</div>}
        {profile?.role==="courier"&&<div className="routeStart">
          {routeStopCount>0?<div className="routeLaunch">
            <div className="routeLaunchTop"><b>📍 {routeStopCount} punktów · {courierRoute.length+courierMissingAddress.length} diet · {courierMissingAddress.length} bez adresu</b><button onClick={refresh}>↻ Odśwież trasę</button></div>

            <div className="routeSegments">
              {courierRouteSegments.map((seg,idx)=><a key={idx} className="button primary" href={seg.url} target="_blank" rel="noreferrer">
                🚗 {courierRouteSegments.length===1?`Start całej trasy (${seg.stops.length} pkt)`:`Etap ${idx+1}/${courierRouteSegments.length} (${seg.stops.length} pkt)`}
              </a>)}
            </div>
            <div className="routeStopsPreview">
              {(()=>{
                const grouped=new Map<string,{address:string;clients:string[];diets:string[]}>();
                for(const d of courierRoute){
                  const address=fullAddress(d.clients)||"BRAK ADRESU";
                  const key=address.toLowerCase();
                  const cur=grouped.get(key)||{address,clients:[],diets:[]};
                  if(d.client_name&&!cur.clients.includes(d.client_name))cur.clients.push(d.client_name);
                  const dietLabel=`${d.diet_name||"Dieta"} · ${d.kcal} kcal`;
                  if(!cur.diets.includes(dietLabel))cur.diets.push(dietLabel);
                  grouped.set(key,cur);
                }
                return [...grouped.values()].map((g,idx)=><div className="routeStopCard" key={`${g.address}-${idx}`}>
                  <div className="routeStopLine"><b>{idx+1}.</b><span>{g.clients.join(" / ")} — {g.address}</span></div>
                  <div className="routeDietLine">🥗 {g.diets.join(" · ")}</div>
                </div>)
              })()}
              {courierMissingAddress.map((d,idx)=><div className="routeStopCard missingAddress" key={`missing-${d.id}`}>
                <div className="routeStopLine"><b>⚠️</b><span>{d.client_name} — BRAK ADRESU</span></div>
                <div className="routeDietLine">🥗 {d.diet_name||"Dieta"} · {d.kcal} kcal</div>
              </div>)}
            </div>
          </div>:<><span className="muted">Brak poprawnych adresów do uruchomienia trasy. {courierMissingAddress.length>0&&` Brak adresu przy ${courierMissingAddress.length} dietach.`}</span><button onClick={refresh}>↻ Odśwież trasę</button></>}
        </div>}
        <div className="list">{visible.map((d,i)=><article className="diet" key={d.id}><div className="row"><div><div className="routeNo">{profile?.role==="courier"?`${i+1}. `:""}<h3>{d.client_name}</h3></div><div className="muted">{d.diet_name} · {d.kcal} kcal · {d.bags} pacz.</div></div><div className="badges"><span className={"badge "+lifecycle(d)}>{lifecycle(d)==="active"?"Aktywna":lifecycle(d)==="future"?"Przyszła":"Wygasła"}</span><span className={"badge "+d.kitchen_status}>{statusText[d.kitchen_status]}</span></div></div>
          {d.clients&&<div className="addressBox"><b>📍 {fullAddress(d.clients)||"Brak adresu"}</b>{d.clients.phone&&<span>📞 {d.clients.phone}</span>}{d.clients.courier_notes&&<span>📝 {d.clients.courier_notes}</span>}</div>}
          <div className="meta"><span><small>Obowiązuje</small><b>{pl(d.start_date)} – {pl(d.end_date)}</b></span><span><small>Trasa</small><b>{d.route_code}</b></span></div>
          {profile?.role==="courier"&&<div className="actions">{fullAddress(d.clients)&&<a className="button primary" href={mapsUrl(d.clients)} target="_blank" rel="noreferrer">🗺 Nawiguj</a>}{d.clients?.phone&&<a className="button" href={`tel:${d.clients.phone}`}>📞 Zadzwoń</a>}{deliveredIds.includes(d.id)?<span className="deliveredTag">✓ Dostarczono</span>:<button type="button" className="deliverBtn" disabled={deliveringId===d.id} onClick={()=>markDelivered(d.id,d.client_name)}>{deliveringId===d.id?"Wysyłam…":"Dostarczono"}</button>}</div>}
          {profile?.role==="admin"&&<div className="actions">
            {!d.archived&&<>
              <div className="mealCountQuick" role="group" aria-label={`Liczba posiłków — ${d.client_name}`}>
                <span>Posiłki:</span>
                {[3,4,5].map(n=><button
                  key={n}
                  type="button"
                  disabled={busy}
                  className={effectiveMealCount(d)===n?"primary":""}
                  onClick={()=>setDietMealCount(d,n as 3|4|5)}
                >{n}</button>)}
              </div>
              <button onClick={()=>setEditingDiet(d)}>✏️ Edytuj dietę</button>
              {!d.archived&&d.end_date<today()&&<button type="button" disabled={busy} onClick={()=>archiveExpiredFromRows([d],true).then(setDiets)}>📦 Archiwizuj</button>}
              <button type="button" className="danger" disabled={busy} onClick={()=>usunDiete(d)}>🗑️ Usuń</button>
            </>}
            {d.archived&&<button className="primary" onClick={()=>renewDiet(d)}>↩️ Odnów jako nową</button>}
            <button onClick={()=>{if(d.archived||confirm(`Zarchiwizować dietę: ${d.client_name}?\n\nZniknie z listy kuchni i z trasy kuriera.`))setDietArchived(d,!d.archived)}}>{d.archived?"↩️ Przywróć stary rekord":"📦 Archiwizuj"}</button>
          </div>}
          {!d.archived&&(profile?.role==="admin"||profile?.role==="kitchen")&&(
            profile?.role==="kitchen"?deliversOnDate(d,productionDate()):lifecycle(d)==="active"
          )&&<div className="actions">
            <button onClick={()=>setStatus(d.id,"todo")}>Do zrobienia</button>
            <button onClick={()=>setStatus(d.id,"prep")}>Przygotowanie</button>
            <button onClick={()=>setStatus(d.id,"ready")}>Gotowe</button>
            <button className="primary" onClick={()=>setStatus(d.id,"issued")}>Wydaj kurierowi</button>
          </div>}
        </article>)}{!visible.length&&<p className="muted">Brak pozycji w tym widoku.</p>}</div>
      </section>
      {editingDiet&&profile?.role==="admin"&&<div className="modalBack"><div className="modal card">
        <div className="row"><h2>Edytuj dietę — {editingDiet.client_name}</h2><button onClick={()=>setEditingDiet(null)}>✕</button></div>
        <form className="grid" onSubmit={saveDietEdit}>
          <label>Klient<select name="client_id" defaultValue={editingDiet.client_id??""} required>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Dieta
            <select name="diet_name" defaultValue={editingDiet.diet_name} required>
              {!ADMIN_DIET_TYPES.includes(editingDiet.diet_name as any)&&<option value={editingDiet.diet_name}>{editingDiet.diet_name}</option>}
              {ADMIN_DIET_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>kcal<input name="kcal" type="number" defaultValue={editingDiet.kcal} required/></label>
          <label>Torby<input name="bags" type="number" min="1" defaultValue={editingDiet.bags} required/></label><label>Liczba posiłków
            <select name="meal_count" defaultValue={editingDiet.meal_count??4} required>
              <option value="3">3 posiłki</option>
              <option value="4">4 posiłki</option>
              <option value="5">5 posiłków</option>
            </select>
          </label>
          <label>Trasa<select name="route_code" defaultValue={editingDiet.route_code} required>{ROUTE_CODES.map(r=><option key={r} value={r}>Trasa {r}</option>)}</select></label>
          <label>Od<input name="start_date" type="date" defaultValue={editingDiet.start_date} required/></label>
          <label>Do<input name="end_date" type="date" defaultValue={editingDiet.end_date} required/></label>
          <label>Uwagi<input name="notes" defaultValue={editingDiet.notes||""}/></label>
          <div className="restrictionBox"><b>Wykluczenia / alergeny</b>
            <div className="exclGrid">
              {ALLERGENS.map(a=>(
                <label className="check" key={a.id}>
                  <input type="checkbox" name={`excl_${a.id}`} defaultChecked={hasRestriction(editingDiet,a.flag)}/>
                  {nazwaWykluczenia(a)}
                </label>
              ))}
            </div>
          </div>
          <label className="check"><input type="checkbox" name="saturday_delivery" defaultChecked={(editingDiet.delivery_weekdays??[1,2,3,4,5,6,7]).includes(6)}/> Dostawa w sobotę</label>
          <label className="check"><input type="checkbox" name="sunday_delivery" defaultChecked={(editingDiet.delivery_weekdays??[1,2,3,4,5,6,7]).includes(7)}/> Dostawa w niedzielę</label>
          <div className="actions"><button type="button" onClick={()=>setEditingDiet(null)}>Anuluj</button><button className="primary" disabled={busy}>{busy?"Zapisywanie…":"Zapisz zmiany"}</button></div>
        </form>
      </div></div>}
    {(profile?.role==="admin"||profile?.role==="kitchen")&&<Kaczorek diets={diets} clients={clients} storeOrders={storeOrders} dietPrices={dietPrices}/>}
    </main>
  </div>
}

function ClientEditor({client,onChange,onSave,onDelete}:{client:Client;onChange:(c:Client)=>void;onSave:(c:Client)=>void;onDelete?:(c:Client)=>void}){
  const set=(k:keyof Client,v:any)=>onChange({...client,[k]:v});
  return <div className="clientCard"><b>{client.name}</b><input value={client.name} onChange={e=>set("name",e.target.value)} placeholder="Nazwa"/><input value={client.phone||""} onChange={e=>set("phone",e.target.value)} placeholder="Telefon"/><input value={client.street_address||""} onChange={e=>set("street_address",e.target.value)} placeholder="Ulica i numer"/><div className="twocol"><input value={client.postal_code||""} onChange={e=>set("postal_code",e.target.value)} placeholder="Kod"/><input value={client.city||""} onChange={e=>set("city",e.target.value)} placeholder="Miasto"/></div><input value={client.kitchen_notes||""} onChange={e=>set("kitchen_notes",e.target.value)} placeholder="Uwagi dla kuchni"/><input value={client.courier_notes||""} onChange={e=>set("courier_notes",e.target.value)} placeholder="Uwagi dla kuriera"/><button className="primary" onClick={()=>onSave(client)}>Zapisz adres</button>{onDelete&&<button type="button" className="danger" onClick={()=>onDelete(client)}>🗑️ Usuń klienta</button>}{fullAddress(client)&&<a className="button" href={mapsUrl(client)} target="_blank" rel="noreferrer">Sprawdź w Google Maps</a>}</div>
}
