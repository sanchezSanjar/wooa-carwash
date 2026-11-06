import { router, type Href } from 'expo-router';

/** Only follow in-app relative paths from a `next` param. */
export function safeNext(next: string | string[] | undefined): Href | null {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith('/') && !value.startsWith('//') ? (value as Href) : null;
}

/** Leave the auth modal and continue to `next` (or back to where the user came from). */
export function finishAuth(next: string | string[] | undefined) {
  const target = safeNext(next);
  if (router.canGoBack()) router.back();
  if (target) router.navigate(target);
  else if (!router.canGoBack()) router.replace('/');
}
