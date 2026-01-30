import { useState, useRef } from 'react';
import {
  Images,
  Inbox,
  Trash2,
  Clock,
  Folder,
  ChevronRight,
  Plus,
  GripVertical,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../utils/api';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

interface AlbumItemProps {
  album: Album;
  depth: number;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onCreateSubAlbum: () => void;
  imageCount: number;
}

function AlbumItem({
  album,
  depth,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onCreateSubAlbum,
  imageCount,
}: AlbumItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(album.name);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const childAlbums = useAppStore((state) => state.getChildAlbums(album.id));

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: album.id });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `album-${album.id}`,
    data: { type: 'album', albumId: album.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

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

  const combinedRef = (node: HTMLDivElement | null) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  return (
    <>
      <div
        ref={combinedRef}
        style={style}
        className={`
          flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors
          ${isActive
            ? 'bg-accent text-white'
            : isOver
              ? 'bg-accent/30'
              : 'hover:bg-macos-dark-bg-3'
          }
        `}
        onClick={onSelect}
        onDoubleClick={handleStartRename}
        onContextMenu={handleContextMenu}
      >
        <div
          {...attributes}
          {...listeners}
          className="w-4 h-4 flex items-center justify-center opacity-0 hover:opacity-100 cursor-grab"
          style={{ marginLeft: depth * 16 }}
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
          <span className="flex-1 text-13 truncate">{album.name}</span>
        )}

        <span className="text-11 text-macos-dark-text-tertiary tabular-nums">
          {imageCount}
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
  const { currentView, currentAlbumId, setView, updateAlbum, deleteAlbum, addAlbum, images } =
    useAppStore();

  const imageCount = images.filter(
    (img) => img.albumId === album.id && img.status === 'normal'
  ).length;

  const handleRename = async (name: string) => {
    await api.updateAlbum(album.id, { name });
    updateAlbum(album.id, { name });
  };

  const handleDelete = async () => {
    if (
      confirm(
        `Delete album '${album.name}'? The ${imageCount} images inside will become orphans.`
      )
    ) {
      await api.deleteAlbum(album.id);
      deleteAlbum(album.id);
      if (currentAlbumId === album.id) {
        setView('all');
      }
    }
  };

  const handleCreateSubAlbum = async () => {
    const newAlbum = await api.createAlbum('Untitled Album', album.id);
    addAlbum(newAlbum);
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
      imageCount={imageCount}
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
    reorderAlbums,
    sidebarWidth,
    setSidebarWidth,
    sidebarCollapsed,
    selectedImageIds,
    updateImages,
  } = useAppStore();

  const [isResizing, setIsResizing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    const newAlbum = await api.createAlbum('Untitled Album', null);
    addAlbum(newAlbum);
  };

  const handleDragStart = (_event: DragStartEvent) => {
    // Could track dragging state here
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Could show drop preview here
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    // Handle image drop onto album
    const overData = over.data.current;
    if (overData?.type === 'album' && selectedImageIds.size > 0) {
      const albumId = overData.albumId;
      const ids = Array.from(selectedImageIds);
      await api.updateImages(ids, { albumId, status: 'normal' });
      updateImages(ids, { albumId, status: 'normal' });
      return;
    }

    // Handle image drop onto sidebar items (trash, not-sure)
    if (overData?.type === 'sidebar-item' && overData?.onDrop) {
      overData.onDrop();
      return;
    }

    // Handle album reorder
    if (active.id !== over.id) {
      const oldIndex = albums.findIndex((a) => a.id === active.id);
      const newIndex = albums.findIndex((a) => a.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newAlbums = [...albums];
        const [removed] = newAlbums.splice(oldIndex, 1);
        newAlbums.splice(newIndex, 0, removed);

        const updatedAlbums = newAlbums.map((a, i) => ({ ...a, order: i }));
        reorderAlbums(updatedAlbums);
        await api.reorderAlbums(
          updatedAlbums.map((a) => ({
            id: a.id,
            order: a.order,
            parentId: a.parentId,
          }))
        );
      }
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
      await api.updateImages(ids, { status: 'trash', albumId: null });
      updateImages(ids, { status: 'trash', albumId: null });
    }
  };

  const handleMoveToNotSure = async () => {
    if (selectedImageIds.size > 0) {
      const ids = Array.from(selectedImageIds);
      await api.updateImages(ids, { status: 'not-sure', albumId: null });
      updateImages(ids, { status: 'not-sure', albumId: null });
    }
  };

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
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
            <SidebarItem
              icon={<Trash2 size={16} />}
              label="Trash"
              count={trashCount}
              isActive={currentView === 'trash'}
              onClick={() => setView('trash')}
              isDropTarget
              onDrop={handleMoveToTrash}
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
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-11 font-medium text-macos-dark-text-tertiary uppercase tracking-wide">
              Albums
            </h3>
            <button
              onClick={handleCreateAlbum}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-macos-dark-bg-3 text-macos-dark-text-tertiary hover:text-white"
            >
              <Plus size={14} />
            </button>
          </div>

          <SortableContext
            items={rootAlbums.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0.5">
              {rootAlbums.map((album) => (
                <AlbumItemWrapper key={album.id} album={album} depth={0} />
              ))}
            </div>
          </SortableContext>

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
      </aside>
    </DndContext>
  );
}
