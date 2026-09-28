import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const ALLOWED_HOSTS=new Set([
  "zakupy.biedronka.pl",
  "zakupy.auchan.pl",
  "www.carrefour.pl",
  "carrefour.pl"
]);

function bad(message:string,status=400){
  return NextResponse.json({ok:false,error:message},{status,headers:{"Cache-Control":"no-store"}});
}

function normalizeNumber(v:string){
  return Number(v.replace(/\s/g,"").replace(",","."));
}

function extractPrice(html:string, packageGrams?:number|null){
  // Prefer an explicit zł/kg value.
  const kgPatterns=[
    /(\d{1,3}(?:[.,]\d{2})?)\s*(?:zł|PLN)\s*\/\s*kg/ig,
    /(?:pricePerUnit|unitPrice|price_per_kg)["'\s:=]+(\d{1,3}(?:[.,]\d{2})?)/ig
  ];
  for(const re of kgPatterns){
    const found=[...html.matchAll(re)].map(m=>normalizeNumber(m[1])).filter(n=>Number.isFinite(n)&&n>0&&n<500);
    if(found.length)return {pricePerKg:Math.min(...found),rawPrice:null};
  }

  // JSON-LD / product price fallback.
  const rawCandidates:number[]=[];
  const patterns=[
    /"price"\s*:\s*"?(\\?\d{1,4}(?:[.,]\d{2})?)"?/ig,
    /(?:Cena|price)[^0-9]{0,30}(\d{1,4}[.,]\d{2})\s*(?:zł|PLN)/ig
  ];
  for(const re of patterns){
    for(const m of html.matchAll(re)){
      const n=normalizeNumber(m[1]);
      if(Number.isFinite(n)&&n>0&&n<1000)rawCandidates.push(n);
    }
  }
  if(rawCandidates.length&&packageGrams&&packageGrams>0){
    const raw=Math.min(...rawCandidates);
    return {pricePerKg:raw/(packageGrams/1000),rawPrice:raw};
  }
  return null;
}

async function requireAdmin(req:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||"https://wqqexlsrxnlbhirzbbnh.supabase.co";
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const auth=req.headers.get("authorization")||"";
  if(!url||!anon||!auth.startsWith("Bearer "))return false;
  const client=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)return false;
  const {data:profile}=await client.from("profiles").select("role").eq("id",user.id).single();
  return profile?.role==="admin";
}

async function runMonitor(){
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||"https://wqqexlsrxnlbhirzbbnh.supabase.co";
  const serviceKey=(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.supabase_service_role||process.env.SUPABASE_SERVICE_KEY);
  if(!supabaseUrl||!serviceKey)throw new Error("Brak SUPABASE_SERVICE_ROLE_KEY lub SUPABASE_URL.");
  const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

  const {data:sources,error}=await admin.from("price_sources")
    .select("id,ingredient_id,retailer,url,package_grams,active")
    .eq("active",true).limit(50);
  if(error)throw new Error(error.message);

  const results:any[]=[];
  for(const src of (sources||[])){
    let status="ok";
    try{
      const url=new URL(src.url);
      if(url.protocol!=="https:"||!ALLOWED_HOSTS.has(url.hostname))throw new Error("Niedozwolona domena źródła.");
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),8000);
      const res=await fetch(url.toString(),{
        headers:{
          "User-Agent":"Mozilla/5.0 (compatible; DzikaKaczkaPriceMonitor/1.0)",
          "Accept":"text/html,application/xhtml+xml"
        },
        cache:"no-store",
        redirect:"follow",
        signal:ctrl.signal
      });
      clearTimeout(timer);
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const html=(await res.text()).slice(0,2_000_000);
      const price=extractPrice(html,src.package_grams?Number(src.package_grams):null);
      if(!price||!Number.isFinite(price.pricePerKg)||price.pricePerKg<=0)throw new Error("Nie znaleziono ceny zł/kg.");

      const checkedAt=new Date().toISOString();
      await admin.from("price_snapshots").insert({
        price_source_id:src.id,ingredient_id:src.ingredient_id,retailer:src.retailer,
        price_per_kg:Number(price.pricePerKg.toFixed(2)),raw_price:price.rawPrice,
        package_grams:src.package_grams||null,checked_at:checkedAt
      });
      await admin.from("price_sources").update({
        last_status:"ok",last_checked_at:checkedAt,last_price_per_kg:Number(price.pricePerKg.toFixed(2))
      }).eq("id",src.id);

      results.push({...src,price_per_kg:Number(price.pricePerKg.toFixed(2)),status:"ok"});
    }catch(err:any){
      status=err?.name==="AbortError"?"timeout":String(err?.message||"błąd").slice(0,200);
      await admin.from("price_sources").update({last_status:status,last_checked_at:new Date().toISOString()}).eq("id",src.id);
      results.push({...src,status});
    }
  }

  // Pick cheapest recent price per ingredient and update the ingredient comparison price.
  const ingredientIds=[...new Set((sources||[]).map((s:any)=>s.ingredient_id))];
  for(const ingredientId of ingredientIds){
    const {data:best}=await admin.from("price_sources")
      .select("retailer,last_price_per_kg,last_checked_at")
      .eq("ingredient_id",ingredientId).eq("active",true).eq("last_status","ok")
      .not("last_price_per_kg","is",null)
      .order("last_price_per_kg",{ascending:true}).limit(1).maybeSingle();
    if(best?.last_price_per_kg){
      await admin.from("ingredients").update({
        web_price_per_kg:Number(best.last_price_per_kg),
        web_price_source:String(best.retailer||"internet"),
        web_price_checked_at:best.last_checked_at||new Date().toISOString()
      }).eq("id",ingredientId);
    }
  }
  return results;
}

export async function GET(req:NextRequest){
  const secret=process.env.CRON_SECRET;
  const auth=req.headers.get("authorization");
  if(!secret||auth!==`Bearer ${secret}`)return bad("Unauthorized",401);
  try{
    const results=await runMonitor();
    return NextResponse.json({ok:true,checked:results.length,results},{headers:{"Cache-Control":"no-store"}});
  }catch(err:any){
    return bad(err?.message||"Błąd monitora cen.",500);
  }
}

export async function POST(req:NextRequest){
  if(!(await requireAdmin(req)))return bad("Unauthorized",401);
  try{
    const results=await runMonitor();
    return NextResponse.json({ok:true,checked:results.length,results},{headers:{"Cache-Control":"no-store"}});
  }catch(err:any){
    return bad(err?.message||"Błąd monitora cen.",500);
  }
}
