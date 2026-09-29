# Daily Pricing Dashboard: Matrix View Implementation Plan

## 1. Overview & Objective
Introduce an interactive **Matrix View (Property × Target Date Pivot)** into the **Daily Pricing Dashboard** (`#tab-dashboard`), complementing the existing **List View** and **Calendar View**.

### Motivation
- **Current List View Limitation:** The flat table displays one row per `(Property × Target Date)` combination (~7,800 rows across 10 forward days). Assessing how a single hotel's occupancy, rates, and multipliers evolve across the 10 days requires extensive scrolling or property-level filtering.
- **Matrix View Solution:** Each row represents a single **Property**, while columns represent **Target Dates** (the 10 forward dates). Each cell presents a comprehensive operational view (Occupancy vs Benchmark, Channel Mix, Rec TDF, and an editable Desired Push Price input).

---

## 2. UI Layout & View Switching

### 2.1 Three-Way View Switcher
Located in `.table-controls-bar` ([`index.html`](file:///d:/THV/index.html#L186-L196)):
```html
<div class="view-switch-group">
  <button id="btn-dash-view-matrix" class="btn-view-toggle active" title="Property × Date Matrix Pivot">
    <i data-lucide="layout-grid"></i>
    <span>Matrix View</span>
  </button>
  <button id="btn-dash-view-list" class="btn-view-toggle" title="Flat Property Rows">
    <i data-lucide="list"></i>
    <span>List View</span>
  </button>
  <button id="btn-dash-view-calendar" class="btn-view-toggle" title="Monthly Aggregated Calendar">
    <i data-lucide="calendar"></i>
    <span>Calendar View</span>
  </button>
</div>
```

### 2.2 Complete Filter Toolbar Preservation
All filters from the List View are retained with 100% parity:
- **Search Wrapper:** `#dash-search-input` (Property name, CS ID, city)
- **Target Dates Multi-Select:** `#dropdown-dates` (dynamic 10-date checkboxes, Select All, Clear)
- **OpZone / Region:** `#dropdown-opzone` (All OpZones, East, North 1, North 2, South 1, South 2, West)
- **City Category:** `#dropdown-city-type` (Mixed, Tier-1 Business, Tier-2 Business, Leisure)
- **City:** `#dropdown-city` (Searchable dynamic city list)
- **Flex Config:** `#dropdown-flex` (All, Flex, Non-Flex)
- **Strategy:** `#dropdown-strategy` (All, Rate Surge, Markdown, Maintain Baseline)
- **Actions:** `#btn-filter-apply`, `#btn-filter-clear-all`, and `#btn-generate-hawkeye-from-dash`

---

## 3. Matrix Table Layout & Columns Specification

```
+---------------------------------------------------------------------+---------------------------------------------------------+
|               STICKY FROZEN PROPERTY COLUMNS (PINNED LEFT)          |           DYNAMIC 10-DAY TARGET DATE COLUMNS            |
+-----+---------+----------------------+------------+---------+-------+--------------------+--------------------+---------------+
|  #  | CS_ID   | Hotel Name           | City       | Region  | Cat   | 29 Sep (Sun)       | 30 Sep (Mon)       | 01 Oct (Tue)..|
+-----+---------+----------------------+------------+---------+-------+--------------------+--------------------+---------------+
|  1  | 1894945 | Townhouse OAK Ind... | Bengaluru  | South 1 | T1-Biz| [Cell Data]        | [Cell Data]        | ...           |
+-----+---------+----------------------+------------+---------+-------+--------------------+--------------------+---------------+
```

### 3.1 Sticky Property Information Columns (Pinned Left on Horizontal Scroll)
1. **`#`** (`45px`): Row counter.
2. **`CS_ID`** (`90px`, Sticky Left: `0`): Monospace bold property identifier.
3. **`Hotel Name`** (`220px`, Sticky Left: `90px`): Property name with hover tooltip.
4. **`City`** (`100px`): Property city.
5. **`Region`** (`85px`): Operational Zone.
6. **`City Type`** (`95px`): Category badge (e.g., `Tier-1 Biz`).

### 3.2 Dynamic Date Columns (10 Rolling Days)
- Column headers dynamically generated from dates present in the active dataset.
- Weekend headers (Fri/Sat/Sun) highlighted with a subtle accent tint.
- Header sub-labels declaring the cell format: `[ Occ % | Rec TDF ] • [ Desired Price ]`.

---

## 4. Anatomy of the Interactive Data Cell

Every matrix cell is self-explanatory and provides complete operational clarity:

```
+-------------------------------------------------------------+
|  [ 🟢 78% Occ ] vs Bench: 70%                [ Rec: 1.25× ] |  <-- Line 1: Demand vs Benchmark & Rec Multiplier
+-------------------------------------------------------------+
|  DESIRED PRICE:                                             |  <-- Line 2: Explicit input label
|  [ ₹ 3,850                                                ] |  <-- Line 3: Inline Editable Desired Price Input
+-------------------------------------------------------------+
|  🚶 Walk: 12%   |   💼 B2B: 8.5%   |   Pushed: ₹3,100       |  <-- Line 4: Channel Mix & Live Pushed Base Price
+-------------------------------------------------------------+
```

### Detailed Field Descriptions:
1. **Demand vs Benchmark:**
   - `[ 🟢 78% Occ ]`: Color-coded pill (Green `>75%`, Amber `50–75%`, Blue `<50%`).
   - `vs Bench: 70%`: Clear visual explanation of why the algorithm recommended a surge or markdown.
2. **Recommended TDF:**
   - `[ Rec: 1.25× ]`: Clearly prefixed with `Rec:` to indicate algorithm recommendation.
3. **Desired Price Input (`[ ₹ 3,850 ]`):**
   - Inline editable input with currency prefix `₹`.
   - **Dynamic Recalculation:** Changing the price immediately recalculates `recTDF` and `delta` in real time.
   - **Auto-Revert:** If a user deletes the price and leaves the input empty, `focusout`/`blur` automatically reverts it to the Recommended Price with a green flash animation (`.price-reverted-flash`).
4. **Channel Mix & Baseline Rate:**
   - `🚶 Walk: 12%`: Walking share.
   - `💼 B2B: 8.5%`: B2B corporate share.
   - `Pushed: ₹3,100`: Currently active live rate pushed to OTAs.

### Rich Hover Tooltip (On-Demand Inspector)
Hovering over any cell reveals a full diagnostic card:
```
┌─────────────────────────────────────────────────────────────┐
│ 🏨 Townhouse OAK Indiranagar  •  📅 29 Sep 2026 (Sun)      │
├─────────────────────────────────────────────────────────────┤
│ • Current Occupancy:      78.4% (Benchmark: 70.0%)          │
│ • Live Pushed Rate:       ₹3,100 (Current TDF: 1.08×)       │
│ • Recommended Rate:       ₹3,850 (Recommended TDF: 1.25×)   │
│ • Net Multiplier Delta:   +0.17 (Rate Surge)                │
│ • Your Desired Price:     ₹3,850 (Editable)                 │
│ • Channel Mix:            Walking: 12%  |  B2B: 8.5%        │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Technical Architecture & State Synchronization

```mermaid
graph TD
    DS[dashboardState (Array of Property x Date Objects)] --> Filter[getFilteredDashboardRows()]
    Filter --> Pivot[getPivotedDashboardData()]
    Pivot --> MatrixView[Render Matrix Table (Grouped by Property)]
    Filter --> ListView[Render List Table (Flat Rows)]
    MatrixView -->|Inline Edit Price| UpdateState[Update match.desiredPushPrice & recTDF]
    ListView -->|Inline Edit Price| UpdateState
    UpdateState --> DS
    UpdateState --> Hawkeye[Generate Hawkeye Rules Button]
```

1. **Single Source of Truth (`dashboardState`):**
   - Both Matrix View and List View share the exact same underlying `dashboardState` objects.
   - Modifying a price in Matrix View instantly updates `match.desiredPushPrice`, `match.recTDF`, and `match.delta`.
   - Switching views preserves edits with zero data loss or synchronization lag.
2. **Hawkeye Rule Generation:**
   - `#btn-generate-hawkeye-from-dash` reads the modified `dashboardState` directly, whether edited in Matrix View or List View.
3. **Performance & Virtualized Pagination:**
   - Pagination bar at the bottom: 50, 100, 250, All properties per page.
   - 50–100 properties per page = 500–1,000 cells rendered in <15ms, maintaining smooth 60fps scrolling.

---

## 6. Implementation Roadmap

### Step 1: DOM Elements in [`index.html`](file:///d:/THV/index.html)
- Add `#btn-dash-view-matrix` to `.view-switch-group`.
- Add `<div id="dash-panel-matrix-view" class="dash-view-panel">` containing:
  - Sticky table `#dash-matrix-table`.
  - Pagination toolbar `#dash-matrix-pagination-bar`.

### Step 2: Styling in [`style.css`](file:///d:/THV/style.css)
- Implement sticky column freezing (`.col-sticky-1`, `.col-sticky-2`).
- Style `.dash-matrix-cell`, `.dash-matrix-price-input`, channel pills, and weekend column headers.

### Step 3: Renderer & Pivot Logic in [`app.js`](file:///d:/THV/app.js)
- Implement `renderDashMatrixTable()`:
  - Aggregate unique dates from `getFilteredDashboardRows()`.
  - Group records by `csId`.
  - Slice active page items.
  - Dynamically render `<thead>` and `<tbody>`.

### Step 4: Event Handlers & Auto-Revert Sync in [`app.js`](file:///d:/THV/app.js)
- Wire up `input`, `change`, and `focusout` on `#dash-matrix-tbody`.
- Update `setupDashboardViewToggle()` to support 3 panels (`matrix`, `list`, `calendar`).
- Connect all filter dropdown events and search input to trigger `renderDashMatrixTable()` when Matrix View is active.

---

## 7. Verification & Quality Gates
- [ ] **Data Integrity:** Verify all 10 dates map accurately to each property row.
- [ ] **Freeze Pane:** Verify `CS_ID` and `Hotel Name` remain pinned during horizontal scrolling.
- [ ] **Two-Way Sync:** Edit a price in Matrix View $\rightarrow$ switch to List View $\rightarrow$ confirm matching value.
- [ ] **Auto-Revert:** Clear price input $\rightarrow$ click away $\rightarrow$ confirm auto-revert to Recommended Price with green flash.
- [ ] **Filter Parity:** Apply OpZone, City, Category, or Date filters $\rightarrow$ confirm matrix rows and columns update accordingly.
- [ ] **Export Test:** Click "Generate Hawkeye Rules" $\rightarrow$ confirm custom matrix prices export into generated rules.
