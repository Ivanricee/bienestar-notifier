/*export const CONFIG = {
  SLEEP_BETWEEN_SEARCHES: 60 * 60 * 24, // 1 día en segundos
  MAX_ATTEMPTS: 15,                      // intentos máximos
}
*/
//testing
export const CONFIG = {
  SLEEP_BETWEEN_SEARCHES: 20, // 20 segundos
  MAX_ATTEMPTS: 5, // 5 intentos
};
export function getSleepUntilNextCycle(): number {
  const now = new Date();
  const next = new Date(now);

  // sumar 2 meses
  next.setMonth(next.getMonth() + 2);

  // ir al primero de ese mes
  next.setDate(1);
  next.setHours(0, 0, 0, 0);

  // diferencia en segundos
  return Math.floor((next.getTime() - now.getTime()) / 1000);
}
