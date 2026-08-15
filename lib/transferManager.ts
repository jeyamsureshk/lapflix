import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { getServerUrl } from '@/lib/storage';

export interface TransferItem {
  id: string;
  name: string;
  type: 'upload' | 'download';
  progress: number;
  status: 'active' | 'completed' | 'failed' | 'paused';
  uri?: string;
  error?: string;
}

type Listener = (transfers: TransferItem[]) => void;

const HISTORY_FILE = `${FileSystem.documentDirectory}transfer_history.json`;

class TransferManager {
  private transfers: TransferItem[] = [];
  private listeners: Listener[] = [];
  
  private activeDownloads = new Map<string, FileSystem.DownloadResumable>();
  private activeUploads = new Map<string, FileSystem.UploadTask>();

  constructor() {
    this.loadHistory();
  }

  // --- Persistence Methods ---

  private async loadHistory() {
    try {
      const fileInfo = await FileSystem.getInfoAsync(HISTORY_FILE);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(HISTORY_FILE);
        const parsed: TransferItem[] = JSON.parse(content);
        
        // If the app was closed while a file was downloading/uploading, 
        // the background task is dead. Mark them as failed so they don't get stuck.
        this.transfers = parsed.map(t => 
          (t.status === 'active' || t.status === 'paused') 
            ? { ...t, status: 'failed', error: 'App closed during transfer' } 
            : t
        );
        this.notify();
      }
    } catch (e) {
      console.error("Could not load transfer history", e);
    }
  }

  private async saveHistory() {
    try {
      await FileSystem.writeAsStringAsync(HISTORY_FILE, JSON.stringify(this.transfers));
    } catch (e) {
      console.error("Could not save transfer history", e);
    }
  }

  // --- Core Methods ---

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    listener(this.transfers);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.transfers));
  }

  cancelTransfer(id: string) {
    const download = this.activeDownloads.get(id);
    if (download) {
      download.cancelAsync().catch(() => {});
      this.activeDownloads.delete(id);
    }
    
    const upload = this.activeUploads.get(id);
    if (upload) {
      upload.cancelAsync().catch(() => {});
      this.activeUploads.delete(id);
    }
    
    // Remove from UI and save the new cleared history
    this.transfers = this.transfers.filter((t) => t.id !== id);
    this.notify();
    this.saveHistory();
  }

  async pauseTransfer(id: string) {
    const item = this.transfers.find(t => t.id === id);
    if (!item || item.status !== 'active') return;

    if (item.type === 'download') {
      const download = this.activeDownloads.get(id);
      if (download) {
        await download.pauseAsync();
        this.updateStatus(id, 'paused');
      }
    } else {
      const upload = this.activeUploads.get(id);
      if (upload) {
        upload.cancelAsync().catch(() => {});
        this.activeUploads.delete(id);
        this.updateStatus(id, 'paused');
      }
    }
  }

  async resumeTransfer(id: string) {
    const item = this.transfers.find(t => t.id === id);
    if (!item || item.status !== 'paused') return;

    this.updateStatus(id, 'active');

    if (item.type === 'download') {
      const download = this.activeDownloads.get(id);
      if (download) {
        try {
          const result = await download.resumeAsync();
          if (result?.uri) {
             this.updateStatus(id, 'completed', result.uri);
          }
        } catch (e) {
          this.updateStatus(id, 'failed');
        } finally {
          this.activeDownloads.delete(id);
        }
      }
    } else {
      if (item.uri) {
        this.startUpload(item.uri, item.name, '', undefined, id);
      }
    }
  }

  async startDownload(path: string, name: string) {
    const id = Date.now().toString();
    const serverUrl = await getServerUrl();
    if (!serverUrl) throw new Error('Server URL not configured');

    const downloadUrl = `${serverUrl}/api/stream?path=${encodeURIComponent(path)}`;
    const safeName = name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

    const fileUri = Platform.OS === 'android' 
      ? `file:///storage/emulated/0/Download/${safeName}`
      : `${FileSystem.documentDirectory}${safeName}`;

    const newItem: TransferItem = { id, name, type: 'download', progress: 0, status: 'active' };
    this.transfers = [newItem, ...this.transfers];
    this.notify();
    this.saveHistory(); // Save the newly added item

    const resumable = FileSystem.createDownloadResumable(
      downloadUrl,
      fileUri,
      {},
      (data) => {
        if (data.totalBytesExpectedToWrite > 0) {
          const progress = data.totalBytesWritten / data.totalBytesExpectedToWrite;
          this.updateProgress(id, Math.min(progress, 1));
        }
      }
    );

    this.activeDownloads.set(id, resumable);

    try {
      const result = await resumable.downloadAsync();
      if (!result?.uri) throw new Error('Download failed');
      this.updateStatus(id, 'completed', result.uri);
    } catch (e: any) {
      if (e.message?.includes('cancelled')) return;
      this.updateStatus(id, 'failed', undefined, e.message);
    } finally {
      if (this.transfers.find(t => t.id === id)?.status === 'completed') {
        this.activeDownloads.delete(id);
      }
    }
  }

  async startUpload(
    uri: string,
    name: string,
    targetPath: string,
    onProgress?: (progress: number) => void,
    existingId?: string
  ) {
    const id = existingId || Date.now().toString();
    const serverUrl = await getServerUrl();
    if (!serverUrl) throw new Error('Server URL not configured');

    if (!existingId) {
      const newItem: TransferItem = { id, name, type: 'upload', progress: 0, status: 'active', uri };
      this.transfers = [newItem, ...this.transfers];
      this.notify();
      this.saveHistory(); // Save the newly added item
    }

    const uploadTask = FileSystem.createUploadTask(
      `${serverUrl}/api/upload`,
      uri,
      {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'X-File-Name': name,
          'X-File-Path': targetPath || '',
        },
      },
      (data) => {
        if (data.totalBytesExpectedToSend > 0) {
          const progress = data.totalBytesSent / data.totalBytesExpectedToSend;
          const clamped = Math.min(progress, 1);
          this.updateProgress(id, clamped);
          if (onProgress) onProgress(clamped);
        }
      }
    );

    this.activeUploads.set(id, uploadTask);

    try {
      const result = await uploadTask.uploadAsync();
      if (!result || result.status !== 200) throw new Error('Upload failed');
      this.updateStatus(id, 'completed');
    } catch (e: any) {
      if (e.message?.includes('cancelled')) return;
      this.updateStatus(id, 'failed');
    } finally {
      if (this.transfers.find(t => t.id === id)?.status === 'completed') {
         this.activeUploads.delete(id);
      }
    }
  }

  private updateProgress(id: string, progress: number) {
    // Only update memory/UI for progress to prevent heavy disk writing
    this.transfers = this.transfers.map((t) => (t.id === id && t.status === 'active' ? { ...t, progress } : t));
    this.notify();
  }

  private updateStatus(id: string, status: TransferItem['status'], uri?: string, error?: string) {
    this.transfers = this.transfers.map((t) =>
      t.id === id ? { ...t, status, progress: status === 'completed' ? 1 : t.progress, uri: uri || t.uri, error: error || t.error } : t
    );
    this.notify();
    this.saveHistory(); // Save status changes (completed, failed, paused)
  }
}

export const transferManager = new TransferManager();
