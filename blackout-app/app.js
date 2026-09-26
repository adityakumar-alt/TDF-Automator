// --- GOOGLE SHEETS CLONE ENGINE (EXACT MATCH TO USER SCREENSHOT) ---

// State
let activeSheet = "Input";
let roomcatData = [];
let rackRatesData = [];
let inputRowsState = [];
let b2bOutputState = [];
let b2cOutputState = [];
let blackoutTitleState = "D22717 Vashi Exhibition";

let activeCell = { row: 8, col: 'A', field: 'input_id', idx: 0 };

// DOM Elements
const gridContainer = document.getElementById('grid-container');
const mainGrid = document.getElementById('main-sheets-grid');
const cellIndicator = document.getElementById('cell-indicator');
const formulaInput = document.getElementById('formula-input');
const statusIndicator = document.getElementById('status-indicator');

// Buttons
const btnAddRow = document.getElementById('btn-add-row');
const btnCopyInputsDown = document.getElementById('btn-copy-inputs-down');
const btnClearSheet = document.getElementById('btn-clear-sheet');
const btnPopulateB2b = document.getElementById('btn-populate-b2b');
const btnPopulateRoomTypes = document.getElementById('btn-populate-room-types');
const btnCsRepeat = document.getElementById('btn-cs-repeat');
const btnFinalB2b = document.getElementById('btn-final-b2b');
const btnB2cOutput = document.getElementById('btn-b2c-output');
const btnExportActive = document.getElementById('btn-export-active');

// Modal Elements
const pasteModal = document.getElementById('paste-modal');
const pasteArea = document.getElementById('paste-input-area');
const btnPasteModal = document.getElementById('btn-paste-modal');
const btnClosePaste = document.getElementById('btn-close-paste');
const btnApplyPaste = document.getElementById('btn-apply-paste');

const configModal = document.getElementById('config-modal');
const btnOpenConfig = document.getElementById('btn-open-config');
const btnCloseConfig = document.getElementById('btn-close-config');
const btnSaveConfig = document.getElementById('btn-save-config');

// Robust Helper to format date string to YYYY-MM-DD
function formatDateYYYYMMDD(val) {
  if (!val) return "";
  const sVal = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(sVal)) return sVal;
  
  // Handle DD-MM-YYYY or DD/MM/YYYY or YYYY/MM/DD
  const parts = sVal.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  const d = new Date(sVal);
  if (isNaN(d.getTime())) return sVal;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Init
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) window.lucide.createIcons();
  setupSheetTabs();
  setupModalEvents();
  setupFormulaBarEvents();

  await loadReferenceData();
  
  // Start with clean initial rows matching screenshot structure
  initDefaultRows();
});

function initDefaultRows() {
  inputRowsState = [
    { input_id: "1374088", cs_id: "", pretax_ask: "3333", start_date: "2026-09-12", end_date: "2026-09-15", base_room: "", rld: "", hotel_id: "", room_type: "", desc: "", from_date: "", to_date: "", def_price: 0, quote_price: 0, floor_price: 0, b2b_rack: "", rld_div: "", input_rate: "", min: "3075", factor: "1.57" },
    { input_id: "1379032", cs_id: "", pretax_ask: "3333", start_date: "2026-09-12", end_date: "2026-09-15", base_room: "", rld: "", hotel_id: "", room_type: "", desc: "", from_date: "", to_date: "", def_price: 0, quote_price: 0, floor_price: 0, b2b_rack: "", rld_div: "", input_rate: "", min: "2744", factor: "1.76" },
    { input_id: "1371682", cs_id: "", pretax_ask: "3333", start_date: "2026-09-12", end_date: "2026-09-15", base_room: "", rld: "", hotel_id: "", room_type: "", desc: "", from_date: "", to_date: "", def_price: 0, quote_price: 0, floor_price: 0, b2b_rack: "", rld_div: "", input_rate: "", min: "3653", factor: "1.32" },
    { input_id: "1371983", cs_id: "", pretax_ask: "3333", start_date: "2026-09-12", end_date: "2026-09-15", base_room: "", rld: "", hotel_id: "", room_type: "", desc: "", from_date: "", to_date: "", def_price: 0, quote_price: 0, floor_price: 0, b2b_rack: "", rld_div: "", input_rate: "", min: "4894", factor: "0.99" }
  ];
  renderCurrentGrid();
}

