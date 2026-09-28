import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Stan konfiguracji integracji — dla panelu.
 *
 * Zwracamy wyłącznie informację „ustawione albo nie". Żadnych wartości,
 * numerów ani kluczy, bo endpoint jest dostępny publicznie.
 *
 * Powstał, bo SMS o nowym zamówieniu nie wysyłał się przez wiele tygodni
 * i nie było tego jak zauważyć: kod pomija wysyłkę po cichu, gdy brakuje
 * numeru odbiorcy.
 */
export async function GET() {
  const jest = (v?: string) => Boolean(v && v.trim());

  const smsToken = jest(process.env.SMSAPI_TOKEN);
  const smsAdmin = jest(
    process.env.SMSAPI_ADMIN_PHONE || process.env.sms_admin_phone || process.env.ADMIN_PHONE
  );

  const p24 = {
    merchantId: jest(process.env.P24_MERCHANT_ID),
    posId: jest(process.env.P24_POS_ID),
    apiKey: jest(process.env.P24_API_KEY),
    crc: jest(process.env.P24_CRC),
    sandbox: String(process.env.P24_SANDBOX || "").toLowerCase() === "true"
  };

  return NextResponse.json({
    platnosci: p24.merchantId && p24.posId && p24.apiKey && p24.crc,
    p24,
    smsOZamowieniach: smsToken && smsAdmin,
    smsToken,
    smsAdmin,
    baza: jest(process.env.NEXT_PUBLIC_SUPABASE_URL) && jest(process.env.SUPABASE_SERVICE_ROLE_KEY),
    mapy: jest(process.env.GOOGLE_MAPS_API_KEY)
  });
}
