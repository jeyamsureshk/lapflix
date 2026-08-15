import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, type ServerConfig } from './types';

const DEFAULT_URL = '';

export async function getServerUrl(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL)) || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

export async function setServerUrl(url: string): Promise<void> {
  const normalized = url.trim().replace(/\/+$/, '');
  await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, normalized);
}

export async function getServerConfig(): Promise<ServerConfig> {
  const url = await getServerUrl();
  return { url, root: '' };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function joinPath(base: string, name: string): string {
  if (!base || base === '/') return name;
  return base + '/' + name;
}

export function parentPath(p: string): string {
  if (!p || p === '/') return '';
  const idx = p.lastIndexOf('/');
  if (idx <= 0) return '';
  return p.slice(0, idx);
}
