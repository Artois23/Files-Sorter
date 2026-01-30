# Image Sorter - Product Specification (V1)

A local-first web app for visually sorting thousands of images on macOS. React frontend with macOS-inspired UI, Node.js backend on localhost.

---

## 1. Feature Specification

### 1.1 Source Folder Import

- User clicks "Choose Source Folder" button in toolbar (first run) or via Settings
- Backend recursively scans the selected folder for image files
- **Supported formats (V1)**: JPG, JPEG, PNG, GIF, WebP, AVIF, BMP, TIFF
- **Unsupported files**: Display in grid with generic file icon + format badge (e.g., "CR2", "PSD") so user knows what to implement later
- During scan: progress indicator shows folder count and image count
- After scan: all images appear in "All Images" view as thumbnails
- Metadata stored: file path, filename, file size, dimensions (if readable), modified date
- **Re-scan**: User can trigger manual re-scan to pick up new files added to source

### 1.2 Albums/Folders Management

**Sidebar structure (top to bottom):**
1. **Library section**
   - All Images (count badge)
   - Orphans (unassigned images)
   - Trash / To Delete
   - Not Sure / Sort Later

2. **Albums section** (user-created)
   - Flat list or nested tree of albums
   - Each album shows image count badge
   - Drag to reorder albums
   - Supports nesting (albums can contain sub-albums)

**Album operations:**
- **Create**: Click "+" button at bottom of sidebar, or right-click → "New Album"
- **Create nested**: Right-click album → "New Sub-Album"
- **Rename**: Double-click album name, or right-click → "Rename"
- **Delete**: Right-click → "Delete Album"
  - Confirmation dialog: "Delete album 'X'? Images will become orphans again."
  - Images return to Orphans, not deleted from disk
- **Reorder**: Drag albums up/down in sidebar

### 1.3 Visual Assignment of Images

**Core rule**: Each image can belong to **at most one** album (exclusive assignment). This is a file-sorting app, not a tagging system.

**Drag and drop:**
- Select one or more thumbnails in the grid
- Drag onto an album in the sidebar
- Visual feedback: album row highlights on hover, drag ghost shows thumbnail stack with count badge
- On drop: images assigned to that album, removed from any previous album
- If image was in another album: it moves (no confirmation needed for re-assignment)

**Right-click context menu** (on single or multi-selection):
- "Move to Album →" (submenu listing all albums)
- "Mark as Not Sure / Sort Later"
- "Mark as Trash / Delete"
- "Remove from Album" (visible only when viewing inside an album; moves to Orphans)
- Separator
- "Show in Finder" (opens containing folder)

**Special buckets behavior:**
- "Trash" and "Not Sure" are treated like albums for assignment purposes
- An image in Trash cannot also be in an album
- Moving to Trash from an album removes it from that album

### 1.4 Thumbnail Grid & Navigation

**Grid layout:**
- Responsive CSS grid that fills available space
- Thumbnails maintain aspect ratio (like Zenspire reference)
- Gap between thumbnails: 8px
- Smooth reflow on window resize

**Thumbnail size slider:**
- Located in top toolbar, right side
- Small grid icon on left, large grid icon on right
- Slider adjusts thumbnail width from ~80px to ~400px
- **Live update**: grid resizes smoothly as slider moves (CSS variable or state)
- Default size stored in preferences

**Selection:**
- **Click**: Select single image, deselect others
- **Cmd+Click**: Toggle selection (add/remove from multi-select)
- **Shift+Click**: Range select from last clicked to current
- **Cmd+A**: Select all visible images
- **Escape**: Deselect all
- **Click empty space**: Deselect all

**Selection visual states:**
- Unselected: No border
- Hover: Subtle light border or brightness lift
- Selected: Blue border (2-3px), slight scale-up or shadow

**Badges on thumbnails:**
- Small icon in corner indicating status:
  - Folder icon: assigned to an album
  - Clock icon: "Not Sure / Sort Later"
  - Trash icon: marked for deletion
  - Star icon: (future) Favorites
