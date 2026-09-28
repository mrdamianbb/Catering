/**
 * Etykiety 50×30 mm jako obrazki PNG.
 *
 * Drukarki Niimbot łączą się przez Bluetooth z własną aplikacją i nie
 * pojawiają się w oknie drukowania przeglądarki. Zamiast drukować,
 * generujemy gotowe obrazki — wgrywa się je do aplikacji jako zdjęcie.
 *
 * 50×30 mm przy 300 dpi to 591×354 px. Rysujemy w tej rozdzielczości,
 * żeby tekst był ostry po wydruku.
 */

export interface DaneEtykiety {
  klient: string;
  posilek: string;
  danie: string;
  dieta: string;
  kcal: number;
  liczbaPosilkow: number;
  data: string;
  /** Kaloryczność tego posiłku, nie całego dnia. */
  kcalPosilku: number;
  /** Skład, malejąco według masy — wymóg rozporządzenia 1169/2011. */
  sklad: string[];
  /** Wykluczenia klienta — informacja dla kuchni przy pakowaniu. */
  wykluczenia: string[];
  /** Alergeny obecne w daniu — informacja dla klienta, wymóg prawny. */
  alergeny: string[];
}

const SZER = 591;
const WYS = 354;
const M = 18;

function tekst(
  c: CanvasRenderingContext2D, t: string, x: number, y: number,
  rozmiar: number, waga: string, kolor: string, maxSzer?: number
) {
  c.fillStyle = kolor;
  c.font = `${waga} ${rozmiar}px Arial, Helvetica, sans-serif`;
  let s = t;
  if (maxSzer) {
    while (c.measureText(s).width > maxSzer && s.length > 3) s = s.slice(0, -2);
    if (s !== t) s = s.slice(0, -1) + "…";
  }
  c.fillText(s, x, y);
  return c.measureText(s).width;
}

/** Łamie tekst na linie mieszczące się w zadanej szerokości. */
function zawin(c: CanvasRenderingContext2D, t: string, maxSzer: number, maxLinii: number): string[] {
  const slowa = t.split(/\s+/).filter(Boolean);
  const linie: string[] = [];
  let biezaca = "";
  for (const w of slowa) {
    const proba = biezaca ? `${biezaca} ${w}` : w;
    if (c.measureText(proba).width <= maxSzer) { biezaca = proba; continue; }
    if (biezaca) linie.push(biezaca);
    biezaca = w;
    if (linie.length === maxLinii) break;
  }
  if (biezaca && linie.length < maxLinii) linie.push(biezaca);
  if (linie.length === maxLinii) {
    let ost = linie[maxLinii - 1];
    const zostalo = slowa.join(" ").length > linie.join(" ").length;
    if (zostalo) {
      while (c.measureText(ost + "…").width > maxSzer && ost.length > 3) ost = ost.slice(0, -1);
      linie[maxLinii - 1] = ost + "…";
    }
  }
  return linie;
}

export function rysujEtykiete(d: DaneEtykiety): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = SZER; cv.height = WYS;
  const c = cv.getContext("2d")!;

  c.fillStyle = "#fff";
  c.fillRect(0, 0, SZER, WYS);

  // Pasek marki
  c.fillStyle = "#000";
  c.fillRect(0, 0, SZER, 30);
  tekst(c, "DZIKA KACZKA CATERING", M, 21, 15, "bold", "#fff");
  c.font = "bold 14px Arial, sans-serif";
  tekst(c, d.data, SZER - M - c.measureText(d.data).width, 21, 14, "bold", "#fff");

  // Posiłek + kaloryczność tego posiłku
  tekst(c, d.posilek.toUpperCase(), M, 54, 15, "bold", "#000");
  const kcal = `${d.kcalPosilku} kcal`;
  c.font = "bold 21px Arial, sans-serif";
  tekst(c, kcal, SZER - M - c.measureText(kcal).width, 56, 21, "bold", "#000");

  // Klient
  tekst(c, d.klient, M, 86, 25, "bold", "#000", SZER - 2 * M);

  // Danie
  c.font = "17px Arial, sans-serif";
  const linieDania = zawin(c, d.danie, SZER - 2 * M, 2);
  let y = 110;
  for (const l of linieDania) { tekst(c, l, M, y, 17, "normal", "#000"); y += 21; }

  // Skład
  y += 6;
  tekst(c, "SKŁAD:", M, y, 12, "bold", "#333");
  c.font = "13px Arial, sans-serif";
  const linieSkladu = zawin(c, d.sklad.join(", ") || "—", SZER - 2 * M - 62, 3);
  linieSkladu.forEach((l, i) => tekst(c, l, M + 62, y + i * 16, 13, "normal", "#333"));
  y += Math.max(1, linieSkladu.length) * 16 + 10;

  // Alergeny
  const yA = Math.min(y, 252);
  if (d.alergeny.length) {
    c.strokeStyle = "#000"; c.lineWidth = 3;
    c.strokeRect(M, yA, SZER - 2 * M, 40);
    tekst(c, "ALERGENY:", M + 10, yA + 17, 12, "bold", "#000");
    tekst(c, d.alergeny.join(", "), M + 10, yA + 33, 16, "bold", "#000", SZER - 2 * M - 20);
  } else {
    tekst(c, "Alergeny: brak wykrytych", M, yA + 20, 14, "normal", "#555");
  }

  // Stopka
  c.strokeStyle = "#000"; c.lineWidth = 1;
  c.beginPath(); c.moveTo(M, WYS - 36); c.lineTo(SZER - M, WYS - 36); c.stroke();
  tekst(c, "Przechowywać 2–8°C", M, WYS - 15, 14, "normal", "#000");
  const tel = "884 004 321";
  c.font = "bold 14px Arial, sans-serif";
  tekst(c, tel, SZER - M - c.measureText(tel).width, WYS - 15, 14, "bold", "#000");

  return cv;
}

