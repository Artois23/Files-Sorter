import { useState } from 'react';
import { FolderOpen, Images, FolderPlus } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../utils/api';

interface WelcomeScreenProps {
  onSkip?: () => void;
}

export function WelcomeScreen({ onSkip }: WelcomeScreenProps) {
  const { vaults, addVault, setAlbums, setImages } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddVault = async (path?: string) => {
    setIsAdding(true);
    try {
      let folderPath = path;

      if (!folderPath) {
        const result = await api.selectFolder();
        if (!result?.path) {
          setIsAdding(false);
          return;
        }
        folderPath = result.path;
      }

      const newVault = await api.addVault(folderPath);
      addVault(newVault);

      // Refresh albums and images after adding vault
      const [syncedAlbums, refreshedImages] = await Promise.all([
        api.getAlbums(),
        api.getImages(),
      ]);
      setAlbums(syncedAlbums);
      setImages(refreshedImages);
    } catch (error) {
      console.error('Failed to add vault:', error);
      alert(error instanceof Error ? error.message : 'Failed to add vault');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // Note: Due to browser security, we can't get folder paths from drag-drop
    // So we'll show the folder picker instead
    handleAddVault();
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-macos-dark-bg-1">
      <div className="text-center max-w-lg">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center">
          <Images size={40} className="text-white" />
        </div>

        <h1 className="text-2xl font-semibold mb-2">Welcome to Image Sorter</h1>
        <p className="text-macos-dark-text-tertiary mb-8">
          Add vault folders to organize your images into albums. Each vault is a folder that contains your organized photos.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => handleAddVault()}
          className={`
            relative border-2 border-dashed rounded-xl p-8 mb-6 cursor-pointer transition-all
            ${isDragging
              ? 'border-accent bg-accent/10 scale-105'
              : 'border-macos-dark-border hover:border-accent/50 hover:bg-macos-dark-bg-2'
            }
            ${isAdding ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <FolderPlus
            size={48}
            className={`mx-auto mb-4 ${isDragging ? 'text-accent' : 'text-macos-dark-text-tertiary'}`}
          />
          <p className="text-15 font-medium mb-1">
            {isAdding ? 'Adding vault...' : 'Click to add a vault folder'}
          </p>
          <p className="text-13 text-macos-dark-text-tertiary">
            Or drag folders here
          </p>
        </div>

        {/* Alternative button */}
        <button
          onClick={() => handleAddVault()}
          disabled={isAdding}
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-15 font-medium transition-colors"
        >
          <FolderOpen size={20} />
          {isAdding ? 'Adding...' : 'Browse for Folder'}
        </button>

        {/* Go to vaults button - shown when vaults exist */}
        {vaults.length > 0 && onSkip && (
          <div className="mt-6">
            <button
              onClick={onSkip}
              className="text-accent hover:text-accent-hover text-15 transition-colors"
            >
              Go to Current Vaults ({vaults.length})
            </button>
          </div>
        )}

        <p className="text-11 text-macos-dark-text-tertiary mt-8">
          Supported formats: JPG, PNG, GIF, WebP, AVIF, HEIC, RAW, and more
        </p>
      </div>
    </div>
  );
}
