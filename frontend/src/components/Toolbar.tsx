import { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Settings,
  Grid3X3,
  LayoutGrid,
  FolderOpen,
  ChevronRight,
  Filter,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  MousePointerClick,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../utils/api';

export function Toolbar() {
  const {
    currentView,
    currentAlbumId,
    toggleSidebar,
    thumbnailSize,
    setThumbnailSize,
    hideAssigned,
    setHideAssigned,
    settings,
    updateSettings,
    setShowSettings,
    albums,
    images,
    sortBy,
    sortDirection,
    setSortBy,
    setSortDirection,
    getVisibleImages,
    setImages,
    selectMode,
    setSelectMode,
    selectedImageIds,
  } = useAppStore();

  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(e.target as Node) &&
        !filterButtonRef.current?.contains(e.target as Node)
      ) {
        setShowFilterMenu(false);
      }
    };

    if (showFilterMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterMenu]);

  const currentAlbum = currentAlbumId
    ? albums.find((a) => a.id === currentAlbumId)
    : null;

  // Build breadcrumb for nested albums
  const getBreadcrumb = () => {
    if (!currentAlbum) return null;

    const path: typeof albums = [];
    let album: typeof currentAlbum | undefined = currentAlbum;

    while (album) {
      path.unshift(album);
      album = album.parentId
        ? albums.find((a) => a.id === album!.parentId)
        : undefined;
    }

    return path;
  };

  const breadcrumb = getBreadcrumb();

  const getViewTitle = () => {
    switch (currentView) {
      case 'all':
        return 'All Images';
      case 'orphans':
        return 'Orphans';
      case 'trash':
        return 'Trash';
      case 'not-sure':
        return 'Not Sure';
      case 'album':
        return currentAlbum?.name || 'Album';
      default:
        return '';
    }
  };

  const handleSelectSource = async () => {
    try {
      const result = await api.selectFolder();
      if (result?.path) {
        await api.startScan(result.path);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  };

  const assignedCount = images.filter(
    (img) => img.albumId && img.status === 'normal'
  ).length;

  const handleRegenerateThumbnails = async () => {
    setIsRegenerating(true);
    try {
      const scope = settings.thumbnailRefreshScope;
      const imageIds = scope === 'visible'
        ? getVisibleImages().map((img) => img.id)
        : 'all';

      await api.regenerateThumbnails(imageIds, thumbnailSize);

      // Refresh images to get new thumbnail URLs
      const refreshedImages = await api.getImages();
      setImages(refreshedImages);
    } catch (error) {
      console.error('Failed to regenerate thumbnails:', error);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Check if any filter is active
  const hasActiveFilter = hideAssigned || sortBy !== 'date' || sortDirection !== 'desc';

  return (
    <header className="h-[52px] bg-macos-dark-bg-3 border-b border-macos-dark-border flex items-center px-3 gap-3">
      {/* Left section */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-macos-dark-bg-2 text-macos-dark-text-secondary"
          title="Toggle sidebar"
        >
          <Menu size={18} />
        </button>

        <button
          onClick={handleSelectSource}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-macos-dark-bg-2 text-macos-dark-text-secondary"
          title="Choose source folder"
        >
          <FolderOpen size={16} />
          <span className="text-13 max-w-[280px] truncate">
            {settings.sourceFolder
              ? `${settings.sourceFolder.split('/').pop()} (${images.length} image${images.length !== 1 ? 's' : ''})`
              : 'Choose Source'}
          </span>
        </button>
      </div>

      {/* Center section */}
      <div className="flex-1 flex items-center justify-center">
        {breadcrumb && breadcrumb.length > 1 ? (
          <div className="flex items-center gap-1 text-15">
            {breadcrumb.map((album, i) => (
              <span key={album.id} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight
                    size={14}
                    className="text-macos-dark-text-tertiary"
                  />
                )}
                <span
                  className={
                    i === breadcrumb.length - 1
                      ? 'font-medium'
                      : 'text-macos-dark-text-tertiary'
                  }
                >
                  {album.name}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <h1 className="text-15 font-medium">{getViewTitle()}</h1>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Select mode toggle */}
        <button
          onClick={() => setSelectMode(!selectMode)}
          className={`
            w-8 h-8 flex items-center justify-center rounded-md hover:bg-macos-dark-bg-2
            ${selectMode ? 'text-accent bg-accent/20' : 'text-macos-dark-text-secondary'}
          `}
          title={selectMode ? `Select mode ON (${selectedImageIds.size} selected)` : 'Select mode (click images to select multiple)'}
        >
          <MousePointerClick size={18} />
        </button>

        {/* Filter dropdown */}
        <div className="relative">
          <button
            ref={filterButtonRef}
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className={`
              w-8 h-8 flex items-center justify-center rounded-md hover:bg-macos-dark-bg-2
              ${hasActiveFilter ? 'text-accent' : 'text-macos-dark-text-secondary'}
            `}
            title="Filter & Sort"
          >
            <Filter size={18} />
          </button>

          {showFilterMenu && (
            <div
              ref={filterMenuRef}
              className="absolute right-0 top-full mt-1 bg-macos-dark-bg-2/95 backdrop-blur-xl rounded-lg shadow-xl border border-macos-dark-border py-1 min-w-[180px] z-50"
            >
              {/* Sort options */}
              <div className="px-3 py-1.5 text-11 text-macos-dark-text-tertiary uppercase tracking-wide">
                Sort By
              </div>
              <button
                onClick={() => { setSortBy('date'); setSortDirection('desc'); }}
                className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white flex items-center justify-between"
              >
                <span>Date (Newest)</span>
                {sortBy === 'date' && sortDirection === 'desc' && <Check size={14} />}
              </button>
              <button
                onClick={() => { setSortBy('date'); setSortDirection('asc'); }}
                className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white flex items-center justify-between"
              >
                <span>Date (Oldest)</span>
                {sortBy === 'date' && sortDirection === 'asc' && <Check size={14} />}
              </button>
              <button
                onClick={() => { setSortBy('name'); setSortDirection('asc'); }}
                className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white flex items-center justify-between"
              >
                <span>Name (A-Z)</span>
                {sortBy === 'name' && sortDirection === 'asc' && <Check size={14} />}
              </button>
              <button
                onClick={() => { setSortBy('name'); setSortDirection('desc'); }}
                className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white flex items-center justify-between"
              >
                <span>Name (Z-A)</span>
                {sortBy === 'name' && sortDirection === 'desc' && <Check size={14} />}
              </button>

              <div className="h-px bg-macos-dark-border my-1" />

              {/* Filter options */}
              <div className="px-3 py-1.5 text-11 text-macos-dark-text-tertiary uppercase tracking-wide">
                Filter
              </div>
              <button
                onClick={() => setHideAssigned(!hideAssigned)}
                className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white flex items-center justify-between"
              >
                <span>Hide Assigned{assignedCount > 0 ? ` (${assignedCount})` : ''}</span>
                {hideAssigned && <Check size={14} />}
              </button>
            </div>
          )}
        </div>

        {/* Show filenames toggle */}
        <button
          onClick={() => {
            const newValue = !settings.showFilenameOverlay;
            updateSettings({ showFilenameOverlay: newValue });
            api.updateSettings({ showFilenameOverlay: newValue });
          }}
          className={`
            w-8 h-8 flex items-center justify-center rounded-md hover:bg-macos-dark-bg-2
            ${settings.showFilenameOverlay ? 'text-accent' : 'text-macos-dark-text-secondary'}
          `}
          title={settings.showFilenameOverlay ? 'Hide filenames' : 'Show filenames'}
        >
          {settings.showFilenameOverlay ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>

        {/* Thumbnail size slider */}
        <div className="flex items-center gap-2">
          <Grid3X3 size={14} className="text-macos-dark-text-tertiary" />
          <input
            type="range"
            min={80}
            max={400}
            value={thumbnailSize}
            onChange={(e) => setThumbnailSize(Number(e.target.value))}
            className="w-48 h-1 bg-macos-dark-bg-1 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <LayoutGrid size={18} className="text-macos-dark-text-tertiary" />
          <button
            onClick={handleRegenerateThumbnails}
            disabled={isRegenerating || images.length === 0}
            className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-macos-dark-bg-2 text-macos-dark-text-secondary disabled:opacity-30 ${isRegenerating ? 'animate-spin' : ''}`}
            title={`Regenerate thumbnails at ${thumbnailSize}px (${settings.thumbnailRefreshScope})`}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Settings button */}
        <button
          onClick={() => setShowSettings(true)}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-macos-dark-bg-2 text-macos-dark-text-secondary"
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
