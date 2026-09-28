/**
 * Udział posiłków w dziennej kaloryczności — jedno źródło prawdy.
 *
 * Panel i moduł kuchni miały dotąd dwie różne tabele. Ten sam posiłek
 * tej samej diety wychodził inaczej w zależności od ekranu, a naklejki
 * brały wartość z jednego z nich — stąd rozjazd między tym, co kuchnia
 * gotuje, a tym, co klient czyta na pudełku.
 *
 * Wartości są proporcjami, nie procentami. Normalizujemy je do liczby
 * posiłków faktycznie przypisanych diecie, więc dzień zawsze sumuje się
 * do stu procent — niezależnie od tego, czy klient ma trzy, cztery
 * czy pięć posiłków.
 */

const PROPORCJE: Record<string, Record<string, number>> = {
  Keto: { breakfast: 30, lunch: 40, dinner: 30, snack: 20, shake: 30 },
  domyslne: { breakfast: 25, second_breakfast: 20, lunch: 35, dinner: 20, snack: 15, shake: 20 }
};

export function mealShare(meal: string, dietType: string): number {
  const tabela = dietType === "Keto" ? PROPORCJE.Keto : PROPORCJE.domyslne;
  return tabela[meal] ?? 0;
}

/**
 * Udział danego posiłku wśród posiłków faktycznie zaplanowanych na ten dzień.
 * Gdy żaden nie ma przypisanej proporcji, dzielimy dzień po równo —
 * lepiej podać przybliżenie niż zero kalorii na etykiecie.
 */
export function normalizedMealShare(
  meal: string,
  dietType: string,
  mealsOfDay: { meal_type: string }[]
): number {
  if (!mealsOfDay?.length) return 0;
  const suma = mealsOfDay.reduce((s, m) => s + mealShare(m.meal_type, dietType), 0);
  if (suma <= 0) return 1 / mealsOfDay.length;
  return mealShare(meal, dietType) / suma;
}

/** Kaloryczność pojedynczego posiłku, zaokrąglona do pełnych kcal. */
export function mealKcal(
  meal: string,
  dietType: string,
  kcalDnia: number,
  mealsOfDay: { meal_type: string }[]
): number {
  return Math.round(Number(kcalDnia || 0) * normalizedMealShare(meal, dietType, mealsOfDay));
}
