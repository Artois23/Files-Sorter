import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';
import { database } from './database.js';
import { scanner } from './scanner.js';
import { organizer } from './organizer.js';
import { vault } from './vault.js';

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3333;

app.use(cors());
app.use(express.json());

// Serve thumbnails
const thumbnailsDir = database.getThumbnailsDir();
app.use('/thumbnails', express.static(thumbnailsDir));

// Folder selection using AppleScript
app.get('/api/folders/select', async (_req, res) => {
  try {
    const script = `
      set chosenFolder to choose folder with prompt "Select a folder"
      return POSIX path of chosenFolder
    `;
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const folderPath = stdout.trim();
    res.json({ path: folderPath });
  } catch (error) {
    // User cancelled or error
    res.json(null);
  }
});

// Scanning
app.post('/api/scan/start', async (req, res) => {
  const { path: folderPath } = req.body;

  if (!folderPath) {
    return res.status(400).json({ message: 'Path is required' });
  }

  // Update source folder setting
  database.updateSettings({ sourceFolder: folderPath });

  // Start scanning in background
  scanner.scan(folderPath).catch(console.error);

  res.json({ message: 'Scan started' });
});

app.get('/api/scan/status', (_req, res) => {
  res.json(scanner.getProgress());
});

app.post('/api/scan/cancel', (_req, res) => {
  scanner.cancel();
  res.json({ message: 'Scan cancelled' });
});

// Images
app.get('/api/images', (_req, res) => {
  const images = database.getAllImages();

  // Transform thumbnail paths to URLs
  const imagesWithUrls = images.map(img => ({
    ...img,
    thumbnailUrl: img.thumbnailPath
      ? `/thumbnails/${path.basename(img.thumbnailPath)}`
      : null,
  }));

  res.json(imagesWithUrls);
});

app.get('/api/images/:id/full', async (req, res) => {
  const image = database.getImageById(req.params.id);

  if (!image) {
    return res.status(404).json({ message: 'Image not found' });
  }

  try {
    res.sendFile(image.path);
  } catch (error) {
    res.status(404).json({ message: 'File not found' });
  }
});

app.patch('/api/images/batch', (req, res) => {
  const { ids, updates } = req.body;

  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ message: 'ids array is required' });
  }

  database.updateImages(ids, updates);
  res.json({ message: 'Images updated' });
});

app.patch('/api/images/:id/rename', async (req, res) => {
  const { id } = req.params;
  const { filename } = req.body;

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ message: 'filename is required' });
  }

  // Validate filename - no slashes, not empty after trim, valid characters
  const trimmedFilename = filename.trim();
  if (!trimmedFilename) {
    return res.status(400).json({ message: 'Filename cannot be empty' });
  }
  if (trimmedFilename.includes('/') || trimmedFilename.includes('\\')) {
    return res.status(400).json({ message: 'Filename cannot contain slashes' });
  }
  // Check for other invalid characters (null bytes, etc.)
  if (/[\x00-\x1f]/.test(trimmedFilename)) {
    return res.status(400).json({ message: 'Filename contains invalid characters' });
  }

  const image = database.getImageById(id);
  if (!image) {
    return res.status(404).json({ message: 'Image not found' });
  }

  const oldPath = image.path;
  const dir = path.dirname(oldPath);
  const newPath = path.join(dir, trimmedFilename);

  // Check if same as current
  if (newPath === oldPath) {
    return res.json({ id: image.id, path: image.path, filename: image.filename });
  }

  // Check if target already exists
  try {
    await fs.access(newPath);
    // If we reach here, file exists
    return res.status(409).json({ message: 'A file with this name already exists' });
  } catch {
    // File doesn't exist, good to proceed
  }

  // Rename the file on disk
  try {
    await fs.rename(oldPath, newPath);
  } catch (error) {
    console.error('Failed to rename file:', error);
    return res.status(500).json({ message: 'Failed to rename file on disk' });
  }

  // Update database
  database.updateImagePath(id, newPath, trimmedFilename);

  res.json({ id, path: newPath, filename: trimmedFilename });
});

// Albums
app.get('/api/albums', (_req, res) => {
  const albums = database.getAllAlbums();

  // Add image count
  const images = database.getAllImages();
  const albumsWithCount = albums.map(album => ({
    ...album,
    imageCount: images.filter(img => img.albumId === album.id && img.status === 'normal').length,
  }));

  res.json(albumsWithCount);
});

