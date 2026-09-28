import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
const ALLOWED_HOSTS=new Set(["zakupy.biedronka.pl","zakupy.auchan.pl","www.carrefour.pl","carrefour.pl"]);
function json(data:any,status=200){return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}})}

async function adminClient(req:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const bearer=req.headers.get("authorization")||"";
  const client=createClient(url,anon,{global:{headers:{Authorization:bearer}},auth:{persistSession:false}});
  const {data:{user}}=await client.auth.getUser();
  if(!user)return null;
  const {data:p}=await client.from("profiles").select("role").eq("id",user.id).single();
  return p?.role==="admin"?client:null;
}

export async function GET(req:NextRequest){
  const client=await adminClient(req);if(!client)return json({error:"Unauthorized"},401);
  const {data,error}=await client.from("price_sources").select("*").order("ingredient_id").order("retailer");
  return error?json({error:error.message},400):json({data});
}

export async function POST(req:NextRequest){
  const client=await adminClient(req);if(!client)return json({error:"Unauthorized"},401);
  const b=await req.json();
  const url=new URL(String(b.url||""));
  if(url.protocol!=="https:"||!ALLOWED_HOSTS.has(url.hostname))return json({error:"Dozwolone są tylko linki Biedronka/Auchan/Carrefour."},400);
  const row={ingredient_id:Number(b.ingredient_id),retailer:String(b.retailer||"").slice(0,80),url:url.toString(),package_grams:b.package_grams?Number(b.package_grams):null,active:true};
  const {data,error}=await client.from("price_sources").upsert(row,{onConflict:"ingredient_id,url"}).select().single();
  return error?json({error:error.message},400):json({data});
}
