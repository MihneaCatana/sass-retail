const BUSINESS_TIME_ZONE = 'Europe/Bucharest';

function parts(value: string | Date, includeTime: boolean): Intl.DateTimeFormatPart[] | null {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {})
  }).formatToParts(date);
}

/** Formats a calendar date consistently as dd/MM/yyyy in the business timezone. */
export function formatAppDate(value: string | Date): string {
  const dateParts = parts(value, false);
  if (!dateParts) return '';
  const fields = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
  return `${fields['day']}/${fields['month']}/${fields['year']}`;
}

/** Formats an event timestamp as dd/MM/yyyy HH:mm in the business timezone. */
export function formatAppDateTime(value: string | Date): string {
  const dateParts = parts(value, true);
  if (!dateParts) return '';
  const fields = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
  return `${fields['day']}/${fields['month']}/${fields['year']} ${fields['hour']}:${fields['minute']}`;
}
