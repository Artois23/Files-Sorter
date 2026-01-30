import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Images,
  Inbox,
  Trash2,
  Clock,
  Folder,
  ChevronRight,
  Plus,
  GripVertical,
  Eraser,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../utils/api';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import type { Album } from '../types';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  isDropTarget?: boolean;
  onDrop?: () => void;
}

function SidebarItem({
  icon,
  label,
  count,
  isActive,
  onClick,
  isDropTarget,
  onDrop,
}: SidebarItemProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `sidebar-${label}`,
    data: { type: 'sidebar-item', onDrop },
  });

  return (
    <div
      ref={isDropTarget ? setNodeRef : undefined}
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors
        ${isActive
          ? 'bg-accent text-white'
          : isOver
            ? 'bg-accent/30'
            : 'hover:bg-macos-dark-bg-3'
        }
      `}
    >
      <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
      <span className="flex-1 text-13 truncate">{label}</span>
      <span className="text-11 text-macos-dark-text-tertiary tabular-nums">
        {count}
      </span>
    </div>
  );
}

interface TrashItemProps {
  count: number;
  trashFileCount: number;
  isActive: boolean;
  onClick: () => void;
  onDrop: () => void;
  onEmptyTrash: () => void;
}

function TrashItem({
  count,
  trashFileCount,
  isActive,
  onClick,
  onDrop,
  onEmptyTrash,
}: TrashItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: 'sidebar-Trash',
    data: { type: 'sidebar-item', onDrop },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors
        ${isActive
          ? 'bg-accent text-white'
          : isOver
            ? 'bg-accent/30'
            : 'hover:bg-macos-dark-bg-3'
        }
      `}
    >
      <span className="w-5 h-5 flex items-center justify-center">
        <Trash2 size={16} />
      </span>
      <span className="flex-1 text-13 truncate">Trash</span>
      {isHovered && trashFileCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEmptyTrash();
          }}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/30 text-macos-dark-text-tertiary hover:text-red-400 flex-shrink-0"
          title="Empty Trash"
        >
          <Eraser size={12} />
        </button>
      )}
      <span className="text-11 text-macos-dark-text-tertiary tabular-nums">
        {count}
      </span>
    </div>
  );
}

interface AlbumItemProps {
  album: Album;
  depth: number;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onCreateSubAlbum: () => void;
  directCount: number;
  totalCount: number;
}

function AlbumItem({
  album,
  depth,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onCreateSubAlbum,
  directCount,
  totalCount,
}: AlbumItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(album.name);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Select albums array directly, then filter (avoids infinite loop from selector returning new array)
  const albums = useAppStore((state) => state.albums);
  const childAlbums = albums
    .filter((a) => a.parentId === album.id)
    .sort((a, b) => a.order - b.order);

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({
    id: album.id,
    data: { type: 'album', albumId: album.id },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `album-drop-${album.id}`,
    data: { type: 'album', albumId: album.id },
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleStartRename = () => {
    setIsEditing(true);
    setShowContextMenu(false);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleFinishRename = () => {
    if (editName.trim() && editName !== album.name) {
      onRename(editName.trim());
    } else {
      setEditName(album.name);
    }
    setIsEditing(false);
  };

  return (
    <>
      <div
        ref={setDroppableRef}
        style={{ paddingLeft: depth * 16, opacity: isDragging ? 0.5 : 1 }}
        className={`
          flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors
          ${isActive
            ? 'bg-accent text-white'
            : isOver
              ? 'bg-accent/50 ring-2 ring-accent'
              : 'hover:bg-macos-dark-bg-3'
          }
        `}
        onClick={onSelect}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          ref={setDraggableRef}
          {...attributes}
          {...listeners}
          className="w-4 h-4 flex items-center justify-center opacity-0 hover:opacity-100 cursor-grab"
        >
          <GripVertical size={12} />
        </div>

        {childAlbums.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="w-4 h-4 flex items-center justify-center"
          >
            <ChevronRight
              size={12}
              className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}

        <Folder size={16} className="flex-shrink-0" />

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleFinishRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFinishRename();
              if (e.key === 'Escape') {
                setEditName(album.name);
                setIsEditing(false);
              }
            }}
            className="flex-1 bg-macos-dark-bg-1 text-13 px-1 rounded outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-13 truncate"
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleStartRename();
            }}
          >
            {album.name}
          </span>
        )}

        {isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateSubAlbum();
            }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-macos-dark-bg-3 text-macos-dark-text-tertiary hover:text-white flex-shrink-0"
            title="Create sub-album"
          >
            <Plus size={12} />
          </button>
        )}

        <span className="text-11 text-macos-dark-text-tertiary tabular-nums">
          {directCount !== totalCount ? `${directCount}/${totalCount}` : directCount}
        </span>
      </div>

      {isExpanded &&
        childAlbums.map((child) => (
          <AlbumItemWrapper key={child.id} album={child} depth={depth + 1} />
        ))}

      {showContextMenu && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          onClose={() => setShowContextMenu(false)}
          items={[
            { label: 'New Sub-Album', onClick: onCreateSubAlbum },
            { label: 'Rename', onClick: handleStartRename },
            { type: 'separator' },
            { label: 'Delete Album', onClick: onDelete, danger: true },
          ]}
        />
      )}
    </>
  );
}

