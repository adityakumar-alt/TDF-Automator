// --- Target Date Factor Automator Application Logic ---

// App State
let rulesState = [];

// DOM Elements
const form = document.getElementById('rule-form');
const hotelIdsInput = document.getElementById('hotel-ids');
const ruleTypeSelect = document.getElementById('rule-type');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const multiplierInput = document.getElementById('multiplier');
const additionInput = document.getElementById('addition');
const startPriceInput = document.getElementById('start-price');
const endPriceInput = document.getElementById('end-price');

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

  // 1. Validate Hotel IDs (7-digit positive integer, with optional : multiplier)
  const rawHotels = hotelIdsInput.value;
  const hotelList = parseHotelIds(rawHotels);
  
  let isHotelListValid = hotelList.length > 0;
  
  for (let i = 0; i < hotelList.length; i++) {
    const entry = hotelList[i];
    if (entry.includes(':')) {
      const parts = entry.split(':');
      if (parts.length !== 2) {
        isHotelListValid = false;
        break;
      }
      const hotelId = parts[0].trim();
      const customMultiplier = parseFloat(parts[1].trim());
      
      if (!/^\d{7}$/.test(hotelId) || isNaN(customMultiplier) || customMultiplier <= 0) {
        isHotelListValid = false;
        break;
      }
    } else {
      if (!/^\d{7}$/.test(entry)) {
        isHotelListValid = false;
        break;
      }
    }
  }

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
  
  if (!startDateVal || !endDateVal || new Date(startDateVal) > new Date(endDateVal)) {
    showError('date-range-error', true);
    startDateInput.classList.add('invalid');
    endDateInput.classList.add('invalid');
    isValid = false;
  } else {
    showError('date-range-error', false);
    startDateInput.classList.remove('invalid');
    endDateInput.classList.remove('invalid');
  }

  // 3. Validate Multiplier (up to 2 decimals, positive number)
  // Only required if there is at least one hotel in the list without a custom multiplier
  const hasHotelWithoutCustomMultiplier = hotelList.some(entry => !entry.includes(':'));
  
  if (hasHotelWithoutCustomMultiplier || hotelList.length === 0) {
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
    // If all hotels have custom multipliers, the main multiplier field is optional
    showError('multiplier-error', false);
    multiplierInput.classList.remove('invalid');
  }

  return isValid;
}

// Parser for comma/newline-delimited Hotel IDs
function parseHotelIds(rawText) {
  if (!rawText) return [];
  return rawText
    .split(/[,\n]/)
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

// Generate the individual rows
function generateRows() {
  const hotelList = parseHotelIds(hotelIdsInput.value);
  const ruleType = ruleTypeSelect.value;
  const startDateVal = startDateInput.value;
  const endDateVal = endDateInput.value;
  
  const multiplier = multiplierInput.value ? parseFloat(multiplierInput.value).toFixed(2) : '';
  
  // Parse optional inputs
  const addition = additionInput.value ? parseFloat(additionInput.value).toFixed(2) : '';
  const startPrice = startPriceInput.value ? parseFloat(startPriceInput.value).toFixed(2) : '';
  const endPrice = endPriceInput.value ? parseFloat(endPriceInput.value).toFixed(2) : '';

  const newRows = [];
  
  // Calculate list of dates in-between
  const start = new Date(startDateVal);
  const end = new Date(endDateVal);
  const dateList = [];
  
  let current = new Date(start);
  while (current <= end) {
    dateList.push(formatDateString(current));
    current.setDate(current.getDate() + 1);
  }

  // Generate matrix
  hotelList.forEach(entry => {
    let hotelId = entry;
    let rowMultiplier = multiplier;
    
    if (entry.includes(':')) {
      const parts = entry.split(':');
      hotelId = parts[0].trim();
      rowMultiplier = parseFloat(parts[1].trim()).toFixed(2);
    }
    
    dateList.forEach(date => {
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

  // Append to state
  rulesState = [...rulesState, ...newRows];
  
  // Render
  renderTable();
  
  // Reset active button helpers
  document.querySelectorAll('.btn-helper').forEach(b => b.classList.remove('active'));
  
  showToast(`Successfully generated ${newRows.length} rule rows!`, 'success');
}

// Delete individual row
function deleteRow(id) {
  rulesState = rulesState.filter(row => row.id !== id);
  renderTable();
  showToast('Row removed', 'info');
}

// Render rules table from state
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

  // Draw rows
  rulesState.forEach((row, index) => {
    uniqueHotels.add(row.hotel_ID);
    uniqueDates.add(row.start_range);

    const tr = document.createElement('tr');
    
    // Use index-based coloring to distinguish hotels visually
    const hotelIndex = Array.from(uniqueHotels).indexOf(row.hotel_ID);
    tr.className = hotelIndex % 2 === 0 ? 'hotel-group-even' : 'hotel-group-odd';

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
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    `;
    
    // Wire up delete button event listener
    tr.querySelector('.btn-delete-row').addEventListener('click', () => {
      deleteRow(row.id);
    });

    tableBody.appendChild(tr);
  });

  // Re-initialize dynamic icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

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

// Clear table event handler
btnClear.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all generated rules?')) {
    rulesState = [];
    renderTable();
    showToast('Table cleared', 'info');
  }
});

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
  
  let csvContent = headers.join(',') + '\n';
  
  rulesState.forEach(row => {
    const line = [
      row.hotel_ID,
      row.rule_type,
      row.start_range,
      row.end_range,
      row.multiplier,
      row.addition,
      row.start_price,
      row.end_price
    ];
    csvContent += line.join(',') + '\n';
  });

  // Create downloadable file blob
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  // Dynamic filename based on date and hotels count
  const dateStr = formatDateString(new Date()).replace(/-/g, '');
  link.setAttribute("href", url);
  link.setAttribute("download", `target_date_factors_${dateStr}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('CSV downloaded successfully!', 'success');
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

