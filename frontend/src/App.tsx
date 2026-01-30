import { useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { useAppStore } from './stores/appStore';
import { api } from './utils/api';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { ImageGrid } from './components/ImageGrid';
import { StatusBar } from './components/StatusBar';
import { ContextMenu } from './components/ContextMenu';
import { QuickLook } from './components/QuickLook';
import { SettingsModal } from './components/SettingsModal';
import { OrganizeDialog } from './components/OrganizeDialog';
import { ScanProgress } from './components/ScanProgress';
import { WelcomeScreen } from './components/WelcomeScreen';
import { useState } from 'react';
import type { ImageFile } from './types';

function App() {
  const {
    images,
    setImages,
    setAlbums,
    updateSettings,
    settings,
    selectedImageIds,
    updateImages,
    getImageById,
  } = useAppStore();

  const [draggedImage, setDraggedImage] = useState<ImageFile | null>(null);

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
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggedImage(null);

    const { over } = event;
    if (!over) return;

    const overData = over.data.current;

    // Handle drop on album
    if (overData?.type === 'album' && selectedImageIds.size > 0) {
      const albumId = overData.albumId;
      const ids = Array.from(selectedImageIds);
      await api.updateImages(ids, { albumId, status: 'normal' });
      updateImages(ids, { albumId, status: 'normal' });
    }

    // Handle drop on sidebar items
    if (overData?.type === 'sidebar-item' && overData?.onDrop) {
      overData.onDrop();
    }
  };

  const showWelcome = images.length === 0 && !settings.sourceFolder;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
        <OrganizeDialog />
        <ScanProgress />

        {/* Drag overlay */}
        <DragOverlay>
          {draggedImage && (
            <div className="relative">
              <div className="w-24 h-24 rounded-lg overflow-hidden shadow-xl ring-2 ring-accent">
                <img
                  src={draggedImage.thumbnailUrl}
                  alt={draggedImage.filename}
                  className="w-full h-full object-cover"
                />
              </div>
              {selectedImageIds.size > 1 && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center text-11 font-semibold">
                  {selectedImageIds.size}
                </div>
              )}
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

export default App;
