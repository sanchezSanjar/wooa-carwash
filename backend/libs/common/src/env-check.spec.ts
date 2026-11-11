import { describe, expect, it } from 'vitest';
import { assertSafeForProduction, productionProblems } from './env-check';

const good = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a'.repeat(64),
  CORS_ORIGINS: 'https://wooa-carwash.com',
  SOLAPI_API_KEY: 'key',
  SOLAPI_API_SECRET: 'secret',
  SOLAPI_SENDER_NUMBER: '010-0000-0000',
};

describe('production settings check', () => {
  it('accepts a complete production setup', () => {
    expect(productionProblems('api', good)).toEqual([]);
    expect(() => assertSafeForProduction('api', good)).not.toThrow();
  });

  it('rejects the example JWT secret and short secrets', () => {
    expect(productionProblems('api', { ...good, JWT_SECRET: 'change_me' })).toHaveLength(1);
    expect(productionProblems('api', { ...good, JWT_SECRET: 'short-but-random' })).toHaveLength(1);
  });

  it('needs SMS keys and allowed origins', () => {
    expect(productionProblems('api', { ...good, SOLAPI_API_KEY: '' }).join()).toMatch(/SOLAPI/);
    expect(productionProblems('api', { ...good, CORS_ORIGINS: undefined }).join()).toMatch(/CORS_ORIGINS/);
  });

  it('checks only what the batch server uses', () => {
    expect(productionProblems('batch', { ...good, JWT_SECRET: '', CORS_ORIGINS: '' })).toEqual([]);
    expect(productionProblems('batch', { ...good, SOLAPI_SENDER_NUMBER: '' })).toHaveLength(1);
  });

  it('stops a production server, but not a local one', () => {
    expect(() => assertSafeForProduction('api', { ...good, JWT_SECRET: 'change_me' })).toThrow(/JWT_SECRET/);
    expect(() => assertSafeForProduction('api', { NODE_ENV: 'development', JWT_SECRET: 'change_me' })).not.toThrow();
  });
});
