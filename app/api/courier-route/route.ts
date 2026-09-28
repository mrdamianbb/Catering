import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function warsawDate(){
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Warsaw",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=(t:string)=>p.find(x=>x.type===t)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function warsawIsoDow(){
  const w=new Intl.DateTimeFormat("en-US",{timeZone:"Europe/Warsaw",weekday:"short"}).format(new Date());
  return ({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7} as Record<string,number>)[w]||1;
}
function json(data:any,status=200){
  return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store, no-cache, must-revalidate"}});
}

export async function GET(req:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL||"https://wqqexlsrxnlbhirzbbnh.supabase.co";
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const bearer=req.headers.get("authorization")||"";
  if(!url||!anon)return json({error:"Brak publicznej konfiguracji Supabase."},503);
  if(!bearer.startsWith("Bearer "))return json({error:"Unauthorized"},401);

  const userClient=createClient(url,anon,{
    global:{headers:{Authorization:bearer}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user)return json({error:"Sesja wygasła."},401);

  const {data:profile,error:profileError}=await userClient
    .from("profiles")
    .select("id,role,route_code,route_codes")
    .eq("id",user.id).single();
  if(profileError||profile?.role!=="courier")return json({error:"Brak uprawnień kuriera."},403);

  const routes=((profile.route_codes?.length?profile.route_codes:(profile.route_code?[profile.route_code]:[])) as string[])
    .map(x=>String(x).trim().toUpperCase())
    .filter(Boolean);
  if(!routes.length)return json({date:warsawDate(),routes:[],diets:[]});

  const date=warsawDate();
  const dow=warsawIsoDow();

  const {data:dietRows,error}=await userClient
    .from("diets")
    .select("*")
    .eq("archived",false)
    .eq("kitchen_status","issued")
    .lte("start_date",date)
    .gte("end_date",date)
    .in("route_code",routes)
    .order("route_code")
    .order("client_name")
    .order("id");
  if(error)return json({error:error.message},500);

  const active=(dietRows||[]).filter((d:any)=>(d.delivery_weekdays||[1,2,3,4,5,6,7]).includes(dow));
  const ids=[...new Set(active.map((d:any)=>Number(d.client_id)).filter((id:number)=>Number.isFinite(id)&&id>0))];
  let clients:any[]=[];
  if(ids.length){
    const {data:clientRows,error:clientError}=await userClient.from("clients")
      .select("id,name,phone,street_address,postal_code,city,kitchen_notes,courier_notes")
      .in("id",ids);
    if(clientError){
      clients=[];
    }else{
      clients=clientRows||[];
    }
  }
  const byId=new Map(clients.map((c:any)=>[Number(c.id),c]));
  const diets=active.map((d:any)=>({...d,clients:byId.get(Number(d.client_id))||null}));
  const missingAddress=diets.filter((d:any)=>!d.clients?.street_address).map((d:any)=>({id:d.id,client_id:d.client_id,client_name:d.client_name}));
  return json({date,routes,diets,diagnostics:{diet_count:diets.length,client_count:clients.length,missing_address:missingAddress}});
}
