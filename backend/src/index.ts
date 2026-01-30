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