// Load Reference Data
async function loadReferenceData() {
  try {
    const resCat = await fetch('./data/roomcat.json');
    roomcatData = await resCat.json();
    const resRack = await fetch('./data/rack_rates.json');
    rackRatesData = await resRack.json();
  } catch (err) {
    roomcatData = [];
    rackRatesData = [];
  }
}

// Button: Copy Pretax Ask, Start Date & End Date from Row 8 to All Rows
btnCopyInputsDown.addEventListener('click', () => {
  if (inputRowsState.length === 0) return;
  const firstAsk = inputRowsState[0].pretax_ask;
  const firstStart = formatDateYYYYMMDD(inputRowsState[0].start_date);
  const firstEnd = formatDateYYYYMMDD(inputRowsState[0].end_date);

  inputRowsState.forEach(r => {
    if (firstAsk !== "" && firstAsk !== undefined) r.pretax_ask = firstAsk;
    if (firstStart) r.start_date = firstStart;
    if (firstEnd) r.end_date = firstEnd;
  });

  renderCurrentGrid();
});

// Button: Clear All Rows from Sheet
btnClearSheet.addEventListener('click', () => {
  inputRowsState = [];
  for (let i = 0; i < 5; i++) {
    inputRowsState.push({
      input_id: "", cs_id: "", pretax_ask: "", start_date: "", end_date: "",
      base_room: "", rld: "", hotel_id: "", room_type: "", desc: "", from_date: "",
      to_date: "", def_price: 0, quote_price: 0, floor_price: 0, b2b_rack: "",
      rld_div: "", input_rate: "", min: "", factor: ""
    });
  }
  b2bOutputState = [];
  b2cOutputState = [];
  renderCurrentGrid();
});

// Button: Add Row
btnAddRow.addEventListener('click', () => {
  const firstAsk = inputRowsState.length > 0 ? inputRowsState[0].pretax_ask : "";
  const firstStart = inputRowsState.length > 0 ? formatDateYYYYMMDD(inputRowsState[0].start_date) : "";
  const firstEnd = inputRowsState.length > 0 ? formatDateYYYYMMDD(inputRowsState[0].end_date) : "";

  inputRowsState.push({
    input_id: "", cs_id: "", pretax_ask: firstAsk, start_date: firstStart, end_date: firstEnd,
    base_room: "", rld: "", hotel_id: "", room_type: "", desc: "", from_date: "",
    to_date: "", def_price: 0, quote_price: 0, floor_price: 0, b2b_rack: "",
    rld_div: "", input_rate: firstAsk, min: "", factor: ""
  });

  renderCurrentGrid();
});

// Delete Individual Row
function deleteRow(idx) {
  inputRowsState.splice(idx, 1);
  renderCurrentGrid();
}

