import { API_URL, ApiError, getAuthToken } from './api';

/** Downloads a file from the API with the browser's normal download. */
export async function downloadFromApi(path: string, filename: string, _mimeType: string): Promise<void> {
  const token = getAuthToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError('Could not download the file. Check your connection and try again.', 0);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? `Download failed (${res.status})`, res.status);
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
