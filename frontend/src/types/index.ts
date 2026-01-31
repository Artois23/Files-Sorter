export interface Vault {
  id: string;
  path: string;
  displayName: string;
  isVisible: boolean;
  order: number;
}

export interface ImageFile {
  id: string;
  path: string;
  filename: string;
  fileSize: number;
  width?: number;
  height?: number;
  modifiedDate: string;
  thumbnailUrl: string;
  isSupported: boolean;
  format: string;
  albumId: string | null;
  vaultId: string | null;
  status: 'normal' | 'trash' | 'not-sure';
  ocrText: string | null;
  ocrProcessed: boolean;
  ocrDate: string | null;
}

export interface Album {
  id: string;
  name: string;
  parentId: string | null;
  vaultId: string;
  order: number;
  imageCount: number;
}

export interface ScanProgress {
  isScanning: boolean;
  folderCount: number;
  imageCount: number;
  currentFolder: string;
}

export interface OrganizeProgress {
  isOrganizing: boolean;
  total: number;
  completed: number;
  currentFile: string;
  errors: OrganizeError[];
}

export interface OrganizeError {
  path: string;
  reason: string;
}

export interface OrganizeSummary {
  albumMoves: {
    albumName: string;
    targetPath: string;
    count: number;
  }[];
  trashCount: number;
  notSureCount: number;
  totalImages: number;
}

export interface Settings {
  sourceFolder: string | null;
  vaultFolder: string | null;
  defaultThumbnailSize: number;
  showFilenameOverlay: boolean;
  showStatusBadges: boolean;
  organizeAction: 'move' | 'copy';
  confirmDestructiveActions: boolean;
  trashHandling: 'system' | 'vault';
  hideAssigned: boolean;
  thumbnailRefreshScope: 'all' | 'visible';
}

export interface OcrProgress {
  isProcessing: boolean;
  total: number;
  completed: number;
  current: string;
}

export type ViewType = 'all' | 'orphans' | 'trash' | 'not-sure' | 'album' | 'vault';

export interface AppState {
  currentView: ViewType;
  currentAlbumId: string | null;
  currentVaultId: string | null;
  selectedImageIds: Set<string>;
  lastSelectedImageId: string | null;
  thumbnailSize: number;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
}
