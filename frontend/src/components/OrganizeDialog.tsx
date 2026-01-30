import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../utils/api';

export function OrganizeDialog() {
  const {
    showOrganizeDialog,
    setShowOrganizeDialog,
    organizeSummary,
    setOrganizeSummary,
    organizeProgress,
    setOrganizeProgress,
    settings,
    setImages,
    setAlbums,
    albums,
  } = useAppStore();

  const [deleteOriginals, setDeleteOriginals] = useState(true);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!showOrganizeDialog) {
      setShowReport(false);
    }
  }, [showOrganizeDialog]);

  // Poll for organize progress
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (organizeProgress.isOrganizing) {
      interval = setInterval(async () => {
        try {
          const status = await api.getOrganizeStatus();
          setOrganizeProgress(status);

          if (!status.isOrganizing) {
            clearInterval(interval);
            setShowReport(true);

            // Refresh images and albums after organize
            const [images, newAlbums] = await Promise.all([
              api.getImages(),
              api.getAlbums(),
            ]);
            setImages(images);
            setAlbums(newAlbums);
          }
        } catch (error) {
          console.error('Failed to get organize status:', error);
        }
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [organizeProgress.isOrganizing, setOrganizeProgress, setImages, setAlbums]);

  if (!showOrganizeDialog) return null;

  const handleStartOrganize = async () => {
    try {
      setOrganizeProgress({
        isOrganizing: true,
        total: organizeSummary?.totalImages || 0,
        completed: 0,
        currentFile: '',
        errors: [],
      });
      await api.startOrganize(deleteOriginals);
    } catch (error) {
      console.error('Failed to start organize:', error);
      setOrganizeProgress({ isOrganizing: false });
    }
  };

  const handleCancelOrganize = async () => {
    try {
      await api.cancelOrganize();
    } catch (error) {
      console.error('Failed to cancel organize:', error);
    }
  };

  const handleClose = () => {
    if (!organizeProgress.isOrganizing) {
      setShowOrganizeDialog(false);
      setOrganizeSummary(null);
    }
  };

  const progressPercent = organizeProgress.total > 0
    ? Math.round((organizeProgress.completed / organizeProgress.total) * 100)
    : 0;

  // Show completion report
  if (showReport && !organizeProgress.isOrganizing) {
    const successCount = organizeProgress.completed - organizeProgress.errors.length;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
        <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

        <div className="relative bg-macos-dark-bg-2 rounded-xl shadow-2xl w-[500px] max-h-[80vh] overflow-hidden animate-scale-in">
          <div className="flex items-center justify-between px-6 py-4 border-b border-macos-dark-border">
            <h2 className="text-15 font-semibold flex items-center gap-2">
              <CheckCircle size={18} className="text-green-400" />
              Organization Complete
            </h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-macos-dark-bg-3"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-15">
              Organized {successCount.toLocaleString()} images into {albums.length} folders.
            </p>

            {organizeProgress.errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h3 className="text-13 font-medium text-red-400 flex items-center gap-2 mb-2">
                  <XCircle size={16} />
                  {organizeProgress.errors.length} errors occurred
                </h3>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {organizeProgress.errors.map((error, i) => (
                    <p key={i} className="text-11 text-macos-dark-text-tertiary truncate">
                      {error.path}: {error.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-md text-13 font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show progress
  if (organizeProgress.isOrganizing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" />

        <div className="relative bg-macos-dark-bg-2 rounded-xl shadow-2xl w-[400px] overflow-hidden">
          <div className="p-6 space-y-4">
            <h2 className="text-15 font-semibold">Organizing...</h2>

            <div className="space-y-2">
              <div className="flex justify-between text-13">
                <span>
                  {organizeProgress.completed.toLocaleString()} / {organizeProgress.total.toLocaleString()}
                </span>
                <span>{progressPercent}%</span>
              </div>

              <div className="h-2 bg-macos-dark-bg-1 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-11 text-macos-dark-text-tertiary truncate">
                {organizeProgress.currentFile}
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleCancelOrganize}
                className="px-4 py-2 bg-macos-dark-bg-3 hover:bg-macos-dark-bg-1 rounded-md text-13"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show pre-flight confirmation
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-macos-dark-bg-2 rounded-xl shadow-2xl w-[500px] max-h-[80vh] overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-macos-dark-border">
          <h2 className="text-15 font-semibold">Ready to Organize</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-macos-dark-bg-3"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(80vh-180px)]">
          <p className="text-15">
            Ready to organize{' '}
            <span className="font-semibold">
              {organizeSummary?.totalImages.toLocaleString()}
            </span>{' '}
            images into{' '}
            <span className="font-semibold">
              {organizeSummary?.albumMoves.length}
            </span>{' '}
            folders.
          </p>

          {/* Album breakdown */}
          <div className="space-y-2">
            {organizeSummary?.albumMoves.map((move, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 bg-macos-dark-bg-3 rounded-md text-13"
              >
                <span className="truncate flex-1">{move.albumName}</span>
                <span className="text-macos-dark-text-tertiary ml-2">
                  {move.count} images
                </span>
              </div>
            ))}

            {(organizeSummary?.trashCount || 0) > 0 && (
              <div className="flex items-center justify-between py-2 px-3 bg-red-500/10 rounded-md text-13">
                <span>Trash → {settings.trashHandling === 'system' ? 'System Trash' : 'Vault/_Trash'}</span>
                <span className="text-red-400">
                  {organizeSummary?.trashCount} images
                </span>
              </div>
            )}

            {(organizeSummary?.notSureCount || 0) > 0 && (
              <div className="flex items-center justify-between py-2 px-3 bg-yellow-500/10 rounded-md text-13">
                <span>Not Sure → Vault/_Sort Later</span>
                <span className="text-yellow-400">
                  {organizeSummary?.notSureCount} images
                </span>
              </div>
            )}
          </div>

          {/* Warning if vault doesn't exist */}
          <div className="flex items-start gap-2 p-3 bg-macos-dark-bg-3 rounded-md">
            <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-11 text-macos-dark-text-secondary">
              Vault folder: {settings.vaultFolder}
              <br />
              Folders will be created automatically if they don't exist.
            </p>
          </div>

          {/* Move vs Copy toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteOriginals}
              onChange={(e) => setDeleteOriginals(e.target.checked)}
              className="accent-accent w-4 h-4"
            />
            <span className="text-13">
              {deleteOriginals
                ? 'Move files to vault (remove from source)'
                : 'Copy files to vault (keep originals)'}
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-macos-dark-border">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-macos-dark-bg-3 hover:bg-macos-dark-bg-1 rounded-md text-13"
          >
            Cancel
          </button>
          <button
            onClick={handleStartOrganize}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-md text-13 font-medium"
          >
            Organize
          </button>
        </div>
      </div>
    </div>
  );
}
