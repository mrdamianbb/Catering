"use client";

export const dynamic="force-dynamic";
import {FormEvent,useEffect,useState} from "react";
import Script from "next/script";
import {localISODate,normalizeOrder,validateOrder,type OrderErrors} from "@/lib/orderValidation";
import {checkDelivery,ALL_LOCALITY_NAMES,type DeliveryCheck} from "@/lib/deliveryZones";
import {Icon,type IconName} from "@/components/icons";
import {KcalCalculator} from "@/components/KcalCalculator";
import {SHAKE_CENA_Z_DIETA,SHAKE_MAX,SMAKI,SMAK_MIX} from "@/lib/shake";
import {PROGI,BONUS_DNI_ZA_POLECENIE,MIN_DNI_POLECONEGO} from "@/lib/loyalty";
import {CENY} from "@/lib/pricing";

const FAQ:{q:string;a:string}[]=[
  {q:"Do kiedy mogę zamówić dietę?",a:"Do godziny 12:00 na dwa dni robocze przed pierwszą dostawą. Późniejsze zamówienia realizujemy w miarę możliwości kuchni — wtedy zadzwoń, potwierdzimy termin."},
  {q:"Jak odwołać albo przesunąć dostawę?",a:"Zadzwoń pod 884 004 321 albo napisz na kontakt@balcar.com.pl najpóźniej do 12:00 na dwa dni robocze przed danym dniem. Odwołane dni nie przepadają — przedłużają okres diety."},
  {q:"Co się dzieje, gdy nie ma mnie w domu?",a:"Kurier zostawia paczkę pod drzwiami albo w miejscu, które wskażesz przy zamawianiu. Jeśli wejście wymaga kodu do klatki, podaj go w formularzu."},
  {q:"Jak przechowywać posiłki?",a:"Po odbiorze przełóż je do lodówki, w temperaturze 2–8°C, i zjedz w dniu, na który zostały przygotowane. Dania podgrzewasz według opisu na etykiecie."},
  {q:"Czy mogę zmienić kaloryczność w trakcie?",a:"Tak. Zgłoś to najpóźniej do 12:00 na dwa dni robocze przed dniem, od którego zmiana ma obowiązywać. Różnicę w cenie rozliczamy przy kolejnym zamówieniu."},
  {q:"Jak zgłaszacie alergeny?",a:"Wykluczenia podane w zamówieniu uwzględniamy przy każdym posiłku — podmieniamy składnik, a nie rezygnujemy z dania. Uwaga: gotujemy w kuchni, w której przetwarzamy gluten, mleko, jaja, ryby, soję, orzechy i seler, więc nie wykluczamy śladowej obecności."},
  {q:"Ile posiłków dostaję?",a:"Do wyboru trzy, cztery albo pięć posiłków dziennie. Przy pięciu są to śniadanie, drugie śniadanie, obiad, podwieczorek i kolacja."},
  {q:"Jak płacę za dietę?",a:"Z góry, za cały zamówiony okres, przelewem, BLIK-iem lub kartą przez Przelewy24."}
];

const DIETS:{name:string;tag:string;desc:string;icon:IconName}[]=[
  {name:"Standard",tag:"Najpopularniejsza",desc:"Pełnowartościowa dieta na co dzień",icon:"bowl"},
  {name:"Keto",tag:"Keto",desc:"Osobna dieta ketogeniczna",icon:"keto"},
  {name:"Low Carb",tag:"Mniej węgli",desc:"Osobna dieta z ograniczoną ilością węglowodanów",icon:"lowcarb"},
  {name:"Bez glutenu",tag:"Gluten free",desc:"Osobna dieta bez glutenu",icon:"gluten"},
  {name:"Bez laktozy",tag:"Lactose free",desc:"Osobna dieta bez mleka i przetworów",icon:"laktoza"},
  {name:"Vege",tag:"Roślinnie",desc:"Pełnowartościowa dieta bez mięsa",icon:"vege"}
];
const KCALS=[1200,1300,1400,1500,1600,1800,2000,2100,2200,2500,3000];
// Cennik w lib/pricing.ts — ten sam, którego używa serwer przy wyliczaniu kwoty do zapłaty.
const PRICES=CENY;

/**
 * Sklep. Ten sam komponent obsługuje stronę główną i osobną stronę /zamow.
 * Formularz istnieje w jednym egzemplarzu, więc oba widoki nie rozjadą się
 * przy kolejnych zmianach.
 */