app.post('/api/albums', (req, res) => {
  const { name, parentId } = req.body;

  const albums = database.getAllAlbums();
  const maxOrder = Math.max(0, ...albums.map(a => a.order));

  const album = {
    id: uuid(),
    name: name || 'Untitled Album',
    parentId: parentId || null,
    order: maxOrder + 1,
  };

  database.insertAlbum(album);
  res.json({ ...album, imageCount: 0 });
});

app.patch('/api/albums/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  database.updateAlbum(id, updates);
  const album = database.getAlbumById(id);

  if (!album) {
    return res.status(404).json({ message: 'Album not found' });
  }

  res.json(album);
});

app.delete('/api/albums/:id', (req, res) => {
  const { id } = req.params;
  database.deleteAlbum(id);
  res.json({ message: 'Album deleted' });
});

app.post('/api/albums/reorder', (req, res) => {
  const { albums } = req.body;

  if (!albums || !Array.isArray(albums)) {
    return res.status(400).json({ message: 'albums array is required' });
  }

  database.reorderAlbums(albums);
  res.json({ message: 'Albums reordered' });
});

// Vault-centric operations
app.post('/api/vault/sync', async (_req, res) => {
  try {
    const albums = await vault.syncAlbumsWithVault();
    const images = database.getAllImages();
    const albumsWithCount = albums.map(album => ({
      ...album,
      imageCount: images.filter(img => img.albumId === album.id && img.status === 'normal').length,
    }));
    res.json(albumsWithCount);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync vault';
    res.status(500).json({ message });
  }
});

app.post('/api/vault/folders', async (req, res) => {
  const { name, parentId } = req.body;

  try {
    const album = await vault.createFolder(name || 'Untitled Folder', parentId || null);
    res.json({ ...album, imageCount: 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create folder';
    res.status(500).json({ message });
  }
});

app.patch('/api/vault/folders/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  try {
    const album = await vault.renameFolder(id, name);
    res.json(album);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rename folder';
    res.status(500).json({ message });
  }
});

