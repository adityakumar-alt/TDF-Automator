// --- Target Date Factor Automator Application Logic ---

// App State
let rulesState = [];

// DOM Elements
const form = document.getElementById('rule-form');
const hotelIdsInput = document.getElementById('hotel-ids');
const ruleTypeSelect = document.getElementById('rule-type');
const pricingModeSelect = document.getElementById('pricing-mode');
const fixedPricingContainer = document.getElementById('fixed-pricing-container');
const splitPricingContainer = document.getElementById('split-pricing-container');

const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const multiplierInput = document.getElementById('multiplier');
const additionInput = document.getElementById('addition');
const startPriceInput = document.getElementById('start-price');
const endPriceInput = document.getElementById('end-price');

// Split Pricing Modifiers
const splitBasePriceInput = document.getElementById('split-base-price');
const splitFlexibilitySelect = document.getElementById('split-flexibility');
const splitWeekdayTargetInput = document.getElementById('split-weekday-target');
const splitFridayTargetInput = document.getElementById('split-friday-target');
const splitSaturdayBehaviorSelect = document.getElementById('split-saturday-behavior');
const splitSaturdayTargetInput = document.getElementById('split-saturday-target');
const splitSaturdayTargetWrapper = document.getElementById('split-saturday-target-wrapper');
const splitSundayBehaviorSelect = document.getElementById('split-sunday-behavior');
const splitSundayTargetInput = document.getElementById('split-sunday-target');
const splitSundayTargetWrapper = document.getElementById('split-sunday-target-wrapper');

const previewWdText = document.getElementById('preview-wd');
const previewFrText = document.getElementById('preview-fr');
const previewSaText = document.getElementById('preview-sa');
const previewSuText = document.getElementById('preview-su');

const tableBody = document.getElementById('table-body');
const btnClear = document.getElementById('btn-clear');
const btnCopy = document.getElementById('btn-copy');
const btnDownload = document.getElementById('btn-download');

// Stat Display Elements
const statHotels = document.getElementById('stat-hotels');
const statDays = document.getElementById('stat-days');
const statRows = document.getElementById('stat-rows');

// Initialize Lucide Icons on load
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  setupDateDefaults();
  setupJoinedHotelsListeners();
  setupTabs();
  setupPricingModeListeners();
});

// Setup Default Dates (Today to Tomorrow)
function setupDateDefaults() {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  startDateInput.value = formatDateString(today);
  endDateInput.value = formatDateString(tomorrow);
}

// Date string formatter (YYYY-MM-DD for input elements)
function formatDateString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Formatter to YYYYMMDD (used for spreadsheet output)
function formatToYYYYMMDD(dateString) {
  return dateString.replace(/-/g, '');
}

// Date calculation helpers for quick presets
document.querySelectorAll('.btn-helper').forEach(btn => {
  btn.addEventListener('click', (e) => {
    // Remove active class from all helpers
    document.querySelectorAll('.btn-helper').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    const period = e.target.dataset.period;
    const today = new Date();

    let start = new Date(today);
    let end = new Date(today);

    switch (period) {
      case 'today':
        // Today only
        break;
      case 'tomorrow':
        start.setDate(today.getDate() + 1);
        end.setDate(today.getDate() + 1);
        break;
      case 'weekend':
        // This upcoming Friday to Sunday
        const dayOfWeek = today.getDay(); // 0 is Sunday, 5 is Friday
        let daysToFriday = 5 - dayOfWeek;
        if (daysToFriday < 0) daysToFriday += 7; // If it's already Saturday or Sunday, go to next Friday

        start.setDate(today.getDate() + daysToFriday);
        end.setDate(start.getDate() + 2); // Friday + 2 days = Sunday
        break;
      case 'next7':
        // Today to 6 days from now
        end.setDate(today.getDate() + 6);
        break;
    }

    startDateInput.value = formatDateString(start);
    endDateInput.value = formatDateString(end);

    // Clear date error if present
    document.getElementById('date-range-error').style.display = 'none';
  });
});

// Form Submission & Validation Logic
form.addEventListener('submit', (e) => {
  e.preventDefault();

  if (validateForm()) {
    generateRows();
  }
});

// Show inline validation error
function showError(elementId, show) {
  const errorEl = document.getElementById(elementId);
  if (errorEl) {
    errorEl.style.display = show ? 'block' : 'none';
  }
}

