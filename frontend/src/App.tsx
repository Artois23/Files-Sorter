import { useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
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
import { WelcomeScreen } from './components/WelcomeScreen';
import { useState } from 'react';
import type { ImageFile } from './types';

function App() {
  const {
    images,
    setImages,
    albums,
    setAlbums,
    reorderAlbums,
    updateSettings,
    settings,
    selectedImageIds,
    selectImage,
    updateImages,
    getImageById,
  } = useAppStore();

  const [draggedImage, setDraggedImage] = useState<ImageFile | null>(null);

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

  const rootAlbums = albums
    .filter((a) => a.parentId === null)
    .sort((a, b) => a.order - b.order);

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
        const [fetchedImages, albums, serverSettings] = await Promise.all([
          api.getImages(),
          api.getAlbums(),
          api.getSettings(),
        ]);
        setImages(fetchedImages);
        setAlbums(albums);
        updateSettings(serverSettings);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    loadData();
  }, [setImages, setAlbums, updateSettings]);

  const handleDragStart = (event: DragStartEvent) => {
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

  const handleDragEnd = async (event: DragEndEvent) => {
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
          }

          // Show error if any failures
          const failures = result.results.filter(r => !r.success);
          if (failures.length > 0) {
            console.error('Some files failed to move:', failures);
            alert(`${failures.length} file(s) failed to move. Check console for details.`);
          }
        } catch (error) {
          console.error('Failed to move images to album:', error);
          alert(error instanceof Error ? error.message : 'Failed to move images');
        }
        return;
      }

      // Handle image drop on sidebar items (trash, not-sure)
      if (overData?.type === 'sidebar-item' && overData?.onDrop) {
        overData.onDrop();
        return;
      }
    } else {
      // We're dragging an album
      const draggedAlbum = albums.find((a) => a.id === active.id);
      if (!draggedAlbum) return;

      // Handle album drop onto sidebar-root (move to top level)
      if (overData?.type === 'sidebar-root') {
        if (draggedAlbum.parentId !== null) {
          const maxRootOrder = Math.max(...rootAlbums.map((a) => a.order), -1);
          const updatedAlbum = { ...draggedAlbum, parentId: null, order: maxRootOrder + 1 };
          const updatedAlbums = albums.map((a) =>
            a.id === draggedAlbum.id ? updatedAlbum : a
          );
          reorderAlbums(updatedAlbums);
          try {
            await api.reorderAlbums(
              updatedAlbums.map((a) => ({
                id: a.id,
                order: a.order,
                parentId: a.parentId,
              }))
            );
          } catch (error) {
            console.error('Failed to move album to top level:', error);
          }
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

        // Calculate new order (add to end of target's children)
        const siblingAlbums = albums.filter((a) => a.parentId === targetAlbumId);
        const maxSiblingOrder = Math.max(...siblingAlbums.map((a) => a.order), -1);

        const updatedAlbum = { ...draggedAlbum, parentId: targetAlbumId, order: maxSiblingOrder + 1 };
        const updatedAlbums = albums.map((a) =>
          a.id === draggedAlbum.id ? updatedAlbum : a
        );
        reorderAlbums(updatedAlbums);
        try {
          await api.reorderAlbums(
            updatedAlbums.map((a) => ({
              id: a.id,
              order: a.order,
              parentId: a.parentId,
            }))
          );
        } catch (error) {
          console.error('Failed to reparent album:', error);
        }
        return;
      }

    }
  };

  const showWelcome = images.length === 0 && !settings.sourceFolder;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col overflow-hidden">
        <Toolbar />

        <div className="flex-1 flex overflow-hidden">
          <Sidebar />

          {showWelcome ? <WelcomeScreen /> : <ImageGrid />}
        </div>

        <StatusBar />

        {/* Modals and overlays */}
        <ContextMenu />
        <QuickLook />
        <SettingsModal />
        <ScanProgress />

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
