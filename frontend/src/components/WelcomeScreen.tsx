import { useState } from 'react';
import { FolderOpen, Images, FolderPlus, Trash2, HardDrive } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { api } from '../utils/api';

interface WelcomeScreenProps {
  onSkip?: () => void;
}

export function WelcomeScreen({ onSkip }: WelcomeScreenProps) {
  const { vaults, addVault, removeVault, setAlbums, setImages } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingVaultId, setDeletingVaultId] = useState<string | null>(null);

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

  const handleRemoveVault = async (vaultId: string, vaultName: string) => {
    const confirmed = window.confirm(
      `Remove "${vaultName}" from Image Sorter?\n\nThis will only remove it from the app. Your files and folders on disk will NOT be deleted.`
    );

    if (!confirmed) return;

    setDeletingVaultId(vaultId);
    try {
      await api.removeVault(vaultId);
      removeVault(vaultId);

      // Refresh data after removal
      const [syncedAlbums, refreshedImages] = await Promise.all([
        api.getAlbums(),
        api.getImages(),
      ]);
      setAlbums(syncedAlbums);
      setImages(refreshedImages);
    } catch (error) {
      console.error('Failed to remove vault:', error);
      alert(error instanceof Error ? error.message : 'Failed to remove vault');
    } finally {
      setDeletingVaultId(null);
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
    <div className="flex-1 flex flex-col items-center justify-center bg-macos-dark-bg-1 p-8">
      <div className="text-center max-w-lg w-full">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center">
          <Images size={40} className="text-white" />
        </div>

        <h1 className="text-2xl font-semibold mb-2">Image Sorter</h1>
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

        {/* Continue button - shown when vaults exist */}
        {vaults.length > 0 && onSkip && (
          <div className="mt-6">
            <button
              onClick={onSkip}
              className="px-8 py-3 bg-macos-dark-bg-3 hover:bg-macos-dark-bg-2 text-white rounded-lg text-15 font-medium transition-colors"
            >
              Continue to App
            </button>
          </div>
        )}

        <p className="text-11 text-macos-dark-text-tertiary mt-6">
          Supported formats: JPG, PNG, GIF, WebP, AVIF, HEIC, RAW, and more
        </p>
      </div>

      {/* Current Vaults Section */}
      {vaults.length > 0 && (
        <div className="w-full max-w-2xl mt-12 border-t border-macos-dark-border pt-8">
          <h2 className="text-15 font-medium mb-4 text-center">Current Vaults</h2>
          <div className="space-y-2">
            {vaults.map((vault) => (
              <div
                key={vault.id}
                className="flex items-center gap-3 bg-macos-dark-bg-2 rounded-lg px-4 py-3 group"
              >
                <HardDrive size={20} className="text-accent flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-14 font-medium truncate">{vault.displayName}</p>
                  <p className="text-11 text-macos-dark-text-tertiary truncate">{vault.path}</p>
                </div>
                <button
                  onClick={() => handleRemoveVault(vault.id, vault.displayName)}
                  disabled={deletingVaultId === vault.id}
                  className="w-8 h-8 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 transition-all disabled:opacity-50"
                  title="Remove vault (files will not be deleted)"
                >
                  {deletingVaultId === vault.id ? (
                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            ))}
          </div>
          <p className="text-11 text-macos-dark-text-tertiary text-center mt-4">
            Removing a vault only removes it from the app. Your files remain safe on disk.
          </p>
        </div>
      )}
    </div>
  );
}
