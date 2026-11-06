/** Korean mobile numbers: 010-1234-5678, 01012345678, +82 10 1234 5678 all become "01012345678". */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('82')) digits = `0${digits.slice(2)}`;
  return digits;
}

export const MOBILE_RE = /^01[016789]\d{7,8}$/;

export function isMobile(input: string): boolean {
  return MOBILE_RE.test(normalizePhone(input));
}

/** "010-1234-5678" for display. */
export function formatPhone(phone: string): string {
  const d = normalizePhone(phone);
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d;
}
