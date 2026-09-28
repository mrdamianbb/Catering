/**
 * Cennik i wycena zamówienia — jedno źródło prawdy.
 *
 * Do tej pory cennik siedział tylko w kodzie sklepu, czyli w przeglądarce.
 * Przy płatnościach online to niedopuszczalne: kwotę do zapłaty musi wyliczyć
 * serwer z własnych danych, inaczej wystarczy podmienić wartość w przeglądarce,
 * żeby kupić dietę za złotówkę.
 */

import { SHAKE_CENA_Z_DIETA } from "./shake";
import { poziomDla } from "./loyalty";

export const CENY: Record<number, number> = {
  1200: 65, 1300: 69, 1400: 73, 1500: 76, 1600: 79, 1800: 84,
  2000: 89, 2100: 91, 2200: 93, 2500: 99, 3000: 109
};

export const KALORYCZNOSCI = Object.keys(CENY).map(Number).sort((a, b) => a - b);

export interface Wycena {
  cenaDnia: number;
  dieta: number;
  shake: number;
  rabatProcent: number;
  rabatKwota: number;
  razem: number;
  /** Kwota w groszach — tego oczekuje Przelewy24. */
  grosze: number;
}

/**
 * Wycena zamówienia. Rabaty się nie sumują — liczy się korzystniejszy
 * dla klienta, tak samo jak pokazuje to sklep.
 */
export function wycen(opts: {
  kcal: number;
  dni: number;
  shakeIle?: number;
  rabatPromocyjny?: number;
  dniLojalnosci?: number;
}): Wycena {
  const cenaDnia = CENY[Number(opts.kcal)] || 0;
  const dni = Math.max(1, Math.min(90, Math.floor(Number(opts.dni) || 0)));
  const shakeIle = Math.max(0, Math.min(30, Math.floor(Number(opts.shakeIle) || 0)));

  const dieta = cenaDnia * dni;
  const shake = shakeIle * SHAKE_CENA_Z_DIETA;

  const zLojalnosci = poziomDla(Number(opts.dniLojalnosci) || 0)?.procent || 0;
  const rabatProcent = Math.max(Number(opts.rabatPromocyjny) || 0, zLojalnosci);

  // Rabat dotyczy diety. Shake to dodatek w stałej cenie.
  const rabatKwota = Math.round(dieta * rabatProcent) / 100;
  const razem = Math.round((dieta - rabatKwota + shake) * 100) / 100;

  return {
    cenaDnia, dieta, shake, rabatProcent, rabatKwota, razem,
    grosze: Math.round(razem * 100)
  };
}
