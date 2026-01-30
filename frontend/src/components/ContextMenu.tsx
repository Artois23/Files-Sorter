import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FolderOpen } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../utils/api';

export function ContextMenu() {
  const {
    contextMenu,
    setContextMenu,
    albums,
    updateImages,
    currentView,
    getImageById,
  } = useAppStore();

  const [submenuOpen, setSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [setContextMenu]);

  if (!contextMenu) return null;

  const { x, y, imageIds } = contextMenu;

  const handleMoveToAlbum = async (albumId: string) => {
    try {
      // Vault-centric: move files on disk immediately
      const result = await api.batchMoveImages(imageIds, albumId);
      const successIds = result.results.filter(r => r.success).map(r => r.id);
      if (successIds.length > 0) {
        updateImages(successIds, { albumId, status: 'normal' });
      }
      const failures = result.results.filter(r => !r.success);
      if (failures.length > 0) {
        alert(`${failures.length} file(s) failed to move.`);
      }
    } catch (error) {
      console.error('Failed to move images to album:', error);
      alert(error instanceof Error ? error.message : 'Failed to move images');
    }
    setContextMenu(null);
  };

  const handleMarkTrash = async () => {
    try {
      // Vault-centric: actually delete/trash files
      await api.batchTrashImages(imageIds);
      useAppStore.getState().removeImages(imageIds);
    } catch (error) {
      console.error('Failed to trash images:', error);
      alert(error instanceof Error ? error.message : 'Failed to trash images');
    }
    setContextMenu(null);
  };

  const handleMarkNotSure = async () => {
    try {
      // Vault-centric: move files to _Sort Later folder
      for (const id of imageIds) {
        const result = await api.sortLaterImage(id);
        updateImages([id], { status: 'not-sure', albumId: null, path: result.path, filename: result.filename });
      }
    } catch (error) {
      console.error('Failed to move images to sort later:', error);
      alert(error instanceof Error ? error.message : 'Failed to move images');
    }
    setContextMenu(null);
  };

  const handleRemoveFromAlbum = async () => {
    // In vault-centric mode, "remove from album" would mean moving back to source/inbox
    // For now, we'll just update the database without moving the file
    // A more complete implementation would move to an "inbox" folder
    try {
      await api.updateImages(imageIds, { albumId: null });
      updateImages(imageIds, { albumId: null });
    } catch (error) {
      console.error('Failed to remove images from album:', error);
    }
    setContextMenu(null);
  };

  const handleShowInFinder = async () => {
    try {
      const image = getImageById(imageIds[0]);
      if (image) {
        await api.showInFinder(image.path);
      }
    } catch (error) {
      console.error('Failed to show in Finder:', error);
    }
    setContextMenu(null);
  };

  // Flatten albums with path for submenu
  const getAlbumPath = (albumId: string): string => {
    const album = albums.find((a) => a.id === albumId);
    if (!album) return '';
    if (!album.parentId) return album.name;
    return `${getAlbumPath(album.parentId)} › ${album.name}`;
  };

  const flatAlbums = albums.map((album) => ({
    ...album,
    path: getAlbumPath(album.id),
  }));

  // Adjust position if menu would overflow viewport
  const adjustPosition = () => {
    const menuWidth = 200;
    const menuHeight = 250;

    let adjustedX = x;
    let adjustedY = y;

    if (x + menuWidth > window.innerWidth) {
      adjustedX = window.innerWidth - menuWidth - 10;
    }

    if (y + menuHeight > window.innerHeight) {
      adjustedY = window.innerHeight - menuHeight - 10;
    }

    return { x: adjustedX, y: adjustedY };
  };

  const pos = adjustPosition();

  const isInAlbumView = currentView === 'album';

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-macos-dark-bg-2/95 backdrop-blur-xl rounded-lg shadow-xl border border-macos-dark-border py-1 min-w-[200px] animate-fade-in"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Move to Album submenu */}
      <div
        className="relative"
        onMouseEnter={() => setSubmenuOpen(true)}
        onMouseLeave={() => setSubmenuOpen(false)}
      >
        <button className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white flex items-center justify-between">
          <span>Move to Album</span>
          <ChevronRight size={14} />
        </button>

        {submenuOpen && (
          <div
            className="absolute left-full top-0 ml-1 bg-macos-dark-bg-2/95 backdrop-blur-xl rounded-lg shadow-xl border border-macos-dark-border py-1 min-w-[220px] max-h-[300px] overflow-y-auto"
          >
            {flatAlbums.length === 0 ? (
              <div className="px-3 py-2 text-13 text-macos-dark-text-tertiary">
                No albums created yet
              </div>
            ) : (
              flatAlbums.map((album) => (
                <button
                  key={album.id}
                  onClick={() => handleMoveToAlbum(album.id)}
                  className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white truncate"
                >
                  {album.path}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleMarkNotSure}
        className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white"
      >
        Mark as Not Sure / Sort Later
      </button>

      <button
        onClick={handleMarkTrash}
        className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white"
      >
        Mark as Trash / Delete
      </button>

      {isInAlbumView && (
        <button
          onClick={handleRemoveFromAlbum}
          className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white"
        >
          Remove from Album
        </button>
      )}

      <div className="h-px bg-macos-dark-border my-1" />

      <button
        onClick={handleShowInFinder}
        className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white flex items-center gap-2"
      >
        <FolderOpen size={14} />
        Show in Finder
      </button>
    </div>
  );
}
