"use client";
import {FormEvent,useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {detectRestrictions, ingredientBlocked as blockedByAllergen, allergensInDish} from "@/lib/allergens";
import {mealShare as mealShareWspolna, normalizedMealShare} from "@/lib/mealShares";
import {SLOTY_MENU, slotsForDiet, rowsForSlots, chooseRecipe, pasujeDoSlotu, ulozTydzien, ulozDzien, DNI_PAMIECI, zakresTygodnia} from "@/lib/production";
import {dzienProdukcji, zapiszDzienProdukcji, najblizszaDostawa, dietyNaDzien} from "@/lib/productionDay";
import {pobierzEtykiety, pobierzEtykietyPdf, pobierzEtykietyXlsx, type DaneEtykiety} from "@/lib/etykiety";
type Role="admin"|"kitchen"|"courier"; type Profile={id:string;full_name:string|null;role:Role};
type Recipe={id:number;name:string;meal_type:string;diet_type:string;base_kcal:number;protein:number;fat:number;carbs:number;food_cost:number;active:boolean;notes:string|null};
type MenuRow={id:number;menu_date:string;diet_type:string;meal_type:string;recipe_id:number;recipes?:Recipe};
// Wyłącznie nazwy posiłków. Udziały w kaloryczności są w lib/mealShares.ts —
// trzymanie ich tutaj kończyło się rozjazdem między ekranami.
const MEALS=[
 ["breakfast","Śniadanie"],
 ["second_breakfast","II posiłek"],
 ["lunch","Obiad"],
 ["dinner","Kolacja"],
 ["shake","Shake"],
 ["snack","Podwieczorek"]
] as const;
const DIET_LAYOUTS={
 Standard:[
  ["breakfast","Śniadanie"],
  ["second_breakfast","II posiłek / Shake"],
  ["lunch","Obiad"],
  ["dinner","Kolacja / Shake"]
 ],
 Keto:[
  ["breakfast","Śniadanie"],
  ["lunch","Obiad"],
  ["dinner","Kolacja / Shake"]
 ],
 "Low Carb":[
  ["breakfast","Śniadanie"],
  ["second_breakfast","II posiłek"],
  ["lunch","Obiad"],
  ["dinner","Kolacja"]
 ],
 "3 posiłki":[
  ["breakfast","Śniadanie"],
  ["lunch","Obiad"],
  ["dinner","Kolacja"]
 ]
} as const;
const kcalVariants=[1200,1300,1400,1500,1600,1800,2000,2100,2200,2500,3000];
const iso=(d:Date)=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)};
const mondayOf=(d:Date)=>{const x=new Date(d);const js=x.getDay();const day=js||7;x.setDate(x.getDate()-day+1);if(js===6)x.setDate(x.getDate()+7);if(js===0)x.setDate(x.getDate()+7);x.setHours(12,0,0,0);return x};
const plDate=(d:string)=>new Date(d+"T12:00:00").toLocaleDateString("pl-PL",{weekday:"long",day:"2-digit",month:"2-digit"});
export default function MenuPage(){
 const today=iso(new Date());
 // Dzień produkcji wspólny z panelem. Dawniej było tu na sztywno „jutro,
 // w sobotę poniedziałek" — etykiety pomijały niedzielę i nie wiedziały
 // o dniu wybranym w kalendarzu panelu.
 const [productionDay,setProductionDayRaw]=useState<string>(()=>najblizszaDostawa([]));
 const ustawDzienProdukcji=(v:string)=>{setProductionDayRaw(v);zapiszDzienProdukcji(v);};
 const weekdayNo=(dateStr:string)=>{const d=new Date(dateStr+"T12:00:00");const n=d.getDay();return n===0?7:n};
 const dietTypeOf=(name:string)=>{const n=(name||"").toLowerCase();if(n.includes("low carb")||n.includes("low-carb")||n.includes("lowcarb"))return "Low Carb";if(n.includes("keto"))return "Keto";return "Standard";};
 const mealCountOf=(d:any)=>{const n=Number(d?.meal_count);return n===3||n===4||n===5?n:4};

 // Wspólny moduł wykluczeń — ten sam, którego używa panel i sklep.
 // Wcześniej kuchnia miała własną, uboższą listę (tylko cztery pozycje)
 // i nie widziała zgłoszeń o orzechach, jajach, selerze czy soi.
 const restrictionFlags=(d:any)=>detectRestrictions(d?.diet_name,d?.notes,d?.clients?.kitchen_notes);
 const blockedIngredient=(name:string,flags:string[])=>blockedByAllergen(name,flags);
 const safeRecipe=(r:any,flags:string[])=>!ingredientsForRecipe(r).some((ri:any)=>blockedIngredient(ri?.ingredients?.name||"",flags));
 // Low Carb korzysta z podziału Standard; zmieniają się skład i gramatury, nie sloty dnia.
 const shareFor=(meal:string,dietType:string)=>mealShareWspolna(meal,dietType);
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
   const linked=(r?.recipe_ingredients||[]);
   if(linked.length)return linked;
   return (LOW_CARB_GRAMS[r?.name]||[]).map((x:any)=>({grams:x.grams,ingredients:{id:`fallback-${x.name}`,name:x.name,unit:"g"}}));
 };
 const fmtG=(g:number)=>g>=1000?`${(g/1000).toFixed(2)} kg`:`${Math.round(g)} g`;

 const[loading,setLoading]=useState(true),[profile,setProfile]=useState<Profile|null>(null),[recipes,setRecipes]=useState<Recipe[]>([]),[menu,setMenu]=useState<MenuRow[]>([]),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[weekStart,setWeekStart]=useState(()=>iso(mondayOf(new Date()))),[actualDiets,setActualDiets]=useState<any[]>([]),[ingredients,setIngredients]=useState<any[]>([]),[ingSearch,setIngSearch]=useState(""),[nadmiary,setNadmiary]=useState<string[]>([]),[noweHaslo,setNoweHaslo]=useState(""),[menuProdukcji,setMenuProdukcji]=useState<any[]>([]),[tydzienProdukcji,setTydzienProdukcji]=useState<any[]>([]),[ostatniaAktualizacja,setOstatniaAktualizacja]=useState<Date|null>(null);
async function refreshActualDiets(showMessage=false){
  try{
    const {data,error}=await supabase.from("diets")
      .select("id,client_name,diet_name,kcal,bags,meal_count,start_date,end_date,delivery_weekdays,notes,archived,kitchen_status,clients(kitchen_notes)")
      .eq("archived",false)
      .order("kcal")
      .order("client_name");
    if(error)throw error;
    setActualDiets(data||[]);
    if(showMessage)setMsg(`Diety odświeżone ✓ ${(data||[]).length} rekordów`);
  }catch(err:any){
    if(showMessage)setMsg("Błąd odświeżania diet: "+(err?.message||"nieznany błąd"));
  }
}

// Menu na dzień produkcji — wczytywane osobno, żeby etykiety i produkcja
// nie zależały od tygodnia oglądanego w siatce.
useEffect(()=>{
  let anuluj=false;
  (async()=>{
    const {data,error}=await supabase.from("weekly_menu")
      .select("*,recipes(*,recipe_ingredients(grams,ingredients(id,name,unit)))")
      .eq("menu_date",productionDay);
    if(anuluj)return;
    if(error){setMsg("Nie mogę wczytać menu na dzień produkcji: "+error.message);return;}
    setMenuProdukcji((data||[]) as any[]);
  })();
  return()=>{anuluj=true;};
},[productionDay,menu]);

// Cały tydzień dnia produkcji — tło dla zamienników, żeby nie powtarzały
// dań z innych dni. Ten sam zakres wczytuje panel.
useEffect(()=>{
  let anuluj=false;
  const {od,do:doDnia}=zakresTygodnia(productionDay);
  (async()=>{
    const {data}=await supabase.from("weekly_menu")
      .select("id,menu_date,diet_type,meal_type,recipe_id,recipes(*,recipe_ingredients(grams,ingredients(id,name,unit)))")
      .gte("menu_date",od).lte("menu_date",doDnia);
    if(!anuluj)setTydzienProdukcji((data||[]) as any[]);
  })();
  return()=>{anuluj=true;};
},[productionDay,menu]);

