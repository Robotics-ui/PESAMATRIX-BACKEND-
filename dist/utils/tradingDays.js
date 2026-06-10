"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTradingDay = exports.countRemainingTradingDays = exports.addTradingDays = void 0;
/**
 * Adds a given number of trading days (Mon–Fri) to a start date.
 */
const addTradingDays = (startDate, tradingDays) => {
    let count = 0;
    const date = new Date(startDate);
    while (count < tradingDays) {
        date.setDate(date.getDate() + 1);
        const dow = date.getDay();
        if (dow !== 0 && dow !== 6)
            count++;
    }
    return date;
};
exports.addTradingDays = addTradingDays;
/**
 * Counts the remaining trading days (Mon–Fri) between now and an expiry date.
 */
const countRemainingTradingDays = (expiryDate) => {
    const now = new Date();
    const end = new Date(expiryDate);
    now.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (now >= end)
        return 0;
    let count = 0;
    const cursor = new Date(now);
    while (cursor < end) {
        cursor.setDate(cursor.getDate() + 1);
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6)
            count++;
    }
    return count;
};
exports.countRemainingTradingDays = countRemainingTradingDays;
/**
 * Returns true if the given date is a trading day (Mon–Fri).
 */
const isTradingDay = (date) => {
    const dow = date.getDay();
    return dow !== 0 && dow !== 6;
};
exports.isTradingDay = isTradingDay;
