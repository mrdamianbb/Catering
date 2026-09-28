import {NextRequest,NextResponse} from "next/server";
import { SHAKE_MAX, SMAK_MIX, poprawnySmak } from "@/lib/shake";
import { kluczTelefonu, poziomDla } from "@/lib/loyalty";
import { wycen } from "@/lib/pricing";
import { zarejestrujPlatnosc, konfiguracja as p24Konfiguracja } from "@/lib/p24";
import { randomUUID } from "crypto";
import {createClient} from "@supabase/supabase-js";
import {createHash} from "crypto";
import {normalizeOrder,validateOrder} from "@/lib/orderValidation";
import {sendSms} from "@/lib/smsapi";

export const runtime="nodejs";
export const dynamic="force-dynamic";


function clean(v:unknown,max:number){
  return String(v??"").trim().slice(0,max);
}
function bad(message:string,status=400){
  return NextResponse.json({error:message},{status,headers:{"Cache-Control":"no-store"}});
}

const PROMOS:Record<string,number>={
  "RYCHTER":10,
  "MIRELA17":5,
  "START":10,
  "POTRZYMAJMIHANTLE":5,
  "GYMCITY":5,
  "XFG-RYBNIK":5,
  "XFG-ZORY":5,
  "XFG-JASTRZEBIE":5,
  "STEPIEN":5,
  "20DNI10":10
};
const normalizePromo=(v:unknown)=>String(v??"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"");
const identityKey=(name:string,address:string,postal:string,city:string)=>
  createHash("sha256").update(
    [name,address,postal,city].map(v=>v.trim().toLowerCase().replace(/\s+/g," ")).join("|")
  ).digest("hex");

export async function POST(req:NextRequest){
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||"https://wqqexlsrxnlbhirzbbnh.supabase.co";
  // Bez klucza serwisowego zapisujemy kluczem publicznym. Wymaga to
  // polityki zezwalającej na zapis do store_orders — plik
  // supabase/allow-store-orders-insert.sql.
  const serviceKey=(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.supabase_service_role||process.env.SUPABASE_SERVICE_KEY);
  const publicKey=(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"sb_publishable_gWrnpDV4vdLgQlKonfItQw_AoHIqs5q");
  const writeKey=serviceKey||publicKey;
  if(!supabaseUrl||!writeKey)return bad("Zamówienia są chwilowo niedostępne. Zadzwoń pod 884 004 321.",503);

  const origin=req.headers.get("origin");
  const host=req.headers.get("host");
  if(origin&&host){
    try{if(new URL(origin).host!==host)return bad("Niedozwolone źródło żądania.",403)}catch{return bad("Niedozwolone źródło żądania.",403)}
  }

  if(!(req.headers.get("content-type")||"").toLowerCase().startsWith("application/json"))return bad("Nieprawidłowy typ danych.",415);
  const len=Number(req.headers.get("content-length")||0);
  if(len>16384)return bad("Formularz jest zbyt duży.",413);

  let raw="";
  try{raw=await req.text()}catch{return bad("Nie udało się odczytać formularza.")}
  if(raw.length>16384)return bad("Formularz jest zbyt duży.",413);
  let body:any;
  try{body=JSON.parse(raw)}catch{return bad("Nieprawidłowe dane formularza.")}

  // Pułapka na boty. Pole nosi nazwę, której przeglądarki nie rozpoznają
  // jako adresowej — wcześniej nazywało się "company" i autouzupełnianie
  // Chrome wpisywało tam nazwę firmy, przez co prawdziwe zamówienia
  // były po cichu odrzucane jako botowe.
  if(clean(body.dk_ref_2,100)){
    console.warn("honeypot trafiony");
    return NextResponse.json({ok:true},{status:200,headers:{"Cache-Control":"no-store"}});
  }

  const order=normalizeOrder(body);
  // Data liczona w strefie warszawskiej, nie w strefie serwera (UTC) —
  // inaczej po północy odrzucalibyśmy poprawne zamówienia na dziś.
  const warsawToday=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Warsaw",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const errors=validateOrder(order,warsawToday);
  if(Object.keys(errors).length)return NextResponse.json({error:"Popraw zaznaczone pola.",errors},{status:400,headers:{"Cache-Control":"no-store"}});

  const ip=(req.headers.get("x-forwarded-for")||req.headers.get("x-real-ip")||"unknown").split(",")[0].trim();

  // Weryfikacja antybotowa wyłączona na życzenie właściciela.
  // Zostają: pułapka na boty (pole "company"), limit zapytań na IP
  // oraz ręczna akceptacja każdego zamówienia w panelu.

  const admin=createClient(supabaseUrl,writeKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const rateKey=createHash("sha256").update(`${ip}|orders`).digest("hex");
  // Limit zużywa się przy KAŻDEJ próbie, także nieudanej — przy testowaniu
  // z jednego łącza pięć prób blokowało formularz na dziesięć minut.
  const {data:allowed,error:rateError}=await admin.rpc("consume_order_rate_limit",{p_key:rateKey,p_limit:30,p_window_seconds:600});
  // Brak dostępu do funkcji limitu nie może blokować zamówień.
  if(!rateError&&allowed===false)return bad("Za dużo prób. Odczekaj kilka minut i spróbuj ponownie.",429);

  // Rabat lojalnościowy liczymy na serwerze z historii klienta.
  // Z przeglądarki przychodzi tylko informacja poglądowa.
  let loyaltyDays=0, loyaltyPercent=0;
  try{
    const tel=kluczTelefonu(order.phone);
    if(tel.length===9){
      const {data:kl}=await admin.from("clients").select("id,phone");
      const ids=(kl||[]).filter((c:any)=>kluczTelefonu(c.phone)===tel).map((c:any)=>c.id);
      if(ids.length){
        const {data:dt}=await admin.from("diets").select("start_date,end_date").in("client_id",ids);
        for(const d of (dt||[]) as any[]){
          const od=Date.parse(d.start_date+"T12:00:00"), koniec=Math.min(Date.parse(d.end_date+"T12:00:00"),Date.now());
          if(Number.isFinite(od)&&koniec>=od)loyaltyDays+=Math.floor((koniec-od)/86400000)+1;
        }
      }
    }
    loyaltyPercent=poziomDla(loyaltyDays)?.procent||0;
  }catch{ loyaltyDays=0; loyaltyPercent=0; }

  const promoCode=normalizePromo(body.promo_code);
  const promoPercent=promoCode?PROMOS[promoCode]||0:0;
  if(promoCode&&!promoPercent)return bad("Nieprawidłowy kod rabatowy.");
  if(promoCode==="20DNI10"&&order.days<20)return bad("Kod 20DNI10 działa przy zamówieniu na minimum 20 dni.");

  const promoIdentity=promoCode?identityKey(order.customer_name,order.street_address,order.postal_code,order.city):null;
  if(promoCode&&promoIdentity){
    const {data:used,error:promoCheckError}=await admin
      .from("promo_redemptions")
      .select("id")
      .eq("identity_hash",promoIdentity)
      .limit(1);
    if(promoCheckError)return bad("Nie udało się sprawdzić kodu rabatowego.",503);
    if(used?.length)return bad("Rabat został już wykorzystany dla tej osoby i adresu.");
  }

  const noteParts:string[]=[];
  if(promoCode)noteParts.push(`RABAT: ${promoCode} -${promoPercent}%`);
  if(order.no_allergens)noteParts.push("ALERGENY: BRAK");
  else if(order.allergens)noteParts.push(`ALERGENY: ${order.allergens}`);
  if(order.access_code_required&&order.access_code)noteParts.push(`WEJŚCIE DO KLATKI: ${order.access_code}`);
  noteParts.push(`REGULAMIN: zaakceptowany ${new Date().toISOString()}`);
  if(order.notes)noteParts.push(order.notes);

  const {no_allergens,allergens,access_code_required,access_code,terms_accepted,...dbOrder}=order;
  (dbOrder as any).marketing_consent=Boolean((body as any)?.marketing_consent);

  // Shake jako dodatek do diety. Liczbę i smak sprawdzamy po stronie serwera —
  // z przeglądarki może przyjść dowolna wartość.
  const shakeIle=Math.max(0,Math.min(SHAKE_MAX,Math.floor(Number((body as any)?.shake_qty)||0)));
  const shakeSmak=String((body as any)?.shake_flavour||"");
  // Kwotę liczy serwer z własnego cennika. To, co przyszło z przeglądarki,
  // służy tylko do podglądu — inaczej wystarczyłoby podmienić cenę w formularzu.
  const wycena=wycen({
    kcal:order.kcal, dni:order.days, shakeIle:shakeIle,
    rabatPromocyjny:promoPercent, dniLojalnosci:loyaltyDays
  });
  const sesjaPlatnosci=randomUUID();
  (dbOrder as any).payment_amount=wycena.grosze;
  (dbOrder as any).payment_session=sesjaPlatnosci;
  (dbOrder as any).payment_status=p24Konfiguracja()?"pending":"offline";
  (dbOrder as any).referrer=String((body as any)?.referrer||"").trim().slice(0,120)||null;
  (dbOrder as any).loyalty_days=loyaltyDays;
  (dbOrder as any).loyalty_percent=loyaltyPercent;
  (dbOrder as any).shake_qty=shakeIle;
  (dbOrder as any).shake_flavour=shakeIle>0&&poprawnySmak(shakeSmak)?shakeSmak:(shakeIle>0?SMAK_MIX:null);

  // Rabat rezerwujemy PRZED zapisem zamówienia. Unikalność w bazie wyłapie
  // ponowne użycie, a dzięki temu nie musimy niczego cofać po fakcie.
  if(promoCode&&promoIdentity){
    const {error:redeemError}=await admin.from("promo_redemptions").insert({
      promo_code:promoCode,discount_percent:promoPercent,identity_hash:promoIdentity
    });
    if(redeemError){
      if(redeemError.code==="23505")return bad("Rabat został już wykorzystany dla tej osoby i adresu.");
      console.error("promo redemption insert",redeemError);
      return bad("Nie udało się zapisać rabatu.",500);
    }
  }

  // Bez klucza serwisowego NIE prosimy o zwrot zapisanego wiersza.
  // Zapytanie "insert ... returning" wymaga uprawnienia do odczytu, którego
  // anonimowy użytkownik nie ma — Supabase odrzuciłby wtedy cały zapis,
  // mimo że polityka na dodawanie jest poprawna.
  const row={...dbOrder,notes:noteParts.join(" · ")||null,status:"new"};
  const insert=admin.from("store_orders").insert(row);
  const {error}=serviceKey?await insert.select("id").single():await insert;

  if(error){
    console.error("store_orders insert",error);
    if(promoCode&&promoIdentity){
      await admin.from("promo_redemptions").delete().eq("promo_code",promoCode).eq("identity_hash",promoIdentity);
    }
    return bad("Nie udało się zapisać zamówienia: "+error.message,500);
  }


  // Rejestracja płatności. Gdy Przelewy24 nie są skonfigurowane, zamówienie
  // przechodzi jak dotąd — właściciel kontaktuje się i rozlicza po swojemu.
  let platnoscUrl:string|null=null;
  if(p24Konfiguracja()&&wycena.grosze>0){
    const skad=req.headers.get("origin")||process.env.NEXT_PUBLIC_SITE_URL||"https://dzikakaczkacatering.pl";
    const rej=await zarejestrujPlatnosc({
      sessionId:sesjaPlatnosci,
      grosze:wycena.grosze,
      opis:`Dieta ${order.diet_name} ${order.kcal} kcal, ${order.days} dni`,
      email:order.email||"kontakt@balcar.com.pl",
      urlPowrotu:`${skad}/platnosc?sesja=${sesjaPlatnosci}`,
      urlPowiadomienia:`${skad}/api/p24/notify`
    });
    if(rej.ok)platnoscUrl=rej.url;
    else console.error("P24 rejestracja",rej.blad);
  }

  // SMS tylko do właściciela/obsługi o nowym zamówieniu.
  // Brak SMSAPI albo chwilowy błąd nie blokuje zapisania zamówienia.
  const adminPhone=(process.env.SMSAPI_ADMIN_PHONE||process.env.sms_admin_phone||process.env.ADMIN_PHONE)?.trim();
  if(adminPhone){
    const adminSms=[
      "NOWE ZAMÓWIENIE",
      `${order.customer_name}, tel. ${order.phone}.`,
      `${order.diet_name} ${order.kcal} kcal / ${order.days} dni.`,
      `Start: ${order.start_date}.`,
      `${order.street_address}, ${order.postal_code} ${order.city}.`,
      promoCode?`Kod: ${promoCode} (-${promoPercent}%).`:""
    ].filter(Boolean).join(" ");

    const adminSmsResult=await sendSms({
      to:adminPhone,
      message:adminSms,
      idx:`order-${Date.now()}-admin`
    });

    if(!adminSmsResult.ok&&adminSmsResult.error!=="SMSAPI_TOKEN_NOT_CONFIGURED"){
      console.error("SMSAPI admin send",adminSmsResult);
    }
  }

  return NextResponse.json({
    ok:true,
    promo:promoCode?{code:promoCode,percent:promoPercent}:null,
    kwota:wycena.razem,
    platnoscUrl
  },{status:201,headers:{"Cache-Control":"no-store"}});
}
