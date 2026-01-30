import { FolderOpen, Images } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../utils/api';

export function WelcomeScreen() {
  const { setScanProgress } = useAppStore();

  const handleChooseFolder = async () => {
    try {
      const result = await api.selectFolder();
      if (result?.path) {
        setScanProgress({ isScanning: true });
        await api.startScan(result.path);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
      setScanProgress({ isScanning: false });
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-macos-dark-bg-1">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center">
          <Images size={40} className="text-white" />
        </div>

        <h1 className="text-2xl font-semibold mb-2">Welcome to Image Sorter</h1>
        <p className="text-macos-dark-text-tertiary mb-8">
          Choose a source folder to scan your images and start organizing them into albums.
        </p>

        <button
          onClick={handleChooseFolder}
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg text-15 font-medium transition-colors"
        >
          <FolderOpen size={20} />
          Choose Folder
        </button>

        <p className="text-11 text-macos-dark-text-tertiary mt-8">
          Supported formats: JPG, JPEG, PNG, GIF, WebP, AVIF, BMP, TIFF
        </p>
      </div>
    </div>
  );
}
