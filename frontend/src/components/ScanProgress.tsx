import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../utils/api';

export function ScanProgress() {
  const { scanProgress, setScanProgress, setImages, updateSettings } = useAppStore();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (scanProgress.isScanning) {
      interval = setInterval(async () => {
        try {
          const status = await api.getScanStatus();
          setScanProgress(status);

          if (!status.isScanning) {
            clearInterval(interval);
            // Fetch the scanned images
            const images = await api.getImages();
            setImages(images);
            // Get updated settings (source folder)
            const settings = await api.getSettings();
            updateSettings(settings);
          }
        } catch (error) {
          console.error('Failed to get scan status:', error);
        }
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scanProgress.isScanning, setScanProgress, setImages, updateSettings]);

  if (!scanProgress.isScanning) return null;

  const handleCancel = async () => {
    try {
      await api.cancelScan();
      setScanProgress({ isScanning: false });
    } catch (error) {
      console.error('Failed to cancel scan:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative bg-macos-dark-bg-2 rounded-xl shadow-2xl w-[400px] overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 size={24} className="text-accent animate-spin" />
            <h2 className="text-15 font-semibold">Scanning...</h2>
          </div>

          <div className="space-y-2">
            <p className="text-13">
              Found{' '}
              <span className="font-semibold text-accent">
                {scanProgress.imageCount.toLocaleString()}
              </span>{' '}
              images in{' '}
              <span className="font-semibold">
                {scanProgress.folderCount.toLocaleString()}
              </span>{' '}
              folders
            </p>

            <p className="text-11 text-macos-dark-text-tertiary truncate">
              {scanProgress.currentFolder}
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleCancel}
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
