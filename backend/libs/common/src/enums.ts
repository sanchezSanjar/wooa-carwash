export const Role = {
  Customer: 'customer',
  Admin: 'admin',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
