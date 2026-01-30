import { useAppStore } from '../stores/appStore';

export function StatusBar() {
  const {
    getVisibleImages,
    selectedImageIds,
    images,
    currentView,
    hideAssigned,
  } = useAppStore();

  const visibleImages = getVisibleImages();
  const visibleCount = visibleImages.length;
  const selectedCount = selectedImageIds.size;

  const orphanCount = images.filter(
    (img) => !img.albumId && img.status === 'normal'
  ).length;
  const assignedCount = images.filter(
    (img) => img.albumId && img.status === 'normal'
  ).length;

  return (
    <footer className="h-6 bg-macos-dark-bg-3 border-t border-macos-dark-border flex items-center px-4 text-11 text-macos-dark-text-tertiary">
      <div className="flex-1">
        {visibleCount.toLocaleString()} image{visibleCount !== 1 ? 's' : ''}
      </div>

      {selectedCount > 0 && (
        <div className="flex-1 text-center">
          {selectedCount.toLocaleString()} selected
        </div>
      )}

      <div className="flex-1 text-right">
        {currentView === 'all' && hideAssigned && assignedCount > 0 && (
          <span>{assignedCount.toLocaleString()} hidden (assigned)</span>
        )}
        {currentView === 'all' && !hideAssigned && (
          <span>{orphanCount.toLocaleString()} orphans</span>
        )}
      </div>
    </footer>
  );
}
