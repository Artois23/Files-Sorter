import { useState } from 'react';
import { X, FolderOpen, RefreshCw } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../utils/api';

export function SettingsModal() {
  const {
    showSettings,
    setShowSettings,
    settings,
    updateSettings,
    thumbnailSize,
    setThumbnailSize,
    setScanProgress,
  } = useAppStore();

  const [isClearing, setIsClearing] = useState(false);

  if (!showSettings) return null;

  const handleSelectSource = async () => {
    try {
      const result = await api.selectFolder();
      if (result?.path) {
        updateSettings({ sourceFolder: result.path });
        await api.updateSettings({ sourceFolder: result.path });
      }
    } catch (error) {
      console.error('Failed to select source folder:', error);
    }
  };

  const handleSelectVault = async () => {
    try {
      const result = await api.selectFolder();
      if (result?.path) {
        updateSettings({ vaultFolder: result.path });
        await api.updateSettings({ vaultFolder: result.path });

        // Sync vault folders with albums
        const syncedAlbums = await api.syncVault();
        useAppStore.getState().setAlbums(syncedAlbums);
      }
    } catch (error) {
      console.error('Failed to select vault folder:', error);
    }
  };

  const handleRescan = async () => {
    if (settings.sourceFolder) {
      setScanProgress({ isScanning: true });
      try {
        await api.startScan(settings.sourceFolder);
      } catch (error) {
        console.error('Failed to start scan:', error);
        setScanProgress({ isScanning: false });
      }
    }
  };

  const handleExportAssignments = async () => {
    try {
      const result = await api.exportAssignments();
      alert(`Assignments exported to: ${result.path}`);
    } catch (error) {
      console.error('Failed to export assignments:', error);
    }
  };

  const handleClearAllData = async () => {
    if (
      confirm(
        'Are you sure you want to clear all data? This will remove all image metadata, albums, and assignments. Your actual files will not be affected.'
      )
    ) {
      setIsClearing(true);
      try {
        await api.clearAllData();
        useAppStore.setState({
          images: [],
          albums: [],
          currentView: 'all',
          currentAlbumId: null,
          selectedImageIds: new Set(),
        });
        setShowSettings(false);
      } catch (error) {
        console.error('Failed to clear data:', error);
      } finally {
        setIsClearing(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={() => setShowSettings(false)} />

      <div className="relative bg-macos-dark-bg-2 rounded-xl shadow-2xl w-[500px] max-h-[80vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-macos-dark-border">
          <h2 className="text-15 font-semibold">Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-macos-dark-bg-3"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(80vh-60px)]">
          {/* General section */}
          <section>
            <h3 className="text-13 font-medium text-macos-dark-text-tertiary uppercase tracking-wide mb-4">
              General
            </h3>

            <div className="space-y-4">
              {/* Source folder */}
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <label className="text-13 font-medium">Source Folder</label>
                  <p className="text-11 text-macos-dark-text-tertiary truncate">
                    {settings.sourceFolder || 'Not selected'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {settings.sourceFolder && (
                    <button
                      onClick={handleRescan}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-macos-dark-bg-3 hover:bg-macos-dark-bg-1 text-13"
                    >
                      <RefreshCw size={14} />
                      Re-scan
                    </button>
                  )}
                  <button
                    onClick={handleSelectSource}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-macos-dark-bg-3 hover:bg-macos-dark-bg-1 text-13"
                  >
                    <FolderOpen size={14} />
                    Change
                  </button>
                </div>
              </div>

              {/* Vault folder */}
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <label className="text-13 font-medium">Vault Folder</label>
                  <p className="text-11 text-macos-dark-text-tertiary truncate">
                    {settings.vaultFolder || 'Not selected (required for Organize)'}
                  </p>
                </div>
                <button
                  onClick={handleSelectVault}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-macos-dark-bg-3 hover:bg-macos-dark-bg-1 text-13"
                >
                  <FolderOpen size={14} />
                  {settings.vaultFolder ? 'Change' : 'Choose'}
                </button>
              </div>
            </div>
          </section>

          {/* Organize behavior section */}
          <section>
            <h3 className="text-13 font-medium text-macos-dark-text-tertiary uppercase tracking-wide mb-4">
              Organize Behavior
            </h3>

            <div className="space-y-4">
              {/* Default action */}
              <div>
                <label className="text-13 font-medium mb-2 block">Default Action</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="organizeAction"
                      checked={settings.organizeAction === 'move'}
                      onChange={() => updateSettings({ organizeAction: 'move' })}
                      className="accent-accent"
                    />
                    <span className="text-13">Move files</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="organizeAction"
                      checked={settings.organizeAction === 'copy'}
                      onChange={() => updateSettings({ organizeAction: 'copy' })}
                      className="accent-accent"
                    />
                    <span className="text-13">Copy files</span>
                  </label>
                </div>
              </div>

              {/* Confirm destructive actions */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-13">Confirm before destructive actions</span>
                <div
                  className={`
                    relative w-10 h-6 rounded-full transition-colors cursor-pointer
                    ${settings.confirmDestructiveActions ? 'bg-accent' : 'bg-macos-dark-bg-1'}
                  `}
                  onClick={() =>
                    updateSettings({
                      confirmDestructiveActions: !settings.confirmDestructiveActions,
                    })
                  }
                >
                  <div
                    className={`
                      absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
                      ${settings.confirmDestructiveActions ? 'translate-x-5' : 'translate-x-1'}
                    `}
                  />
                </div>
              </label>

              {/* Trash info */}
              <div className="p-3 bg-macos-dark-bg-3 rounded-md">
                <p className="text-13 text-macos-dark-text-secondary">
                  Trashed files are moved to <code className="text-accent">Vault/_Trash</code>.
                  Use the empty trash button in the sidebar to permanently delete them.
                </p>
              </div>
            </div>
          </section>

          {/* Display section */}
          <section>
            <h3 className="text-13 font-medium text-macos-dark-text-tertiary uppercase tracking-wide mb-4">
              Display
            </h3>

            <div className="space-y-4">
              {/* Default thumbnail size */}
              <div>
                <label className="text-13 font-medium mb-2 block">
                  Default Thumbnail Size: {thumbnailSize}px
                </label>
                <input
                  type="range"
                  min={80}
                  max={400}
                  value={thumbnailSize}
                  onChange={(e) => setThumbnailSize(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>

              {/* Show filename overlay */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-13">Show filename overlay</span>
                <div
                  className={`
                    relative w-10 h-6 rounded-full transition-colors cursor-pointer
                    ${settings.showFilenameOverlay ? 'bg-accent' : 'bg-macos-dark-bg-1'}
                  `}
                  onClick={() =>
                    updateSettings({
                      showFilenameOverlay: !settings.showFilenameOverlay,
                    })
                  }
                >
                  <div
                    className={`
                      absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
                      ${settings.showFilenameOverlay ? 'translate-x-5' : 'translate-x-1'}
                    `}
                  />
                </div>
              </label>

              {/* Show status badges */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-13">Show status badges</span>
                <div
                  className={`
                    relative w-10 h-6 rounded-full transition-colors cursor-pointer
                    ${settings.showStatusBadges ? 'bg-accent' : 'bg-macos-dark-bg-1'}
                  `}
                  onClick={() =>
                    updateSettings({
                      showStatusBadges: !settings.showStatusBadges,
                    })
                  }
                >
                  <div
                    className={`
                      absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
                      ${settings.showStatusBadges ? 'translate-x-5' : 'translate-x-1'}
                    `}
                  />
                </div>
              </label>

              {/* Thumbnail refresh scope */}
              <div>
                <label className="text-13 font-medium mb-2 block">Thumbnail Refresh Scope</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="thumbnailRefreshScope"
                      checked={settings.thumbnailRefreshScope === 'all'}
                      onChange={() => updateSettings({ thumbnailRefreshScope: 'all' })}
                      className="accent-accent"
                    />
                    <span className="text-13">All images</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="thumbnailRefreshScope"
                      checked={settings.thumbnailRefreshScope === 'visible'}
                      onChange={() => updateSettings({ thumbnailRefreshScope: 'visible' })}
                      className="accent-accent"
                    />
                    <span className="text-13">Visible only</span>
                  </label>
                </div>
                <p className="text-11 text-macos-dark-text-tertiary mt-1">
                  Controls which images are regenerated when clicking the refresh button
                </p>
              </div>
            </div>
          </section>

          {/* Data section */}
          <section>
            <h3 className="text-13 font-medium text-macos-dark-text-tertiary uppercase tracking-wide mb-4">
              Data
            </h3>

            <div className="space-y-3">
              <button
                onClick={handleExportAssignments}
                className="w-full px-4 py-2 rounded-md bg-macos-dark-bg-3 hover:bg-macos-dark-bg-1 text-13 text-left"
              >
                Export assignments as JSON
              </button>

              <button
                onClick={handleClearAllData}
                disabled={isClearing}
                className="w-full px-4 py-2 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 text-13 text-left disabled:opacity-50"
              >
                {isClearing ? 'Clearing...' : 'Clear all data and start over'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
