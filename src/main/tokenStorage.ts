import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';

function getTokenFilePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'meoow_auth.dat');
}

export function getAuthToken(): string | null {
  try {
    const filePath = getTokenFilePath();
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const fileBuffer = fs.readFileSync(filePath);
    if (fileBuffer.length === 0) {
      return null;
    }

    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(fileBuffer);
    } else {
      // Fallback decode if safeStorage unavailable
      return fileBuffer.toString('utf-8');
    }
  } catch (err: any) {
    console.error('[TokenStorage] Error reading stored token:', err?.message || err);
    return null;
  }
}

export function setAuthToken(token: string): boolean {
  try {
    const filePath = getTokenFilePath();
    if (!token || typeof token !== 'string') {
      clearAuthToken();
      return true;
    }

    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      fs.writeFileSync(filePath, encrypted);
    } else {
      fs.writeFileSync(filePath, Buffer.from(token, 'utf-8'));
    }
    return true;
  } catch (err: any) {
    console.error('[TokenStorage] Error storing token:', err?.message || err);
    return false;
  }
}

export function clearAuthToken(): boolean {
  try {
    const filePath = getTokenFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (err: any) {
    console.error('[TokenStorage] Error clearing stored token:', err?.message || err);
    return false;
  }
}

