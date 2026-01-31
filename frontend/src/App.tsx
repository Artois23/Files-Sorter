import { useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragCancelEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  Modifier,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { FileImage } from 'lucide-react';

// Modifier to position overlay at cursor
const snapToCursor: Modifier = ({ transform, activatorEvent, draggingNodeRect }) => {
  if (activatorEvent && draggingNodeRect) {
    const event = activatorEvent as PointerEvent;
    return {
      ...transform,
      x: event.clientX - draggingNodeRect.left + transform.x,
      y: event.clientY - draggingNodeRect.top + transform.y,
    };
  }
  return transform;
};
import { useAppStore } from './stores/appStore';
import { api } from './utils/api';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { ImageGrid } from './components/ImageGrid';
import { StatusBar } from './components/StatusBar';
import { ContextMenu } from './components/ContextMenu';
import { QuickLook } from './components/QuickLook';
import { SettingsModal } from './components/SettingsModal';
import { ScanProgress } from './components/ScanProgress';
import { OcrProgress } from './components/OcrProgress';
import { WelcomeScreen } from './components/WelcomeScreen';
import { useState } from 'react';
import type { ImageFile } from './types';

function App() {
  const {
    setImages,
    albums,
    setAlbums,
    reorderAlbums,
    updateSettings,
    selectedImageIds,
    selectImage,
    updateImages,
    getImageById,
    setSelectMode,
    clearSelection,
  } = useAppStore();

  const [draggedImage, setDraggedImage] = useState<ImageFile | null>(null);
  // Persist welcome dismissal in sessionStorage (resets on browser close, persists on refresh)
  const [forceHideWelcome, setForceHideWelcome] = useState(() => {
    return sessionStorage.getItem('hideWelcome') === 'true';
  });

  const handleDismissWelcome = () => {
    sessionStorage.setItem('hideWelcome', 'true');
    setForceHideWelcome(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Helper to check if an album is a descendant of another
  const isDescendantOf = (albumId: string, potentialAncestorId: string): boolean => {
    let current = albums.find((a) => a.id === albumId);
    while (current) {
      if (current.parentId === potentialAncestorId) return true;
      current = current.parentId ? albums.find((a) => a.id === current!.parentId) : undefined;
    }
    return false;
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [fetchedImages, albums, serverSettings, vaults] = await Promise.all([
          api.getImages(),
          api.getAlbums(),
          api.getSettings(),
          api.getVaults(),
        ]);
        setImages(fetchedImages);
        setAlbums(albums);
        updateSettings(serverSettings);
        useAppStore.getState().setVaults(vaults);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    loadData();
  }, [setImages, setAlbums, updateSettings]);

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current;
    // Only handle image drags here, not album drags
    if (activeData?.type !== 'image') {
      return;
    }

    const imageId = event.active.id as string;
    const image = getImageById(imageId);
    if (image) {
      setDraggedImage(image);
      // Ensure the dragged image is selected
      if (!selectedImageIds.has(imageId)) {
        selectImage(imageId);
      }
    }
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setDraggedImage(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    // Always clear drag state first
    setDraggedImage(null);

    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Determine if we're dragging an image
    const isDraggingImage = activeData?.type === 'image';

    if (isDraggingImage) {
      // Handle image drop on album - vault-centric: moves files immediately
      if (overData?.type === 'album' && selectedImageIds.size > 0) {
        const albumId = overData.albumId;
        const ids = Array.from(selectedImageIds);
        try {
          // Use vault-centric API to move files on disk
          const result = await api.batchMoveImages(ids, albumId);

          // Update local state for successful moves
          const successIds = result.results
            .filter(r => r.success)
            .map(r => r.id);

          if (successIds.length > 0) {
            updateImages(successIds, { albumId, status: 'normal' });
            // Turn off select mode and clear selection after successful drop
            setSelectMode(false);
            clearSelection();
          }

          // Show error if any failures
          const failures = result.results.filter(r => !r.success);
          if (failures.length > 0) {
            console.error('Some files failed to move:', failures);
            alert(`${failures.length} file(s) failed to move. Check console for details.`);
            // Refresh images from backend to sync state
            try {
              const freshImages = await api.getImages();
              setImages(freshImages);
            } catch (e) {
              console.error('Failed to refresh images after error:', e);
            }
          }
        } catch (error) {
          console.error('Failed to move images to album:', error);
          alert(error instanceof Error ? error.message : 'Failed to move images');
          // Refresh images from backend to sync state
          try {
            const freshImages = await api.getImages();
            setImages(freshImages);
          } catch (e) {
            console.error('Failed to refresh images after error:', e);
          }
        }
        return;
      }

      // Handle image drop on sidebar items (trash, not-sure)
      if (overData?.type === 'sidebar-item' && overData?.onDrop) {
        overData.onDrop();
        // Turn off select mode and clear selection after drop
        setSelectMode(false);
        clearSelection();
        return;
      }
    } else {
      // We're dragging an album
      const draggedAlbum = albums.find((a) => a.id === active.id);
      if (!draggedAlbum) return;

      // Handle album drop onto vault header (move to vault root)
      if (overData?.type === 'vault') {
        const targetVaultId = overData.vaultId;

        // If album is already at root of this vault, do nothing
        if (draggedAlbum.parentId === null && draggedAlbum.vaultId === targetVaultId) {
          return;
        }

        try {
          // Move to vault root (parentId = null)
          const updatedAlbum = await api.moveVaultFolder(draggedAlbum.id, null);
          const updatedAlbums = albums.map((a) =>
            a.id === draggedAlbum.id
              ? { ...a, parentId: null, vaultId: targetVaultId, order: updatedAlbum.order }
              : a
          );
          reorderAlbums(updatedAlbums);
        } catch (error) {
          console.error('Failed to move album to vault root:', error);
          alert(error instanceof Error ? error.message : 'Failed to move folder');
        }
        return;
      }

      // Handle album drop onto sidebar-root (move to top level of vault)
      if (overData?.type === 'sidebar-root') {
        const targetVaultId = overData.vaultId || draggedAlbum.vaultId;

        if (draggedAlbum.parentId !== null || draggedAlbum.vaultId !== targetVaultId) {
          try {
            // Move folder on disk and update database
            const updatedAlbum = await api.moveVaultFolder(draggedAlbum.id, null);
            const updatedAlbums = albums.map((a) =>
              a.id === draggedAlbum.id
                ? { ...a, parentId: null, vaultId: targetVaultId, order: updatedAlbum.order }
                : a
            );
            reorderAlbums(updatedAlbums);
          } catch (error) {
            console.error('Failed to move album to top level:', error);
            alert(error instanceof Error ? error.message : 'Failed to move folder');
          }
        }
        return;
      }

      // Handle album reordering (drop between albums)
      if (overData?.type === 'album-reorder') {
        const { targetAlbumId, position, parentId, vaultId } = overData;

        // Don't reorder if dropping on itself
        if (targetAlbumId === draggedAlbum.id) return;

        // Get siblings at this level
        const siblings = albums
          .filter((a) => a.parentId === parentId && a.vaultId === vaultId)
          .sort((a, b) => a.order - b.order);

        let newOrder: number;

        if (position === 'end' || targetAlbumId === null) {
          // Dropping at the end of the list
          const lastSibling = siblings[siblings.length - 1];
          newOrder = lastSibling ? lastSibling.order + 1 : 0;
        } else {
          const targetIndex = siblings.findIndex((a) => a.id === targetAlbumId);
          if (targetIndex === -1) return;

          if (position === 'before') {
            newOrder =
              targetIndex > 0
                ? (siblings[targetIndex - 1].order + siblings[targetIndex].order) / 2
                : siblings[targetIndex].order - 1;
          } else {
            newOrder =
              targetIndex < siblings.length - 1
                ? (siblings[targetIndex].order + siblings[targetIndex + 1].order) / 2
                : siblings[targetIndex].order + 1;
          }
        }

        try {
          // If parent changes, use moveVaultFolder
          if (draggedAlbum.parentId !== parentId) {
            await api.moveVaultFolder(draggedAlbum.id, parentId);
          }
          // Update local state with new order
          const updatedAlbums = albums.map((a) =>
            a.id === draggedAlbum.id ? { ...a, parentId, order: newOrder } : a
          );
          reorderAlbums(updatedAlbums);
        } catch (error) {
          console.error('Failed to reorder album:', error);
          alert(error instanceof Error ? error.message : 'Failed to reorder folder');
        }
        return;
      }

      // Handle album drop onto another album (reparent)
      if (overData?.type === 'album') {
        const targetAlbumId = overData.albumId;

        // Prevent dropping on self
        if (targetAlbumId === draggedAlbum.id) return;

        // Prevent dropping on descendants (circular hierarchy)
        if (isDescendantOf(targetAlbumId, draggedAlbum.id)) return;

        // Prevent dropping on current parent (no change needed)
        if (draggedAlbum.parentId === targetAlbumId) return;

        try {
          // Move folder on disk and update database
          const updatedAlbum = await api.moveVaultFolder(draggedAlbum.id, targetAlbumId);
          const updatedAlbums = albums.map((a) =>
            a.id === draggedAlbum.id ? { ...a, parentId: targetAlbumId, order: updatedAlbum.order } : a
          );
          reorderAlbums(updatedAlbums);
        } catch (error) {
          console.error('Failed to reparent album:', error);
          alert(error instanceof Error ? error.message : 'Failed to move folder');
        }
        return;
      }

    }
  };

  // Always show welcome screen on launch, until user dismisses it
  const showWelcome = !forceHideWelcome;

  // Show full-screen welcome if not dismissed
  if (showWelcome) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-macos-dark-bg-1">
        <WelcomeScreen onSkip={handleDismissWelcome} />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-screen flex flex-col overflow-hidden">
        <Toolbar />

        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <ImageGrid />
        </div>

        <StatusBar />

        {/* Modals and overlays */}
        <ContextMenu />
        <QuickLook />
        <SettingsModal />
        <ScanProgress />
        <OcrProgress />

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null} modifiers={[snapToCursor]}>
          {draggedImage && (
            <div className="flex items-center gap-2 bg-macos-dark-bg-2 rounded-lg px-3 py-2 shadow-xl border border-macos-dark-border">
              <FileImage size={20} className="text-accent" />
              <span className="text-13 text-white">
                {selectedImageIds.size > 1
                  ? `${selectedImageIds.size} images`
                  : draggedImage.filename}
              </span>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

export default App;
