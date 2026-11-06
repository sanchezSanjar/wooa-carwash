export const Role = {
  Customer: 'customer',
  /** Staff who wash cars: day sheet, photos, wash outcomes. */
  Washer: 'washer',
  /** Full control. */
  Admin: 'admin',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const MemberStatus = {
  Active: 'active',
  /** Blocked by an admin: cannot log in. */
  Blocked: 'blocked',
} as const;
export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];