// Perform Form Validations
function validateForm() {
  let isValid = true;

  // 1. Validate Hotel/CS IDs
  const rawHotels = hotelIdsInput.value;
  const entries = parseHotelEntries(rawHotels);

  let isHotelListValid = entries.length > 0 && entries.every(e => /^\d{6,8}$/.test(e.hotelId));

  if (!isHotelListValid) {
    showError('hotel-ids-error', true);
    hotelIdsInput.classList.add('invalid');
    isValid = false;
  } else {
    showError('hotel-ids-error', false);
    hotelIdsInput.classList.remove('invalid');
  }

  // 2. Validate Date logical order
  const startDateVal = startDateInput.value;
  const endDateVal = endDateInput.value;
  const allEntriesHaveDates = entries.length > 0 && entries.every(e => e.startDate && e.endDate);

  if (!allEntriesHaveDates && (!startDateVal || !endDateVal || new Date(startDateVal) > new Date(endDateVal))) {
    showError('date-range-error', true);
    startDateInput.classList.add('invalid');
    endDateInput.classList.add('invalid');
    isValid = false;
  } else {
    showError('date-range-error', false);
    startDateInput.classList.remove('invalid');
    endDateInput.classList.remove('invalid');
  }

  // 3. Validate pricing depending on mode
  const mode = pricingModeSelect ? pricingModeSelect.value : 'fixed';

  if (mode === 'fixed') {
    // Clear split errors
    showError('split-base-price-error', false);
    splitBasePriceInput.classList.remove('invalid');
    showError('split-weekday-target-error', false);
    splitWeekdayTargetInput.classList.remove('invalid');
    showError('split-friday-target-error', false);
    if (splitFridayTargetInput) splitFridayTargetInput.classList.remove('invalid');
    showError('split-saturday-target-error', false);
    if (splitSaturdayTargetInput) splitSaturdayTargetInput.classList.remove('invalid');
    showError('split-sunday-target-error', false);
    splitSundayTargetInput.classList.remove('invalid');

    // Only required if there is at least one hotel without a custom multiplier
    const hasHotelWithoutCustomMultiplier = entries.some(entry => entry.customMultiplier === null);

    if (hasHotelWithoutCustomMultiplier || entries.length === 0) {
      const multiplierVal = parseFloat(multiplierInput.value);
      if (isNaN(multiplierVal) || multiplierVal <= 0) {
        showError('multiplier-error', true);
        multiplierInput.classList.add('invalid');
        isValid = false;
      } else {
        showError('multiplier-error', false);
        multiplierInput.classList.remove('invalid');
      }
    } else {
      showError('multiplier-error', false);
      multiplierInput.classList.remove('invalid');
    }
  } else {
    // Clear fixed errors
    showError('multiplier-error', false);
    multiplierInput.classList.remove('invalid');

    // Validate Base Price
    const basePriceVal = parseFloat(splitBasePriceInput.value);
    if (isNaN(basePriceVal) || basePriceVal <= 0) {
      showError('split-base-price-error', true);
      splitBasePriceInput.classList.add('invalid');
      isValid = false;
    } else {
      showError('split-base-price-error', false);
      splitBasePriceInput.classList.remove('invalid');
    }

    // Validate Weekday Target
    const wdTargetVal = parseFloat(splitWeekdayTargetInput.value);
    if (isNaN(wdTargetVal) || wdTargetVal <= 0) {
      showError('split-weekday-target-error', true);
      splitWeekdayTargetInput.classList.add('invalid');
      isValid = false;
    } else {
      showError('split-weekday-target-error', false);
      splitWeekdayTargetInput.classList.remove('invalid');
    }

    // Validate Friday Target
    const frTargetVal = parseFloat(splitFridayTargetInput.value);
    if (isNaN(frTargetVal) || frTargetVal <= 0) {
      showError('split-friday-target-error', true);
      if (splitFridayTargetInput) splitFridayTargetInput.classList.add('invalid');
      isValid = false;
    } else {
      showError('split-friday-target-error', false);
      if (splitFridayTargetInput) splitFridayTargetInput.classList.remove('invalid');
    }

    // Validate Saturday Target if custom mode
    const satBehavior = splitSaturdayBehaviorSelect ? splitSaturdayBehaviorSelect.value : 'custom';
    if (satBehavior === 'custom') {
      const saTargetVal = parseFloat(splitSaturdayTargetInput.value);
      if (isNaN(saTargetVal) || saTargetVal <= 0) {
        showError('split-saturday-target-error', true);
        if (splitSaturdayTargetInput) splitSaturdayTargetInput.classList.add('invalid');
        isValid = false;
      } else {
        showError('split-saturday-target-error', false);
        if (splitSaturdayTargetInput) splitSaturdayTargetInput.classList.remove('invalid');
      }
    } else {
      showError('split-saturday-target-error', false);
      if (splitSaturdayTargetInput) splitSaturdayTargetInput.classList.remove('invalid');
    }

    // Validate Sunday Target if custom mode
    const sunBehavior = splitSundayBehaviorSelect.value;
    if (sunBehavior === 'custom') {
      const suTargetVal = parseFloat(splitSundayTargetInput.value);
      if (isNaN(suTargetVal) || suTargetVal <= 0) {
        showError('split-sunday-target-error', true);
        splitSundayTargetInput.classList.add('invalid');
        isValid = false;
      } else {
        showError('split-sunday-target-error', false);
        splitSundayTargetInput.classList.remove('invalid');
      }
    } else {
      showError('split-sunday-target-error', false);
      splitSundayTargetInput.classList.remove('invalid');
    }
  }

  return isValid;
}