- Optional filename overlay at bottom (toggle in Settings)

**Keyboard navigation:**
- Arrow keys move selection through grid
- Home/End: first/last image
- Page Up/Down: jump by visible rows
- Enter: Open QuickLook preview
- Space: Toggle QuickLook preview (macOS convention)
- Delete/Backspace: Mark selected as Trash (with preference for confirmation)

**QuickLook preview modal:**
- Triggered by Space bar or double-click
- Centered modal with dark semi-transparent backdrop
- Large image preview (fit to viewport with padding)
- Top bar: filename, close button (X), left/right arrows, "Open with Preview" button
- Bottom strip: horizontal thumbnail filmstrip of current view for navigation
- Arrow keys or clicking filmstrip navigates between images
- Escape or clicking backdrop closes modal

### 1.5 Filter / Visibility Controls

**Global "Hide Assigned" toggle:**
- Toggle switch in top toolbar
- When ON: Images that belong to any album are hidden from "All Images" view
- Visual indicator: "(Showing orphans only)" or badge showing hidden count
- Does NOT affect album-specific views (viewing an album always shows its images)

**Sidebar views behavior:**
- **All Images**: Shows everything (or orphans-only if toggle is on)
- **Orphans**: Always shows only unassigned images (same as All Images + toggle ON)
- **Trash**: Shows only images marked for deletion
- **Not Sure**: Shows only images marked for later
- **[Album name]**: Shows only images assigned to that album

**Status bar counts** (bottom of window):
- "1,234 images" (total in current view)
- "5 selected"
- When in All Images with toggle: "324 hidden (assigned)"

### 1.6 Organize Operation

**Prerequisites:**
- User must set a **Vault folder** in Settings (destination for organized files)
- At least one image must be assigned to an album

**Organize button:**
- Located in top toolbar, prominent styling
- Disabled state if no assignments exist
- Clicking opens **Pre-flight confirmation dialog**

**Pre-flight dialog:**
- Summary: "Ready to organize 847 images into 12 folders"
- Breakdown list:
  - "Nature Photos → /Vault/Nature Photos (142 images)"
  - "Work Projects → /Vault/Work Projects (89 images)"
  - ... (scrollable if many)
- "Trash → will be moved to system Trash (23 images)"
- "Not Sure → /Vault/_Sort Later (45 images)"
- Warning if vault folder doesn't exist: "Vault folder will be created"
- Checkbox: "Delete original files after move" (default: ON for move behavior)
- Buttons: "Cancel" | "Organize"

**During organize:**
- Modal progress dialog (cannot be dismissed)
- Progress bar with percentage
- Current file being processed
- "Cancel" button (stops further moves, keeps already-moved files)

**Folder structure in Vault:**
- Each album becomes a folder: `/Vault/AlbumName/`
- Nested albums become nested folders: `/Vault/Parent/Child/`
- "Not Sure" becomes: `/Vault/_Sort Later/`
- "Trash" items moved to macOS Trash (not a vault subfolder)

**Filename collision handling:**
- If `photo.jpg` exists in target, rename to `photo (1).jpg`, `photo (2).jpg`, etc.
- Log collisions in final report

**Completion:**
- Success dialog: "Organized 847 images into 12 folders. 2 files renamed due to collisions."
- "View Report" button showing full log
- App state resets: albums become empty, images removed from index
- Option: "Scan vault as new source?" to continue organizing the organized files

**Error handling:**
- Permission errors: Skip file, log error, continue
- Missing source file: Log as "File not found", continue
- Disk full: Stop immediately, show error, report what succeeded
- Final report shows: succeeded, skipped (with reasons), failed

### 1.7 Settings & Preferences

**Settings panel** (modal or dedicated view):

**General:**
- Source folder path (with "Change" button)
- Vault folder path (with "Change" button, required before Organize)
- "Re-scan source folder" button

