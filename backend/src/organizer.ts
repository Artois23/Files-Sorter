import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { database } from './database.js';
import type { OrganizeProgress, OrganizeSummary } from './types.js';

const execAsync = promisify(exec);

let organizeProgress: OrganizeProgress = {
  isOrganizing: false,
  total: 0,
  completed: 0,
  currentFile: '',
  errors: [],
};

let cancelRequested = false;

const sanitizeFilename = (name: string): string => {
  return name.replace(/[/\\:*?"<>|]/g, '_');
};

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

const moveToSystemTrash = async (filePath: string): Promise<void> => {
  // Use AppleScript to move to Trash on macOS
  const script = `tell application "Finder" to delete POSIX file "${filePath}"`;
  await execAsync(`osascript -e '${script}'`);
};

// Move file, with fallback to copy+delete for cross-filesystem moves
const moveFile = async (sourcePath: string, targetPath: string): Promise<void> => {
  try {
    await fs.rename(sourcePath, targetPath);
  } catch (error: unknown) {
    // If cross-filesystem (EXDEV error), fall back to copy + delete
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EXDEV') {
      await fs.copyFile(sourcePath, targetPath);
      await fs.unlink(sourcePath);
    } else {
      throw error;
    }
  }
};

export const organizer = {
  getProgress: (): OrganizeProgress => organizeProgress,

  cancel: (): void => {
    cancelRequested = true;
  },

  getSummary: (): OrganizeSummary => {
    const settings = database.getSettings();
    const images = database.getAllImages();
    const albums = database.getAllAlbums();

    const albumMoves: OrganizeSummary['albumMoves'] = [];

    // Build album path lookup
    const getAlbumPath = (albumId: string): string => {
      const album = albums.find(a => a.id === albumId);
      if (!album) return '';
      if (!album.parentId) return sanitizeFilename(album.name);
      return path.join(getAlbumPath(album.parentId), sanitizeFilename(album.name));
    };

    // Group images by album
    const albumImages = new Map<string, typeof images>();
    let trashCount = 0;
    let notSureCount = 0;

    for (const image of images) {
      if (image.status === 'trash') {
        trashCount++;
      } else if (image.status === 'not-sure') {
        notSureCount++;
      } else if (image.albumId) {
        const existing = albumImages.get(image.albumId) || [];
        existing.push(image);
        albumImages.set(image.albumId, existing);
      }
    }

    for (const [albumId, albumImageList] of albumImages) {
      const album = albums.find(a => a.id === albumId);
      if (album) {
        const albumPath = getAlbumPath(albumId);
        albumMoves.push({
          albumName: album.name,
          targetPath: path.join(settings.vaultFolder || '', albumPath),
          count: albumImageList.length,
        });
      }
    }

    const totalImages = albumMoves.reduce((sum, m) => sum + m.count, 0) + trashCount + notSureCount;

    return {
      albumMoves,
      trashCount,
      notSureCount,
      totalImages,
    };
  },

  organize: async (deleteOriginals: boolean): Promise<void> => {
    cancelRequested = false;
    const settings = database.getSettings();
    const images = database.getAllImages();
    const albums = database.getAllAlbums();

    if (!settings.vaultFolder) {
      throw new Error('Vault folder not set');
    }

    // Build album path lookup
    const getAlbumPath = (albumId: string): string => {
      const album = albums.find(a => a.id === albumId);
      if (!album) return '';
      if (!album.parentId) return sanitizeFilename(album.name);
      return path.join(getAlbumPath(album.parentId), sanitizeFilename(album.name));
    };

    // Get images to process
    const toProcess = images.filter(
      img => img.albumId || img.status === 'trash' || img.status === 'not-sure'
    );

    organizeProgress = {
      isOrganizing: true,
      total: toProcess.length,
      completed: 0,
      currentFile: '',
      errors: [],
    };

    const processedIds: string[] = [];

    for (const image of toProcess) {
      if (cancelRequested) break;

      organizeProgress.currentFile = image.path;

      try {
        // Check if source file exists
        await fs.access(image.path);

        if (image.status === 'trash') {
          // Move to trash
          if (settings.trashHandling === 'system') {
            await moveToSystemTrash(image.path);
          } else {
            const trashDir = path.join(settings.vaultFolder, '_Trash');
            await fs.mkdir(trashDir, { recursive: true });
            const targetPath = await getUniqueFilename(trashDir, image.filename);
            await moveFile(image.path, targetPath);
          }
        } else if (image.status === 'not-sure') {
          // Move to Sort Later folder
          const sortLaterDir = path.join(settings.vaultFolder, '_Sort Later');
          await fs.mkdir(sortLaterDir, { recursive: true });
          const targetPath = await getUniqueFilename(sortLaterDir, image.filename);

          if (deleteOriginals) {
            await moveFile(image.path, targetPath);
          } else {
            await fs.copyFile(image.path, targetPath);
          }
        } else if (image.albumId) {
          // Move to album folder
          const albumPath = getAlbumPath(image.albumId);
          const targetDir = path.join(settings.vaultFolder, albumPath);
          await fs.mkdir(targetDir, { recursive: true });
          const targetPath = await getUniqueFilename(targetDir, image.filename);

          if (deleteOriginals) {
            await moveFile(image.path, targetPath);
          } else {
            await fs.copyFile(image.path, targetPath);
          }
        }

        processedIds.push(image.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        organizeProgress.errors.push({
          path: image.path,
          reason: message,
        });
      }

      organizeProgress.completed++;
    }

    // Remove processed images from database
    if (processedIds.length > 0) {
      database.deleteImages(processedIds);
    }

    organizeProgress.isOrganizing = false;
  },
};
