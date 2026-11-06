import { translate } from './i18n';
import { API_URL, ApiError, apiHeaders, currentLang } from './api';

/** Downloads a file from the API with the browser's normal download. */
export async function downloadFromApi(path: string, filename: string, _mimeType: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: apiHeaders() });
  } catch {
    throw new ApiError(translate(currentLang(), 'Could not download the file. Check your connection and try again.'), 0);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? translate(currentLang(), 'Download failed ({status})', { status: res.status }), res.status);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