// Date Token Parser (supports YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, MM/DD/YYYY, YYYYMMDD)
function parseDateToken(token) {
  if (!token) return null;
  const str = token.trim();

  // YYYY-MM-DD or YYYY/MM/DD
  let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY or MM/DD/YYYY or DD/MM/YYYY
  match = str.match(/^(\d{1,2})([-/])(\d{1,2})[-/](\d{4})$/);
  if (match) {
    let p1 = parseInt(match[1], 10);
    let sep = match[2];
    let p2 = parseInt(match[3], 10);
    let y = match[4];
    let m, d;

    if (p1 > 12) {
      // First part is definitely Day (e.g. 31-07-2026)
      d = String(p1).padStart(2, '0');
      m = String(p2).padStart(2, '0');
    } else if (p2 > 12) {
      // Second part is definitely Day (e.g. 07/31/2026)
      m = String(p1).padStart(2, '0');
      d = String(p2).padStart(2, '0');
    } else {
      // Both numbers are <= 12 (e.g. 01-08-2026). Default to DD-MM-YYYY
      d = String(p1).padStart(2, '0');
      m = String(p2).padStart(2, '0');
    }
    return `${y}-${m}-${d}`;
  }

  // YYYYMMDD (8 digits)
  match = str.match(/^(20\d{2})(\d{2})(\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  return null;
}

// Flexible Parser for 1 to 4 columns from Excel / Google Sheets or delimited text:
// Format: CS_ID | Multiplier | Start Date | End Date
function parseHotelEntries(rawText) {
  if (!rawText) return [];
  const lines = rawText.split(/[\r\n]+/);
  const result = [];

  lines.forEach(line => {
    let trimmed = line.trim();
    if (!trimmed) return;

    let tokens = [];
    if (trimmed.includes('\t')) {
      tokens = trimmed.split('\t').map(t => t.trim()).filter(Boolean);
    } else if (trimmed.includes(':')) {
      tokens = trimmed.split(':').map(t => t.trim()).filter(Boolean);
    } else if (trimmed.includes(',')) {
      const parts = trimmed.split(',').map(t => t.trim()).filter(Boolean);
      const allSingleIds = parts.every(p => /^\d{6,8}$/.test(p));
      if (allSingleIds) {
        parts.forEach(id => {
          result.push({ hotelId: id, customMultiplier: null, startDate: null, endDate: null });
        });
        return;
      }
      tokens = parts;
    } else {
      tokens = trimmed.split(/\s+/).map(t => t.trim()).filter(Boolean);
    }

    if (tokens.length === 0) return;

    let hotelId = null;
    let customMultiplier = null;
    const dates = [];

    tokens.forEach(tok => {
      const parsedDate = parseDateToken(tok);
      if (parsedDate) {
        dates.push(parsedDate);
      } else if (!hotelId && /^\d{6,8}$/.test(tok)) {
        hotelId = tok;
      } else if (!isNaN(parseFloat(tok)) && customMultiplier === null && !/^\d{6,8}$/.test(tok)) {
        customMultiplier = parseFloat(tok).toFixed(2);
      } else if (!hotelId && /^\d+$/.test(tok)) {
        hotelId = tok;
      }
    });

    if (hotelId) {
      dates.sort();
      const startDate = dates.length > 0 ? dates[0] : null;
      const endDate = dates.length > 1 ? dates[dates.length - 1] : startDate;
      result.push({
        hotelId,
        customMultiplier,
        startDate,
        endDate
      });
    }
  });

  return result;
}

// Backward compatibility alias for single string hotel ID lists
function parseHotelIds(rawText) {
  const entries = parseHotelEntries(rawText);
  return entries.map(e => e.customMultiplier !== null ? `${e.hotelId}: ${e.customMultiplier}` : e.hotelId);
}

// Generate the individual rows
function generateRows() {
  const entries = parseHotelEntries(hotelIdsInput.value);
  const ruleType = ruleTypeSelect.value;
  const globalStartDateVal = startDateInput.value;
  const globalEndDateVal = endDateInput.value;

  const mode = pricingModeSelect ? pricingModeSelect.value : 'fixed';

  let fixedMultiplier = '';
  if (mode === 'fixed') {
    fixedMultiplier = multiplierInput.value ? parseFloat(multiplierInput.value).toFixed(2) : '';
  }

  // Parse optional inputs
  const addition = additionInput.value ? parseFloat(additionInput.value).toFixed(2) : '';
  const startPrice = startPriceInput.value ? parseFloat(startPriceInput.value).toFixed(2) : '';
  const endPrice = endPriceInput.value ? parseFloat(endPriceInput.value).toFixed(2) : '';

  const newRows = [];

  entries.forEach(entry => {
    const startDateVal = entry.startDate || globalStartDateVal;
    const endDateVal = entry.endDate || globalEndDateVal || startDateVal;

    if (!startDateVal || !endDateVal) return;

    const start = new Date(startDateVal);
    const end = new Date(endDateVal);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;

    const dateList = [];
    let current = new Date(start);
    while (current <= end) {
      dateList.push(formatDateString(current));
      current.setDate(current.getDate() + 1);
    }

    const hotelId = entry.hotelId;
    const customMultiplierValue = entry.customMultiplier;

    dateList.forEach(date => {
      const dateParts = date.split('-'); // YYYY-MM-DD
      const dObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      const dayOfWeek = dObj.getDay(); // 0 = Sunday, 1 = Monday...

      let rowMultiplier = '';

      if (customMultiplierValue !== null) {
        // If this specific hotel ID has a custom hardcoded multiplier, we use it directly
        rowMultiplier = customMultiplierValue;
      } else if (mode === 'fixed') {
        rowMultiplier = fixedMultiplier;
      } else {
        // We are in Split mode, so calculate the multiplier based on weekday/weekend/Sunday targets
        const basePrice = parseFloat(splitBasePriceInput.value);
        const flex = splitFlexibilitySelect.value;
        const flexFactor = flex === 'flex' ? 0.72 : 0.69;

        let targetPrice = basePrice;
        let shouldSkip = false;

        if (dayOfWeek >= 1 && dayOfWeek <= 4) { // Mon-Thu
          targetPrice = parseFloat(splitWeekdayTargetInput.value) || basePrice;
        } else if (dayOfWeek === 5) { // Friday
          targetPrice = parseFloat(splitFridayTargetInput.value) || basePrice;
        } else if (dayOfWeek === 6) { // Saturday
          const satBehavior = splitSaturdayBehaviorSelect ? splitSaturdayBehaviorSelect.value : 'custom';
          if (satBehavior === 'same') {
            targetPrice = parseFloat(splitFridayTargetInput.value) || basePrice;
          } else {
            targetPrice = parseFloat(splitSaturdayTargetInput.value) || basePrice;
          }
        } else { // Sunday (0)
          const sunBehavior = splitSundayBehaviorSelect.value;
          if (sunBehavior === 'skip') {
            shouldSkip = true;
          } else {
            targetPrice = parseFloat(splitSundayTargetInput.value) || basePrice;
          }
        }

        if (shouldSkip) {
          return; // Skip generating this row for Sunday
        }

        const newPrice = Math.round(targetPrice / 1.05 / flexFactor);
        rowMultiplier = (newPrice / basePrice).toFixed(2);
      }

      const formattedDate = formatToYYYYMMDD(date);
      newRows.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
        hotel_ID: hotelId,
        rule_type: ruleType,
        start_range: formattedDate,
        end_range: formattedDate,
        multiplier: rowMultiplier,
        addition: addition,
        start_price: startPrice,
        end_price: endPrice
      });
    });
  });

  const chkAppend = document.getElementById('chk-append-rules');
  const shouldAppend = chkAppend ? chkAppend.checked : false;

  if (shouldAppend) {
    rulesState = [...rulesState, ...newRows];
  } else {
    rulesState = newRows;
  }

  // Render
  renderTable();

  // Reset active button helpers
  document.querySelectorAll('.btn-helper').forEach(b => b.classList.remove('active'));

  showToast(
    shouldAppend
      ? `Appended ${newRows.length} new rule rows (${entries.length} hotels/ranges)!`
      : `Generated ${newRows.length} rule rows across ${entries.length} hotels/ranges!`,
    'success'
  );
}

