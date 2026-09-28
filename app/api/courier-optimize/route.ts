import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function json(data:any,status=200){
  return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
}

/**
 * Zwraca kolejność objazdu punktów.
 *
 * Bez klucza GOOGLE_MAPS_API_KEY endpoint oddaje kolejność wejściową —
 * aplikacja działa jak dotąd, tylko bez optymalizacji. Z kluczem korzysta
 * z Routes API, które układa punkty tak, by przejazd był najkrótszy.
 */
export async function POST(req:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||"https://wqqexlsrxnlbhirzbbnh.supabase.co";
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!anon)return json({error:"Brak konfiguracji Supabase."},503);

  const bearer=req.headers.get("authorization")||"";
  if(!bearer.startsWith("Bearer "))return json({error:"Unauthorized"},401);

  const userClient=createClient(url,anon,{
    global:{headers:{Authorization:bearer}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user)return json({error:"Sesja wygasła."},401);

  let body:any;
  try{body=await req.json()}catch{return json({error:"Nieprawidłowe dane."},400)}

  const origin=String(body?.origin||"").trim();
  const stops:string[]=Array.isArray(body?.stops)
    ? body.stops.map((s:any)=>String(s||"").trim()).filter(Boolean).slice(0,25)
    : [];

  if(!origin||stops.length<2)return json({order:stops.map((_,i)=>i),optimized:false,reason:"za mało punktów"});

  const key=(process.env.GOOGLE_MAPS_API_KEY||process.env.google_maps||process.env.GOOGLE_MAPS)?.trim();
  if(!key)return json({order:stops.map((_,i)=>i),optimized:false,reason:"brak klucza"});

  // Ostatni punkt zostaje metą, reszta to punkty pośrednie do przestawienia.
  const destination=stops[stops.length-1];
  const intermediates=stops.slice(0,-1);

  try{
    const res=await fetch("https://routes.googleapis.com/directions/v2:computeRoutes",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "X-Goog-Api-Key":key,
        "X-Goog-FieldMask":"routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration"
      },
      body:JSON.stringify({
        origin:{address:origin},
        destination:{address:destination},
        intermediates:intermediates.map(address=>({address})),
        travelMode:"DRIVE",
        optimizeWaypointOrder:true,
        routingPreference:"TRAFFIC_AWARE",
        languageCode:"pl-PL",
        regionCode:"PL"
      }),
      cache:"no-store"
    });

    const data=await res.json().catch(()=>({}));
    if(!res.ok){
      console.error("routes api",res.status,data);
      return json({order:stops.map((_,i)=>i),optimized:false,reason:"blad Routes API"});
    }

    const route=data?.routes?.[0];
    const idx:number[]=route?.optimizedIntermediateWaypointIndex||[];
    if(idx.length!==intermediates.length){
      return json({order:stops.map((_,i)=>i),optimized:false,reason:"niepelna odpowiedz"});
    }

    return json({
      order:[...idx,stops.length-1],
      optimized:true,
      distance_km:route?.distanceMeters?Math.round(route.distanceMeters/100)/10:null,
      duration:route?.duration||null
    });
  }catch(err){
    console.error("optimize",err);
    return json({order:stops.map((_,i)=>i),optimized:false,reason:"blad polaczenia"});
  }
}