function pobierz(cv: HTMLCanvasElement, nazwa: string) {
  return new Promise<void>(res => {
    cv.toBlob(blob => {
      if (!blob) return res();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nazwa;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => { URL.revokeObjectURL(url); res(); }, 300);
    }, "image/png");
  });
}

const czysc = (v: string) =>
  String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** Pobiera po jednym pliku PNG na etykietę. */
export async function pobierzEtykiety(lista: DaneEtykiety[]) {
  for (let i = 0; i < lista.length; i++) {
    const d = lista[i];
    await pobierz(rysujEtykiete(d), `${czysc(d.klient)}-${czysc(d.posilek)}-${i + 1}.png`);
  }
  return lista.length;
}

/** Wszystkie etykiety klienta na jednym arkuszu — do podglądu przed drukiem. */
export function arkuszPodgladu(lista: DaneEtykiety[]): HTMLCanvasElement {
  const kol = Math.min(3, Math.max(1, lista.length));
  const wier = Math.ceil(lista.length / kol);
  const odstep = 14;
  const cv = document.createElement("canvas");
  cv.width = kol * SZER + (kol + 1) * odstep;
  cv.height = wier * WYS + (wier + 1) * odstep;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#e9eaec"; c.fillRect(0, 0, cv.width, cv.height);
  lista.forEach((d, i) => {
    const x = odstep + (i % kol) * (SZER + odstep);
    const y = odstep + Math.floor(i / kol) * (WYS + odstep);
    c.drawImage(rysujEtykiete(d), x, y);
  });
  return cv;
}


/**
 * PDF budowany ręcznie, bez bibliotek zewnętrznych.
 *
 * Każda strona ma dokładnie 50×30 mm i zawiera jedną etykietę jako
 * obraz JPEG. Aplikacja NIIMBOT na telefonie otwiera PDF i drukuje
 * strona po stronie — jedna strona to jedna naklejka.
 *
 * JPEG wstawiamy wprost (filtr DCTDecode), dzięki czemu nie trzeba
 * niczego kompresować po drodze.
 */

const MM = 72 / 25.4;              // milimetry na punkty typograficzne

function dataUrlNaBajty(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function tekstNaBajty(t: string): Uint8Array {
  const out = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i) & 0xff;
  return out;
}

