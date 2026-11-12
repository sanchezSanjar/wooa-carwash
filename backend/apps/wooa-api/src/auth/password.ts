import { ValidateBy, ValidationOptions } from 'class-validator';

/** bcrypt only uses the first 72 bytes of a password: longer ones would silently match a shorter one. */
export const MAX_PASSWORD_BYTES = 72;
export const PASSWORD_TOO_LONG = 'The password is too long. Use at most 72 letters (24 in Korean).';

/** Rejects passwords bcrypt would cut short (bytes, not letters: a Korean letter is 3 bytes). */
export const PasswordFits = (options?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'passwordFits',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES,
        defaultMessage: () => PASSWORD_TOO_LONG,
      },
    },
    options,
  );
