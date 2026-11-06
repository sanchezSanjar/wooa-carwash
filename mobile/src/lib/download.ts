import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { API_URL, ApiError, getAuthToken } from './api';

/** Downloads a file from the API: saved by the phone's share sheet (Files, KakaoTalk, email …). */
export async function downloadFromApi(path: string, filename: string, mimeType: string): Promise<void> {
  const token = getAuthToken();
  const file = new File(Paths.cache, `${Date.now()}-${filename}`);
  try {
    await File.downloadFileAsync(`${API_URL}${path}`, file, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError('Could not download the file. Check your connection and try again.', 0);
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename, UTI: 'org.openxmlformats.spreadsheetml.sheet' });
  }
}
