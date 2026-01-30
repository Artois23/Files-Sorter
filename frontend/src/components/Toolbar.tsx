import {
  Menu,
  Settings,
  Grid3X3,
  LayoutGrid,
  FolderOpen,
  ChevronRight,
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
    setShowSettings,
    setShowOrganizeDialog,
    setOrganizeSummary,
    albums,
    images,
  } = useAppStore();

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

  const handleOrganize = async () => {
    // Check if vault folder is set
    if (!settings.vaultFolder) {
      alert('Please set a Vault folder in Settings first.');
      setShowSettings(true);
      return;
    }

    // Check if there are any assignments
    const hasAssignments = images.some(
      (img) => img.albumId || img.status === 'trash' || img.status === 'not-sure'
    );

    if (!hasAssignments) {
      alert('No images to organize. Assign images to albums first.');
      return;
    }

    try {
      const summary = await api.getOrganizeSummary();
      setOrganizeSummary(summary);
      setShowOrganizeDialog(true);
    } catch (error) {
      console.error('Failed to get organize summary:', error);
    }
  };

  const assignedCount = images.filter(
    (img) => img.albumId && img.status === 'normal'
  ).length;

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
          <span className="text-13 max-w-[200px] truncate">
            {settings.sourceFolder
              ? settings.sourceFolder.split('/').pop()
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
        {/* Hide assigned toggle (only in All Images view) */}
        {currentView === 'all' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-13 text-macos-dark-text-secondary">
              Hide Assigned
            </span>
            <div
              className={`
                relative w-10 h-6 rounded-full transition-colors
                ${hideAssigned ? 'bg-accent' : 'bg-macos-dark-bg-1'}
              `}
              onClick={() => setHideAssigned(!hideAssigned)}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
                  ${hideAssigned ? 'translate-x-5' : 'translate-x-1'}
                `}
              />
            </div>
            {hideAssigned && assignedCount > 0 && (
              <span className="text-11 text-macos-dark-text-tertiary">
                ({assignedCount} hidden)
              </span>
            )}
          </label>
        )}

        {/* Thumbnail size slider */}
        <div className="flex items-center gap-2">
          <Grid3X3 size={14} className="text-macos-dark-text-tertiary" />
          <input
            type="range"
            min={80}
            max={400}
            value={thumbnailSize}
            onChange={(e) => setThumbnailSize(Number(e.target.value))}
            className="w-24 accent-accent"
          />
          <LayoutGrid size={18} className="text-macos-dark-text-tertiary" />
        </div>

        {/* Organize button */}
        <button
          onClick={handleOrganize}
          className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-md text-13 font-medium transition-colors"
        >
          Organize
        </button>

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
