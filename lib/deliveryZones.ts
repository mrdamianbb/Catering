export type ZoneId = "A" | "B";

export interface Zone {
  id: ZoneId;
  name: string;
  window: string;
}

export const ZONES: Record<ZoneId, Zone> = {
  A: { id: "A", name: "Powiat wodzisławski i Jastrzębie-Zdrój", window: "19:00 – 21:00" },
  B: { id: "B", name: "Rybnik i Żory", window: "20:00 – 22:00" }
};

export interface Locality {
  name: string;
  zone: ZoneId;
  codes: string[];
  slug?: string;
}

// UWAGA: kody pocztowe wymagają weryfikacji w bazie Poczty Polskiej przed produkcją.
// Adres spoza listy NIE jest odrzucany — trafia do ręcznej weryfikacji.
export const LOCALITIES: Locality[] = [
  { name: "Wodzisław Śląski", zone: "A", codes: ["44-300", "44-304", "44-305"], slug: "catering-dietetyczny-wodzislaw-slaski" },
  { name: "Radlin", zone: "A", codes: ["44-310"] },
  { name: "Rydułtowy", zone: "A", codes: ["44-280"] },
  { name: "Pszów", zone: "A", codes: ["44-370"] },
  { name: "Marklowice", zone: "A", codes: ["44-321"] },
  { name: "Mszana", zone: "A", codes: ["44-325"] },
  { name: "Godów", zone: "A", codes: ["44-340"] },
  { name: "Skrzyszów", zone: "A", codes: ["44-348"] },
  { name: "Gorzyce", zone: "A", codes: ["44-350"] },
  { name: "Lubomia", zone: "A", codes: ["44-360"] },
  { name: "Jastrzębie-Zdrój", zone: "A", codes: ["44-330", "44-335", "44-336", "44-337", "44-338"], slug: "catering-dietetyczny-jastrzebie-zdroj" },
  { name: "Rybnik", zone: "B", codes: ["44-200", "44-203", "44-206", "44-207", "44-210", "44-217", "44-218", "44-238"], slug: "catering-dietetyczny-rybnik" },
  { name: "Żory", zone: "B", codes: ["44-240", "44-241", "44-244"], slug: "catering-dietetyczny-zory" }
];

const CODE_INDEX = (() => {
  const map = new Map<string, Locality>();
  for (const loc of LOCALITIES) for (const code of loc.codes) if (!map.has(code)) map.set(code, loc);
  return map;
})();

export type DeliveryStatus = "covered" | "review" | "empty";

export interface DeliveryCheck {
  status: DeliveryStatus;
  locality?: Locality;
  zone?: Zone;
  message: string;
}

export function normalizePostalCode(input: string): string | null {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length !== 5) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function checkDelivery(postalCode: string): DeliveryCheck {
  const code = normalizePostalCode(postalCode);
  if (!code) return { status: "empty", message: "" };

  const locality = CODE_INDEX.get(code);
  if (!locality) {
    return {
      status: "review",
      message: "Tego adresu nie ma jeszcze na naszej liście — zamówienie przyjmiemy, a obsługa potwierdzi dostawę telefonicznie."
    };
  }

  const zone = ZONES[locality.zone];
  return {
    status: "covered",
    locality,
    zone,
    message: `Dowozimy do: ${locality.name}. Orientacyjnie ${zone.window}.`
  };
}

export function localitiesByZone(): Array<{ zone: Zone; localities: Locality[] }> {
  return (Object.keys(ZONES) as ZoneId[]).map(id => ({
    zone: ZONES[id],
    localities: LOCALITIES.filter(l => l.zone === id)
  }));
}

export const ALL_LOCALITY_NAMES = LOCALITIES.map(l => l.name);