**Organize behavior:**
- Default action: Move / Copy (radio buttons, default: Move)
- Confirm before destructive actions (checkbox, default: ON)
- Trash handling: Move to system Trash / Move to Vault/_Trash folder

**Display:**
- Default thumbnail size (slider matching main toolbar)
- Show filename overlay (checkbox, default: OFF)
- Show status badges (checkbox, default: ON)

**Data:**
- All metadata stored in IndexedDB (browser) or local JSON file (backend)
- "Export assignments as JSON" button
- "Clear all data and start over" button (with confirmation)

---

## 2. UX Flows

### 2.1 First Run

1. App opens to empty state with centered welcome message:
   - "Welcome to Image Sorter"
   - "Choose a source folder to scan your images"
   - Large "Choose Folder" button

2. User clicks "Choose Folder" → native folder picker (via backend)

3. Scanning begins:
   - Modal: "Scanning..." with spinner
   - Live count: "Found 1,247 images in 34 folders..."
   - "Cancel" button available

4. Scan completes → modal closes, grid populates with thumbnails

5. Prompt appears (toast or subtle banner):
   - "Set your Vault folder in Settings before organizing"
   - Link to Settings

6. User opens Settings → sets Vault folder → closes Settings

7. User is now ready to create albums and start sorting

### 2.2 Browsing & Selection

1. **Switching views**: Click sidebar item → grid updates instantly with crossfade
   - View title in toolbar updates to show current context
   - Count in status bar updates

2. **Thumbnail browsing**:
   - Scroll through grid (smooth scrolling, virtualized for performance)
   - Hover shows subtle highlight
   - Click to select → blue border appears
   - Cmd+Click adds to selection
   - Shift+Click extends selection range (rubberband pattern)

3. **Thumbnail size adjustment**:
   - Drag slider → thumbnails resize smoothly in real-time
   - No jank, no reload, pure CSS transform
   - Grid reflows to fit new sizes

4. **QuickLook**:
   - Press Space on selected image → modal appears with large preview
   - Press left/right arrows or click filmstrip → navigate
   - Press Space again or Escape → modal closes
   - Can still press Delete while in QuickLook to mark for trash

### 2.3 Managing Albums

**Create album:**
1. Click "+" button in sidebar footer (or right-click → "New Album")
2. New item appears in sidebar in edit mode with placeholder "Untitled Album"
3. User types name, presses Enter
4. Album created, ready to receive images

**Create nested sub-album:**
1. Right-click existing album → "New Sub-Album"
2. Child item appears indented under parent in edit mode
3. User names it, presses Enter

**Rename:**
1. Double-click album name (or right-click → "Rename")
2. Text becomes editable inline
3. Press Enter to confirm, Escape to cancel

**Delete:**
1. Right-click album → "Delete Album"
2. Confirmation: "Delete 'Travel Photos'? The 47 images inside will become orphans."
3. Confirm → album removed, images now appear in Orphans view

**Reorder:**
1. Click and hold album row
2. Drag up/down → other items shift to make room
3. Drop → new order saved

### 2.4 Assigning Images

**Drag and drop (primary method):**
1. Select images in grid (single or multi)
2. Click and drag selection → ghost appears showing stacked thumbnails + count badge
3. Hover over album in sidebar → album row highlights (blue background)
4. Drop → images assigned
5. Brief toast confirmation: "Moved 5 images to Travel Photos"
6. If "Hide Assigned" is ON: images fade out of current view

**Context menu method:**
1. Select images
2. Right-click → context menu appears
3. Hover "Move to Album →" → submenu shows all albums
4. Click album name → images assigned
5. Same toast and fade-out behavior

**Marking as Trash or Not Sure:**
1. Select images
2. Right-click → "Mark as Trash" or "Mark as Not Sure"
3. Images get corresponding badge
4. If in an album view: images disappear from that view (now in Trash/Not Sure instead)

