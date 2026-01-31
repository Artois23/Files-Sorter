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
  width: number | null;
  height: number | null;
  modifiedDate: string;
  thumbnailPath: string | null;
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
  errors: { path: string; reason: string }[];
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