app.delete('/api/vault/folders/:id', async (req, res) => {
  const { id } = req.params;
  const { deleteContents } = req.query;

  try {
    await vault.deleteFolder(id, deleteContents === 'true');
    res.json({ message: 'Folder deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete folder';
    res.status(500).json({ message });
  }
});

// Move image to album (vault-centric - moves file immediately)
app.post('/api/vault/images/:id/move', async (req, res) => {
  const { id } = req.params;
  const { albumId } = req.body;

  try {
    const result = await vault.moveImageToAlbum(id, albumId);
    const image = database.getImageById(id);
    res.json({
      ...image,
      ...result,
      thumbnailUrl: image?.thumbnailPath
        ? `/thumbnails/${path.basename(image.thumbnailPath)}`
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to move image';
    res.status(500).json({ message });
  }
});

// Move image to trash (vault-centric)
app.post('/api/vault/images/:id/trash', async (req, res) => {
  const { id } = req.params;

  try {
    await vault.moveImageToTrash(id);
    res.json({ message: 'Image moved to trash' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to trash image';
    res.status(500).json({ message });
  }
});

// Move image to sort later (vault-centric)
app.post('/api/vault/images/:id/sort-later', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await vault.moveImageToSortLater(id);
    const image = database.getImageById(id);
    res.json({
      ...image,
      ...result,
      thumbnailUrl: image?.thumbnailPath
        ? `/thumbnails/${path.basename(image.thumbnailPath)}`
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to move image';
    res.status(500).json({ message });
  }
});

// Batch move images to album (vault-centric)
app.post('/api/vault/images/batch-move', async (req, res) => {
  const { imageIds, albumId } = req.body;

  if (!imageIds || !Array.isArray(imageIds)) {
    return res.status(400).json({ message: 'imageIds array is required' });
  }

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const imageId of imageIds) {
    try {
      await vault.moveImageToAlbum(imageId, albumId);
      results.push({ id: imageId, success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      results.push({ id: imageId, success: false, error: message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  res.json({
    message: `Moved ${successCount} images${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
    results,
  });
});

// Batch trash images (vault-centric)
app.post('/api/vault/images/batch-trash', async (req, res) => {
  const { imageIds } = req.body;

  if (!imageIds || !Array.isArray(imageIds)) {
    return res.status(400).json({ message: 'imageIds array is required' });
  }

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const imageId of imageIds) {
    try {
      await vault.moveImageToTrash(imageId);
      results.push({ id: imageId, success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      results.push({ id: imageId, success: false, error: message });
    }
  }

  res.json({ results });
});

// Trash operations
app.get('/api/vault/trash/info', async (_req, res) => {
  try {
    const info = await vault.getTrashInfo();
    res.json(info);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get trash info';
    res.status(500).json({ message });
  }
});

app.post('/api/vault/trash/empty', async (_req, res) => {
  try {
    const result = await vault.emptyTrash();
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to empty trash';
    res.status(500).json({ message });
  }
});

// Settings
app.get('/api/settings', (_req, res) => {
  res.json(database.getSettings());
});

app.patch('/api/settings', (req, res) => {
  database.updateSettings(req.body);
  res.json(database.getSettings());
});

// Organize
app.get('/api/organize/summary', (_req, res) => {
  res.json(organizer.getSummary());
});

app.post('/api/organize/start', async (req, res) => {
  const { deleteOriginals = true } = req.body;

  // Start organizing in background
  organizer.organize(deleteOriginals).catch(console.error);

  res.json({ message: 'Organize started' });
});

app.get('/api/organize/status', (_req, res) => {
  res.json(organizer.getProgress());
});

app.post('/api/organize/cancel', (_req, res) => {
  organizer.cancel();
  res.json({ message: 'Organize cancelled' });
});

// File operations
app.post('/api/files/show-in-finder', async (req, res) => {
  const { path: filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({ message: 'path is required' });
  }

  try {
    await execAsync(`open -R "${filePath}"`);
    res.json({ message: 'Opened in Finder' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to open in Finder' });
  }
});

app.post('/api/files/open-preview', async (req, res) => {
  const { path: filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({ message: 'path is required' });
  }

  try {
    await execAsync(`open -a Preview "${filePath}"`);
    res.json({ message: 'Opened in Preview' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to open in Preview' });
  }
});

// Export
app.get('/api/export/assignments', async (_req, res) => {
  const images = database.getAllImages();
  const albums = database.getAllAlbums();

  const exportData = {
    exportedAt: new Date().toISOString(),
    images: images.map(img => ({
      path: img.path,
      albumId: img.albumId,
      status: img.status,
    })),
    albums: albums.map(album => ({
      id: album.id,
      name: album.name,
      parentId: album.parentId,
    })),
  };

  const exportPath = path.join(database.getThumbnailsDir(), '..', 'assignments-export.json');
  await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));

  res.json({ path: exportPath });
});

// Thumbnail regeneration
app.post('/api/thumbnails/regenerate', async (req, res) => {
  const { imageIds, size } = req.body;

  if (!size || typeof size !== 'number' || size < 80 || size > 800) {
    return res.status(400).json({ message: 'size must be a number between 80 and 800' });
  }

  let imagesToProcess: { id: string; path: string }[];

  if (imageIds === 'all') {
    imagesToProcess = database.getAllImages().map(img => ({ id: img.id, path: img.path }));
  } else if (Array.isArray(imageIds)) {
    imagesToProcess = imageIds
      .map(id => {
        const img = database.getImageById(id);
        return img ? { id: img.id, path: img.path } : null;
      })
      .filter((img): img is { id: string; path: string } => img !== null);
  } else {
    return res.status(400).json({ message: 'imageIds must be "all" or an array of IDs' });
  }

  let processed = 0;
  let errors = 0;

  for (const { id, path: imgPath } of imagesToProcess) {
    try {
      const thumbnailPath = await scanner.regenerateThumbnail(imgPath, id, size);
      if (thumbnailPath) {
        database.updateImageThumbnail(id, thumbnailPath);
        processed++;
      } else {
        errors++;
      }
    } catch (error) {
      console.error(`Failed to regenerate thumbnail for ${id}:`, error);
      errors++;
    }
  }

  res.json({ processed, errors });
});

// Clear data
app.post('/api/data/clear', async (_req, res) => {
  database.clearAll();

  // Clear thumbnails
  const thumbnailsDir = database.getThumbnailsDir();
  try {
    const files = await fs.readdir(thumbnailsDir);
    for (const file of files) {
      await fs.unlink(path.join(thumbnailsDir, file));
    }
  } catch (error) {
    console.error('Failed to clear thumbnails:', error);
  }

  res.json({ message: 'All data cleared' });
});

app.listen(PORT, () => {
  console.log(`Image Sorter backend running on http://localhost:${PORT}`);
});
