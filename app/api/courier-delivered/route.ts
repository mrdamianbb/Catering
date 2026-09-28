import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {sendSms} from "@/lib/smsapi";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function json(data:any,status=200){
  return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
}
function warsawDate(){
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Warsaw",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=(t:string)=>p.find(x=>x.type===t)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Bez polskich znaków — z ogonkami SMS przechodzi na kodowanie UCS-2
// i mieści 70 znaków zamiast 160, czyli kosztuje dwa razy więcej.
function deliveryMessage(firstName:string){
  const who=firstName?` ${firstName},`:"";
  return `Dzika Kaczka Catering:${who} Twoja dieta czeka pod drzwiami. Smacznego!`;
}
function stripDiacritics(v:string){
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").replace(/Ł/g,"L");
}

export async function POST(req:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||"https://wqqexlsrxnlbhirzbbnh.supabase.co";
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey=(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.supabase_service_role||process.env.SUPABASE_SERVICE_KEY);
  if(!url||!anon||!serviceKey)return json({error:"Konfiguracja Supabase jest niekompletna."},503);

  const bearer=req.headers.get("authorization")||"";
  if(!bearer.startsWith("Bearer "))return json({error:"Unauthorized"},401);

  let body:any;
  try{body=await req.json()}catch{return json({error:"Nieprawidłowe dane."},400)}
  const dietId=Number(body?.diet_id);
  if(!Number.isInteger(dietId)||dietId<=0)return json({error:"Brak identyfikatora diety."},400);

  // 1. Kto pyta
  const userClient=createClient(url,anon,{
    global:{headers:{Authorization:bearer}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user)return json({error:"Sesja wygasła."},401);

  const {data:profile,error:profileError}=await userClient
    .from("profiles").select("id,role,route_code,route_codes").eq("id",user.id).single();
  if(profileError||!profile)return json({error:"Brak profilu."},403);
  if(profile.role!=="courier"&&profile.role!=="admin")return json({error:"Brak uprawnień."},403);

  // 2. Czy ta dieta należy do jego trasy i jest na dziś
  const date=warsawDate();
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

  const {data:diet,error:dietError}=await admin
    .from("diets")
    .select("id,client_id,client_name,route_code,kitchen_status,start_date,end_date,archived")
    .eq("id",dietId).single();
  if(dietError||!diet)return json({error:"Nie znaleziono diety."},404);

  if(diet.archived)return json({error:"Dieta jest zarchiwizowana."},409);
  if(diet.kitchen_status!=="issued")return json({error:"Dieta nie została jeszcze wydana kurierowi."},409);
  if(diet.start_date>date||diet.end_date<date)return json({error:"Ta dieta nie jest realizowana dzisiaj."},409);

  if(profile.role==="courier"){
    const routes=((profile.route_codes?.length?profile.route_codes:(profile.route_code?[profile.route_code]:[])) as string[])
      .map(x=>String(x).trim().toUpperCase()).filter(Boolean);
    if(!routes.includes(String(diet.route_code||"").trim().toUpperCase()))
      return json({error:"Ta dieta nie należy do Twojej trasy."},403);
  }

  // 3. Zapis dostawy PRZED wysłaniem SMS.
  // Unikalność (diet_id, delivery_date) sprawia, ze drugie klikniecie
  // nie wysle drugiej wiadomosci.
  const {data:created,error:insertError}=await admin.from("deliveries").insert({
    diet_id:diet.id,
    client_id:diet.client_id,
    delivery_date:date,
    courier_id:user.id,
    route_code:diet.route_code
  }).select("id").single();

  if(insertError){
    if(insertError.code==="23505")return json({ok:true,already:true,message:"Ta dostawa była już potwierdzona."});
    console.error("deliveries insert",insertError);
    return json({error:"Nie udało się zapisać dostawy."},500);
  }

  // 4. SMS do klienta — awaria wysyłki nie cofa potwierdzenia dostawy
  const {data:client}=await admin.from("clients").select("name,phone").eq("id",diet.client_id).single();
  const phone=String(client?.phone||"").trim();

  if(!phone){
    await admin.from("deliveries").update({sms_status:"no_phone"}).eq("id",created.id);
    return json({ok:true,sms:"no_phone",message:"Dostawa zapisana. Klient nie ma numeru telefonu."});
  }

  const firstName=stripDiacritics(String(client?.name||"").trim().split(/\s+/)[0]||"");
  const result=await sendSms({
    to:phone,
    message:deliveryMessage(firstName),
    idx:`delivery-${diet.id}-${date}`
  });

  if(!result.ok){
    const status=result.error==="SMSAPI_TOKEN_NOT_CONFIGURED"?"not_configured":"failed";
    await admin.from("deliveries").update({sms_status:status,sms_error:String(result.error||"")}).eq("id",created.id);
    console.error("delivery sms",result);
    return json({ok:true,sms:status,message:"Dostawa zapisana, ale SMS nie został wysłany."});
  }

  await admin.from("deliveries").update({sms_status:"sent"}).eq("id",created.id);
  return json({ok:true,sms:"sent",message:"Dostawa potwierdzona, klient dostał SMS."});
}
