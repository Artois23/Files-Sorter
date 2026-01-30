import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';
import { database } from './database.js';
import type { ScanProgress } from './types.js';

const SUPPORTED_FORMATS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.tiff', '.tif'
]);

const IMAGE_EXTENSIONS = new Set([
  ...SUPPORTED_FORMATS,
  '.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.orf', '.rw2',
  '.psd', '.ai', '.eps', '.svg', '.ico', '.heic', '.heif'
]);

let scanProgress: ScanProgress = {
  isScanning: false,
  folderCount: 0,
  imageCount: 0,
  currentFolder: '',
};

let cancelRequested = false;

export const scanner = {
  getProgress: (): ScanProgress => scanProgress,

  cancel: (): void => {
    cancelRequested = true;
  },

  scan: async (folderPath: string): Promise<void> => {
    cancelRequested = false;
    scanProgress = {
      isScanning: true,
      folderCount: 0,
      imageCount: 0,
      currentFolder: folderPath,
    };

    const thumbnailsDir = database.getThumbnailsDir();

    const processFile = async (filePath: string): Promise<void> => {
      if (cancelRequested) return;

      const ext = path.extname(filePath).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext)) return;

      const stats = await fs.stat(filePath);
      const filename = path.basename(filePath);
      const isSupported = SUPPORTED_FORMATS.has(ext);
      const format = ext.slice(1);

      let width: number | null = null;
      let height: number | null = null;
      let thumbnailPath: string | null = null;

      if (isSupported) {
        try {
          const image = sharp(filePath);
          const metadata = await image.metadata();
          width = metadata.width || null;
          height = metadata.height || null;

          // Generate thumbnail
          const thumbnailId = uuid();
          thumbnailPath = path.join(thumbnailsDir, `${thumbnailId}.jpg`);

          await image
            .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);
        } catch (error) {
          console.error(`Failed to process image ${filePath}:`, error);
        }
      }

      const imageData = {
        id: uuid(),
        path: filePath,
        filename,
        fileSize: stats.size,
        width,
        height,
        modifiedDate: stats.mtime.toISOString(),
        thumbnailPath,
        isSupported,
        format,
        albumId: null,
        status: 'normal' as const,
      };

      database.insertImage(imageData);
      scanProgress.imageCount++;
    };

    const processFolder = async (folderPath: string): Promise<void> => {
      if (cancelRequested) return;

      scanProgress.currentFolder = folderPath;
      scanProgress.folderCount++;

      try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
          if (cancelRequested) return;

          const fullPath = path.join(folderPath, entry.name);

          // Skip hidden files and folders
          if (entry.name.startsWith('.')) continue;

          if (entry.isDirectory()) {
            await processFolder(fullPath);
          } else if (entry.isFile()) {
            await processFile(fullPath);
          }
        }
      } catch (error) {
        console.error(`Failed to read folder ${folderPath}:`, error);
      }
    };

    try {
      // Clear existing images before scanning
      database.clearAllImages();

      await processFolder(folderPath);
    } finally {
      scanProgress.isScanning = false;
    }
  },
};