// Delete individual row
function deleteRow(id) {
  rulesState = rulesState.filter(row => row.id !== id);
  renderTable();
  showToast('Row removed', 'info');
}

// Render rules table from state (optimized for large datasets)
function renderTable() {
  tableBody.innerHTML = '';

  if (rulesState.length === 0) {
    tableBody.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="9">
          <div class="empty-state">
            <i data-lucide="inbox"></i>
            <p>No rules generated yet</p>
            <span>Fill in the parameters and click "Generate Rule Rows" to populate the data.</span>
          </div>
        </td>
      </tr>
    `;

    // Disable buttons
    btnClear.disabled = true;
    btnCopy.disabled = true;
    btnDownload.disabled = true;

    // Update Stats
    updateStats(0, 0, 0);

    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Enable buttons
  btnClear.disabled = false;
  btnCopy.disabled = false;
  btnDownload.disabled = false;

  // Track unique hotels and dates for stats
  const uniqueHotels = new Set();
  const uniqueDates = new Set();

  rulesState.forEach(row => {
    uniqueHotels.add(row.hotel_ID);
    uniqueDates.add(row.start_range);
  });

  const fragment = document.createDocumentFragment();
  const displayLimit = 1000;

  // Render up to displayLimit rows
  const rowsToRender = rulesState.slice(0, displayLimit);

  rowsToRender.forEach((row) => {
    const tr = document.createElement('tr');

    // Use index-based coloring to distinguish hotels visually
    const hotelIndex = Array.from(uniqueHotels).indexOf(row.hotel_ID);
    tr.className = hotelIndex % 2 === 0 ? 'hotel-group-even' : 'hotel-group-odd';

    // Inline the trash icon SVG directly to avoid running lucide.createIcons() on the entire list
    tr.innerHTML = `
      <td><strong>${row.hotel_ID}</strong></td>
      <td><span class="badge">${row.rule_type}</span></td>
      <td>${row.start_range}</td>
      <td>${row.end_range}</td>
      <td>${row.multiplier}</td>
      <td>${row.addition || '-'}</td>
      <td>${row.start_price || '-'}</td>
      <td>${row.end_price || '-'}</td>
      <td>
        <button class="btn-delete-row" data-id="${row.id}" title="Delete Row">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
        </button>
      </td>
    `;

    // Wire up delete button event listener
    tr.querySelector('.btn-delete-row').addEventListener('click', () => {
      deleteRow(row.id);
    });

    fragment.appendChild(tr);
  });

  // If there are more than 1000 rows, show an informational row at the bottom
  if (rulesState.length > displayLimit) {
    const infoRow = document.createElement('tr');
    infoRow.className = 'table-info-row';
    infoRow.innerHTML = `
      <td colspan="9" style="text-align: center; color: var(--accent-secondary); background: rgba(6, 182, 212, 0.05); font-weight: 500; font-size: 0.85rem; padding: 12px; border-top: 1px solid rgba(6, 182, 212, 0.15);">
        Showing first 1,000 of ${rulesState.length} generated rows. All rows will be included in the CSV Download and Copy actions.
      </td>
    `;
    fragment.appendChild(infoRow);
  }

  // Batch insert into DOM
  tableBody.appendChild(fragment);

  // Update Stats
  updateStats(uniqueHotels.size, uniqueDates.size, rulesState.length);
  updateJoinedHotels();
}

// Update counters in Dashboard
function updateStats(hotels, days, totalRows) {
  statHotels.textContent = hotels;
  statDays.textContent = days;
  statRows.textContent = totalRows;
}

// Modal elements for Clear Table confirmation
const modalConfirm = document.getElementById('modal-confirm');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const btnModalConfirm = document.getElementById('btn-modal-confirm');

function openConfirmModal() {
  if (rulesState.length === 0) return;
  if (modalConfirm) modalConfirm.classList.add('active');
}

function closeConfirmModal() {
  if (modalConfirm) modalConfirm.classList.remove('active');
}

// Clear table event handler - opens custom confirmation modal
btnClear.addEventListener('click', openConfirmModal);

if (btnModalCancel) {
  btnModalCancel.addEventListener('click', closeConfirmModal);
}

if (modalConfirm) {
  modalConfirm.addEventListener('click', (e) => {
    if (e.target === modalConfirm) closeConfirmModal();
  });
}

if (btnModalConfirm) {
  btnModalConfirm.addEventListener('click', () => {
    rulesState = [];
    renderTable();
    closeConfirmModal();
    showToast('Table cleared successfully', 'info');
  });
}

// Copy to Clipboard (Format as Tab-Separated Values for Excel/Google Sheets compatibility)
btnCopy.addEventListener('click', () => {
  if (rulesState.length === 0) return;

  const headers = ['hotel_ID', 'rule_type', 'start_range', 'end_range', 'multiplier', 'addition', 'start_price', 'end_price'];

  // Format TSV lines
  let tsvContent = headers.join('\t') + '\n';

  rulesState.forEach(row => {
    // Convert YYYYMMDD (e.g., "20260706") to YYYY-MM-DD (e.g., "2026-07-06") so Google Sheets parses it as a valid date
    const formatDateForSheets = (dateStr) => {
      if (dateStr && dateStr.length === 8) {
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      }
      return dateStr;
    };

    const sheetsStart = formatDateForSheets(row.start_range);
    const sheetsEnd = formatDateForSheets(row.end_range);

    // Prepend single quote (') to force Google Sheets to display the exact decimal places
    const formattedMultiplier = `'${row.multiplier}`;
    const formattedAddition = row.addition ? `'${row.addition}` : '';
    const formattedStartPrice = row.start_price ? `'${row.start_price}` : '';
    const formattedEndPrice = row.end_price ? `'${row.end_price}` : '';

    const line = [
      row.hotel_ID,
      row.rule_type,
      sheetsStart,
      sheetsEnd,
      formattedMultiplier,
      formattedAddition,
      formattedStartPrice,
      formattedEndPrice
    ];
    tsvContent += line.join('\t') + '\n';
  });

  navigator.clipboard.writeText(tsvContent)
    .then(() => {
      showToast('Copied to Clipboard! You can now paste (Ctrl+V) directly in Google Sheets.', 'success');
    })
    .catch(err => {
      console.error('Failed to copy text: ', err);
      showToast('Failed to copy to clipboard. Try downloading the CSV instead.', 'error');
    });
});