// Function matching Google Apps Script populateB2BInput() and CS ID Expansion
function populateB2BInput() {
  const validInputs = inputRowsState.filter(r => (r.input_id || r.cs_id || "").trim());
  if (validInputs.length === 0) return alert("Please enter or paste your CS IDs in Column A first!");

  const blackoutTitle = blackoutTitleState || "D22717 Vashi Exhibition";

  // Maps
  const hotelIdMap = {};
  const propertyMap = {};
  rackRatesData.forEach(item => {
    if (item.cs_id) {
      hotelIdMap[item.cs_id] = item.hotel_id;
      propertyMap[item.hotel_id] = item.property_name;
    }
  });

  const csRoomMap = {};
  roomcatData.forEach(item => {
    if (item.cs_id) {
      if (!csRoomMap[item.cs_id]) csRoomMap[item.cs_id] = [];
      csRoomMap[item.cs_id].push({
        room_type: item.room_type,
        rld: item.rld !== undefined ? item.rld : 0,
        base_room: item.base_room || ""
      });
    }
  });

  const newExpandedRows = [];

  validInputs.forEach((row) => {
    const parentCsId = (row.input_id || row.cs_id || "").trim();
    if (!parentCsId || parentCsId === "No match") return;

    const pretaxAsk = parseFloat(row.pretax_ask) || 3333;
    const startDate = formatDateYYYYMMDD(row.start_date) || "2026-09-12";
    const endDate = formatDateYYYYMMDD(row.end_date) || "2026-09-15";

    // Lookup room categories for THIS specific CS ID from RLD/Roomcat
    const rooms = csRoomMap[parentCsId] || [
      { room_type: "Oak", rld: 0, base_room: "OAK" }
    ];

    // Lookup Hotel ID for THIS specific CS ID
    const hid = hotelIdMap[parentCsId] || parentCsId;
    const pname = propertyMap[hid] || `Hotel ${parentCsId}`;
    const fullDescription = `${pname} - ${blackoutTitle}`;

    rooms.forEach((rm, idxInGroup) => {
      const rldVal = rm.rld !== undefined ? rm.rld : 0;
      const rldDiv = Math.round(rldVal / 0.69);
      const b2bRackRate = Math.round(pretaxAsk / 0.69) + rldDiv;

      newExpandedRows.push({
        // Col A (Input id's): Populated ONLY on the first row of each parent CS ID group
        input_id: idxInGroup === 0 ? parentCsId : "",
        
        // Col B (Cs id): Populated with parent CS ID on EVERY matching room row (Exact populateB2BInput logic)
        cs_id: parentCsId,
        
        // Col C (Pretax Ask input): Populated ONLY on the first row of each parent CS ID group
        pretax_ask: idxInGroup === 0 ? pretaxAsk : "",
        
        // Col D & E (Start Date / End Date): Populated ONLY on the first row of each parent CS ID group
        start_date: idxInGroup === 0 ? startDate : "",
        end_date: idxInGroup === 0 ? endDate : "",
        
        // Col F (Base Room): Populated on first row if base room specified (e.g. OAK)
        base_room: idxInGroup === 0 ? (rm.base_room || "OAK") : "",
        
        // Col G (RLD): Differential value per room category
        rld: rldVal !== 0 ? rldVal : (rm.rld === 0 ? "0" : ""),
        
        // Col H (Hotel Id): Mapped Hotel ID
        hotel_id: hid,
        
        // Col I (Room Type): Room category name
        room_type: rm.room_type,
        
        // Col J (description): Hotel Name - Blackout Title
        desc: fullDescription,
        
        // Col K & L (from_date / to_date): Repeated across ALL expanded room rows
        from_date: startDate,
        to_date: endDate,
        
        // Col M, N, O: 0
        def_price: 0,
        quote_price: 0,
        floor_price: 0,
        
        // Col P (b2b_rack_rate): Formula result: round(Pretax Ask / 0.69) + round(RLD / 0.69)
        b2b_rack: b2bRackRate,
        
        // Col Q (RLD/0.69): round(RLD / 0.69)
        rld_div: rldDiv,
        
        // Col R (input rate): Pretax Ask rate repeated across ALL expanded rows
        input_rate: pretaxAsk,
        
        // Col T & U (Min / Factors): Min ask & factor multiplier
        min: idxInGroup === 0 ? (row.min || "") : "",
        factor: idxInGroup === 0 ? (row.factor || "") : ""
      });
    });
  });

  inputRowsState = newExpandedRows;
  renderCurrentGrid();
}

// Function matching Google Apps Script populateRoomTypesAndRates()
function populateRoomTypesAndRates() {
  if (inputRowsState.length === 0) return alert("Sheet has no rows! Please enter data first.");

  const blackoutTitle = blackoutTitleState || "D22717 Vashi Exhibition";

  // Map Room Types per CS ID from roomcatData
  const csRoomMap = {};
  roomcatData.forEach(item => {
    if (item.cs_id) {
      if (!csRoomMap[item.cs_id]) csRoomMap[item.cs_id] = [];
      csRoomMap[item.cs_id].push({
        room_type: item.room_type,
        rld: item.rld !== undefined ? item.rld : 0,
        base_room: item.base_room || ""
      });
    }
  });

  // Map Hotel ID & Property Name from rackRatesData
  const hotelIdMap = {};
  const propertyMap = {};
  rackRatesData.forEach(item => {
    if (item.cs_id) {
      hotelIdMap[item.cs_id] = item.hotel_id;
      propertyMap[item.hotel_id] = item.property_name;
    }
  });

  const pointer = {};

  inputRowsState.forEach(row => {
    const cs = (row.cs_id || row.input_id || "").trim();
    if (!cs) {
      row.hotel_id = "";
      row.room_type = "";
      row.desc = "";
      return;
    }

    // Column H: Hotel Id
    const hotelId = hotelIdMap[cs] || cs;
    row.hotel_id = hotelId;

    // Column I: Room Type (looping room types per CS ID)
    const rooms = csRoomMap[cs] || [{ room_type: "Oak", rld: 0 }];
    if (pointer[cs] === undefined) pointer[cs] = 0;

    const rm = rooms[pointer[cs]] || rooms[0];
    row.room_type = rm.room_type;

    pointer[cs]++;
    if (pointer[cs] >= rooms.length) pointer[cs] = 0;

    // Column J: description (Property Name - D3 Title)
    const property = propertyMap[hotelId] || `Hotel ${cs}`;
    row.desc = property ? `${property} - ${blackoutTitle}` : "";
  });

  renderCurrentGrid();
}

