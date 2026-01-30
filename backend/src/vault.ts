import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { database } from './database.js';
import { scanner } from './scanner.js';
import type { Album, Vault } from './types.js';

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

// Vault log file name
const VAULT_LOG_FILENAME = '.image-sorter-log.md';

// Log entry types
type LogAction = 'MOVE' | 'DELETE' | 'RENAME' | 'RESTORE' | 'CREATE' | 'VAULT_ADDED' | 'SYNC';

// Write an entry to the vault's log file
const writeVaultLog = async (vaultPath: string, action: LogAction, details: string): Promise<void> => {
  const logPath = path.join(vaultPath, VAULT_LOG_FILENAME);
  const timestamp = new Date().toISOString();
  const entry = `| ${timestamp} | ${action} | ${details} |\n`;

  try {
    // Check if file exists
    try {
      await fs.access(logPath);
    } catch {
      // Create new log file with header
      const header = `# Image Sorter Activity Log

This file tracks all file operations performed by Image Sorter in this vault.

| Timestamp | Action | Details |
|-----------|--------|---------|
`;
      await fs.writeFile(logPath, header, 'utf-8');
    }

    // Append entry
    await fs.appendFile(logPath, entry, 'utf-8');
  } catch (error) {
    console.error('Failed to write vault log:', error);
  }
};

// Initialize log for a vault (called when vault is added)
const initVaultLog = async (vaultPath: string, displayName: string): Promise<void> => {
  await writeVaultLog(vaultPath, 'VAULT_ADDED', `Vault "${displayName}" added to Image Sorter`);
};

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
  vaultId: string;
  path: string; // Relative path from vault root
  order: number;
}

export interface VaultImage {
  id: string;
  path: string;
  filename: string;
  albumPath: string; // Relative path of containing album
  vaultId: string;
}