**Removing from album:**
1. Navigate to an album view
2. Select images
3. Right-click → "Remove from Album"
4. Images move to Orphans, disappear from current album view

### 2.5 Show/Hide Assigned Toggle

1. In "All Images" view, toolbar shows toggle: "Hide Assigned"
2. Toggle is OFF by default: grid shows all images
3. User clicks toggle ON:
   - Images with album assignments fade out
   - Status bar updates: "Showing 324 orphans (847 assigned hidden)"
4. Toggle is persistent (saved in preferences)
5. Clicking "Orphans" in sidebar is equivalent to All Images + toggle ON
   - If user is in Orphans view, the toggle is hidden (redundant)
6. When viewing a specific album, toggle is hidden (not applicable)

### 2.6 Organize Action

1. User clicks "Organize" button in toolbar

2. **If no vault folder set:**
   - Alert: "Please set a Vault folder in Settings first"
   - Button to open Settings

3. **If no assignments:**
   - Alert: "No images to organize. Assign images to albums first."

4. **Pre-flight dialog appears:**
   - Shows summary of all moves
   - User reviews the breakdown
   - Clicks "Organize" to proceed

5. **Progress modal:**
   - "Organizing... 234 / 847"
   - Progress bar fills
   - Current file path shown below
   - Cancel button available (stops early but keeps progress)