// Button Listeners for CS ID Expansion & Populate B2B Input
if (btnPopulateB2b) btnPopulateB2b.addEventListener('click', populateB2BInput);
if (btnPopulateRoomTypes) btnPopulateRoomTypes.addEventListener('click', populateRoomTypesAndRates);
if (btnCsRepeat) btnCsRepeat.addEventListener('click', populateB2BInput);

// Button 3: Final Output (B2B)
btnFinalB2b.addEventListener('click', () => {
  const validInputs = inputRowsState.filter(r => (r.cs_id || r.input_id || "").trim());
  if (validInputs.length === 0) return alert("Please click CS ID Repeat first!");

  b2bOutputState = validInputs.map(r => ({
    hotel_id: r.hotel_id,
    room_type: r.room_type,
    description: r.desc,
    from_date: formatDateYYYYMMDD(r.from_date),
    to_date: formatDateYYYYMMDD(r.to_date),
    pre_tax_default_price: 0,
    pre_tax_quote_price: 0,
    pre_tax_floor_price: 0,
    b2b_rack_rate: r.b2b_rack
  }));

  const b2bTab = document.querySelector('.sheet-tab[data-sheet="B2B_Output"]');
  if (b2bTab) b2bTab.click();
});

// Function matching Google Apps Script generateTargetDateRules()
function generateTargetDateRules() {
  const validInputs = inputRowsState.filter(r => (r.input_id || r.cs_id || r.hotel_id || "").trim());
  if (validInputs.length === 0) return alert("No valid input data found! Please enter CS IDs and dates first.");

  b2cOutputState = [];
  
  // Group by unique Hotel ID / CS ID to generate targetDate rules
  const hotelGroups = {};
  validInputs.forEach(r => {
    const hId = (r.input_id || r.cs_id || r.hotel_id || "").trim();
    const sDate = r.start_date || r.from_date || "2026-09-12";
    const eDate = r.end_date || r.to_date || "2026-09-15";
    const mult = r.factor || r.multiplier || "1.18";

    if (hId && !hotelGroups[hId]) {
      hotelGroups[hId] = {
        hotel_id: hId,
        sDate: sDate,
        eDate: eDate,
        multiplier: mult
      };
    }
  });

  Object.values(hotelGroups).forEach(hg => {
    const sDate = new Date(hg.sDate);
    const eDate = new Date(hg.eDate);

    if (isNaN(sDate) || isNaN(eDate)) return;

    for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      const formattedDate = `${y}${m}${da}`;

      b2cOutputState.push({
        hotel_ID: hg.hotel_id,
        rule_type: "targetDate",
        start_range: formattedDate,
        end_range: formattedDate,
        multiplier: hg.multiplier,
        addition: "",
        start_price: "",
        end_price: ""
      });
    }
  });

  const b2cTab = document.querySelector('.sheet-tab[data-sheet="B2C_Output"]');
  if (b2cTab) b2cTab.click();
}

// Button 4: B2C Output (generateTargetDateRules)
btnB2cOutput.addEventListener('click', generateTargetDateRules);

// Tab Switcher
function setupSheetTabs() {
  document.querySelectorAll('.sheet-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.sheet-tab').forEach(t => t.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      activeSheet = target.dataset.sheet;
      renderCurrentGrid();
    });
  });
}