export default function Store({tylkoFormularz=false}:{tylkoFormularz?:boolean}){
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [msg,setMsg]=useState("");
  const [diet,setDiet]=useState("Standard");
  const [selectedKcal,setSelectedKcal]=useState(2000);
  const [selectedDays,setSelectedDays]=useState(20);
  // Osobny stan na to, co klient wpisuje. Przycinanie wartoW ci w trakcie pisania
  // podmieniało trzecią cyfrę na 90 i zostawiało czerwony komunikat.
  const [dniWpis,setDniWpis]=useState("20");
  const [promoCode,setPromoCode]=useState("");
  const [lojalnosc,setLojalnosc]=useState<{dni:number;procent:number;nazwa:string|null;doNastepnego:{brakuje:number;procent:number}|null}|null>(null);
  const [promoInfo,setPromoInfo]=useState<{code:string;percent:number}|null>(null);

  // Rabaty się nie sumują — liczy się korzystniejszy dla klienta.
  const rabatProcent=Math.max(promoInfo?.percent||0,lojalnosc?.procent||0);
  const mnoznik=1-rabatProcent/100;

  /** Po wpisaniu telefonu sprawdzamy, czy klient ma u nas historię. */
  async function sprawdzLojalnosc(tel:string){
    const cyfry=String(tel||"").replace(/\D/g,"");
    if(cyfry.length<9){setLojalnosc(null);return;}
    try{
      const r=await fetch("/api/loyalty",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:tel})});
      if(!r.ok){setLojalnosc(null);return;}
      setLojalnosc(await r.json());
    }catch{ setLojalnosc(null); }
  }
  const [promoMsg,setPromoMsg]=useState("");
  const [noAllergens,setNoAllergens]=useState(true);
  const [accessRequired,setAccessRequired]=useState(false);
  const [errors,setErrors]=useState<OrderErrors>({});
  const [terms,setTerms]=useState(false);
  const [zgodaSms,setZgodaSms]=useState(false);
  const [shakeIle,setShakeIle]=useState(0);
  const [shakeSmak,setShakeSmak]=useState(SMAK_MIX);
  const [postal,setPostal]=useState<DeliveryCheck>({status:"empty",message:""});
  const minDate=localISODate();

  useEffect(()=>{
    if(typeof window==="undefined")return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const items=Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if(!items.length||!("IntersectionObserver" in window))return;
    document.documentElement.classList.add("js-motion");
    const io=new IntersectionObserver(entries=>{
      for(const en of entries){
        if(en.isIntersecting){en.target.classList.add("shown");io.unobserve(en.target)}
      }
    },{rootMargin:"0px 0px -12% 0px",threshold:.15});
    items.forEach(el=>io.observe(el));
    return ()=>io.disconnect();
  },[]);

  const validateForm=(form:HTMLFormElement,submitting=false)=>{
    const f=new FormData(form);
    const o=normalizeOrder({customer_name:f.get("customer_name"),phone:f.get("phone"),email:f.get("email"),street_address:f.get("street_address"),postal_code:f.get("postal_code"),city:f.get("city"),diet_name:diet,kcal:f.get("kcal"),start_date:f.get("start_date"),days:f.get("days"),saturday_delivery:!!f.get("saturday_delivery"),sunday_delivery:!!f.get("sunday_delivery"),notes:f.get("notes"),no_allergens:noAllergens,allergens:f.get("allergens"),access_code_required:accessRequired,access_code:f.get("access_code"),terms_accepted:terms});
    const next=validateOrder(o,minDate);
    if(!submitting)delete next.terms_accepted;
    setErrors(next);return {o,next};
  };
  const liveValidate=(e:any)=>{const form=e.currentTarget.form as HTMLFormElement|null;if(form)validateForm(form)};

  async function applyPromo(){
    const code=promoCode.trim();
    if(!code){setPromoInfo(null);setPromoMsg("Wpisz kod rabatowy.");return;}
    setPromoMsg("Sprawdzam kod…");
    try{
      const res=await fetch("/api/promo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,days:selectedDays})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok){setPromoInfo(null);setPromoMsg(data?.error||"Nieprawidłowy kod rabatowy.");return;}
      setPromoInfo({code:data.code,percent:data.percent});
      setPromoCode(data.code);
      setPromoMsg(`Kod aktywny: -${data.percent}%`);
    }catch{
      setPromoInfo(null);setPromoMsg("Nie udało się sprawdzić kodu.");
    }
  }

  async function order(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); if(busy)return;
    const checked=validateForm(e.currentTarget,true);
    if(Object.keys(checked.next).length){setMsg("Popraw zaznaczone pola.");return;}
    setBusy(true); setMsg("");
    try{
      const f=new FormData(e.currentTarget);
      const payload={
        customer_name:String(f.get("customer_name")||"").trim(),
        phone:String(f.get("phone")||"").trim(),
        email:String(f.get("email")||"").trim()||null,
        street_address:String(f.get("street_address")||"").trim(),
        postal_code:String(f.get("postal_code")||"").trim(),
        city:String(f.get("city")||"").trim(),
        diet_name:diet,
        kcal:Number(f.get("kcal")),
        start_date:String(f.get("start_date")),
        days:Number(f.get("days")),
        saturday_delivery:!!f.get("saturday_delivery"),
        sunday_delivery:!!f.get("sunday_delivery"),
        notes:String(f.get("notes")||"").trim()||null,
        no_allergens:noAllergens,
        allergens:String(f.get("allergens")||"").trim()||null,
        access_code_required:accessRequired,
        access_code:String(f.get("access_code")||"").trim()||null,
        dk_ref_2:String(f.get("dk_ref_2")||""),
        promo_code:promoInfo?.code||null,
        terms_accepted:terms,
        marketing_consent:zgodaSms,
        referrer:(new FormData(e.currentTarget as HTMLFormElement).get("referrer")||"").toString().trim()||null,
        loyalty_days:lojalnosc?.dni||0,
        shake_qty:shakeIle,
        shake_flavour:shakeIle>0?shakeSmak:null
      };
      const res=await fetch("/api/order",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await res.json().catch(()=>({}));
      if(!res.ok){if(data?.errors)setErrors(data.errors);setMsg(data?.error||"Nie udało się wysłać zamówienia. Spróbuj ponownie.");return;}
      // Gdy płatności online są włączone, przenosimy klienta do Przelewy24.
      if(data?.platnoscUrl){ window.location.href=data.platnoscUrl; return; }
      setDone(true); window.scrollTo({top:0,behavior:"smooth"});
    }catch{
      setMsg("Błąd połączenia. Spróbuj ponownie.");
    }finally{
      setBusy(false);
    }
  }

  if(done)return <main className="brandStore"><section className="thankYou"><img src="/dzika-kaczka.png" alt="Dzika Kaczka"/><h1>Dzięki!</h1><p>Zamówienie wpadło do obsługi. Skontaktujemy się z Tobą w sprawie potwierdzenia.</p><button className="redBtn" onClick={()=>location.reload()}>Zamów ponownie</button></section></main>;

  const jsonLd={
    "@context":"https://schema.org",
    "@type":"FoodEstablishment",
    name:"Dzika Kaczka Catering",
    description:"Catering dietetyczny z restauracyjnym smakiem. Dieta pudełkowa z dostawą pod drzwi.",
    url:"https://www.dzikakaczkacatering.pl",
    telephone:"+48884004321",
    priceRange:"65-109 PLN",
    servesCuisine:"Catering dietetyczny",
    address:{"@type":"PostalAddress",streetAddress:"ul. 1 Maja 65",addressLocality:"Skrzyszów",postalCode:"44-348",addressCountry:"PL"},
    areaServed:ALL_LOCALITY_NAMES.map(name=>({"@type":"City",name})),
    hasOfferCatalog:{
      "@type":"OfferCatalog",
      name:"Diety",
      itemListElement:DIETS.map(d=>({"@type":"Offer",name:`Dieta ${d.name}`,priceCurrency:"PLN",price:String(PRICES[2000]),description:d.desc}))
    }
  };

  return <main className="brandStore">
    
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}}/>
    <nav className="brandNav">
      <a className="brandLogo" href="#top"><img src="/dzika-kaczka.png" alt="Dzika Kaczka"/><div><b>DZIKA <span>KACZKA</span></b><small>CATERING</small></div></a>
      <div className="brandLinks"><a href="#diety">DIETY</a><a href="#onas">O NAS</a><a href="/jadlospis">JADŁOSPIS</a>
        <a href="/shake">SHAKE</a>
        <a href="#faq">FAQ</a>
        <a href="#obszar">OBSZAR DOSTAW</a><a href="#zamow">ZAMÓW</a><a href="#dane-kontaktowe">KONTAKT</a></div>
      <a className="redBtn navCta" href="#zamow"><Icon name="cart" size={18}/> ZAMÓW DIETĘ</a>
    </nav>

    {!tylkoFormularz&&<>
    <section className="heroBrand heroBrandSales" id="top">
      <div className="heroCopy">
        <div className="eyebrow">DZIKA KACZKA CATERING</div>
        <h1>JEDZ DOBRZE.<br/><span>WYGLĄDAJ LEPIEJ.</span></h1>
        <p>Restauracyjny smak, policzone kalorie i dostawa pod drzwi. Ty wybierasz cel — my codziennie ogarniamy resztę.</p>

        <div className="heroBenefits">
          <span>✓ Restauracyjny poziom</span>
          <span>✓ Dostawa od 19:00</span>
          <span>✓ Kaloryczność dopasowana do celu</span>
        </div>

        <div className="heroActions">
          <a className="redBtn heroPrimary" href="#zamow"><Icon name="cart" size={20}/> ZAMÓW DIETĘ</a>
          <a className="ghostBtn" href="#diety">Zobacz diety</a>
        </div>

        <div className="heroTrust">
          <b>Tworzone przez restauratorów.</b>
          <span>Testowane przez ludzi, którzy naprawdę żyją aktywnie.</span>
        </div>
      </div>
      <div className="heroDuck heroSalesVisual">
        <div className="redRing"></div>
        <img src="/dzika-kaczka.png" alt="Dzika Kaczka Catering"/>
        <div className="heroVisualBadge">
          <strong>DZIKA KACZKA</strong>
          <span>CATERING · SPORT · SMAK</span>
        </div>
      </div>
    </section>

    <section className="aboutBrand" id="onas">
      <div className="aboutImage aboutLifestyle">
        <img src="/catering-lifestyle.jpg" alt="Dzika Kaczka Catering — aktywny styl życia"/>
        <div className="aboutLifestyleBadge"><b>DZIKA KACZKA</b><span>CATERING · LIFESTYLE</span></div>
      </div>
      <div className="aboutCopy aboutLifestyleCopy">
        <small>O NAS</small>
        <h2>Twój czas. Twój wygląd.<br/><span>Twój nowy styl życia.</span></h2>
        <p className="aboutLead">Nie trać godzin na zakupy i stanie w kuchni. Codziennie dostarczamy Ci zbilansowane, pełne smaku posiłki prosto pod drzwi. Ty skupiasz się na swoich celach — my ogarniamy resztę.</p>

        <div className="aboutPoint">
          <span><Icon name="chef" size={30}/></span>
          <div>
            <h3>Catering tworzony przez restauratorów</h3>
            <p>Na co dzień prowadzimy restaurację, dlatego wiemy, że dobra dieta musi nie tylko zgadzać się w kaloriach, ale przede wszystkim świetnie smakować i trzymać restauracyjny poziom.</p>
          </div>
        </div>

        <div className="aboutPoint">
          <span><Icon name="dumbbell" size={30}/></span>
          <div>
            <h3>Od sportowców dla wymagających</h3>
            <p>Połączyliśmy doświadczenie gastronomiczne z aktywnym stylem życia. Dla osób, które trenują, pracują nad sylwetką albo po prostu chcą jeść dobrze bez kompromisów.</p>
          </div>
        </div>

        <div className="aboutCtaRow">
          <div>
            <b>Gotowy na zmianę?</b>
            <span>Wybierz swoją kaloryczność i zacznij.</span>
          </div>
          <a href="#zamow" className="redBtn aboutOrderBtn">Zamów dietę</a>
        </div>
      </div>
    </section>

    <section className="benefits" id="jak">
      <div data-reveal style={{["--i" as any]:0}}><span><Icon name="utensils" size={28}/></span><b>Smacznie i zdrowo</b><p>Codziennie świeże posiłki z jakościowych składników.</p></div>
      <div data-reveal style={{["--i" as any]:1}}><span><Icon name="truck" size={28}/></span><b>Dostawa pod drzwi</b><p>Dowozimy catering prosto pod wskazany adres.</p></div>
      <div data-reveal style={{["--i" as any]:2}}><span><Icon name="bottle" size={28}/></span><b>Shake'i i różnorodność</b><p>Menu bez nudy, z opcją shake'ów w butelkach.</p></div>
      <div data-reveal style={{["--i" as any]:3}}><span><Icon name="trend" size={28}/></span><b>Efekty, które widać</b><p>Diety dopasowane do redukcji, masy i utrzymania.</p></div>
    </section>

    <section className="whySales">
      <div className="whySalesHead">
        <small>DLACZEGO DZIKA KACZKA?</small>
        <h2>Nie robimy „pudełek”.<br/><span>Robimy jedzenie, które chce się jeść.</span></h2>
      </div>
      <div className="whySalesGrid">
        <div className="whySalesCard" data-reveal>
          <span>01</span>
          <h3>Restauracyjny smak</h3>
          <p>Menu powstaje z podejściem restauracyjnym. Liczą się nie tylko makro i kalorie, ale też tekstura, sos, przyprawy i zwykła przyjemność z jedzenia.</p>
        </div>
        <div className="whySalesCard" data-reveal>
          <span>02</span>
          <h3>Cel bez nudy</h3>
          <p>Redukcja, utrzymanie albo masa — dieta ma pomagać w realizacji celu, ale nie może smakować jak kara.</p>
        </div>
        <div className="whySalesCard" data-reveal>
          <span>03</span>
          <h3>Wygoda codziennie</h3>
          <p>Bez zakupów, gotowania i liczenia. Wybierasz plan, a gotowe posiłki trafiają pod wskazany adres.</p>
        </div>
      </div>
    </section>

    <section className="dietChooser dietChooserSales" id="diety">
      <div className="sectionHead salesSectionHead">
        <small>WYBIERZ SWÓJ PLAN</small>
        <h2>Znajdź dietę pod swój cel.</h2>
        <p>Wybierz typ diety, a potem kaloryczność i dni dostaw. Całość policzymy za Ciebie przed wysłaniem zamówienia.</p>
      </div>
      <div className="dietCards dietCardsSales">
      {DIETS.map((d,i)=><button key={d.name} data-reveal style={{["--i" as any]:i}} className={`dietCard ${diet===d.name?"selected":""}`} onClick={()=>{setDiet(d.name);document.getElementById("zamow")?.scrollIntoView({behavior:"smooth"})}}><span className="dietIcon"><Icon name={d.icon} size={34}/></span><div className="dietTag">{d.tag}</div><h3>{d.name}</h3><p>{d.desc}</p><strong>Wybierz plan</strong></button>)}
    </div></section>

    <section className="shakeTeaser">
      <div className="shakeTeaserIn">
        <div className="tresc">
          <small className="sekcjaEtykieta">NOWOŚĆ</small>
          <h2>30 g białka<br/>w butelce</h2>
          <p>Robimy je w tej samej kuchni co Twoją dietę — na mleku i prawdziwych owocach. Dorzucisz do zamówienia i przyjadą razem z posiłkami.</p>
          <a className="redBtn" href="/shake">Zobacz smaki</a>
        </div>
        <div className="shakeScena"><img className="tlo" src="/shake/czekolada-mieta.jpg" alt="" loading="lazy"/><div className="przod"><img src="/shake/truskawka.jpg" alt="" loading="lazy"/><img src="/shake/borowka.jpg" alt="" loading="lazy"/><img src="/shake/malina.jpg" alt="" loading="lazy"/></div></div>
      </div>
    </section>

    <section className="menuTeaser">
      <div className="menuTeaserInner">
        <div>
          <small>JADŁOSPIS</small>
          <h2>Zobacz, co będziesz jeść.</h2>
          <p>Przykładowy dzień z każdej diety, z rozpisaną kalorycznością każdego posiłku.</p>
        </div>
        <a className="redBtn" href="/jadlospis">Zobacz jadłospis</a>
      </div>
    </section>

    <section className="deliveryAreaSection" id="obszar">
      <div className="sectionHead salesSectionHead">
        <small>OBSZAR DOSTAW</small>
        <h2>Sprawdź, czy dowozimy do Ciebie.</h2>
        <p>Dostawy realizujemy codziennie od godziny 19:00. Dokładna godzina zależy od trasy kuriera.</p>
      </div>
      <figure className="zoneMap">
        <picture>
          <source media="(max-width:760px)" srcSet="/obszar-dostaw-small.webp" type="image/webp"/>
          <img src="/obszar-dostaw.webp" width={1536} height={1024} loading="lazy" decoding="async"
            alt="Mapa obszaru dostaw Dzika Kaczka Catering: zaznaczony teren obejmuje Rybnik, Żory, Wodzisław Śląski, Jastrzębie-Zdrój oraz kuchnię w Skrzyszowie."/>
        </picture>
      </figure>

      <p className="zoneNote">Nie ma Twojej miejscowości? Zadzwoń pod <a href="tel:+48884004321">884 004 321</a> — obszar dostaw stale rozszerzamy.</p>
    </section>

    <section className="salesCtaStrip">
      <div>
        <small>GOTOWY?</small>
        <h2>Wybierz dietę i zacznij od najbliższego możliwego terminu.</h2>
      </div>
      <a className="redBtn" href="#zamow">Przejdź do zamówienia</a>
    </section>
    </>}

    {tylkoFormularz&&<section className="zamowHero">
      <span className="sekcjaEtykieta">ZAMÓWIENIE</span>
      <h1>Zamów dietę</h1>
      <p>Wypełnij formularz, a odezwiemy się z potwierdzeniem. Dowozimy siedem dni w tygodniu, od godziny 19:00.</p>
      <a className="zamowPowrot" href="/">← Zobacz diety, ceny i obszar dostaw</a>
    </section>}

    <section className="orderSection orderSectionSales" id="zamow">
      <form className="brandOrderForm" onSubmit={order}>
        <div className="orderIntro orderIntroInForm"><small>ZAMÓWIENIE</small><h2>Wybrana dieta: <span>{diet}</span></h2><p>Wypełnij formularz. Zamówienie automatycznie pojawi się w panelu administratora.</p></div>
        <div className="formTitle">1. PLAN I TERMIN</div><div className="brandGrid">
          <div className="choiceField choiceFieldWide"><span className="choiceLabel">Typ diety</span><div className="choiceCards dietChoiceCards">{DIETS.map(d=><button type="button" key={d.name} className={`choiceCard ${diet===d.name?"selected":""}`} onClick={()=>setDiet(d.name)}><span><Icon name={d.icon} size={22}/></span><b>{d.name}</b>{diet===d.name&&<em>✓</em>}</button>)}</div></div>
          <div className="choiceFieldWide"><KcalCalculator options={KCALS} onPick={setSelectedKcal}/></div>
          <div className="choiceField choiceFieldWide"><span className="choiceLabel">Kaloryczność</span><input type="hidden" name="kcal" value={selectedKcal}/><div className="choiceCards kcalChoiceCards">{KCALS.map(k=><button type="button" key={k} className={`choiceCard kcalCard ${selectedKcal===k?"selected":""}`} onClick={()=>setSelectedKcal(k)}><b>{k} kcal</b><span>{PRICES[k]} zł / dzień</span>{selectedKcal===k&&<em>✓</em>}</button>)}</div></div>
          <label>Data rozpoczęcia<input name="start_date" type="date" min={minDate} required onChange={liveValidate} onBlur={liveValidate}/>{errors.start_date&&<span className="fieldError">{errors.start_date}</span>}</label>
          <label>Liczba dni<input name="days" type="number" inputMode="numeric" min="1" max="90" step="1" value={dniWpis} required onFocus={e=>e.target.select()} onChange={e=>{const tekst=e.target.value;setDniWpis(tekst);const n=Number(tekst);if(Number.isInteger(n)&&n>=1&&n<=90){setSelectedDays(n);if(promoInfo?.code==="20DNI10"&&n<20){setPromoInfo(null);setPromoMsg("Kod 20DNI10 wymaga minimum 20 dni.");}setErrors(p=>({...p,days:undefined}));}}} onBlur={e=>{const n=Math.max(1,Math.min(90,Math.round(Number(e.target.value)||selectedDays)));setSelectedDays(n);setDniWpis(String(n));if(promoInfo?.code==="20DNI10"&&n<20){setPromoInfo(null);setPromoMsg("Kod 20DNI10 wymaga minimum 20 dni.");}setErrors(p=>({...p,days:undefined}));}}/>{errors.days&&<span className="fieldError">{errors.days}</span>}<small className="poleWskazowka">Od 1 do 90 dni</small></label>
        </div>
        <div className="deliveryTimeNotice"><b><Icon name="truck" size={18}/> Dostawy realizujemy od godziny 19:00.</b><span>Dokładna godzina może zależeć od trasy kuriera.</span></div>
        <div className="shakeDodatek">
          <div className="shakeDodatekTop">
            <div>
              <b>🥤 Shake proteinowy</b>
              <span>30 g białka w butelce. Przyjadą razem z posiłkami. {SHAKE_CENA_Z_DIETA} zł za sztukę.</span>
            </div>
            <a href="/shake" target="_blank" rel="noopener">Zobacz smaki →</a>
          </div>
          <div className="shakeRzad">
            <div className="shakeLicznik">
              <button type="button" onClick={()=>setShakeIle(n=>Math.max(0,n-1))} aria-label="Mniej">−</button>
              <span>{shakeIle}</span>
              <button type="button" onClick={()=>setShakeIle(n=>Math.min(SHAKE_MAX,n+1))} aria-label="Więcej">+</button>
            </div>
            <div className="shakeOpis">
              <b>Liczba butelek</b>
              <span>{shakeIle===0?"Najczęściej biorą 5 — na cały tydzień treningowy":`${(shakeIle*SHAKE_CENA_Z_DIETA).toFixed(2)} zł`}</span>
            </div>
          </div>
          {shakeIle>0&&<label className="shakeSmakWybor">Smaki
            <select value={shakeSmak} onChange={e=>setShakeSmak(e.target.value)}>
              <option value={SMAK_MIX}>Mix smaków — niech wybierze kuchnia</option>
              {SMAKI.map(x=><option key={x.id} value={x.id}>Tylko {x.nazwa}</option>)}
            </select>
          </label>}
        </div>

        <div className="orderPriceSummary">
          <div><span>Cena za dzień</span><b>{(PRICES[selectedKcal]*mnoznik).toFixed(2)} zł</b></div>
          <div><span>Liczba dni</span><b>{selectedDays}</b></div>
          {shakeIle>0&&<div><span>Shake × {shakeIle}</span><b>{(shakeIle*SHAKE_CENA_Z_DIETA).toFixed(2)} zł</b></div>}
          <div className="orderPriceTotal"><span>Łączna cena</span><b key={`${selectedKcal}-${selectedDays}-${rabatProcent}-${shakeIle}`}>{(PRICES[selectedKcal]*selectedDays*mnoznik+shakeIle*SHAKE_CENA_Z_DIETA).toFixed(2)} zł</b></div>
          {rabatProcent>0&&<small>✓ Uwzględniono rabat {rabatProcent}%{lojalnosc&&lojalnosc.procent===rabatProcent?" za stałą współpracę":""}</small>}
        </div>
        <div className="poleceniePole">
          <label>Kto Cię polecił? <span>(opcjonalnie)</span>
            <input name="referrer" maxLength={120} placeholder="Imię i nazwisko albo numer telefonu"/>
          </label>
          <small>Oboje dostaniecie dzień diety gratis, gdy zamówisz minimum {MIN_DNI_POLECONEGO} dni. Doliczymy go do końca diety.</small>
        </div>

        <div className={`promoBox ${promoInfo?"promoBoxOk":""}`}>
          <label>Kod rabatowy
            <div className="promoRow">
              <input value={promoCode} onChange={e=>{setPromoCode(e.target.value);setPromoInfo(null);setPromoMsg("");}} maxLength={40} placeholder="Wpisz kod"/>
              <button type="button" className="ghostBtn" onClick={applyPromo}>Zastosuj</button>
            </div>
          </label>
          {promoMsg&&<small className={promoInfo?"promoOk":"promoMessage"}>{promoMsg}</small>}
          {promoInfo&&<div className="priceBadge"><span>Cena po rabacie</span><b>{(PRICES[selectedKcal]*(1-promoInfo.percent/100)).toFixed(2)} zł / dzień</b></div>}
          <small>Rabaty nie łączą się. Kod można wykorzystać tylko raz na tę samą osobę i adres.</small>
        </div>
        <div className="brandChecks"><label><input type="checkbox" name="saturday_delivery" defaultChecked/> Dostawy w soboty</label><label><input type="checkbox" name="sunday_delivery" defaultChecked/> Dostawy w niedziele</label></div>

        <div className="formTitle">2. WYKLUCZENIA I ALERGENY</div>
