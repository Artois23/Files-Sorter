import type { ImageFile, Album, Settings, OrganizeSummary, Vault, OcrProgress } from '../types';

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

  async renameImage(id: string, filename: string): Promise<{ id: string; path: string; filename: string }> {
    return fetchJson(`/images/${id}/rename`, {
      method: 'PATCH',
      body: JSON.stringify({ filename }),
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

  async openFolder(path: string): Promise<void> {
    return fetchJson('/files/open-folder', {
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

  async getAlbumPath(albumId: string): Promise<{ path: string }> {
    return fetchJson(`/albums/${albumId}/path`);
  },

  // Export
  async exportAssignments(): Promise<{ path: string }> {
    return fetchJson('/export/assignments');
  },

  // Clear data
  async clearAllData(): Promise<void> {
    return fetchJson('/data/clear', { method: 'POST' });
  },

  // Vaults
  async getVaults(): Promise<Vault[]> {
    return fetchJson('/vaults');
  },

  async getVault(id: string): Promise<Vault> {
    return fetchJson(`/vaults/${id}`);
  },

  async addVault(path: string, displayName?: string): Promise<Vault> {
    return fetchJson('/vaults', {
      method: 'POST',
      body: JSON.stringify({ path, displayName }),
    });
  },

  async updateVault(id: string, updates: Partial<Vault>): Promise<Vault> {
    return fetchJson(`/vaults/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async removeVault(id: string): Promise<void> {
    return fetchJson(`/vaults/${id}`, { method: 'DELETE' });
  },

  // Vault-centric operations
  async syncVault(vaultId?: string): Promise<Album[]> {
    return fetchJson('/vault/sync', {
      method: 'POST',
      body: JSON.stringify({ vaultId }),
    });
  },

  async createVaultFolder(name: string, parentId: string | null = null, vaultId?: string): Promise<Album> {
    return fetchJson('/vault/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentId, vaultId }),
    });
  },

  async renameVaultFolder(id: string, name: string): Promise<Album> {
    return fetchJson(`/vault/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  async deleteVaultFolder(id: string, deleteContents: boolean = false): Promise<void> {
    return fetchJson(`/vault/folders/${id}?deleteContents=${deleteContents}`, {
      method: 'DELETE',
    });
  },

  async moveVaultFolder(id: string, parentId: string | null): Promise<Album> {
    return fetchJson(`/vault/folders/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ parentId }),
    });
  },

  async moveImageToAlbum(imageId: string, albumId: string | null): Promise<ImageFile> {
    return fetchJson(`/vault/images/${imageId}/move`, {
      method: 'POST',
      body: JSON.stringify({ albumId }),
    });
  },

  async trashImage(imageId: string): Promise<void> {
    return fetchJson(`/vault/images/${imageId}/trash`, {
      method: 'POST',
    });
  },

  async sortLaterImage(imageId: string): Promise<ImageFile> {
    return fetchJson(`/vault/images/${imageId}/sort-later`, {
      method: 'POST',
    });
  },

  async batchMoveImages(imageIds: string[], albumId: string | null): Promise<{
    message: string;
    results: { id: string; success: boolean; error?: string }[];
  }> {
    return fetchJson('/vault/images/batch-move', {
      method: 'POST',
      body: JSON.stringify({ imageIds, albumId }),
    });
  },

  async batchTrashImages(imageIds: string[]): Promise<{
    results: { id: string; success: boolean; path?: string; filename?: string; error?: string }[];
  }> {
    return fetchJson('/vault/images/batch-trash', {
      method: 'POST',
      body: JSON.stringify({ imageIds }),
    });
  },

  async getTrashInfo(): Promise<{ count: number; size: number }> {
    return fetchJson('/vault/trash/info');
  },

  async emptyTrash(): Promise<{ deletedCount: number }> {
    return fetchJson('/vault/trash/empty', { method: 'POST' });
  },

  // Thumbnail regeneration
  async regenerateThumbnails(
    imageIds: string[] | 'all',
    size: number
  ): Promise<{ processed: number; errors: number }> {
    return fetchJson('/thumbnails/regenerate', {
      method: 'POST',
      body: JSON.stringify({ imageIds, size }),
    });
  },

  // OCR
  async processOCR(
    imageIds: string[],
    force: boolean = false
  ): Promise<{ message: string; total: number; skipped: number }> {
    return fetchJson('/images/ocr/process', {
      method: 'POST',
      body: JSON.stringify({ imageIds, force }),
    });
  },

  async getOCRStatus(): Promise<OcrProgress> {
    return fetchJson('/images/ocr/status');
  },

  async cancelOCR(): Promise<void> {
    return fetchJson('/images/ocr/cancel', { method: 'POST' });
  },

  async searchOCR(query: string): Promise<string[]> {
    return fetchJson(`/images/ocr/search?q=${encodeURIComponent(query)}`);
  },
};