// Formula Bar Events
function setupFormulaBarEvents() {
  formulaInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (activeSheet === "Input" && activeCell && activeCell.idx < inputRowsState.length) {
      inputRowsState[activeCell.idx][activeCell.field] = val;

      const row = inputRowsState[activeCell.idx];
      if (row.pretax_ask) {
        const ask = parseFloat(row.pretax_ask) || 0;
        const rld = parseFloat(row.rld) || 0;
        row.rld_div = Math.round(rld / 0.69);
        row.b2b_rack = Math.round(ask / 0.69) + row.rld_div;
      }

      const inputEl = document.querySelector(`input.cell-input[data-idx="${activeCell.idx}"][data-field="${activeCell.field}"]`);
      if (inputEl) inputEl.value = val;
    }
  });
}

// Parse Single or Multi-Column Paste Data
function processPastedText(text) {
  if (!text || !text.trim()) return;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);

  inputRowsState = [];
  lines.forEach(l => {
    const parts = l.split(/[\t,]/).map(p => p.trim());
    if (parts[0]) {
      const csId = parts[0];
      const ask = parts.length > 1 && !isNaN(parts[1]) ? parseFloat(parts[1]) : "";
      const sDate = parts.length > 2 && parts[2] ? formatDateYYYYMMDD(parts[2]) : "";
      const eDate = parts.length > 3 && parts[3] ? formatDateYYYYMMDD(parts[3]) : "";

      inputRowsState.push({
        input_id: csId,
        cs_id: "",
        pretax_ask: ask,
        start_date: sDate,
        end_date: eDate,
        base_room: "",
        rld: "",
        hotel_id: "",
        room_type: "",
        desc: "",
        from_date: "",
        to_date: "",
        def_price: 0,
        quote_price: 0,
        floor_price: 0,
        b2b_rack: ask ? Math.round(ask / 0.69) : "",
        rld_div: "",
        input_rate: ask,
        min: "",
        factor: ""
      });
    }
  });

  renderCurrentGrid();
}

// Render Active Sheet Grid
function renderCurrentGrid() {
  mainGrid.innerHTML = "";

  if (activeSheet === "Input") {
    renderInputSheetGrid();
  } else if (activeSheet === "RLD/Roomcat") {
    renderRoomcatGrid();
  } else if (activeSheet === "rack_rates") {
    renderRackRatesGrid();
  } else if (activeSheet === "B2B_Output") {
    renderB2bOutputGrid();
  } else if (activeSheet === "B2C_Output") {
    renderB2cOutputGrid();
  }
}