// Download as CSV File
btnDownload.addEventListener('click', () => {
  if (rulesState.length === 0) return;

  const headers = ['hotel_ID', 'rule_type', 'start_range', 'end_range', 'multiplier', 'addition', 'start_price', 'end_price'];
  const chunkSize = 1000;
  const dateStr = formatDateString(new Date()).replace(/-/g, '');

  const triggerDownload = (chunk, partIndex, totalParts) => {
    let csvContent = headers.join(',') + '\n';
    chunk.forEach(row => {
      const line = [
        row.hotel_ID,
        row.rule_type,
        row.start_range,
        row.end_range,
        row.multiplier,
        row.addition || '',
        row.start_price || '',
        row.end_price || ''
      ];
      csvContent += line.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const filename = totalParts > 1
      ? `target_date_factors_${dateStr}_part${partIndex + 1}.csv`
      : `target_date_factors_${dateStr}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoke URL to release memory
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const totalParts = Math.ceil(rulesState.length / chunkSize);

  for (let i = 0; i < totalParts; i++) {
    const startIdx = i * chunkSize;
    const endIdx = startIdx + chunkSize;
    const chunk = rulesState.slice(startIdx, endIdx);

    // Stagger downloads by 200ms to prevent browser blocking simultaneous downloads
    setTimeout(() => {
      triggerDownload(chunk, i, totalParts);
      if (i === totalParts - 1) {
        showToast(
          totalParts > 1
            ? `Successfully downloaded ${totalParts} CSV files (split into ${chunkSize}-row parts).`
            : 'CSV downloaded successfully!',
          'success'
        );
      }
    }, i * 200);
  }
});

// Custom Toast notification generator
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Animation timing
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, 4000);
}

// Update Joined Hotel IDs text box
function updateJoinedHotels() {
  const joinedBox = document.getElementById('joined-hotels-box');
  const joinedInput = document.getElementById('joined-hotels-text');

  if (rulesState.length === 0) {
    joinedBox.style.display = 'none';
    joinedInput.value = '';
    return;
  }

  // Get unique hotels
  const uniqueHotels = Array.from(new Set(rulesState.map(row => row.hotel_ID)));

  // Join by comma only
  const joinedText = uniqueHotels.join(',');
  joinedInput.value = joinedText;
  joinedBox.style.display = 'block'; // shows the joined block
}

// Setup Event Listeners for Joined Hotels Box
function setupJoinedHotelsListeners() {
  // Copy joined hotels button listener
  document.getElementById('btn-copy-joined').addEventListener('click', () => {
    const joinedInput = document.getElementById('joined-hotels-text');
    if (!joinedInput.value) return;

    navigator.clipboard.writeText(joinedInput.value)
      .then(() => {
        showToast('Copied Joined Hotel IDs to clipboard!', 'success');
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        showToast('Failed to copy. Please copy the text manually.', 'error');
      });
  });
}

// --- TDF Calculator Real-Time Logic ---
const calcAskInput = document.getElementById('calc-ask-price');
const calcFlexibility = document.getElementById('calc-flexibility');
const calcP0 = document.getElementById('calc-p0');
const calcP1 = document.getElementById('calc-p1');
const calcP2 = document.getElementById('calc-p2');
const calcP3 = document.getElementById('calc-p3');
const calcP4 = document.getElementById('calc-p4');
const calcP5 = document.getElementById('calc-p5');
const calcResultsSection = document.getElementById('calc-results-section');
const calcResultsBody = document.getElementById('calc-results-body');

const pInputs = [calcP0, calcP1, calcP2, calcP3, calcP4, calcP5];

function calculateTDF() {
  const askPrice = parseFloat(calcAskInput.value);
  const flexibility = calcFlexibility.value;

  if (isNaN(askPrice) || askPrice <= 0) {
    calcResultsSection.style.display = 'none';
    return;
  }

  // Step 1: Remove 5% tax (divided by 1.05)
  const basePreTax = askPrice / 1.05;

  // Step 2: Divide by flexibility factor (0.72 for flex, 0.69 for non-flex) and round to a whole number
  const flexFactor = flexibility === 'flex' ? 0.72 : 0.69;
  const adjustedPrice = Math.round(basePreTax / flexFactor);

  let hasValidPValue = false;
  let htmlContent = '';

  pInputs.forEach((pInput, index) => {
    const pVal = parseFloat(pInput.value);

    if (!isNaN(pVal) && pVal > 0) {
      hasValidPValue = true;
      const tdfFactor = (adjustedPrice / pVal).toFixed(2);

      htmlContent += `
        <tr>
          <td><strong>P${index}</strong></td>
          <td>${pVal}</td>
          <td class="text-accent"><strong>${tdfFactor}</strong></td>
          <td>
            <button class="btn-use-factor" data-factor="${tdfFactor}" data-p-index="${index}" title="Use in Form">
              <i data-lucide="arrow-up-right"></i>
            </button>
          </td>
        </tr>
      `;
    }
  });

  if (hasValidPValue) {
    calcResultsBody.innerHTML = htmlContent;
    calcResultsSection.style.display = 'block';

    // Wire up the button click events
    calcResultsBody.querySelectorAll('.btn-use-factor').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const factor = e.currentTarget.dataset.factor;
        const pIndex = e.currentTarget.dataset.pIndex;
        const multiplierInput = document.getElementById('multiplier');
        multiplierInput.value = factor;
        showToast(`Multiplier set to ${factor} from P${pIndex} calculation!`, 'success');

        // Clear any error states on multiplier input
        multiplierInput.classList.remove('invalid');
        document.getElementById('multiplier-error').style.display = 'none';
      });
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  } else {
    calcResultsSection.style.display = 'none';
  }
}

// Add event listeners for real-time calculations
if (calcAskInput) {
  calcAskInput.addEventListener('input', calculateTDF);
  calcFlexibility.addEventListener('change', calculateTDF);
  pInputs.forEach(pInput => {
    if (pInput) {
      pInput.addEventListener('input', calculateTDF);
    }
  });

  // Bulk paste listener for P0 to automatically distribute values to P0-P5
  if (pInputs[0]) {
    pInputs[0].addEventListener('paste', (e) => {
      const pastedText = (e.clipboardData || window.clipboardData).getData('text');

      // Split by tabs, commas, newlines, or spaces
      const values = pastedText.split(/[\t,\n\r ]+/).map(val => val.trim()).filter(val => val.length > 0);

      if (values.length > 1) {
        e.preventDefault(); // Stop default single-input paste

        pInputs.forEach((input, index) => {
          if (input && values[index] !== undefined) {
            input.value = values[index];
          }
        });

        // Recalculate
        calculateTDF();
        showToast(`Successfully distributed ${Math.min(values.length, 6)} P-values!`, 'success');
      }
    });
  }
}

// Tab Switching Navigation Logic
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      // Toggle active class on buttons
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Toggle active class on contents
      tabContents.forEach(content => {
        if (content.id === targetTab) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
    });
  });
}

// Setup event listeners for Pricing Mode toggles and split calculations
function setupPricingModeListeners() {
  if (!pricingModeSelect) return;

  pricingModeSelect.addEventListener('change', () => {
    const mode = pricingModeSelect.value;
    if (mode === 'fixed') {
      fixedPricingContainer.style.display = 'flex';
      splitPricingContainer.style.display = 'none';
    } else {
      fixedPricingContainer.style.display = 'none';
      splitPricingContainer.style.display = 'block';
      updateSplitMultipliersPreview();
    }
  });

  // Toggle Saturday Target visibility based on behavior
  if (splitSaturdayBehaviorSelect) {
    splitSaturdayBehaviorSelect.addEventListener('change', () => {
      const behavior = splitSaturdayBehaviorSelect.value;
      if (behavior === 'same') {
        if (splitSaturdayTargetWrapper) splitSaturdayTargetWrapper.style.display = 'none';
      } else {
        if (splitSaturdayTargetWrapper) splitSaturdayTargetWrapper.style.display = 'block';
      }
      updateSplitMultipliersPreview();
    });
  }

  // Toggle Sunday Target visibility based on behavior
  splitSundayBehaviorSelect.addEventListener('change', () => {
    const behavior = splitSundayBehaviorSelect.value;
    if (behavior === 'skip') {
      splitSundayTargetWrapper.style.display = 'none';
    } else {
      splitSundayTargetWrapper.style.display = 'block';
    }
    updateSplitMultipliersPreview();
  });

  const splitInputs = [
    splitBasePriceInput,
    splitFlexibilitySelect,
    splitWeekdayTargetInput,
    splitFridayTargetInput,
    splitSaturdayBehaviorSelect,
    splitSaturdayTargetInput,
    splitSundayBehaviorSelect,
    splitSundayTargetInput
  ];

  splitInputs.forEach(input => {
    if (input) {
      input.addEventListener('input', updateSplitMultipliersPreview);
      input.addEventListener('change', updateSplitMultipliersPreview);
    }
  });
}

// Update the calculated split multipliers preview text in real-time
function updateSplitMultipliersPreview() {
  const basePrice = parseFloat(splitBasePriceInput.value);
  const flex = splitFlexibilitySelect.value;
  const flexFactor = flex === 'flex' ? 0.72 : 0.69;

  if (isNaN(basePrice) || basePrice <= 0) {
    if (previewWdText) previewWdText.textContent = '-';
    if (previewFrText) previewFrText.textContent = '-';
    if (previewSaText) previewSaText.textContent = '-';
    if (previewSuText) previewSuText.textContent = '-';
    return;
  }

  const wdTarget = parseFloat(splitWeekdayTargetInput.value);
  const frTarget = splitFridayTargetInput ? parseFloat(splitFridayTargetInput.value) : NaN;
  const satBehavior = splitSaturdayBehaviorSelect ? splitSaturdayBehaviorSelect.value : 'custom';
  const saTarget = satBehavior === 'same' ? frTarget : (splitSaturdayTargetInput ? parseFloat(splitSaturdayTargetInput.value) : NaN);
  const suTarget = parseFloat(splitSundayTargetInput.value);
  const suBehavior = splitSundayBehaviorSelect.value;

  const calculateSplitMultiplier = (target) => {
    if (isNaN(target) || target <= 0) return '-';
    const newPrice = Math.round(target / 1.05 / flexFactor);
    return (newPrice / basePrice).toFixed(2);
  };

  if (previewWdText) previewWdText.textContent = calculateSplitMultiplier(wdTarget);
  if (previewFrText) previewFrText.textContent = calculateSplitMultiplier(frTarget);
  if (previewSaText) previewSaText.textContent = calculateSplitMultiplier(saTarget);

  if (previewSuText) {
    if (suBehavior === 'skip') {
      previewSuText.textContent = 'Skipped';
    } else {
      previewSuText.textContent = calculateSplitMultiplier(suTarget);
    }
  }
}

// Initialize App Listeners
setupTabs();
setupPricingModeListeners();

