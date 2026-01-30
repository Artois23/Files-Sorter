import { useRef, useCallback, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Folder,
  Clock,
  Trash2,
  FileQuestion,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useDraggable } from '@dnd-kit/core';
import { api } from '../utils/api';
import type { ImageFile } from '../types';

interface ThumbnailProps {
  image: ImageFile;
  isSelected: boolean;
  size: number;
  isEditing: boolean;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}

function Thumbnail({
  image,
  isSelected,
  size,
  isEditing,
  onClick,
  onContextMenu,
  onStartEdit,
  onCancelEdit,
}: ThumbnailProps) {
  const showStatusBadges = useAppStore((state) => state.settings.showStatusBadges);
  const updateImage = useAppStore((state) => state.updateImage);
  const [editValue, setEditValue] = useState(image.filename);
  const [isRenaming, setIsRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset edit value when editing starts
  useEffect(() => {
    if (isEditing) {
      setEditValue(image.filename);
      setError(null);
      // Focus and select text
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Select filename without extension
          const dotIndex = image.filename.lastIndexOf('.');
          if (dotIndex > 0) {
            inputRef.current.setSelectionRange(0, dotIndex);
          } else {
            inputRef.current.select();
          }
        }
      }, 0);
    }
  }, [isEditing, image.filename]);

  // Clear error after 2 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleRename = async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === image.filename) {
      onCancelEdit();
      return;
    }

    setIsRenaming(true);
    setError(null);

    try {
      const result = await api.renameImage(image.id, trimmed);
      updateImage(image.id, { path: result.path, filename: result.filename });
      onCancelEdit();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rename failed';
      setError(message);
      setIsRenaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  const handleFilenameDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartEdit();
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: image.id,
    data: { type: 'image', imageId: image.id },
  });

  const getStatusBadge = () => {
    if (!showStatusBadges) return null;

    if (image.status === 'trash') {
      return (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
          <Trash2 size={14} className="text-red-400" />
        </div>
      );
    }

    if (image.status === 'not-sure') {
      return (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
          <Clock size={14} className="text-yellow-400" />
        </div>
      );
    }

    if (image.albumId) {
      return (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
          <Folder size={14} className="text-accent" />
        </div>
      );
    }

    return null;
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex flex-col ${isDragging ? 'opacity-50' : ''}`}
      style={{ width: size }}
    >
      {/* Thumbnail image */}
      <div
        className={`
          relative rounded-lg overflow-hidden cursor-pointer transition-all duration-100
          ${isSelected
            ? 'ring-3 ring-accent scale-[1.02] shadow-lg'
            : 'hover:brightness-110 hover:ring-1 hover:ring-white/20'
          }
        `}
        style={{ width: size, height: size }}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        {image.isSupported ? (
          <img
            src={image.thumbnailUrl}
            alt={image.filename}
            className="w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-macos-dark-bg-3 flex flex-col items-center justify-center gap-2">
            <FileQuestion size={32} className="text-macos-dark-text-tertiary" />
            <span className="text-11 text-macos-dark-text-tertiary font-medium px-2 py-0.5 bg-macos-dark-bg-1 rounded">
              {image.format.toUpperCase()}
            </span>
          </div>
        )}

        {getStatusBadge()}

        {!image.isSupported && (
          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-orange-500/80 flex items-center justify-center">
            <AlertCircle size={14} className="text-white" />
          </div>
        )}
      </div>

      {/* Filename below thumbnail */}
      <div className="filename-container mt-1">
        {isEditing ? (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              disabled={isRenaming}
              className="w-full text-xs text-white bg-neutral-700 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-500"
            />
            {isRenaming && (
              <Loader2 size={12} className="absolute right-1 top-1/2 -translate-y-1/2 text-neutral-400 animate-spin" />
            )}
          </div>
        ) : (
          <p
            className="text-xs text-neutral-400 truncate text-center cursor-default"
            onDoubleClick={handleFilenameDoubleClick}
            title={image.filename}
          >
            {image.filename}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-400 mt-0.5 truncate text-center">{error}</p>
        )}
      </div>
    </div>
  );
}

export function ImageGrid() {
  const {
    getVisibleImages,
    selectedImageIds,
    selectImage,
    clearSelection,
    setContextMenu,
    quickLookImageId,
    setQuickLookImageId,
    thumbnailSize,
    currentView,
    hideAssigned,
    images,
    editingImageId,
    setEditingImageId,
  } = useAppStore();

  const visibleImages = getVisibleImages();
  const containerRef = useRef<HTMLDivElement>(null);

  const gap = 8;
  const padding = 16;

  // Calculate columns based on container width
  const getColumnCount = useCallback(() => {
    if (!containerRef.current) return 4;
    const containerWidth = containerRef.current.clientWidth - padding * 2;
    return Math.max(1, Math.floor((containerWidth + gap) / (thumbnailSize + gap)));
  }, [thumbnailSize]);

  const columnCount = getColumnCount();
  const rowCount = Math.ceil(visibleImages.length / columnCount);

  const showFilenameOverlayGrid = useAppStore((state) => state.settings.showFilenameOverlay);
  const filenameHeight = showFilenameOverlayGrid ? 24 : 0;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => thumbnailSize + filenameHeight + gap,
    overscan: 3,
  });

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const lastSelectedId = Array.from(selectedImageIds).pop();
      const currentIndex = lastSelectedId
        ? visibleImages.findIndex((img) => img.id === lastSelectedId)
        : -1;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) {
            selectImage(visibleImages[currentIndex - 1].id);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < visibleImages.length - 1) {
            selectImage(visibleImages[currentIndex + 1].id);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex >= columnCount) {
            selectImage(visibleImages[currentIndex - columnCount].id);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex + columnCount < visibleImages.length) {
            selectImage(visibleImages[currentIndex + columnCount].id);
          }
          break;
        case 'Home':
          e.preventDefault();
          if (visibleImages.length > 0) {
            selectImage(visibleImages[0].id);
          }
          break;
        case 'End':
          e.preventDefault();
          if (visibleImages.length > 0) {
            selectImage(visibleImages[visibleImages.length - 1].id);
          }
          break;
        case ' ':
        case 'Enter':
          // Don't open preview if it's already open (QuickLook handles Space to close)
          if (quickLookImageId) return;
          e.preventDefault();
          if (selectedImageIds.size > 0) {
            setQuickLookImageId(lastSelectedId || null);
          }
          break;
        case 'Escape':
          e.preventDefault();
          clearSelection();
          break;
        case 'a':
          if (e.metaKey) {
            e.preventDefault();
            useAppStore.getState().selectAll();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    visibleImages,
    selectedImageIds,
    columnCount,
    selectImage,
    clearSelection,
    quickLookImageId,
    setQuickLookImageId,
  ]);

  const handleClick = (e: React.MouseEvent, imageId: string) => {
    if (e.shiftKey) {
      selectImage(imageId, false, true);
    } else if (e.metaKey) {
      selectImage(imageId, true);
    } else {
      selectImage(imageId);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, imageId: string) => {
    e.preventDefault();

    // If right-clicking on an unselected image, select it
    if (!selectedImageIds.has(imageId)) {
      selectImage(imageId);
    }

    const ids = selectedImageIds.has(imageId)
      ? Array.from(selectedImageIds)
      : [imageId];

    setContextMenu({ x: e.clientX, y: e.clientY, imageIds: ids });
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      clearSelection();
    }
  };

  // Empty state
  if (visibleImages.length === 0) {
    const assignedCount = images.filter(
      (img) => img.albumId && img.status === 'normal'
    ).length;

    return (
      <div className="flex-1 flex items-center justify-center text-macos-dark-text-tertiary">
        <div className="text-center">
          {images.length === 0 ? (
            <>
              <p className="text-15 mb-2">No images loaded</p>
              <p className="text-13">Choose a source folder to get started</p>
            </>
          ) : currentView === 'all' && hideAssigned && assignedCount > 0 ? (
            <>
              <p className="text-15 mb-2">All images are organized!</p>
              <p className="text-13">
                Toggle off "Hide Assigned" to see all {assignedCount} images
              </p>
            </>
          ) : currentView === 'album' ? (
            <>
              <p className="text-15 mb-2">No images in this album</p>
              <p className="text-13">Drag images here to add them</p>
            </>
          ) : currentView === 'orphans' ? (
            <>
              <p className="text-15 mb-2">No orphan images</p>
              <p className="text-13">All images have been assigned to albums</p>
            </>
          ) : (
            <p className="text-15">No images to display</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex-1 overflow-y-auto bg-macos-dark-bg-1 ${showFilenameOverlayGrid ? 'show-filenames' : 'hide-filenames'}`}
      style={{ padding }}
      onClick={handleContainerClick}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowImages = visibleImages.slice(
            startIndex,
            startIndex + columnCount
          );

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                className="flex gap-2"
                style={{ gap }}
              >
                {rowImages.map((image) => (
                  <Thumbnail
                    key={image.id}
                    image={image}
                    isSelected={selectedImageIds.has(image.id)}
                    size={thumbnailSize}
                    isEditing={editingImageId === image.id}
                    onClick={(e) => handleClick(e, image.id)}
                    onContextMenu={(e) => handleContextMenu(e, image.id)}
                    onStartEdit={() => setEditingImageId(image.id)}
                    onCancelEdit={() => setEditingImageId(null)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