function zbudujPdf(obrazy: Uint8Array[], szerMm: number, wysMm: number): Blob {
  const w = (szerMm * MM).toFixed(2);
  const h = (wysMm * MM).toFixed(2);
  const n = obrazy.length;

  // 1 = katalog, 2 = drzewo stron, potem po 3 obiekty na stronę
  const idStrony = (i: number) => 3 + i * 3;
  const idTresci = (i: number) => 4 + i * 3;
  const idObrazu = (i: number) => 5 + i * 3;

  const czesci: Uint8Array[] = [];
  const offsety: number[] = [];
  let pozycja = 0;

  const dodaj = (dane: Uint8Array | string) => {
    const b = typeof dane === "string" ? tekstNaBajty(dane) : dane;
    czesci.push(b); pozycja += b.length;
  };
  const obiekt = (id: number, tresc: string) => {
    offsety[id] = pozycja;
    dodaj(`${id} 0 obj\n${tresc}\nendobj\n`);
  };

  dodaj("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  const kidsy = Array.from({ length: n }, (_, i) => `${idStrony(i)} 0 R`).join(" ");
  obiekt(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obiekt(2, `<< /Type /Pages /Count ${n} /Kids [${kidsy}] >>`);

  for (let i = 0; i < n; i++) {
    obiekt(idStrony(i),
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
      `/Resources << /XObject << /I0 ${idObrazu(i)} 0 R >> >> ` +
      `/Contents ${idTresci(i)} 0 R >>`);

    const tresc = `q ${w} 0 0 ${h} 0 0 cm /I0 Do Q`;
    obiekt(idTresci(i), `<< /Length ${tresc.length} >>\nstream\n${tresc}\nendstream`);

    const jpg = obrazy[i];
    offsety[idObrazu(i)] = pozycja;
    dodaj(`${idObrazu(i)} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${SZER} /Height ${WYS} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
    dodaj(jpg);
    dodaj("\nendstream\nendobj\n");
  }

  const startXref = pozycja;
  const maxId = idObrazu(n - 1);
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    xref += String(offsety[id] ?? 0).padStart(10, "0") + " 00000 n \n";
  }
  dodaj(xref);
  dodaj(`trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);

  let razem = 0;
  for (const c of czesci) razem += c.length;
  const plik = new Uint8Array(razem);
  let off = 0;
  for (const c of czesci) { plik.set(c, off); off += c.length; }
  return new Blob([plik], { type: "application/pdf" });
}

/** PDF z etykietami — jedna strona 50×30 mm na naklejkę. */
export async function pobierzEtykietyPdf(lista: DaneEtykiety[], nazwa: string) {
  const obrazy = lista.map(d => dataUrlNaBajty(rysujEtykiete(d).toDataURL("image/jpeg", 0.92)));
  const blob = zbudujPdf(obrazy, 50, 30);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nazwa;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  return lista.length;
}

/**
 * Prawdziwy plik .xlsx, budowany bez bibliotek zewnętrznych.
 *
 * XLSX to archiwum ZIP z kilkoma plikami XML. Składamy je ręcznie,
 * bez kompresji (metoda „store"), co jest w pełni zgodne ze specyfikacją
 * i czytelne dla Excela oraz aplikacji mobilnych.
 */

const TAB_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(dane: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < dane.length; i++) c = TAB_CRC[(c ^ dane[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function utf8(t: string): Uint8Array {
  return new TextEncoder().encode(t);
}

/** ZIP bez kompresji — wystarczający dla plików XML w arkuszu. */
function zbudujZip(pliki: { nazwa: string; dane: Uint8Array }[]): Blob {
  const lokalne: Uint8Array[] = [];
  const centralne: Uint8Array[] = [];
  let offset = 0;

  const u16 = (v: number) => [v & 0xFF, (v >>> 8) & 0xFF];
  const u32 = (v: number) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];

  for (const f of pliki) {
    const nazwa = utf8(f.nazwa);
    const crc = crc32(f.dane);
    const naglowek = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(crc), ...u32(f.dane.length), ...u32(f.dane.length),
      ...u16(nazwa.length), ...u16(0)
    ]);
    const blok = new Uint8Array(naglowek.length + nazwa.length + f.dane.length);
    blok.set(naglowek, 0);
    blok.set(nazwa, naglowek.length);
    blok.set(f.dane, naglowek.length + nazwa.length);
    lokalne.push(blok);

    const wpis = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(crc), ...u32(f.dane.length), ...u32(f.dane.length),
      ...u16(nazwa.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset)
    ]);
    const wpisPelny = new Uint8Array(wpis.length + nazwa.length);
    wpisPelny.set(wpis, 0);
    wpisPelny.set(nazwa, wpis.length);
    centralne.push(wpisPelny);

    offset += blok.length;
  }

  let dlCentralnego = 0;
  for (const c of centralne) dlCentralnego += c.length;

  const koniec = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06, ...u16(0), ...u16(0),
    ...u16(pliki.length), ...u16(pliki.length),
    ...u32(dlCentralnego), ...u32(offset), ...u16(0)
  ]);

  let razem = offset + dlCentralnego + koniec.length;
  const out = new Uint8Array(razem);
  let poz = 0;
  for (const b of lokalne) { out.set(b, poz); poz += b.length; }
  for (const c of centralne) { out.set(c, poz); poz += c.length; }
  out.set(koniec, poz);

  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function pobierzEtykietyXlsx(lista: DaneEtykiety[], nazwa: string) {
  const esc = (v: any) => String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const naglowki = ["Klient", "Posilek", "Danie", "Sklad", "KcalPosilku", "Dieta", "KcalDnia", "Data", "Alergeny", "Wykluczenia"];
  const kol = (n: number) => String.fromCharCode(65 + n);

  const wiersz = (nr: number, wartosci: any[]) =>
    `<row r="${nr}">` + wartosci.map((v, i) =>
      typeof v === "number"
        ? `<c r="${kol(i)}${nr}"><v>${v}</v></c>`
        : `<c r="${kol(i)}${nr}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`
    ).join("") + "</row>";

  const wiersze = [wiersz(1, naglowki)];
  lista.forEach((d, i) => wiersze.push(wiersz(i + 2, [
    d.klient, d.posilek, d.danie, d.sklad.join(", "), d.kcalPosilku,
    d.dieta, d.kcal, d.data,
    d.alergeny.length ? d.alergeny.join(", ") : "brak wykrytych",
    d.wykluczenia.length ? d.wykluczenia.join(" / ") : "brak"
  ])));

  const arkusz = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${wiersze.join("")}</sheetData></worksheet>`;

  const pliki = [
    { nazwa: "[Content_Types].xml", dane: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`) },
    { nazwa: "_rels/.rels", dane: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { nazwa: "xl/workbook.xml", dane: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Etykiety" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { nazwa: "xl/_rels/workbook.xml.rels", dane: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`) },
    { nazwa: "xl/worksheets/sheet1.xml", dane: utf8(arkusz) }
  ];

  const blob = zbudujZip(pliki);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nazwa;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  return lista.length;
}
