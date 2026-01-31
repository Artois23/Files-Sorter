import { useEffect } from 'react';
import { Loader2, ScanText } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../utils/api';

export function OcrProgress() {
  const { ocrProgress, setOcrProgress, setImages } = useAppStore();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (ocrProgress.isProcessing) {
      interval = setInterval(async () => {
        try {
          const status = await api.getOCRStatus();
          setOcrProgress(status);

          if (!status.isProcessing) {
            clearInterval(interval);
            // Refresh images to get updated OCR data
            const images = await api.getImages();
            setImages(images);
          }
        } catch (error) {
          console.error('Failed to get OCR status:', error);
        }
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [ocrProgress.isProcessing, setOcrProgress, setImages]);

  if (!ocrProgress.isProcessing) return null;

  const handleCancel = async () => {
    try {
      await api.cancelOCR();
      setOcrProgress({ isProcessing: false });
      // Refresh images to get any OCR data that was processed before cancel
      const images = await api.getImages();
      setImages(images);
    } catch (error) {
      console.error('Failed to cancel OCR:', error);
    }
  };

  const progress = ocrProgress.total > 0
    ? Math.round((ocrProgress.completed / ocrProgress.total) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative bg-macos-dark-bg-2 rounded-xl shadow-2xl w-[400px] overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ScanText size={24} className="text-accent" />
              <Loader2 size={12} className="text-accent animate-spin absolute -bottom-1 -right-1" />
            </div>
            <h2 className="text-15 font-semibold">Processing OCR...</h2>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-13">
              <span>
                <span className="font-semibold text-accent">
                  {ocrProgress.completed}
                </span>{' '}
                of{' '}
                <span className="font-semibold">
                  {ocrProgress.total}
                </span>{' '}
                images
              </span>
              <span className="text-macos-dark-text-secondary">{progress}%</span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-macos-dark-bg-1 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-11 text-macos-dark-text-tertiary truncate">
              {ocrProgress.current ? ocrProgress.current.split('/').pop() : 'Starting...'}
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