function AlbumItemWrapper({ album, depth }: { album: Album; depth: number }) {
  const { currentView, currentAlbumId, setView, updateAlbum, deleteAlbum, addAlbum, images, albums } =
    useAppStore();

  // Direct count: images in this album only
  const directCount = images.filter(
    (img) => img.albumId === album.id && img.status === 'normal'
  ).length;

  // Recursive count: images in this album and all descendants
  const getDescendantIds = (albumId: string): string[] => {
    const children = albums.filter((a) => a.parentId === albumId);
    const childIds = children.map((c) => c.id);
    const descendantIds = children.flatMap((c) => getDescendantIds(c.id));
    return [...childIds, ...descendantIds];
  };

  const descendantIds = getDescendantIds(album.id);
  const totalCount = images.filter(
    (img) => (img.albumId === album.id || descendantIds.includes(img.albumId || '')) && img.status === 'normal'
  ).length;

  const handleRename = async (name: string) => {
    try {
      // Use vault-centric API to rename folder on disk
      await api.renameVaultFolder(album.id, name);
      updateAlbum(album.id, { name });
    } catch (error) {
      console.error('Failed to rename album:', error);
      alert(error instanceof Error ? error.message : 'Failed to rename folder');
    }
  };

  const handleDelete = async () => {
    const hasImages = totalCount > 0;
    const message = hasImages
      ? `Delete folder '${album.name}' and its ${totalCount} images? This cannot be undone.`
      : `Delete empty folder '${album.name}'?`;

    if (confirm(message)) {
      try {
        // Use vault-centric API to delete folder from disk
        await api.deleteVaultFolder(album.id, hasImages);
        deleteAlbum(album.id);
        if (currentAlbumId === album.id) {
          setView('all');
        }
      } catch (error) {
        console.error('Failed to delete album:', error);
        alert(error instanceof Error ? error.message : 'Failed to delete folder');
      }
    }
  };

  const handleCreateSubAlbum = async () => {
    try {
      // Use vault-centric API to create folder on disk
      const newAlbum = await api.createVaultFolder('Untitled Folder', album.id);
      addAlbum(newAlbum);
    } catch (error) {
      console.error('Failed to create sub-album:', error);
      alert(error instanceof Error ? error.message : 'Failed to create folder');
    }
  };

  return (
    <AlbumItem
      album={album}
      depth={depth}
      isActive={currentView === 'album' && currentAlbumId === album.id}
      onSelect={() => setView('album', album.id)}
      onRename={handleRename}
      onDelete={handleDelete}
      onCreateSubAlbum={handleCreateSubAlbum}
      directCount={directCount}
      totalCount={totalCount}
    />
  );
}

interface ContextMenuItem {
  label?: string;
  onClick?: () => void;
  danger?: boolean;
  type?: 'separator';
}

function ContextMenu({
  x,
  y,
  onClose,
  items,
}: {
  x: number;
  y: number;
  onClose: () => void;
  items: ContextMenuItem[];
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-macos-dark-bg-2/95 backdrop-blur-xl rounded-lg shadow-xl border border-macos-dark-border py-1 min-w-[160px]"
        style={{ left: x, top: y }}
      >
        {items.map((item, i) =>
          item.type === 'separator' ? (
            <div key={i} className="h-px bg-macos-dark-border my-1" />
          ) : (
            <button
              key={i}
              onClick={() => {
                item.onClick?.();
                onClose();
              }}
              className={`
                w-full px-3 py-1.5 text-left text-13 transition-colors
                ${item.danger
                  ? 'text-red-500 hover:bg-red-500/20'
                  : 'hover:bg-accent hover:text-white'
                }
              `}
            >
              {item.label}
            </button>
          )
        )}
      </div>
    </>
  );
}

