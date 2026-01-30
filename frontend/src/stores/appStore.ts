import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ImageFile,
  Album,
  Settings,
  ScanProgress,
  OrganizeProgress,
  ViewType,
  OrganizeSummary,
  Vault
} from '../types';

interface AppStore {
  // Vaults
  vaults: Vault[];
  setVaults: (vaults: Vault[]) => void;
  addVault: (vault: Vault) => void;
  updateVault: (id: string, updates: Partial<Vault>) => void;
  removeVault: (id: string) => void;

  // Images
  images: ImageFile[];
  setImages: (images: ImageFile[]) => void;
  addImages: (images: ImageFile[]) => void;
  updateImage: (id: string, updates: Partial<ImageFile>) => void;
  updateImages: (ids: string[], updates: Partial<ImageFile>) => void;
  removeImages: (ids: string[]) => void;

  // Albums
  albums: Album[];
  setAlbums: (albums: Album[]) => void;
  addAlbum: (album: Album) => void;
  updateAlbum: (id: string, updates: Partial<Album>) => void;
  deleteAlbum: (id: string) => void;
  reorderAlbums: (albums: Album[]) => void;

  // View state
  currentView: ViewType;
  currentAlbumId: string | null;
  currentVaultId: string | null;
  setView: (view: ViewType, albumId?: string | null, vaultId?: string | null) => void;

  // Selection
  selectedImageIds: Set<string>;
  lastSelectedImageId: string | null;
  selectImage: (id: string, multi?: boolean, range?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setSelection: (ids: string[]) => void;

  // UI state
  thumbnailSize: number;
  setThumbnailSize: (size: number) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  hideAssigned: boolean;
  setHideAssigned: (hide: boolean) => void;
  selectMode: boolean;
  setSelectMode: (mode: boolean) => void;
  sortBy: 'date' | 'name';
  sortDirection: 'asc' | 'desc';
  setSortBy: (sortBy: 'date' | 'name') => void;
  setSortDirection: (direction: 'asc' | 'desc') => void;

  // Settings
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;

  // Scan progress
  scanProgress: ScanProgress;
  setScanProgress: (progress: Partial<ScanProgress>) => void;

  // Organize progress
  organizeProgress: OrganizeProgress;
  setOrganizeProgress: (progress: Partial<OrganizeProgress>) => void;

  // Modals
  quickLookImageId: string | null;
  setQuickLookImageId: (id: string | null) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showOrganizeDialog: boolean;
  setShowOrganizeDialog: (show: boolean) => void;
  organizeSummary: OrganizeSummary | null;
  setOrganizeSummary: (summary: OrganizeSummary | null) => void;

  // Context menu
  contextMenu: { x: number; y: number; imageIds: string[] } | null;
  setContextMenu: (menu: { x: number; y: number; imageIds: string[] } | null) => void;

  // Inline editing
  editingImageId: string | null;
  setEditingImageId: (id: string | null) => void;

  // Computed
  getVisibleImages: () => ImageFile[];
  getImageById: (id: string) => ImageFile | undefined;
  getAlbumById: (id: string) => Album | undefined;
  getVaultById: (id: string) => Vault | undefined;
  getChildAlbums: (parentId: string | null) => Album[];
  getAlbumsByVault: (vaultId: string) => Album[];
  getVisibleVaults: () => Vault[];
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Vaults
      vaults: [],
      setVaults: (vaults) => set({ vaults }),
      addVault: (vault) => set((state) => ({
        vaults: [...state.vaults, vault]
      })),
      updateVault: (id, updates) => set((state) => ({
        vaults: state.vaults.map((v) =>
          v.id === id ? { ...v, ...updates } : v
        ),
      })),
      removeVault: (id) => set((state) => ({
        vaults: state.vaults.filter((v) => v.id !== id),
        albums: state.albums.filter((a) => a.vaultId !== id),
        images: state.images.filter((img) => img.vaultId !== id),
      })),

      // Images
      images: [],
      setImages: (images) => set({ images }),
      addImages: (newImages) => set((state) => ({
        images: [...state.images, ...newImages]
      })),
      updateImage: (id, updates) => set((state) => ({
        images: state.images.map((img) =>
          img.id === id ? { ...img, ...updates } : img
        ),
      })),
      updateImages: (ids, updates) => set((state) => ({
        images: state.images.map((img) =>
          ids.includes(img.id) ? { ...img, ...updates } : img
        ),
      })),
      removeImages: (ids) => set((state) => ({
        images: state.images.filter((img) => !ids.includes(img.id)),
        selectedImageIds: new Set(
          [...state.selectedImageIds].filter((id) => !ids.includes(id))
        ),
      })),

      // Albums
      albums: [],
      setAlbums: (albums) => set({ albums }),
      addAlbum: (album) => set((state) => ({
        albums: [...state.albums, album]
      })),
      updateAlbum: (id, updates) => set((state) => ({
        albums: state.albums.map((album) =>
          album.id === id ? { ...album, ...updates } : album
        ),
      })),
      deleteAlbum: (id) => set((state) => {
        // Get all descendant album IDs
        const getDescendantIds = (parentId: string): string[] => {
          const children = state.albums.filter((a) => a.parentId === parentId);
          return children.flatMap((c) => [c.id, ...getDescendantIds(c.id)]);
        };
        const idsToDelete = [id, ...getDescendantIds(id)];

        return {
          albums: state.albums.filter((a) => !idsToDelete.includes(a.id)),
          images: state.images.map((img) =>
            idsToDelete.includes(img.albumId || '')
              ? { ...img, albumId: null }
              : img
          ),
        };
      }),
      reorderAlbums: (albums) => set({ albums }),

      // View state
      currentView: 'all',
      currentAlbumId: null,
      currentVaultId: null,
      setView: (view, albumId = null, vaultId = null) => set({
        currentView: view,
        currentAlbumId: albumId,
        currentVaultId: vaultId,
        selectedImageIds: new Set(),
        lastSelectedImageId: null,
      }),

      // Selection
      selectedImageIds: new Set(),
      lastSelectedImageId: null,
      selectImage: (id, multi = false, range = false) => {
        const state = get();
        const visibleImages = state.getVisibleImages();

        if (range && state.lastSelectedImageId) {
          const lastIndex = visibleImages.findIndex(
            (img) => img.id === state.lastSelectedImageId
          );
          const currentIndex = visibleImages.findIndex((img) => img.id === id);

          if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);
            const rangeIds = visibleImages
              .slice(start, end + 1)
              .map((img) => img.id);

            set({
              selectedImageIds: new Set([...state.selectedImageIds, ...rangeIds]),
            });
            return;
          }
        }

