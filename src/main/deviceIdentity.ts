import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { execSync } from 'child_process';

export interface DeviceIdentity {
  deviceId: string;
  deviceToken: string;
  deviceName: string;
  platform: string;
  osVersion: string;
  appVersion: string;
  createdAt: string;
}

function getDeviceFilePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'meoow_device.dat');
}

/**
 * Retrieve Windows MachineGuid from registry.
 * Fallback to persistent hardware-salted UUID if inaccessible.
 */
function getWindowsMachineGuid(): string | null {
  if (process.platform !== 'win32') return null;

  try {
    const stdout = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 2000,
    });
    const match = stdout.match(/MachineGuid\s+REG_\w+\s+([0-9a-fA-F-]+)/i);
    if (match && match[1]) {
      return match[1].trim().toLowerCase();
    }
  } catch (err) {
    console.warn('[DeviceIdentity] Unable to query registry MachineGuid:', err);
  }

  return null;
}

/**
 * Generate a deterministic, privacy-preserving deviceId.
 */
function computeDeviceId(): string {
  const machineGuid = getWindowsMachineGuid();
  if (machineGuid) {
    return crypto.createHash('sha256').update(`meoow-v1:${machineGuid}`).digest('hex');
  }
  // Fallback if registry is inaccessible
  return crypto.createHash('sha256').update(`meoow-v1-fallback:${crypto.randomUUID()}`).digest('hex');
}

/**
 * Retrieve or generate persistent device credentials.
 * Stored locally encrypted with Windows DPAPI (safeStorage).
 */
export async function getOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  const filePath = getDeviceFilePath();
  const currentAppVersion = app.getVersion();
  const currentPlatform = process.platform;
  const currentOsVersion = os.release();
  const currentDeviceName = os.hostname() || 'Windows PC';

  try {
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      if (fileBuffer.length > 0) {
        let jsonStr: string;
        if (safeStorage.isEncryptionAvailable()) {
          jsonStr = safeStorage.decryptString(fileBuffer);
        } else {
          jsonStr = fileBuffer.toString('utf8');
        }

        const parsed = JSON.parse(jsonStr);
        if (parsed.deviceId && parsed.deviceToken && typeof parsed.deviceToken === 'string' && parsed.deviceToken.length >= 32) {
          return {
            deviceId: parsed.deviceId,
            deviceToken: parsed.deviceToken,
            deviceName: currentDeviceName,
            platform: currentPlatform,
            osVersion: currentOsVersion,
            appVersion: currentAppVersion,
            createdAt: parsed.createdAt || new Date().toISOString(),
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('[DeviceIdentity] Failed to read existing device credentials, generating fresh:', err?.message || err);
  }

  // Generate fresh identity
  const deviceId = computeDeviceId();
  const deviceToken = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date().toISOString();

  const identity: DeviceIdentity = {
    deviceId,
    deviceToken,
    deviceName: currentDeviceName,
    platform: currentPlatform,
    osVersion: currentOsVersion,
    appVersion: currentAppVersion,
    createdAt,
  };

  try {
    const rawJson = JSON.stringify(identity);
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(rawJson);
      fs.writeFileSync(filePath, encrypted);
    } else {
      fs.writeFileSync(filePath, Buffer.from(rawJson, 'utf8'));
    }
  } catch (err: any) {
    console.error('[DeviceIdentity] Error persisting device credentials:', err?.message || err);
  }

  return identity;
}

