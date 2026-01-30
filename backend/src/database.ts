import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import type { ImageFile, Album, Settings } from './types.js';

const DATA_DIR = path.join(os.homedir(), '.image-sorter');
const DB_PATH = path.join(DATA_DIR, 'data.db');
const THUMBNAILS_DIR = path.join(DATA_DIR, 'thumbnails');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(THUMBNAILS_DIR)) {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    modified_date TEXT NOT NULL,
    thumbnail_path TEXT,
    is_supported INTEGER NOT NULL DEFAULT 1,
    format TEXT NOT NULL,
    album_id TEXT,
    status TEXT NOT NULL DEFAULT 'normal',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_images_album ON images(album_id);
  CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);
  CREATE INDEX IF NOT EXISTS idx_images_path ON images(path);
  CREATE INDEX IF NOT EXISTS idx_albums_parent ON albums(parent_id);
`);

// Default settings
const DEFAULT_SETTINGS: Settings = {
  sourceFolder: null,
  vaultFolder: null,
  defaultThumbnailSize: 150,
  showFilenameOverlay: false,
  showStatusBadges: true,
  organizeAction: 'move',
  confirmDestructiveActions: true,
  trashHandling: 'system',
  hideAssigned: false,
};

// Initialize default settings if not present
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!existing) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
  }
}

export const database = {
  getThumbnailsDir: () => THUMBNAILS_DIR,

  // Images
  getAllImages: (): ImageFile[] => {
    const rows = db.prepare(`
      SELECT id, path, filename, file_size as fileSize, width, height,
             modified_date as modifiedDate, thumbnail_path as thumbnailPath,
             is_supported as isSupported, format, album_id as albumId, status
      FROM images
      ORDER BY filename
    `).all() as Array<{
      id: string;
      path: string;
      filename: string;
      fileSize: number;
      width: number | null;
      height: number | null;
      modifiedDate: string;
      thumbnailPath: string | null;
      isSupported: number;
      format: string;
      albumId: string | null;
      status: string;
    }>;

    return rows.map(row => ({
      ...row,
      isSupported: Boolean(row.isSupported),
      status: row.status as 'normal' | 'trash' | 'not-sure',
    }));
  },

  getImageById: (id: string): ImageFile | null => {
    const row = db.prepare(`
      SELECT id, path, filename, file_size as fileSize, width, height,
             modified_date as modifiedDate, thumbnail_path as thumbnailPath,
             is_supported as isSupported, format, album_id as albumId, status
      FROM images WHERE id = ?
    `).get(id) as {
      id: string;
      path: string;
      filename: string;
      fileSize: number;
      width: number | null;
      height: number | null;
      modifiedDate: string;
      thumbnailPath: string | null;
      isSupported: number;
      format: string;
      albumId: string | null;
      status: string;
    } | undefined;

    if (!row) return null;

    return {
      ...row,
      isSupported: Boolean(row.isSupported),
      status: row.status as 'normal' | 'trash' | 'not-sure',
    };
  },

  insertImage: (image: ImageFile): void => {
    db.prepare(`
      INSERT OR REPLACE INTO images
      (id, path, filename, file_size, width, height, modified_date, thumbnail_path, is_supported, format, album_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      image.id,
      image.path,
      image.filename,
      image.fileSize,
      image.width,
      image.height,
      image.modifiedDate,
      image.thumbnailPath || null,
      image.isSupported ? 1 : 0,
      image.format,
      image.albumId,
      image.status
    );
  },

  updateImages: (ids: string[], updates: Partial<ImageFile>): void => {
    const setClauses: string[] = [];
    const params: (string | number | null)[] = [];

    if (updates.albumId !== undefined) {
      setClauses.push('album_id = ?');
      params.push(updates.albumId);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }

    if (setClauses.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    const sql = `UPDATE images SET ${setClauses.join(', ')} WHERE id IN (${placeholders})`;

    db.prepare(sql).run(...params, ...ids);
  },

  deleteImages: (ids: string[]): void => {
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM images WHERE id IN (${placeholders})`).run(...ids);
  },

  updateImagePath: (id: string, newPath: string, newFilename: string): void => {
    db.prepare('UPDATE images SET path = ?, filename = ? WHERE id = ?').run(newPath, newFilename, id);
  },

  updateImageThumbnail: (id: string, thumbnailPath: string, width?: number | null, height?: number | null): void => {
    if (width !== undefined && height !== undefined) {
      db.prepare('UPDATE images SET thumbnail_path = ?, width = ?, height = ? WHERE id = ?').run(thumbnailPath, width, height, id);
    } else {
      db.prepare('UPDATE images SET thumbnail_path = ? WHERE id = ?').run(thumbnailPath, id);
    }
  },

  clearAllImages: (): void => {
    db.prepare('DELETE FROM images').run();
  },

  // Albums
  getAllAlbums: (): Album[] => {
    return db.prepare(`
      SELECT id, name, parent_id as parentId, "order"
      FROM albums
      ORDER BY "order"
    `).all() as Album[];
  },

  getAlbumById: (id: string): Album | null => {
    return db.prepare(`
      SELECT id, name, parent_id as parentId, "order"
      FROM albums WHERE id = ?
    `).get(id) as Album | null;
  },

  insertAlbum: (album: Album): void => {
    db.prepare(`
      INSERT INTO albums (id, name, parent_id, "order")
      VALUES (?, ?, ?, ?)
    `).run(album.id, album.name, album.parentId, album.order);
  },

  updateAlbum: (id: string, updates: Partial<Album>): void => {
    const setClauses: string[] = [];
    const params: (string | number | null)[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      params.push(updates.name);
    }
    if (updates.parentId !== undefined) {
      setClauses.push('parent_id = ?');
      params.push(updates.parentId);
    }
    if (updates.order !== undefined) {
      setClauses.push('"order" = ?');
      params.push(updates.order);
    }

    if (setClauses.length === 0) return;

    params.push(id);
    db.prepare(`UPDATE albums SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
  },

  deleteAlbum: (id: string): void => {
    // Get all descendant album IDs
    const getDescendants = (parentId: string): string[] => {
      const children = db.prepare('SELECT id FROM albums WHERE parent_id = ?').all(parentId) as { id: string }[];
      return children.flatMap(c => [c.id, ...getDescendants(c.id)]);
    };

    const idsToDelete = [id, ...getDescendants(id)];
    const placeholders = idsToDelete.map(() => '?').join(',');

    // Move images to orphans
    db.prepare(`UPDATE images SET album_id = NULL WHERE album_id IN (${placeholders})`).run(...idsToDelete);

    // Delete albums
    db.prepare(`DELETE FROM albums WHERE id IN (${placeholders})`).run(...idsToDelete);
  },

  reorderAlbums: (albums: { id: string; order: number; parentId: string | null }[]): void => {
    const stmt = db.prepare('UPDATE albums SET "order" = ?, parent_id = ? WHERE id = ?');
    const transaction = db.transaction(() => {
      for (const album of albums) {
        stmt.run(album.order, album.parentId, album.id);
      }
    });
    transaction();
  },

  clearAllAlbums: (): void => {
    db.prepare('DELETE FROM albums').run();
  },

  // Settings
  getSettings: (): Settings => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings = { ...DEFAULT_SETTINGS };

    for (const row of rows) {
      try {
        (settings as Record<string, unknown>)[row.key] = JSON.parse(row.value);
      } catch {
        // Keep default value
      }
    }

    return settings;
  },

  updateSettings: (updates: Partial<Settings>): void => {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        stmt.run(key, JSON.stringify(value));
      }
    });
    transaction();
  },

  // Clear all data
  clearAll: (): void => {
    db.prepare('DELETE FROM images').run();
    db.prepare('DELETE FROM albums').run();
  },
};