// Kuchnia trzyma tę zakładkę otwartą cały dzień, a diety zmieniają się
// w panelu. Odświeżamy: po powrocie na zakładkę, co minutę w tle
// i po odzyskaniu połączenia.
useEffect(()=>{
  let dziala=true;
  const odswiez=()=>{ if(dziala&&!busy)swiezeDietyNaProdukcje().catch(()=>{}); };
  const naWidoku=()=>{ if(document.visibilityState==="visible")odswiez(); };

  odswiez();
  const t=setInterval(odswiez,60000);
  document.addEventListener("visibilitychange",naWidoku);
  window.addEventListener("focus",odswiez);
  window.addEventListener("online",odswiez);
  return()=>{
    dziala=false;
    clearInterval(t);
    document.removeEventListener("visibilitychange",naWidoku);
    window.removeEventListener("focus",odswiez);
    window.removeEventListener("online",odswiez);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
},[productionDay]);

// Menu i receptury zmieniają się rzadziej — co pięć minut i po powrocie.
useEffect(()=>{
  const naWidoku=()=>{ if(document.visibilityState==="visible"&&!busy)load(); };
  const t=setInterval(()=>{ if(!busy)load(); },300000);
  document.addEventListener("visibilitychange",naWidoku);
  return()=>{ clearInterval(t); document.removeEventListener("visibilitychange",naWidoku); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
},[weekStart]);

useEffect(()=>{const z=dzienProdukcji([]);if(z!==productionDay)setProductionDayRaw(z);
  // eslint-disable-next-line react-hooks/exhaustive-deps
},[]);

// Gdy nikt nie wybrał dnia w panelu, bierzemy najbliższą realną dostawę —
// dokładnie tak samo jak panel.
useEffect(()=>{
  if(!actualDiets.length)return;
  const wybrany=dzienProdukcji(actualDiets);
  if(wybrany!==productionDay)setProductionDayRaw(wybrany);
  // eslint-disable-next-line react-hooks/exhaustive-deps
},[actualDiets]);

async function load(){
  setLoading(true);setMsg("");
  const{data:s}=await supabase.auth.getSession();const uid=s.session?.user.id;
  if(!uid){setLoading(false);return}
  const{data:p,error:pe}=await supabase.from("profiles").select("id,full_name,role").eq("id",uid).single();
  if(pe){setMsg("Błąd profilu: "+pe.message);setLoading(false);return}
  setProfile(p as Profile);
  const end=new Date(weekStart+"T12:00:00");end.setDate(end.getDate()+6);
  const[{data:r,error:re},{data:ing,error:ie},{data:nad},{data:m,error:me},{data:ad,error:ade}]=await Promise.all([
    supabase.from("recipes").select("*,recipe_ingredients(grams,ingredients(id,name,unit))").eq("active",true).order("meal_type").order("food_cost"),
    supabase.from("ingredients").select("id,name,unit").order("name"),
    supabase.from("surplus_terms").select("term"),
    supabase.from("weekly_menu").select("*,recipes(*,recipe_ingredients(grams,ingredients(id,name,unit)))").gte("menu_date",weekStart).lte("menu_date",iso(end)).order("menu_date"),
    supabase.from("diets").select("id,client_name,diet_name,kcal,bags,meal_count,start_date,end_date,delivery_weekdays,notes,archived,clients(kitchen_notes)").eq("archived",false)
  ]);
  if(re||ie||me||ade)setMsg("Błąd pobierania danych: "+(re?.message||ie?.message||me?.message||ade?.message));
  setRecipes((r||[]) as Recipe[]);
  setIngredients(ing||[]);
  setNadmiary(((nad||[]) as any[]).map(x=>String(x.term)));
  setMenu((m||[]) as MenuRow[]);
  setActualDiets(ad||[]);
  setLoading(false)
}
 useEffect(()=>{load()},[weekStart]);
 useEffect(()=>{
   const timer=window.setInterval(()=>refreshActualDiets(false),30000);
   const focus=()=>refreshActualDiets(false);
   window.addEventListener("focus",focus);
   return()=>{window.clearInterval(timer);window.removeEventListener("focus",focus)};
 },[]);


 const productionGroups=useMemo(()=>{const wd=weekdayNo(productionDay);const active=actualDiets.filter((d:any)=>productionDay>=d.start_date&&productionDay<=d.end_date&&(d.delivery_weekdays||[1,2,3,4,5,6,7]).includes(wd));const mp=new Map<string,{dietType:string;kcal:number;flags:string[];count:number}>();for(const d of active){const dietType=dietTypeOf(d.diet_name);const flags=restrictionFlags(d);const key=`${dietType}|${d.kcal}|${flags.join("+")||"NORMAL"}`;const cur=mp.get(key)||{dietType,kcal:Number(d.kcal),flags,count:0};cur.count+=Math.max(1,Number(d.bags||1));mp.set(key,cur)}return [...mp.values()].sort((a,b)=>a.kcal-b.kcal||a.dietType.localeCompare(b.dietType))},[actualDiets,productionDay]);


 const menuRowsForDiet=(date:string,dietType:string)=>{
   // Dla dnia produkcji bierzemy menu wczytane osobno — siatka może pokazywać
   // inny tydzień, a wtedy etykiety traciły menu i drukowały „BRAK".
   const zrodlo=date===productionDay&&menuProdukcji.length?menuProdukcji:menu;
   const own=zrodlo.filter((x:any)=>x.menu_date===date&&x.diet_type===dietType);
   if(own.length)return own;

   // Od v8.3 jedna wspólna baza dnia: jeśli nie ma osobnego wpisu,
   // Standard/Keto/Low Carb korzystają z tych samych slotów Standard.
   return zrodlo.filter((x:any)=>x.menu_date===date&&x.diet_type==="Standard");
 };


 // Sloty i wiersze klienta — wspólna logika z lib/production.ts,
 // ta sama, której używa panel. Dawniej każdy ekran liczył to po swojemu.
 const mealSlotsForDiet=(d:any)=>slotsForDiet(Number(d?.meal_count||d?.mealCount||4),dietTypeOf(d?.diet_name||d?.dietType||""));
 const rowsForDiet=(rows:any[],d:any)=>rowsForSlots(rows,mealSlotsForDiet(d));
 const normalizedShareForDiet=(meal:string,d:any,rows:any[]):number=>
   normalizedMealShare(meal,d.dietType,rows);

 const tomorrowIso=()=>{
   const d=new Date();
   d.setDate(d.getDate()+1);
   const y=d.getFullYear();
   const m=String(d.getMonth()+1).padStart(2,"0");
   const day=String(d.getDate()).padStart(2,"0");
   return `${y}-${m}-${day}`;
 };

 const dietsForDate=(rows:any[],dateStr:string)=>{
   // Wspólna reguła z panelem — ten sam klient to ten sam numer z kartoteki.
   return dietyNaDzien(rows,dateStr)
     .map((d:any)=>({
       ...d,
       dietType:dietTypeOf(d.diet_name),
       flags:restrictionFlags(d),
       portions:Math.max(1,Number(d.bags||1)),
       mealCount:mealCountOf(d)
     }))
     .sort((a:any,b:any)=>String(a.client_name||"").localeCompare(String(b.client_name||""),"pl"));
 };

 const dietsForProductionDay=(rows:any[])=>dietsForDate(rows,productionDay);

 const productionDiets=useMemo(()=>dietsForProductionDay(actualDiets),[actualDiets,productionDay]);
 const tomorrowDiets=useMemo(()=>dietsForDate(actualDiets,tomorrowIso()),[actualDiets]);

 const todayRows=useMemo(()=>menu.filter(x=>x.menu_date===today),[menu,today]); const totalCost=useMemo(()=>todayRows.reduce((a,x)=>a+Number(x.recipes?.food_cost||0),0),[todayRows]); const weekCost=useMemo(()=>menu.reduce((a,x)=>a+Number(x.recipes?.food_cost||0),0),[menu]);


 const ingredientNames=(r:any)=>ingredientsForRecipe(r).map((x:any)=>(x.ingredients?.name||x.name||"").toString().trim().toLowerCase()).filter(Boolean);
 const overlapScore=(a:any,b:any)=>{
   const A=new Set(ingredientNames(a)),B=new Set(ingredientNames(b));
   if(!A.size||!B.size)return 0;
   let common=0; A.forEach(x=>{if(B.has(x))common++});
   return common/Math.max(A.size,B.size);
 };
 // Dawne sharedBaseRecipe i sharedProductionRecipe zastąpiła chooseRecipe z lib/production.ts.
 function recipeForProduction(row:any,g:any){
   const mealCount=Number(g.mealCount??g.meal_count??4)||4;
   return chooseRecipe(row,{dietType:g.dietType,flags:g.flags||[],mealCount},recipes as any[],tydzienProdukcji);
 }

 /**
  * Wydruk etykiet 50×30. Bez argumentu drukuje cały dzień; z nazwiskiem
  * klienta — tylko jego pudełka. Dziewczyny pakują jednego klienta,
  * drukują jego etykiety i biorą kolejnego.
  */
 async function printLabels50x30(tylkoKlient?:string){
   if(busy)return;

   // Popup musi powstać natychmiast po kliknięciu użytkownika.
   const w=window.open("","_blank");
   if(!w){
     setMsg("Przeglądarka zablokowała okno etykiet.");
     return;
   }

   w.document.open();
   w.document.write(`<!doctype html>
<html><head><meta charset="utf-8"/><title>Ładowanie etykiet…</title>
<style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}.loading{font-size:18px;font-weight:800}</style>
</head><body><div class="loading">Wczytuję etykiety 50×30…</div></body></html>`);
   w.document.close();

   setBusy(true);
   setMsg("Wczytuję aktualne diety do etykiet…");

   const {data,error}=await supabase.from("diets")
     .select("id,client_id,client_name,diet_name,kcal,bags,meal_count,start_date,end_date,delivery_weekdays,notes,archived,kitchen_status,clients(kitchen_notes)")
     .eq("archived",false)
     .order("id");

   setBusy(false);

   if(error){
     setMsg("Błąd wczytywania diet do etykiet: "+error.message);
     try{
       w.document.open();
       w.document.write(`<p style="font-family:Arial;padding:24px">Błąd wczytywania diet: ${String(error.message||"")}</p>`);
       w.document.close();
     }catch{}
     return;
   }

   let labelDiets=dietsForProductionDay(data||[]);
   if(tylkoKlient)labelDiets=labelDiets.filter((d:any)=>d.client_name===tylkoKlient);
   if(!labelDiets.length){
     setMsg(`Brak diet do etykiet na ${plDate(productionDay)}.`);
     try{
       w.document.open();
       w.document.write(`<p style="font-family:Arial;padding:24px">Brak diet do etykiet na ${plDate(productionDay)}.</p>`);
       w.document.close();
     }catch{}
     return;
   }

   const labels:string[]=[];

   for(const d of labelDiets){
     const rows=rowsForDiet(menuRowsForDiet(productionDay,d.dietType),d);

     for(const row of rows){
       const g={
         dietType:d.dietType,
         kcal:Number(d.kcal),
         flags:d.flags,
         count:d.portions,
         mealCount:d.mealCount
       };

       const r=recipeForProduction(row,g);
       const mealName=MEALS.find((x:any)=>x[0]===row.meal_type)?.[1]||row.meal_type;
       const exclusions=d.flags?.length?d.flags.join(" / "):"BEZ WYKLUCZEŃ";

       for(let i=0;i<Math.max(1,Number(d.portions||1));i++){
         labels.push(`
           <div class="label">
             <div class="brand">DZIKA KACZKA CATERING</div>
             <div class="meal">${mealName}</div>
             <div class="client">${d.client_name||"Klient"}</div>
             <div class="meta">${d.dietType} · ${d.kcal} kcal · ${d.mealCount} posiłki</div>
             <div class="dish">${r?.name||"Brak receptury"}</div>
             <div class="date">${plDate(productionDay)}</div>
             <div class="allergens ${d.flags?.length?"warn":""}">${exclusions}</div>
           </div>
         `);
       }
     }
   }

   if(!labels.length){
     setMsg("Brak ułożonego menu — nie ma etykiet do wydruku.");
     try{
       w.document.open();
       w.document.write(`<p style="font-family:Arial;padding:24px">Brak ułożonego menu — nie ma etykiet do wydruku.</p>`);
       w.document.close();
     }catch{}
     return;
   }

   w.document.open();
   w.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Etykiety 50x30</title>
<style>
@page{size:50mm 30mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#000}
.label{
  width:50mm;height:30mm;min-height:30mm;max-height:30mm;
  padding:2.2mm 2.4mm;display:flex;flex-direction:column;overflow:hidden;border:0;
  /* stara i nowa składnia — część sterowników rozumie tylko jedną z nich */
  page-break-after:always;break-after:page;
  page-break-inside:avoid;break-inside:avoid;
}
.brand{font-size:6pt;font-weight:900;letter-spacing:.2mm;border-bottom:.25mm solid #000;padding-bottom:.6mm}
.meal{font-size:11pt;font-weight:900;line-height:1.05;margin-top:.8mm;text-transform:uppercase}
.client{font-size:9pt;font-weight:800;line-height:1.05;margin-top:.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.meta{font-size:7.2pt;font-weight:700;margin-top:.4mm}
.dish{font-size:6.7pt;line-height:1.05;margin-top:.5mm;max-height:6.5mm;overflow:hidden}
.date{font-size:6.5pt;margin-top:auto}
.allergens{font-size:6.5pt;font-weight:900;border-top:.2mm solid #000;padding-top:.6mm;margin-top:.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.warn{font-size:7pt}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  /* ostatnia etykieta bez łamania, żeby nie wyszła pusta naklejka */
  .label:last-child{page-break-after:auto;break-after:auto}
}
</style>
</head>
<body>${labels.join("")}
<script>
window.onload=()=>setTimeout(()=>{
  window.focus();
  window.print();
},250);
</script>
</body>
</html>`);
   w.document.close();
   setMsg(tylkoKlient?`Etykiety dla ${tylkoKlient}: ${labels.length} szt. ✓`:`Etykiety gotowe: ${labels.length} szt. ✓`);
 }


 const LOW_CARB_STARTER=[
  // ŚNIADANIA
  {name:"Jajka z twarożkiem i warzywami",meal_type:"breakfast",base_kcal:400,protein:30,fat:25,carbs:12,food_cost:8.5,notes:"jajka, twaróg, pomidor, ogórek, szczypiorek"},
  {name:"Omlet ze szpinakiem i fetą",meal_type:"breakfast",base_kcal:410,protein:31,fat:27,carbs:13,food_cost:9.5,notes:"jajka, szpinak, feta, pomidor"},
  {name:"Jajecznica z indykiem i cukinią",meal_type:"breakfast",base_kcal:420,protein:36,fat:27,carbs:11,food_cost:10.5,notes:"jajka, indyk, cukinia, szczypiorek"},
  {name:"Frittata z brokułem i mozzarellą",meal_type:"breakfast",base_kcal:430,protein:33,fat:29,carbs:14,food_cost:10,notes:"jajka, brokuł, mozzarella, pomidor"},
  {name:"Serek wiejski z jajkiem i warzywami",meal_type:"breakfast",base_kcal:390,protein:32,fat:22,carbs:15,food_cost:8.5,notes:"serek wiejski, jajko, ogórek, pomidor, pestki"},
  {name:"Szakszuka z fetą",meal_type:"breakfast",base_kcal:405,protein:27,fat:25,carbs:18,food_cost:9,notes:"jajka, pomidor, papryka, feta"},

  // II POSIŁKI
  {name:"Skyr z malinami i migdałami",meal_type:"second_breakfast",base_kcal:320,protein:27,fat:13,carbs:18,food_cost:7.5,notes:"skyr, maliny, migdały, chia"},
  {name:"Skyr z borówkami i orzechami",meal_type:"second_breakfast",base_kcal:325,protein:26,fat:14,carbs:19,food_cost:8,notes:"skyr, borówki, orzechy włoskie"},
  {name:"Twaróg z rzodkiewką i pestkami",meal_type:"second_breakfast",base_kcal:310,protein:29,fat:17,carbs:11,food_cost:7,notes:"twaróg, rzodkiewka, ogórek, pestki dyni"},
  {name:"Pudding chia ze skyrem i malinami",meal_type:"second_breakfast",base_kcal:315,protein:24,fat:15,carbs:19,food_cost:8,notes:"skyr, chia, maliny, migdały"},
  {name:"Serek wiejski z ogórkiem i orzechami",meal_type:"second_breakfast",base_kcal:320,protein:28,fat:18,carbs:12,food_cost:7.5,notes:"serek wiejski, ogórek, orzechy, szczypiorek"},
  {name:"Roladki z indyka z serkiem i warzywami",meal_type:"second_breakfast",base_kcal:330,protein:35,fat:17,carbs:10,food_cost:10,notes:"indyk, serek, ogórek, papryka"},

  // OBIADY — wspólne bazy ze Standardem
  {name:"Kurczak z brokułem i cukinią",meal_type:"lunch",base_kcal:560,protein:52,fat:28,carbs:22,food_cost:14.5,notes:"kurczak, brokuł, cukinia; wspólna baza produkcyjna"},
  {name:"Indyk z fasolką i pieczarkami",meal_type:"lunch",base_kcal:550,protein:50,fat:27,carbs:24,food_cost:15,notes:"indyk, fasolka szparagowa, pieczarki"},
  {name:"Łosoś z warzywami i sosem jogurtowym",meal_type:"lunch",base_kcal:590,protein:43,fat:36,carbs:20,food_cost:20,notes:"łosoś, brokuł, cukinia, jogurt"},
  {name:"Kurczak curry z kalafiorem",meal_type:"lunch",base_kcal:570,protein:51,fat:31,carbs:21,food_cost:15,notes:"kurczak, kalafior, cukinia, curry, jogurt"},
  {name:"Pulpeciki z indyka z cukinią",meal_type:"lunch",base_kcal:555,protein:49,fat:29,carbs:20,food_cost:15.5,notes:"indyk, cukinia, pomidor, brokuł"},
  {name:"Kurczak po śródziemnomorsku",meal_type:"lunch",base_kcal:565,protein:50,fat:30,carbs:23,food_cost:15,notes:"kurczak, cukinia, papryka, pomidor, feta"},
  {name:"Dorsz z puree kalafiorowym",meal_type:"lunch",base_kcal:530,protein:48,fat:27,carbs:19,food_cost:17,notes:"dorsz, kalafior, brokuł, masło"},
  {name:"Wołowina z fasolką i papryką",meal_type:"lunch",base_kcal:585,protein:47,fat:34,carbs:22,food_cost:19,notes:"wołowina, fasolka, papryka, cukinia"},
  {name:"Indyk w sosie pieczarkowym z brokułem",meal_type:"lunch",base_kcal:560,protein:51,fat:30,carbs:18,food_cost:16,notes:"indyk, pieczarki, brokuł, jogurt"},
  {name:"Kurczak caprese z cukinią",meal_type:"lunch",base_kcal:575,protein:52,fat:32,carbs:18,food_cost:16,notes:"kurczak, mozzarella, pomidor, cukinia"},
  {name:"Schab z kapustą i fasolką",meal_type:"lunch",base_kcal:580,protein:49,fat:34,carbs:20,food_cost:16.5,notes:"schab, kapusta, fasolka szparagowa"},
  {name:"Kurczak z warzywami stir-fry",meal_type:"lunch",base_kcal:550,protein:50,fat:27,carbs:25,food_cost:14.5,notes:"kurczak, brokuł, papryka, cukinia, sezam"},

  // KOLACJE
  {name:"Sałatka z kurczakiem i fetą",meal_type:"dinner",base_kcal:400,protein:36,fat:23,carbs:17,food_cost:12,notes:"kurczak, feta, sałata, pomidor, ogórek"},
  {name:"Omlet warzywny z mozzarellą",meal_type:"dinner",base_kcal:410,protein:31,fat:27,carbs:14,food_cost:10,notes:"jajka, mozzarella, szpinak, pieczarki"},
  {name:"Twaróg z warzywami i pestkami",meal_type:"dinner",base_kcal:390,protein:34,fat:22,carbs:16,food_cost:9,notes:"twaróg, warzywa, pestki dyni"},
  {name:"Sałatka z tuńczykiem i jajkiem",meal_type:"dinner",base_kcal:405,protein:38,fat:24,carbs:13,food_cost:12.5,notes:"tuńczyk, jajko, sałata, ogórek, pomidor"},
  {name:"Sałatka grecka z kurczakiem",meal_type:"dinner",base_kcal:420,protein:37,fat:26,carbs:16,food_cost:12.5,notes:"kurczak, feta, ogórek, pomidor, oliwki"},
  {name:"Cukinia faszerowana indykiem",meal_type:"dinner",base_kcal:415,protein:39,fat:24,carbs:15,food_cost:12,notes:"cukinia, indyk, pomidor, mozzarella"},
  {name:"Jajka z łososiem i sałatą",meal_type:"dinner",base_kcal:430,protein:32,fat:30,carbs:10,food_cost:15,notes:"jajka, łosoś, sałata, ogórek"},
  {name:"Kurczak z tzatziki i warzywami",meal_type:"dinner",base_kcal:410,protein:40,fat:22,carbs:15,food_cost:11.5,notes:"kurczak, jogurt, ogórek, sałata, pomidor"}
 ];
 async function seedLowCarbRecipes(){
   if(busy)return;
   setBusy(true);setMsg("Dodaję receptury Low Carb…");
   const existing=new Set(recipes.filter(r=>r.diet_type==="Low Carb").map(r=>r.name.toLowerCase()));
   const rows=LOW_CARB_STARTER.filter(r=>!existing.has(r.name.toLowerCase())).map(r=>({...r,diet_type:"Low Carb",active:true}));
   if(!rows.length){setBusy(false);setMsg("Receptury Low Carb są już w bazie ✓");return}
   const {error}=await supabase.from("recipes").insert(rows);
   setBusy(false);
   if(error)return setMsg("Błąd dodawania Low Carb: "+error.message);
   setMsg(`Dodano ${rows.length} receptur Low Carb ✓`);
   await load();
 }
 async function addRecipe(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);const f=new FormData(e.currentTarget);const payload={name:String(f.get("name")),meal_type:String(f.get("meal_type")),diet_type:String(f.get("diet_type")||"Standard"),base_kcal:Number(f.get("base_kcal")),protein:Number(f.get("protein")),fat:Number(f.get("fat")),carbs:Number(f.get("carbs")),food_cost:Number(f.get("food_cost")),notes:String(f.get("notes")||"")||null,active:true};const{error}=await supabase.from("recipes").insert(payload);setBusy(false);if(error)return setMsg("Błąd receptury: "+error.message);e.currentTarget.reset();setMsg("Receptura dodana ✓");await load()}

 // Ile składników z nadmiaru zawiera receptura — liczone po powiązaniach
 // i po opisie, bo część receptur ma składniki tylko w notatce.
 // Szukanie składnika wybacza odmianę: „udo" znajduje „udka z kurczaka",
 // „pomidor" znajduje „pomidory". Porównujemy bez polskich znaków.
 const bezOgonkow=(v:string)=>String(v??"").toLowerCase().replace(/ł/g,"l").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 const pasuje=(nazwa:string,szukane:string,luzno=false)=>{
   const n=bezOgonkow(nazwa), q=bezOgonkow(szukane).trim();
   if(!q)return true;
   if(n.includes(q))return true;
   const dl=luzno?Math.max(2,q.length-2):Math.max(3,q.length-2);
   const rdzen=q.slice(0,dl);
   return n.split(/[^a-z0-9]+/).some(w=>w.startsWith(rdzen));
 };

 /**
  * Wszystkie hasła, jakimi kuchnia może oznaczyć nadmiar — pozycje z bazy
  * składników ORAZ nazwy wyłuskane z opisów receptur. Bez tego drugiego
  * źródła nie dało się zaznaczyć czegoś, co występuje tylko w notatce dania.
  */
 const hasla=useMemo(()=>{
   const mapa=new Map<string,{nazwa:string;wDaniach:number}>();
   const dodaj=(n:string)=>{
     const czyste=String(n||"").trim().replace(/\s+/g," ");
     if(czyste.length<3)return;
     const k=bezOgonkow(czyste);
     if(!mapa.has(k))mapa.set(k,{nazwa:czyste,wDaniach:0});
   };
   for(const i of ingredients)dodaj(i.name);
   for(const r of recipes as any[]){
     for(const cz of String(r?.notes||"").split(","))dodaj(cz);
     for(const ri of (r?.recipe_ingredients||[]))dodaj(ri?.ingredients?.name);
   }
   // policz, w ilu recepturach występuje każde hasło
   for(const [k,v] of mapa){
     v.wDaniach=(recipes as any[]).filter(r=>{
       const txt=bezOgonkow(`${r?.name||""} ${r?.notes||""}`);
       const lin=(r?.recipe_ingredients||[]).map((x:any)=>bezOgonkow(x?.ingredients?.name||"")).join(" ");
       return txt.includes(k)||lin.includes(k);
     }).length;
   }
   return [...mapa.values()].sort((a,b)=>b.wDaniach-a.wDaniach||a.nazwa.localeCompare(b.nazwa,"pl"));
 },[ingredients,recipes]);

 const jestNadmiarem=(nazwa:string)=>nadmiary.includes(bezOgonkow(nazwa));

/**
  * Własne hasło nadmiaru. Podpowiedzi powstają ze składników i opisów receptur,
  * więc są tam całe zwroty w rodzaju „puree z kalafiora", a nie samo „puree".
  * Tu kuchnia dopisuje to, czego akurat ma dużo.
  */
 async function dodajWlasneHaslo(){
   const czyste=noweHaslo.trim().replace(/\s+/g," ");
   if(czyste.length<3)return setMsg("Hasło musi mieć co najmniej 3 znaki.");
   const klucz=bezOgonkow(czyste);
   if(nadmiary.includes(klucz)){setNoweHaslo("");return setMsg("To hasło jest już zaznaczone.");}
   setBusy(true);
   try{
     const {error}=await supabase.from("surplus_terms").insert({term:klucz});
     if(error){setMsg("Nie mogę dodać hasła: "+error.message);return;}
     setNadmiary(l=>[...l,klucz]);
     setNoweHaslo("");
     const ile=(recipes as any[]).filter(r=>{
       const txt=bezOgonkow(`${r?.name||""} ${r?.notes||""}`);
       const lin=(r?.recipe_ingredients||[]).map((x:any)=>bezOgonkow(x?.ingredients?.name||"")).join(" ");
       return txt.includes(klucz)||lin.includes(klucz);
     }).length;
     setMsg(ile?`Dodano „${czyste}" — pasuje do ${ile} ${ile===1?"dania":"dań"}.`
               :`Dodano „${czyste}", ale na razie nie pasuje do żadnego dania.`);
   }finally{ setBusy(false); }
 }

 async function przelaczNadmiar(nazwa:string,wlacz:boolean){
   const term=bezOgonkow(nazwa);
   const {error}=wlacz
     ? await supabase.from("surplus_terms").insert({term})
     : await supabase.from("surplus_terms").delete().eq("term",term);
   if(error)return setMsg("Nie mogę zapisać nadmiaru: "+error.message);
   setNadmiary(l=>wlacz?[...new Set([...l,term])]:l.filter(x=>x!==term));
   setMsg(wlacz?`Oznaczono nadmiar: ${nazwa} ✓`:`Nadmiar zdjęty: ${nazwa} ✓`);
 }

 const surplusScore=(r:any)=>{
  if(!nadmiary.length)return 0;
  const txt=bezOgonkow(`${r?.name||""} ${r?.notes||""}`);
  const lin=(r?.recipe_ingredients||[]).map((x:any)=>bezOgonkow(x?.ingredients?.name||"")).join(" ");
  return nadmiary.filter(n=>txt.includes(n)||lin.includes(n)).length;
 };

 /**
  * Przelicza JEDEN dzień pod zaznaczone nadmiary. Dla każdego posiłku szuka
  * receptury, która zużywa więcej nadmiarowych składników niż obecna.
  * Nie rusza dni, w których nic lepszego nie znajdzie.
  */
 /** Klienci z liczbą etykiet przypadających na dzień produkcji. */
 const klienciDnia=useMemo(()=>{
   const mapa=new Map<string,{nazwa:string;etykiet:number;dieta:string;kcal:number}>();
   for(const d of actualDiets as any[]){
     const rows=rowsForDiet(menuRowsForDiet(productionDay,d.dietType),d);
     const szt=rows.length*Math.max(1,Number(d.portions||1));
     if(!szt)continue;
     const k=d.client_name||"Klient";
     const p=mapa.get(k);
     if(p)p.etykiet+=szt;
     else mapa.set(k,{nazwa:k,etykiet:szt,dieta:d.dietType,kcal:Number(d.kcal)});
   }
   return [...mapa.values()].sort((a,b)=>a.nazwa.localeCompare(b.nazwa,"pl"));
 },[actualDiets,menu,productionDay]);

 /**
  * Eksport etykiet do pliku CSV dla aplikacji NIIMBOT.
  * Szablon projektuje się raz, pola podpina do kolumn i drukuje
  * cały dzień jednym poleceniem. Jeden wiersz = jedna naklejka.
  */
 async function eksportEtykietCsv(klient?:string){
   const wiersze:string[][]=[["Klient","Posilek","Danie","Dieta","Kcal","Data","Wykluczenia"]];
   const diety=await swiezeDietyNaProdukcje();
   for(const d of diety as any[]){
     if(klient&&d.client_name!==klient)continue;
     const rows=rowsForDiet(menuRowsForDiet(productionDay,d.dietType),d);
     for(const row of rows){
       // Nie każda pozycja ma policzone wykluczenia — liczymy je, gdy brak.
       const flagi=d.flags||detectRestrictions(d.diet_name,d.notes,d.clients?.kitchen_notes);
       const g={dietType:d.dietType,kcal:Number(d.kcal),flags:flagi,count:d.portions,mealCount:d.mealCount};
       const r=recipeForProduction(row,g);
       const nazwaPosilku=MEALS.find((x:any)=>x[0]===row.meal_type)?.[1]||row.meal_type;
       for(let i=0;i<Math.max(1,Number(d.portions||1));i++){
         wiersze.push([
           d.client_name||"Klient",
           nazwaPosilku,
           r?.name||"Brak receptury",
           d.dietType,
           String(d.kcal),
           plDate(productionDay),
           flagi?.length?flagi.join(" / "):"Bez wykluczen"
         ]);
       }
     }
   }
   if(wiersze.length<2)return setMsg("Brak etykiet do eksportu — sprawdź, czy menu na ten dzień jest ułożone.");

   const esc=(v:string)=>`"${String(v).replace(/"/g,'""')}"`;
   // Średnik i BOM — Excel oraz aplikacja NIIMBOT poprawnie czytają polskie znaki.
   const csv="\uFEFF"+wiersze.map(w=>w.map(esc).join(";")).join("\r\n");
   const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
   const url=URL.createObjectURL(blob);
   const a2=document.createElement("a");
   a2.href=url;
   a2.download=`etykiety-${productionDay}${klient?"-"+klient.replace(/[^a-zA-Z0-9]+/g,"-"):""}.csv`;
   document.body.appendChild(a2); a2.click(); a2.remove();
   setTimeout(()=>URL.revokeObjectURL(url),400);
   setMsg(`Wyeksportowano ${wiersze.length-1} etykiet do pliku CSV. Wczytaj go w aplikacji NIIMBOT.`);
 }

 /**
  * Etykiety jako pliki PNG — do wgrania w aplikacji Niimbota.
  * Drukarka łączy się przez Bluetooth i nie widać jej w oknie drukowania.
  */
 /**
  * Świeża lista diet prosto z bazy.
  * Etykiety brały wcześniej listę wczytaną przy wejściu na stronę — przy
  * zakładce otwartej od rana trafiały tam diety zakończone w międzyczasie.
  */
 async function swiezeDietyNaProdukcje(){
   const {data,error}=await supabase.from("diets")
     .select("id,client_id,client_name,diet_name,kcal,bags,meal_count,start_date,end_date,delivery_weekdays,notes,archived,kitchen_status,clients(kitchen_notes)")
     .eq("archived",false).order("id");
   if(error)throw new Error("Nie mogę wczytać aktualnych diet: "+error.message);
   const lista=dietsForProductionDay(data||[]);
   setActualDiets(lista);
   setOstatniaAktualizacja(new Date());
   return lista;
 }

 /** Zbiera etykiety na dzień produkcji — wspólne dla wszystkich formatów. */
 function zbierzEtykiety(klient?:string,diety?:any[]):DaneEtykiety[]{
   const lista:DaneEtykiety[]=[];
   for(const d of (diety||actualDiets) as any[]){
     if(klient&&d.client_name!==klient)continue;
     const rows=rowsForDiet(menuRowsForDiet(productionDay,d.dietType),d);
     for(const row of rows){
       const flagi=d.flags||detectRestrictions(d.diet_name,d.notes,d.clients?.kitchen_notes);
       const g={dietType:d.dietType,kcal:Number(d.kcal),flags:flagi,count:d.portions,mealCount:d.mealCount};
       const r=recipeForProduction(row,g);
       const nazwaPosilku=MEALS.find((x:any)=>x[0]===row.meal_type)?.[1]||row.meal_type;

       // Kaloryczność TEGO posiłku, nie całego dnia.
       const kcalPosilku=Math.round(Number(d.kcal)*normalizedShareForDiet(row.meal_type,d,rows));
       // Skład malejąco według masy — tak wymaga rozporządzenie o znakowaniu.
       const powiazane=r
         ? ingredientsForRecipe(r)
             .slice()
             .sort((x:any,y:any)=>Number(y?.grams||0)-Number(x?.grams||0))
             .map((x:any)=>String(x?.ingredients?.name||"").trim())
             .filter(Boolean)
         : [];
       // Receptury bez powiązanych składników mają skład tylko w opisie.
       // Bez tego zapasu naklejka wychodziłaby z pustym składem — a to
       // informacja dla klienta, nie wewnętrzna notatka.
       const sklad=powiazane.length
         ? powiazane
         : String(r?.notes||"").split(",").map((x:string)=>x.trim()).filter(Boolean);

       for(let i=0;i<Math.max(1,Number(d.portions||1));i++){
         lista.push({
           klient:d.client_name||"Klient",
           posilek:nazwaPosilku,
           danie:r?.name||"⚠ BRAK BEZPIECZNEJ RECEPTURY — NIE WYDAWAĆ",
           dieta:d.dietType,
           kcal:Number(d.kcal),
           kcalPosilku,
           sklad,
           liczbaPosilkow:Number(d.mealCount)||4,
           data:plDate(productionDay),
           wykluczenia:flagi||[],
           alergeny:allergensInDish(r?.name,r?.notes,(r?.recipe_ingredients||[]).map((x:any)=>x?.ingredients?.name).join(" "))
         });
       }
     }
   }
   return lista;
 }

 /**
  * Kontrola przed drukiem: czy kaloryczności posiłków sumują się
  * do kaloryczności diety. Rozjazd oznacza, że któryś ekran liczy
  * inaczej niż naklejka — a klient czyta to, co na pudełku.
  */
 const kontrolaKcal=useMemo(()=>{
   const out:{klient:string;dieta:string;kcalDiety:number;suma:number;posilki:{nazwa:string;kcal:number}[]}[]=[];
   for(const d of actualDiets as any[]){
     const rows=rowsForDiet(menuRowsForDiet(productionDay,d.dietType),d);
     if(!rows.length)continue;
     const posilki=rows.map((row:any)=>({
       nazwa:MEALS.find((x:any)=>x[0]===row.meal_type)?.[1]||row.meal_type,
       kcal:Math.round(Number(d.kcal)*normalizedShareForDiet(row.meal_type,d,rows))
     }));
     out.push({
       klient:d.client_name||"Klient",
       dieta:d.dietType,
       kcalDiety:Number(d.kcal),
       suma:posilki.reduce((s2,p)=>s2+p.kcal,0),
       posilki
     });
   }
   return out;
 },[actualDiets,menu,productionDay]);

 async function etykietyWFormacie(format:"pdf"|"xlsx",klient?:string){
   if(busy)return;
   setBusy(true);
   try{
     setMsg("Wczytuję aktualne diety…");
     const diety=await swiezeDietyNaProdukcje();
     const lista=zbierzEtykiety(klient,diety);
     if(!lista.length){setMsg(`Brak diet do etykiet na ${plDate(productionDay)} — sprawdź, czy menu jest ułożone.`);return;}
     const sufiks=klient?"-"+klient.replace(/[^a-zA-Z0-9]+/g,"-"):"";
     const n=format==="pdf"
       ? await pobierzEtykietyPdf(lista,`etykiety-${productionDay}${sufiks}.pdf`)
       : await pobierzEtykietyXlsx(lista,`etykiety-${productionDay}${sufiks}.xlsx`);
     setMsg(`Gotowe: ${n} ${n===1?"etykieta":"etykiet"} w pliku ${format.toUpperCase()}. Przerzuć na telefon i otwórz w aplikacji NIIMBOT.`);
   }catch(e:any){
     setMsg("Nie udało się wygenerować pliku: "+(e?.message||"nieznany błąd"));
   }finally{ setBusy(false); }
 }

 /** Etykiety jako pliki PNG — do wstawienia jako obrazek w aplikacji. */
 async function pobierzEtykietyKlienta(klient?:string){
   if(busy)return;
   setBusy(true);
   try{
     setMsg("Wczytuję aktualne diety…");
     const diety=await swiezeDietyNaProdukcje();
     const lista=zbierzEtykiety(klient,diety);
     if(!lista.length){setMsg(`Brak diet do etykiet na ${plDate(productionDay)} — sprawdź, czy menu jest ułożone.`);return;}
     const n=await pobierzEtykiety(lista);
     setMsg(`Pobrano ${n} ${n===1?"etykietę":"etykiet"}${klient?` dla ${klient}`:""}.`);
   }catch(e:any){
     setMsg("Nie udało się wygenerować etykiet: "+(e?.message||"nieznany błąd"));
   }finally{ setBusy(false); }
 }

 /** Przebudowuje jeden dzień, nie ruszając reszty tygodnia. */
 async function zmienDzien(date:string){
   if(busy)return;
   const wTygodniu=(menu as any[]).filter(x=>x.diet_type==="Standard");
   if(!wTygodniu.some(x=>x.menu_date===date))
     return setMsg(`Na ${plDate(date)} nie ma jeszcze ułożonego menu.`);

   // Pamięć poprzednich tygodni — żeby nie podstawić czegoś, co było niedawno.
   const odDnia=new Date(date+"T12:00:00");odDnia.setDate(odDnia.getDate()-DNI_PAMIECI);
   const {data:wczesniej}=await supabase.from("weekly_menu")
     .select("recipe_id,menu_date").gte("menu_date",iso(odDnia)).lt("menu_date",weekStart);
   const ostatnio=new Map<number,string>();
   for(const w of (wczesniej||[]) as any[]){
     const prev=ostatnio.get(w.recipe_id);
     if(!prev||w.menu_date>prev)ostatnio.set(w.recipe_id,w.menu_date);
   }

   const {rows,bezZmian}=ulozDzien({
     recipes:recipes as any[],data:date,
     tydzien:wTygodniu.map(x=>({menu_date:x.menu_date,meal_type:x.meal_type,recipe_id:x.recipe_id})),
     ostatnioUzyte:ostatnio,surplusScore
   });

   const nazwa=(id:number)=>(recipes as any[]).find(r=>r.id===id)?.name||"—";
   const zmiany=rows.filter(r=>{
     const stare=wTygodniu.find(x=>x.menu_date===date&&x.meal_type===r.meal_type);
     return stare&&Number(stare.recipe_id)!==Number(r.recipe_id);
   });
   if(!zmiany.length)return setMsg(`Nie ma czym podmienić ${plDate(date)} — za mała baza receptur.`);

   const opis=zmiany.map(z=>{
     const stare=wTygodniu.find(x=>x.menu_date===date&&x.meal_type===z.meal_type);
     const etykieta=MEALS.find(m=>m[0]===z.meal_type)?.[1]||z.meal_type;
     return `• ${etykieta}: ${nazwa(Number(stare?.recipe_id))} → ${nazwa(z.recipe_id)}`;
   }).join("\n");
   const uwaga=bezZmian.length?`\n\nBez zmian: ${bezZmian.length} ${bezZmian.length===1?"posiłek":"posiłki"} — brak innych receptur w tym slocie.`:"";
   if(!confirm(`Zmienić menu na ${plDate(date)}?\n\n${opis}${uwaga}`))return;

   setBusy(true);
   try{
     for(const r of rows){
       const stare=wTygodniu.find(x=>x.menu_date===date&&x.meal_type===r.meal_type);
       if(!stare||Number(stare.recipe_id)===Number(r.recipe_id))continue;
       const {error}=await supabase.from("weekly_menu").update({recipe_id:r.recipe_id}).eq("id",stare.id);
       if(error){setMsg("Błąd podmiany: "+error.message);return;}
     }
     await load();
     setMsg(`Zmieniono menu na ${plDate(date)} — ${zmiany.length} ${zmiany.length===1?"danie":"dania"} ✓`);
   }finally{ setBusy(false); }
 }

 async function przeliczDzienPodNadmiary(date:string){
  if(busy)return;
  const nad=ingredients.filter(i=>i.surplus);
  if(!nad.length)return setMsg("Najpierw zaznacz w sekcji Mamy nadmiar, czego masz dużo.");

  const wiersze=(menu as any[]).filter(x=>x.menu_date===date&&x.diet_type==="Standard");
  if(!wiersze.length)return setMsg(`Na ${plDate(date)} nie ma jeszcze ułożonego menu.`);

  const zmiany:{id:number;recipe_id:number;z:string;na:string;slot:string}[]=[];
  const zajete=new Set<number>(wiersze.map(w=>w.recipe_id));

  for(const w of wiersze){
    const obecna=(recipes as any[]).find(r=>r.id===w.recipe_id);
    const teraz=obecna?surplusScore(obecna):0;
    const kandydaci=(recipes as any[])
      .filter(r=>r.diet_type==="Standard"&&r.meal_type===w.meal_type&&r.id!==w.recipe_id&&!zajete.has(r.id))
      .map(r=>({r,pkt:surplusScore(r)}))
      .filter(x=>x.pkt>teraz)
      .sort((a,b)=>b.pkt-a.pkt||Number(a.r.food_cost)-Number(b.r.food_cost));
    if(!kandydaci.length)continue;
    const wybrana=kandydaci[0].r;
    zajete.add(wybrana.id);
    zmiany.push({id:w.id,recipe_id:wybrana.id,z:obecna?.name||"—",na:wybrana.name,slot:w.meal_type});
  }

  if(!zmiany.length)return setMsg("Obecne menu już najlepiej wykorzystuje zaznaczone nadmiary.");

  const opis=zmiany.map(z=>`• ${z.z} → ${z.na}`).join("\n");
  if(!confirm(`Podmienić ${zmiany.length} ${zmiany.length===1?"danie":"dania"} na ${plDate(date)}?\n\n${opis}`))return;

  setBusy(true);
  for(const z of zmiany){
    const {error}=await supabase.from("weekly_menu").update({recipe_id:z.recipe_id}).eq("id",z.id);
    if(error){setBusy(false);return setMsg("Błąd podmiany: "+error.message);}
  }
  await load();
  setBusy(false);
  setMsg(`Przeliczono ${plDate(date)} — podmieniono ${zmiany.length} ${zmiany.length===1?"danie":"dania"} ✓`);
 }

 async function generateWeek(){
  if(busy)return;
  const standardRecipes=recipes.filter(r=>r.diet_type==="Standard");
  if(!standardRecipes.length)return setMsg("Brak receptur Standard — nie da się ułożyć wspólnej bazy.");
  setBusy(true);setMsg("Układam menu, sprawdzam poprzednie tygodnie…");
  try{
    const start=new Date(weekStart+"T12:00:00");
    const koniec=new Date(start);koniec.setDate(start.getDate()+6);

    // Pamięć poprzednich tygodni — bez niej co tydzień wypadały te same dania.
    const odDnia=new Date(start);odDnia.setDate(start.getDate()-DNI_PAMIECI);
    const {data:wczesniej,error:eHist}=await supabase.from("weekly_menu")
      .select("recipe_id,menu_date").gte("menu_date",iso(odDnia)).lt("menu_date",weekStart);
    if(eHist){setMsg("Nie mogę odczytać poprzednich tygodni: "+eHist.message);return;}
    const ostatnio=new Map<number,string>();
    for(const w of (wczesniej||[]) as any[]){
      const prev=ostatnio.get(w.recipe_id);
      if(!prev||w.menu_date>prev)ostatnio.set(w.recipe_id,w.menu_date);
    }

    const {rows,powtorki,zaMalaBaza}=ulozTydzien({
      recipes:recipes as any[],startIso:weekStart,ostatnioUzyte:ostatnio,surplusScore
    });
    if(!rows.length){setMsg("Nie udało się ułożyć menu.");return;}

    // Baza dopuszcza jeden wpis na dzień i typ posiłku.
    const klucze=new Set(rows.map(r=>`${r.menu_date}|${r.meal_type}`));
    if(klucze.size!==rows.length){setMsg("Wykryto zdublowane posiłki — przerwano zapis.");return;}

    const del=await supabase.from("weekly_menu").delete().gte("menu_date",weekStart).lte("menu_date",iso(koniec));
    if(del.error){setMsg("Błąd czyszczenia menu: "+del.error.message);return;}
    const ins=await supabase.from("weekly_menu").insert(rows);
    if(ins.error){setMsg("Błąd zapisu menu: "+ins.error.message);return;}

    let info=`Menu ułożone ✓ ${rows.length} pozycji`;
    if(!powtorki.length)info+=" — żadne danie nie powtarza się z ostatnich dwóch tygodni.";
    else info+=` — ${powtorki.length} ${powtorki.length===1?"danie musiało się powtórzyć":"dań musiało się powtórzyć"} z poprzednich tygodni.`;
    if(zaMalaBaza.length){
      const nazwy:Record<string,string>={breakfast:"śniadania",second_breakfast:"II posiłki",lunch:"obiady",snack:"podwieczorki",dinner:"kolacje"};
      info+=" Za mało receptur: "+zaMalaBaza.map(z=>`${nazwy[z.slot]||z.slot} ${z.ma}/${z.potrzeba}`).join(", ")+".";
    }
    setMsg(info);
    await load();
  }catch(err:any){setMsg("Błąd układania tygodnia: "+(err?.message||"nieznany błąd"));}
  finally{setBusy(false);}
 }

 function printGramatures(){
   if(!menu.length){setMsg("Najpierw ułóż tydzień — brak menu do rozpiski gramatur.");return;}
   const kcals=[1200,1300,1400,1500,1600,1800,2000,2100,2200,2500,3000];
   // korzysta ze wspólnej tabeli — dawniej była tu czwarta kopia proporcji
   const mealShare=(mealType:string,dietType:string)=>mealShareWspolna(mealType,dietType);
   const rows=menu.map((x:any)=>{
     const r=x.recipes||{};
     const ingredients=r.recipe_ingredients||[];
     const kcalBlocks=kcals.map(k=>{
       const dayDietRows=menu.filter((m:any)=>m.menu_date===x.menu_date&&m.diet_type===x.diet_type);
       const rawTotal=dayDietRows.reduce((sum:number,m:any)=>sum+mealShare(m.meal_type,m.diet_type),0)||1;
       const target=Math.round(k*(mealShare(x.meal_type,x.diet_type)/rawTotal));
       const factor=target/Math.max(1,Number(r.base_kcal||target));
       const grams=ingredients.map((ri:any)=>`${ri.ingredients?.name||"Składnik"}: ${(Number(ri.grams)*factor).toFixed(0)} ${ri.ingredients?.unit||"g"}`).join("<br>");
       return `<td><b>${target} kcal</b><br>${grams||"Brak składników"}</td>`;
     }).join("");
     return `<tr><td><b>${x.menu_date}</b><br>${x.diet_type}<br>${MEALS.find(m=>m[0]===x.meal_type)?.[1]||x.meal_type}<br><strong>${r.name||"Brak receptury"}</strong></td>${kcalBlocks}</tr>`;
   }).join("");
   const w=window.open("","_blank"); if(!w)return setMsg("Przeglądarka zablokowała okno PDF.");
   w.document.write(`<!doctype html><html><head><title>Gramatury diet</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;font-size:9px}h1{font-size:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:5px;vertical-align:top}th{background:#eee}td:first-child{width:145px}b,strong{font-size:10px}</style></head><body><h1>Dzika Kaczka Catering — gramatury według kaloryczności</h1><p>Tydzień od ${weekStart}. Gramatury są przeliczone proporcjonalnie z receptury bazowej.</p><table><thead><tr><th>Dzień / dieta / posiłek</th>${kcals.map(k=>`<th>${k} kcal</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
   w.document.close();
 }

 function shiftWeek(days:number){const d=new Date(weekStart+"T12:00:00");d.setDate(d.getDate()+days);setWeekStart(iso(d))}
 if(loading)return <main><section className="card"><h2>Ładowanie menu…</h2></section></main>; if(!profile)return <main><section className="card"><h2>Zaloguj się w panelu głównym</h2><a href="/panel"><button className="primary">Do logowania</button></a></section></main>;
 return <main className="menuPage"><header><div><h1>🍽️ Menu i produkcja v8.4.3</h1><p className="muted">{profile.full_name||"Użytkownik"} · {profile.role}</p></div><div className="actions"><a href="/panel"><button>← Panel</button></a><button onClick={load}>↻ Odśwież</button></div></header>{msg&&<div className="toast">{msg}</div>}
  <section className="card tomorrowPrep">
   <div className="row">
     <div>
       <h2>📅 Jutro — przygotowanie kuchni</h2>
       <p className="muted">{plDate(tomorrowIso())} · {tomorrowDiets.length} diet klientów</p>
     </div>
   </div>

   {!tomorrowDiets.length&&<p className="muted">Brak aktywnych diet na jutro.</p>}

   {!!tomorrowDiets.length&&<div className="tomorrowGrid">
     {tomorrowDiets.map((d:any)=><div className="tomorrowRow" key={`tom-${d.id}`}>
       <b>{d.client_name}</b>
       <span>{d.dietType} · {d.kcal} kcal · {d.mealCount} posiłki · {d.portions} porcja</span>
       <span>{d.flags.length?d.flags.join(" / "):"bez wykluczeń"}</span>
     </div>)}
   </div>}
 </section>

<section className="card realProduction">
   <div className="row">
     <div>
       <h2>👨‍🍳 Produkcja kuchni — każda dieta osobno</h2><p className="lowCarbBaseNote">Low Carb korzysta z menu bazowego Standard na dany dzień — kuchnia nie układa osobnego menu, tylko dostaje wariant i gramaturę.</p>
       <p className="muted">{plDate(productionDay)} · każda aktywna dieta klienta osobno · auto-odświeżanie co 30 s</p>
     </div>
     <div className="productionSummary">
       <b>{productionDiets.length} diet</b>
       <span>{productionDiets.reduce((sum:any,d:any)=>sum+d.portions,0)} porcji</span>
       <button type="button" onClick={()=>refreshActualDiets(true)}>↻ Odśwież diety</button>
       <button type="button" className="primary" onClick={()=>printLabels50x30()}>🏷️ Drukuj wszystkie etykiety</button>
     </div>
   </div>

   {!productionDiets.length&&<p className="muted">Brak aktywnych diet do produkcji na ten dzień.</p>}

   <div className="realDietGroups">
     {productionDiets.map((d:any)=>{
       const rows=rowsForDiet(menuRowsForDiet(productionDay,d.dietType),d);
       const planned=rows.length?Number(d.kcal):0;
       return <div className="realDietCard" key={d.id}>
         <div className="realDietHead">
           <div>
             <h3>{d.client_name||"Klient"} — {d.dietType} {d.kcal} kcal {d.flags.length?`— ${d.flags.join(" / ")}`:""}</h3>
             <p className="muted">
               {d.portions} {d.portions===1?"porcja":"porcji"} · {d.mealCount} posiłki · dieta: <b>{d.diet_name||d.dietType}</b> · plan dnia: <b>{planned} kcal</b>
             </p>
           </div>
         </div>

         {rows.map((row:any)=>{
           // Nie każda pozycja ma policzone wykluczenia — liczymy je, gdy brak.
       const flagi=d.flags||detectRestrictions(d.diet_name,d.notes,d.clients?.kitchen_notes);
       const g={dietType:d.dietType,kcal:Number(d.kcal),flags:flagi,count:d.portions,mealCount:d.mealCount};
           const r=recipeForProduction(row,g);
           if(!r)return <div className="realMeal blockedMeal" key={row.id}>
             <b>{MEALS.find(x=>x[0]===row.meal_type)?.[1]||row.meal_type}</b>
             <p>⚠️ Brak bezpiecznej receptury dla tej konkretnej diety.</p>
           </div>;
           const target=Math.round(Number(d.kcal)*normalizedShareForDiet(row.meal_type,d,rows));
           const factor=target/Math.max(1,Number(r.base_kcal||target));
           return <div className="realMeal" key={row.id}>
             <div className="realMealTitle">
               <div>
                 <b>{MEALS.find(x=>x[0]===row.meal_type)?.[1]||row.meal_type}</b>
                 <h4>{r.name}</h4>
               </div>
               <strong>{target} kcal</strong>
             </div>
             <table className="prodTable">
               <thead><tr><th>Składnik</th><th>Gramatura na 1 porcję</th></tr></thead>
               <tbody>
                 {ingredientsForRecipe(r).map((ri:any)=><tr key={`${r.id}-${ri.ingredients?.id}`}>
                   <td>{ri.ingredients?.name||"Składnik"}</td>
                   <td><b>{fmtG(Number(ri.grams||0)*factor)}</b></td>
                 </tr>)}
               </tbody>
             </table>
           </div>
         })}

         {!rows.length&&<p className="muted">Brak menu bazowego Standard na {plDate(productionDay)} — ułóż menu dnia, a Low Carb zostanie wyliczony automatycznie.</p>}
       </div>
     })}
   </div>
 </section>

 <section className="card"><div className="row"><div><h2>📋 Podgląd bazowego menu</h2><p className="muted">{plDate(today)}</p></div><b>Food cost dnia: {totalCost.toFixed(2)} zł</b></div><div className="mealCards">{MEALS.map(([key,label])=>{const share=mealShareWspolna(key,"Standard")/100;const r=todayRows.find(x=>x.meal_type===key)?.recipes;return <div className="mealCard" key={key}><div className="mealLabel">{label}</div>{r?<><h3>{r.name}</h3><div className="macro"><span>{r.base_kcal} kcal</span><span>B {r.protein} g</span><span>T {r.fat} g</span><span>W {r.carbs} g</span></div><div className="muted">Koszt: {Number(r.food_cost).toFixed(2)} zł</div><details><summary>Warianty kaloryczne</summary>{kcalVariants.map(k=>{const target=Math.round(k*share),factor=target/Number(r.base_kcal||1);return <div className="scaleRow" key={k}><b>{k} kcal/dzień</b><span>posiłek {target} kcal</span><span>B {(Number(r.protein)*factor).toFixed(0)} · T {(Number(r.fat)*factor).toFixed(0)} · W {(Number(r.carbs)*factor).toFixed(0)} g</span></div>})}</details></>:<p className="muted">Brak receptury.</p>}</div>})}</div></section>
 <section className="card etykietyCard">
    <div className="row">
      <div>
        <small className="sekcjaEtykieta">PAKOWANIE</small>
        <h2>Etykiety klient po kliencie</h2>
        <div className="stanDanych">
          <span className="kropka" />
          {ostatniaAktualizacja
            ? `Dane aktualne na ${ostatniaAktualizacja.toLocaleTimeString("pl-PL",{hour:"2-digit",minute:"2-digit"})} · odświeża się samo`
            : "Wczytuję dane…"}
          <button type="button" onClick={()=>swiezeDietyNaProdukcje().catch(()=>{})} disabled={busy}>odśwież teraz</button>
        </div>
        <label className="dzienProdukcji">
          Dzień produkcji
          <input type="date" value={productionDay} onChange={e=>e.target.value&&ustawDzienProdukcji(e.target.value)}/>
          <span>ten sam co w panelu — zmiana tutaj zmienia go też tam</span>
        </label>
        <p className="muted">Aplikacja NIIMBOT na telefonie czyta PDF i Excel. W PDF każda strona to jedna gotowa naklejka — wystarczy otworzyć i drukować. Kliknięcie w klienta pobiera jego etykiety w PDF.</p>
      </div>
      <div className="etykietyAkcje">
        <button type="button" className="primary" disabled={busy} onClick={()=>etykietyWFormacie("pdf")}>📕 PDF — wszyscy</button>
        <button type="button" disabled={busy} onClick={()=>etykietyWFormacie("xlsx")}>📗 Excel — wszyscy</button>
        <button type="button" disabled={busy} onClick={()=>pobierzEtykietyKlienta()}>🖼️ Obrazki PNG</button>
        <button type="button" disabled={busy} onClick={()=>printLabels50x30()}>🖨️ Drukuj</button>
      </div>
    </div>

    {kontrolaKcal.length>0&&<details className="kontrolaKcal">
      <summary>
        Kontrola kalorii przed drukiem
        {kontrolaKcal.some(k=>Math.abs(k.suma-k.kcalDiety)>5)
          ? <b className="zleKcal">rozjazd w {kontrolaKcal.filter(k=>Math.abs(k.suma-k.kcalDiety)>5).length} dietach</b>
          : <b className="okKcal">wszystko się zgadza</b>}
      </summary>
      <table className="kontrolaTabela">
        <thead><tr><th>Klient</th><th>Dieta</th><th>Rozpisanie posiłków</th><th>Suma</th><th>Dieta</th></tr></thead>
        <tbody>
          {kontrolaKcal.map(k=>{
            const zle=Math.abs(k.suma-k.kcalDiety)>5;
            return <tr key={k.klient} className={zle?"zle":""}>
              <td><b>{k.klient}</b></td>
              <td>{k.dieta}</td>
              <td>{k.posilki.map(p=>`${p.nazwa} ${p.kcal}`).join(" · ")}</td>
              <td><b>{k.suma}</b></td>
              <td>{k.kcalDiety}</td>
            </tr>;
          })}
        </tbody>
      </table>
      <p className="muted">Różnica do 5 kcal wynika z zaokrągleń i jest w porządku. Większy rozjazd oznacza, że dieta ma przypisane posiłki, których nie ma w menu, albo odwrotnie.</p>
    </details>}

    {!klienciDnia.length
      ? <p className="muted">Brak diet na {plDate(productionDay)} albo menu nie jest jeszcze ułożone.</p>
      : <div className="klienciSiatka">
          {klienciDnia.map(k=>(
            <button type="button" key={k.nazwa} className="klientEtykieta" disabled={busy}
              onClick={()=>etykietyWFormacie("pdf",k.nazwa)}>
              <span className="klientNazwa">{k.nazwa}</span>
              <span className="klientOpis">{k.dieta} · {k.kcal} kcal</span>
              <span className="klientSzt">{k.etykiet} {k.etykiet===1?"naklejka":"naklejek"}</span>
            </button>
          ))}
        </div>}
 </section>

 <section className="card surplusCard">
    <div className="row">
      <div>
        <h2>📦 Mamy nadmiar</h2>
        <p className="muted">Zaznacz, czego masz dużo. Liczba obok hasła mówi, w ilu recepturach ono występuje. Układanie tygodnia i przeliczanie dnia w pierwszej kolejności wybiorą te dania.</p>
      </div>
      <div className="nadmiarNarzedzia"><input type="search" className="ingSearch" placeholder="Szukaj składnika" value={ingSearch} onChange={e=>setIngSearch(e.target.value)}/><div className="wlasneHaslo"><input type="text" value={noweHaslo} maxLength={40} placeholder="Własne hasło, np. puree" onChange={e=>setNoweHaslo(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();dodajWlasneHaslo();}}}/><button type="button" disabled={busy||noweHaslo.trim().length<3} onClick={dodajWlasneHaslo}>Dodaj</button></div></div>
    </div>

    {nadmiary.length>0&&<div className="surplusActive">
      {nadmiary.filter(n=>!hasla.some(h=>bezOgonkow(h.nazwa)===n)).map(n=>(<button type="button" key={"wlasne-"+n} className="surplusChip" disabled={busy} onClick={()=>przelaczNadmiar(n,false)} title="Kliknij, żeby zdjąć">{n} <span>własne</span> <b>×</b></button>))}
      {hasla.filter(h=>jestNadmiarem(h.nazwa)).map(h=>(
        <span key={h.nazwa} className="surplusChip">
          {h.nazwa} <small>· {h.wDaniach} {h.wDaniach===1?"danie":"dań"}</small>
          <button type="button" onClick={()=>przelaczNadmiar(h.nazwa,false)} aria-label={`Zdejmij nadmiar: ${h.nazwa}`}>×</button>
        </span>
      ))}
    </div>}

    <div className="surplusList">
      {(()=>{
        const q=ingSearch.trim();
        let lista=q?hasla.filter(h=>pasuje(h.nazwa,q)):hasla;
        if(q&&!lista.length)lista=hasla.filter(h=>pasuje(h.nazwa,q,true));
        if(!hasla.length)return <p className="muted">Brak składników i receptur w bazie.</p>;
        if(!lista.length)return <div className="surplusBrak">
          <p><b>Żadna receptura nie używa hasła „{ingSearch}".</b></p>
          <p>Możesz je oznaczyć mimo to, ale układanie tygodnia nic z tym nie zrobi,
             dopóki nie powstanie danie z tym składnikiem.</p>
          <button type="button" className="primary" onClick={()=>{przelaczNadmiar(ingSearch.trim(),true);setIngSearch("")}}>
            Oznacz „{ingSearch.trim()}" mimo to
          </button>
        </div>;
        return lista.slice(0,q?120:48).map(h=>(
          <label key={h.nazwa} className={`surplusItem ${jestNadmiarem(h.nazwa)?"on":""}`}>
            <input type="checkbox" checked={jestNadmiarem(h.nazwa)} onChange={e=>przelaczNadmiar(h.nazwa,e.target.checked)}/>
            <span>{h.nazwa}<small> · {h.wDaniach}</small></span>
          </label>
        ));
      })()}
    </div>
 </section>

 <section className="card"><div className="row"><div><h2>📅 Menu tygodniowe</h2><p className="muted">Preferuje tańsze receptury i nie powtarza ich w tygodniu, jeśli baza jest wystarczająco duża.</p></div>{(profile.role==="admin"||profile.role==="kitchen")&&<div className="actions"><button className="primary" onClick={generateWeek} disabled={busy}>✨ Ułóż ten tydzień</button><button onClick={()=>przeliczDzienPodNadmiary(productionDay)} disabled={busy}>♻️ Przelicz {plDate(productionDay)} pod nadmiary</button><button onClick={printGramatures}>🖨️ PDF gramatur — wszystkie kcal</button></div>}</div><div className="weekNav"><button onClick={()=>shiftWeek(-7)}>← poprzedni</button><b>Od {plDate(weekStart)}</b><button onClick={()=>shiftWeek(7)}>następny →</button></div><div className="dietWeekSections">{(["Standard"] as const).map(dt=><div key={dt}><h3>Wspólna baza · {SLOTY_MENU.length} posiłków/dzień</h3><p className="muted weekNote">Z tej bazy powstają wszystkie diety. Keto, Low Carb, bez laktozy i warianty z mniejszą liczbą posiłków system dobiera automatycznie przy produkcji — dlatego nie mają tu osobnych siatek.</p><div className="weekGrid">{[0,1,2,3,4,5,6].map(i=>{const d=new Date(weekStart+"T12:00:00");d.setDate(d.getDate()+i);const ds=iso(d);const rows=menu.filter(x=>x.menu_date===ds&&x.diet_type===dt);return <div className="dayCard" key={dt+ds}><div className="dayCardTop"><h3>{plDate(ds)}</h3>{(profile.role==="admin"||profile.role==="kitchen")&&rows.length>0&&<button type="button" className="zmienDzien" disabled={busy} onClick={()=>zmienDzien(ds)} title="Ułóż ten dzień od nowa">↻ Zmień</button>}</div>{rows.map(row=><div className="dayMeal" key={row.id}><b>{row.meal_type==="shake"?"🥤 Shake":MEALS.find(x=>x[0]===row.meal_type)?.[1]||row.meal_type}</b><span>{row.recipes?.name||"—"}</span><small>{row.recipes?`${row.recipes.base_kcal} kcal · ${Number(row.recipes.food_cost).toFixed(2)} zł`:""}</small></div>)}</div>})}</div></div>)}</div><p className="muted">Bazowy food cost tygodnia: <b>{weekCost.toFixed(2)} zł</b></p></section>
 {profile.role==="admin"&&<section className="card"><div className="row"><h2>➕ Dodaj recepturę</h2><span className="muted">Jedna baza receptur — Low Carb dobierane automatycznie</span></div><form className="grid" onSubmit={addRecipe}><label>Nazwa<input name="name" required/></label><label>Posiłek<select name="meal_type">{MEALS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label>Typ diety<select name="diet_type"><option>Standard</option><option>Keto</option><option>3 posiłki</option><option>Low Carb</option></select></label><label>kcal porcji<input name="base_kcal" type="number" min="50" required/></label><label>Białko g<input name="protein" type="number" step="0.1" min="0" required/></label><label>Tłuszcz g<input name="fat" type="number" step="0.1" min="0" required/></label><label>Węgle g<input name="carbs" type="number" step="0.1" min="0" required/></label><label>Food cost zł<input name="food_cost" type="number" step="0.01" min="0" required/></label><label>Uwagi<input name="notes"/></label><button className="primary" disabled={busy}>Dodaj recepturę</button></form><h3>Baza receptur ({recipes.length})</h3><p className="muted">Low Carb korzysta z tej samej bazy składników. System dobiera wariant z najmniejszą ilością węgli i największym pokryciem składników dnia.</p><div className="recipeList">{recipes.map(r=><div className="recipeRow" key={r.id}><div><b>{r.name}</b><div className="muted">{MEALS.find(x=>x[0]===r.meal_type)?.[1]} · {r.diet_type}</div></div><div>{r.base_kcal} kcal · B {r.protein} · T {r.fat} · W {r.carbs}</div><b>{Number(r.food_cost).toFixed(2)} zł</b></div>)}</div></section>}</main>}
