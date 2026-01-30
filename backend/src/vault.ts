import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { database } from './database.js';
import { scanner } from './scanner.js';
import type { Album } from './types.js';

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif',
  '.heic', '.heif', '.avif', '.raw', '.cr2', '.nef', '.arw', '.dng',
  '.orf', '.rw2', '.pef', '.sr2', '.raf'
]);

const isImageFile = (filename: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
};

// Special folders that shouldn't be treated as albums
const SPECIAL_FOLDERS = new Set(['_Trash', '_Sort Later', '.DS_Store']);

const sanitizeFilename = (name: string): string => {
  return name.replace(/[/\\:*?"<>|]/g, '_');
};

// Move file with cross-filesystem fallback
const moveFile = async (sourcePath: string, targetPath: string): Promise<void> => {
  try {
    await fs.rename(sourcePath, targetPath);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EXDEV') {
      await fs.copyFile(sourcePath, targetPath);
      await fs.unlink(sourcePath);
    } else {
      throw error;
    }
  }
};

// Get unique filename if conflict exists
const getUniqueFilename = async (targetDir: string, filename: string): Promise<string> => {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let counter = 0;
  let targetPath = path.join(targetDir, filename);

  while (true) {
    try {
      await fs.access(targetPath);
      counter++;
      targetPath = path.join(targetDir, `${base} (${counter})${ext}`);
    } catch {
      return targetPath;
    }
  }
};

export interface VaultAlbum {
  id: string;
  name: string;
  parentId: string | null;
  path: string; // Relative path from vault root
  order: number;
}

export interface VaultImage {
  id: string;
  path: string;
  filename: string;
  albumPath: string; // Relative path of containing album
}

export const vault = {
  /**
   * Scan vault folder and return folder structure as albums
   * This syncs the database albums with actual vault folders
   */
  async scanVault(): Promise<VaultAlbum[]> {
    const settings = database.getSettings();
    if (!settings.vaultFolder) {
      return [];
    }

    const vaultPath = settings.vaultFolder;
    const albums: VaultAlbum[] = [];
    let orderCounter = 0;

    // Recursive function to scan directories
    const scanDir = async (dirPath: string, parentId: string | null, relativePath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (SPECIAL_FOLDERS.has(entry.name)) continue;
          if (entry.name.startsWith('.')) continue;

          const folderRelPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
          const folderAbsPath = path.join(dirPath, entry.name);

          const album: VaultAlbum = {
            id: uuid(),
            name: entry.name,
            parentId,
            path: folderRelPath,
            order: orderCounter++,
          };

          albums.push(album);

          // Recursively scan subdirectories
          await scanDir(folderAbsPath, album.id, folderRelPath);
        }
      } catch (error) {
        console.error(`Failed to scan directory ${dirPath}:`, error);
      }
    };

    await scanDir(vaultPath, null, '');
    return albums;
  },

  /**
   * Sync vault folders with database albums and scan images in vault
   * Creates albums for folders that exist, removes albums for folders that don't
   * Also discovers images in vault folders and adds them to database
   */
  async syncAlbumsWithVault(): Promise<Album[]> {
    const settings = database.getSettings();
    if (!settings.vaultFolder) {
      return database.getAllAlbums();
    }

    const vaultAlbums = await this.scanVault();

    // Clear existing albums and recreate from vault structure
    // First, get existing albums to preserve any that match
    const existingAlbums = database.getAllAlbums();

    // Create a map of relative path -> existing album
    const pathToExisting = new Map<string, Album>();

    // Build path for each existing album
    const getAlbumPath = (album: Album): string => {
      if (!album.parentId) return sanitizeFilename(album.name);
      const parent = existingAlbums.find(a => a.id === album.parentId);
      if (!parent) return sanitizeFilename(album.name);
      return path.join(getAlbumPath(parent), sanitizeFilename(album.name));
    };

    for (const album of existingAlbums) {
      pathToExisting.set(getAlbumPath(album), album);
    }

    // Now sync: keep albums that match vault folders, create new ones for new folders
    const newAlbums: Album[] = [];
    const pathToNewAlbum = new Map<string, Album>();

    for (const vaultAlbum of vaultAlbums) {
      const existing = pathToExisting.get(vaultAlbum.path);

      // Find parent in new albums
      const parentPath = path.dirname(vaultAlbum.path);
      const parentAlbum = parentPath === '.' ? null : pathToNewAlbum.get(parentPath);

      const album: Album = {
        id: existing?.id || vaultAlbum.id,
        name: vaultAlbum.name,
        parentId: parentAlbum?.id || null,
        order: vaultAlbum.order,
      };

      newAlbums.push(album);
      pathToNewAlbum.set(vaultAlbum.path, album);
    }

    // Update database albums
    database.clearAllAlbums();
    for (const album of newAlbums) {
      database.insertAlbum(album);
    }

    // Now scan images in vault folders and update their album associations
    const existingImages = database.getAllImages();
    const existingImagePaths = new Set(existingImages.map(img => img.path));

    // Scan each album folder for images
    for (const vaultAlbum of vaultAlbums) {
      const album = pathToNewAlbum.get(vaultAlbum.path);
      if (!album) continue;

      const folderPath = path.join(settings.vaultFolder, vaultAlbum.path);

      try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isFile()) continue;
          if (!isImageFile(entry.name)) continue;

          const imagePath = path.join(folderPath, entry.name);

          if (existingImagePaths.has(imagePath)) {
            // Image exists, update its album association
            const existingImage = existingImages.find(img => img.path === imagePath);
            if (existingImage && existingImage.albumId !== album.id) {
              database.updateImages([existingImage.id], { albumId: album.id, status: 'normal' });
            }
          } else {
            // New image in vault, add to database
            try {
              const stat = await fs.stat(imagePath);
              const ext = path.extname(entry.name).toLowerCase().slice(1);

              const imageData = {
                id: uuid(),
                path: imagePath,
                filename: entry.name,
                fileSize: stat.size,
                width: null,
                height: null,
                modifiedDate: stat.mtime.toISOString(),
                thumbnailPath: null,
                isSupported: SUPPORTED_EXTENSIONS.has(`.${ext}`),
                format: ext,
                albumId: album.id,
                status: 'normal' as const,
              };

              database.insertImage(imageData);

              // Generate thumbnail in background (don't await)
              scanner.generateThumbnailForImage(imageData).catch(console.error);
            } catch (err) {
              console.error(`Failed to add image ${imagePath}:`, err);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to scan folder ${folderPath}:`, err);
      }
    }

    return newAlbums;
  },

  /**
   * Create a new folder in the vault
   */
  async createFolder(name: string, parentId: string | null): Promise<Album> {
    const settings = database.getSettings();
    if (!settings.vaultFolder) {
      throw new Error('Vault folder not set');
    }

    const albums = database.getAllAlbums();

    // Build parent path
    let targetDir = settings.vaultFolder;
    if (parentId) {
      const getAlbumPath = (albumId: string): string => {
        const album = albums.find(a => a.id === albumId);
        if (!album) return '';
        if (!album.parentId) return sanitizeFilename(album.name);
        return path.join(getAlbumPath(album.parentId), sanitizeFilename(album.name));
      };
      targetDir = path.join(settings.vaultFolder, getAlbumPath(parentId));
    }

    const folderName = sanitizeFilename(name);
    const folderPath = path.join(targetDir, folderName);

    // Create the folder
    await fs.mkdir(folderPath, { recursive: true });

    // Create album in database
    const maxOrder = Math.max(0, ...albums.map(a => a.order));
    const album: Album = {
      id: uuid(),
      name: folderName,
      parentId: parentId || null,
      order: maxOrder + 1,
    };

    database.insertAlbum(album);
    return album;
  },

  /**
   * Rename a folder in the vault
   */
  async renameFolder(albumId: string, newName: string): Promise<Album> {
    const settings = database.getSettings();
    if (!settings.vaultFolder) {
      throw new Error('Vault folder not set');
    }

    const albums = database.getAllAlbums();
    const album = albums.find(a => a.id === albumId);
    if (!album) {
      throw new Error('Album not found');
    }

    // Build current path
    const getAlbumPath = (a: Album): string => {
      if (!a.parentId) return sanitizeFilename(a.name);
      const parent = albums.find(p => p.id === a.parentId);
      if (!parent) return sanitizeFilename(a.name);
      return path.join(getAlbumPath(parent), sanitizeFilename(a.name));
    };

    const currentPath = path.join(settings.vaultFolder, getAlbumPath(album));
    const parentDir = path.dirname(currentPath);
    const newFolderName = sanitizeFilename(newName);
    const newPath = path.join(parentDir, newFolderName);

    // Rename the folder
    await fs.rename(currentPath, newPath);

    // Update album in database
    database.updateAlbum(albumId, { name: newFolderName });

    return { ...album, name: newFolderName };
  },

  /**
   * Move a folder to a new parent (or top level if parentId is null)
   */
  async moveFolder(albumId: string, newParentId: string | null): Promise<Album> {
    const settings = database.getSettings();
    if (!settings.vaultFolder) {
      throw new Error('Vault folder not set');
    }

    const albums = database.getAllAlbums();
    const album = albums.find(a => a.id === albumId);
    if (!album) {
      throw new Error('Album not found');
    }

    // Don't move if already at the target location
    if (album.parentId === newParentId) {
      return album;
    }

    // Build path helper
    const getAlbumPath = (a: Album): string => {
      if (!a.parentId) return sanitizeFilename(a.name);
      const parent = albums.find(p => p.id === a.parentId);
      if (!parent) return sanitizeFilename(a.name);
      return path.join(getAlbumPath(parent), sanitizeFilename(a.name));
    };

    // Current path
    const currentPath = path.join(settings.vaultFolder, getAlbumPath(album));

    // New parent path
    let newParentPath = settings.vaultFolder;
    if (newParentId) {
      const newParent = albums.find(a => a.id === newParentId);
      if (!newParent) {
        throw new Error('Target parent album not found');
      }
      newParentPath = path.join(settings.vaultFolder, getAlbumPath(newParent));
    }

    const newPath = path.join(newParentPath, sanitizeFilename(album.name));

    // Check if target already exists
    try {
      await fs.access(newPath);
      throw new Error(`A folder named "${album.name}" already exists at the destination`);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code !== 'ENOENT') {
        throw err;
      }
      // ENOENT means folder doesn't exist, which is what we want
    }

    // Move the folder
    await fs.rename(currentPath, newPath);

    // Update database
    const siblingAlbums = albums.filter(a => a.parentId === newParentId);
    const maxOrder = Math.max(0, ...siblingAlbums.map(a => a.order));
    database.updateAlbum(albumId, { parentId: newParentId, order: maxOrder + 1 });

    return { ...album, parentId: newParentId, order: maxOrder + 1 };
  },

  /**
   * Delete a folder from the vault
   */
  async deleteFolder(albumId: string, deleteContents: boolean = false): Promise<void> {
    const settings = database.getSettings();
    if (!settings.vaultFolder) {
      throw new Error('Vault folder not set');
    }

    const albums = database.getAllAlbums();
    const album = albums.find(a => a.id === albumId);
    if (!album) {
      throw new Error('Album not found');
    }

    // Build path
    const getAlbumPath = (a: Album): string => {
      if (!a.parentId) return sanitizeFilename(a.name);
      const parent = albums.find(p => p.id === a.parentId);
      if (!parent) return sanitizeFilename(a.name);
      return path.join(getAlbumPath(parent), sanitizeFilename(a.name));
    };

    const folderPath = path.join(settings.vaultFolder, getAlbumPath(album));

    // Check if folder is empty
    const entries = await fs.readdir(folderPath);
    const hasContents = entries.some(e => !e.startsWith('.'));

    if (hasContents && !deleteContents) {
      throw new Error('Folder is not empty. Set deleteContents=true to delete anyway.');
    }

    // Delete folder (recursively if needed)
    await fs.rm(folderPath, { recursive: true });

    // Delete album and child albums from database
    const deleteAlbumAndChildren = (id: string) => {
      const children = albums.filter(a => a.parentId === id);
      for (const child of children) {
        deleteAlbumAndChildren(child.id);
      }
      database.deleteAlbum(id);
    };

    deleteAlbumAndChildren(albumId);
  },

  /**
   * Move an image to an album folder in the vault
   */
  async moveImageToAlbum(imageId: string, albumId: string | null): Promise<{ newPath: string; filename: string }> {
    const settings = database.getSettings();
    if (!settings.vaultFolder) {
      throw new Error('Vault folder not set');
    }

    const image = database.getImageById(imageId);
    if (!image) {
      throw new Error('Image not found');
    }

    const albums = database.getAllAlbums();

    // Determine target directory
    let targetDir: string;
    if (albumId) {
      const album = albums.find(a => a.id === albumId);
      if (!album) {
        throw new Error('Album not found');
      }

      // Build album path
      const getAlbumPath = (a: typeof album): string => {
        if (!a.parentId) return sanitizeFilename(a.name);
        const parent = albums.find(p => p.id === a.parentId);
        if (!parent) return sanitizeFilename(a.name);
        return path.join(getAlbumPath(parent), sanitizeFilename(a.name));
      };

      targetDir = path.join(settings.vaultFolder, getAlbumPath(album));
    } else {
      // Moving to "no album" - this shouldn't happen in vault-centric mode
      // but we'll handle it by leaving the file where it is
      return { newPath: image.path, filename: image.filename };
    }

    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });

    // Get unique filename in target
    const targetPath = await getUniqueFilename(targetDir, image.filename);
    const newFilename = path.basename(targetPath);

    // Move the file
    await moveFile(image.path, targetPath);

    // Update database
    database.updateImagePath(imageId, targetPath, newFilename);
    database.updateImages([imageId], { albumId, status: 'normal' });

    return { newPath: targetPath, filename: newFilename };
  },

  /**
   * Move an image to trash (always uses vault/_Trash)
   */
  async moveImageToTrash(imageId: string): Promise<void> {
    const settings = database.getSettings();
    const image = database.getImageById(imageId);

    if (!image) {
      throw new Error('Image not found');
    }

    if (!settings.vaultFolder) {
      throw new Error('Vault folder not set');
    }

    // Always move to _Trash folder in vault
    const trashDir = path.join(settings.vaultFolder, '_Trash');
    await fs.mkdir(trashDir, { recursive: true });
    const targetPath = await getUniqueFilename(trashDir, image.filename);
    await moveFile(image.path, targetPath);

    // Remove from database
    database.deleteImages([imageId]);
  },

  /**
   * Move an image to "Sort Later" folder
   */
  async moveImageToSortLater(imageId: string): Promise<{ newPath: string; filename: string }> {
    const settings = database.getSettings();
    if (!settings.vaultFolder) {
      throw new Error('Vault folder not set');
    }

    const image = database.getImageById(imageId);
    if (!image) {
      throw new Error('Image not found');
    }

    const sortLaterDir = path.join(settings.vaultFolder, '_Sort Later');
    await fs.mkdir(sortLaterDir, { recursive: true });

    const targetPath = await getUniqueFilename(sortLaterDir, image.filename);
    const newFilename = path.basename(targetPath);

    await moveFile(image.path, targetPath);

    // Update database - keep in database but mark as not-sure
    database.updateImagePath(imageId, targetPath, newFilename);
    database.updateImages([imageId], { status: 'not-sure', albumId: null });

    return { newPath: targetPath, filename: newFilename };
  },

  /**
   * Empty the trash folder (permanently delete files)
   */
  async emptyTrash(): Promise<{ deletedCount: number }> {
    const settings = database.getSettings();
    if (!settings.vaultFolder) {
      throw new Error('Vault folder not set');
    }

    const trashDir = path.join(settings.vaultFolder, '_Trash');
    let deletedCount = 0;

    try {
      const entries = await fs.readdir(trashDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const filePath = path.join(trashDir, entry.name);
        try {
          if (entry.isDirectory()) {
            await fs.rm(filePath, { recursive: true });
          } else {
            await fs.unlink(filePath);
          }
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete ${filePath}:`, error);
        }
      }

      return { deletedCount };
    } catch (error) {
      // Trash folder doesn't exist or is empty
      return { deletedCount: 0 };
    }
  },

  /**
   * Get trash folder info
   */
  async getTrashInfo(): Promise<{ count: number; size: number }> {
    const settings = database.getSettings();
    if (!settings.vaultFolder) {
      return { count: 0, size: 0 };
    }

    const trashDir = path.join(settings.vaultFolder, '_Trash');
    let count = 0;
    let size = 0;

    try {
      const entries = await fs.readdir(trashDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (entry.isFile()) {
          count++;
          try {
            const stat = await fs.stat(path.join(trashDir, entry.name));
            size += stat.size;
          } catch {
            // Ignore stat errors
          }
        }
      }

      return { count, size };
    } catch {
      return { count: 0, size: 0 };
    }
  },

  /**
   * Get images in a vault album folder
   */
  async getAlbumImages(albumId: string): Promise<VaultImage[]> {
    const settings = database.getSettings();
    if (!settings.vaultFolder) {
      return [];
    }

    const albums = database.getAllAlbums();
    const album = albums.find(a => a.id === albumId);
    if (!album) {
      return [];
    }

    // Build album path
    const getAlbumPath = (a: typeof album): string => {
      if (!a.parentId) return sanitizeFilename(a.name);
      const parent = albums.find(p => p.id === a.parentId);
      if (!parent) return sanitizeFilename(a.name);
      return path.join(getAlbumPath(parent), sanitizeFilename(a.name));
    };

    const albumPath = getAlbumPath(album);
    const folderPath = path.join(settings.vaultFolder, albumPath);

    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      const images: VaultImage[] = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!isImageFile(entry.name)) continue;

        images.push({
          id: uuid(),
          path: path.join(folderPath, entry.name),
          filename: entry.name,
          albumPath,
        });
      }

      return images;
    } catch {
      return [];
    }
  },
};
