import { getServerUrl } from './storage';
import type { FileItem, HealthResponse, ListResponse, TextResponse } from './types';

class ApiClient {
  private async baseUrl(): Promise<string> {
    const url = await getServerUrl();
    if (!url) throw new Error('Server not configured. Open Settings to set the server URL.');
    return url;
  }

  async checkHealth(): Promise<HealthResponse> {
    const base = await this.baseUrl();
    const res = await fetch(`${base}/api/health`);
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    return res.json();
  }

  async listDirectory(dirPath: string): Promise<ListResponse> {
    const base = await this.baseUrl();
    const res = await fetch(`${base}/api/list?path=${encodeURIComponent(dirPath)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to list directory (${res.status})`);
    }
    return res.json();
  }

  async getTextFile(filePath: string): Promise<TextResponse> {
    const base = await this.baseUrl();
    const res = await fetch(`${base}/api/text?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to read file (${res.status})`);
    }
    return res.json();
  }

  async saveTextFile(filePath: string, content: string): Promise<void> {
    const base = await this.baseUrl();
    const res = await fetch(`${base}/api/text?path=${encodeURIComponent(filePath)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to save file (${res.status})`);
    }
  }

  async createFolder(dirPath: string, name: string): Promise<void> {
    const base = await this.baseUrl();
    const res = await fetch(`${base}/api/folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dirPath, name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to create folder (${res.status})`);
    }
  }

  async renameItem(itemPath: string, newName: string): Promise<void> {
    const base = await this.baseUrl();
    const res = await fetch(`${base}/api/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: itemPath, newName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to rename (${res.status})`);
    }
  }

  async deleteItem(itemPath: string): Promise<void> {
    const base = await this.baseUrl();
    const res = await fetch(`${base}/api/delete?path=${encodeURIComponent(itemPath)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to delete (${res.status})`);
    }
  }

  async uploadFile(dirPath: string, fileName: string, fileBlob: Blob): Promise<void> {
    const base = await this.baseUrl();
    const formData = new FormData();
    formData.append('path', dirPath);
    formData.append('file', fileBlob, fileName);
    const res = await fetch(`${base}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to upload (${res.status})`);
    }
  }

  fileUrl(filePath: string): Promise<string> {
    return this.baseUrl().then((base) => `${base}/api/file?path=${encodeURIComponent(filePath)}`);
  }

  streamUrl(filePath: string): Promise<string> {
    return this.baseUrl().then((base) => `${base}/api/stream?path=${encodeURIComponent(filePath)}`);
  }

  async downloadFile(filePath: string): Promise<Blob> {
    const base = await this.baseUrl();
    const res = await fetch(`${base}/api/file?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    return res.blob();
  }
}

export const api = new ApiClient();

export type { FileItem, HealthResponse, ListResponse, TextResponse };