        if (multi) {
          const newSelection = new Set(state.selectedImageIds);
          if (newSelection.has(id)) {
            newSelection.delete(id);
          } else {
            newSelection.add(id);
          }
          set({ selectedImageIds: newSelection, lastSelectedImageId: id });
        } else {
          set({ selectedImageIds: new Set([id]), lastSelectedImageId: id });
        }
      },
      selectAll: () => {
        const visibleImages = get().getVisibleImages();
        set({
          selectedImageIds: new Set(visibleImages.map((img) => img.id))
        });
      },
      clearSelection: () => set({
        selectedImageIds: new Set(),
        lastSelectedImageId: null
      }),
      setSelection: (ids) => set({ selectedImageIds: new Set(ids) }),

      // UI state
      thumbnailSize: 150,
      setThumbnailSize: (size) => set({ thumbnailSize: size }),
      sidebarWidth: 220,
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({
        sidebarCollapsed: !state.sidebarCollapsed
      })),
      hideAssigned: false,
      setHideAssigned: (hide) => set({ hideAssigned: hide }),
      selectMode: false,
      setSelectMode: (mode) => set({ selectMode: mode }),
      sortBy: 'date',
      sortDirection: 'desc',
      setSortBy: (sortBy) => set({ sortBy }),
      setSortDirection: (direction) => set({ sortDirection: direction }),

      // Settings
      settings: {
        sourceFolder: null,
        vaultFolder: null,
        defaultThumbnailSize: 150,
        showFilenameOverlay: false,
        showStatusBadges: true,
        organizeAction: 'move',
        confirmDestructiveActions: true,
        trashHandling: 'system',
        hideAssigned: false,
        thumbnailRefreshScope: 'all',
      },
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates },
      })),

      // Scan progress
      scanProgress: {
        isScanning: false,
        folderCount: 0,
        imageCount: 0,
        currentFolder: '',
      },
      setScanProgress: (progress) => set((state) => ({
        scanProgress: { ...state.scanProgress, ...progress },
      })),

      // Organize progress
      organizeProgress: {
        isOrganizing: false,
        total: 0,
        completed: 0,
        currentFile: '',
        errors: [],
      },
      setOrganizeProgress: (progress) => set((state) => ({
        organizeProgress: { ...state.organizeProgress, ...progress },
      })),

      // Modals
      quickLookImageId: null,
      setQuickLookImageId: (id) => set({ quickLookImageId: id }),
      showSettings: false,
      setShowSettings: (show) => set({ showSettings: show }),
      showOrganizeDialog: false,
      setShowOrganizeDialog: (show) => set({ showOrganizeDialog: show }),
      organizeSummary: null,
      setOrganizeSummary: (summary) => set({ organizeSummary: summary }),

      // Context menu
      contextMenu: null,
      setContextMenu: (menu) => set({ contextMenu: menu }),

      // Inline editing
      editingImageId: null,
      setEditingImageId: (id) => set({ editingImageId: id }),

      // Computed
      getVisibleImages: () => {
        const { images, vaults, currentView, currentAlbumId, currentVaultId, hideAssigned, sortBy, sortDirection } = get();

        // Get visible vault IDs
        const visibleVaultIds = new Set(
          vaults.filter((v) => v.isVisible).map((v) => v.id)
        );

        // Filter by visible vaults first (unless viewing trash/not-sure which could be from any vault)
        const vaultFiltered = currentView === 'trash' || currentView === 'not-sure'
          ? images
          : vaults.length > 0
            ? images.filter((img) => !img.vaultId || visibleVaultIds.has(img.vaultId))
            : images;

        let filtered: ImageFile[];
        switch (currentView) {
          case 'all':
            if (hideAssigned) {
              filtered = vaultFiltered.filter(
                (img) => !img.albumId && img.status === 'normal'
              );
            } else {
              filtered = vaultFiltered.filter((img) => img.status === 'normal');
            }
            break;
          case 'orphans':
            filtered = vaultFiltered.filter(
              (img) => !img.albumId && img.status === 'normal'
            );
            break;
          case 'trash':
            filtered = vaultFiltered.filter((img) => img.status === 'trash');
            break;
          case 'not-sure':
            filtered = vaultFiltered.filter((img) => img.status === 'not-sure');
            break;
          case 'album':
            filtered = vaultFiltered.filter(
              (img) => img.albumId === currentAlbumId && img.status === 'normal'
            );
            break;
          case 'vault':
            if (hideAssigned) {
              filtered = images.filter(
                (img) => img.vaultId === currentVaultId && !img.albumId && img.status === 'normal'
              );
            } else {
              filtered = images.filter(
                (img) => img.vaultId === currentVaultId && img.status === 'normal'
              );
            }
            break;
          default:
            filtered = vaultFiltered;
        }

        // Sort filtered images
        const sorted = [...filtered].sort((a, b) => {
          let comparison: number;
          if (sortBy === 'date') {
            comparison = a.modifiedDate.localeCompare(b.modifiedDate);
          } else {
            comparison = a.filename.localeCompare(b.filename);
          }
          return sortDirection === 'asc' ? comparison : -comparison;
        });

        return sorted;
      },
      getImageById: (id) => get().images.find((img) => img.id === id),
      getAlbumById: (id) => get().albums.find((album) => album.id === id),
      getVaultById: (id) => get().vaults.find((vault) => vault.id === id),
      getChildAlbums: (parentId) =>
        get().albums
          .filter((album) => album.parentId === parentId)
          .sort((a, b) => a.order - b.order),
      getAlbumsByVault: (vaultId) =>
        get().albums
          .filter((album) => album.vaultId === vaultId)
          .sort((a, b) => a.order - b.order),
      getVisibleVaults: () =>
        get().vaults
          .filter((vault) => vault.isVisible)
          .sort((a, b) => a.order - b.order),
    }),
    {
      name: 'image-sorter-storage',
      partialize: (state) => ({
        settings: state.settings,
        thumbnailSize: state.thumbnailSize,
        sidebarWidth: state.sidebarWidth,
        hideAssigned: state.hideAssigned,
        sortBy: state.sortBy,
        sortDirection: state.sortDirection,
      }),
    }
  )
);
