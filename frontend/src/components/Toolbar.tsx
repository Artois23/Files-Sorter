import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Menu,
  Settings,
  Grid3X3,
  LayoutGrid,
  FolderOpen,
  ChevronRight,
  Filter,
  Check,
  FileText,
  RefreshCw,
  MousePointerClick,
  ScanText,
  Search,
  X,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../utils/api';

export function Toolbar() {
  const {
    currentView,
    currentAlbumId,
    currentVaultId,
    setView,
    toggleSidebar,
    thumbnailSize,
    setThumbnailSize,
    settings,
    updateSettings,
    setShowSettings,
    albums,
    images,
    vaults,
    sortBy,
    sortDirection,
    setSortBy,
    setSortDirection,
    getVisibleImages,
    setImages,
    selectMode,
    setSelectMode,
    selectedImageIds,
    ocrSearchQuery,
    setOcrSearchQuery,
    setOcrProgress,
  } = useAppStore();

  // Calculate visible image count (respects vault visibility)
  const visibleVaultIds = new Set(
    vaults.filter((v) => v.isVisible).map((v) => v.id)
  );
  const visibleImageCount = images.filter(
    (img) => vaults.length === 0 || !img.vaultId || visibleVaultIds.has(img.vaultId)
  ).length;

  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showOcrMenu, setShowOcrMenu] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState(ocrSearchQuery);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const ocrButtonRef = useRef<HTMLButtonElement>(null);
  const ocrMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      if (
        ocrMenuRef.current &&
        !ocrMenuRef.current.contains(e.target as Node) &&
        !ocrButtonRef.current?.contains(e.target as Node)
      ) {
        setShowOcrMenu(false);
      }
    };

    if (showFilterMenu || showOcrMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterMenu, showOcrMenu]);

  // Debounced OCR search
  useEffect(() => {
    const timer = setTimeout(() => {
      setOcrSearchQuery(localSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearchQuery, setOcrSearchQuery]);

  // Sync local search query with store
  useEffect(() => {
    setLocalSearchQuery(ocrSearchQuery);
  }, [ocrSearchQuery]);

  const currentAlbum = currentAlbumId
    ? albums.find((a) => a.id === currentAlbumId)
    : null;

  const currentVault = currentVaultId
    ? vaults.find((v) => v.id === currentVaultId)
    : null;

  // Get vault for current album (for breadcrumb)
  const albumVault = currentAlbum?.vaultId
    ? vaults.find((v) => v.id === currentAlbum.vaultId)
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
      case 'vault':
        return currentVault?.displayName || 'Vault';
      default:
        return '';
    }
  };

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

  // Check if any sort option is non-default
  const hasActiveFilter = sortBy !== 'date' || sortDirection !== 'desc';

  const handleOcrProcess = useCallback(async (scope: 'selected' | 'view' | 'all') => {
    setShowOcrMenu(false);

    let imageIds: string[];
    switch (scope) {
      case 'selected':
        imageIds = Array.from(selectedImageIds);
        break;
      case 'view':
        imageIds = getVisibleImages().map(img => img.id);
        break;
      case 'all':
        imageIds = images.map(img => img.id);
        break;
    }

    if (imageIds.length === 0) return;

    try {
      setOcrProgress({ isProcessing: true, total: imageIds.length, completed: 0, current: '' });
      await api.processOCR(imageIds);
    } catch (error) {
      console.error('Failed to start OCR processing:', error);
      setOcrProgress({ isProcessing: false });
    }
  }, [selectedImageIds, getVisibleImages, images, setOcrProgress]);

  const clearOcrSearch = useCallback(() => {
    setLocalSearchQuery('');
    setOcrSearchQuery('');
  }, [setOcrSearchQuery]);

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

        <div className="flex items-center gap-1.5 px-3 py-1.5 text-macos-dark-text-secondary">
          <FolderOpen size={16} />
          <span className="text-13">
            {vaults.length > 0
              ? `${visibleImageCount} image${visibleImageCount !== 1 ? 's' : ''}`
              : 'No vaults'}
          </span>
        </div>
      </div>

      {/* Center section */}
      <div className="flex-1 flex items-center justify-center">
        {currentView === 'album' && albumVault ? (
          // Album view with vault breadcrumb
          <div className="flex items-center gap-1 text-15">
            <button
              onClick={() => setView('vault', null, albumVault.id)}
              className="text-macos-dark-text-tertiary hover:text-white transition-colors"
            >
              {albumVault.displayName}
            </button>
            {breadcrumb?.map((album) => (
              <span key={album.id} className="flex items-center gap-1">
                <ChevronRight
                  size={14}
                  className="text-macos-dark-text-tertiary"
                />
                <span className="font-medium">{album.name}</span>
              </span>
            ))}
          </div>
        ) : breadcrumb && breadcrumb.length > 1 ? (
          // Nested album breadcrumb
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
        {/* OCR Search Field */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-macos-dark-text-tertiary" />
          <input
            ref={searchInputRef}
            type="text"
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            placeholder="Search text in images..."
            className="w-48 h-8 pl-8 pr-8 bg-macos-dark-bg-1 border border-macos-dark-border rounded-md text-13 text-white placeholder:text-macos-dark-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {localSearchQuery && (
            <button
              onClick={clearOcrSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-macos-dark-text-tertiary hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* OCR Button with dropdown */}
        <div className="relative">
          <button
            ref={ocrButtonRef}
            onClick={() => setShowOcrMenu(!showOcrMenu)}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-macos-dark-bg-2 text-macos-dark-text-secondary"
            title="OCR - Extract text from images"
          >
            <ScanText size={18} />
          </button>

          {showOcrMenu && (
            <div
              ref={ocrMenuRef}
              className="absolute right-0 top-full mt-1 bg-macos-dark-bg-2/95 backdrop-blur-xl rounded-lg shadow-xl border border-macos-dark-border py-1 min-w-[180px] z-50"
            >
              <div className="px-3 py-1.5 text-11 text-macos-dark-text-tertiary uppercase tracking-wide">
                Process OCR
              </div>
              {selectedImageIds.size > 0 && (
                <button
                  onClick={() => handleOcrProcess('selected')}
                  className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white"
                >
                  OCR Selected ({selectedImageIds.size})
                </button>
              )}
              <button
                onClick={() => handleOcrProcess('view')}
                className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white"
              >
                OCR Current View
              </button>
              <button
                onClick={() => handleOcrProcess('all')}
                className="w-full px-3 py-1.5 text-left text-13 hover:bg-accent hover:text-white"
              >
                OCR All Images
              </button>
            </div>
          )}
        </div>

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
          <FileText size={18} />
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
