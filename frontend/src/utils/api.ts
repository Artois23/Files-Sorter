import type { ImageFile, Album, Settings, OrganizeSummary } from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Folder selection
  async selectFolder(): Promise<{ path: string } | null> {
    return fetchJson('/folders/select');
  },

  // Scanning
  async startScan(folderPath: string): Promise<void> {
    return fetchJson('/scan/start', {
      method: 'POST',
      body: JSON.stringify({ path: folderPath }),
    });
  },

  async getScanStatus(): Promise<{
    isScanning: boolean;
    folderCount: number;
    imageCount: number;
    currentFolder: string;
  }> {
    return fetchJson('/scan/status');
  },

  async cancelScan(): Promise<void> {
    return fetchJson('/scan/cancel', { method: 'POST' });
  },

  // Images
  async getImages(): Promise<ImageFile[]> {
    return fetchJson('/images');
  },

  async updateImages(ids: string[], updates: Partial<ImageFile>): Promise<void> {
    return fetchJson('/images/batch', {
      method: 'PATCH',
      body: JSON.stringify({ ids, updates }),
    });
  },

  // Albums
  async getAlbums(): Promise<Album[]> {
    return fetchJson('/albums');
  },

  async createAlbum(name: string, parentId: string | null = null): Promise<Album> {
    return fetchJson('/albums', {
      method: 'POST',
      body: JSON.stringify({ name, parentId }),
    });
  },

  async updateAlbum(id: string, updates: Partial<Album>): Promise<Album> {
    return fetchJson(`/albums/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteAlbum(id: string): Promise<void> {
    return fetchJson(`/albums/${id}`, { method: 'DELETE' });
  },

  async reorderAlbums(albumOrders: { id: string; order: number; parentId: string | null }[]): Promise<void> {
    return fetchJson('/albums/reorder', {
      method: 'POST',
      body: JSON.stringify({ albums: albumOrders }),
    });
  },

  // Settings
  async getSettings(): Promise<Settings> {
    return fetchJson('/settings');
  },

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    return fetchJson('/settings', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  // Organize
  async getOrganizeSummary(): Promise<OrganizeSummary> {
    return fetchJson('/organize/summary');
  },

  async startOrganize(deleteOriginals: boolean): Promise<void> {
    return fetchJson('/organize/start', {
      method: 'POST',
      body: JSON.stringify({ deleteOriginals }),
    });
  },

  async getOrganizeStatus(): Promise<{
    isOrganizing: boolean;
    total: number;
    completed: number;
    currentFile: string;
    errors: { path: string; reason: string }[];
  }> {
    return fetchJson('/organize/status');
  },

  async cancelOrganize(): Promise<void> {
    return fetchJson('/organize/cancel', { method: 'POST' });
  },

  // File operations
  async showInFinder(path: string): Promise<void> {
    return fetchJson('/files/show-in-finder', {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
  },

  async openWithPreview(path: string): Promise<void> {
    return fetchJson('/files/open-preview', {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
  },

  // Export
  async exportAssignments(): Promise<{ path: string }> {
    return fetchJson('/export/assignments');
  },

  // Clear data
  async clearAllData(): Promise<void> {
    return fetchJson('/data/clear', { method: 'POST' });
  },
};