6. **If errors occur:**
   - Progress continues (doesn't stop on individual errors)
   - Errors collected for final report

7. **Completion:**
   - Success modal with summary
   - "View Report" shows detailed log
   - All processed images removed from app state
   - Albums now show 0 images
   - User can scan new source or scan vault to continue

---

## 3. UI Layout

### 3.1 Overall Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ [Traffic lights]  Source: ~/Pictures ▼  │  All Images  │ ... │ ← Toolbar
├────────────────┬────────────────────────────────────────────────┤
│                │                                                │
│   SIDEBAR      │              CONTENT GRID                      │
│                │                                                │
│  Library       │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │
│   All Images   │   │     │ │     │ │     │ │     │             │
│   Orphans      │   │ img │ │ img │ │ img │ │ img │             │
│   Trash        │   │     │ │     │ │     │ │     │             │
│   Not Sure     │   └─────┘ └─────┘ └─────┘ └─────┘             │
│                │                                                │
│  Albums        │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │
│   + Travel     │   │     │ │     │ │     │ │     │             │
│   + Work       │   │ img │ │ img │ │ img │ │ img │             │
│     └ 2024     │   │     │ │     │ │     │ │     │             │
│   + Personal   │   └─────┘ └─────┘ └─────┘ └─────┘             │
│                │                                                │
│  [+ New]       │                                                │
├────────────────┴────────────────────────────────────────────────┤
│ 1,234 images  •  5 selected  •  324 orphans                     │ ← Status bar
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Toolbar (Top)

**Left section:**
- Sidebar toggle button (hamburger icon to collapse/expand sidebar)
- Source folder dropdown: shows current path, click to change

**Center section:**
- Current view title: "All Images", "Orphans", or album name
- Breadcrumb for nested albums: "Work › 2024 Projects"

**Right section:**
- "Hide Assigned" toggle (only in All Images view)
- View mode buttons (grid icon selected, list icon for future)
- Thumbnail size: small grid icon | slider | large grid icon
- "Organize" button (prominent, blue/accent color)
- Settings gear icon

**Styling:**
- Height: 52px
- Background: macOS toolbar gray (#3A3A3C in dark mode, #F5F5F5 in light)
- Subtle bottom border
- Items vertically centered with 12px horizontal gaps

### 3.3 Sidebar (Left)

**Width:** 220px (resizable via drag handle, min 180px, max 320px)

**Sections:**
- **Library** (label, non-interactive)
  - All Images (icon: grid)
  - Orphans (icon: inbox or empty folder)
  - Trash (icon: trash can)
  - Not Sure (icon: clock or question mark)

- **Albums** (label + "+" button on hover)
  - User albums as tree
  - Folder icons for albums
  - Disclosure triangles for nested albums
  - Drag handle on hover for reordering

**Item styling:**
- Padding: 8px 12px
- Border-radius: 6px
- Hover: subtle background (#E5E5E5 light, #4A4A4A dark)
- Selected: accent blue background, white text
- Count badge: right-aligned, muted gray, tabular numbers

**Footer:**
- "+ New Album" button (text button or icon)
- Settings shortcut (optional)

### 3.4 Content Grid (Center)

**Container:**
- Fills remaining space (flex: 1)
- Padding: 16px
- Overflow-y: auto (scrollable)
- Background: slightly darker than sidebar (#2C2C2E dark, #FFFFFF light)

**Grid:**
- CSS Grid with `auto-fill` and `minmax(thumbnailSize, 1fr)`
- Gap: 8px
- Thumbnails maintain aspect ratio (object-fit: cover with fixed container height, or natural aspect ratio)

**Thumbnail card:**
- Border-radius: 8px
- Overflow: hidden
- Box-shadow: subtle (0 1px 3px rgba(0,0,0,0.1))
- Hover: brightness(1.05), or subtle scale(1.02)
- Selected: 3px blue border, slight scale-up

**Badge positioning:**
- Small icons (16px) in top-right corner
- Semi-transparent dark background pill behind badges
- Shows status: folder, clock, trash, or combination

**Filename overlay (optional):**
- Bottom of thumbnail, full width
- Gradient fade from transparent to dark
- White text, truncated with ellipsis
- Font: 11px SF Pro or system font

### 3.5 Status Bar (Bottom)

**Height:** 24px
**Background:** Same as toolbar
**Content:**
- Left: Image count for current view
- Center: Selection count (only if > 0)
- Right: Orphan count or context info

**Font:** 11px, muted gray

### 3.6 QuickLook Modal

**Backdrop:**
- Full viewport coverage
- Background: rgba(0, 0, 0, 0.85)
- Blur effect on content behind (backdrop-filter: blur)

**Modal container:**
- Centered, max-width: 90vw, max-height: 85vh
- Background: dark gray (#1C1C1E)
- Border-radius: 12px
- Box-shadow: large, dramatic

**Top bar:**
- Height: 44px
- Left: Close button (X), Previous/Next arrows
- Center: Filename
- Right: "Open with Preview" button, Share button (future)

**Image area:**
- Object-fit: contain (show full image, letterboxed)
- Click left half: previous image
- Click right half: next image

**Bottom filmstrip:**
- Height: 80px
- Horizontal scroll of thumbnails from current view
- Current image highlighted
- Click to navigate

**Keyboard:**
- Left/Right: navigate
- Escape: close
- Space: close (toggle behavior)

### 3.7 Context Menu Styling

- Background: blur + semi-transparent white (#FFFFFF/90% light, #2C2C2E/90% dark)
- Border-radius: 8px
- Box-shadow: macOS-style layered shadow
- Items: 28px height, 12px padding
- Hover: accent blue background
- Submenus: appear to the right with slight overlap
- Dividers: 1px line with padding

### 3.8 macOS-Inspired Styling Notes

**Typography:**
- System font stack: -apple-system, BlinkMacSystemFont, "SF Pro", sans-serif
- Weights: Regular (400), Medium (500), Semibold (600)
- Sizes: 11px (badges, status), 13px (body), 15px (titles)

**Colors (Dark mode, primary):**
- Background levels: #1C1C1E, #2C2C2E, #3A3A3C
- Text: #FFFFFF, #EBEBEB (secondary), #8E8E93 (tertiary)
- Accent: #0A84FF (system blue)
- Borders: #3D3D3D

**Spacing:**
- Base unit: 4px
- Common values: 8px, 12px, 16px, 24px

**Animations:**
- Transitions: 150-200ms ease-out
- Hover states: 100ms
- Modal appear: 200ms with subtle scale

---

## 4. Edge Cases & Behaviors

### 4.1 Missing or Moved Source Files

- **During normal use**: If thumbnail fails to load, show broken image icon with "File not found"
- **During Organize**: Log as skipped, continue with others, include in final report
- **Re-scan behavior**: Re-scan detects missing files, offers to remove them from index

### 4.2 Permission Errors

- **Reading source**: Show error for specific folder, continue scanning others
- **Moving files**: Skip file, log error with path and reason, continue
- **Vault not writable**: Detect before organize, block with clear error message

### 4.3 Filename Collisions in Vault

- Auto-rename with suffix: `photo.jpg` → `photo (1).jpg`
- Increment until unique: `photo (2).jpg`, `photo (3).jpg`
- Log all renames in final report
- Never overwrite existing files

### 4.4 Very Large Folders (Performance)

- **Thumbnail loading**: Lazy load as user scrolls (intersection observer)
- **Virtualization**: Only render visible thumbnails + buffer (react-window or similar)
- **Thumbnail generation**: Backend generates smaller thumbnails on scan, cached
- **Drag and drop**: Limit visual feedback to reasonable count (show "+99" for large selections)
- **Initial scan**: Stream results to UI progressively, don't block until complete

### 4.5 Interrupted Organize

- **User cancels**: Stop processing, show partial report, keep already-moved files where they are
- **Browser refresh**: Organize state lost, but moved files remain in vault. User must re-scan to see current state
- **Backend crash**: Same as refresh; atomic moves preferred so no half-written files
- **Recommendation**: Show warning before organize that it cannot be undone easily

### 4.6 Album Operations with Assigned Images

- **Delete album**: Images become orphans, not deleted from disk
- **Rename album**: No effect on assignments, vault folder will use new name on Organize
- **Move album (reorder)**: No effect on assignments
- **Nest album under another**: Images stay assigned, vault path changes accordingly

### 4.7 Duplicate Files

- **Same file assigned twice**: Not possible (exclusive assignment)
- **Duplicate content (different paths)**: Treated as separate images, both get organized
- **Same image in source scanned twice**: Backend dedupes by absolute path

### 4.8 Special Characters in Names

- **Album names**: Allow most characters, sanitize for filesystem on Organize (replace `/`, `:`, etc.)
- **Filenames**: Preserve as-is, only sanitize if truly invalid for filesystem
- **Unicode**: Full support, ensure proper encoding throughout

### 4.9 Edge UI States

- **Empty states**:
  - No source selected: Welcome screen with "Choose Folder"
  - Empty album: "No images in this album. Drag images here to add them."
  - No search results: "No images match your search"
- **All images assigned**: All Images view empty when toggle ON; show message "All images are organized! Toggle off to see them."

### 4.10 Browser-Specific

- **LocalStorage/IndexedDB limits**: Monitor storage usage, warn if approaching limits
- **Multiple tabs**: Warn or prevent; use BroadcastChannel to detect
- **Browser close during organize**: Treated as cancel; show warning if organize is in progress

---

## 5. Verification Plan

After implementation, verify:

1. **Scan & display**: Can select folder, scan completes, thumbnails appear
2. **Album CRUD**: Create, rename, delete, nest albums
3. **Assignment**: Drag-drop works, context menu works, exclusive assignment enforced
4. **Views**: All Images, Orphans, Trash, Not Sure, albums all show correct images
5. **Hide toggle**: Works in All Images, hidden images appear in correct count
6. **QuickLook**: Space opens modal, navigation works, Escape closes
7. **Selection**: Click, Cmd+Click, Shift+Click all work correctly
8. **Size slider**: Thumbnails resize smoothly
9. **Organize**: Pre-flight shows correct summary, files move correctly, collisions handled
10. **Edge cases**: Missing files handled, permissions handled, large folders performant
