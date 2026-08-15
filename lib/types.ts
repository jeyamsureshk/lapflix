export type FileType = 'file' | 'folder' | 'video' | 'photo' | 'text';

export interface FileItem {
  name: string;
  path: string;
  type: FileType;
  size: number;
  modified: string | null;
  ext: string;
}

export interface ListResponse {
  path: string;
  items: FileItem[];
}

export interface HealthResponse {
  ok: boolean;
  root: string;
  hostname: string;
  platform: string;
}

export interface TextResponse {
  path: string;
  content: string;
}

export interface ServerConfig {
  url: string;
  root: string;
}

export const STORAGE_KEYS = {
  SERVER_URL: '@laptop_access_server_url',
} as const;
