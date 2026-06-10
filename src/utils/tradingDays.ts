/**
 * Adds a given number of trading days (Mon–Fri) to a start date.
 */
export const addTradingDays = (startDate: Date, tradingDays: number): Date => {
  let count = 0;
  const date = new Date(startDate);
  while (count < tradingDays) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return date;
};

/**
 * Counts the remaining trading days (Mon–Fri) between now and an expiry date.
 */
export const countRemainingTradingDays = (expiryDate: Date): number => {
  const now = new Date();
  const end = new Date(expiryDate);
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (now >= end) return 0;
  let count = 0;
  const cursor = new Date(now);
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
};

/**
 * Returns true if the given date is a trading day (Mon–Fri).
 */
export const isTradingDay = (date: Date): boolean => {
  const dow = date.getDay();
  return dow !== 0 && dow !== 6;
};