export const vault = {
  /**
   * Scan a specific vault folder and return folder structure as albums
   */
  async scanVaultFolder(vaultId: string): Promise<VaultAlbum[]> {
    const vaultRecord = database.getVaultById(vaultId);
    if (!vaultRecord) {
      return [];
    }

    const vaultPath = vaultRecord.path;
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
            vaultId,
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
   * Legacy: Scan vault folder from settings (for backwards compatibility)
   */
  async scanVault(): Promise<VaultAlbum[]> {
    const settings = database.getSettings();
    if (!settings.vaultFolder) {
      return [];
    }

    // Check if there's a vault with this path, or create one
    const vaults = database.getAllVaults();
    let existingVault = vaults.find(v => v.path === settings.vaultFolder);

    if (!existingVault) {
      // Create a vault from the legacy setting
      const folderName = path.basename(settings.vaultFolder!);
      const newVault: Vault = {
        id: uuid(),
        path: settings.vaultFolder!,
        displayName: folderName,
        isVisible: true,
        order: vaults.length,
      };
      database.insertVault(newVault);
      existingVault = newVault;
    }

    return this.scanVaultFolder(existingVault.id);
  },

  /**
   * Sync a specific vault's folders with database albums and scan images
   */
  async syncVault(vaultId: string): Promise<Album[]> {
    const vaultRecord = database.getVaultById(vaultId);
    if (!vaultRecord) {
      throw new Error('Vault not found');
    }

    const vaultAlbums = await this.scanVaultFolder(vaultId);

    // Get existing albums for this vault
    const existingAlbums = database.getAlbumsByVault(vaultId);

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
        vaultId: vaultId,
        order: vaultAlbum.order,
      };

      newAlbums.push(album);
      pathToNewAlbum.set(vaultAlbum.path, album);
    }

    // Delete old albums for this vault and insert new ones
    const albumsToDelete = existingAlbums.filter(ea => !newAlbums.find(na => na.id === ea.id));
    for (const album of albumsToDelete) {
      database.deleteAlbum(album.id);
    }

    // Insert or update albums
    for (const album of newAlbums) {
      const existing = existingAlbums.find(ea => ea.id === album.id);
      if (existing) {
        database.updateAlbum(album.id, album);
      } else {
        database.insertAlbum(album);
      }
    }

    // Now scan images in vault folders and update their album/vault associations
    const existingImages = database.getAllImages();
    const existingImagePaths = new Set(existingImages.map(img => img.path));

    // Scan each album folder for images
    for (const vaultAlbum of vaultAlbums) {
      const album = pathToNewAlbum.get(vaultAlbum.path);
      if (!album) continue;

      const folderPath = path.join(vaultRecord.path, vaultAlbum.path);

      try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isFile()) continue;
          if (!isImageFile(entry.name)) continue;

          const imagePath = path.join(folderPath, entry.name);

          if (existingImagePaths.has(imagePath)) {
            // Image exists, update its album/vault association
            const existingImage = existingImages.find(img => img.path === imagePath);
            if (existingImage && (existingImage.albumId !== album.id || existingImage.vaultId !== vaultId)) {
              database.updateImages([existingImage.id], { albumId: album.id, vaultId, status: 'normal' });
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
                vaultId: vaultId,
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

    // Migrate orphaned images: claim any images whose path starts with vault path but have no vaultId
    const orphanedImages = existingImages.filter(img =>
      img.vaultId === null && img.path.startsWith(vaultRecord.path)
    );

    for (const img of orphanedImages) {
      // Try to find matching album based on image path
      let matchedAlbumId: string | null = null;

      for (const [albumRelPath, album] of pathToNewAlbum.entries()) {
        const albumAbsPath = path.join(vaultRecord.path, albumRelPath);
        if (img.path.startsWith(albumAbsPath + '/')) {
          // Check if this is the most specific match (deepest folder)
          if (!matchedAlbumId || albumRelPath.length > (pathToNewAlbum.get(matchedAlbumId)?.name.length || 0)) {
            matchedAlbumId = album.id;
          }
        }
      }

      database.updateImages([img.id], { vaultId, albumId: matchedAlbumId });
    }

    if (orphanedImages.length > 0) {
      console.log(`Migrated ${orphanedImages.length} orphaned images to vault ${vaultRecord.displayName}`);
    }

    // Log the sync
    await writeVaultLog(vaultRecord.path, 'SYNC', `Synced vault: ${newAlbums.length} folders, ${orphanedImages.length} migrated images`);

    return newAlbums;
  },

  /**
   * Sync all vaults
   */
  async syncAllVaults(): Promise<Album[]> {
    const vaults = database.getAllVaults();
    const allAlbums: Album[] = [];

    for (const vaultRecord of vaults) {
      const albums = await this.syncVault(vaultRecord.id);
      allAlbums.push(...albums);
    }

    return allAlbums;
  },

  /**
   * Legacy: Sync vault folders with database albums (for backwards compatibility)
   */
  async syncAlbumsWithVault(): Promise<Album[]> {
    const settings = database.getSettings();
    if (!settings.vaultFolder) {
      return database.getAllAlbums();
    }

    // Check if there's a vault with this path, or create one
    const vaults = database.getAllVaults();
    let existingVault = vaults.find(v => v.path === settings.vaultFolder);

    if (!existingVault) {
      // Create a vault from the legacy setting
      const folderName = path.basename(settings.vaultFolder!);
      const newVault: Vault = {
        id: uuid(),
        path: settings.vaultFolder!,
        displayName: folderName,
        isVisible: true,
        order: vaults.length,
      };
      database.insertVault(newVault);
      existingVault = newVault;
    }

    return this.syncVault(existingVault.id);
  },

  /**
   * Create a new folder in a vault
   */
  async createFolder(name: string, parentId: string | null, vaultId?: string): Promise<Album> {
    const albums = database.getAllAlbums();
    let resolvedVaultId = vaultId;

    // If no vaultId provided, try to get it from parent or use legacy setting
    if (!resolvedVaultId && parentId) {
      const parentAlbum = albums.find(a => a.id === parentId);
      if (parentAlbum) {
        resolvedVaultId = parentAlbum.vaultId;
      }
    }

    if (!resolvedVaultId) {
      // Fallback to legacy: use settings.vaultFolder
      const settings = database.getSettings();
      if (!settings.vaultFolder) {
        throw new Error('No vault specified and no default vault folder set');
      }

      // Find or create vault for legacy setting
      const vaults = database.getAllVaults();
      let existingVault = vaults.find(v => v.path === settings.vaultFolder);

      if (!existingVault) {
        const folderName = path.basename(settings.vaultFolder!);
        existingVault = {
          id: uuid(),
          path: settings.vaultFolder!,
          displayName: folderName,
          isVisible: true,
          order: vaults.length,
        };
        database.insertVault(existingVault);
      }

      resolvedVaultId = existingVault.id;
    }

    const vaultRecord = database.getVaultById(resolvedVaultId);
    if (!vaultRecord) {
      throw new Error('Vault not found');
    }

    // Build parent path
    let targetDir = vaultRecord.path;
    if (parentId) {
      const getAlbumPath = (albumId: string): string => {
        const album = albums.find(a => a.id === albumId);
        if (!album) return '';
        if (!album.parentId) return sanitizeFilename(album.name);
        return path.join(getAlbumPath(album.parentId), sanitizeFilename(album.name));
      };
      targetDir = path.join(vaultRecord.path, getAlbumPath(parentId));
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
      vaultId: resolvedVaultId,
      order: maxOrder + 1,
    };

    database.insertAlbum(album);

    // Log folder creation
    const relativePath = folderPath.replace(vaultRecord.path, '');
    await writeVaultLog(vaultRecord.path, 'CREATE', `Created folder "${relativePath}"`);

    return album;
  },

  /**
   * Rename a folder in the vault
   */
  async renameFolder(albumId: string, newName: string): Promise<Album> {
    const albums = database.getAllAlbums();
    const album = albums.find(a => a.id === albumId);
    if (!album) {
      throw new Error('Album not found');
    }

    const vaultRecord = database.getVaultById(album.vaultId);
    if (!vaultRecord) {
      throw new Error('Vault not found for this album');
    }

    // Build current path
    const getAlbumPath = (a: Album): string => {
      if (!a.parentId) return sanitizeFilename(a.name);
      const parent = albums.find(p => p.id === a.parentId);
      if (!parent) return sanitizeFilename(a.name);
      return path.join(getAlbumPath(parent), sanitizeFilename(a.name));
    };

    const currentPath = path.join(vaultRecord.path, getAlbumPath(album));
    const parentDir = path.dirname(currentPath);
    const newFolderName = sanitizeFilename(newName);
    const newPath = path.join(parentDir, newFolderName);

    // Rename the folder
    await fs.rename(currentPath, newPath);

    // Log the rename
    const relativeOld = currentPath.replace(vaultRecord.path, '');
    const relativeNew = newPath.replace(vaultRecord.path, '');
    await writeVaultLog(vaultRecord.path, 'RENAME', `"${relativeOld}" → "${relativeNew}"`);

    // Update album in database
    database.updateAlbum(albumId, { name: newFolderName });

    return { ...album, name: newFolderName };
  },

  /**
   * Move a folder to a new parent (or top level if parentId is null)
   * Can also move between vaults if targetVaultId is provided
   */
  async moveFolder(albumId: string, newParentId: string | null, targetVaultId?: string): Promise<Album> {
    const albums = database.getAllAlbums();
    const album = albums.find(a => a.id === albumId);
    if (!album) {
      throw new Error('Album not found');
    }

    const sourceVaultRecord = database.getVaultById(album.vaultId);
    if (!sourceVaultRecord) {
      throw new Error('Source vault not found');
    }

    // Determine target vault
    let targetVault = sourceVaultRecord;
    let resolvedVaultId = album.vaultId;

    if (targetVaultId && targetVaultId !== album.vaultId) {
      const tv = database.getVaultById(targetVaultId);
      if (!tv) {
        throw new Error('Target vault not found');
      }
      targetVault = tv;
      resolvedVaultId = targetVaultId;
    } else if (newParentId) {
      // Get vault from parent
      const newParent = albums.find(a => a.id === newParentId);
      if (newParent && newParent.vaultId !== album.vaultId) {
        const tv = database.getVaultById(newParent.vaultId);
        if (!tv) {
          throw new Error('Target parent vault not found');
        }
        targetVault = tv;
        resolvedVaultId = newParent.vaultId;
      }
    }

    // Don't move if already at the target location in the same vault
    if (album.parentId === newParentId && album.vaultId === resolvedVaultId) {
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
    const currentPath = path.join(sourceVaultRecord.path, getAlbumPath(album));

    // New parent path
    let newParentPath = targetVault.path;
    if (newParentId) {
      const newParent = albums.find(a => a.id === newParentId);
      if (!newParent) {
        throw new Error('Target parent album not found');
      }
      const parentVault = database.getVaultById(newParent.vaultId);
      if (!parentVault) {
        throw new Error('Parent vault not found');
      }
      newParentPath = path.join(parentVault.path, getAlbumPath(newParent));
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

    // Move the folder (use moveFile helper for cross-filesystem support)
    await moveFile(currentPath, newPath);

    // Update database
    const siblingAlbums = albums.filter(a => a.parentId === newParentId && a.vaultId === resolvedVaultId);
    const maxOrder = Math.max(0, ...siblingAlbums.map(a => a.order));
    database.updateAlbum(albumId, { parentId: newParentId, vaultId: resolvedVaultId, order: maxOrder + 1 });

    // If moved to different vault, update all child albums and images
    if (resolvedVaultId !== album.vaultId) {
      const updateChildrenVault = (parentId: string) => {
        const children = albums.filter(a => a.parentId === parentId);
        for (const child of children) {
          database.updateAlbum(child.id, { vaultId: resolvedVaultId });
          updateChildrenVault(child.id);
        }
      };
      updateChildrenVault(albumId);

      // Update images in this album
      const images = database.getAllImages();
      const imagesToUpdate = images.filter(img => img.albumId === albumId);
      if (imagesToUpdate.length > 0) {
        database.updateImages(imagesToUpdate.map(img => img.id), { vaultId: resolvedVaultId });
      }
    }

    // Log the folder move
    const relativeOld = currentPath.replace(sourceVaultRecord.path, '');
    const relativeNew = newPath.replace(targetVault.path, '');
    if (sourceVaultRecord.id === targetVault.id) {
      await writeVaultLog(sourceVaultRecord.path, 'MOVE', `Folder "${relativeOld}" → "${relativeNew}"`);
    } else {
      await writeVaultLog(sourceVaultRecord.path, 'MOVE', `Folder "${relativeOld}" moved to vault "${targetVault.displayName}"`);
      await writeVaultLog(targetVault.path, 'MOVE', `Folder "${relativeNew}" moved from vault "${sourceVaultRecord.displayName}"`);
    }

    return { ...album, parentId: newParentId, vaultId: resolvedVaultId, order: maxOrder + 1 };
  },

  /**
   * Delete a folder from the vault
   */
  async deleteFolder(albumId: string, deleteContents: boolean = false): Promise<void> {
    const albums = database.getAllAlbums();
    const album = albums.find(a => a.id === albumId);
    if (!album) {
      throw new Error('Album not found');
    }

    const vaultRecord = database.getVaultById(album.vaultId);
    if (!vaultRecord) {
      throw new Error('Vault not found for this album');
    }

    // Build path
    const getAlbumPath = (a: Album): string => {
      if (!a.parentId) return sanitizeFilename(a.name);
      const parent = albums.find(p => p.id === a.parentId);
      if (!parent) return sanitizeFilename(a.name);
      return path.join(getAlbumPath(parent), sanitizeFilename(a.name));
    };

    const folderPath = path.join(vaultRecord.path, getAlbumPath(album));

    // Check if folder is empty
    const entries = await fs.readdir(folderPath);
    const hasContents = entries.some(e => !e.startsWith('.'));

    if (hasContents && !deleteContents) {
      throw new Error('Folder is not empty. Set deleteContents=true to delete anyway.');
    }

    // Log the deletion before removing
    const relativePath = folderPath.replace(vaultRecord.path, '');
    await writeVaultLog(vaultRecord.path, 'DELETE', `Deleted folder "${relativePath}"${hasContents ? ' (with contents)' : ''}`);

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
   * Move an image to an album folder in the vault (supports cross-vault moves)
   */
  async moveImageToAlbum(imageId: string, albumId: string | null): Promise<{ newPath: string; filename: string; vaultId: string | null }> {
    const image = database.getImageById(imageId);
    if (!image) {
      throw new Error('Image not found');
    }

    const albums = database.getAllAlbums();

    // Determine target directory
    let targetDir: string;
    let targetVaultId: string | null = null;

    if (albumId) {
      const album = albums.find(a => a.id === albumId);
      if (!album) {
        throw new Error('Album not found');
      }

      const vaultRecord = database.getVaultById(album.vaultId);
      if (!vaultRecord) {
        throw new Error('Vault not found for target album');
      }

      targetVaultId = album.vaultId;

      // Build album path
      const getAlbumPath = (a: typeof album): string => {
        if (!a.parentId) return sanitizeFilename(a.name);
        const parent = albums.find(p => p.id === a.parentId);
        if (!parent) return sanitizeFilename(a.name);
        return path.join(getAlbumPath(parent), sanitizeFilename(a.name));
      };

      targetDir = path.join(vaultRecord.path, getAlbumPath(album));
    } else {
      // Moving to "no album" - this shouldn't happen in vault-centric mode
      // but we'll handle it by leaving the file where it is
      return { newPath: image.path, filename: image.filename, vaultId: image.vaultId };
    }

    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });

    // Get unique filename in target
    const targetPath = await getUniqueFilename(targetDir, image.filename);
    const newFilename = path.basename(targetPath);

    // Move the file (supports cross-filesystem)
    await moveFile(image.path, targetPath);

    // Update database
    database.updateImagePath(imageId, targetPath, newFilename);
    database.updateImages([imageId], { albumId, vaultId: targetVaultId, status: 'normal' });

    // Log the move
    if (targetVaultId) {
      const vaultRecord = database.getVaultById(targetVaultId);
      if (vaultRecord) {
        const relativeFrom = image.path.replace(vaultRecord.path, '');
        const relativeTo = targetPath.replace(vaultRecord.path, '');
        await writeVaultLog(vaultRecord.path, 'MOVE', `"${relativeFrom}" → "${relativeTo}"`);
      }
    }

    return { newPath: targetPath, filename: newFilename, vaultId: targetVaultId };
  },

  /**
   * Move an image to trash (uses the image's vault's _Trash folder)
   */
  async moveImageToTrash(imageId: string): Promise<void> {
    const image = database.getImageById(imageId);

    if (!image) {
      throw new Error('Image not found');
    }

    // Determine which vault's trash to use
    let vaultPath: string | null = null;

    if (image.vaultId) {
      const vaultRecord = database.getVaultById(image.vaultId);
      if (vaultRecord) {
        vaultPath = vaultRecord.path;
      }
    }

    if (!vaultPath) {
      // Fallback to first visible vault or legacy setting
      const vaults = database.getAllVaults();
      const visibleVault = vaults.find(v => v.isVisible);
      if (visibleVault) {
        vaultPath = visibleVault.path;
      } else {
        const settings = database.getSettings();
        if (settings.vaultFolder) {
          vaultPath = settings.vaultFolder;
        }
      }
    }

    if (!vaultPath) {
      throw new Error('No vault available for trash');
    }

    // Move to _Trash folder in vault
    const trashDir = path.join(vaultPath, '_Trash');
    await fs.mkdir(trashDir, { recursive: true });
    const targetPath = await getUniqueFilename(trashDir, image.filename);
    await moveFile(image.path, targetPath);

    // Log the deletion
    const relativeFrom = image.path.replace(vaultPath, '');
    const relativeTo = targetPath.replace(vaultPath, '');
    await writeVaultLog(vaultPath, 'DELETE', `"${relativeFrom}" → "_Trash/${path.basename(targetPath)}"`);

    // Remove from database
    database.deleteImages([imageId]);
  },

  /**
   * Move an image to "Sort Later" folder (uses the image's vault)
   */
  async moveImageToSortLater(imageId: string): Promise<{ newPath: string; filename: string }> {
    const image = database.getImageById(imageId);
    if (!image) {
      throw new Error('Image not found');
    }

    // Determine which vault's sort later folder to use
    let vaultPath: string | null = null;

    if (image.vaultId) {
      const vaultRecord = database.getVaultById(image.vaultId);
      if (vaultRecord) {
        vaultPath = vaultRecord.path;
      }
    }

    if (!vaultPath) {
      // Fallback to first visible vault or legacy setting
      const vaults = database.getAllVaults();
      const visibleVault = vaults.find(v => v.isVisible);
      if (visibleVault) {
        vaultPath = visibleVault.path;
      } else {
        const settings = database.getSettings();
        if (settings.vaultFolder) {
          vaultPath = settings.vaultFolder;
        }
      }
    }

    if (!vaultPath) {
      throw new Error('No vault available for sort later');
    }

    const sortLaterDir = path.join(vaultPath, '_Sort Later');
    await fs.mkdir(sortLaterDir, { recursive: true });

    const targetPath = await getUniqueFilename(sortLaterDir, image.filename);
    const newFilename = path.basename(targetPath);

    await moveFile(image.path, targetPath);

    // Log the move
    const relativeFrom = image.path.replace(vaultPath, '');
    await writeVaultLog(vaultPath, 'MOVE', `"${relativeFrom}" → "_Sort Later/${newFilename}" (marked for later)`);

    // Update database - keep in database but mark as not-sure
    database.updateImagePath(imageId, targetPath, newFilename);
    database.updateImages([imageId], { status: 'not-sure', albumId: null });

    return { newPath: targetPath, filename: newFilename };
  },

  /**
   * Empty the trash folders (permanently delete files from all vaults)
   */
  async emptyTrash(): Promise<{ deletedCount: number }> {
    const vaults = database.getAllVaults();
    let deletedCount = 0;

    for (const vaultRecord of vaults) {
      const trashDir = path.join(vaultRecord.path, '_Trash');

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
      } catch {
        // Trash folder doesn't exist for this vault
      }
    }

    // Also check legacy vault folder
    const settings = database.getSettings();
    if (settings.vaultFolder && !vaults.find(v => v.path === settings.vaultFolder)) {
      const trashDir = path.join(settings.vaultFolder, '_Trash');
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
      } catch {
        // Trash folder doesn't exist
      }
    }

    return { deletedCount };
  },

  /**
   * Get trash folder info (aggregated across all vaults)
   */
  async getTrashInfo(): Promise<{ count: number; size: number }> {
    const vaults = database.getAllVaults();
    let count = 0;
    let size = 0;

    for (const vaultRecord of vaults) {
      const trashDir = path.join(vaultRecord.path, '_Trash');

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
      } catch {
        // Trash folder doesn't exist for this vault
      }
    }

    // Also check legacy vault folder
    const settings = database.getSettings();
    if (settings.vaultFolder && !vaults.find(v => v.path === settings.vaultFolder)) {
      const trashDir = path.join(settings.vaultFolder, '_Trash');
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
      } catch {
        // Trash folder doesn't exist
      }
    }

    return { count, size };
  },

  /**
   * Get images in a vault album folder
   */
  async getAlbumImages(albumId: string): Promise<VaultImage[]> {
    const albums = database.getAllAlbums();
    const album = albums.find(a => a.id === albumId);
    if (!album) {
      return [];
    }

    const vaultRecord = database.getVaultById(album.vaultId);
    if (!vaultRecord) {
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
    const folderPath = path.join(vaultRecord.path, albumPath);

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
          vaultId: album.vaultId,
        });
      }

      return images;
    } catch {
      return [];
    }
  },

  /**
   * Add a new vault
   */
  async addVault(folderPath: string, displayName?: string): Promise<Vault> {
    // Verify the folder exists
    try {
      const stat = await fs.stat(folderPath);
      if (!stat.isDirectory()) {
        throw new Error('Path is not a directory');
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
        throw new Error('Folder does not exist');
      }
      throw err;
    }

    // Check if vault already exists
    const existingVaults = database.getAllVaults();
    if (existingVaults.find(v => v.path === folderPath)) {
      throw new Error('This folder is already a vault');
    }

    const folderName = displayName || path.basename(folderPath);
    const maxOrder = Math.max(0, ...existingVaults.map(v => v.order));

    const newVault: Vault = {
      id: uuid(),
      path: folderPath,
      displayName: folderName,
      isVisible: true,
      order: maxOrder + 1,
    };

    database.insertVault(newVault);

    // Initialize vault log
    await initVaultLog(folderPath, folderName);

    // Sync the new vault to discover folders and images
    await this.syncVault(newVault.id);

    return newVault;
  },

  /**
   * Remove a vault (doesn't delete files, just removes from app)
   */
  async removeVault(vaultId: string): Promise<void> {
    const vaultRecord = database.getVaultById(vaultId);
    if (!vaultRecord) {
      throw new Error('Vault not found');
    }

    // Get all images in this vault to clean up thumbnails
    const images = database.getAllImages().filter(img => img.vaultId === vaultId);

    // Delete thumbnail files
    for (const image of images) {
      if (image.thumbnailPath) {
        try {
          await fs.unlink(image.thumbnailPath);
        } catch (err) {
          // Ignore errors (file may not exist)
        }
      }
    }

    // Delete vault and associated albums/images from database
    database.deleteVault(vaultId);
  },

  /**
   * Update vault settings
   */
  async updateVault(vaultId: string, updates: Partial<Vault>): Promise<Vault> {
    const vaultRecord = database.getVaultById(vaultId);
    if (!vaultRecord) {
      throw new Error('Vault not found');
    }

    database.updateVault(vaultId, updates);

    return { ...vaultRecord, ...updates };
  },
};
