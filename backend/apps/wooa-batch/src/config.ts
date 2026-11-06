/** Names of the scheduled jobs (also the log context). */
export const BATCH_WASH_REMINDER = 'BATCH_WASH_REMINDER';
export const BATCH_CLOSE_OUT = 'BATCH_CLOSE_OUT';
export const BATCH_BILLING_ISSUE = 'BATCH_BILLING_ISSUE';
export const BATCH_PAYMENT_DUE = 'BATCH_PAYMENT_DUE';
export const BATCH_PAYMENT_OVERDUE = 'BATCH_PAYMENT_OVERDUE';
export const BATCH_WEATHER_REFRESH = 'BATCH_WEATHER_REFRESH';
export const BATCH_WEATHER_ALERT = 'BATCH_WEATHER_ALERT';

/** Jobs run on Korea time, whatever timezone the server uses (cloud servers are usually UTC). */
export const BATCH_TIMEZONE = 'Asia/Seoul';

/** Note saved on washes nobody marked by the end of the day. */
export const CLOSE_OUT_NOTE = 'Not recorded by the end of the day';
