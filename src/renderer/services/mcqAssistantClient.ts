import type { McqAssistantConfig } from '../components/McqAssistantSetup';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://api.meooow.tech').replace(/\/+$/, '');

export async function analyzeMcqScreenshot(
  blobs: Blob[],
  config: McqAssistantConfig,
  signal?: AbortSignal
): Promise<string> {
  const token = await window.meow?.getAuthToken?.();
  if (!token) throw new Error('Authentication required.');

  if (!blobs.length) throw new Error('Question incomplete - add another capture');
  const images = await Promise.all(blobs.map(blob => new Promise<{ imageBase64: string; mimeType: 'image/jpeg' }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      resolve({ imageBase64: comma >= 0 ? value.slice(comma + 1) : value, mimeType: 'image/jpeg' });
    };
    reader.onerror = () => reject(new Error('Unable to read a screenshot.'));
    reader.readAsDataURL(blob);
  })));

  const identity = await window.meow?.getDeviceIdentity?.();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (identity?.deviceId && identity?.deviceToken) {
    headers['X-Device-Id'] = identity.deviceId;
    headers['X-Device-Token'] = identity.deviceToken;
  }

  const response = await fetch(`${API_BASE_URL}/api/ai/mcq-assistant/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ images, config }),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: any = new Error(data.message || 'MCQ analysis failed.');
    error.code = data.error;
    throw error;
  }
  if (typeof data.answer !== 'string' || !data.answer.trim()) {
    throw new Error('The model returned no valid MCQ answer.');
  }
  return data.answer.trim();
}
