# Image Sorter - Technology Stack & Dependencies

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                   React SPA (Port 5173)                      │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   React 18  │  │   Zustand   │  │  @tanstack/virtual  │  │
│  │   + Vite    │  │   (State)   │  │   (Virtualization)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  @dnd-kit   │  │ Tailwind 3  │  │    Lucide Icons     │  │
│  │ (Drag/Drop) │  │    (CSS)    │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │ REST API (Proxy)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
│               Node.js + Express (Port 3333)                  │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Express   │  │   SQLite    │  │       Sharp         │  │
│  │   (API)     │  │ (Database)  │  │   (Thumbnails)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Chokidar   │  │    UUID     │  │    AppleScript      │  │
│  │ (Watching)  │  │   (IDs)     │  │  (macOS Integration)│  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      File System                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Source    │  │    Vault    │  │   ~/.image-sorter   │  │
│  │   Folder    │  │   Folder    │  │   (Data + Cache)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.2.4 | UI framework |
| `react-dom` | ^19.2.4 | React DOM renderer |
| `zustand` | ^5.0.10 | Lightweight state management with persistence |
| `@dnd-kit/core` | ^6.3.1 | Drag and drop framework |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable list primitives |
| `@dnd-kit/utilities` | ^3.2.2 | DnD utility functions |
| `@tanstack/react-virtual` | ^3.13.18 | Virtualized list/grid rendering |
| `lucide-react` | ^0.563.0 | Icon library (Feather-style) |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.9.3 | Type safety |
| `vite` | ^7.3.1 | Build tool and dev server |
| `@vitejs/plugin-react` | ^5.1.2 | React plugin for Vite |
| `@types/react` | ^19.2.10 | React type definitions |
| `@types/react-dom` | ^19.2.3 | React DOM type definitions |
| `tailwindcss` | ^3.x | Utility-first CSS framework |
| `postcss` | ^8.5.6 | CSS transformations |
| `autoprefixer` | ^10.4.23 | CSS vendor prefixing |

---

## Backend Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^5.2.1 | HTTP server framework |
| `cors` | ^2.8.6 | Cross-origin resource sharing |
| `better-sqlite3` | ^12.6.2 | SQLite database driver (sync, fast) |
| `sharp` | ^0.34.5 | High-performance image processing |
| `chokidar` | ^5.0.0 | File system watcher |
| `uuid` | ^13.0.0 | UUID generation |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.9.3 | Type safety |
| `tsx` | ^4.21.0 | TypeScript execution for Node.js |
| `@types/express` | ^5.0.6 | Express type definitions |
| `@types/cors` | ^2.8.19 | CORS type definitions |
| `@types/better-sqlite3` | ^7.6.13 | SQLite type definitions |
| `@types/uuid` | ^10.0.0 | UUID type definitions |
| `@types/node` | ^25.1.0 | Node.js type definitions |

---

## Root Project Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `concurrently` | ^9.1.2 | Run multiple commands in parallel |

---

## Key Technology Choices

### Why React + Vite?
- **Fast HMR**: Instant updates during development
- **ES modules**: Native browser module loading
- **Optimized builds**: Rollup-based production builds
- **TypeScript first**: Built-in TS support

### Why Zustand over Redux?
- **Minimal boilerplate**: No actions, reducers, or providers
- **Built-in persistence**: Easy localStorage/sessionStorage sync
- **Small bundle**: ~1KB minified
- **React 18 ready**: Works with concurrent features

### Why @dnd-kit?
- **Accessible**: Keyboard and screen reader support
- **Flexible**: Works with any layout (grid, list, tree)
- **Performant**: Uses CSS transforms, no DOM manipulation
- **Modern**: Built for React hooks

### Why @tanstack/react-virtual?
- **Virtualization**: Only renders visible items
- **Handles thousands**: Smooth scrolling with 10k+ items
- **Flexible**: Works with grids, not just lists
- **Lightweight**: ~3KB minified

### Why Sharp for Thumbnails?
- **Fast**: libvips-based, 4-5x faster than ImageMagick
- **Memory efficient**: Streams images, low memory usage
- **Format support**: JPEG, PNG, WebP, AVIF, TIFF, GIF
- **Quality**: Good resizing algorithms

### Why SQLite?
- **Zero config**: No database server to run
- **Portable**: Single file, easy backup
- **Fast**: better-sqlite3 is synchronous and fast
- **Reliable**: ACID compliant, battle-tested

---

## Data Storage

### Database Location
```
~/.image-sorter/
├── data.db           # SQLite database
└── thumbnails/       # Generated thumbnail cache
    ├── {uuid}.jpg
    └── ...
```

### Database Schema

```sql
-- Images table
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  modified_date TEXT NOT NULL,
  thumbnail_path TEXT,
  is_supported INTEGER NOT NULL DEFAULT 1,
  format TEXT NOT NULL,
  album_id TEXT,
  status TEXT NOT NULL DEFAULT 'normal',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Albums table
CREATE TABLE albums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## Supported Image Formats

### Fully Supported (Thumbnails + Preview)
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- AVIF (.avif)
- BMP (.bmp)
- TIFF (.tiff, .tif)

### Detected but Unsupported (Shows file icon)
- RAW: CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2
- Design: PSD, AI, EPS, SVG
- Other: ICO, HEIC, HEIF

---

## API Endpoints

### Folders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/folders/select` | Opens native folder picker |

### Scanning
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scan/start` | Start scanning a folder |
| GET | `/api/scan/status` | Get scan progress |
| POST | `/api/scan/cancel` | Cancel ongoing scan |

### Images
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/images` | Get all images |
| GET | `/api/images/:id/full` | Get full-size image |
| PATCH | `/api/images/batch` | Update multiple images |

### Albums
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/albums` | Get all albums |
| POST | `/api/albums` | Create album |
| PATCH | `/api/albums/:id` | Update album |
| DELETE | `/api/albums/:id` | Delete album |
| POST | `/api/albums/reorder` | Reorder albums |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get settings |
| PATCH | `/api/settings` | Update settings |

### Organize
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/organize/summary` | Get organize preview |
| POST | `/api/organize/start` | Start organizing |
| GET | `/api/organize/status` | Get organize progress |
| POST | `/api/organize/cancel` | Cancel organizing |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/files/show-in-finder` | Reveal file in Finder |
| POST | `/api/files/open-preview` | Open in Preview.app |

### Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/export/assignments` | Export as JSON |
| POST | `/api/data/clear` | Clear all data |

---

## Running the Application

### Development
```bash
# Install all dependencies
npm run install:all

# Run both frontend and backend
npm run dev

# Or run separately:
cd backend && npm run dev   # Port 3333
cd frontend && npm run dev  # Port 5173
```

### Production Build
```bash
# Build both
npm run build

# Run backend
cd backend && npm start

# Serve frontend (use any static server)
cd frontend && npx serve dist
```

---

## Browser Support

- Chrome 90+
- Safari 14+
- Firefox 90+
- Edge 90+

Requires ES2020 features and CSS Grid support.

---

## macOS Integration

The app uses AppleScript for native macOS integration:
- **Folder picker**: Native file dialog
- **Show in Finder**: `open -R` command
- **Open in Preview**: `open -a Preview` command
- **Move to Trash**: Finder scripting via osascript
