import {NextRequest,NextResponse} from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

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

const normalizeCode=(v:unknown)=>String(v??"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"");

export async function POST(req:NextRequest){
  let body:any;
  try{body=await req.json()}catch{return NextResponse.json({error:"Nieprawidłowe dane."},{status:400})}
  const code=normalizeCode(body?.code);
  const percent=PROMOS[code];
  if(!percent)return NextResponse.json({error:"Nieprawidłowy kod rabatowy."},{status:400,headers:{"Cache-Control":"no-store"}});
  const days=Number(body?.days);
  if(code==="20DNI10"&&(!Number.isInteger(days)||days<20))return NextResponse.json({error:"Kod 20DNI10 działa przy zamówieniu na minimum 20 dni."},{status:400,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({ok:true,code,percent},{headers:{"Cache-Control":"no-store"}});
}
