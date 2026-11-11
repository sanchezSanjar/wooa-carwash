/**
 * Settings that are fine on a laptop but unsafe on a real server. With NODE_ENV=production the
 * API and batch servers refuse to start until they are fixed, instead of running quietly insecure.
 */
const WEAK_SECRETS = ['change_me', 'changeme', 'secret', 'test-secret', 'jwt_secret'];
const MIN_SECRET_LENGTH = 32;

export type ServerKind = 'api' | 'batch';

/** Problems with the settings for a production server (empty when everything is fine). */
export function productionProblems(kind: ServerKind, env: NodeJS.ProcessEnv = process.env): string[] {
  const problems: string[] = [];
  const has = (key: string) => !!env[key]?.trim();

  if (!has('SOLAPI_API_KEY') || !has('SOLAPI_API_SECRET') || !has('SOLAPI_SENDER_NUMBER')) {
    problems.push('SOLAPI_API_KEY, SOLAPI_API_SECRET and SOLAPI_SENDER_NUMBER are needed: without them SMS codes only go to the server log');
  }
  if (kind === 'api') {
    const secret = env.JWT_SECRET?.trim() ?? '';
    if (secret.length < MIN_SECRET_LENGTH || WEAK_SECRETS.includes(secret.toLowerCase())) {
      problems.push(`JWT_SECRET must be a random value of at least ${MIN_SECRET_LENGTH} characters (e.g. openssl rand -hex 32)`);
    }
    if (!has('CORS_ORIGINS')) {
      problems.push('CORS_ORIGINS must list the website address(es), e.g. https://wooa-carwash.com');
    }
  }
  return problems;
}

/** Stops the server when NODE_ENV=production and a setting is unsafe. */
export function assertSafeForProduction(kind: ServerKind, env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  const problems = productionProblems(kind, env);
  if (problems.length) {
    throw new Error(`Unsafe settings for production (${kind}):\n- ${problems.join('\n- ')}`);
  }
}
