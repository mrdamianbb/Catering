export const ALLOWED_KCALS=[1200,1300,1400,1500,1600,1800,2000,2100,2200,2500,3000] as const;
export const ALLOWED_DIETS=["Standard","Keto","Low Carb","Bez glutenu","Vege"] as const;

export type OrderInput={
  customer_name:string; phone:string; email:string|null; street_address:string;
  postal_code:string; city:string; diet_name:string; kcal:number; start_date:string;
  days:number; saturday_delivery:boolean; sunday_delivery:boolean; notes:string|null;
  no_allergens:boolean; allergens:string|null;
  access_code_required:boolean; access_code:string|null;
  terms_accepted:boolean;
};
export type OrderField=keyof OrderInput;
export type OrderErrors=Partial<Record<OrderField,string>>;

const trim=(v:unknown,max:number)=>String(v??"").trim().slice(0,max);
export function localISODate(d=new Date()){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
export function normalizeOrder(v:any):OrderInput{
  return {
    customer_name:trim(v.customer_name,120),phone:trim(v.phone,40),email:trim(v.email,160)||null,
    street_address:trim(v.street_address,180),postal_code:trim(v.postal_code,20),city:trim(v.city,100),
    diet_name:trim(v.diet_name,50),kcal:Number(v.kcal),start_date:trim(v.start_date,20),days:Number(v.days),
    saturday_delivery:!!v.saturday_delivery,sunday_delivery:!!v.sunday_delivery,notes:trim(v.notes,500)||null,
    no_allergens:!!v.no_allergens,allergens:trim(v.allergens,300)||null,
    access_code_required:!!v.access_code_required,access_code:trim(v.access_code,120)||null,
    terms_accepted:!!v.terms_accepted
  };
}
export function validateOrder(o:OrderInput,today=localISODate()):OrderErrors{
  const e:OrderErrors={};
  if(o.customer_name.length<2)e.customer_name="Wpisz imię i nazwisko.";
  if(!/^[0-9+()\s-]{7,25}$/.test(o.phone))e.phone="Wpisz poprawny numer telefonu.";
  if(o.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email))e.email="Wpisz poprawny adres e-mail.";
  if(o.street_address.length<3)e.street_address="Wpisz ulicę i numer.";
  if(!/^\d{2}-\d{3}$/.test(o.postal_code))e.postal_code="Kod w formacie 00-000.";
  if(o.city.length<2)e.city="Wpisz miasto.";
  if(!(ALLOWED_DIETS as readonly string[]).includes(o.diet_name))e.diet_name="Nieprawidłowa dieta.";
  if(!(ALLOWED_KCALS as readonly number[]).includes(o.kcal))e.kcal="Nieprawidłowa kaloryczność.";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(o.start_date)||o.start_date<today)e.start_date="Wybierz dzisiejszą lub późniejszą datę.";
  if(!Number.isInteger(o.days)||o.days<1||o.days>90)e.days="Liczba dni musi być od 1 do 90.";
  if(!o.no_allergens&&(!o.allergens||o.allergens.length<2))e.allergens="Wpisz alergeny albo zaznacz „Brak alergenów”.";
  if(o.no_allergens&&o.allergens)e.allergens="Usuń alergeny albo odznacz „Brak alergenów”.";
  if(o.access_code_required&&(!o.access_code||o.access_code.length<2))e.access_code="Wpisz kod, klucz lub instrukcję wejścia do klatki.";
  if(!o.terms_accepted)e.terms_accepted="Zaakceptuj regulamin sklepu, aby złożyć zamówienie.";
  return e;
}