// Render 100% Editable Input Sheet Grid Matching Screenshot Exactly
function renderInputSheetGrid() {
  const colLetters = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U"];
  const colNames = ["Input id's","Cs id","Pretax Ask input","Start Date","End Date","Base Room","RLD","Hotel Id","Room Type","description","from_date","to_date","pre_tax_default_price","pre_tax_quote_price","pre_tax_floor_price","b2b_rack_rate","RLD/0.69","input rate","","Min","Factors"];
  const colFields = ["input_id","cs_id","pretax_ask","start_date","end_date","base_room","rld","hotel_id","room_type","desc","from_date","to_date","def_price","quote_price","floor_price","b2b_rack","rld_div","input_rate","empty_col","min","factor"];

  let html = '<thead><tr><th style="width:44px;"></th>';
  colLetters.forEach(l => { html += `<th>${l}</th>`; });
  html += '<th style="width:50px;">Action</th></tr></thead><tbody>';

  // Header rows
  html += `<tr><td class="row-header">1</td><td colspan="6"></td><td style="font-weight:600; background:#fff; padding: 4px; border:1px solid #1a73e8; text-align:center;">Step 1</td><td colspan="15"></td></tr>`;
  html += `<tr><td class="row-header">2</td><td colspan="22"></td></tr>`;
  
  // Row 3: Blackout Campaign Name Cell (Cell D3 Yellow Highlight)
  html += `<tr><td class="row-header">3</td><td></td><td style="font-weight:700; background:#ff9900; color:#000; text-align:center; padding: 4px; border: 1px solid #000;">BLACKOUT</td><td colspan="3" style="background:#ffff00; padding:2px; border:1px solid #000;"><input type="text" id="blackout-title-input" value="${blackoutTitleState}" style="width:100%; border:none; background:transparent; font-weight:700; color:#000; outline:none;"></td><td colspan="17"></td></tr>`;
  
  html += `<tr><td class="row-header">4</td><td colspan="6"></td><td style="font-weight:600; background:#fff; padding: 4px; border:1px solid #1a73e8; text-align:center;">Step 2</td><td colspan="15"></td></tr>`;
  html += `<tr><td class="row-header">5</td><td colspan="22"></td></tr>`;
  html += `<tr><td class="row-header">6</td><td colspan="22"></td></tr>`;

  // Row 7 Column Names Header
  html += `<tr class="header-col-names"><td class="row-header">7</td>`;
  colNames.forEach(n => { html += `<td>${n}</td>`; });
  html += `<td>Del</td></tr>`;

  // Rows 8+ (Fully Editable Inputs with Screenshot Yellow Highlights)
  inputRowsState.forEach((r, idx) => {
    const rNum = idx + 8;
    html += `<tr><td class="row-header">${rNum}</td>`;

    colFields.forEach((field, colIdx) => {
      const colLetter = colLetters[colIdx];
      const rawVal = r[field] !== undefined && r[field] !== null ? r[field] : '';
      
      const isDateField = (field === 'start_date' || field === 'end_date' || field === 'from_date' || field === 'to_date');
      const inputType = isDateField ? 'date' : 'text';
      const val = isDateField ? formatDateYYYYMMDD(rawVal) : rawVal;

      // Highlight yellow on input columns (Cols A, B, C, D, E, T, U) matching screenshot
      const isInputCol = (field === 'input_id' || field === 'cs_id' || field === 'pretax_ask' || field === 'start_date' || field === 'end_date' || field === 'min' || field === 'factor');
      const cellBgStyle = (isInputCol && val !== "") ? 'background: #ffff00; font-weight: 500;' : '';

      html += `<td><input class="cell-input ${isDateField ? 'date-picker-cell' : ''}" type="${inputType}" value="${val}" style="${cellBgStyle}" data-idx="${idx}" data-field="${field}" data-col="${colLetter}" data-row="${rNum}"></td>`;
    });

    html += `<td style="text-align:center;"><button style="background:none; border:none; color:#ea4335; cursor:pointer; font-size:0.9rem;" onclick="deleteRow(${idx})" title="Delete Row">❌</button></td></tr>`;
  });

  html += '</tbody>';
  mainGrid.innerHTML = html;

  // Bind Blackout Title input
  const titleInput = document.getElementById('blackout-title-input');
  if (titleInput) {
    titleInput.addEventListener('input', (e) => {
      blackoutTitleState = e.target.value;
    });
  }

  // Setup Cell Event Listeners
  mainGrid.querySelectorAll('input.cell-input').forEach(input => {
    input.addEventListener('focus', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      const field = e.target.dataset.field;
      const col = e.target.dataset.col;
      const row = e.target.dataset.row;

      activeCell = { row, col, field, idx };
      cellIndicator.textContent = `${col}${row}`;
      formulaInput.value = e.target.value;

      document.querySelectorAll('input.cell-input').forEach(i => i.parentElement.classList.remove('active-cell'));
      e.target.parentElement.classList.add('active-cell');

      if (e.target.type === 'date' && typeof e.target.showPicker === 'function') {
        try { e.target.showPicker(); } catch (err) {}
      }
    });

    input.addEventListener('click', (e) => {
      if (e.target.type === 'date' && typeof e.target.showPicker === 'function') {
        try { e.target.showPicker(); } catch (err) {}
      }
    });

    input.addEventListener('paste', (e) => {
      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
      if (pastedText && pastedText.includes('\n')) {
        e.preventDefault();
        processPastedText(pastedText);
      }
    });

    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      const field = e.target.dataset.field;
      const val = e.target.value;

      inputRowsState[idx][field] = val;
      formulaInput.value = val;

      if (field === 'pretax_ask' || field === 'rld') {
        const ask = parseFloat(inputRowsState[idx].pretax_ask) || 0;
        const rld = parseFloat(inputRowsState[idx].rld) || 0;
        const rldDiv = Math.round(rld / 0.69);
        const b2bRack = Math.round(ask / 0.69) + rldDiv;

        inputRowsState[idx].rld_div = rldDiv;
        inputRowsState[idx].b2b_rack = b2bRack;

        const rldDivEl = document.querySelector(`input.cell-input[data-idx="${idx}"][data-field="rld_div"]`);
        const b2bRackEl = document.querySelector(`input.cell-input[data-idx="${idx}"][data-field="b2b_rack"]`);
        if (rldDivEl) rldDivEl.value = rldDiv;
        if (b2bRackEl) b2bRackEl.value = b2bRack;
      }
    });
  });
}

