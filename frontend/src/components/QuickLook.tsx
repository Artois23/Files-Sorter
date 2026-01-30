import { useEffect, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Trash2,
  Clock,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../utils/api';

export function QuickLook() {
  const {
    quickLookImageId,
    setQuickLookImageId,
    getImageById,
    getVisibleImages,
    updateImages,
  } = useAppStore();

  const visibleImages = getVisibleImages();
  const currentImage = quickLookImageId ? getImageById(quickLookImageId) : null;
  const currentIndex = currentImage
    ? visibleImages.findIndex((img) => img.id === currentImage.id)
    : -1;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < visibleImages.length - 1;

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      setQuickLookImageId(visibleImages[currentIndex - 1].id);
    }
  }, [hasPrev, currentIndex, visibleImages, setQuickLookImageId]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      setQuickLookImageId(visibleImages[currentIndex + 1].id);
    }
  }, [hasNext, currentIndex, visibleImages, setQuickLookImageId]);

  const close = useCallback(() => {
    setQuickLookImageId(null);
  }, [setQuickLookImageId]);

  const handleOpenPreview = async () => {
    if (currentImage) {
      try {
        await api.openWithPreview(currentImage.path);
      } catch (error) {
        console.error('Failed to open with Preview:', error);
      }
    }
  };

  const handleMarkTrash = async () => {
    if (currentImage) {
      try {
        await api.updateImages([currentImage.id], { status: 'trash', albumId: null });
        updateImages([currentImage.id], { status: 'trash', albumId: null });
        if (hasNext) {
          goToNext();
        } else if (hasPrev) {
          goToPrev();
        } else {
          close();
        }
      } catch (error) {
        console.error('Failed to mark as trash:', error);
      }
    }
  };

  const handleMarkNotSure = async () => {
    if (currentImage) {
      try {
        await api.updateImages([currentImage.id], { status: 'not-sure', albumId: null });
        updateImages([currentImage.id], { status: 'not-sure', albumId: null });
      } catch (error) {
        console.error('Failed to mark as not sure:', error);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case 'Escape':
        case ' ':
          e.preventDefault();
          close();
          break;
        case 'Backspace':
        case 'Delete':
          e.preventDefault();
          handleMarkTrash();
          break;
      }
    };

    if (quickLookImageId) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [quickLookImageId, goToPrev, goToNext, close]);

  if (!currentImage) return null;

  // Get filmstrip images (subset around current)
  const filmstripStart = Math.max(0, currentIndex - 10);
  const filmstripEnd = Math.min(visibleImages.length, currentIndex + 11);
  const filmstripImages = visibleImages.slice(filmstripStart, filmstripEnd);

  return (
    <div className="fixed inset-0 z-50 flex flex-col animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={close}
      />

      {/* Modal container - full screen */}
      <div className="relative flex flex-col min-h-0 overflow-hidden w-full h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between bg-macos-dark-bg-2 px-4 py-3 relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={close}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-macos-dark-bg-3"
            >
              <X size={18} />
            </button>

            <button
              onClick={goToPrev}
              disabled={!hasPrev}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-macos-dark-bg-3 disabled:opacity-30"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              onClick={goToNext}
              disabled={!hasNext}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-macos-dark-bg-3 disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex-1 text-center">
            <h2 className="text-15 font-medium truncate max-w-md mx-auto">
              {currentImage.filename}
            </h2>
            <p className="text-11 text-macos-dark-text-tertiary">
              {currentIndex + 1} of {visibleImages.length}
              {currentImage.width && currentImage.height && (
                <span className="ml-2">
                  {currentImage.width} × {currentImage.height}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkNotSure}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-macos-dark-bg-3"
              title="Mark as Not Sure"
            >
              <Clock size={18} />
            </button>

            <button
              onClick={handleMarkTrash}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-macos-dark-bg-3 text-red-400"
              title="Mark as Trash"
            >
              <Trash2 size={18} />
            </button>

            <button
              onClick={handleOpenPreview}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-macos-dark-bg-3 hover:bg-macos-dark-bg-1 text-13"
            >
              <ExternalLink size={14} />
              Open with Preview
            </button>
          </div>
        </div>

        {/* Image area */}
        <div
          className="flex-1 min-h-0 flex items-center justify-center bg-macos-dark-bg-1 relative overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            if (clickX < rect.width / 2) {
              goToPrev();
            } else {
              goToNext();
            }
          }}
        >
          {currentImage.isSupported ? (
            <img
              src={`/api/images/${currentImage.id}/full`}
              alt={currentImage.filename}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-center text-macos-dark-text-tertiary">
              <p className="text-15 mb-2">Preview not available</p>
              <p className="text-13">Format: {currentImage.format.toUpperCase()}</p>
            </div>
          )}

          {/* Navigation hints */}
          {hasPrev && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <ChevronLeft size={24} />
            </div>
          )}
          {hasNext && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <ChevronRight size={24} />
            </div>
          )}
        </div>

        {/* Filmstrip */}
        <div className="bg-macos-dark-bg-2 p-3 overflow-x-auto">
          <div className="flex gap-2 justify-center">
            {filmstripImages.map((image) => (
              <button
                key={image.id}
                onClick={() => setQuickLookImageId(image.id)}
                className={`
                  w-16 h-16 rounded-md overflow-hidden flex-shrink-0 transition-all
                  ${image.id === currentImage.id
                    ? 'ring-2 ring-accent scale-105'
                    : 'opacity-60 hover:opacity-100'
                  }
                `}
              >
                <img
                  src={image.thumbnailUrl}
                  alt={image.filename}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