<div className="allergenPanel">
          <p className="allergenLead"><b>Alergie i wykluczenia</b> — zaznacz „Brak alergenów” tylko jeśli naprawdę nie masz żadnych wykluczeń.</p>
          <label className="inlineCheck"><input type="checkbox" checked={noAllergens} onChange={e=>{setNoAllergens(e.target.checked);setTimeout(()=>{const form=e.currentTarget.form as HTMLFormElement|null;if(form)validateForm(form)},0)}}/> Brak alergenów / wykluczeń</label>
          <label>Alergeny / produkty wykluczone
            <textarea name="allergens" rows={3} maxLength={300} disabled={noAllergens} placeholder={noAllergens?"Odznacz „Brak alergenów / wykluczeń”, aby wpisać produkty":"np. orzechy, seler, ryby, laktoza..."} onInput={liveValidate} onBlur={liveValidate}/>
            {!noAllergens&&<div className="quickExcl">
              <span>Częste wykluczenia:</span>
              {["bez laktozy","bez nabiału","gluten","orzechy","ryby","jaja","seler","wieprzowina","bez zup","nie na słodko"].map(x=>(
                <button type="button" key={x} onClick={()=>{
                  const ta=document.querySelector<HTMLTextAreaElement>('textarea[name="allergens"]');
                  if(!ta)return;
                  const obecne=ta.value.split(",").map(v=>v.trim()).filter(Boolean);
                  if(obecne.some(v=>v.toLowerCase()===x))return;
                  ta.value=[...obecne,x].join(", ");
                  ta.dispatchEvent(new Event("input",{bubbles:true}));
                }}>{x}</button>
              ))}
            </div>}
            {errors.allergens&&<span className="fieldError">{errors.allergens}</span>}
          </label>
          <div className="allergenExamples">
            <b>Możliwe alergeny / wykluczenia:</b>
            <span>gluten · mleko/laktoza · jaja · ryby · skorupiaki · orzechy · orzeszki ziemne · soja · seler · gorczyca · sezam · łubin · mięczaki · siarczyny</span>
          </div>
        </div>

        <div className="formTitle">3. DANE DO DOSTAWY</div><div className="brandGrid">
          <label>Imię i nazwisko<input name="customer_name" required maxLength={120} onInput={liveValidate} onBlur={liveValidate}/>{errors.customer_name&&<span className="fieldError">{errors.customer_name}</span>}</label><label>Telefon<input name="phone" type="tel" inputMode="tel" required maxLength={25} onInput={liveValidate} onBlur={e=>{liveValidate(e);sprawdzLojalnosc(e.target.value)}}/>{errors.phone&&<span className="fieldError">{errors.phone}</span>}
            {lojalnosc&&lojalnosc.procent>0&&<span className="lojalnoscOk">★ {lojalnosc.nazwa} · {lojalnosc.dni} dni u nas · rabat {lojalnosc.procent}% naliczony</span>}
            {lojalnosc&&lojalnosc.procent===0&&lojalnosc.doNastepnego&&lojalnosc.dni>0&&<span className="lojalnoscInfo">Masz u nas {lojalnosc.dni} dni. Jeszcze {lojalnosc.doNastepnego.brakuje}, a rabat {lojalnosc.doNastepnego.procent}% naliczy się sam.</span>}
            </label><label>E-mail<input name="email" type="email" maxLength={160} onInput={liveValidate} onBlur={liveValidate}/>{errors.email&&<span className="fieldError">{errors.email}</span>}</label><label>Ulica i numer<input name="street_address" required maxLength={180} onInput={liveValidate} onBlur={liveValidate}/>{errors.street_address&&<span className="fieldError">{errors.street_address}</span>}</label><label>Kod pocztowy<input name="postal_code" inputMode="numeric" placeholder="44-348" required maxLength={6} onInput={e=>{setPostal(checkDelivery((e.target as HTMLInputElement).value));liveValidate(e)}} onBlur={liveValidate}/>{errors.postal_code&&<span className="fieldError">{errors.postal_code}</span>}{postal.status!=="empty"&&<span className={postal.status==="covered"?"zoneOk":"zoneReview"}>{postal.message}</span>}</label><label>Miasto<input name="city" required maxLength={100} onInput={liveValidate} onBlur={liveValidate}/>{errors.city&&<span className="fieldError">{errors.city}</span>}</label>
        </div>
        <div className="accessPanel">
          <label className="inlineCheck"><input type="checkbox" checked={accessRequired} onChange={e=>{setAccessRequired(e.target.checked);setTimeout(()=>{const form=e.currentTarget.form as HTMLFormElement|null;if(form)validateForm(form)},0)}}/> Do wejścia do klatki potrzebny jest kod / klucz / instrukcja</label>
          {accessRequired&&<label>Kod / klucz / instrukcja wejścia
            <input name="access_code" maxLength={120} placeholder="np. 1234#, klucz w skrzynce, zadzwoń domofonem..." onInput={liveValidate} onBlur={liveValidate}/>
            {errors.access_code&&<span className="fieldError">{errors.access_code}</span>}
          </label>}
        </div>
        <label className="fullLabel">Dodatkowe uwagi<textarea name="notes" rows={4} maxLength={500} placeholder="np. dostawa po 18:00, proszę zostawić pod drzwiami…"/></label>
        <input className="hpField" name="dk_ref_2" type="text" tabIndex={-1} autoComplete="new-password" aria-hidden="true"/>
        <div className="securityBox">
          <small>Formularz chroniony przed automatycznymi zgłoszeniami.</small>
        </div>
        <div className="termsBox">
          <label className="inlineCheck">
            <input type="checkbox" checked={terms} onChange={e=>{setTerms(e.target.checked);setErrors(prev=>{const n={...prev};delete n.terms_accepted;return n})}}/>
            <span>Akceptuję <a href="/regulamin" target="_blank" rel="noopener noreferrer">Regulamin sklepu</a> *</span>
          </label>
          {errors.terms_accepted&&<span className="fieldError">{errors.terms_accepted}</span>}
          <label className="inlineCheck optCheck">
            <input type="checkbox" checked={zgodaSms} onChange={e=>setZgodaSms(e.target.checked)}/>
            <span>Chcę dostawać SMS-y o kończącej się diecie i promocjach. Zgoda dobrowolna, mogę ją cofnąć w każdej chwili.</span>
          </label>
        </div>
        {msg&&<p className="brandError">{msg}</p>}
        <button className="redBtn submitBrand" disabled={busy}>{busy?"WYSYŁANIE…":"ZAMAWIAM I PŁACĘ"}</button>
      </form>
    </section>

    {!tylkoFormularz&&<>
    <section className="lojalnoscSekcja" id="lojalnosc">
      <div className="sectionHead salesSectionHead">
        <small>DLA STAŁYCH KLIENTÓW</small>
        <h2>Im dłużej z nami, tym taniej.</h2>
        <p>Rabat nalicza się sam, po numerze telefonu. Bez kont, bez kart, bez zbierania pieczątek — liczymy dni, które już u nas zjadłeś.</p>
      </div>
      <div className="progiSiatka">
        {PROGI.slice().reverse().map(p=>(
          <article key={p.dni}>
            <b>{p.procent}%</b>
            <span>{p.nazwa}</span>
            <small>po {p.dni} dniach łącznie</small>
          </article>
        ))}
        <article className="progPolecenie">
          <b>{BONUS_DNI_ZA_POLECENIE === 1 ? "Dzień" : `${BONUS_DNI_ZA_POLECENIE} dni`}</b>
          <span>Gratis za polecenie</span>
          <small>dla Ciebie i dla osoby, którą przyprowadzisz — gdy zamówi minimum {MIN_DNI_POLECONEGO} dni</small>
        </article>
      </div>
      <p className="lojalnoscNota">Rabat lojalnościowy i kod rabatowy nie sumują się — zawsze liczymy ten korzystniejszy dla Ciebie.</p>
    </section>

    <section className="cenaSekcja" id="dlaczego-tyle">
      <div className="sectionHead salesSectionHead">
        <small>PORÓWNANIE OFERT</small>
        <h2>Dlaczego tyle kosztuje.</h2>
        <p>Ceny diet potrafią różnić się trzykrotnie. Zwykle nie dlatego, że ktoś jest drogi — tylko dlatego, że to nie jest to samo. Zanim porównasz, sprawdź te cztery rzeczy.</p>
      </div>

      <div className="cenaSiatka">
        <article>
          <b>Ile posiłków dziennie</b>
          <p>U nas do wyboru 3, 4 albo 5. Ta sama kaloryczność rozbita na pięć posiłków kosztuje więcej niż na trzy — więcej gotowania, więcej pakowania, więcej dowożenia.</p>
          <span>U nas: 3, 4 lub 5 do wyboru</span>
        </article>
        <article>
          <b>Czy dowóz jest w cenie</b>
          <p>Dowozimy pod drzwi, siedem dni w tygodniu, od godziny 19:00. Bez dopłat, bez odbioru własnego, bez paczkomatu. Przy tańszych ofertach dowóz bywa liczony osobno albo go nie ma.</p>
          <span>U nas: w cenie, 7 dni w tygodniu</span>
        </article>
        <article>
          <b>Świeże czy mrożone</b>
          <p>Gotujemy każdego dnia i tego samego wieczoru wieziemy. Nie mrozimy, nie pakujemy próżniowo na tydzień do przodu, nie produkujemy raz w tygodniu wielkiej partii.</p>
          <span>U nas: gotowane codziennie</span>
        </article>
        <article>
          <b>Czy uwzględniają wykluczenia</b>
          <p>Nie jesz nabiału, glutenu, ryb albo nie znosisz zup? Podmieniamy dania, nie dokładamy opłaty. W tańszych ofertach wykluczenia zwykle oznaczają droższy wariant albo brak takiej możliwości.</p>
          <span>U nas: bez dopłat</span>
        </article>
      </div>

      <div className="cenaStopka">
        <p><b>Na czym nie oszczędzamy:</b> mięso i ryby kupujemy świeże, a nie mrożone bloki. Warzywa kroimy w kuchni, a nie wysypujemy z torebki. To jest główna różnica w cenie — i jedyna, której nie widać na zdjęciu.</p>
        <p className="cenaMuted">Masz tańszą ofertę i zastanawiasz się, czy to porównywalne? Zadzwoń, przejdziemy przez to punkt po punkcie. Jeśli tamta wychodzi lepiej, powiemy wprost.</p>
      </div>
    </section>

    <section className="faqSection" id="faq">
      <div className="sectionHead salesSectionHead">
        <small>CZĘSTE PYTANIA</small>
        <h2>Zanim zamówisz.</h2>
        <p>Osiem rzeczy, o które pytają najczęściej. Reszty dowiesz się pod telefonem.</p>
      </div>
      <div className="faqList">
        {FAQ.map(f=>(
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({
        "@context":"https://schema.org","@type":"FAQPage",
        mainEntity:FAQ.map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))
      })}}/>
    </section>

    </>}

    {!tylkoFormularz&&<a className="pasekZamow" href="#zamow">
      <span>Zamów dietę</span><b>od {Math.min(...Object.values(PRICES)).toFixed(0)} zł/dzień</b>
    </a>}

    <section className="p24ContactSection" id="dane-kontaktowe">
      <div className="p24ContactHead">
        <small>DANE KONTAKTOWE</small>
        <h2>Jesteśmy do Twojej dyspozycji.</h2>
        <p>Pełne dane sprzedawcy i informacje wymagane do obsługi zamówień, płatności oraz reklamacji.</p>
      </div>

      <div className="p24ContactGrid">
        <div className="p24ContactCard">
          <span>SPRZEDAWCA</span>
          <b>FHU Damian Balcar</b>
          <p>NIP: 6472583650</p>
        </div>
        <div className="p24ContactCard">
          <span>ADRES</span>
          <b>ul. 1 Maja 65</b>
          <p>Skrzyszów</p>
        </div>
        <a className="p24ContactCard" href="tel:+48884004321">
          <span>TELEFON</span>
          <b>884 004 321</b>
          <p>Zadzwoń do nas →</p>
        </a>
        <a className="p24ContactCard" href="mailto:kontakt@balcar.com.pl">
          <span>E-MAIL</span>
          <b>kontakt@balcar.com.pl</b>
          <p>Napisz do nas →</p>
        </a>
      </div>

      <div className="p24LegalSummary">
        <div>
          <b>Polityka prywatności</b>
          <p>Dane z formularza wykorzystujemy do realizacji zamówienia, kontaktu, dostawy, płatności oraz obsługi reklamacji. Szczegółowa polityka prywatności znajduje się w stopce poniżej.</p>
        </div>
        <div>
          <b>Reklamacje</b>
          <p>Reklamacje rozpatrujemy w terminie <strong>14 dni</strong> od ich otrzymania. Zgłoszenia można kierować telefonicznie lub e-mailem.</p>
        </div>
        <div>
          <b>Odstąpienie od umowy</b>
          <p>Informacja o prawie odstąpienia od umowy i wyjątkach dotyczących m.in. produktów szybko psujących się znajduje się w sekcji „Reklamacje i odstąpienie” w stopce.</p>
        </div>
      </div>
    </section>

    <footer className="brandFooter"><img src="/dzika-kaczka.png" alt="Dzika Kaczka"/><div><b>DZIKA KACZKA CATERING</b><p>Dieta z charakterem.</p><nav className="legalLinks">
          <a href="/regulamin">Regulamin sklepu</a>
          <a href="/polityka-prywatnosci">Polityka prywatności</a>
          <details><summary>Dane kontaktowe</summary><div className="legalPopup">
            <p><b>Dzika Kaczka Catering</b></p>
            <p>Pełna nazwa firmy: <b>FHU Damian Balcar</b></p>
            <p>NIP: <b>6472583650</b></p>
            <p>Adres firmy: <b>ul. 1 Maja 65, Skrzyszów</b></p>
            <p>Telefon: <b>884 004 321</b></p>
            <p>E-mail: <b>kontakt@balcar.com.pl</b></p>
          </div></details>
        </nav></div></footer>
  </main>
}