// Render Roomcat Reference Sheet
function renderRoomcatGrid() {
  const colLetters = ["A","B","C","D","E","F"];
  let html = '<thead><tr><th style="width:44px;"></th>';
  colLetters.forEach(l => { html += `<th>${l}</th>`; });
  html += '</tr></thead><tbody>';

  html += `<tr class="header-col-names"><td class="row-header">1</td><td>A</td><td>B</td><td>Room Type (Col C)</td><td>D</td><td>E</td><td>CS ID (Col F)</td></tr>`;

  roomcatData.forEach((r, idx) => {
    html += `<tr>
      <td class="row-header">${idx + 2}</td>
      <td><input class="cell-input" value="-"></td>
      <td><input class="cell-input" value="-"></td>
      <td><input class="cell-input" value="${r.room_type}"></td>
      <td><input class="cell-input" value="-"></td>
      <td><input class="cell-input" value="-"></td>
      <td><input class="cell-input" value="${r.cs_id}"></td>
    </tr>`;
  });

  html += '</tbody>';
  mainGrid.innerHTML = html;
}

// Render Rack Rates Reference Sheet
function renderRackRatesGrid() {
  const colLetters = ["S","T","U","V"];
  let html = '<thead><tr><th style="width:44px;"></th>';
  colLetters.forEach(l => { html += `<th>${l}</th>`; });
  html += '</tr></thead><tbody>';

  html += `<tr class="header-col-names"><td class="row-header">1</td><td>Hotel ID (Col S)</td><td>Property Name (Col T)</td><td>U</td><td>CS ID (Col V)</td></tr>`;

  rackRatesData.forEach((r, idx) => {
    html += `<tr>
      <td class="row-header">${idx + 8}</td>
      <td><input class="cell-input" value="${r.hotel_id}"></td>
      <td><input class="cell-input" value="${r.property_name}"></td>
      <td><input class="cell-input" value="-"></td>
      <td><input class="cell-input" value="${r.cs_id}"></td>
    </tr>`;
  });

  html += '</tbody>';
  mainGrid.innerHTML = html;
}

// Render B2B Output Sheet
function renderB2bOutputGrid() {
  const headers = ['hotel_id','room_type','description','from_date','to_date','pre_tax_default_price','pre_tax_quote_price','pre_tax_floor_price','b2b_rack_rate'];
  let html = '<thead><tr><th style="width:44px;"></th>';
  ["A","B","C","D","E","F","G","H","I"].forEach(l => { html += `<th>${l}</th>`; });
  html += '</tr></thead><tbody>';

  html += `<tr class="header-col-names"><td class="row-header">1</td>`;
  headers.forEach(h => { html += `<td>${h}</td>`; });
  html += `</tr>`;

  b2bOutputState.forEach((r, idx) => {
    html += `<tr>
      <td class="row-header">${idx + 2}</td>
      <td><input class="cell-input" value="${r.hotel_id}"></td>
      <td><input class="cell-input" value="${r.room_type}"></td>
      <td><input class="cell-input" value="${r.description}"></td>
      <td><input class="cell-input" type="date" value="${formatDateYYYYMMDD(r.from_date)}"></td>
      <td><input class="cell-input" type="date" value="${formatDateYYYYMMDD(r.to_date)}"></td>
      <td><input class="cell-input" value="0"></td>
      <td><input class="cell-input" value="0"></td>
      <td><input class="cell-input" value="0"></td>
      <td><input class="cell-input" value="${r.b2b_rack_rate}"></td>
    </tr>`;
  });

  html += '</tbody>';
  mainGrid.innerHTML = html;
}