export function Sidebar() {
  const {
    currentView,
    setView,
    albums,
    images,
    addAlbum,
    setAlbums,
    sidebarWidth,
    setSidebarWidth,
    sidebarCollapsed,
    selectedImageIds,
    updateImages,
    settings,
  } = useAppStore();

  const [isResizing, setIsResizing] = useState(false);
  const [trashFileCount, setTrashFileCount] = useState(0);
  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync vault folders with albums
  const syncVault = useCallback(async () => {
    if (!settings.vaultFolder || isSyncing) return;

    setIsSyncing(true);
    try {
      const syncedAlbums = await api.syncVault();
      setAlbums(syncedAlbums);
    } catch (error) {
      console.error('Failed to sync vault:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [settings.vaultFolder, isSyncing, setAlbums]);

  // Auto-sync every 3 minutes
  useEffect(() => {
    if (!settings.vaultFolder) return;

    const interval = setInterval(syncVault, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [settings.vaultFolder, syncVault]);

  // Sync on app focus
  useEffect(() => {
    const handleFocus = () => {
      if (settings.vaultFolder) {
        syncVault();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [settings.vaultFolder, syncVault]);

  // Fetch trash info periodically
  useEffect(() => {
    const fetchTrashInfo = async () => {
      try {
        const info = await api.getTrashInfo();
        setTrashFileCount(info.count);
      } catch {
        // Ignore errors
      }
    };

    fetchTrashInfo();
    const interval = setInterval(fetchTrashInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  const { setNodeRef: setSidebarDropRef, isOver: isOverSidebar } = useDroppable({
    id: 'sidebar-root',
    data: { type: 'sidebar-root' },
  });

  const rootAlbums = albums
    .filter((a) => a.parentId === null)
    .sort((a, b) => a.order - b.order);

  const allCount = images.filter((img) => img.status === 'normal').length;
  const orphanCount = images.filter(
    (img) => !img.albumId && img.status === 'normal'
  ).length;
  const trashCount = images.filter((img) => img.status === 'trash').length;
  const notSureCount = images.filter((img) => img.status === 'not-sure').length;

  const handleCreateAlbum = async () => {
    try {
      // Use vault-centric API to create folder on disk
      const newAlbum = await api.createVaultFolder('Untitled Folder', null);
      addAlbum(newAlbum);
    } catch (error) {
      console.error('Failed to create album:', error);
      alert(error instanceof Error ? error.message : 'Failed to create folder');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, 180), 320);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMoveToTrash = async () => {
    if (selectedImageIds.size > 0) {
      const ids = Array.from(selectedImageIds);
      try {
        // Use vault-centric API to actually move files to trash
        await api.batchTrashImages(ids);
        // Remove from local state since they're deleted from database
        useAppStore.getState().removeImages(ids);
      } catch (error) {
        console.error('Failed to move images to trash:', error);
      }
    }
  };

  const handleMoveToNotSure = async () => {
    if (selectedImageIds.size > 0) {
      const ids = Array.from(selectedImageIds);
      try {
        // Move files to _Sort Later folder - one by one for now
        for (const id of ids) {
          const result = await api.sortLaterImage(id);
          updateImages([id], { status: 'not-sure', albumId: null, path: result.path, filename: result.filename });
        }
      } catch (error) {
        console.error('Failed to mark images as sort later:', error);
      }
    }
  };

  const handleEmptyTrash = async () => {
    setIsEmptyingTrash(true);
    try {
      const result = await api.emptyTrash();
      setTrashFileCount(0);
      setShowEmptyTrashConfirm(false);
      if (result.deletedCount > 0) {
        alert(`Permanently deleted ${result.deletedCount} file(s) from trash.`);
      }
    } catch (error) {
      console.error('Failed to empty trash:', error);
      alert(error instanceof Error ? error.message : 'Failed to empty trash');
    } finally {
      setIsEmptyingTrash(false);
    }
  };

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <aside
      className="flex flex-col bg-macos-dark-bg-2 border-r border-macos-dark-border relative select-none"
      style={{ width: sidebarWidth }}
    >
        {/* Library section */}
        <div className="p-3">
          <h3 className="text-11 font-medium text-macos-dark-text-tertiary uppercase tracking-wide mb-2 px-2">
            Library
          </h3>
          <div className="space-y-0.5">
            <SidebarItem
              icon={<Images size={16} />}
              label="All Images"
              count={allCount}
              isActive={currentView === 'all'}
              onClick={() => setView('all')}
            />
            <SidebarItem
              icon={<Inbox size={16} />}
              label="Orphans"
              count={orphanCount}
              isActive={currentView === 'orphans'}
              onClick={() => setView('orphans')}
            />
            {/* Custom Trash item with empty button */}
            <TrashItem
              count={trashCount}
              trashFileCount={trashFileCount}
              isActive={currentView === 'trash'}
              onClick={() => setView('trash')}
              onDrop={handleMoveToTrash}
              onEmptyTrash={() => setShowEmptyTrashConfirm(true)}
            />
            <SidebarItem
              icon={<Clock size={16} />}
              label="Not Sure"
              count={notSureCount}
              isActive={currentView === 'not-sure'}
              onClick={() => setView('not-sure')}
              isDropTarget
              onDrop={handleMoveToNotSure}
            />
          </div>
        </div>

        {/* Albums section */}
        <div
          ref={setSidebarDropRef}
          className={`flex-1 overflow-y-auto p-3 ${isOverSidebar ? 'bg-accent/20' : ''}`}
        >
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-11 font-medium text-macos-dark-text-tertiary uppercase tracking-wide">
              Albums
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={syncVault}
                disabled={isSyncing || !settings.vaultFolder}
                className={`w-5 h-5 flex items-center justify-center rounded hover:bg-macos-dark-bg-3 text-macos-dark-text-tertiary hover:text-white disabled:opacity-30 ${isSyncing ? 'animate-spin' : ''}`}
                title="Sync with vault folders"
              >
                <RefreshCw size={12} />
              </button>
              <button
                onClick={handleCreateAlbum}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-macos-dark-bg-3 text-macos-dark-text-tertiary hover:text-white"
                title="Create album"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="space-y-0.5">
            {rootAlbums.map((album) => (
              <AlbumItemWrapper key={album.id} album={album} depth={0} />
            ))}
          </div>

          {rootAlbums.length === 0 && (
            <p className="text-13 text-macos-dark-text-tertiary px-2 py-4">
              No albums yet. Click + to create one.
            </p>
          )}
        </div>

        {/* New album button at bottom */}
        <div className="p-3 border-t border-macos-dark-border">
          <button
            onClick={handleCreateAlbum}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-macos-dark-text-tertiary hover:bg-macos-dark-bg-3 hover:text-white transition-colors"
          >
            <Plus size={16} />
            <span className="text-13">New Album</span>
          </button>
        </div>

        {/* Resize handle */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/50 ${
            isResizing ? 'bg-accent' : ''
          }`}
          onMouseDown={handleMouseDown}
        />

        {/* Empty Trash Confirmation Dialog */}
        {showEmptyTrashConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowEmptyTrashConfirm(false)}
            />
            <div className="relative bg-macos-dark-bg-2 rounded-xl shadow-2xl w-[400px] overflow-hidden animate-scale-in">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Trash2 size={20} className="text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-15 font-semibold">Empty Trash?</h2>
                    <p className="text-13 text-macos-dark-text-tertiary">
                      {trashFileCount} file{trashFileCount !== 1 ? 's' : ''} will be permanently deleted.
                    </p>
                  </div>
                </div>

                <p className="text-13 text-macos-dark-text-secondary">
                  This action cannot be undone. The files will be permanently removed from your vault.
                </p>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowEmptyTrashConfirm(false)}
                    className="px-4 py-2 bg-macos-dark-bg-3 hover:bg-macos-dark-bg-1 rounded-md text-13"
                    disabled={isEmptyingTrash}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEmptyTrash}
                    disabled={isEmptyingTrash}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-13 font-medium disabled:opacity-50"
                  >
                    {isEmptyingTrash ? 'Deleting...' : 'Empty Trash'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
  );
}