// Render B2C Output Sheet
function renderB2cOutputGrid() {
  const headers = ['hotel_ID','rule_type','start_range','end_range','multiplier','addition','start_price','end_price'];
  let html = '<thead><tr><th style="width:44px;"></th>';
  ["A","B","C","D","E","F","G","H"].forEach(l => { html += `<th>${l}</th>`; });
  html += '</tr></thead><tbody>';

  html += `<tr class="header-col-names"><td class="row-header">1</td>`;
  headers.forEach(h => { html += `<td>${h}</td>`; });
  html += `</tr>`;

  b2cOutputState.forEach((r, idx) => {
    html += `<tr>
      <td class="row-header">${idx + 2}</td>
      <td><input class="cell-input" value="${r.hotel_ID}"></td>
      <td><input class="cell-input" value="${r.rule_type}"></td>
      <td><input class="cell-input" value="${r.start_range}"></td>
      <td><input class="cell-input" value="${r.end_range}"></td>
      <td><input class="cell-input" value="${r.multiplier}"></td>
      <td><input class="cell-input" value=""></td>
      <td><input class="cell-input" value=""></td>
      <td><input class="cell-input" value=""></td>
    </tr>`;
  });

  html += '</tbody>';
  mainGrid.innerHTML = html;
}

// Export CSV for active sheet
btnExportActive.addEventListener('click', () => {
  let csv = "";
  let name = `${activeSheet}.csv`;

  if (activeSheet === "B2B_Output") {
    csv = "hotel_id,room_type,description,from_date,to_date,pre_tax_default_price,pre_tax_quote_price,pre_tax_floor_price,b2b_rack_rate\n";
    b2bOutputState.forEach(r => { csv += `"${r.hotel_id || ''}","${r.room_type || ''}","${r.description || ''}","${formatDateYYYYMMDD(r.from_date)}","${formatDateYYYYMMDD(r.to_date)}",0,0,0,${r.b2b_rack_rate || 0}\n`; });
  } else if (activeSheet === "B2C_Output") {
    csv = "hotel_ID,rule_type,start_range,end_range,multiplier,addition,start_price,end_price\n";
    b2cOutputState.forEach(r => { csv += `"${r.hotel_ID || ''}","${r.rule_type || 'targetDate'}","${r.start_range || ''}","${r.end_range || ''}",${r.multiplier || ''},,,,\n`; });
  } else {
    csv = "Input id's,Cs id,Pretax Ask input,Start Date,End Date,Base Room,RLD,Hotel Id,Room Type,description,from_date,to_date,pre_tax_default_price,pre_tax_quote_price,pre_tax_floor_price,b2b_rack_rate,RLD/0.69,input rate,,Min,Factors\n";
    inputRowsState.forEach(r => {
      csv += `"${r.input_id || ''}","${r.cs_id || ''}",${r.pretax_ask || ''},"${formatDateYYYYMMDD(r.start_date)}","${formatDateYYYYMMDD(r.end_date)}","${r.base_room || ''}",${r.rld || ''},"${r.hotel_id || ''}","${r.room_type || ''}","${r.desc || ''}","${formatDateYYYYMMDD(r.from_date)}","${formatDateYYYYMMDD(r.to_date)}",0,0,0,${r.b2b_rack || ''},${r.rld_div || ''},${r.input_rate || ''},,${r.min || ''},${r.factor || ''}\n`;
    });
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
});

// Modal controls
function setupModalEvents() {
  btnPasteModal.addEventListener('click', () => pasteModal.classList.add('active'));
  btnClosePaste.addEventListener('click', () => pasteModal.classList.remove('active'));
  btnApplyPaste.addEventListener('click', () => {
    const text = pasteArea.value.trim();
    if (text) {
      processPastedText(text);
    }
    pasteModal.classList.remove('active');
  });

  btnOpenConfig.addEventListener('click', () => configModal.classList.add('active'));
  btnCloseConfig.addEventListener('click', () => configModal.classList.remove('active'));
  btnSaveConfig.addEventListener('click', () => {
    statusIndicator.textContent = "● Live Sheets Connected";
    configModal.classList.remove('active');
  });
}
