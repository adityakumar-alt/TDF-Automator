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
const splitTargetWeekendBehaviorSelect = document.getElementById('split-target-weekend-behavior');
const splitBasePriceInput = document.getElementById('split-base-price');
const splitFlexibilitySelect = document.getElementById('split-flexibility');
const splitWeekdayTargetInput = document.getElementById('split-weekday-target');
const splitTargetMonThuWrapper = document.getElementById('split-target-mon-thu-wrapper');
const splitFridayTargetInput = document.getElementById('split-friday-target');
const splitTargetFridayWrapper = document.getElementById('split-target-friday-wrapper');
const splitTargetSaturdayRow = document.getElementById('split-target-saturday-row');
const splitSaturdayBehaviorSelect = document.getElementById('split-saturday-behavior');
const splitSaturdayTargetInput = document.getElementById('split-saturday-target');
const splitSaturdayTargetWrapper = document.getElementById('split-saturday-target-wrapper');
const splitTargetSundayRow = document.getElementById('split-target-sunday-row');
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
  setupHawkeyeBaseRatesListeners();
  initHawkeyeBaseRatesFromCache();
  setupTabs();
  setupSidebarToggle();
  setupPricingModeListeners();
  setupAuthAndRBAC();
  setupCityBulkActionListeners();

  // Set initial landscape mode layout for default active tab (TDF Dashboard)
  const activeTabBtn = document.querySelector('.tab-btn.active');
  if (activeTabBtn) activeTabBtn.click();
});

// =========================================================================
// MULTI-USER RBAC & AUTHENTICATION STATE & CONTROLLER
// =========================================================================
let currentUser = null;

async function setupAuthAndRBAC() {
  setupAuthModalEvents();
  await checkAuthSession();
}

async function checkAuthSession() {
  try {
    const res = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();

      if (data.success && data.user) {
        currentUser = data.user;
        applyUserSession(currentUser);
        return;
      }
    }

    currentUser = null;
    showAuthModal();

  } catch (err) {
    console.error('Auth session check failed:', err);
    currentUser = null;
    showAuthModal();
  }
}

let googleClientInitialized = false;
let googleClientInitStarted = false;

async function initGoogleSignIn() {
  // Prevent multiple initialization attempts, including async race conditions
  if (googleClientInitialized || googleClientInitStarted) {
    return;
  }

  googleClientInitStarted = true;

  const container = document.getElementById('google-signin-btn-container');

  if (!container) {
    googleClientInitStarted = false;
    return;
  }

  let clientId = null;

  try {
    const cfgRes = await fetch('/api/auth/config');
    const cfgData = await cfgRes.json();

    if (cfgData && cfgData.clientId) {
      clientId = cfgData.clientId;
    }
  } catch (e) {
    console.warn('Could not load Google client ID from server:', e.message);
  }

  function tryRender() {
    if (!clientId) {
      console.warn('Google Sign-In initialization skipped: No Google Client ID provided by server.');
      googleClientInitStarted = false;
      return;
    }

    if (
      window.google &&
      window.google.accounts &&
      window.google.accounts.id
    ) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false
      });

      window.google.accounts.id.renderButton(container, {
        theme: 'filled_blue',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 320
      });

      googleClientInitialized = true;
      return;
    }

    setTimeout(tryRender, 300);
  }

  tryRender();
}

async function handleGoogleCredentialResponse(response) {
  const errorMsg = document.getElementById('auth-error-msg');
  if (errorMsg) errorMsg.style.display = 'none';

  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const data = await res.json();
    if (data.success && data.user) {
      currentUser = data.user;
      applyUserSession(currentUser);
      showToast(`Welcome, ${currentUser.name || currentUser.email}! (${currentUser.role})`, 'success');
    } else {
      if (errorMsg) {
        errorMsg.textContent = data.error || 'Google authentication failed.';
        errorMsg.style.display = 'block';
      }
    }
  } catch (err) {
    if (errorMsg) {
      errorMsg.textContent = `Sign in error: ${err.message}`;
      errorMsg.style.display = 'block';
    }
  }
}




function setupAuthModalEvents() {
  const btnSignOut = document.getElementById('btn-header-signout');

  // Initialize Google Sign-In
  initGoogleSignIn();

  // Sign out
  if (btnSignOut) {
    btnSignOut.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST'
        });
      } catch (e) { }

      currentUser = null;
      showAuthModal();
      showToast('Signed out successfully.', 'info');
    });
  }
}

function showAuthModal() {
    const overlay = document.getElementById('modal-auth-overlay');
    const headerProfile = document.getElementById('user-profile-header');

    if (overlay) overlay.style.display = 'flex';
    if (headerProfile) headerProfile.style.display = 'none';

    document.querySelectorAll('.admin-only-tab').forEach(tab => {
      tab.style.display = 'none';
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function applyUserSession(user) {
    const overlay = document.getElementById('modal-auth-overlay');
    const headerProfile = document.getElementById('user-profile-header');
    const avatar = document.getElementById('header-user-avatar');
    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-user-role');

    if (overlay) overlay.style.display = 'none';
    if (headerProfile) headerProfile.style.display = 'flex';

    if (user) {
      if (nameEl) nameEl.textContent = user.name || user.email || 'User';
      if (avatar) {
        const parts = (user.name || user.role || 'US').split(' ').filter(Boolean);
        const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : (parts[0] ? parts[0].substring(0, 2).toUpperCase() : 'US');
        avatar.textContent = initials;
      }
      if (roleEl) {
        roleEl.textContent = user.role || 'Pricing Manager';
        roleEl.className = 'user-role-badge';
        const r = (user.role || '').toLowerCase();
        if (r.includes('admin')) roleEl.classList.add('role-admin');
        else if (r.includes('pricing')) roleEl.classList.add('role-pricing');
        else if (r.includes('revops')) roleEl.classList.add('role-revops');
        else if (r.includes('zonal')) roleEl.classList.add('role-zonal');
      }

      // Enforce centralized tab permissions matrix (Solution B)
      applyTabPermissions(user);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // =========================================================================
  // TAB-LEVEL RBAC PERMISSIONS MATRIX (Solution B)
  // Edit this mapping to grant or revoke tab access for any role.
  // Any new tab added in the future that is NOT listed here automatically
  // defaults to ['Admin'] only for safe development rollout!
  // =========================================================================
  const TAB_PERMISSIONS = {
    // 1. Daily Pricing Dashboard (Accessible to All Roles: Admin, Pricing Manager, RevOps, Zonal Ops)
    'tab-dashboard': ['Admin', 'Pricing Manager', 'RevOps', 'Zonal Ops'],

    // 2. Hawkeye Base Rates (Live Google Sheets Rates dataset)
    'tab-hawkeye-rates': ['Admin', 'Pricing Manager', 'RevOps', 'Zonal Ops'],

    // 3. City Bulk Action (Multi-Day Ask Price & Rule Generation)
    'tab-city-bulk': ['Admin', 'Pricing Manager', 'RevOps', 'Zonal Ops'],

    // 4. Rule Parameters (Fixed & Split Multipliers)
    'tab-rules': ['Admin', 'Pricing Manager', 'RevOps', 'Zonal Ops'],

    // 5. TDF Calculator (P0-P5 calculations)
    'tab-calc': ['Admin', 'Pricing Manager', 'RevOps', 'Zonal Ops']
  };

  // Expose on window for easy developer inspection in console
  window.TAB_PERMISSIONS = TAB_PERMISSIONS;

  // Dynamically evaluate and apply tab visibility & redirection
  function applyTabPermissions(user) {
    if (!user) return;
    const userRole = (user.role || 'Pricing Manager').trim();
    const roleLower = userRole.toLowerCase();
    const isAdmin = roleLower.includes('admin');

    const navButtons = document.querySelectorAll('.sidebar-nav-menu .tab-btn[data-tab]');
    let firstAllowedTabBtn = null;
    let currentActiveIsAllowed = false;

    navButtons.forEach(btn => {
      const tabId = btn.getAttribute('data-tab');
      // If tab not in TAB_PERMISSIONS, default to Admin only (safe default for new development)
      const allowedRoles = TAB_PERMISSIONS[tabId] || ['Admin'];

      // Admin always has full access to everything
      const isAllowed = isAdmin || allowedRoles.some(r => r.toLowerCase() === roleLower);

      if (isAllowed) {
        btn.style.display = 'flex';
        if (!firstAllowedTabBtn) firstAllowedTabBtn = btn;
        if (btn.classList.contains('active')) currentActiveIsAllowed = true;
      } else {
        btn.style.display = 'none';
      }
    });

    // If current active tab is hidden or not allowed for this role, switch to first allowed tab
    if (!currentActiveIsAllowed && firstAllowedTabBtn) {
      firstAllowedTabBtn.click();
    } else {
      const activeTabBtn = document.querySelector('.sidebar-nav-menu .tab-btn.active');
      if (!activeTabBtn && firstAllowedTabBtn) {
        firstAllowedTabBtn.click();
      }
    }
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Setup Collapsible Sidebar Toggle
  function setupSidebarToggle() {
    const btnToggle = document.getElementById('sidebar-toggle-btn');
    const verticalSidebar = document.getElementById('vertical-sidebar');

    if (btnToggle && verticalSidebar) {
      btnToggle.addEventListener('click', () => {
        verticalSidebar.classList.toggle('collapsed');
        if (window.lucide) {
          window.lucide.createIcons();
        }
      });
    }
  }

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

  // Helper: Parses any date header string (e.g. '9/1/2026', '1-Sep', '2026-09-01') to YYYYMMDD
  function parseHeaderToYYYYMMDD(str) {
    if (!str) return '';
    const s = String(str).trim();

    // M/D/YYYY or MM/DD/YYYY or M/D/YY (e.g. 9/1/2026, 09/01/2026)
    const m1 = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (m1) {
      let m = parseInt(m1[1]);
      let d = parseInt(m1[2]);
      let y = parseInt(m1[3]);
      if (y < 100) y += 2000;
      return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
    }

    // D-MMM or DD-MMM (e.g. 1-Sep, 15-Aug)
    const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const m2 = s.match(/^(\d{1,2})[-/]([a-zA-Z]{3})$/i);
    if (m2) {
      const day = String(m2[1]).padStart(2, '0');
      const mon = monthMap[m2[2].toLowerCase()];
      if (mon) return `2026${mon}${day}`;
    }

    // YYYY-MM-DD or YYYY/MM/DD
    const m3 = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (m3) {
      return `${m3[1]}${String(m3[2]).padStart(2, '0')}${String(m3[3]).padStart(2, '0')}`;
    }

    return '';
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
        case 'next30':
          // Today to 29 days from now (1 Month)
          end.setDate(today.getDate() + 29);
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

      const splitMethodEl = document.getElementById('split-method');
      const splitMethod = splitMethodEl ? splitMethodEl.value : 'direct';

      if (splitMethod === 'direct') {
        // Clear target price errors
        showError('split-base-price-error', false);
        if (splitBasePriceInput) splitBasePriceInput.classList.remove('invalid');
        showError('split-weekday-target-error', false);
        if (splitWeekdayTargetInput) splitWeekdayTargetInput.classList.remove('invalid');
        showError('split-friday-target-error', false);
        if (splitFridayTargetInput) splitFridayTargetInput.classList.remove('invalid');
        showError('split-saturday-target-error', false);
        if (splitSaturdayTargetInput) splitSaturdayTargetInput.classList.remove('invalid');
        showError('split-sunday-target-error', false);
        if (splitSundayTargetInput) splitSundayTargetInput.classList.remove('invalid');

        // Validate Direct Multipliers
        const directMonThuInput = document.getElementById('split-direct-mon-thu');
        const directFriInput = document.getElementById('split-direct-fri') || document.getElementById('split-direct-fri-sat');
        const directSatInput = document.getElementById('split-direct-sat');
        const directSatBehEl = document.getElementById('split-direct-saturday-behavior');
        const directSunInput = document.getElementById('split-direct-sunday');
        const directSunBehEl = document.getElementById('split-direct-sunday-behavior');
        const directWeekendBehEl = document.getElementById('split-direct-weekend-behavior');
        const directWeekendBeh = directWeekendBehEl ? directWeekendBehEl.value : 'include';

        if (directWeekendBeh === 'weekdays_only' || directWeekendBeh === 'skip') {
          if (directMonThuInput) directMonThuInput.classList.remove('invalid');
          const monThuVal = directMonThuInput ? parseFloat(directMonThuInput.value) : NaN;
          if (isNaN(monThuVal) || monThuVal <= 0) {
            if (directMonThuInput) directMonThuInput.classList.add('invalid');
            isValid = false;
          }
          if (directFriInput) directFriInput.classList.remove('invalid');
          if (directSatInput) directSatInput.classList.remove('invalid');
          if (directSunInput) directSunInput.classList.remove('invalid');
        } else if (directWeekendBeh === 'weekends_only') {
          if (directMonThuInput) directMonThuInput.classList.remove('invalid');

          const friVal = directFriInput ? parseFloat(directFriInput.value) : NaN;
          if (isNaN(friVal) || friVal <= 0) {
            if (directFriInput) directFriInput.classList.add('invalid');
            isValid = false;
          } else {
            if (directFriInput) directFriInput.classList.remove('invalid');
          }

          const satBeh = directSatBehEl ? directSatBehEl.value : 'custom';
          if (satBeh === 'custom') {
            const satVal = directSatInput ? parseFloat(directSatInput.value) : NaN;
            if (isNaN(satVal) || satVal <= 0) {
              if (directSatInput) directSatInput.classList.add('invalid');
              isValid = false;
            } else {
              if (directSatInput) directSatInput.classList.remove('invalid');
            }
          } else {
            if (directSatInput) directSatInput.classList.remove('invalid');
          }

          const sunBeh = directSunBehEl ? directSunBehEl.value : 'custom';
          if (sunBeh === 'custom') {
            const sunVal = directSunInput ? parseFloat(directSunInput.value) : NaN;
            if (isNaN(sunVal) || sunVal <= 0) {
              if (directSunInput) directSunInput.classList.add('invalid');
              isValid = false;
            } else {
              if (directSunInput) directSunInput.classList.remove('invalid');
            }
          } else {
            if (directSunInput) directSunInput.classList.remove('invalid');
          }
        } else {
          const monThuVal = directMonThuInput ? parseFloat(directMonThuInput.value) : NaN;
          if (isNaN(monThuVal) || monThuVal <= 0) {
            if (directMonThuInput) directMonThuInput.classList.add('invalid');
            isValid = false;
          } else {
            if (directMonThuInput) directMonThuInput.classList.remove('invalid');
          }

          const friVal = directFriInput ? parseFloat(directFriInput.value) : NaN;
          if (isNaN(friVal) || friVal <= 0) {
            if (directFriInput) directFriInput.classList.add('invalid');
            isValid = false;
          } else {
            if (directFriInput) directFriInput.classList.remove('invalid');
          }

          const satBeh = directSatBehEl ? directSatBehEl.value : 'custom';
          if (satBeh === 'custom') {
            const satVal = directSatInput ? parseFloat(directSatInput.value) : NaN;
            if (isNaN(satVal) || satVal <= 0) {
              if (directSatInput) directSatInput.classList.add('invalid');
              isValid = false;
            } else {
              if (directSatInput) directSatInput.classList.remove('invalid');
            }
          } else {
            if (directSatInput) directSatInput.classList.remove('invalid');
          }

          const sunBeh = directSunBehEl ? directSunBehEl.value : 'custom';
          if (sunBeh === 'custom') {
            const sunVal = directSunInput ? parseFloat(directSunInput.value) : NaN;
            if (isNaN(sunVal) || sunVal <= 0) {
              if (directSunInput) directSunInput.classList.add('invalid');
              isValid = false;
            } else {
              if (directSunInput) directSunInput.classList.remove('invalid');
            }
          } else {
            if (directSunInput) directSunInput.classList.remove('invalid');
          }
        }
      } else {
        // Clear direct multiplier errors
        const directMonThuInput = document.getElementById('split-direct-mon-thu');
        const directFriInput = document.getElementById('split-direct-fri') || document.getElementById('split-direct-fri-sat');
        const directSatInput = document.getElementById('split-direct-sat');
        const directSunInput = document.getElementById('split-direct-sunday');
        if (directMonThuInput) directMonThuInput.classList.remove('invalid');
        if (directFriInput) directFriInput.classList.remove('invalid');
        if (directSatInput) directSatInput.classList.remove('invalid');
        if (directSunInput) directSunInput.classList.remove('invalid');

        // Validate Target Prices
        const basePriceVal = parseFloat(splitBasePriceInput.value);
        if (isNaN(basePriceVal) || basePriceVal <= 0) {
          showError('split-base-price-error', true);
          splitBasePriceInput.classList.add('invalid');
          isValid = false;
        } else {
          showError('split-base-price-error', false);
          splitBasePriceInput.classList.remove('invalid');
        }

        const targetWeekendBehEl = document.getElementById('split-target-weekend-behavior');
        const targetWeekendBeh = targetWeekendBehEl ? targetWeekendBehEl.value : 'include';

        if (targetWeekendBeh === 'weekdays_only' || targetWeekendBeh === 'skip') {
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

          // Clear weekend errors
          showError('split-friday-target-error', false);
          if (splitFridayTargetInput) splitFridayTargetInput.classList.remove('invalid');
          showError('split-saturday-target-error', false);
          if (splitSaturdayTargetInput) splitSaturdayTargetInput.classList.remove('invalid');
          showError('split-sunday-target-error', false);
          if (splitSundayTargetInput) splitSundayTargetInput.classList.remove('invalid');
        } else if (targetWeekendBeh === 'weekends_only') {
          // Clear weekday error
          showError('split-weekday-target-error', false);
          if (splitWeekdayTargetInput) splitWeekdayTargetInput.classList.remove('invalid');

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
        } else {
          // All Days (include)
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
          // We are in Split mode: Check method (Direct Multipliers vs Target Prices)
          const splitMethodSelectEl = document.getElementById('split-method');
          const splitMethod = splitMethodSelectEl ? splitMethodSelectEl.value : 'direct';
          let shouldSkip = false;

          if (splitMethod === 'direct') {
            const directWeekendBehEl = document.getElementById('split-direct-weekend-behavior');
            const directWeekendBeh = directWeekendBehEl ? directWeekendBehEl.value : 'include';

            const directMonThu = parseFloat(document.getElementById('split-direct-mon-thu')?.value || '1.10');
            const directFri = parseFloat((document.getElementById('split-direct-fri') || document.getElementById('split-direct-fri-sat'))?.value || '1.25');
            const directSatBehaviorEl = document.getElementById('split-direct-saturday-behavior');
            const directSatBeh = directSatBehaviorEl ? directSatBehaviorEl.value : 'custom';
            const directSatInputVal = parseFloat(document.getElementById('split-direct-sat')?.value);
            const directSat = (directSatBeh === 'same' || isNaN(directSatInputVal)) ? directFri : directSatInputVal;

            const directSunBehaviorEl = document.getElementById('split-direct-sunday-behavior');
            const directSundayBeh = directSunBehaviorEl ? directSunBehaviorEl.value : 'custom';
            const directSunday = parseFloat(document.getElementById('split-direct-sunday')?.value || '1.05');

            if ((directWeekendBeh === 'weekdays_only' || directWeekendBeh === 'skip') && (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0)) {
              shouldSkip = true; // Skip Friday, Saturday, and Sunday in Weekday Only mode
            } else if (directWeekendBeh === 'weekends_only' && dayOfWeek >= 1 && dayOfWeek <= 4) {
              shouldSkip = true; // Skip Mon-Thu in Weekend Only mode
            } else if (dayOfWeek >= 1 && dayOfWeek <= 4) { // Mon-Thu
              rowMultiplier = (!isNaN(directMonThu) ? directMonThu : 1.10).toFixed(2);
            } else if (dayOfWeek === 5) { // Friday
              rowMultiplier = (!isNaN(directFri) ? directFri : 1.25).toFixed(2);
            } else if (dayOfWeek === 6) { // Saturday
              rowMultiplier = (!isNaN(directSat) ? directSat : directFri).toFixed(2);
            } else { // Sunday (0)
              if (directSundayBeh === 'skip') {
                shouldSkip = true;
              } else {
                rowMultiplier = (!isNaN(directSunday) ? directSunday : 1.05).toFixed(2);
              }
            }
          } else {
            // Target Prices mode
            const targetWeekendBehEl = document.getElementById('split-target-weekend-behavior');
            const targetWeekendBeh = targetWeekendBehEl ? targetWeekendBehEl.value : 'include';

            if ((targetWeekendBeh === 'weekdays_only' || targetWeekendBeh === 'skip') && (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0)) {
              shouldSkip = true; // Skip Friday, Saturday, and Sunday in Weekdays Only mode
            } else if (targetWeekendBeh === 'weekends_only' && dayOfWeek >= 1 && dayOfWeek <= 4) {
              shouldSkip = true; // Skip Mon-Thu in Weekends Only mode
            } else {
              const basePrice = parseFloat(splitBasePriceInput.value);
              const flex = splitFlexibilitySelect.value;
              const flexFactor = flex === 'flex' ? 0.72 : 0.69;

              let targetPrice = basePrice;

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

              if (!shouldSkip) {
                const newPrice = Math.round(targetPrice / 1.05 / flexFactor);
                rowMultiplier = (newPrice / basePrice).toFixed(2);
              }
            }
          }

          if (shouldSkip) {
            return; // Skip generating this row for Sunday
          }
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
      <td><strong>${escapeHtml(row.hotel_ID)}</strong></td>
      <td><span class="badge">${escapeHtml(row.rule_type)}</span></td>
      <td>${escapeHtml(row.start_range)}</td>
      <td>${escapeHtml(row.end_range)}</td>
      <td>${escapeHtml(row.multiplier)}</td>
      <td>${escapeHtml(row.addition || '-')}</td>
      <td>${escapeHtml(row.start_price || '-')}</td>
      <td>${escapeHtml(row.end_price || '-')}</td>
      <td>
        <button class="btn-delete-row" data-id="${escapeHtml(row.id)}" title="Delete Row">
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

  // Update Joined Hotel IDs text box (Chunks into parts of max 100 hotel IDs for Hawkeye Admin)
  function updateJoinedHotels() {
    const joinedBox = document.getElementById('joined-hotels-box');
    const container = document.getElementById('joined-hotels-container');
    const headerActions = document.getElementById('joined-hotels-header-actions');
    if (!joinedBox || !container) return;

    if (rulesState.length === 0) {
      joinedBox.style.display = 'none';
      container.innerHTML = '';
      if (headerActions) headerActions.innerHTML = '';
      return;
    }

    // Get unique hotels
    const uniqueHotels = Array.from(new Set(rulesState.map(row => (row.hotel_ID || '').toString().trim()).filter(Boolean)));
    const total = uniqueHotels.length;

    if (total === 0) {
      joinedBox.style.display = 'none';
      container.innerHTML = '';
      if (headerActions) headerActions.innerHTML = '';
      return;
    }

    const CHUNK_SIZE = 100;
    const numParts = Math.ceil(total / CHUNK_SIZE);

    // Update header badge and actions
    if (headerActions) {
      if (numParts > 1) {
        const isCollapsed = joinedBox.classList.contains('collapsed');
        const iconSvg = isCollapsed
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`;
        headerActions.innerHTML = `
        <span class="joined-hotels-badge">${total} Hotels · ${numParts} Parts (Max 100 / part)</span>
        <button id="btn-copy-all-joined" class="btn btn-secondary btn-sm" title="Copy all ${total} hotel IDs" style="padding: 4px 10px; font-size: 0.75rem;">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          <span>Copy All (${total})</span>
        </button>
        <button id="btn-toggle-joined-parts" class="btn btn-secondary btn-sm btn-toggle-joined" data-num-parts="${numParts}" title="Collapse or Expand parts list" style="padding: 4px 10px; font-size: 0.75rem;">
          ${iconSvg}
          <span class="toggle-text">${isCollapsed ? `Show Parts (${numParts})` : 'Collapse'}</span>
        </button>
      `;
      } else {
        headerActions.innerHTML = `
        <span class="joined-hotels-badge">${total} Hotel${total > 1 ? 's' : ''}</span>
      `;
      }
    }

    // Generate part rows
    let partsHtml = '';
    for (let i = 0; i < numParts; i++) {
      const startIdx = i * CHUNK_SIZE;
      const endIdx = Math.min((i + 1) * CHUNK_SIZE, total);
      const count = endIdx - startIdx;
      const partHotels = uniqueHotels.slice(startIdx, endIdx);
      const joinedText = partHotels.join(',');
      const partNum = i + 1;

      if (numParts > 1) {
        partsHtml += `
        <div class="joined-hotels-part">
          <div class="joined-hotels-part-header">
            <span>Part ${partNum} (Hotels ${startIdx + 1}–${endIdx} · ${count} IDs)</span>
          </div>
          <div class="joined-hotels-body">
            <input type="text" class="joined-hotels-text" readonly value="${escapeHtml(joinedText)}" onclick="this.select()">
            <button class="btn btn-secondary btn-sm btn-copy-part" data-part="${partNum}" data-range="${startIdx + 1}–${endIdx}" data-count="${count}" title="Copy Part ${partNum}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span>Copy Part ${partNum}</span>
            </button>
          </div>
        </div>
      `;
      } else {
        partsHtml += `
        <div class="joined-hotels-body">
          <input type="text" id="joined-hotels-text" class="joined-hotels-text" readonly value="${escapeHtml(joinedText)}" onclick="this.select()">
          <button id="btn-copy-joined" class="btn btn-secondary btn-sm btn-copy-part" data-part="1" data-range="1–${total}" data-count="${total}" title="Copy to Clipboard">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span>Copy</span>
          </button>
        </div>
      `;
      }
    }

    container.innerHTML = partsHtml;
    joinedBox.style.display = 'block';
  }

  // Setup Event Listeners for Joined Hotels Box
  function setupJoinedHotelsListeners() {
    const joinedBox = document.getElementById('joined-hotels-box');
    if (!joinedBox) return;

    joinedBox.addEventListener('click', (e) => {
      // Check if Toggle Collapse / Expand button was clicked
      const toggleBtn = e.target.closest('#btn-toggle-joined-parts');
      if (toggleBtn) {
        const isCollapsed = joinedBox.classList.toggle('collapsed');
        const iconSvg = isCollapsed
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`;
        const numParts = toggleBtn.dataset.numParts || '';
        toggleBtn.innerHTML = `${iconSvg} <span class="toggle-text">${isCollapsed ? `Show Parts (${numParts})` : 'Collapse'}</span>`;
        return;
      }

      // Check if Copy All button was clicked
      const copyAllBtn = e.target.closest('#btn-copy-all-joined');
      if (copyAllBtn) {
        const uniqueHotels = Array.from(new Set(rulesState.map(row => (row.hotel_ID || '').toString().trim()).filter(Boolean)));
        const allText = uniqueHotels.join(',');
        navigator.clipboard.writeText(allText)
          .then(() => {
            showToast(`Copied all ${uniqueHotels.length} Joined Hotel IDs to clipboard!`, 'success');
          })
          .catch(err => {
            console.error('Failed to copy: ', err);
            showToast('Failed to copy. Please copy the text manually.', 'error');
          });
        return;
      }

      // Check if a Part Copy button was clicked
      const partBtn = e.target.closest('.btn-copy-part, #btn-copy-joined');
      if (partBtn) {
        const row = partBtn.closest('.joined-hotels-body');
        const input = row ? row.querySelector('.joined-hotels-text') : null;
        if (!input || !input.value) return;

        const partNum = partBtn.dataset.part;
        const range = partBtn.dataset.range;
        const count = partBtn.dataset.count;
        const isMultiPart = partNum && parseInt(partNum) > 1 || (document.querySelectorAll('.joined-hotels-part').length > 1);
        const label = isMultiPart ? `Part ${partNum} (${range} · ${count} IDs)` : 'Joined Hotel IDs';

        navigator.clipboard.writeText(input.value)
          .then(() => {
            showToast(`Copied ${label} to clipboard!`, 'success');
          })
          .catch(err => {
            console.error('Failed to copy: ', err);
            showToast('Failed to copy. Please copy the text manually.', 'error');
          });
      }
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
    const previewCard = document.querySelector('.preview-card');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = btn.dataset.tab;
        if (!targetTab) return; // Allow external navigation links to open in new tab

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

        // Handle layout for Landscape Mode tabs (TDF Dashboard, Hawkeye Rates, City Bulk)
        const dashContainer = document.querySelector('.dashboard-container');
        const sidebarCol = document.querySelector('.sidebar-column');
        const previewCard = document.querySelector('.preview-card');

        const isLandscape =
          targetTab === 'tab-dashboard' ||
          targetTab === 'tab-hawkeye-rates' ||
          targetTab === 'tab-city-bulk';

        if (isLandscape) {
          if (dashContainer) dashContainer.classList.add('landscape-mode');
          if (previewCard) previewCard.style.display = 'none';
          if (sidebarCol) sidebarCol.style.width = '100%';
          if (targetTab === 'tab-city-bulk') {
            populateCityBulkCityDropdown(false);
          }
        } else {
          if (dashContainer) dashContainer.classList.remove('landscape-mode');
          if (previewCard) previewCard.style.display = 'flex';
          if (sidebarCol) sidebarCol.style.width = '';
        }
      });
    });

    // Ensure default active tab initializes landscape mode immediately
    const activeBtn = document.querySelector('.sidebar-nav-menu .tab-btn.active');
    if (activeBtn && (activeBtn.dataset.tab === 'tab-dashboard' || activeBtn.dataset.tab === 'tab-hawkeye-rates' || activeBtn.dataset.tab === 'tab-city-bulk')) {
      const dashContainer = document.querySelector('.dashboard-container');
      const sidebarCol = document.querySelector('.sidebar-column');
      const previewCard = document.querySelector('.preview-card');
      if (dashContainer) dashContainer.classList.add('landscape-mode');
      if (previewCard) previewCard.style.display = 'none';
      if (sidebarCol) sidebarCol.style.width = '100%';
    }
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

    const splitMethodSelect = document.getElementById('split-method');
    const splitDirectContainer = document.getElementById('split-direct-container');
    const splitTargetContainer = document.getElementById('split-target-container');
    const splitDirectSunBehavior = document.getElementById('split-direct-sunday-behavior');
    const splitDirectSunWrapper = document.getElementById('split-direct-sunday-wrapper');
    const splitDirectWeekendBeh = document.getElementById('split-direct-weekend-behavior');
    const splitDirectFriWrapper = document.getElementById('split-direct-fri-wrapper') || document.getElementById('split-direct-fri-sat-wrapper');
    const splitDirectSatRow = document.getElementById('split-direct-saturday-row');
    const splitDirectSatBehavior = document.getElementById('split-direct-saturday-behavior');
    const splitDirectSatWrapper = document.getElementById('split-direct-sat-wrapper');
    const splitDirectSunRow = document.getElementById('split-direct-sunday-row');

    if (splitMethodSelect) {
      splitMethodSelect.addEventListener('change', () => {
        if (splitMethodSelect.value === 'direct') {
          if (splitDirectContainer) splitDirectContainer.style.display = 'block';
          if (splitTargetContainer) splitTargetContainer.style.display = 'none';
        } else {
          if (splitDirectContainer) splitDirectContainer.style.display = 'none';
          if (splitTargetContainer) splitTargetContainer.style.display = 'block';
        }
      });
    }

    const splitDirectMonThuWrapper = document.getElementById('split-direct-mon-thu-wrapper');

    if (splitDirectWeekendBeh) {
      const updateWeekendBehUI = () => {
        const val = splitDirectWeekendBeh.value;
        if (val === 'weekdays_only' || val === 'skip') {
          if (splitDirectMonThuWrapper?.style) splitDirectMonThuWrapper.style.display = 'block';
          if (splitDirectFriWrapper?.style) splitDirectFriWrapper.style.display = 'none';
          if (splitDirectSatRow?.style) splitDirectSatRow.style.display = 'none';
          if (splitDirectSunRow?.style) splitDirectSunRow.style.display = 'none';
        } else if (val === 'weekends_only') {
          if (splitDirectMonThuWrapper?.style) splitDirectMonThuWrapper.style.display = 'none';
          if (splitDirectFriWrapper?.style) splitDirectFriWrapper.style.display = 'block';
          if (splitDirectSatRow?.style) splitDirectSatRow.style.display = 'flex';
          if (splitDirectSunRow?.style) splitDirectSunRow.style.display = 'flex';
        } else {
          if (splitDirectMonThuWrapper?.style) splitDirectMonThuWrapper.style.display = 'block';
          if (splitDirectFriWrapper?.style) splitDirectFriWrapper.style.display = 'block';
          if (splitDirectSatRow?.style) splitDirectSatRow.style.display = 'flex';
          if (splitDirectSunRow?.style) splitDirectSunRow.style.display = 'flex';
        }
      };
      splitDirectWeekendBeh.addEventListener('change', updateWeekendBehUI);
      updateWeekendBehUI();
    }

    if (splitDirectSatBehavior) {
      splitDirectSatBehavior.addEventListener('change', () => {
        if (splitDirectSatBehavior.value === 'same') {
          if (splitDirectSatWrapper) splitDirectSatWrapper.style.display = 'none';
        } else {
          if (splitDirectSatWrapper) splitDirectSatWrapper.style.display = 'block';
        }
      });
    }

    if (splitDirectSunBehavior) {
      splitDirectSunBehavior.addEventListener('change', () => {
        if (splitDirectSunBehavior.value === 'skip') {
          if (splitDirectSunWrapper) splitDirectSunWrapper.style.display = 'none';
        } else {
          if (splitDirectSunWrapper) splitDirectSunWrapper.style.display = 'block';
        }
      });
    }

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
    if (splitSundayBehaviorSelect) {
      splitSundayBehaviorSelect.addEventListener('change', () => {
        const behavior = splitSundayBehaviorSelect.value;
        if (behavior === 'skip') {
          if (splitSundayTargetWrapper) splitSundayTargetWrapper.style.display = 'none';
        } else {
          if (splitSundayTargetWrapper) splitSundayTargetWrapper.style.display = 'block';
        }
        updateSplitMultipliersPreview();
      });
    }

    // Toggle Day Group Target visibility for Target Prices
    const splitTargetWeekendBeh = document.getElementById('split-target-weekend-behavior');
    const splitTargetMonThuWrapper = document.getElementById('split-target-mon-thu-wrapper');
    const splitTargetFriWrapper = document.getElementById('split-target-friday-wrapper');
    const splitTargetSatRow = document.getElementById('split-target-saturday-row');
    const splitTargetSunRow = document.getElementById('split-target-sunday-row');

    if (splitTargetWeekendBeh) {
      const updateTargetWeekendBehUI = () => {
        const val = splitTargetWeekendBeh.value;
        if (val === 'weekdays_only' || val === 'skip') {
          if (splitTargetMonThuWrapper?.style) splitTargetMonThuWrapper.style.display = 'block';
          if (splitTargetFriWrapper?.style) splitTargetFriWrapper.style.display = 'none';
          if (splitTargetSatRow?.style) splitTargetSatRow.style.display = 'none';
          if (splitTargetSunRow?.style) splitTargetSunRow.style.display = 'none';
        } else if (val === 'weekends_only') {
          if (splitTargetMonThuWrapper?.style) splitTargetMonThuWrapper.style.display = 'none';
          if (splitTargetFriWrapper?.style) splitTargetFriWrapper.style.display = 'block';
          if (splitTargetSatRow?.style) splitTargetSatRow.style.display = 'flex';
          if (splitTargetSunRow?.style) splitTargetSunRow.style.display = 'flex';
        } else {
          if (splitTargetMonThuWrapper?.style) splitTargetMonThuWrapper.style.display = 'block';
          if (splitTargetFriWrapper?.style) splitTargetFriWrapper.style.display = 'block';
          if (splitTargetSatRow?.style) splitTargetSatRow.style.display = 'flex';
          if (splitTargetSunRow?.style) splitTargetSunRow.style.display = 'flex';
        }
        updateSplitMultipliersPreview();
      };
      splitTargetWeekendBeh.addEventListener('change', updateTargetWeekendBehUI);
      updateTargetWeekendBehUI();
    }

    const splitInputs = [
      splitBasePriceInput,
      splitFlexibilitySelect,
      splitTargetWeekendBeh,
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

    const targetWeekendBehEl = document.getElementById('split-target-weekend-behavior');
    const targetWeekendBeh = targetWeekendBehEl ? targetWeekendBehEl.value : 'include';

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

    if (previewWdText) {
      if (targetWeekendBeh === 'weekends_only') {
        previewWdText.textContent = 'Skipped';
      } else {
        previewWdText.textContent = calculateSplitMultiplier(wdTarget);
      }
    }

    if (previewFrText) {
      if (targetWeekendBeh === 'weekdays_only' || targetWeekendBeh === 'skip') {
        previewFrText.textContent = 'Skipped';
      } else {
        previewFrText.textContent = calculateSplitMultiplier(frTarget);
      }
    }

    if (previewSaText) {
      if (targetWeekendBeh === 'weekdays_only' || targetWeekendBeh === 'skip') {
        previewSaText.textContent = 'Skipped';
      } else {
        previewSaText.textContent = calculateSplitMultiplier(saTarget);
      }
    }

    if (previewSuText) {
      if (targetWeekendBeh === 'weekdays_only' || targetWeekendBeh === 'skip' || suBehavior === 'skip') {
        previewSuText.textContent = 'Skipped';
      } else {
        previewSuText.textContent = calculateSplitMultiplier(suTarget);
      }
    }
  }

  // Initialize App Listeners
  setupTabs();
  setupPricingModeListeners();
  setupBlackoutCalendar();

  // ==========================================================================
  // BLACKOUT INTEL / BLACKOUT SUMMARY CALENDAR LOGIC
  // ==========================================================================
  let currentCalYear = 2026;
  let currentCalMonth = 7; // 0-indexed: 7 is August

  // Blackout Events Dataset (Initializes clean & empty)
  const blackoutEventsData = [];

  function setupBlackoutCalendar() {
    const btnCalendarView = document.getElementById('btn-view-calendar');
    const btnListView = document.getElementById('btn-view-list');
    const panelCalendar = document.getElementById('panel-calendar-view');
    const panelList = document.getElementById('panel-list-view');

    const btnPrevMonth = document.getElementById('btn-prev-month');
    const btnNextMonth = document.getElementById('btn-next-month');

    if (btnCalendarView && btnListView) {
      btnCalendarView.addEventListener('click', () => {
        btnCalendarView.classList.add('active');
        btnListView.classList.remove('active');
        panelCalendar.style.display = 'block';
        panelList.style.display = 'none';
      });

      btnListView.addEventListener('click', () => {
        btnListView.classList.add('active');
        btnCalendarView.classList.remove('active');
        panelCalendar.style.display = 'none';
        panelList.style.display = 'block';
        renderBlackoutListView();
      });
    }

    if (btnPrevMonth && btnNextMonth) {
      btnPrevMonth.addEventListener('click', () => {
        currentCalMonth--;
        if (currentCalMonth < 0) {
          currentCalMonth = 11;
          currentCalYear--;
        }
        renderBlackoutCalendar(currentCalYear, currentCalMonth);
      });

      btnNextMonth.addEventListener('click', () => {
        currentCalMonth++;
        if (currentCalMonth > 11) {
          currentCalMonth = 0;
          currentCalYear++;
        }
        renderBlackoutCalendar(currentCalYear, currentCalMonth);
      });
    }

    // Filter Selects
    const filterIds = ['filter-region', 'filter-state', 'filter-city', 'filter-category', 'filter-hotel'];
    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          renderBlackoutCalendar(currentCalYear, currentCalMonth);
          renderBlackoutListView();
        });
      }
    });
  }

  function renderBlackoutCalendar(year, month) {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const headingEl = document.getElementById('current-month-heading');
    if (headingEl) {
      headingEl.textContent = `${monthNames[month]} ${year}`;
    }

    const cellsGrid = document.getElementById('calendar-cells-grid');
    if (!cellsGrid) return;

    cellsGrid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay(); // Day of week (0=Sun, 6=Sat)
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Read filter values
    const filterRegion = document.getElementById('filter-region')?.value || 'all';
    const filterCategory = document.getElementById('filter-category')?.value || 'all';

    // Render blank padding cells for previous month
    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'calendar-cell';
      emptyCell.style.opacity = '0.3';
      cellsGrid.appendChild(emptyCell);
    }

    // Render day cells 1..totalDays
    for (let d = 1; d <= totalDays; d++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-cell';

      const dayNum = document.createElement('span');
      dayNum.className = 'cell-day-num';
      dayNum.textContent = d;
      cell.appendChild(dayNum);

      // Find event for this day (only in August 2026 for demo matching screenshot)
      if (month === 7 && year === 2026) {
        const event = blackoutEventsData.find(e => e.day === d);
        if (event) {
          let matchesFilter = true;
          if (filterRegion !== 'all' && event.region !== filterRegion) matchesFilter = false;
          if (filterCategory !== 'all' && event.category !== filterCategory) matchesFilter = false;

          if (matchesFilter) {
            cell.classList.add('has-event');
            const chip = document.createElement('div');
            chip.className = `event-chip ${event.type}`;
            chip.innerHTML = `<span>${event.title}</span>`;
            cell.appendChild(chip);

            cell.addEventListener('click', () => {
              if (typeof showToast === 'function') {
                showToast(`August ${d}, 2026: ${event.title} - ${event.hotel}`, 'info');
              }
            });
          }
        }
      }

      cellsGrid.appendChild(cell);
    }
  }

  function renderBlackoutListView() {
    const tableBody = document.getElementById('blackout-table-body');
    if (!tableBody) return;

    const filterCategory = document.getElementById('filter-category')?.value || 'all';
    tableBody.innerHTML = '';

    const filtered = blackoutEventsData.filter(e => {
      if (filterCategory !== 'all' && e.category !== filterCategory) return false;
      return true;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#94a3b8;">No blackout events match filters</td></tr>`;
      return;
    }

    filtered.forEach(e => {
      const dateStr = `2026-08-${String(e.day).padStart(2, '0')}`;
      tableBody.innerHTML += `
      <tr>
        <td><strong>${dateStr}</strong></td>
        <td>${e.title}</td>
        <td><span class="event-chip ${e.type}" style="display:inline-block;">${e.category}</span></td>
        <td>${e.hotel}</td>
        <td>${e.city}</td>
        <td>₹${e.price}</td>
        <td><span style="color:#10b981; font-weight:600;">Active</span></td>
      </tr>
    `;
    });
  }

  // ==============================================================================
  // TDF PERFORMANCE DASHBOARD WEB APPLICATION ENGINE
  // ==============================================================================

  let dashboardState = [];
  let rawOccData = null;
  let rawFactorData = null;

  document.addEventListener('DOMContentLoaded', () => {
    setupDashboardEvents();
  });

  function setupDashboardEvents() {
    const btnLoadLocal = document.getElementById('btn-load-workspace-csv');
    const searchInput = document.getElementById('dash-search-input');
    const filterOpzone = document.getElementById('dash-filter-opzone');
    const filterSegment = document.getElementById('dash-filter-segment');
    const filterStrategy = document.getElementById('dash-filter-strategy');
    const btnGenHawkeye = document.getElementById('btn-generate-hawkeye-from-dash');

    if (btnLoadLocal) {
      btnLoadLocal.addEventListener('click', autoLoadWorkspaceDatasets);
    }

    const handleFilterChange = () => {
      renderDashTable();
      if (document.getElementById('dash-panel-calendar-view')?.style.display !== 'none') {
        renderPortfolioDashboardCalendar();
      }
    };

    if (searchInput) searchInput.addEventListener('input', handleFilterChange);
    if (filterOpzone) filterOpzone.addEventListener('change', handleFilterChange);
    if (filterSegment) filterSegment.addEventListener('change', handleFilterChange);
    if (filterStrategy) filterStrategy.addEventListener('change', handleFilterChange);
    const filterFlex = document.getElementById('dash-filter-flex');
    if (filterFlex) filterFlex.addEventListener('change', handleFilterChange);

    if (btnGenHawkeye) {
      btnGenHawkeye.addEventListener('click', generateHawkeyeRulesFromDash);
    }

    // Toggle Summary Section (Collapse KPI & OpZone Cards for Vertical Space)
    const btnToggleSummary = document.getElementById('btn-toggle-summary');
    const summarySection = document.getElementById('dash-summary-section');
    const btnToggleSummaryText = document.getElementById('btn-toggle-summary-text');

    if (btnToggleSummary && summarySection) {
      btnToggleSummary.addEventListener('click', () => {
        const isCollapsed = summarySection.style.display === 'none';
        if (isCollapsed) {
          summarySection.style.display = 'block';
          if (btnToggleSummaryText) btnToggleSummaryText.textContent = 'Collapse Stats';
          btnToggleSummary.classList.remove('btn-accent');
          btnToggleSummary.classList.add('btn-secondary');
        } else {
          summarySection.style.display = 'none';
          if (btnToggleSummaryText) btnToggleSummaryText.textContent = 'Show Stats';
          btnToggleSummary.classList.remove('btn-secondary');
          btnToggleSummary.classList.add('btn-accent');
        }
      });
    }

    // Toggle Screen Fit / Compact Density Mode
    const btnToggleDensity = document.getElementById('btn-toggle-density');
    const btnDensityText = document.getElementById('btn-toggle-density-text');
    if (btnToggleDensity) {
      btnToggleDensity.addEventListener('click', () => {
        const tabDash = document.getElementById('tab-dashboard');
        if (!tabDash) return;
        const isCompact = tabDash.classList.toggle('compact-density-mode');
        if (btnDensityText) {
          btnDensityText.textContent = isCompact ? 'Normal View' : 'Fit Screen View';
        }
        btnToggleDensity.classList.toggle('btn-accent', isCompact);
        btnToggleDensity.classList.toggle('btn-secondary', !isCompact);
      });
    }

    setupDateFilterDropdown();
    setupDashboardViewToggle();
  }

  // Auto-Load Workspace Datasets via fetch()
  async function autoLoadWorkspaceDatasets() {
    showToast('Connecting to Google Sheets...', 'info');

    try {
      const isFileProtocol = window.location.protocol === 'file:';
      let apiUrl = isFileProtocol ? 'http://localhost:3000/api/sheet-data' : '/api/sheet-data';
      let authUrl = isFileProtocol ? 'http://localhost:3000/auth/google' : '/auth/google';

      let response;
      try {
        response = await fetch(apiUrl);
      } catch (fetchErr) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          apiUrl = 'http://localhost:3000/api/sheet-data';
          authUrl = 'http://localhost:3000/auth/google';
          try {
            response = await fetch(apiUrl);
          } catch (retryErr) {
            console.warn('Local API unreachable, attempting production fallback...');
          }
        } else {
          throw fetchErr;
        }
      }

      // If local server returned 401 or was unreachable, fallback directly to production endpoint
      if ((!response || response.status === 401 || !response.ok) && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || isFileProtocol)) {
        try {
          console.log('Local endpoint returned status', response?.status, 'Attempting fallback to live production endpoint...');
          const prodResponse = await fetch('https://tdf-automator.vercel.app/api/sheet-data');
          if (prodResponse.ok) {
            response = prodResponse;
          }
        } catch (prodErr) {
          console.warn('Production fallback failed:', prodErr);
        }
      }

      if (!response) {
        throw new Error('Unable to connect to sheet data service');
      }

      const result = await response.json();

      // Google authentication is required
      if (response.status === 401) {
        showToast('Please login with Google first.', 'warning');

        window.open(authUrl, '_blank');

        return;
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch Google Sheets data');
      }

      const futureOccRows = result.data.futureOcc || [];
      const factorRows = result.data.next10DaysFactors || [];
      const rateFlexRows = result.data.rateFlex || [];
      const benchmarkOccRows = result.data.benchmarkOcc || [];
      const channelRNsRows = result.data.channelRNs || [];
      const futureRatesRows = result.data.futureRates || [];
      const hawkeyeBaseRatesRows = result.data.hawkeyeBaseRates || [];

      console.log('Google Sheets data received:');
      console.log('Future Occ rows:', futureOccRows.length);
      console.log('Factor rows:', factorRows.length);
      console.log('Rate Flex rows:', rateFlexRows.length);
      console.log('Benchmark Occ rows:', benchmarkOccRows.length);
      console.log('Channel RNs rows:', channelRNsRows.length);
      console.log('Future Rates rows:', futureRatesRows.length);
      console.log('Hawkeye Base Rates rows:', hawkeyeBaseRatesRows.length);

      if (hawkeyeBaseRatesRows.length > 0) {
        loadHawkeyeBaseRatesData(hawkeyeBaseRatesRows);
      }

      // Convert Google Sheets arrays into CSV text.
      // This lets us keep your existing dashboard processing logic unchanged.
      const rowsToCsv = (rows) => {
        return rows
          .map(row =>
            row.map(value => {
              const text = String(value ?? '');
              return `"${text.replace(/"/g, '""')}"`;
            }).join(',')
          )
          .join('\n');
      };

      const occText = rowsToCsv(futureOccRows);
      const facText = rowsToCsv(factorRows);
      const flexText = rowsToCsv(rateFlexRows);
      const benchText = rowsToCsv(benchmarkOccRows);
      const channelText = rowsToCsv(channelRNsRows);
      const futureRatesText = rowsToCsv(futureRatesRows);

      // Use the existing dashboard processing engine
      parseAndProcessDashboardData(
        occText,
        facText,
        flexText,
        benchText,
        channelText,
        futureRatesText
      );

      showToast(
        `Loaded live Google Sheets data: ${futureOccRows.length - 1} occ rows, ${futureRatesRows.length - 1} future rate rows, ${hawkeyeBaseRatesRows.length > 1 ? `${hawkeyeBaseRatesRows.length - 1} Hawkeye properties, ` : ''}${benchmarkOccRows.length - 1} benchmark rows.`,
        'success'
      );

    } catch (err) {

      console.error('Google Sheets loading error:', err);

      showToast(
        `Error loading Google Sheets data: ${err.message}`,
        'danger'
      );
    }
  }

  // Helper: Formats CS ID to 7-digit padded string
  function padCSId7Digit(idStr) {
    if (!idStr && idStr !== 0) return '';
    let cleaned = String(idStr).replace(/\.0$/, '').trim();
    if (cleaned && !isNaN(cleaned)) {
      while (cleaned.length < 7) {
        cleaned = '0' + cleaned;
      }
    }
    return cleaned;
  }

  // Helper: Normalizes any date format (YYYY-MM-DD, M/D/YYYY, Excel serial, etc.) to YYYYMMDD
  function normalizeDateToYYYYMMDD(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    if (/^\d{2}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) {
      const parts = s.split(/[-/]/);
      const yr = Number(parts[0]) > 50 ? '19' + parts[0] : '20' + parts[0];
      return yr + parts[1].padStart(2, '0') + parts[2].padStart(2, '0');
    }
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) {
      const parts = s.split(/[-/]/);
      return parts[0] + parts[1].padStart(2, '0') + parts[2].padStart(2, '0');
    }
    if (!isNaN(s) && Number(s) > 40000 && Number(s) < 60000) {
      const d = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
      return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0');
    }
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      return dt.getFullYear() + String(dt.getMonth() + 1).padStart(2, '0') + String(dt.getDate()).padStart(2, '0');
    }
    return s.replace(/[-/]/g, '').substring(0, 8);
  }

  // Fast CSV Parser
  function parseCsvSimple(text) {
    if (!text) return [];
    const lines = text.split(/\r?\n/);
    return lines.map(line => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          result.push(cur.trim().replace(/^"|"$/g, ''));
          cur = '';
        } else cur += char;
      }
      result.push(cur.trim().replace(/^"|"$/g, ''));
      return result;
    });
  }

  // Helper: Normalizes City Category to standard 5 categories: Mixed, Tier-1 Business, Tier-2 Business, Winter Leisure, Summer Leisure
  function normalizeCityCategory(rawType) {
    if (!rawType) return 'Mixed';
    const str = String(rawType).trim();
    const lower = str.toLowerCase();

    if (lower.includes('tier-1') || lower.includes('tier 1')) return 'Tier-1 Business';
    if (lower.includes('tier-2') || lower.includes('tier 2')) return 'Tier-2 Business';
    if (lower.includes('summer')) return 'Summer Leisure';
    if (lower.includes('winter')) return 'Winter Leisure';
    if (lower.includes('mixed')) return 'Mixed';
    return str || 'Mixed';
  }

  // Helper: Cleans hotel name by stripping descriptive suffixes (e.g. ', Mall Road', 'With Swimming Pool')
  function getCleanBaseName(name) {
    if (!name) return '';
    let str = String(name).toLowerCase().trim();
    str = str.split(',')[0];
    str = str.split(' with ')[0];
    str = str.split(' near ')[0];
    str = str.split(' - ')[0];
    return str.trim();
  }

  // Explicit list of misclassified Partner, SOB, and ARR contract hotels to exclude ("dont show them")
  const EXCLUDED_SPECIAL_HOTELS = [
    'treebo lazystay elite',
    'treebo y hotels elite, khandagiri',
    'treebo the aura',
    'treebo sunheads',
    'treebo five elements, lonavala',
    'treebo jp cottage',
    'treebo winter town venna lake',
    'treebo nakshatra cottages mahabaleshwar',
    'treebo anam international',
    'treebo divine stay prayagraj',
    'treebo premium landmark prayagraj',
    'treebo bridge view regency, mall road'
  ];

  // Parse and process datasets (Only LIVE properties)
  function parseAndProcessDashboardData(occText, facText, flexText, benchText, channelText, futureRatesText) {
    const occRows = parseCsvSimple(occText);
    const facRows = facText ? parseCsvSimple(facText) : [];
    const flexRows = flexText ? parseCsvSimple(flexText) : [];
    const benchRows = benchText ? parseCsvSimple(benchText) : [];
    const channelRows = channelText ? parseCsvSimple(channelText) : [];
    const futureRatesRows = futureRatesText ? parseCsvSimple(futureRatesText) : [];

    // 1. Build Rate Flex & Status Map with dynamic header resolution (Master Property Metadata)
    const rateFlexMap = {};
    if (flexRows.length > 0) {
      const header = flexRows[0];
      let colHotelId = 0, colHx = 1, colCs = 2, colName = 3, colCity = 4, colRegion = 5, colCityType = 6, colStatus = 8, colPretaxFloor = 9, colCurrentSku = 17, colFlex = 11;
      header.forEach((h, idx) => {
        const hStr = h.toLowerCase().trim();
        if (hStr === 'hotel id' || hStr === 'hotel_id' || hStr === 'hotelid') colHotelId = idx;
        else if (hStr === 'hx_id' || hStr === 'hx id') colHx = idx;
        else if (hStr === 'cs_id' || hStr === 'cs id') colCs = idx;
        else if (hStr === 'hotel name' || hStr === 'name') colName = idx;
        else if (hStr === 'city') colCity = idx;
        else if (hStr === 'region' || hStr === 'op zone' || hStr === 'zone') colRegion = idx;
        else if (hStr.includes('city type') || hStr.includes('city_type') || hStr.includes('category')) colCityType = idx;
        else if (hStr === 'status' || hStr.includes('status')) colStatus = idx;
        else if (hStr.includes('pretax_floors') || hStr.includes('pretax floor')) colPretaxFloor = idx;
        else if (hStr.includes('current pretax sku')) colCurrentSku = idx;
        else if (hStr.includes('flex')) colFlex = idx;
      });

      for (let f = 1; f < flexRows.length; f++) {
        const fRow = flexRows[f];
        if (!fRow || fRow.length < 3) continue;
        const hotelId = String(fRow[colHotelId] || '').replace(/\.0$/, '').trim();
        const hxId = String(fRow[colHx] || '').replace(/\.0$/, '').trim();
        const rawCs = String(fRow[colCs] || '').replace(/\.0$/, '').trim();
        const csId = padCSId7Digit(rawCs);
        const rawName = String(fRow[colName] || '').trim();
        const hName = rawName.toLowerCase();
        const baseName = getCleanBaseName(hName);
        const city = String(fRow[colCity] || '').trim();
        const region = String(fRow[colRegion] || '').trim();
        const cityType = normalizeCityCategory(fRow[colCityType]);
        const status = String(fRow[colStatus] || '').trim().toLowerCase();
        const flexVal = String(fRow[colFlex] || 'Flex').trim();

        const pretaxFloorVal = parseFloat(String(fRow[colPretaxFloor] || '0').replace(/,/g, '')) || 0;
        const currentSkuVal = parseFloat(String(fRow[colCurrentSku] || '0').replace(/,/g, '')) || 0;
        const basePrice = pretaxFloorVal > 0 ? pretaxFloorVal : (currentSkuVal > 0 ? currentSkuVal : 1500);

        const item = { hotelId, csId, rawCs, hxId, rawName, hName, city, region, cityType, flex: flexVal, status: status, basePrice: basePrice };
        if (hotelId) rateFlexMap[hotelId] = item;
        if (hxId) rateFlexMap[hxId] = item;
        if (csId) rateFlexMap[csId] = item;
        if (rawCs) rateFlexMap[rawCs] = item;
        if (hName) rateFlexMap[hName] = item;
        if (baseName) rateFlexMap[baseName] = item;
      }
    }

    // 2. Build Factors Map with dynamic header resolution
    const factorMap = {};
    const factorDateCols = {};

    if (facRows.length > 0) {
      const fHeaders = facRows[0];
      let colCs = 0, colHx = 1, colName = 2, colCity = 3, colSeg = 4, colZone = 5;
      fHeaders.forEach((h, idx) => {
        const hStr = h.toLowerCase().trim();
        if (hStr === 'cs id' || hStr === 'cs_id') colCs = idx;
        else if (hStr === 'hx_id' || hStr === 'hx id') colHx = idx;
        else if (hStr === 'hotel name' || hStr === 'name') colName = idx;
        else if (hStr === 'city') colCity = idx;
        else if (hStr.includes('segment')) colSeg = idx;
        else if (hStr.includes('zone') || hStr.includes('region')) colZone = idx;

        const dateKey = parseHeaderToYYYYMMDD(h);
        if (dateKey) {
          factorDateCols[dateKey] = idx;
        }
        factorDateCols[h.trim()] = idx;
      });

      for (let f = 1; f < facRows.length; f++) {
        const fRow = facRows[f];
        if (!fRow || fRow.length < 3) continue;

        const csId = padCSId7Digit(fRow[colCs]);
        const hxId = String(fRow[colHx] || '').replace(/\.0$/, '').trim();
        const hName = String(fRow[colName] || '').toLowerCase().trim();
        const baseName = getCleanBaseName(hName);
        const city = String(fRow[colCity] || 'Unknown').trim();
        const revSegment = String(fRow[colSeg] || 'Standard').trim();
        const opZone = String(fRow[colZone] || 'Unknown').trim();

        const item = { csId, hxId, city, revSegment, opZone, row: fRow };
        if (hxId) factorMap[hxId] = item;
        if (csId) factorMap[csId] = item;
        if (hName) factorMap[hName] = item;
        if (baseName) factorMap[baseName] = item;
      }
    }

    // 3. Build Benchmark Occ Map with dynamic header resolution (from 'Benchmark Occ' tab)
    const benchmarkOccMap = {};
    if (benchRows.length > 0) {
      const bHeader = benchRows[0];
      let colBCs = 0, colBDate = 3, colBPct = 6, colBHotel = 1;
      bHeader.forEach((h, idx) => {
        const hStr = h.toLowerCase().trim();
        if (hStr === 'cs id' || hStr === 'cs_id' || hStr === 'csid') colBCs = idx;
        else if (hStr === 'stay_date' || hStr === 'stay date' || hStr === 'date') colBDate = idx;
        else if (hStr === 'benchmark_pct' || hStr.includes('benchmark')) colBPct = idx;
        else if (hStr === 'hotel_name' || hStr.includes('hotel')) colBHotel = idx;
      });

      for (let b = 1; b < benchRows.length; b++) {
        const bRow = benchRows[b];
        if (!bRow || bRow.length <= colBDate) continue;

        const rawCs = String(bRow[colBCs] || '').trim();
        const rawDate = String(bRow[colBDate] || '').trim();
        const rawPct = String(bRow[colBPct] || '').trim();
        if (!rawDate) continue;

        const dateKey = rawDate.replace(/[-/]/g, '').substring(0, 8);
        let val = parseFloat(rawPct.replace('%', ''));
        if (isNaN(val)) {
          val = null;
        } else if (val > 0 && val <= 1.0) {
          val = val * 100;
        }
        const display = (val !== null) ? `${val.toFixed(1)}%` : '-';
        const item = { val, display, raw: rawPct };

        if (rawCs) {
          const cleanId = String(parseInt(rawCs) || rawCs);
          const paddedCs = padCSId7Digit(rawCs);
          benchmarkOccMap[`${paddedCs}_${dateKey}`] = item;
          benchmarkOccMap[`${cleanId}_${dateKey}`] = item;
        }
        const hotelName = String(bRow[colBHotel] || '').trim().toLowerCase();
        if (hotelName) {
          benchmarkOccMap[`${hotelName}_${dateKey}`] = item;
          const baseName = getCleanBaseName(hotelName);
          if (baseName) benchmarkOccMap[`${baseName}_${dateKey}`] = item;
        }
      }
    }

    // 4. Build Channel RNs Map with dynamic header resolution (from 'Channel RNs' tab)
    const channelRNMap = {};
    if (channelRows.length > 0) {
      const cHeader = channelRows[0];
      let colCCs = 0, colCDate = 1, colCWalkin = 2, colCTreebo = 3, colCB2B = 6;
      cHeader.forEach((h, idx) => {
        const hStr = h.toLowerCase().trim();
        if (hStr === 'cs id' || hStr === 'cs_id' || hStr === 'csid' || hStr === 'id_hotel' || hStr === 'hotel_id') colCCs = idx;
        else if (hStr === 'stay_date' || hStr === 'stay date' || hStr === 'date') colCDate = idx;
        else if (hStr === 'walkin_rn' || hStr === 'walkin rn' || hStr === 'walking_rn' || hStr === 'walkin') colCWalkin = idx;
        else if (hStr === 'treebo_rn' || hStr === 'treebo rn' || hStr === 'treebo') colCTreebo = idx;
        else if (hStr === 'b2b_rn' || hStr === 'b2b rn' || hStr === 'b2b') colCB2B = idx;
      });

      for (let c = 1; c < channelRows.length; c++) {
        const cRow = channelRows[c];
        if (!cRow || cRow.length <= colCDate) continue;

        const rawCs = String(cRow[colCCs] || '').trim();
        const rawDate = String(cRow[colCDate] || '').trim();
        if (!rawDate) continue;

        const dateKey = normalizeDateToYYYYMMDD(rawDate);
        if (!dateKey) continue;

        const walkinRN = parseFloat(String(cRow[colCWalkin] || '0').replace(/,/g, '')) || 0;
        const treeboRN = parseFloat(String(cRow[colCTreebo] || '0').replace(/,/g, '')) || 0;
        const b2bRN = parseFloat(String(cRow[colCB2B] || '0').replace(/,/g, '')) || 0;

        // Walking share = walkin_rn / (walkin_rn + treebo_rn)
        // B2B share = b2b_rn / (walkin_rn + treebo_rn)
        const totalRN = walkinRN + treeboRN;
        const walkingShare = totalRN > 0 ? (walkinRN / totalRN) * 100 : 0;
        const b2bShare = totalRN > 0 ? (b2bRN / totalRN) * 100 : 0;

        const item = {
          walkinRN,
          treeboRN,
          b2bRN,
          totalRN,
          walkingShare,
          b2bShare
        };

        if (rawCs) {
          const cleanId = String(parseInt(rawCs) || rawCs);
          const paddedCs = padCSId7Digit(rawCs);
          channelRNMap[`${paddedCs}_${dateKey}`] = item;
          channelRNMap[`${cleanId}_${dateKey}`] = item;
        }
      }
    }

    // 3. Build Future Rates Map (Pushed Price & Factor from Future rates tab)
    const futureRatesMap = {};
    if (futureRatesRows.length > 0) {
      const frHeader = futureRatesRows[0];
      let colProp = 0, colDate = 1, colFactor = 2, colPrice = 3;
      frHeader.forEach((h, idx) => {
        const hStr = h.toLowerCase().trim();
        if (hStr.includes('property') || hStr.includes('hotel') || hStr.includes('cs')) colProp = idx;
        else if (hStr.includes('stay') || hStr.includes('date')) colDate = idx;
        else if (hStr.includes('factor')) colFactor = idx;
        else if (hStr.includes('price') || hStr.includes('rate') || hStr.includes('pushed')) colPrice = idx;
      });

      for (let f = 1; f < futureRatesRows.length; f++) {
        const frRow = futureRatesRows[f];
        if (!frRow || frRow.length < 2) continue;
        const rawProp = String(frRow[colProp] || '').replace(/\.0$/, '').trim();
        if (!rawProp) continue;
        const cleanId = String(parseInt(rawProp) || rawProp);
        const paddedCs = padCSId7Digit(rawProp);
        const rawDate = String(frRow[colDate] || '').trim();
        const normDate = normalizeDateToYYYYMMDD(rawDate);
        const priceVal = parseFloat(String(frRow[colPrice] || '').replace(/,/g, ''));
        const factorVal = parseFloat(String(frRow[colFactor] || '').trim());

        const item = {
          pushedPrice: (!isNaN(priceVal) && priceVal > 0) ? Math.round(priceVal) : null,
          factor: (!isNaN(factorVal) && factorVal > 0) ? factorVal : null
        };

        if (normDate) {
          futureRatesMap[`${cleanId}_${normDate}`] = item;
          futureRatesMap[`${paddedCs}_${normDate}`] = item;
        }
        if (rawDate) {
          futureRatesMap[`${cleanId}_${rawDate}`] = item;
          futureRatesMap[`${paddedCs}_${rawDate}`] = item;
        }
      }
    }

    const CITY_OPZONE_MAP = {
      // East
      'kolkata': 'East', 'sealdah': 'East', 'ranchi': 'East', 'patna': 'East', 'bhubaneswar': 'East', 'guwahati': 'East', 'siliguri': 'East', 'gangtok': 'East', 'howrah': 'East', 'durgapur': 'East', 'park circus': 'East', 'kalighat': 'East', 'rabindra sarobar': 'East', 'marine drive': 'East',
      // West
      'pune': 'West', 'mumbai': 'West', 'vashi': 'West', 'indore': 'West', 'surat': 'West', 'nagpur': 'West', 'goa': 'West', 'calangute': 'West', 'morjim': 'West', 'nashik': 'West', 'aurangabad': 'West', 'rajkot': 'West', 'vadodara': 'West', 'satara': 'West', 'bkc': 'West', 'hinjewadi': 'West', 'hadapsar': 'West', 'viman nagar': 'West', 'pench': 'West', 'seaside': 'West', 'water park': 'West',
      // South 1
      'bangalore': 'South 1', 'bengaluru': 'South 1', 'mangalore': 'South 1', 'mysore': 'South 1', 'mysuru': 'South 1', 'hubli': 'South 1', 'belgaum': 'South 1', 'koramangala': 'South 1', 'indiranagar': 'South 1', 'bommasandra': 'South 1', 'yeshwanthpur': 'South 1', 'lalbagh': 'South 1', 'itpl': 'South 1', 'marathahalli': 'South 1', 'bellandur': 'South 1', 'shrey': 'South 1',
      // South 2
      'chennai': 'South 2', 'hyderabad': 'South 2', 'coimbatore': 'South 2', 'pondicherry': 'South 2', 'puducherry': 'South 2', 'kochi': 'South 2', 'cochin': 'South 2', 'trivandrum': 'South 2', 'thiruvananthapuram': 'South 2', 'madikeri': 'South 2', 'coorg': 'South 2', 'vijayawada': 'South 2', 'vizag': 'South 2', 'visakhapatnam': 'South 2', 'ooty': 'South 2', 'kodaikanal': 'South 2', 'tirupati': 'South 2', 'alleppey': 'South 2', 'alappuzha': 'South 2', 'yelagiri': 'South 2', 'alandur': 'South 2', 'nungambakkam': 'South 2', 'rk beach': 'South 2', 'rushikonda': 'South 2', 'rock beach': 'South 2', 'hi-tech city': 'South 2', 'khairatabad': 'South 2', 'aiswaryam': 'South 2', 'umaiyyal': 'South 2',
      // North 1
      'ahmedabad': 'North 1', 'delhi': 'North 1', 'new delhi': 'North 1', 'gurgaon': 'North 1', 'gurugram': 'North 1', 'noida': 'North 1', 'jaipur': 'North 1', 'lucknow': 'North 1', 'prayagraj': 'North 1', 'allahabad': 'North 1', 'agra': 'North 1', 'kanpur': 'North 1', 'varanasi': 'North 1', 'ghaziabad': 'North 1', 'gwalior': 'North 1', 'jodhpur': 'North 1', 'udaipur': 'North 1', 'jalmahal': 'North 1', 'singapore mall': 'North 1', '32 milestone': 'North 1', 'accent park': 'North 1', 'citi international': 'North 1',
      // North 2
      'shimla': 'North 2', 'dharamshala': 'North 2', 'amritsar': 'North 2', 'dehradun': 'North 2', 'chandigarh': 'North 2', 'zirakpur': 'North 2', 'manali': 'North 2', 'mussoorie': 'North 2', 'rishikesh': 'North 2', 'haridwar': 'North 2', 'kasauli': 'North 2', 'solan': 'North 2', 'dalhousie': 'North 2', 'mohali': 'North 2', 'panchkula': 'North 2', 'mcleodganj': 'North 2', 'queen of hills': 'North 2', 'blue mountain': 'North 2', 'grand legacy': 'North 2', 'misty garden': 'North 2', 'winsome': 'North 2', 'mountain view': 'North 2', 'samsara': 'North 2'
    };

    // Helper: Resolves OpZone ensuring North is cleanly split into North 1 and North 2, and auto-resolving unassigned properties
    function resolveOpZone(city, hName, flexRegion, factorOpZone) {
      if (flexRegion && flexRegion.trim() !== '' && flexRegion !== 'Unknown' && flexRegion !== 'Unassigned') {
        const fTrim = flexRegion.trim();
        if (fTrim === 'North') {
          const c = ((city || '') + ' ' + (hName || '')).toLowerCase();
          const n2Cities = ['dharamshala', 'dehradun', 'shimla', 'amritsar', 'chandigarh', 'zirakpur', 'mussoorie', 'rishikesh', 'haridwar', 'manali', 'kasauli', 'solan', 'dalhousie', 'mohali', 'panchkula', 'mcleodganj'];
          return n2Cities.some(n2 => c.includes(n2)) ? 'North 2' : 'North 1';
        }
        return fTrim;
      }

      let zone = factorOpZone || '';
      if (zone && zone !== 'Unassigned' && zone !== 'Unknown') {
        if (zone === 'North') {
          const c = ((city || '') + ' ' + (hName || '')).toLowerCase();
          const n2Cities = ['dharamshala', 'dehradun', 'shimla', 'amritsar', 'chandigarh', 'zirakpur', 'mussoorie', 'rishikesh', 'haridwar', 'manali', 'kasauli', 'solan', 'dalhousie', 'mohali', 'panchkula', 'mcleodganj'];
          return n2Cities.some(n2 => c.includes(n2)) ? 'North 2' : 'North 1';
        }
        return zone;
      }

      const searchStr = ((city || '') + ' ' + (hName || '')).toLowerCase();
      for (const [key, val] of Object.entries(CITY_OPZONE_MAP)) {
        if (searchStr.includes(key)) {
          return val;
        }
      }

      return 'Unassigned';
    }

    // 3. Parse Occupancy Rows
    // Dynamic rolling 10-day window:
    // Today + next 9 days
    const today = new Date();

    // Normalize to local midnight so time-of-day does not affect comparisons.
    today.setHours(0, 0, 0, 0);

    const todayStr =
      `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 9);

    const maxDateStr =
      `${maxDate.getFullYear()}${String(maxDate.getMonth() + 1).padStart(2, '0')}${String(maxDate.getDate()).padStart(2, '0')}`;
    console.log(
      `Dashboard date window: ${todayStr} → ${maxDateStr}`
    );

    dashboardState = [];

    const uniqueHotels = new Set();
    const uniqueCities = new Set();
    const opZoneStats = {};

    for (let r = 1; r < occRows.length; r++) {
      const row = occRows[r];
      if (!row || row.length < 4) continue;
      const rawId = row[0];
      if (!rawId || isNaN(rawId) || String(row[10] || '').includes('#DIV')) continue;

      const hId = String(Math.floor(Number(rawId)));
      const hName = String(row[1] || '').trim();
      const rawDate = row[2];

      const baseName = getCleanBaseName(hName);
      const meta = factorMap[hId] || factorMap[hName.toLowerCase()] || factorMap[baseName] || { csId: padCSId7Digit(hId), city: 'Unknown', opZone: 'Unassigned', revSegment: 'Standard', row: [] };

      // -------------------------------------------------------------------------
      // CRITICAL FILTER: ONLY SHOW LIVE PROPERTIES FROM HAWKEYE BASE RATES MASTER!
      // -------------------------------------------------------------------------
      const flexMeta = rateFlexMap[hId]
        || (meta.csId ? rateFlexMap[meta.csId] : null)
        || (meta.csId ? rateFlexMap[padCSId7Digit(meta.csId)] : null)
        || (meta.hxId ? rateFlexMap[meta.hxId] : null)
        || rateFlexMap[padCSId7Digit(hId)]
        || rateFlexMap[hName.toLowerCase()]
        || rateFlexMap[baseName];

      // If Hawkeye base rates (Rate Flex) are loaded, strictly filter to LIVE properties only!
      if (flexRows.length > 0) {
        if (!flexMeta || flexMeta.status !== 'live') {
          continue; // Exclude non-live, churned, stop sell, or unlisted properties!
        }
      }

      // Exclude properties that are not standard Flex / Nonflex (e.g. Partner, SOB Properties, ARR Contract, Revman)
      if (flexMeta && flexMeta.flex) {
        const rawFlex = String(flexMeta.flex).trim().toLowerCase().replace(/[\s-_]/g, '');
        if (rawFlex && !rawFlex.includes('flex')) {
          continue;
        }
      }

      // Explicitly exclude target misclassified properties ("dont show them")
      const checkHName = (hName || '').toLowerCase().trim();
      const checkBaseName = (baseName || '').toLowerCase().trim();
      const checkMasterName = (flexMeta && flexMeta.rawName ? flexMeta.rawName : '').toLowerCase().trim();
      if (EXCLUDED_SPECIAL_HOTELS.some(ex => checkHName.includes(ex) || checkBaseName.includes(getCleanBaseName(ex)) || checkMasterName.includes(ex))) {
        continue;
      }

      const displayCsId = padCSId7Digit((flexMeta && flexMeta.csId) ? flexMeta.csId : (meta.csId || hId));
      const masterHotelName = (flexMeta && flexMeta.rawName) ? flexMeta.rawName : hName;
      const masterCity = (flexMeta && flexMeta.city) ? flexMeta.city : (meta.city || 'Unknown');
      const masterCityType = (flexMeta && flexMeta.cityType) ? flexMeta.cityType : 'Mixed';
      const rateFlex = (flexMeta && flexMeta.flex) ? flexMeta.flex : 'Flex';
      const finalOpZone = resolveOpZone(masterCity, masterHotelName, flexMeta ? flexMeta.region : '', meta.opZone);

      // Format Date YYYYMMDD and Display string
      let targetDateStr = '';
      let formattedDate = '';
      let shortDate = '';
      const dt = new Date(rawDate);
      if (!isNaN(dt.getTime())) {
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        targetDateStr = `${yyyy}${mm}${dd}`;

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        formattedDate = `${days[dt.getDay()]}, ${dt.getDate()} ${months[dt.getMonth()]} ${yyyy}`;
        shortDate = `${dt.getDate()} ${months[dt.getMonth()]} (${days[dt.getDay()]})`;
      } else {
        targetDateStr = String(rawDate).replace(/[-/]/g, '');
        formattedDate = targetDateStr;
        shortDate = targetDateStr;
      }

      // Keep only today's date through the next 9 days.
      // Total window = 10 days.
      if (
        targetDateStr < todayStr ||
        targetDateStr > maxDateStr
      ) {
        continue;
      }

      const occVal = parseFloat(String(row[3] || '0').replace('%', '')) || 0;

      // Day Short for factor lookup (e.g. '15-Aug')
      let dayShort = '';
      if (!isNaN(dt.getTime())) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dayShort = `${dt.getDate()}-${months[dt.getMonth()]}`;
      }

      // Lookup Current TDF Factor
      let currentTDF = 1.00;
      if (meta.row && meta.row.length > 0) {
        let colIdx = factorDateCols[targetDateStr];
        if (colIdx === undefined) colIdx = factorDateCols[dayShort];
        if (colIdx === undefined) colIdx = factorDateCols[rawDate];

        if (colIdx !== undefined && meta.row[colIdx] !== undefined) {
          const fVal = parseFloat(String(meta.row[colIdx]).trim());
          if (!isNaN(fVal) && fVal > 0) currentTDF = fVal;
        }
      }

      // Lookup Future Rates (Pushed Price & Factor) from Future rates tab
      const frMeta = futureRatesMap[`${displayCsId}_${targetDateStr}`]
        || futureRatesMap[`${hId}_${targetDateStr}`]
        || (meta.csId ? futureRatesMap[`${meta.csId}_${targetDateStr}`] : null)
        || (meta.csId ? futureRatesMap[`${padCSId7Digit(meta.csId)}_${targetDateStr}`] : null)
        || (meta.hxId ? futureRatesMap[`${meta.hxId}_${targetDateStr}`] : null);

      if (frMeta && frMeta.factor && (!meta.row || meta.row.length === 0 || currentTDF === 1.00)) {
        currentTDF = frMeta.factor;
      }

      // Pushed Price directly from 'Future rates' tab; fallback to Base Rate * Factor
      const baseRate = flexMeta.basePrice || 1500;
      const pushedPrice = (frMeta && frMeta.pushedPrice)
        ? frMeta.pushedPrice
        : Math.round(baseRate * currentTDF);

      // Multiplier Adjustment
      let occAdj = 1.00;
      if (occVal < 20) occAdj = 0.90;
      else if (occVal <= 50) occAdj = 1.00;
      else if (occVal <= 75) occAdj = 1.05;
      else if (occVal <= 90) occAdj = 1.15;
      else occAdj = 1.30;

      let recTDF = currentTDF * occAdj;

      const dayOfWeek = !isNaN(dt.getTime()) ? dt.getDay() : 1;
      if (meta.revSegment && meta.revSegment.toLowerCase().includes('leisure') && (dayOfWeek === 5 || dayOfWeek === 6)) {
        recTDF += 0.15;
      }
      if (meta.revSegment && meta.revSegment.toLowerCase().includes('metro') && recTDF < 0.85) {
        recTDF = 0.85;
      }
      if (occVal > 100 && recTDF > 1.40) recTDF = 1.40;

      recTDF = Math.round(recTDF * 100) / 100;
      const delta = Math.round((recTDF - currentTDF) * 100) / 100;

      // Reverse-engineer initial Desired Push Price matching recTDF (New TDF)
      const initialDesiredPushPrice = (currentTDF > 0 && pushedPrice > 0)
        ? Math.round(pushedPrice * (recTDF / currentTDF))
        : pushedPrice;

      let strategyKey = 'baseline';
      let strategyLabel = 'Maintain Baseline';
      if (delta > 0.05) { strategyKey = 'surge'; strategyLabel = 'Rate Increase / Surge'; }
      else if (delta < -0.05) { strategyKey = 'markdown'; strategyLabel = 'Markdown / Stimulus'; }

      // Lookup Benchmark Occupancy from Benchmark Occ tab
      const benchMeta = benchmarkOccMap[`${displayCsId}_${targetDateStr}`]
        || benchmarkOccMap[`${hId}_${targetDateStr}`]
        || (meta.csId ? benchmarkOccMap[`${meta.csId}_${targetDateStr}`] : null)
        || (meta.csId ? benchmarkOccMap[`${padCSId7Digit(meta.csId)}_${targetDateStr}`] : null)
        || benchmarkOccMap[`${masterHotelName.toLowerCase()}_${targetDateStr}`]
        || benchmarkOccMap[`${baseName}_${targetDateStr}`];

      const benchmarkOccVal = benchMeta ? benchMeta.val : null;
      const benchmarkOccDisplay = benchMeta ? benchMeta.display : '-';

      // Lookup Channel RNs (Walking Share & B2B Share) from Channel RNs tab
      const chanMeta = channelRNMap[`${displayCsId}_${targetDateStr}`]
        || channelRNMap[`${hId}_${targetDateStr}`]
        || (meta.csId ? channelRNMap[`${meta.csId}_${targetDateStr}`] : null)
        || (meta.csId ? channelRNMap[`${padCSId7Digit(meta.csId)}_${targetDateStr}`] : null)
        || (meta.hxId ? channelRNMap[`${meta.hxId}_${targetDateStr}`] : null)
        || (meta.hxId ? channelRNMap[`${padCSId7Digit(meta.hxId)}_${targetDateStr}`] : null)
        || channelRNMap[`${masterHotelName.toLowerCase()}_${targetDateStr}`]
        || channelRNMap[`${baseName}_${targetDateStr}`];

      const walkingShareVal = chanMeta ? chanMeta.walkingShare : null;
      const walkingShareDisplay = (walkingShareVal !== null && !isNaN(walkingShareVal)) ? `${walkingShareVal.toFixed(1)}%` : '-';

      const b2bShareVal = chanMeta ? chanMeta.b2bShare : null;
      const b2bShareDisplay = (b2bShareVal !== null && !isNaN(b2bShareVal)) ? `${b2bShareVal.toFixed(1)}%` : '-';

      dashboardState.push({
        csId: displayCsId,
        hotelId: hId,
        hotelName: masterHotelName,
        city: masterCity,
        cityType: masterCityType,
        opZone: finalOpZone,
        revSegment: meta.revSegment,
        rateFlex: rateFlex,
        targetDateStr: targetDateStr,
        dateStr: formattedDate,
        dateDisplayCompact: shortDate,
        benchmarkOccVal: benchmarkOccVal,
        benchmarkOccDisplay: benchmarkOccDisplay,
        walkingShareVal: walkingShareVal,
        walkingShareDisplay: walkingShareDisplay,
        b2bShareVal: b2bShareVal,
        b2bShareDisplay: b2bShareDisplay,
        occVal: occVal,
        currentTDF: currentTDF,
        pushedPrice: pushedPrice,
        desiredPushPrice: initialDesiredPushPrice,
        initialDesiredPushPrice: initialDesiredPushPrice,
        recTDF: recTDF,
        initialRecTDF: recTDF,
        delta: delta,
        initialDelta: delta,
        strategyKey: strategyKey,
        initialStrategyKey: strategyKey,
        strategyLabel: strategyLabel,
        initialStrategyLabel: strategyLabel
      });

      uniqueHotels.add(displayCsId);
      if (masterCity && masterCity !== 'Unknown') uniqueCities.add(masterCity);

      // OpZone stats (grouped cleanly by finalOpZone e.g. North 1, North 2)
      const z = finalOpZone;
      if (!opZoneStats[z]) {
        opZoneStats[z] = { hotels: new Set(), totalOcc: 0, count: 0, totalDelta: 0, surges: 0, markdowns: 0 };
      }
      opZoneStats[z].hotels.add(displayCsId);
      opZoneStats[z].totalOcc += occVal;
      opZoneStats[z].count++;
      opZoneStats[z].totalDelta += delta;
      if (delta > 0.05) opZoneStats[z].surges++;
      if (delta < -0.05) opZoneStats[z].markdowns++;
    }

    // Auto-detect calendar year/month from dataset dates (e.g. 20260901 -> Sept 2026)
    if (dashboardState.length > 0) {
      const firstDateStr = dashboardState[0].targetDateStr;
      if (firstDateStr && firstDateStr.length === 8) {
        dashCalYear = parseInt(firstDateStr.substring(0, 4));
        dashCalMonth = parseInt(firstDateStr.substring(4, 6)) - 1;

        tdfCalYear = dashCalYear;
        tdfCalMonth = dashCalMonth;
      }
    }

    // Render KPIs, OpZone Cards, Table & Calendar Dropdown
    renderKPIs(uniqueHotels.size, uniqueCities.size);
    renderOpZoneCards(opZoneStats);
    populateCityFilterDropdowns();
    populateDateFilterOptions();
    renderDashTable();
    populateTDFCalendarDropdown();
  }

  // Render Executive KPI Stat Cards
  function renderKPIs(hotelCount, cityCount) {
    const elHotels = document.getElementById('kpi-total-hotels');
    const elCities = document.getElementById('kpi-total-cities');
    const elOcc = document.getElementById('kpi-avg-occ');
    const elCurrTdf = document.getElementById('kpi-current-tdf');
    const elRecTdf = document.getElementById('kpi-rec-tdf');
    const elDelta = document.getElementById('kpi-tdf-delta');
    const elActions = document.getElementById('kpi-actions');

    if (dashboardState.length === 0) return;

    const totalOcc = dashboardState.reduce((sum, r) => sum + r.occVal, 0);
    const avgOcc = (totalOcc / dashboardState.length).toFixed(1);

    const totalCurrTDF = dashboardState.reduce((sum, r) => sum + r.currentTDF, 0);
    const avgCurrTDF = (totalCurrTDF / dashboardState.length).toFixed(2);

    const totalRecTDF = dashboardState.reduce((sum, r) => sum + r.recTDF, 0);
    const avgRecTDF = (totalRecTDF / dashboardState.length).toFixed(2);

    const netDelta = (avgRecTDF - avgCurrTDF).toFixed(2);
    const surges = dashboardState.filter(r => r.strategyKey === 'surge').length;
    const markdowns = dashboardState.filter(r => r.strategyKey === 'markdown').length;

    if (elHotels) elHotels.textContent = hotelCount;
    if (elCities) elCities.textContent = `${cityCount} Cities covered`;
    if (elOcc) elOcc.textContent = `${avgOcc}%`;
    if (elCurrTdf) elCurrTdf.textContent = avgCurrTDF;
    if (elRecTdf) elRecTdf.textContent = avgRecTDF;
    if (elDelta) elDelta.textContent = `Net Delta: ${netDelta >= 0 ? '+' : ''}${netDelta}`;
    if (elActions) elActions.textContent = `${surges} ↑ / ${markdowns} ↓`;
  }

  // Render OpZone Cards Grid
  function renderOpZoneCards(opZoneStats) {
    const container = document.getElementById('opzone-cards-container');
    if (!container) return;

    container.innerHTML = '';

    const zones = Object.keys(opZoneStats).sort();
    if (zones.length === 0) {
      container.innerHTML = `<div class="opzone-card-empty">No OpZone metrics available</div>`;
      return;
    }

    zones.forEach(zoneName => {
      const st = opZoneStats[zoneName];
      const avgOcc = st.count > 0 ? (st.totalOcc / st.count).toFixed(1) : 0;
      const avgDelta = st.count > 0 ? (st.totalDelta / st.count).toFixed(2) : 0;

      let stratBadgeClass = 'strat-baseline';
      let stratBadgeText = 'Maintain Baseline';
      if (avgDelta > 0.03) { stratBadgeClass = 'strat-surge'; stratBadgeText = 'Demand Surge Boost'; }
      else if (avgDelta < -0.03) { stratBadgeClass = 'strat-markdown'; stratBadgeText = 'Volume Markdown'; }

      const cardHtml = `
      <div class="opzone-card">
        <div class="opzone-card-title">
          <span>${escapeHtml(zoneName)}</span>
          <span style="font-size:0.75rem; color:#ea580c; font-weight:600;">${st.hotels.size} Hotels</span>
        </div>
        <div class="opzone-metric-row">
          <span>Avg Occupancy:</span>
          <strong>${avgOcc}%</strong>
        </div>
        <div class="opzone-progress-bar">
          <div class="opzone-progress-fill" style="width: ${Math.min(avgOcc, 100)}%;"></div>
        </div>
        <div class="opzone-metric-row">
          <span>TDF Net Delta:</span>
          <strong>${avgDelta >= 0 ? '+' : ''}${avgDelta}</strong>
        </div>
        <span class="opzone-strat-badge ${stratBadgeClass}">${stratBadgeText}</span>
      </div>
    `;
      container.innerHTML += cardHtml;
    });
  }

  // ==============================================================================
  // CUSTOM SEARCHABLE DROPDOWN FILTER ENGINE (Matching Reference Screenshots)
  // ==============================================================================

  class CustomFilterDropdown {
    constructor(containerEl, onChangeCallback) {
      this.container = containerEl;
      this.onChangeCallback = onChangeCallback;
      this.key = containerEl.dataset.filterKey;
      this.placeholder = containerEl.dataset.placeholder || 'Select...';
      this.triggerBtn = containerEl.querySelector('.dropdown-trigger-btn');
      this.labelEl = containerEl.querySelector('.dropdown-btn-label');
      this.panelEl = containerEl.querySelector('.dropdown-panel');
      this.searchInput = containerEl.querySelector('.dropdown-search-input');
      this.clearRow = containerEl.querySelector('.dropdown-clear-item');
      this.optionsContainer = containerEl.querySelector('.dropdown-options-list');

      this.selectedValue = 'all';
      this.initEvents();
    }

    initEvents() {
      if (!this.triggerBtn) return;

      this.triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = this.container.classList.contains('open');
        closeAllCustomDropdowns();

        if (!isOpen) {
          this.container.classList.add('open');
          if (this.searchInput) {
            this.searchInput.value = '';
            this.filterOptionsList('');
            setTimeout(() => this.searchInput.focus(), 50);
          }
        }
      });

      if (this.searchInput) {
        this.searchInput.addEventListener('input', (e) => {
          this.filterOptionsList(e.target.value.toLowerCase().trim());
        });
        this.searchInput.addEventListener('click', (e) => e.stopPropagation());
      }

      if (this.clearRow) {
        this.clearRow.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectValue('all');
          closeAllCustomDropdowns();
          if (this.onChangeCallback) this.onChangeCallback();
        });
      }

      if (this.optionsContainer) {
        this.optionsContainer.addEventListener('click', (e) => {
          const optionEl = e.target.closest('.dropdown-option');
          if (!optionEl) return;
          e.stopPropagation();
          const val = optionEl.dataset.value;
          this.selectValue(val);
          closeAllCustomDropdowns();
          if (this.onChangeCallback) this.onChangeCallback();
        });
      }
    }

    filterOptionsList(query) {
      if (!this.optionsContainer) return;
      const options = this.optionsContainer.querySelectorAll('.dropdown-option');
      options.forEach(opt => {
        const text = opt.textContent.toLowerCase();
        if (!query || text.includes(query) || opt.dataset.value === 'all') {
          opt.style.display = 'flex';
        } else {
          opt.style.display = 'none';
        }
      });
    }

    selectValue(val) {
      this.selectedValue = val;
      if (!this.optionsContainer) return;

      const options = this.optionsContainer.querySelectorAll('.dropdown-option');
      options.forEach(opt => {
        if (opt.dataset.value === val) {
          opt.classList.add('selected');
        } else {
          opt.classList.remove('selected');
        }
      });

      if (val === 'all') {
        if (this.labelEl) this.labelEl.textContent = this.placeholder;
        this.container.classList.remove('has-selection');
        if (this.clearRow) this.clearRow.style.display = 'none';
      } else {
        const selectedOpt = this.optionsContainer.querySelector(`.dropdown-option[data-value="${CSS.escape(val)}"]`);
        const labelText = selectedOpt ? selectedOpt.querySelector('.opt-label').textContent : val;
        if (this.labelEl) this.labelEl.textContent = labelText;
        this.container.classList.add('has-selection');
        if (this.clearRow) this.clearRow.style.display = 'flex';
      }
    }

    setOptions(optionsArray) {
      if (!this.optionsContainer) return;
      this.optionsContainer.innerHTML = '';

      // Add default "All" option
      const allOpt = document.createElement('div');
      allOpt.className = 'dropdown-option' + (this.selectedValue === 'all' ? ' selected' : '');
      allOpt.dataset.value = 'all';
      allOpt.innerHTML = `<span class="opt-check">✓</span> <span class="opt-label">${this.placeholder}</span>`;
      this.optionsContainer.appendChild(allOpt);

      optionsArray.forEach(val => {
        const opt = document.createElement('div');
        opt.className = 'dropdown-option' + (this.selectedValue === val ? ' selected' : '');
        opt.dataset.value = val;
        opt.innerHTML = `<span class="opt-check">✓</span> <span class="opt-label">${escapeHtml(val)}</span>`;
        this.optionsContainer.appendChild(opt);
      });

      this.selectValue(this.selectedValue);
    }
  }

  const customFilterInstances = {};

  function closeAllCustomDropdowns() {
    document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
  }

  function initCustomFilterSystem() {
    document.querySelectorAll('.custom-dropdown').forEach(el => {
      if (el.id === 'dropdown-dates') return; // Handled exclusively by Target Date Filter Manager
      const key = el.dataset.filterKey;
      if (key && !customFilterInstances[key]) {
        customFilterInstances[key] = new CustomFilterDropdown(el, () => {
          renderDashTable();
          if (document.getElementById('dash-panel-calendar-view')?.style.display !== 'none') {
            renderPortfolioDashboardCalendar();
          }
        });
      }
    });

    // Global click outside to close dropdown panels
    if (!document.datasetHasCustomDropdownGlobalClick) {
      document.datasetHasCustomDropdownGlobalClick = 'true';
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown')) {
          closeAllCustomDropdowns();
        }
      });
    }

    // Apply Button Listener
    const btnApply = document.getElementById('btn-filter-apply');
    if (btnApply && !btnApply.dataset.hasListener) {
      btnApply.dataset.hasListener = 'true';
      btnApply.addEventListener('click', () => {
        renderDashTable();
        if (document.getElementById('dash-panel-calendar-view')?.style.display !== 'none') {
          renderPortfolioDashboardCalendar();
        }
        showToast('Filters applied successfully', 'info');
      });
    }

    // Clear All Button Listener
    const btnClearAll = document.getElementById('btn-filter-clear-all');
    if (btnClearAll && !btnClearAll.dataset.hasListener) {
      btnClearAll.dataset.hasListener = 'true';
      btnClearAll.addEventListener('click', () => {
        Object.values(customFilterInstances).forEach(inst => inst.selectValue('all'));
        resetDateFilterToAll();
        renderDashTable();
        if (document.getElementById('dash-panel-calendar-view')?.style.display !== 'none') {
          renderPortfolioDashboardCalendar();
        }
        showToast('All filters cleared', 'info');
      });
    }
  }

  function populateCityFilterDropdowns() {
    if (customFilterInstances.city) {
      const cities = Array.from(new Set(dashboardState.map(r => r.city).filter(c => c && c !== 'Unknown'))).sort();
      customFilterInstances.city.setOptions(cities);
    }
    if (customFilterInstances.cityType) {
      const defaultCategories = ['Mixed', 'Tier-1 Business', 'Tier-2 Business', 'Winter Leisure', 'Summer Leisure'];
      const presentCategories = Array.from(new Set(dashboardState.map(r => r.cityType).filter(Boolean)));
      const allCategories = Array.from(new Set([...defaultCategories, ...presentCategories])).sort();
      customFilterInstances.cityType.setOptions(allCategories);
    }
  }

  // ==============================================================================
  // TARGET DATES MULTI-SELECT FILTER MANAGER
  // ==============================================================================

  let dashAvailableDates = []; // Array of { key: 'YYYYMMDD', display: 'Thu, 17 Sep 2026', dateObj: Date, badges: [] }
  let dashSelectedDates = new Set(); // Set of 'YYYYMMDD' strings
  let dashSelectedDateFilter = '';

  function setupDateFilterDropdown() {
    const container = document.getElementById('dropdown-dates');
    if (!container || container.dataset.hasDateEvents) return;
    container.dataset.hasDateEvents = 'true';

    const triggerBtn = document.getElementById('btn-trigger-dates');
    const searchInput = document.getElementById('search-dates-input');
    const btnSelectAll = document.getElementById('btn-date-select-all');
    const btnClear = document.getElementById('btn-date-clear');
    const presetContainer = container.querySelector('.date-preset-chips');

    // Trigger button opens/closes panel
    if (triggerBtn) {
      triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = container.classList.contains('open');
        closeAllCustomDropdowns();
        if (!isOpen) {
          container.classList.add('open');
          if (searchInput) {
            searchInput.value = '';
            filterDateOptionsList('');
            setTimeout(() => searchInput.focus(), 50);
          }
        }
      });
    }

    // Prevent clicks inside panel from closing dropdown
    const panel = container.querySelector('.dropdown-panel');
    if (panel) {
      panel.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Search input filter
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        filterDateOptionsList(e.target.value.toLowerCase().trim());
      });
    }

    // Quick Preset Chips
    if (presetContainer) {
      presetContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip-preset');
        if (!chip) return;
        const preset = chip.dataset.preset;
        applyDatePreset(preset);
      });
    }

    // Select All button
    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', () => {
        dashSelectedDates = new Set(dashAvailableDates.map(d => d.key));
        dashSelectedDateFilter = '';
        updateDateFilterUI();
        onDateFilterChanged();
      });
    }

    // Clear button
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        dashSelectedDates.clear();
        dashSelectedDateFilter = '';
        updateDateFilterUI();
        onDateFilterChanged();
      });
    }

    // Active Date Bar Clear Button (#btn-clear-date-filter)
    const btnClearActiveDate = document.getElementById('btn-clear-date-filter');
    if (btnClearActiveDate && !btnClearActiveDate.dataset.hasListener) {
      btnClearActiveDate.dataset.hasListener = 'true';
      btnClearActiveDate.addEventListener('click', () => {
        resetDateFilterToAll();
        showToast('Reset date filter to All 10 Days', 'info');
      });
    }
  }

  function resetDateFilterToAll() {
    dashSelectedDates = new Set(dashAvailableDates.map(d => d.key));
    dashSelectedDateFilter = '';
    const activeBar = document.getElementById('dash-active-date-bar');
    if (activeBar) activeBar.style.display = 'none';
    updateDateFilterUI();
    onDateFilterChanged();
  }

  function onDateFilterChanged() {
    renderDashTable();
    if (document.getElementById('dash-panel-calendar-view')?.style.display !== 'none') {
      renderPortfolioDashboardCalendar();
    }
  }

  function populateDateFilterOptions() {
    const dateMap = new Map();
    dashboardState.forEach(r => {
      if (r.targetDateStr && !dateMap.has(r.targetDateStr)) {
        let dt = null;
        if (r.targetDateStr.length === 8) {
          const y = parseInt(r.targetDateStr.substring(0, 4));
          const m = parseInt(r.targetDateStr.substring(4, 6)) - 1;
          const d = parseInt(r.targetDateStr.substring(6, 8));
          dt = new Date(y, m, d);
        }

        dateMap.set(r.targetDateStr, {
          key: r.targetDateStr,
          display: r.dateStr || r.targetDateStr,
          dateObj: dt
        });
      }
    });

    const sortedKeys = Array.from(dateMap.keys()).sort();
    dashAvailableDates = sortedKeys.map(k => dateMap.get(k));

    // Default: select all 10 dates
    dashSelectedDates = new Set(sortedKeys);
    dashSelectedDateFilter = '';

    renderDateCheckboxesList();
    updateDateFilterUI();
  }

  function renderDateCheckboxesList() {
    const container = document.getElementById('date-checkboxes-list');
    if (!container) return;

    container.innerHTML = '';

    if (dashAvailableDates.length === 0) {
      container.innerHTML = '<div style="padding: 12px; text-align:center; color:#94a3b8; font-size:0.8rem;">No dates available</div>';
      return;
    }

    dashAvailableDates.forEach(dateItem => {
      const isChecked = dashSelectedDates.has(dateItem.key);
      const itemEl = document.createElement('label');
      itemEl.className = `date-option-item${isChecked ? ' checked' : ''}`;
      itemEl.dataset.dateKey = dateItem.key;

      itemEl.innerHTML = `
      <div class="date-option-left">
        <input type="checkbox" class="date-option-checkbox" value="${dateItem.key}" ${isChecked ? 'checked' : ''}>
        <span class="date-option-text">${dateItem.display}</span>
      </div>
    `;

      const checkbox = itemEl.querySelector('.date-option-checkbox');
      checkbox.addEventListener('change', (e) => {
        const key = e.target.value;
        if (e.target.checked) {
          dashSelectedDates.add(key);
        } else {
          dashSelectedDates.delete(key);
        }
        dashSelectedDateFilter = dashSelectedDates.size === 1 ? Array.from(dashSelectedDates)[0] : '';
        itemEl.classList.toggle('checked', e.target.checked);
        updateDateFilterUI();
        onDateFilterChanged();
      });

      container.appendChild(itemEl);
    });
  }

  function filterDateOptionsList(query) {
    const container = document.getElementById('date-checkboxes-list');
    if (!container) return;
    const items = container.querySelectorAll('.date-option-item');
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      if (!query || text.includes(query)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  function updateDateFilterUI() {
    const labelEl = document.getElementById('label-dates-filter');
    const summaryEl = document.getElementById('date-selection-summary');
    const dropdownContainer = document.getElementById('dropdown-dates');
    const activeBar = document.getElementById('dash-active-date-bar');
    const activeLabel = document.getElementById('dash-active-date-label');

    const total = dashAvailableDates.length;
    const selectedCount = dashSelectedDates.size;

    if (summaryEl) {
      summaryEl.textContent = `${selectedCount} of ${total} selected`;
    }

    // Update Checkboxes inside list without destroying DOM (preserves search and focus)
    const container = document.getElementById('date-checkboxes-list');
    if (container) {
      container.querySelectorAll('.date-option-item').forEach(item => {
        const key = item.dataset.dateKey;
        const isChecked = dashSelectedDates.has(key);
        const cb = item.querySelector('.date-option-checkbox');
        if (cb) cb.checked = isChecked;
        item.classList.toggle('checked', isChecked);
      });
    }

    // Update Dropdown Button Label
    if (labelEl) {
      if (selectedCount === total || total === 0) {
        labelEl.textContent = 'All 10 Days';
        if (dropdownContainer) dropdownContainer.classList.remove('has-selection');
      } else if (selectedCount === 0) {
        labelEl.textContent = 'No Dates Selected';
        if (dropdownContainer) dropdownContainer.classList.add('has-selection');
      } else if (selectedCount === 1) {
        const singleKey = Array.from(dashSelectedDates)[0];
        const found = dashAvailableDates.find(d => d.key === singleKey);
        labelEl.textContent = found ? (found.display.split(',')[0] + ', ' + found.display.split(',')[1]?.trim()) : singleKey;
        if (dropdownContainer) dropdownContainer.classList.add('has-selection');
      } else {
        labelEl.textContent = `${selectedCount} Dates Selected`;
        if (dropdownContainer) dropdownContainer.classList.add('has-selection');
      }
    }

    // Update Top Active Filter Bar
    if (activeBar && activeLabel) {
      if (selectedCount < total && selectedCount > 0) {
        activeBar.style.display = 'flex';
        if (selectedCount === 1) {
          const singleKey = Array.from(dashSelectedDates)[0];
          const found = dashAvailableDates.find(d => d.key === singleKey);
          activeLabel.textContent = `Filtered Date: ${found ? found.display : singleKey}`;
        } else {
          activeLabel.textContent = `Filtered Dates: ${selectedCount} of ${total} days selected`;
        }
      } else if (selectedCount === 0) {
        activeBar.style.display = 'flex';
        activeLabel.textContent = 'Filtered Dates: None (0 dates selected)';
      } else {
        activeBar.style.display = 'none';
      }
    }
  }

  // Helper: Returns rows filtered by search, active dropdown filters, and selected target date
  function getFilteredDashboardRows() {
    const searchVal = (document.getElementById('dash-search-input')?.value || '').toLowerCase().trim();

    const filterZone = customFilterInstances.opzone ? customFilterInstances.opzone.selectedValue : 'all';
    const filterCityType = customFilterInstances.cityType ? customFilterInstances.cityType.selectedValue : 'all';
    const filterCity = customFilterInstances.city ? customFilterInstances.city.selectedValue : 'all';
    const filterFlex = customFilterInstances.flex ? customFilterInstances.flex.selectedValue : 'all';
    const filterStrat = customFilterInstances.strategy ? customFilterInstances.strategy.selectedValue : 'all';

    return dashboardState.filter(row => {
      // Multi-Select Target Date Filtering
      if (dashAvailableDates.length > 0) {
        if (dashSelectedDates.size === 0) return false;
        if (dashSelectedDates.size < dashAvailableDates.length && !dashSelectedDates.has(row.targetDateStr)) {
          return false;
        }
      } else if (dashSelectedDateFilter && row.targetDateStr !== dashSelectedDateFilter) {
        return false;
      }

      if (filterCity !== 'all' && row.city.toLowerCase() !== filterCity.toLowerCase()) return false;
      if (filterCityType !== 'all') {
        const rowCat = normalizeCityCategory(row.cityType).toLowerCase();
        const filterCat = normalizeCityCategory(filterCityType).toLowerCase();
        if (rowCat !== filterCat) return false;
      }
      if (filterZone !== 'all' && row.opZone !== filterZone) return false;
      if (filterStrat !== 'all' && row.strategyKey !== filterStrat) return false;
      if (filterFlex !== 'all') {
        const isFlex = row.rateFlex.toLowerCase().includes('flex') && !row.rateFlex.toLowerCase().includes('non');
        if (filterFlex === 'Flex' && !isFlex) return false;
        if (filterFlex === 'Nonflex' && isFlex) return false;
      }

      if (searchVal) {
        const matchSearch = row.csId.toLowerCase().includes(searchVal) ||
          row.hotelName.toLowerCase().includes(searchVal) ||
          row.city.toLowerCase().includes(searchVal) ||
          row.cityType.toLowerCase().includes(searchVal);
        if (!matchSearch) return false;
      }
      return true;
    });
  }

  // Render Property Inspection Data Table with search & filtering
  function renderDashTable() {
    const tbody = document.getElementById('dash-table-body');
    if (!tbody) return;

    const filtered = getFilteredDashboardRows();

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="14" style="text-align:center; padding:24px; color:var(--text-muted);">
          No live property metrics match your search filters.
        </td>
      </tr>
    `;
      return;
    }

    const limit = 500;
    const slice = filtered.slice(0, limit);

    slice.forEach(r => {
      const tr = document.createElement('tr');

      const pushedPriceDisplay = r.pushedPrice > 0 ? `₹${r.pushedPrice.toLocaleString('en-IN')}` : '-';
      const desiredVal = (r.desiredPushPrice !== undefined && r.desiredPushPrice !== null && r.desiredPushPrice > 0)
        ? r.desiredPushPrice
        : (r.initialDesiredPushPrice || r.pushedPrice);
      const recPlaceholder = r.initialDesiredPushPrice || r.pushedPrice || '';

      tr.innerHTML = `
      <td><span class="badge-csid">${escapeHtml(r.csId)}</span></td>
      <td><strong class="cell-hotel-name" title="${escapeHtml(r.hotelName)}">${escapeHtml(r.hotelName)}</strong></td>
      <td><span class="cell-truncate" title="${escapeHtml(r.city)}">${escapeHtml(r.city)}</span></td>
      <td><span class="cell-truncate" title="${escapeHtml(r.opZone)}">${escapeHtml(r.opZone)}</span></td>
      <td><span class="badge-city-type">${escapeHtml(r.cityType)}</span></td>
      <td><span class="cell-date-compact" title="${escapeHtml(r.dateStr)}">${escapeHtml(r.dateDisplayCompact || r.dateStr)}</span></td>
      <td class="cell-num-right"><strong style="color:#6366f1;">${escapeHtml(r.benchmarkOccDisplay || '-')}</strong></td>
      <td class="cell-num-right"><strong>${r.occVal.toFixed(1)}%</strong></td>
      <td class="cell-num-right"><strong style="color:#0284c7;">${escapeHtml(r.walkingShareDisplay || '-')}</strong></td>
      <td class="cell-num-right"><strong style="color:#8b5cf6;">${escapeHtml(r.b2bShareDisplay || '-')}</strong></td>
      <td class="cell-num-right">${r.currentTDF.toFixed(2)}</td>
      <td class="cell-num-right"><strong class="cell-new-tdf" style="color:#059669;">${r.recTDF.toFixed(2)}</strong></td>
      <td class="cell-num-right"><strong style="color:#0284c7;">${escapeHtml(pushedPriceDisplay)}</strong></td>
      <td class="cell-num-right cell-desired-price">
        <input type="text" inputmode="numeric" pattern="[0-9]*" class="desired-push-price-input" data-csid="${escapeHtml(r.csId)}" data-targetdate="${escapeHtml(r.targetDateStr)}" value="${escapeHtml(desiredVal)}" placeholder="${escapeHtml(recPlaceholder)}" title="Recommended: ₹${recPlaceholder} (Occ: ${r.occVal.toFixed(1)}%). Reverts to recommended price if left empty." spellcheck="false" autocomplete="off" />
      </td>
    `;
      tbody.appendChild(tr);
    });

    if (!tbody.dataset.hasDesiredPriceListener) {
      tbody.dataset.hasDesiredPriceListener = 'true';

      const handleDesiredPriceUpdate = (e) => {
        if (e.target && e.target.classList.contains('desired-push-price-input')) {
          const cleaned = e.target.value.replace(/[^0-9.]/g, '');
          if (e.target.value !== cleaned) {
            e.target.value = cleaned;
          }
          const csId = e.target.dataset.csid;
          const targetDate = e.target.dataset.targetdate;
          const desiredVal = parseFloat(cleaned);
          const match = dashboardState.find(row => row.csId === csId && row.targetDateStr === targetDate);
          if (match) {
            if (!isNaN(desiredVal) && desiredVal > 0) {
              match.desiredPushPrice = desiredVal;
              if (match.pushedPrice > 0) {
                const calculatedNewTDF = (desiredVal / match.pushedPrice) * match.currentTDF;
                match.recTDF = Math.round(calculatedNewTDF * 100) / 100;
                match.delta = Math.round((match.recTDF - match.currentTDF) * 100) / 100;

                const tr = e.target.closest('tr');
                if (tr) {
                  const cellNewTdf = tr.querySelector('.cell-new-tdf');
                  if (cellNewTdf) {
                    cellNewTdf.innerText = match.recTDF.toFixed(2);
                  }
                }
              }
            } else {
              match.desiredPushPrice = null;
            }
          }
        }
      };

      const handleDesiredPriceBlur = (e) => {
        if (e.target && e.target.classList.contains('desired-push-price-input')) {
          const cleaned = e.target.value.trim().replace(/[^0-9.]/g, '');
          const desiredVal = parseFloat(cleaned);
          const csId = e.target.dataset.csid;
          const targetDate = e.target.dataset.targetdate;
          const match = dashboardState.find(row => row.csId === csId && row.targetDateStr === targetDate);

          // If the user clears the price and leaves the input empty or <= 0:
          // Automatically revert to the Recommended Price!
          if (match && (isNaN(desiredVal) || desiredVal <= 0)) {
            const fallbackPrice = match.initialDesiredPushPrice || match.pushedPrice;
            const fallbackRecTDF = match.initialRecTDF || match.currentTDF;
            const fallbackDelta = match.initialDelta !== undefined ? match.initialDelta : Math.round((fallbackRecTDF - match.currentTDF) * 100) / 100;

            match.desiredPushPrice = fallbackPrice;
            match.recTDF = fallbackRecTDF;
            match.delta = fallbackDelta;
            if (match.initialStrategyKey) match.strategyKey = match.initialStrategyKey;
            if (match.initialStrategyLabel) match.strategyLabel = match.initialStrategyLabel;

            e.target.value = fallbackPrice;

            const tr = e.target.closest('tr');
            if (tr) {
              const cellNewTdf = tr.querySelector('.cell-new-tdf');
              if (cellNewTdf) {
                cellNewTdf.innerText = match.recTDF.toFixed(2);
              }
            }

            // Subtle visual feedback indicator on the input
            e.target.classList.add('price-reverted-flash');
            setTimeout(() => {
              e.target.classList.remove('price-reverted-flash');
            }, 1200);
          }
        }
      };

      tbody.addEventListener('input', handleDesiredPriceUpdate);
      tbody.addEventListener('change', handleDesiredPriceUpdate);
      tbody.addEventListener('focusout', handleDesiredPriceBlur);
    }
  }

  function setupDashboardViewToggle() {
    initCustomFilterSystem();

    const btnList = document.getElementById('btn-dash-view-list');
    const btnCal = document.getElementById('btn-dash-view-calendar');
    const panelList = document.getElementById('dash-panel-list-view');
    const panelCal = document.getElementById('dash-panel-calendar-view');
    const btnClearDate = document.getElementById('btn-clear-date-filter');

    const searchInput = document.getElementById('dash-search-input');
    if (searchInput && !searchInput.dataset.hasSearchListener) {
      searchInput.dataset.hasSearchListener = 'true';
      searchInput.addEventListener('input', () => {
        renderDashTable();
        if (panelCal && panelCal.style.display !== 'none') {
          renderPortfolioDashboardCalendar();
        }
      });
    }

    if (btnList && btnCal) {
      btnList.addEventListener('click', () => {
        btnList.classList.add('active');
        btnCal.classList.remove('active');
        if (panelList) panelList.style.display = 'block';
        if (panelCal) panelCal.style.display = 'none';
        renderDashTable();
      });

      btnCal.addEventListener('click', () => {
        btnCal.classList.add('active');
        btnList.classList.remove('active');
        if (panelCal) panelCal.style.display = 'block';
        if (panelList) panelList.style.display = 'none';
        renderPortfolioDashboardCalendar();
      });
    }

    if (btnClearDate) {
      btnClearDate.addEventListener('click', () => {
        resetDateFilterToAll();
      });
    }
  }

  let dashCalYear = 2026;
  let dashCalMonth = 8; // September (0-indexed 8)

  function setupDashboardCalNav() {
    const prevBtn = document.getElementById('btn-dash-cal-prev');
    const nextBtn = document.getElementById('btn-dash-cal-next');
    const todayBtn = document.getElementById('btn-dash-cal-today');

    if (prevBtn && !prevBtn.dataset.hasListener) {
      prevBtn.addEventListener('click', () => {
        dashCalMonth--;
        if (dashCalMonth < 0) {
          dashCalMonth = 11;
          dashCalYear--;
        }
        renderPortfolioDashboardCalendar();
      });
      prevBtn.dataset.hasListener = 'true';
    }

    if (nextBtn && !nextBtn.dataset.hasListener) {
      nextBtn.addEventListener('click', () => {
        dashCalMonth++;
        if (dashCalMonth > 11) {
          dashCalMonth = 0;
          dashCalYear++;
        }
        renderPortfolioDashboardCalendar();
      });
      nextBtn.dataset.hasListener = 'true';
    }

    if (todayBtn && !todayBtn.dataset.hasListener) {
      todayBtn.addEventListener('click', () => {
        const now = new Date();
        dashCalYear = now.getFullYear();
        dashCalMonth = now.getMonth();
        renderPortfolioDashboardCalendar();
      });
      todayBtn.dataset.hasListener = 'true';
    }
  }

  function renderPortfolioDashboardCalendar() {
    setupDashboardCalNav();

    const container = document.getElementById('dash-portfolio-calendar-grid');
    const monthHeading = document.getElementById('dash-cal-month-heading');
    if (!container) return;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (monthHeading) {
      monthHeading.textContent = `${monthNames[dashCalMonth]} ${dashCalYear}`;
    }

    // Get rows respecting all active filters (OpZone, Segment, Flex, Strategy, Search) except Date filter
    const currentSavedDateFilter = dashSelectedDateFilter;
    const currentSavedSelectedDates = new Set(dashSelectedDates);
    dashSelectedDateFilter = '';
    dashSelectedDates = new Set(dashAvailableDates.map(d => d.key));
    const rows = getFilteredDashboardRows();
    dashSelectedDateFilter = currentSavedDateFilter;
    dashSelectedDates = currentSavedSelectedDates;

    // Group rows by targetDateStr (key: YYYYMMDD)
    const dateMap = {};
    rows.forEach(r => {
      const dt = r.targetDateStr;
      if (!dateMap[dt]) {
        dateMap[dt] = {
          dateStr: dt,
          dateDisplay: r.dateStr,
          rows: []
        };
      }
      dateMap[dt].rows.push(r);
    });

    const firstDay = new Date(dashCalYear, dashCalMonth, 1).getDay();
    const daysInMonth = new Date(dashCalYear, dashCalMonth + 1, 0).getDate();

    container.innerHTML = '';

    // Padding cells before 1st day of month
    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.style.cssText = `
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 10px;
      min-height: 105px;
      opacity: 0.5;
    `;
      container.appendChild(emptyCell);
    }

    // Days 1 to daysInMonth
    for (let day = 1; day <= daysInMonth; day++) {
      const yyyy = dashCalYear;
      const mm = String(dashCalMonth + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateKey = `${yyyy}${mm}${dd}`;

      const cell = document.createElement('div');
      const grp = dateMap[dateKey];

      const isSelected = (dashSelectedDates.size > 0 && dashSelectedDates.size < dashAvailableDates.length && dashSelectedDates.has(dateKey));

      if (grp) {
        const grpRows = grp.rows;
        const hotelCount = new Set(grpRows.map(r => r.csId)).size;
        const avgOcc = (grpRows.reduce((s, r) => s + r.occVal, 0) / grpRows.length).toFixed(1);
        const avgCurr = (grpRows.reduce((s, r) => s + r.currentTDF, 0) / grpRows.length).toFixed(2);
        const avgRec = (grpRows.reduce((s, r) => s + r.recTDF, 0) / grpRows.length).toFixed(2);
        const delta = (avgRec - avgCurr).toFixed(2);

        // Color coding matching user's reference screenshot (pastel purple, pink, amber, green, white)
        let bgColor = '#e0e7ff'; // Pastel Lavender/Purple for Baseline
        let borderColor = '#c7d2fe';
        let textColor = '#3730a3';

        if (avgOcc >= 75) {
          bgColor = '#dcfce7'; // Pastel Green for High Occ Peak
          borderColor = '#bbf7d0';
          textColor = '#166534';
        } else if (delta > 0.05) {
          bgColor = '#ffe4e6'; // Pastel Pink/Red for Surge
          borderColor = '#fecdd3';
          textColor = '#9f1239';
        } else if (delta < -0.05) {
          bgColor = '#ffedd5'; // Pastel Amber/Orange for Markdown
          borderColor = '#fed7aa';
          textColor = '#9a3412';
        }

        if (isSelected) {
          bgColor = '#ffffff';
          borderColor = '#ea580c';
          textColor = '#ea580c';
        }

        cell.style.cssText = `
        background: ${bgColor};
        border: 2px solid ${borderColor};
        border-radius: 10px;
        padding: 8px 10px;
        min-height: 105px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: ${isSelected ? '0 4px 14px rgba(234, 88, 12, 0.25)' : 'none'};
      `;

        // Cell inner HTML matching clean reference screenshot
        cell.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 800; font-size: 1.05rem; color: ${textColor};">${day}</span>
          <span style="font-size: 0.72rem; font-weight: 700; background: rgba(255,255,255,0.7); padding: 1px 6px; border-radius: 10px; color: ${textColor};">${avgOcc}% Occ</span>
        </div>
        <div style="font-size: 0.78rem; font-weight: 600; color: #475569; margin-top: 4px;">
          ${hotelCount} Hotels
        </div>
        <div style="font-size: 0.78rem; font-weight: 700; display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 4px; border-top: 1px solid rgba(0,0,0,0.06);">
          <span>${avgCurr} ➔ <strong style="color: ${textColor};">${avgRec}</strong></span>
          <span style="font-size: 0.72rem; padding: 1px 5px; border-radius: 4px; background: rgba(255,255,255,0.8);">${delta >= 0 ? '+' : ''}${delta}</span>
        </div>
      `;

        cell.addEventListener('mouseenter', () => {
          cell.style.transform = 'translateY(-2px)';
          cell.style.borderColor = '#ea580c';
          cell.style.boxShadow = '0 6px 14px rgba(234, 88, 12, 0.2)';
        });
        cell.addEventListener('mouseleave', () => {
          cell.style.transform = 'translateY(0)';
          cell.style.borderColor = isSelected ? '#ea580c' : borderColor;
          cell.style.boxShadow = isSelected ? '0 4px 14px rgba(234, 88, 12, 0.25)' : 'none';
        });

        cell.addEventListener('click', () => {
          dashSelectedDates = new Set([dateKey]);
          dashSelectedDateFilter = dateKey;
          updateDateFilterUI();
          onDateFilterChanged();

          // Switch to List View
          const btnList = document.getElementById('btn-dash-view-list');
          if (btnList) btnList.click();

          showToast(`Filtered List View for target date: ${grp.dateDisplay} (${hotelCount} properties)`, 'info');
        });

      } else {
        // Empty day cell in month with no active records
        cell.style.cssText = `
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 8px 10px;
        min-height: 105px;
        opacity: 0.6;
      `;
        cell.innerHTML = `
        <div>
          <span style="font-weight: 700; font-size: 0.95rem; color: #94a3b8;">${day}</span>
        </div>
      `;
      }

      container.appendChild(cell);
    }

    if (window.lucide) lucide.createIcons();
  }

  // Generate Hawkeye Rules directly from Filtered Dashboard state
  function generateHawkeyeRulesFromDash() {
    if (dashboardState.length === 0) {
      showToast('Please load portfolio datasets first!', 'warning');
      return;
    }

    const targetRows = getFilteredDashboardRows();
    if (targetRows.length === 0) {
      showToast('No properties match your current search/filter selection!', 'warning');
      return;
    }

    // Consolidate consecutive dates with matching recTDF per hotel for selected filter
    const hotelGroups = {};
    targetRows.forEach(r => {
      // Safety guardrail: if recTDF is missing, 0, or NaN, revert to initial algorithmic recommendation
      if (!r.recTDF || isNaN(r.recTDF) || r.recTDF <= 0) {
        r.recTDF = r.initialRecTDF || r.currentTDF || 1.00;
        r.desiredPushPrice = r.initialDesiredPushPrice || r.pushedPrice;
      }
      if (!hotelGroups[r.csId]) hotelGroups[r.csId] = [];
      hotelGroups[r.csId].push(r);
    });

    const generatedRules = [];

    Object.keys(hotelGroups).forEach(csId => {
      const list = hotelGroups[csId];
      list.sort((a, b) => (a.targetDateStr || '').localeCompare(b.targetDateStr || ''));

      if (list.length > 0) {
        let cur = { start: list[0].targetDateStr, end: list[0].targetDateStr, mult: list[0].recTDF };

        for (let i = 1; i < list.length; i++) {
          const item = list[i];
          if (item.targetDateStr === getNextDateStr(cur.end) && item.recTDF === cur.mult) {
            cur.end = item.targetDateStr;
          } else {
            generatedRules.push({
              id: Math.random().toString(36).substr(2, 9),
              hotel_ID: csId,
              rule_type: 'targetDate',
              start_range: cur.start,
              end_range: cur.end,
              multiplier: cur.mult,
              addition: '',
              start_price: '',
              end_price: ''
            });
            cur = { start: item.targetDateStr, end: item.targetDateStr, mult: item.recTDF };
          }
        }

        generatedRules.push({
          id: Math.random().toString(36).substr(2, 9),
          hotel_ID: csId,
          rule_type: 'targetDate',
          start_range: cur.start,
          end_range: cur.end,
          multiplier: cur.mult,
          addition: '',
          start_price: '',
          end_price: ''
        });
      }
    });

    rulesState = generatedRules;
    renderTable();

    // Switch to Rules Preview tab
    const btnRulesTab = document.querySelector('.tab-btn[data-tab="tab-rules"]');
    if (btnRulesTab) btnRulesTab.click();

    const filterZone = document.getElementById('dash-filter-opzone')?.value || 'all';
    const zoneTag = filterZone !== 'all' ? ` for ${filterZone} OpZone` : '';
    showToast(`Generated ${generatedRules.length} consolidated Hawkeye rules${zoneTag}! (${Object.keys(hotelGroups).length} properties)`, 'success');
  }

  // Helper: Calculate next date string YYYYMMDD
  function getNextDateStr(yyyyMMdd) {
    if (!yyyyMMdd || yyyyMMdd.length !== 8) return '';
    const y = parseInt(yyyyMMdd.substr(0, 4));
    const m = parseInt(yyyyMMdd.substr(4, 2)) - 1;
    const d = parseInt(yyyyMMdd.substr(6, 2));
    const dt = new Date(y, m, d);
    dt.setDate(dt.getDate() + 1);

    const ny = dt.getFullYear();
    const nm = String(dt.getMonth() + 1).padStart(2, '0');
    const nd = String(dt.getDate()).padStart(2, '0');
    return `${ny}${nm}${nd}`;
  }

  // =============================================================================
  // INTERACTIVE TDF CALENDAR VIEW ENGINE
  // =============================================================================

  let tdfCalSelectedCsId = '';
  let tdfCalYear = 2026;
  let tdfCalMonth = 8; // September (0-indexed 8)

  function populateTDFCalendarDropdown() {
    const selectEl = document.getElementById('tdf-cal-property-select');
    if (!selectEl) return;

    // Group unique properties by csId
    const propertyMap = {};
    dashboardState.forEach(r => {
      if (!propertyMap[r.csId]) {
        propertyMap[r.csId] = {
          csId: r.csId,
          name: r.hotelName,
          city: r.city,
          opZone: r.opZone,
          revSegment: r.revSegment,
          rateFlex: r.rateFlex
        };
      }
    });

    const sortedList = Object.values(propertyMap).sort((a, b) => a.name.localeCompare(b.name));

    selectEl.innerHTML = '<option value="">-- Select Property to View Calendar --</option>';
    sortedList.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.csId;
      opt.textContent = `[${p.csId}] ${p.name} - ${p.city} (${p.opZone})`;
      selectEl.appendChild(opt);
    });

    // Attach change listener once
    if (!selectEl.dataset.hasListener) {
      selectEl.addEventListener('change', (e) => {
        tdfCalSelectedCsId = e.target.value;
        renderTDFCalendar(tdfCalSelectedCsId, tdfCalYear, tdfCalMonth);
      });
      selectEl.dataset.hasListener = 'true';

      // Navigation buttons
      const prevBtn = document.getElementById('btn-tdf-cal-prev');
      const nextBtn = document.getElementById('btn-tdf-cal-next');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          tdfCalMonth--;
          if (tdfCalMonth < 0) {
            tdfCalMonth = 11;
            tdfCalYear--;
          }
          renderTDFCalendar(tdfCalSelectedCsId, tdfCalYear, tdfCalMonth);
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          tdfCalMonth++;
          if (tdfCalMonth > 11) {
            tdfCalMonth = 0;
            tdfCalYear++;
          }
          renderTDFCalendar(tdfCalSelectedCsId, tdfCalYear, tdfCalMonth);
        });
      }
    }

    // Auto-select first property if none selected
    if (sortedList.length > 0 && !tdfCalSelectedCsId) {
      tdfCalSelectedCsId = sortedList[0].csId;
      selectEl.value = tdfCalSelectedCsId;
    }

    renderTDFCalendar(tdfCalSelectedCsId, tdfCalYear, tdfCalMonth);
  }

  function renderTDFCalendarCurrent() {
    if (!tdfCalSelectedCsId && dashboardState.length > 0) {
      populateTDFCalendarDropdown();
    } else {
      renderTDFCalendar(tdfCalSelectedCsId, tdfCalYear, tdfCalMonth);
    }
  }

  function renderTDFCalendar(csId, year, month) {
    const container = document.getElementById('tdf-calendar-cells-grid');
    const monthHeading = document.getElementById('tdf-cal-month-heading');
    const metaBanner = document.getElementById('tdf-cal-meta-banner');
    if (!container) return;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (monthHeading) {
      monthHeading.textContent = `${monthNames[month]} ${year}`;
    }

    if (!csId) {
      if (metaBanner) metaBanner.style.display = 'none';
      container.innerHTML = `
      <div style="grid-column: span 7; text-align: center; padding: 40px; color: var(--text-muted);">
        <i data-lucide="building-2" style="width: 48px; height: 48px; stroke-width: 1.5; margin-bottom: 12px; opacity: 0.5;"></i>
        <p style="font-size: 1rem; font-weight: 600;">Please select a property from the dropdown above to view its monthly calendar matrix.</p>
      </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Filter records for selected property
    const propRows = dashboardState.filter(r => r.csId === csId);
    if (propRows.length > 0) {
      const meta = propRows[0];
      if (metaBanner) {
        metaBanner.style.display = 'flex';
        document.getElementById('cal-meta-csid').textContent = meta.csId;
        document.getElementById('cal-meta-city').textContent = meta.city;
        document.getElementById('cal-meta-opzone').textContent = meta.opZone;
        document.getElementById('cal-meta-segment').textContent = meta.revSegment;
        document.getElementById('cal-meta-flex').textContent = meta.rateFlex;
      }
    }

    // Calculate Property KPIs
    const totalDays = propRows.length;
    const avgOcc = totalDays > 0 ? (propRows.reduce((s, r) => s + r.occVal, 0) / totalDays).toFixed(1) : '--';
    const avgCurrTDF = totalDays > 0 ? (propRows.reduce((s, r) => s + r.currentTDF, 0) / totalDays).toFixed(2) : '--';
    const avgRecTDF = totalDays > 0 ? (propRows.reduce((s, r) => s + r.recTDF, 0) / totalDays).toFixed(2) : '--';
    const netDelta = (totalDays > 0 && avgCurrTDF !== '--') ? (avgRecTDF - avgCurrTDF).toFixed(2) : '--';
    const surges = propRows.filter(r => r.strategyKey === 'surge').length;
    const markdowns = propRows.filter(r => r.strategyKey === 'markdown').length;

    document.getElementById('cal-kpi-days').textContent = totalDays;
    document.getElementById('cal-kpi-occ').textContent = `${avgOcc}%`;
    document.getElementById('cal-kpi-current-tdf').textContent = avgCurrTDF;
    document.getElementById('cal-kpi-rec-tdf').textContent = avgRecTDF;
    document.getElementById('cal-kpi-delta').textContent = `Net Delta: ${netDelta >= 0 ? '+' : ''}${netDelta}`;
    document.getElementById('cal-kpi-actions').textContent = `${surges} ↑ / ${markdowns} ↓`;

    // Build Date Lookup Map (key: YYYYMMDD)
    const dateMap = {};
    propRows.forEach(r => {
      dateMap[r.targetDateStr] = r;
    });

    // Calculate calendar days matrix
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    container.innerHTML = '';

    // Padding cells before first day
    for (let i = 0; i < firstDay; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'tdf-cal-cell empty-cell';
      container.appendChild(emptyCell);
    }

    // Active days in month
    for (let day = 1; day <= daysInMonth; day++) {
      const yyyy = year;
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${yyyy}${mm}${dd}`;

      const cell = document.createElement('div');
      cell.className = 'tdf-cal-cell';

      const r = dateMap[dateStr];

      if (r) {
        // Occ color class
        let occClass = 'badge-occ-low';
        if (r.occVal >= 75) occClass = 'badge-occ-peak';
        else if (r.occVal >= 50) occClass = 'badge-occ-high';
        else if (r.occVal >= 25) occClass = 'badge-occ-mid';

        // Delta class & text
        let deltaClass = 'delta-baseline';
        let deltaText = `${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)}`;
        if (r.delta > 0.05) deltaClass = 'delta-surge';
        else if (r.delta < -0.05) deltaClass = 'delta-markdown';

        cell.innerHTML = `
        <div class="tdf-cal-cell-header">
          <span class="tdf-cal-day-num">${day}</span>
          <span class="badge-occ ${occClass}">${r.occVal.toFixed(1)}%</span>
        </div>
        <div class="cal-tdf-row">
          Current: <strong>${r.currentTDF.toFixed(2)}</strong>
        </div>
        <div class="cal-tdf-row">
          Rec: <span class="cal-tdf-compare">${r.recTDF.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
          <span class="cal-delta-pill ${deltaClass}">${deltaText}</span>
          <span class="opzone-strat-badge strat-${r.strategyKey}">${r.strategyLabel}</span>
        </div>
      `;

        cell.style.cursor = 'pointer';
        cell.addEventListener('click', () => {
          showToast(
            `📅 ${r.hotelName} (${r.targetDateStr}): Occ ${r.occVal}% | Current TDF ${r.currentTDF} ➔ Rec TDF ${r.recTDF} (${r.strategyLabel})`,
            'info'
          );
        });
      } else {
        cell.classList.add('empty-cell');
        cell.innerHTML = `
        <div class="tdf-cal-cell-header">
          <span class="tdf-cal-day-num" style="opacity: 0.5;">${day}</span>
        </div>
      `;
      }

      container.appendChild(cell);
    }

    if (window.lucide) lucide.createIcons();
  }

  // ==========================================================================
  // HAWKEYE BASE RATES MASTER TAB LOGIC
  // ==========================================================================
  let hawkeyeBaseRatesMaster = [];
  let hawkeyeFilteredData = [];
  let hawkeyeCurrentPage = 1;
  let hawkeyePageSize = 100;

  function parseHawkeyeBaseRates(rows) {
    if (!rows || rows.length < 2) return [];
    const rawHeaders = rows[0].map(h => (h || '').toString().trim());

    const getColIndex = (names) => {
      for (const name of names) {
        const idx = rawHeaders.findIndex(h => h.toLowerCase() === name.toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const idxHotelId = getColIndex(['hotel_id', 'hotel id']);
    const idxHotelName = getColIndex(['hotel', 'hotel name']);
    const idxCity = getColIndex(['city']);
    const idxSubOpzone = getColIndex(['sub opzone', 'sub_opzone', 'subopzone']);
    const idxCityCategory = getColIndex(['city category', 'city_category']);
    const idxStatus = getColIndex(['status']);
    const idxBaseConfig = getColIndex(['base config', 'base_config', 'baseconfig']);
    const idxMin = getColIndex(['min', 'min ']);
    const idxMax = getColIndex(['max', 'max ']);
    const idxP0 = getColIndex(['p0']);
    const idxP1 = getColIndex(['p1']);
    const idxP2 = getColIndex(['p2']);
    const idxP3 = getColIndex(['p3']);
    const idxP4 = getColIndex(['p4']);
    const idxP5 = getColIndex(['p5']);

    const formatRate = (val) => {
      if (val === undefined || val === null || val === '') return '-';
      const num = parseFloat(String(val).replace(/,/g, ''));
      if (isNaN(num)) return String(val).replace(/,/g, '').trim();
      return String(Math.round(num));
    };

    const list = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawId = row[idxHotelId] ? String(row[idxHotelId]).trim() : '';
      if (!rawId) continue;

      const rawStatus = row[idxStatus] ? String(row[idxStatus]).trim() : '';
      const normStatus = rawStatus.toLowerCase().replace(/\s+/g, '');
      // Only show properties which are Live and Stop Sell
      if (normStatus !== 'live' && normStatus !== 'stopsell') {
        continue;
      }

      const hotelName = row[idxHotelName] ? String(row[idxHotelName]).trim() : '';
      const hotelNameLower = hotelName.toLowerCase();
      if (EXCLUDED_SPECIAL_HOTELS.some(ex => hotelNameLower.includes(ex))) {
        continue; // User specified: don't show them
      }

      // Format hotel_id with 7-digit zero padding (0000000)
      const formattedHotelId = /^\d+$/.test(rawId) ? rawId.padStart(7, '0') : rawId;
      const displayStatus = normStatus === 'live' ? 'Live' : 'Stop Sell';
      const baseConfig = row[idxBaseConfig] ? String(row[idxBaseConfig]).trim() : '';

      list.push({
        hotelId: formattedHotelId,
        rawHotelId: rawId,
        hotelName: hotelName,
        city: row[idxCity] ? String(row[idxCity]).trim() : '',
        subOpzone: row[idxSubOpzone] ? String(row[idxSubOpzone]).trim() : '',
        cityCategory: row[idxCityCategory] ? String(row[idxCityCategory]).trim() : '',
        status: displayStatus,
        baseConfig: baseConfig,
        min: formatRate(row[idxMin]),
        max: formatRate(row[idxMax]),
        p0: formatRate(row[idxP0]),
        p1: formatRate(row[idxP1]),
        p2: formatRate(row[idxP2]),
        p3: formatRate(row[idxP3]),
        p4: formatRate(row[idxP4]),
        p5: formatRate(row[idxP5])
      });
    }

    return list;
  }

  const HAWKEYE_CACHE_KEY = 'hawkeye_base_rates_cache_v5';

  function loadHawkeyeBaseRatesData(rawRows) {
    hawkeyeBaseRatesMaster = parseHawkeyeBaseRates(rawRows);
    console.log(`Parsed ${hawkeyeBaseRatesMaster.length} Live/Stop Sell Hawkeye Base Rates`);

    try {
      localStorage.removeItem('hawkeye_base_rates_cache');
      localStorage.removeItem('hawkeye_base_rates_cache_v2');
      localStorage.removeItem('hawkeye_base_rates_cache_v3');
      localStorage.removeItem('hawkeye_base_rates_cache_v4');
      localStorage.setItem(HAWKEYE_CACHE_KEY, JSON.stringify(hawkeyeBaseRatesMaster));
    } catch (e) {
      console.warn('Could not cache Hawkeye base rates in localStorage:', e);
    }

    populateHawkeyeFilterDropdowns(false);
    applyHawkeyeFilters();
  }

  async function syncHawkeyeBaseRates(showNotice = false) {
    const syncBtn = document.getElementById('btn-hawkeye-sync');
    if (syncBtn) syncBtn.disabled = true;

    try {
      if (showNotice) showToast('Syncing Hawkeye base rates from Google Sheets...', 'info');
      let res = await fetch('/api/sheet-data');
      if (!res.ok && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        res = await fetch('https://tdf-automator.vercel.app/api/sheet-data');
      }
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const json = await res.json();
      if (!json.success || !json.data || !json.data.hawkeyeBaseRates) {
        throw new Error(json.error || 'No Hawkeye data returned');
      }

      loadHawkeyeBaseRatesData(json.data.hawkeyeBaseRates);
      if (showNotice) {
        showToast(`Successfully synced ${hawkeyeBaseRatesMaster.length} Live & Stop Sell properties!`, 'success');
      }
    } catch (err) {
      console.warn('Failed to sync Hawkeye base rates:', err);
      if (showNotice) {
        showToast(`Hawkeye sync failed: ${err.message}`, 'error');
      }
    } finally {
      if (syncBtn) syncBtn.disabled = false;
      if (window.lucide) lucide.createIcons();
    }
  }

  function initHawkeyeBaseRatesFromCache() {
    try {
      localStorage.removeItem('hawkeye_base_rates_cache');
      localStorage.removeItem('hawkeye_base_rates_cache_v2');
      localStorage.removeItem('hawkeye_base_rates_cache_v3');
      localStorage.removeItem('hawkeye_base_rates_cache_v4');

      const cached = localStorage.getItem(HAWKEYE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].status && (parsed[0].status === 'Live' || parsed[0].status === 'Stop Sell')) {
          parsed.forEach(item => {
            ['min', 'max', 'p0', 'p1', 'p2', 'p3', 'p4', 'p5'].forEach(k => {
              if (item[k]) item[k] = String(item[k]).replace(/,/g, '');
            });
          });
          hawkeyeBaseRatesMaster = parsed;
          console.log(`Loaded ${hawkeyeBaseRatesMaster.length} Hawkeye Base Rates from cache`);
          populateHawkeyeFilterDropdowns(true);
          applyHawkeyeFilters();
          return;
        } else {
          console.warn('Outdated Hawkeye cache found. Purging...');
          localStorage.removeItem(HAWKEYE_CACHE_KEY);
        }
      }
    } catch (e) {
      console.warn('Failed to load cached Hawkeye base rates:', e);
    }

    // If cache was purged or missing, automatically sync live from sheet API
    syncHawkeyeBaseRates(false);
  }

  function populateHawkeyeFilterDropdowns(resetToAll = false) {
    const subOpzoneSelect = document.getElementById('hawkeye-filter-sub-opzone');
    const citySelect = document.getElementById('hawkeye-filter-city');
    const categorySelect = document.getElementById('hawkeye-filter-category');
    const statusSelect = document.getElementById('hawkeye-filter-status');
    const baseConfigSelect = document.getElementById('hawkeye-filter-base-config');

    if (!hawkeyeBaseRatesMaster || hawkeyeBaseRatesMaster.length === 0) return;

    // Sub Opzones
    if (subOpzoneSelect) {
      const currentVal = resetToAll ? 'all' : subOpzoneSelect.value;
      const subOpzones = Array.from(new Set(hawkeyeBaseRatesMaster.map(item => item.subOpzone).filter(Boolean))).sort();
      subOpzoneSelect.innerHTML = '<option value="all">All Sub Opzones</option>' +
        subOpzones.map(z => `<option value="${escapeHtml(z)}">${escapeHtml(z)}</option>`).join('');
      subOpzoneSelect.value = (subOpzones.includes(currentVal)) ? currentVal : 'all';
    }

    // Cities
    if (citySelect) {
      const currentVal = resetToAll ? 'all' : citySelect.value;
      const cities = Array.from(new Set(hawkeyeBaseRatesMaster.map(item => item.city).filter(Boolean))).sort();
      citySelect.innerHTML = '<option value="all">All Cities</option>' +
        cities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      citySelect.value = (cities.includes(currentVal)) ? currentVal : 'all';
    }

    // City Categories
    if (categorySelect) {
      const currentVal = resetToAll ? 'all' : categorySelect.value;
      const categories = Array.from(new Set(hawkeyeBaseRatesMaster.map(item => item.cityCategory).filter(Boolean))).sort();
      categorySelect.innerHTML = '<option value="all">All Categories</option>' +
        categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      categorySelect.value = (categories.includes(currentVal)) ? currentVal : 'all';
    }

    // Statuses
    if (statusSelect) {
      const currentVal = resetToAll ? 'all' : statusSelect.value;
      statusSelect.value = ['Live', 'Stop Sell'].includes(currentVal) ? currentVal : 'all';
    }

    // Base Configs
    if (baseConfigSelect) {
      const currentVal = resetToAll ? 'all' : baseConfigSelect.value;
      const configs = Array.from(new Set(hawkeyeBaseRatesMaster.map(item => item.baseConfig).filter(Boolean))).sort();
      baseConfigSelect.innerHTML = '<option value="all">All Base Configs</option>' +
        configs.map(cfg => `<option value="${escapeHtml(cfg)}">${escapeHtml(cfg)}</option>`).join('');
      baseConfigSelect.value = (configs.includes(currentVal)) ? currentVal : 'all';
    }

    if (typeof populateCityBulkCityDropdown === 'function') {
      populateCityBulkCityDropdown(resetToAll);
    }
  }

  function applyHawkeyeFilters() {
    const searchInput = document.getElementById('hawkeye-search-input');
    const subOpzoneSelect = document.getElementById('hawkeye-filter-sub-opzone');
    const citySelect = document.getElementById('hawkeye-filter-city');
    const categorySelect = document.getElementById('hawkeye-filter-category');
    const statusSelect = document.getElementById('hawkeye-filter-status');
    const baseConfigSelect = document.getElementById('hawkeye-filter-base-config');

    const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selSubOpzone = subOpzoneSelect ? subOpzoneSelect.value : 'all';
    const selCity = citySelect ? citySelect.value : 'all';
    const selCat = categorySelect ? categorySelect.value : 'all';
    const selStatus = statusSelect ? statusSelect.value : 'all';
    const selBaseConfig = baseConfigSelect ? baseConfigSelect.value : 'all';

    hawkeyeFilteredData = hawkeyeBaseRatesMaster.filter(item => {
      if (selSubOpzone !== 'all' && item.subOpzone !== selSubOpzone) return false;
      if (selCity !== 'all' && item.city !== selCity) return false;
      if (selCat !== 'all' && item.cityCategory !== selCat) return false;
      if (selStatus !== 'all' && item.status !== selStatus) return false;
      if (selBaseConfig !== 'all' && item.baseConfig !== selBaseConfig) return false;

      if (q) {
        const matchId = item.hotelId.toLowerCase().includes(q) || (item.rawHotelId && item.rawHotelId.toLowerCase().includes(q));
        const matchName = item.hotelName.toLowerCase().includes(q);
        const matchCity = item.city.toLowerCase().includes(q);
        const matchZone = item.subOpzone.toLowerCase().includes(q);
        const matchCat = item.cityCategory.toLowerCase().includes(q);
        const matchStatus = item.status.toLowerCase().includes(q);
        const matchConfig = item.baseConfig.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchCity && !matchZone && !matchCat && !matchStatus && !matchConfig) return false;
      }

      return true;
    });

    hawkeyeCurrentPage = 1;
    renderHawkeyeRatesTable();
  }

  function renderHawkeyeRatesTable() {
    const tbody = document.getElementById('hawkeye-rates-tbody');
    const badge = document.getElementById('hawkeye-rates-count-badge');
    const paginationInfo = document.getElementById('hawkeye-pagination-info');
    const pageBadge = document.getElementById('hawkeye-current-page-badge');
    const prevBtn = document.getElementById('btn-hawkeye-prev-page');
    const nextBtn = document.getElementById('btn-hawkeye-next-page');

    if (!tbody) return;

    const totalFiltered = hawkeyeFilteredData.length;
    const totalMaster = hawkeyeBaseRatesMaster.length;

    if (badge) {
      badge.textContent = `${totalFiltered.toLocaleString('en-IN')} Properties Loaded${totalFiltered !== totalMaster ? ` (Filtered from ${totalMaster.toLocaleString('en-IN')})` : ''}`;
    }

    if (totalFiltered === 0) {
      tbody.innerHTML = `
      <tr>
        <td colspan="15" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
          <i data-lucide="search-x" style="width: 32px; height: 32px; margin-bottom: 8px; display: inline-block; opacity: 0.5;"></i>
          <div>${totalMaster === 0 ? 'No Hawkeye base rates loaded yet. Click <strong>Sync Rates</strong> to sync live rates from Google Sheets.' : 'No properties match your current search and filter criteria.'}</div>
        </td>
      </tr>
    `;
      if (paginationInfo) paginationInfo.textContent = '';
      if (pageBadge) pageBadge.textContent = 'Page 0';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Calculate pagination
    const effectivePageSize = hawkeyePageSize === 'all' ? totalFiltered : parseInt(hawkeyePageSize, 10);
    const totalPages = Math.max(1, Math.ceil(totalFiltered / effectivePageSize));
    if (hawkeyeCurrentPage > totalPages) hawkeyeCurrentPage = totalPages;

    const startIdx = (hawkeyeCurrentPage - 1) * effectivePageSize;
    const endIdx = Math.min(startIdx + effectivePageSize, totalFiltered);
    const pageItems = hawkeyeFilteredData.slice(startIdx, endIdx);

    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${startIdx + 1}–${endIdx} of ${totalFiltered.toLocaleString('en-IN')}`;
    }
    if (pageBadge) {
      pageBadge.textContent = `Page ${hawkeyeCurrentPage} of ${totalPages}`;
    }
    if (prevBtn) prevBtn.disabled = hawkeyeCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = hawkeyeCurrentPage >= totalPages;

    let html = '';
    for (const item of pageItems) {
      let statusBadge = '<span style="color: var(--text-muted); font-size: 0.75rem;">-</span>';
      if (item.status === 'Live') {
        statusBadge = `<span style="display: inline-flex; align-items: center; gap: 5px; font-size: 0.72rem; font-weight: 600; padding: 2px 8px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 9999px;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span>Live</span>`;
      } else if (item.status === 'Stop Sell') {
        statusBadge = `<span style="display: inline-flex; align-items: center; gap: 5px; font-size: 0.72rem; font-weight: 600; padding: 2px 8px; background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; border-radius: 9999px;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #f97316;"></span>Stop Sell</span>`;
      }

      const configBadge = item.baseConfig
        ? `<span style="font-size: 0.72rem; font-weight: 600; padding: 2px 7px; background: #f8fafc; color: #334155; border: 1px solid #e2e8f0; border-radius: 4px; font-family: monospace;">${escapeHtml(item.baseConfig)}</span>`
        : '<span style="color: var(--text-muted);">-</span>';

      html += `
      <tr>
        <td style="font-family: monospace; font-weight: 700; color: var(--text-primary); letter-spacing: 0.5px;">${escapeHtml(item.hotelId)}</td>
        <td>
          <span class="cell-hotel-name" style="max-width: 220px;" title="${escapeHtml(item.hotelName)}">${escapeHtml(item.hotelName || '-')}</span>
        </td>
        <td>${escapeHtml(item.city || '-')}</td>
        <td>
          <span style="font-size: 0.72rem; font-weight: 600; padding: 2px 7px; background: #f1f5f9; color: #475569; border-radius: 4px;">${escapeHtml(item.subOpzone || '-')}</span>
        </td>
        <td>
          <span style="font-size: 0.72rem; color: var(--text-secondary);">${escapeHtml(item.cityCategory || '-')}</span>
        </td>
        <td>${statusBadge}</td>
        <td class="col-sep-right">${configBadge}</td>
        <td class="cell-num-right" style="font-weight: 600; color: #d97706;">${escapeHtml(item.min)}</td>
        <td class="cell-num-right" style="font-weight: 600; color: #d97706;">${escapeHtml(item.max)}</td>
        <td class="cell-num-right" style="font-weight: 700; color: #0284c7; background: rgba(2, 132, 199, 0.04);">${escapeHtml(item.p0)}</td>
        <td class="cell-num-right" style="font-weight: 600; color: #0284c7;">${escapeHtml(item.p1)}</td>
        <td class="cell-num-right" style="font-weight: 600; color: #0284c7;">${escapeHtml(item.p2)}</td>
        <td class="cell-num-right" style="font-weight: 600; color: #0284c7;">${escapeHtml(item.p3)}</td>
        <td class="cell-num-right" style="font-weight: 600; color: #0284c7;">${escapeHtml(item.p4)}</td>
        <td class="cell-num-right" style="font-weight: 600; color: #0284c7;">${escapeHtml(item.p5)}</td>
      </tr>
    `;
    }

    tbody.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }

  function setupHawkeyeBaseRatesListeners() {
    const syncBtn = document.getElementById('btn-hawkeye-sync');
    const searchInput = document.getElementById('hawkeye-search-input');
    const subOpzoneSelect = document.getElementById('hawkeye-filter-sub-opzone');
    const citySelect = document.getElementById('hawkeye-filter-city');
    const categorySelect = document.getElementById('hawkeye-filter-category');
    const statusSelect = document.getElementById('hawkeye-filter-status');
    const baseConfigSelect = document.getElementById('hawkeye-filter-base-config');
    const resetBtn = document.getElementById('btn-hawkeye-reset-filters');
    const prevBtn = document.getElementById('btn-hawkeye-prev-page');
    const nextBtn = document.getElementById('btn-hawkeye-next-page');
    const pageSizeSelect = document.getElementById('hawkeye-page-size');

    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        syncHawkeyeBaseRates(true);
      });
    }

    let debounceTimer;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          applyHawkeyeFilters();
        }, 150);
      });
    }

    if (subOpzoneSelect) subOpzoneSelect.addEventListener('change', applyHawkeyeFilters);
    if (citySelect) citySelect.addEventListener('change', applyHawkeyeFilters);
    if (categorySelect) categorySelect.addEventListener('change', applyHawkeyeFilters);
    if (statusSelect) statusSelect.addEventListener('change', applyHawkeyeFilters);
    if (baseConfigSelect) baseConfigSelect.addEventListener('change', applyHawkeyeFilters);

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (subOpzoneSelect) subOpzoneSelect.value = 'all';
        if (citySelect) citySelect.value = 'all';
        if (categorySelect) categorySelect.value = 'all';
        if (statusSelect) statusSelect.value = 'all';
        if (baseConfigSelect) baseConfigSelect.value = 'all';
        applyHawkeyeFilters();
        showToast('Hawkeye filters reset', 'info');
      });
    }

    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', () => {
        hawkeyePageSize = pageSizeSelect.value;
        hawkeyeCurrentPage = 1;
        renderHawkeyeRatesTable();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (hawkeyeCurrentPage > 1) {
          hawkeyeCurrentPage--;
          renderHawkeyeRatesTable();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        hawkeyeCurrentPage++;
        renderHawkeyeRatesTable();
      });
    }
  }

  // =========================================================================
  // CITY BULK ACTION CONTROLLER & CALCULATOR
  // =========================================================================
  let cityBulkProperties = [];
  let cityBulkPreviewRows = [];
  let cityBulkFilteredRows = [];
  let cityBulkCurrentPage = 1;
  let cityBulkPageSize = 100;
  let cityBulkAvailableCities = [];
  let cityBulkActiveIndex = -1;
  let cityBulkCurrentView = 'matrix'; // 'matrix' | 'list'
  let cityBulkConfig = null;

  function setupCityBulkActionListeners() {
    const citySelect = document.getElementById('city-bulk-city-select');
    const startDateInput = document.getElementById('city-bulk-start-date');
    const endDateInput = document.getElementById('city-bulk-end-date');
    const flexibilitySelect = document.getElementById('city-bulk-flexibility');
    const dayGroupSelect = document.getElementById('city-bulk-day-group');
    
    // 7-Day Ask Price Inputs
    const askMon = document.getElementById('city-bulk-ask-mon');
    const askTue = document.getElementById('city-bulk-ask-tue');
    const askWed = document.getElementById('city-bulk-ask-wed');
    const askThu = document.getElementById('city-bulk-ask-thu');
    const askFri = document.getElementById('city-bulk-ask-fri');
    const askSat = document.getElementById('city-bulk-ask-sat');
    const askSun = document.getElementById('city-bulk-ask-sun');

    const colMon = document.getElementById('city-bulk-day-col-mon');
    const colTue = document.getElementById('city-bulk-day-col-tue');
    const colWed = document.getElementById('city-bulk-day-col-wed');
    const colThu = document.getElementById('city-bulk-day-col-thu');
    const colFri = document.getElementById('city-bulk-day-col-fri');
    const colSat = document.getElementById('city-bulk-day-col-sat');
    const colSun = document.getElementById('city-bulk-day-col-sun');

    const sameMonThuCb = document.getElementById('city-bulk-same-mon-thu');
    const sameWeekendCb = document.getElementById('city-bulk-same-weekend');
    
    const btnSelectAll = document.getElementById('btn-city-bulk-select-all');
    const btnDeselectAll = document.getElementById('btn-city-bulk-deselect-all');
    const btnPreview = document.getElementById('btn-city-bulk-preview');
    const btnSyncRates = document.getElementById('btn-city-bulk-sync-rates');
    const btnDownload = document.getElementById('btn-city-bulk-download');
    const btnCopy = document.getElementById('btn-city-bulk-copy');
    const searchInput = document.getElementById('city-bulk-preview-search');
    const pageSizeSelect = document.getElementById('city-bulk-page-size');
    const prevBtn = document.getElementById('btn-city-bulk-prev-page');
    const nextBtn = document.getElementById('btn-city-bulk-next-page');

    // Initialize Default Dates (Today to +6 days)
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 6);
    if (startDateInput && !startDateInput.value) startDateInput.value = formatDateString(today);
    if (endDateInput && !endDateInput.value) endDateInput.value = formatDateString(nextWeek);

    // City Selection Change
    if (citySelect) {
      citySelect.addEventListener('change', onCityBulkCityChange);
    }

    // Searchable City Dropdown Elements
    const cityInput = document.getElementById('city-bulk-city-input');
    const cityClearBtn = document.getElementById('btn-city-bulk-city-clear');
    const cityToggleBtn = document.getElementById('btn-city-bulk-city-toggle');
    const cityDropdownMenu = document.getElementById('city-bulk-city-dropdown-menu');

    if (cityInput && cityDropdownMenu) {
      // Focus & Click: show dropdown
      cityInput.addEventListener('focus', () => {
        renderCityBulkDropdown(cityInput.value);
        cityDropdownMenu.style.display = 'block';
      });

      cityInput.addEventListener('click', (e) => {
        e.stopPropagation();
        renderCityBulkDropdown(cityInput.value);
        cityDropdownMenu.style.display = 'block';
      });

      // Live search typing
      cityInput.addEventListener('input', () => {
        const val = cityInput.value;
        if (cityClearBtn) {
          cityClearBtn.style.display = val.length > 0 ? 'block' : 'none';
        }
        renderCityBulkDropdown(val);
        cityDropdownMenu.style.display = 'block';

        if (!val.trim()) {
          if (citySelect && citySelect.value) {
            citySelect.value = '';
            onCityBulkCityChange();
          }
        }
      });

      // Keyboard navigation
      cityInput.addEventListener('keydown', (e) => {
        const items = cityDropdownMenu.querySelectorAll('.searchable-city-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (cityDropdownMenu.style.display === 'none') {
            cityDropdownMenu.style.display = 'block';
            return;
          }
          cityBulkActiveIndex = (cityBulkActiveIndex + 1) % items.length;
          items.forEach((it, idx) => it.classList.toggle('active', idx === cityBulkActiveIndex));
          items[cityBulkActiveIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (cityDropdownMenu.style.display === 'none') {
            cityDropdownMenu.style.display = 'block';
            return;
          }
          cityBulkActiveIndex = (cityBulkActiveIndex - 1 + items.length) % items.length;
          items.forEach((it, idx) => it.classList.toggle('active', idx === cityBulkActiveIndex));
          items[cityBulkActiveIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (cityBulkActiveIndex >= 0 && items[cityBulkActiveIndex]) {
            const cityName = items[cityBulkActiveIndex].getAttribute('data-city');
            selectCityBulkCity(cityName);
          } else if (items.length === 1) {
            const cityName = items[0].getAttribute('data-city');
            selectCityBulkCity(cityName);
          } else {
            const match = cityBulkAvailableCities.find(c => c.name.toLowerCase() === cityInput.value.trim().toLowerCase());
            if (match) {
              selectCityBulkCity(match.name);
            }
          }
        } else if (e.key === 'Escape') {
          cityDropdownMenu.style.display = 'none';
        }
      });

      // Dropdown toggle button
      if (cityToggleBtn) {
        cityToggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (cityDropdownMenu.style.display === 'block') {
            cityDropdownMenu.style.display = 'none';
          } else {
            renderCityBulkDropdown('');
            cityDropdownMenu.style.display = 'block';
            cityInput.focus();
          }
        });
      }

      // Clear button
      if (cityClearBtn) {
        cityClearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          cityInput.value = '';
          cityClearBtn.style.display = 'none';
          selectCityBulkCity('');
          renderCityBulkDropdown('');
          cityInput.focus();
        });
      }

      // Outside click listener
      document.addEventListener('click', (e) => {
        const wrapper = document.querySelector('.searchable-city-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
          cityDropdownMenu.style.display = 'none';
          const curVal = citySelect ? citySelect.value : '';
          if (cityInput.value.trim().toLowerCase() !== curVal.toLowerCase()) {
            const exactMatch = cityBulkAvailableCities.find(c => c.name.toLowerCase() === cityInput.value.trim().toLowerCase());
            if (exactMatch) {
              selectCityBulkCity(exactMatch.name);
            } else {
              cityInput.value = curVal;
              if (cityClearBtn) cityClearBtn.style.display = curVal ? 'block' : 'none';
            }
          }
        }
      });
    }

    if (window.lucide) window.lucide.createIcons();

    // Refresh Hawkeye Rates button
    if (btnSyncRates) {
      btnSyncRates.addEventListener('click', () => {
        syncHawkeyeBaseRates(true);
      });
    }

    // Mon–Thu Sync Logic: Typing in Monday syncs to Tuesday, Wednesday, Thursday
    const skipMonCb = document.getElementById('city-bulk-skip-mon');
    const skipTueCb = document.getElementById('city-bulk-skip-tue');
    const skipWedCb = document.getElementById('city-bulk-skip-wed');
    const skipThuCb = document.getElementById('city-bulk-skip-thu');

    // Mon–Thu Sync Logic: Typing in Monday syncs to Tuesday, Wednesday, Thursday
    const syncMonToWeekdays = () => {
      if (sameMonThuCb && sameMonThuCb.checked && askMon) {
        const val = askMon.value;
        if (askTue && !skipTueCb?.checked) askTue.value = val;
        if (askWed && !skipWedCb?.checked) askWed.value = val;
        if (askThu && !skipThuCb?.checked) askThu.value = val;
      }
    };

    if (sameMonThuCb) {
      sameMonThuCb.addEventListener('change', () => {
        const isSynced = sameMonThuCb.checked;
        if (askTue) askTue.disabled = isSynced || !!skipTueCb?.checked;
        if (askWed) askWed.disabled = isSynced || !!skipWedCb?.checked;
        if (askThu) askThu.disabled = isSynced || !!skipThuCb?.checked;
        if (isSynced) syncMonToWeekdays();
      });
    }

    if (askMon) {
      askMon.addEventListener('input', syncMonToWeekdays);
    }

    // Individual Weekday Skip Handlers
    const updateWeekdaySkip = (day) => {
      if (day === 'mon') {
        const skipped = !!skipMonCb?.checked;
        colMon?.classList.toggle('day-skipped', skipped);
        if (askMon) askMon.disabled = skipped;
        if (skipped) {
          if (sameMonThuCb?.checked && askTue && askWed && askThu) {
            const firstVal = !skipTueCb?.checked ? askTue.value : (!skipWedCb?.checked ? askWed.value : askThu.value);
            if (!skipWedCb?.checked) askWed.value = firstVal;
            if (!skipThuCb?.checked) askThu.value = firstVal;
          }
        } else {
          syncMonToWeekdays();
        }
      } else if (day === 'tue') {
        const skipped = !!skipTueCb?.checked;
        colTue?.classList.toggle('day-skipped', skipped);
        if (askTue) askTue.disabled = skipped || (sameMonThuCb && sameMonThuCb.checked);
      } else if (day === 'wed') {
        const skipped = !!skipWedCb?.checked;
        colWed?.classList.toggle('day-skipped', skipped);
        if (askWed) askWed.disabled = skipped || (sameMonThuCb && sameMonThuCb.checked);
      } else if (day === 'thu') {
        const skipped = !!skipThuCb?.checked;
        colThu?.classList.toggle('day-skipped', skipped);
        if (askThu) askThu.disabled = skipped || (sameMonThuCb && sameMonThuCb.checked);
      }

      if (cityBulkPreviewRows.length > 0) {
        generateCityBulkPreview(false);
      }
    };

    if (skipMonCb) skipMonCb.addEventListener('change', () => updateWeekdaySkip('mon'));
    if (skipTueCb) skipTueCb.addEventListener('change', () => updateWeekdaySkip('tue'));
    if (skipWedCb) skipWedCb.addEventListener('change', () => updateWeekdaySkip('wed'));
    if (skipThuCb) skipThuCb.addEventListener('change', () => updateWeekdaySkip('thu'));

    const skipFriCb = document.getElementById('city-bulk-skip-fri');
    const skipSatCb = document.getElementById('city-bulk-skip-sat');
    const skipSunCb = document.getElementById('city-bulk-skip-sun');
    const sameWeekendLabel = document.getElementById('city-bulk-same-weekend-label');

    // Weekend Sync Logic: Typing in Friday syncs to Saturday and Sunday
    const syncFriToWeekend = () => {
      if (sameWeekendCb && sameWeekendCb.checked && askFri) {
        const val = askFri.value;
        if (askSat && !skipSatCb?.checked) askSat.value = val;
        if (askSun && !skipSunCb?.checked) askSun.value = val;
      }
    };

    if (sameWeekendCb) {
      sameWeekendCb.addEventListener('change', () => {
        const isSynced = sameWeekendCb.checked;
        if (sameWeekendLabel) {
          sameWeekendLabel.textContent = isSynced ? 'Same price for Weekend' : 'Custom price per day';
        }
        if (askSat) askSat.disabled = isSynced || !!skipSatCb?.checked;
        if (askSun) askSun.disabled = isSynced || !!skipSunCb?.checked;
        if (isSynced) syncFriToWeekend();
      });
    }

    if (askFri) {
      askFri.addEventListener('input', syncFriToWeekend);
    }

    // Individual Weekend Skip Handlers
    const updateWeekendDaySkip = (day) => {
      if (day === 'fri') {
        const skipped = !!skipFriCb?.checked;
        colFri?.classList.toggle('day-skipped', skipped);
        if (askFri) askFri.disabled = skipped;
        if (skipped) {
          if (sameWeekendCb?.checked && askSat && askSun && !skipSunCb?.checked) {
            askSun.value = askSat.value;
          }
        } else {
          syncFriToWeekend();
        }
      } else if (day === 'sat') {
        const skipped = !!skipSatCb?.checked;
        colSat?.classList.toggle('day-skipped', skipped);
        if (askSat) askSat.disabled = skipped || (sameWeekendCb && sameWeekendCb.checked);
      } else if (day === 'sun') {
        const skipped = !!skipSunCb?.checked;
        colSun?.classList.toggle('day-skipped', skipped);
        if (askSun) askSun.disabled = skipped || (sameWeekendCb && sameWeekendCb.checked);
      }

      if (cityBulkPreviewRows.length > 0) {
        generateCityBulkPreview(false);
      }
    };

    if (skipFriCb) skipFriCb.addEventListener('change', () => updateWeekendDaySkip('fri'));
    if (skipSatCb) skipSatCb.addEventListener('change', () => updateWeekendDaySkip('sat'));
    if (skipSunCb) skipSunCb.addEventListener('change', () => updateWeekendDaySkip('sun'));

    // Day Group Target visibility & skip state adjustment
    if (dayGroupSelect) {
      let prevDayGroup = dayGroupSelect.value || 'all';
      const updateDayGroupUI = () => {
        const val = dayGroupSelect.value;
        if (prevDayGroup === 'weekdays_only' && val !== 'weekdays_only') {
          if (skipFriCb) skipFriCb.checked = false;
          if (skipSatCb) skipSatCb.checked = false;
          if (skipSunCb) skipSunCb.checked = false;
        }
        if (prevDayGroup === 'weekends_only' && val !== 'weekends_only') {
          if (skipMonCb) skipMonCb.checked = false;
          if (skipTueCb) skipTueCb.checked = false;
          if (skipWedCb) skipWedCb.checked = false;
          if (skipThuCb) skipThuCb.checked = false;
        }
        prevDayGroup = val;

        if (val === 'weekdays_only') {
          // Mon-Thu active (unless individually skipped)
          [colMon, colTue, colWed, colThu].forEach(c => {
            const isSkip = (c === colMon && skipMonCb?.checked) || (c === colTue && skipTueCb?.checked) || (c === colWed && skipWedCb?.checked) || (c === colThu && skipThuCb?.checked);
            if (isSkip) c && c.classList.add('day-skipped');
            else c && c.classList.remove('day-skipped');
          });
          [skipMonCb, skipTueCb, skipWedCb, skipThuCb].forEach(cb => { if (cb) cb.disabled = false; });
          if (askMon) askMon.disabled = !!skipMonCb?.checked;
          if (askTue) askTue.disabled = !!skipTueCb?.checked || (sameMonThuCb && sameMonThuCb.checked);
          if (askWed) askWed.disabled = !!skipWedCb?.checked || (sameMonThuCb && sameMonThuCb.checked);
          if (askThu) askThu.disabled = !!skipThuCb?.checked || (sameMonThuCb && sameMonThuCb.checked);

          // Fri-Sun skipped by group
          [colFri, colSat, colSun].forEach(c => c && c.classList.add('day-skipped'));
          [skipFriCb, skipSatCb, skipSunCb].forEach(cb => { if (cb) { cb.checked = true; cb.disabled = true; } });
          if (askFri) askFri.disabled = true;
          if (askSat) askSat.disabled = true;
          if (askSun) askSun.disabled = true;

          if (sameMonThuCb?.parentElement) sameMonThuCb.parentElement.style.display = 'flex';
          if (sameWeekendCb?.parentElement?.parentElement) sameWeekendCb.parentElement.parentElement.style.display = 'none';
        } else if (val === 'weekends_only') {
          // Mon-Thu skipped by group
          [colMon, colTue, colWed, colThu].forEach(c => c && c.classList.add('day-skipped'));
          [skipMonCb, skipTueCb, skipWedCb, skipThuCb].forEach(cb => { if (cb) { cb.checked = true; cb.disabled = true; } });
          if (askMon) askMon.disabled = true;
          if (askTue) askTue.disabled = true;
          if (askWed) askWed.disabled = true;
          if (askThu) askThu.disabled = true;

          // Fri-Sun active (unless individually skipped)
          [skipFriCb, skipSatCb, skipSunCb].forEach(cb => { if (cb) cb.disabled = false; });
          [colFri, colSat, colSun].forEach(c => {
            const isSkip = (c === colFri && skipFriCb?.checked) || (c === colSat && skipSatCb?.checked) || (c === colSun && skipSunCb?.checked);
            if (isSkip) c && c.classList.add('day-skipped');
            else c && c.classList.remove('day-skipped');
          });
          if (askFri) askFri.disabled = !!skipFriCb?.checked;
          if (askSat) askSat.disabled = !!skipSatCb?.checked || (sameWeekendCb && sameWeekendCb.checked);
          if (askSun) askSun.disabled = !!skipSunCb?.checked || (sameWeekendCb && sameWeekendCb.checked);

          if (sameMonThuCb?.parentElement) sameMonThuCb.parentElement.style.display = 'none';
          if (sameWeekendCb?.parentElement?.parentElement) sameWeekendCb.parentElement.parentElement.style.display = 'flex';
        } else {
          // All Days active (unless individually skipped)
          [skipMonCb, skipTueCb, skipWedCb, skipThuCb, skipFriCb, skipSatCb, skipSunCb].forEach(cb => { if (cb) cb.disabled = false; });
          [colMon, colTue, colWed, colThu].forEach(c => {
            const isSkip = (c === colMon && skipMonCb?.checked) || (c === colTue && skipTueCb?.checked) || (c === colWed && skipWedCb?.checked) || (c === colThu && skipThuCb?.checked);
            if (isSkip) c && c.classList.add('day-skipped');
            else c && c.classList.remove('day-skipped');
          });
          [colFri, colSat, colSun].forEach(c => {
            const isSkip = (c === colFri && skipFriCb?.checked) || (c === colSat && skipSatCb?.checked) || (c === colSun && skipSunCb?.checked);
            if (isSkip) c && c.classList.add('day-skipped');
            else c && c.classList.remove('day-skipped');
          });
          if (askMon) askMon.disabled = !!skipMonCb?.checked;
          if (askTue) askTue.disabled = !!skipTueCb?.checked || (sameMonThuCb && sameMonThuCb.checked);
          if (askWed) askWed.disabled = !!skipWedCb?.checked || (sameMonThuCb && sameMonThuCb.checked);
          if (askThu) askThu.disabled = !!skipThuCb?.checked || (sameMonThuCb && sameMonThuCb.checked);
          if (askFri) askFri.disabled = !!skipFriCb?.checked;
          if (askSat) askSat.disabled = !!skipSatCb?.checked || (sameWeekendCb && sameWeekendCb.checked);
          if (askSun) askSun.disabled = !!skipSunCb?.checked || (sameWeekendCb && sameWeekendCb.checked);

          if (sameMonThuCb?.parentElement) sameMonThuCb.parentElement.style.display = 'flex';
          if (sameWeekendCb?.parentElement?.parentElement) sameWeekendCb.parentElement.parentElement.style.display = 'flex';
        }
      };
      dayGroupSelect.addEventListener('change', updateDayGroupUI);
      updateDayGroupUI();
    }

    // Select All / Deselect All
    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', (e) => {
        e.preventDefault();
        cityBulkProperties.forEach(p => p.selected = true);
        renderCityBulkPropertyChips();
        updateCityBulkSelectionKPI();
        updateCityBulkJoinedHotels();
        if (cityBulkPreviewRows.length > 0) generateCityBulkPreview(false);
      });
    }

    if (btnDeselectAll) {
      btnDeselectAll.addEventListener('click', (e) => {
        e.preventDefault();
        cityBulkProperties.forEach(p => p.selected = false);
        renderCityBulkPropertyChips();
        updateCityBulkSelectionKPI();
        updateCityBulkJoinedHotels();
        if (cityBulkPreviewRows.length > 0) generateCityBulkPreview(false);
      });
    }

    // Generate Preview
    if (btnPreview) {
      btnPreview.addEventListener('click', () => {
        generateCityBulkPreview(true);
      });
    }

    // Download CSV
    if (btnDownload) {
      btnDownload.addEventListener('click', downloadCityBulkCSV);
    }

    // Copy Joined Hotel IDs to Clipboard
    if (btnCopy) {
      btnCopy.addEventListener('click', copyCityBulkJoinedHotels);
    }

    // Setup Event Listeners for City Bulk Joined Hotels Box
    const cityBulkJoinedBox = document.getElementById('city-bulk-joined-hotels-box');
    if (cityBulkJoinedBox) {
      cityBulkJoinedBox.addEventListener('click', (e) => {
        // Toggle Collapse / Expand button
        const toggleBtn = e.target.closest('#btn-city-bulk-toggle-joined-parts');
        if (toggleBtn) {
          const isCollapsed = cityBulkJoinedBox.classList.toggle('collapsed');
          const iconSvg = isCollapsed
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`;
          const numParts = toggleBtn.dataset.numParts || '';
          toggleBtn.innerHTML = `${iconSvg} <span class="toggle-text">${isCollapsed ? `Show Parts (${numParts})` : 'Collapse'}</span>`;
          return;
        }

        // Copy All button
        const copyAllBtn = e.target.closest('#btn-city-bulk-copy-all-joined');
        if (copyAllBtn) {
          copyCityBulkJoinedHotels();
          return;
        }

        // Part copy button
        const partBtn = e.target.closest('.btn-city-bulk-copy-part, #btn-city-bulk-copy-joined');
        if (partBtn) {
          const row = partBtn.closest('.joined-hotels-body');
          const input = row ? row.querySelector('.joined-hotels-text') : null;
          if (!input || !input.value) return;

          const partNum = partBtn.dataset.part;
          const range = partBtn.dataset.range;
          const count = partBtn.dataset.count;
          const isMultiPart = (partNum && parseInt(partNum) > 1) || (cityBulkJoinedBox.querySelectorAll('.joined-hotels-part').length > 1);
          const label = isMultiPart ? `Part ${partNum} (${range} · ${count} IDs)` : 'Joined Hotel IDs';

          navigator.clipboard.writeText(input.value)
            .then(() => {
              showToast(`Copied ${label} to clipboard!`, 'success');
            })
            .catch(err => {
              console.error('Failed to copy: ', err);
              showToast('Failed to copy. Please copy the text manually.', 'error');
            });
        }
      });
    }

    // View Mode Switcher
    const btnViewMatrix = document.getElementById('btn-city-bulk-view-matrix');
    const btnViewList = document.getElementById('btn-city-bulk-view-list');
    const matrixContainer = document.getElementById('city-bulk-matrix-container');
    const listContainer = document.getElementById('city-bulk-list-container');

    if (btnViewMatrix) {
      btnViewMatrix.addEventListener('click', () => {
        if (cityBulkCurrentView === 'matrix') return;
        cityBulkCurrentView = 'matrix';
        btnViewMatrix.classList.add('active');
        if (btnViewList) btnViewList.classList.remove('active');
        if (matrixContainer) matrixContainer.style.display = 'block';
        if (listContainer) listContainer.style.display = 'none';
        cityBulkCurrentPage = 1;
        renderCityBulkMatrixTable();
      });
    }

    if (btnViewList) {
      btnViewList.addEventListener('click', () => {
        if (cityBulkCurrentView === 'list') return;
        cityBulkCurrentView = 'list';
        btnViewList.classList.add('active');
        if (btnViewMatrix) btnViewMatrix.classList.remove('active');
        if (listContainer) listContainer.style.display = 'block';
        if (matrixContainer) matrixContainer.style.display = 'none';
        cityBulkCurrentPage = 1;
        renderCityBulkPreviewTable();
      });
    }

    // Table Search
    if (searchInput) {
      searchInput.addEventListener('input', applyCityBulkPreviewFilters);
    }

    // Page Size
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', () => {
        cityBulkPageSize = pageSizeSelect.value;
        cityBulkCurrentPage = 1;
        if (cityBulkCurrentView === 'matrix') renderCityBulkMatrixTable();
        else renderCityBulkPreviewTable();
      });
    }

    // Pagination Controls
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (cityBulkCurrentPage > 1) {
          cityBulkCurrentPage--;
          if (cityBulkCurrentView === 'matrix') renderCityBulkMatrixTable();
          else renderCityBulkPreviewTable();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        cityBulkCurrentPage++;
        if (cityBulkCurrentView === 'matrix') renderCityBulkMatrixTable();
        else renderCityBulkPreviewTable();
      });
    }

    // Reset Form & State
    const btnReset = document.getElementById('btn-city-bulk-reset');
    if (btnReset) {
      btnReset.addEventListener('click', resetCityBulkAction);
    }

    // Try populating city dropdown right away if cache is ready
    populateCityBulkCityDropdown(false);
  }

  // Reset City Bulk Action Form, Selections, and Preview State
  function resetCityBulkAction() {
    const citySelect = document.getElementById('city-bulk-city-select');
    const startDateInput = document.getElementById('city-bulk-start-date');
    const endDateInput = document.getElementById('city-bulk-end-date');
    const flexibilitySelect = document.getElementById('city-bulk-flexibility');
    const dayGroupSelect = document.getElementById('city-bulk-day-group');

    const askMon = document.getElementById('city-bulk-ask-mon');
    const askTue = document.getElementById('city-bulk-ask-tue');
    const askWed = document.getElementById('city-bulk-ask-wed');
    const askThu = document.getElementById('city-bulk-ask-thu');
    const askFri = document.getElementById('city-bulk-ask-fri');
    const askSat = document.getElementById('city-bulk-ask-sat');
    const askSun = document.getElementById('city-bulk-ask-sun');

    const colMon = document.getElementById('city-bulk-day-col-mon');
    const colTue = document.getElementById('city-bulk-day-col-tue');
    const colWed = document.getElementById('city-bulk-day-col-wed');
    const colThu = document.getElementById('city-bulk-day-col-thu');
    const colFri = document.getElementById('city-bulk-day-col-fri');
    const colSat = document.getElementById('city-bulk-day-col-sat');
    const colSun = document.getElementById('city-bulk-day-col-sun');

    const sameMonThuCb = document.getElementById('city-bulk-same-mon-thu');
    const sameWeekendCb = document.getElementById('city-bulk-same-weekend');

    const searchInput = document.getElementById('city-bulk-preview-search');
    const statusBadge = document.getElementById('city-bulk-status-badge');
    const propCountSpan = document.getElementById('city-bulk-city-prop-count');

    const kpiProps = document.getElementById('kpi-bulk-props');
    const kpiSub = document.getElementById('kpi-bulk-props-sub');
    const kpiDays = document.getElementById('kpi-bulk-days');
    const kpiRows = document.getElementById('kpi-bulk-rows');
    const kpiAvgMult = document.getElementById('kpi-bulk-avg-mult');
    const btnDownload = document.getElementById('btn-city-bulk-download');
    const btnCopy = document.getElementById('btn-city-bulk-copy');

    // 1. Reset dropdown & dates
    if (citySelect) citySelect.value = '';
    const cityInput = document.getElementById('city-bulk-city-input');
    const cityClearBtn = document.getElementById('btn-city-bulk-city-clear');
    const cityDropdownMenu = document.getElementById('city-bulk-city-dropdown-menu');
    if (cityInput) cityInput.value = '';
    if (cityClearBtn) cityClearBtn.style.display = 'none';
    if (cityDropdownMenu) cityDropdownMenu.style.display = 'none';
    renderCityBulkDropdown('');
    if (propCountSpan) propCountSpan.textContent = '';

    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 6);
    if (startDateInput) startDateInput.value = formatDateString(today);
    if (endDateInput) endDateInput.value = formatDateString(nextWeek);

    if (flexibilitySelect) flexibilitySelect.value = 'non-flex';
    if (dayGroupSelect) {
      dayGroupSelect.value = 'all';
      dayGroupSelect.dispatchEvent(new Event('change'));
    }

    if (sameMonThuCb) sameMonThuCb.checked = true;
    if (sameWeekendCb) sameWeekendCb.checked = true;
    const skipMonCb = document.getElementById('city-bulk-skip-mon');
    const skipTueCb = document.getElementById('city-bulk-skip-tue');
    const skipWedCb = document.getElementById('city-bulk-skip-wed');
    const skipThuCb = document.getElementById('city-bulk-skip-thu');
    const skipFriCb = document.getElementById('city-bulk-skip-fri');
    const skipSatCb = document.getElementById('city-bulk-skip-sat');
    const skipSunCb = document.getElementById('city-bulk-skip-sun');
    const sameWeekendLabel = document.getElementById('city-bulk-same-weekend-label');
    if (skipMonCb) skipMonCb.checked = false;
    if (skipTueCb) skipTueCb.checked = false;
    if (skipWedCb) skipWedCb.checked = false;
    if (skipThuCb) skipThuCb.checked = false;
    if (skipFriCb) skipFriCb.checked = false;
    if (skipSatCb) skipSatCb.checked = false;
    if (skipSunCb) skipSunCb.checked = false;
    if (sameWeekendLabel) sameWeekendLabel.textContent = 'Same price for Weekend';

    // Clear day prices
    [askMon, askTue, askWed, askThu, askFri, askSat, askSun].forEach(input => {
      if (input) input.value = '';
    });
    if (askTue) askTue.disabled = true;
    if (askWed) askWed.disabled = true;
    if (askThu) askThu.disabled = true;
    if (askSat) askSat.disabled = true;
    if (askSun) askSun.disabled = true;

    [colMon, colTue, colWed, colThu, colFri, colSat, colSun].forEach(c => {
      if (c) c.classList.remove('day-skipped');
    });

    if (searchInput) searchInput.value = '';

    // 2. Clear state
    cityBulkProperties = [];
    cityBulkPreviewRows = [];
    cityBulkFilteredRows = [];
    cityBulkCurrentPage = 1;
    cityBulkConfig = null;
    cityBulkCurrentView = 'matrix';

    const btnViewMatrix = document.getElementById('btn-city-bulk-view-matrix');
    const btnViewList = document.getElementById('btn-city-bulk-view-list');
    const matrixContainer = document.getElementById('city-bulk-matrix-container');
    const listContainer = document.getElementById('city-bulk-list-container');
    if (btnViewMatrix) btnViewMatrix.classList.add('active');
    if (btnViewList) btnViewList.classList.remove('active');
    if (matrixContainer) matrixContainer.style.display = 'block';
    if (listContainer) listContainer.style.display = 'none';

    // 3. Reset chips & KPIs
    renderCityBulkPropertyChips();
    updateCityBulkJoinedHotels();
    if (kpiProps) kpiProps.textContent = '0';
    if (kpiSub) kpiSub.textContent = '0 in city';
    if (kpiDays) kpiDays.textContent = '0';
    if (kpiRows) kpiRows.textContent = '0';
    if (kpiAvgMult) kpiAvgMult.textContent = '--';

    if (statusBadge) {
      statusBadge.textContent = 'Select a city to begin';
      statusBadge.style.background = '#f0fdf4';
      statusBadge.style.color = '#166534';
      statusBadge.style.borderColor = '#bbf7d0';
    }

    if (btnDownload) btnDownload.disabled = true;
    if (btnCopy) btnCopy.disabled = true;

    // 4. Re-render empty preview tables
    renderCityBulkMatrixTable();
    renderCityBulkPreviewTable();

    showToast('City Bulk Action reset', 'info');
  }

  // Populate City Bulk Action City Dropdown
  function populateCityBulkCityDropdown(resetToAll = false) {
    const citySelect = document.getElementById('city-bulk-city-select');
    const cityInput = document.getElementById('city-bulk-city-input');
    const clearBtn = document.getElementById('btn-city-bulk-city-clear');
    if (!hawkeyeBaseRatesMaster || hawkeyeBaseRatesMaster.length === 0) return;

    const currentVal = resetToAll ? '' : (citySelect ? citySelect.value : '');

    // Aggregate unique cities and count hotels per city
    const cityCounts = {};
    const seen = new Set();
    hawkeyeBaseRatesMaster.forEach(item => {
      const city = (item.city || '').trim();
      const id = item.rawHotelId || item.hotelId;
      if (!city || !id || seen.has(id)) return;
      seen.add(id);
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });

    cityBulkAvailableCities = Object.keys(cityCounts)
      .sort((a, b) => a.localeCompare(b))
      .map(city => ({
        name: city,
        count: cityCounts[city]
      }));

    if (cityInput) {
      cityInput.placeholder = `Search or select city (${cityBulkAvailableCities.length} available)...`;
    }

    if (resetToAll || !currentVal) {
      if (citySelect) citySelect.value = '';
      if (cityInput) cityInput.value = '';
      if (clearBtn) clearBtn.style.display = 'none';
    } else {
      const exists = cityBulkAvailableCities.find(c => c.name.toLowerCase() === currentVal.toLowerCase());
      if (exists) {
        if (citySelect) citySelect.value = exists.name;
        if (cityInput) cityInput.value = exists.name;
        if (clearBtn) clearBtn.style.display = 'block';
      } else {
        if (citySelect) citySelect.value = '';
        if (cityInput) cityInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
      }
    }

    renderCityBulkDropdown('');
  }

  // Render City Bulk Dropdown List
  function renderCityBulkDropdown(query = '') {
    const menu = document.getElementById('city-bulk-city-dropdown-menu');
    if (!menu) return;

    const q = (query || '').toLowerCase().trim();
    const currentSelected = (document.getElementById('city-bulk-city-select')?.value || '');
    const isShowingCurrentCity = currentSelected && q === currentSelected.toLowerCase();

    const filtered = (q && !isShowingCurrentCity)
      ? cityBulkAvailableCities.filter(c => c.name.toLowerCase().includes(q))
      : cityBulkAvailableCities;

    cityBulkActiveIndex = -1;

    if (filtered.length === 0) {
      menu.innerHTML = `<div style="padding: 12px; font-size: 0.82rem; color: #94a3b8; text-align: center;">No cities matching "${escapeHtml(query)}"</div>`;
      return;
    }

    menu.innerHTML = filtered.map((c, idx) => {
      const isSel = currentSelected && c.name.toLowerCase() === currentSelected.toLowerCase();
      return `
        <div class="searchable-city-item ${isSel ? 'selected' : ''}" data-index="${idx}" data-city="${escapeHtml(c.name)}">
          <span>${escapeHtml(c.name)}</span>
          <span class="city-prop-badge">${c.count} ${c.count === 1 ? 'hotel' : 'hotels'}</span>
        </div>
      `;
    }).join('');

    // Attach click events
    const items = menu.querySelectorAll('.searchable-city-item');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const cityName = item.getAttribute('data-city');
        selectCityBulkCity(cityName);
      });
    });
  }

  // Select a City from Dropdown
  function selectCityBulkCity(cityName) {
    const citySelect = document.getElementById('city-bulk-city-select');
    const cityInput = document.getElementById('city-bulk-city-input');
    const clearBtn = document.getElementById('btn-city-bulk-city-clear');
    const menu = document.getElementById('city-bulk-city-dropdown-menu');

    if (citySelect) citySelect.value = cityName;
    if (cityInput) cityInput.value = cityName;
    if (clearBtn) clearBtn.style.display = cityName ? 'block' : 'none';
    if (menu) menu.style.display = 'none';

    renderCityBulkDropdown(cityName);
    onCityBulkCityChange();
  }

  // When User Selects a City
  function onCityBulkCityChange() {
    const citySelect = document.getElementById('city-bulk-city-select');
    const selectedCity = citySelect ? citySelect.value.trim() : '';
    const statusBadge = document.getElementById('city-bulk-status-badge');
    const propCountSpan = document.getElementById('city-bulk-city-prop-count');

    if (!selectedCity) {
      cityBulkProperties = [];
      cityBulkPreviewRows = [];
      cityBulkFilteredRows = [];
      if (propCountSpan) propCountSpan.textContent = '';
      if (statusBadge) {
        statusBadge.textContent = 'Select a city to begin';
        statusBadge.style.background = '#f0fdf4';
        statusBadge.style.color = '#166534';
        statusBadge.style.borderColor = '#bbf7d0';
      }
      renderCityBulkPropertyChips();
      updateCityBulkSelectionKPI();
      updateCityBulkJoinedHotels();
      renderCityBulkMatrixTable();
      renderCityBulkPreviewTable();
      return;
    }

    // Filter properties for selected city
    const matching = hawkeyeBaseRatesMaster.filter(h => (h.city || '').toLowerCase() === selectedCity.toLowerCase());
    const seen = new Set();
    cityBulkProperties = [];

    matching.forEach(item => {
      const id = item.rawHotelId || item.hotelId;
      if (!id || seen.has(id)) return;
      seen.add(id);

      cityBulkProperties.push({
        hotelId: item.hotelId,
        rawHotelId: id,
        hotelName: item.hotelName || `Hotel ${id}`,
        city: item.city,
        p0: item.p0,
        status: item.status || 'Live',
        selected: true
      });
    });

    // Sort by Hotel Name
    cityBulkProperties.sort((a, b) => a.hotelName.localeCompare(b.hotelName));

    if (propCountSpan) {
      propCountSpan.textContent = `${cityBulkProperties.length} Properties`;
    }

    if (statusBadge) {
      statusBadge.textContent = `${cityBulkProperties.length} Properties in ${selectedCity}`;
      statusBadge.style.background = '#e0f2fe';
      statusBadge.style.color = '#0369a1';
      statusBadge.style.borderColor = '#bae6fd';
    }

    renderCityBulkPropertyChips();
    updateCityBulkSelectionKPI();
    updateCityBulkJoinedHotels();

    // Auto-generate preview if dates and ask price are already filled
    const askMonInput = document.getElementById('city-bulk-ask-mon');
    const askFriInput = document.getElementById('city-bulk-ask-fri');
    const monVal = parseFloat(askMonInput?.value);
    const friVal = parseFloat(askFriInput?.value);
    const hasAnyPrice = (!isNaN(monVal) && monVal > 0) || (!isNaN(friVal) && friVal > 0);
    if (hasAnyPrice) {
      generateCityBulkPreview(false);
    } else {
      cityBulkPreviewRows = [];
      cityBulkFilteredRows = [];
      renderCityBulkMatrixTable();
      renderCityBulkPreviewTable();
    }
  }

  // Render Property Scope Checkbox Chips
  function renderCityBulkPropertyChips() {
    const container = document.getElementById('city-bulk-properties-chip-container');
    if (!container) return;

    if (cityBulkProperties.length === 0) {
      container.innerHTML = `
        <div style="font-size: 0.78rem; color: var(--text-muted); text-align: center; padding: 18px 0;">
          Select a city to load properties and their P0 base rates.
        </div>`;
      return;
    }

    container.innerHTML = cityBulkProperties.map(prop => {
      const hasP0 = prop.p0 && prop.p0 !== '-' && !isNaN(parseFloat(String(prop.p0).replace(/,/g, '')));
      const p0Display = hasP0 ? `₹${prop.p0}` : 'No P0';
      const p0Color = hasP0 ? '#0369a1' : '#dc2626';
      const p0Bg = hasP0 ? '#e0f2fe' : '#fee2e2';

      return `
        <div class="city-bulk-property-chip ${prop.selected ? '' : 'excluded'}">
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; flex: 1; min-width: 0; margin-bottom: 0;">
            <input type="checkbox" class="city-bulk-prop-cb" data-hotel-id="${escapeHtml(prop.rawHotelId)}" ${prop.selected ? 'checked' : ''}>
            <span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #1e293b;" title="${escapeHtml(prop.hotelName)}">
              ${escapeHtml(prop.hotelName)}
            </span>
            <span style="color: var(--text-muted); font-size: 0.7rem; flex-shrink: 0;">(${escapeHtml(prop.rawHotelId)})</span>
          </label>
          <div style="display: flex; align-items: center; gap: 6px; margin-left: 8px; flex-shrink: 0;">
            <span class="badge-p0" style="background: ${p0Bg}; color: ${p0Color}; border-color: ${hasP0 ? '#bae6fd' : '#fecaca'};" title="Hawkeye P0 Base Rate">
              ${escapeHtml(p0Display)}
            </span>
            ${prop.status === 'Stop Sell' ? '<span class="status-badge status-stopsell" style="font-size: 0.65rem; padding: 1px 4px;">StopSell</span>' : ''}
          </div>
        </div>`;
    }).join('');

    // Bind checkbox change events
    const checkboxes = container.querySelectorAll('.city-bulk-prop-cb');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = cb.dataset.hotelId;
        const checked = cb.checked;
        const chip = cb.closest('.city-bulk-property-chip');
        if (chip) {
          if (checked) chip.classList.remove('excluded');
          else chip.classList.add('excluded');
        }

        const prop = cityBulkProperties.find(p => p.rawHotelId === id);
        if (prop) prop.selected = checked;

        updateCityBulkSelectionKPI();
        updateCityBulkJoinedHotels();
        if (cityBulkPreviewRows.length > 0) {
          generateCityBulkPreview(false);
        }
      });
    });
  }

  // Update Scope KPI Count
  function updateCityBulkSelectionKPI() {
    const kpiProps = document.getElementById('kpi-bulk-props');
    const kpiSub = document.getElementById('kpi-bulk-props-sub');
    const selectedCount = cityBulkProperties.filter(p => p.selected).length;
    const totalCount = cityBulkProperties.length;

    if (kpiProps) kpiProps.textContent = selectedCount;
    if (kpiSub) kpiSub.textContent = `${totalCount} in city`;
  }

  // Generate Daily Rule Rows Preview
  function generateCityBulkPreview(showNotice = true) {
    const citySelect = document.getElementById('city-bulk-city-select');
    const selectedCity = citySelect ? citySelect.value.trim() : '';

    if (!selectedCity) {
      if (showNotice) showToast('Please select a city first', 'warning');
      return;
    }

    const selectedProps = cityBulkProperties.filter(p => p.selected);
    if (selectedProps.length === 0) {
      if (showNotice) showToast('Please select at least one property in scope', 'warning');
      return;
    }

    const startDateInput = document.getElementById('city-bulk-start-date');
    const endDateInput = document.getElementById('city-bulk-end-date');
    const startDateVal = startDateInput ? startDateInput.value : '';
    const endDateVal = endDateInput ? endDateInput.value : '';

    if (!startDateVal || !endDateVal) {
      if (showNotice) showToast('Please select both Start Date and End Date', 'warning');
      return;
    }

    const startParts = startDateVal.split('-').map(Number);
    const endParts = endDateVal.split('-').map(Number);
    const curDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const endDateObj = new Date(endParts[0], endParts[1] - 1, endParts[2]);

    if (curDate > endDateObj) {
      if (showNotice) showToast('Start Date cannot be after End Date', 'error');
      return;
    }

    const flexibility = document.getElementById('city-bulk-flexibility')?.value || 'non-flex';
    const flexFactor = (flexibility === 'flex') ? 0.72 : 0.69;
    const dayGroup = document.getElementById('city-bulk-day-group')?.value || 'all';

    const askMon = document.getElementById('city-bulk-ask-mon');
    const askTue = document.getElementById('city-bulk-ask-tue');
    const askWed = document.getElementById('city-bulk-ask-wed');
    const askThu = document.getElementById('city-bulk-ask-thu');
    const askFri = document.getElementById('city-bulk-ask-fri');
    const askSat = document.getElementById('city-bulk-ask-sat');
    const askSun = document.getElementById('city-bulk-ask-sun');

    const sameMonThuCb = document.getElementById('city-bulk-same-mon-thu');
    const sameWeekendCb = document.getElementById('city-bulk-same-weekend');
    const skipMonCb = document.getElementById('city-bulk-skip-mon');
    const skipTueCb = document.getElementById('city-bulk-skip-tue');
    const skipWedCb = document.getElementById('city-bulk-skip-wed');
    const skipThuCb = document.getElementById('city-bulk-skip-thu');
    const skipFriCb = document.getElementById('city-bulk-skip-fri');
    const skipSatCb = document.getElementById('city-bulk-skip-sat');
    const skipSunCb = document.getElementById('city-bulk-skip-sun');

    const skipMon = (dayGroup === 'weekends_only') || !!skipMonCb?.checked;
    const skipTue = (dayGroup === 'weekends_only') || !!skipTueCb?.checked;
    const skipWed = (dayGroup === 'weekends_only') || !!skipWedCb?.checked;
    const skipThu = (dayGroup === 'weekends_only') || !!skipThuCb?.checked;
    const skipFri = (dayGroup === 'weekdays_only') || !!skipFriCb?.checked;
    const skipSat = (dayGroup === 'weekdays_only') || !!skipSatCb?.checked;
    const skipSun = (dayGroup === 'weekdays_only') || !!skipSunCb?.checked;

    let valMon = parseFloat(askMon?.value);
    let valTue = parseFloat(askTue?.value);
    let valWed = parseFloat(askWed?.value);
    let valThu = parseFloat(askThu?.value);

    if (sameMonThuCb && sameMonThuCb.checked) {
      let sharedWeekdayPrice = valMon;
      if (skipMon && !skipTue) sharedWeekdayPrice = valTue;
      else if (skipMon && skipTue && !skipWed) sharedWeekdayPrice = valWed;
      else if (skipMon && skipTue && skipWed && !skipThu) sharedWeekdayPrice = valThu;

      if (!skipMon) valMon = sharedWeekdayPrice;
      if (!skipTue) valTue = sharedWeekdayPrice;
      if (!skipWed) valWed = sharedWeekdayPrice;
      if (!skipThu) valThu = sharedWeekdayPrice;
    }

    let valFri = parseFloat(askFri?.value);
    let valSat = parseFloat(askSat?.value);
    let valSun = parseFloat(askSun?.value);

    if (sameWeekendCb && sameWeekendCb.checked) {
      let sharedWeekendPrice = valFri;
      if (skipFri && !skipSat) sharedWeekendPrice = valSat;
      else if (skipFri && skipSat && !skipSun) sharedWeekendPrice = valSun;

      if (!skipFri) valFri = sharedWeekendPrice;
      if (!skipSat) valSat = sharedWeekendPrice;
      if (!skipSun) valSun = sharedWeekendPrice;
    }

    // Validation for active day groups
    if (dayGroup !== 'weekends_only') {
      const allWeekdaySkipped = (skipMon && skipTue && skipWed && skipThu);
      if (!allWeekdaySkipped) {
        if (sameMonThuCb && sameMonThuCb.checked) {
          let sharedWeekdayPrice = valMon;
          let baseDayName = 'Monday';
          let baseInput = askMon;
          if (skipMon && !skipTue) { sharedWeekdayPrice = valTue; baseDayName = 'Tuesday'; baseInput = askTue; }
          else if (skipMon && skipTue && !skipWed) { sharedWeekdayPrice = valWed; baseDayName = 'Wednesday'; baseInput = askWed; }
          else if (skipMon && skipTue && skipWed && !skipThu) { sharedWeekdayPrice = valThu; baseDayName = 'Thursday'; baseInput = askThu; }

          if (isNaN(sharedWeekdayPrice) || sharedWeekdayPrice <= 0) {
            if (showNotice) showToast(`Please enter a valid positive Ask Price for ${baseDayName}`, 'warning');
            if (baseInput) baseInput.focus();
            return;
          }
          if (!skipMon) valMon = sharedWeekdayPrice;
          if (!skipTue) valTue = sharedWeekdayPrice;
          if (!skipWed) valWed = sharedWeekdayPrice;
          if (!skipThu) valThu = sharedWeekdayPrice;
        } else {
          // Custom weekday prices
          if (!skipMon && (isNaN(valMon) || valMon <= 0)) {
            if (showNotice) showToast('Please enter a valid positive Ask Price for Monday or check Skip', 'warning');
            if (askMon) askMon.focus();
            return;
          }
          if (!skipTue && (isNaN(valTue) || valTue <= 0)) {
            if (showNotice) showToast('Please enter a valid positive Ask Price for Tuesday or check Skip', 'warning');
            if (askTue) askTue.focus();
            return;
          }
          if (!skipWed && (isNaN(valWed) || valWed <= 0)) {
            if (showNotice) showToast('Please enter a valid positive Ask Price for Wednesday or check Skip', 'warning');
            if (askWed) askWed.focus();
            return;
          }
          if (!skipThu && (isNaN(valThu) || valThu <= 0)) {
            if (showNotice) showToast('Please enter a valid positive Ask Price for Thursday or check Skip', 'warning');
            if (askThu) askThu.focus();
            return;
          }
        }
      }
    }

    if (dayGroup !== 'weekdays_only') {
      const allWeekendSkipped = (skipFri && skipSat && skipSun);
      if (!allWeekendSkipped) {
        if (sameWeekendCb && sameWeekendCb.checked) {
          let sharedWeekendPrice = valFri;
          let baseDayName = 'Friday';
          let baseInput = askFri;
          if (skipFri && !skipSat) { sharedWeekendPrice = valSat; baseDayName = 'Saturday'; baseInput = askSat; }
          else if (skipFri && skipSat && !skipSun) { sharedWeekendPrice = valSun; baseDayName = 'Sunday'; baseInput = askSun; }

          if (isNaN(sharedWeekendPrice) || sharedWeekendPrice <= 0) {
            if (showNotice) showToast(`Please enter a valid positive Ask Price for ${baseDayName}`, 'warning');
            if (baseInput) baseInput.focus();
            return;
          }
          if (!skipFri) valFri = sharedWeekendPrice;
          if (!skipSat) valSat = sharedWeekendPrice;
          if (!skipSun) valSun = sharedWeekendPrice;
        } else {
          // Custom Weekend Prices
          if (!skipFri && (isNaN(valFri) || valFri <= 0)) {
            if (showNotice) showToast('Please enter a valid positive Ask Price for Friday or check Skip', 'warning');
            if (askFri) askFri.focus();
            return;
          }
          if (!skipSat && (isNaN(valSat) || valSat <= 0)) {
            if (showNotice) showToast('Please enter a valid positive Ask Price for Saturday or check Skip', 'warning');
            if (askSat) askSat.focus();
            return;
          }
          if (!skipSun && (isNaN(valSun) || valSun <= 0)) {
            if (showNotice) showToast('Please enter a valid positive Ask Price for Sunday or check Skip', 'warning');
            if (askSun) askSun.focus();
            return;
          }
        }
      }
    }

    if (skipMon && skipTue && skipWed && skipThu && skipFri && skipSat && skipSun) {
      if (showNotice) showToast('All days are skipped. Please uncheck skip for at least one day.', 'warning');
      return;
    }

    const dayPrices = {
      1: skipMon ? 0 : valMon,
      2: skipTue ? 0 : valTue,
      3: skipWed ? 0 : valWed,
      4: skipThu ? 0 : valThu,
      5: skipFri ? 0 : valFri,
      6: skipSat ? 0 : valSat,
      0: skipSun ? 0 : valSun
    };

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const rows = [];
    const activeDaysSet = new Set();
    let totalMultipliersSum = 0;
    let validMultipliersCount = 0;

    while (curDate <= endDateObj) {
      const dow = curDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const isWeekend = (dow === 5 || dow === 6 || dow === 0);

      let skip = false;
      if (dayGroup === 'weekdays_only' && isWeekend) skip = true;
      if (dayGroup === 'weekends_only' && !isWeekend) skip = true;
      if (dow === 1 && skipMon) skip = true;
      if (dow === 2 && skipTue) skip = true;
      if (dow === 3 && skipWed) skip = true;
      if (dow === 4 && skipThu) skip = true;
      if (dow === 5 && skipFri) skip = true;
      if (dow === 6 && skipSat) skip = true;
      if (dow === 0 && skipSun) skip = true;

      if (!skip) {
        const yyyy = curDate.getFullYear();
        const mm = String(curDate.getMonth() + 1).padStart(2, '0');
        const dd = String(curDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const yyyymmdd = `${yyyy}${mm}${dd}`;
        const dayName = dayNames[dow];
        const dayType = isWeekend ? 'Weekend' : 'Weekday';
        const targetAskPrice = dayPrices[dow];
        const newPrice = Math.round(targetAskPrice / 1.05 / flexFactor);

        activeDaysSet.add(dateStr);

        selectedProps.forEach(prop => {
          const p0Num = parseFloat(String(prop.p0).replace(/,/g, ''));
          let multiplier = '-';
          let isValid = false;

          if (!isNaN(p0Num) && p0Num > 0) {
            multiplier = (newPrice / p0Num).toFixed(2);
            isValid = true;
            totalMultipliersSum += parseFloat(multiplier);
            validMultipliersCount++;
          }

          rows.push({
            hotelId: prop.hotelId,
            rawHotelId: prop.rawHotelId,
            hotelName: prop.hotelName,
            city: prop.city,
            date: dateStr,
            yyyymmdd: yyyymmdd,
            dayName: dayName,
            isWeekend: isWeekend,
            dayType: dayType,
            p0: (!isNaN(p0Num) && p0Num > 0) ? String(Math.round(p0Num)) : (prop.p0 || '-'),
            askPrice: Math.round(targetAskPrice),
            newPrice: newPrice,
            multiplier: multiplier,
            isValid: isValid
          });
        });
      }

      curDate.setDate(curDate.getDate() + 1);
    }

    cityBulkConfig = {
      flexFactor: flexFactor,
      dayGroup: dayGroup,
      dayPrices: { ...dayPrices },
      skippedDays: {
        1: skipMon,
        2: skipTue,
        3: skipWed,
        4: skipThu,
        5: skipFri,
        6: skipSat,
        0: skipSun
      }
    };

    cityBulkPreviewRows = rows;

    // Update KPI Metric Cards
    const kpiProps = document.getElementById('kpi-bulk-props');
    const kpiDays = document.getElementById('kpi-bulk-days');
    const kpiRows = document.getElementById('kpi-bulk-rows');
    const kpiAvgMult = document.getElementById('kpi-bulk-avg-mult');
    const btnDownload = document.getElementById('btn-city-bulk-download');
    const btnCopy = document.getElementById('btn-city-bulk-copy');
    const statusBadge = document.getElementById('city-bulk-status-badge');

    if (kpiProps) kpiProps.textContent = selectedProps.length;
    if (kpiDays) kpiDays.textContent = activeDaysSet.size;
    if (kpiRows) kpiRows.textContent = rows.length;

    if (kpiAvgMult) {
      if (validMultipliersCount > 0) {
        kpiAvgMult.textContent = (totalMultipliersSum / validMultipliersCount).toFixed(2) + '×';
      } else {
        kpiAvgMult.textContent = '--';
      }
    }

    if (btnDownload) btnDownload.disabled = rows.length === 0;
    if (btnCopy) btnCopy.disabled = selectedProps.length === 0;

    if (statusBadge) {
      statusBadge.textContent = `Generated ${rows.length} rows (${selectedProps.length} props × ${activeDaysSet.size} days)`;
      statusBadge.style.background = '#f0fdf4';
      statusBadge.style.color = '#166534';
      statusBadge.style.borderColor = '#bbf7d0';
    }

    if (showNotice) {
      showToast(`Generated preview for ${rows.length} rule rows across ${selectedProps.length} properties!`, 'success');
    }

    applyCityBulkPreviewFilters();
  }

  // Search Filter on Preview Rows
  function applyCityBulkPreviewFilters() {
    const searchInput = document.getElementById('city-bulk-preview-search');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (!query) {
      cityBulkFilteredRows = cityBulkPreviewRows;
    } else {
      cityBulkFilteredRows = cityBulkPreviewRows.filter(r =>
        (r.rawHotelId && r.rawHotelId.toLowerCase().includes(query)) ||
        (r.hotelId && r.hotelId.toLowerCase().includes(query)) ||
        (r.hotelName && r.hotelName.toLowerCase().includes(query)) ||
        (r.date && r.date.includes(query)) ||
        (r.dayName && r.dayName.toLowerCase().includes(query)) ||
        (r.city && r.city.toLowerCase().includes(query))
      );
    }

    cityBulkCurrentPage = 1;
    if (cityBulkCurrentView === 'matrix') {
      renderCityBulkMatrixTable();
    } else {
      renderCityBulkPreviewTable();
    }
  }

  // Render Hotel x Day Matrix Pivot View Table
  function renderCityBulkMatrixTable() {
    const tbody = document.getElementById('city-bulk-matrix-tbody');
    const thead = document.getElementById('city-bulk-matrix-thead');
    const countBadge = document.getElementById('city-bulk-preview-count-badge');
    const pageBadge = document.getElementById('city-bulk-current-page-badge');
    const prevBtn = document.getElementById('btn-city-bulk-prev-page');
    const nextBtn = document.getElementById('btn-city-bulk-next-page');
    const paginationInfo = document.getElementById('city-bulk-pagination-info');

    if (!tbody || !thead) return;

    const selectedProps = cityBulkProperties.filter(p => p.selected);
    const searchInput = document.getElementById('city-bulk-preview-search');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredProps = !query ? selectedProps : selectedProps.filter(p =>
      (p.rawHotelId && p.rawHotelId.toLowerCase().includes(query)) ||
      (p.hotelId && p.hotelId.toLowerCase().includes(query)) ||
      (p.hotelName && p.hotelName.toLowerCase().includes(query)) ||
      (p.city && p.city.toLowerCase().includes(query))
    );

    const totalFiltered = filteredProps.length;
    const totalMaster = selectedProps.length;

    if (countBadge) {
      countBadge.textContent = `${totalFiltered} of ${totalMaster} Properties`;
    }

    if (totalFiltered === 0 || cityBulkPreviewRows.length === 0) {
      thead.innerHTML = `
        <tr>
          <th style="min-width: 45px;">#</th>
          <th style="min-width: 95px;">CS ID</th>
          <th style="min-width: 220px;">Property Name</th>
          <th class="cell-num-right" style="min-width: 85px; color: #0284c7;">Base P0</th>
          <th class="cell-num-right" style="min-width: 100px;">Target Ask</th>
          <th class="cell-num-right" style="min-width: 100px; color: #0284c7; font-weight: 700;">TDF Factor</th>
        </tr>`;
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
            <i data-lucide="layers" style="width: 32px; height: 32px; margin-bottom: 8px; display: inline-block; opacity: 0.5;"></i>
            <div>${totalMaster === 0 || cityBulkPreviewRows.length === 0 ? 'Select a city, set dates & ask price, then click <strong>Generate Preview</strong> to inspect the pricing matrix.' : 'No properties match your search filter.'}</div>
          </td>
        </tr>`;
      if (pageBadge) pageBadge.textContent = 'Page 1 of 1';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      if (paginationInfo) paginationInfo.textContent = '0 items';
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Determine Situation & Column Setup
    const weekDays = [
      { dow: 1, name: 'Mon', fullName: 'Monday', isWeekend: false },
      { dow: 2, name: 'Tue', fullName: 'Tuesday', isWeekend: false },
      { dow: 3, name: 'Wed', fullName: 'Wednesday', isWeekend: false },
      { dow: 4, name: 'Thu', fullName: 'Thursday', isWeekend: false },
      { dow: 5, name: 'Fri', fullName: 'Friday', isWeekend: true },
      { dow: 6, name: 'Sat', fullName: 'Saturday', isWeekend: true },
      { dow: 0, name: 'Sun', fullName: 'Sunday', isWeekend: true }
    ];

    const dayGroup = cityBulkConfig ? cityBulkConfig.dayGroup : 'all';
    const flexFactor = (cityBulkConfig && cityBulkConfig.flexFactor) || 0.69;
    const dayPrices = (cityBulkConfig && cityBulkConfig.dayPrices) || {};

    weekDays.forEach(d => {
      if (dayGroup === 'weekdays_only' && d.isWeekend) d.skipped = true;
      else if (dayGroup === 'weekends_only' && !d.isWeekend) d.skipped = true;
      else if (cityBulkConfig && cityBulkConfig.skippedDays && cityBulkConfig.skippedDays[d.dow]) d.skipped = true;
      else d.skipped = false;
      d.askPrice = typeof dayPrices[d.dow] === 'number' ? dayPrices[d.dow] : (parseFloat(dayPrices[d.dow]) || 0);
    });

    const activeDays = weekDays.filter(d => !d.skipped);
    const allActivePricesSame = activeDays.length > 0 && activeDays.every(d => d.askPrice === activeDays[0].askPrice);

    // Contiguous groups for Situation 2 vs Situation 1
    const contiguousGroups = [];
    let currentGroup = null;

    weekDays.forEach(d => {
      if (d.skipped) {
        if (currentGroup && !currentGroup.isSkipped) {
          contiguousGroups.push(currentGroup);
          currentGroup = null;
        }
        if (!currentGroup) {
          currentGroup = { isSkipped: true, days: [d], askPrice: 0 };
        } else {
          currentGroup.days.push(d);
        }
        return;
      }

      if (currentGroup && currentGroup.isSkipped) {
        contiguousGroups.push(currentGroup);
        currentGroup = null;
      }

      if (!currentGroup) {
        currentGroup = { isSkipped: false, days: [d], askPrice: d.askPrice };
      } else if (currentGroup.askPrice === d.askPrice) {
        currentGroup.days.push(d);
      } else {
        contiguousGroups.push(currentGroup);
        currentGroup = { isSkipped: false, days: [d], askPrice: d.askPrice };
      }
    });
    if (currentGroup) contiguousGroups.push(currentGroup);

    const hasMultiDayGroup = contiguousGroups.some(g => !g.isSkipped && g.days.length > 1);

    // Pagination calculations
    const effectivePageSize = cityBulkPageSize === 'all' ? totalFiltered : parseInt(cityBulkPageSize, 10);
    const totalPages = Math.ceil(totalFiltered / effectivePageSize) || 1;

    if (cityBulkCurrentPage > totalPages) cityBulkCurrentPage = totalPages;
    if (cityBulkCurrentPage < 1) cityBulkCurrentPage = 1;

    const startIdx = (cityBulkCurrentPage - 1) * effectivePageSize;
    const endIdx = Math.min(startIdx + effectivePageSize, totalFiltered);
    const pageItems = filteredProps.slice(startIdx, endIdx);

    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${startIdx + 1}–${endIdx} of ${totalFiltered}`;
    }
    if (pageBadge) {
      pageBadge.textContent = `Page ${cityBulkCurrentPage} of ${totalPages}`;
    }
    if (prevBtn) prevBtn.disabled = cityBulkCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = cityBulkCurrentPage >= totalPages;

    // SCENARIO 3: Flat Price Across All Active Days
    if (allActivePricesSame) {
      const targetAsk = activeDays[0].askPrice;
      const newPrice = Math.round(targetAsk / 1.05 / flexFactor);

      thead.innerHTML = `
        <tr>
          <th style="min-width: 45px;">#</th>
          <th style="min-width: 95px;">CS ID</th>
          <th style="min-width: 220px;">Property Name</th>
          <th class="cell-num-right" style="min-width: 85px; color: #0284c7;" title="Hawkeye P0 Base Rate">Base P0</th>
          <th class="cell-num-right" style="min-width: 105px; color: #ea580c;" title="User Ask Price">Ask Price (Target)</th>
          <th class="cell-num-right" style="min-width: 115px; color: #16a34a;" title="Target Price ÷ 1.05 ÷ Flexibility">Calc Price (Effective)</th>
          <th class="cell-num-right" style="min-width: 105px; color: #0284c7; font-weight: 700;" title="Calculated TDF Multiplier (Calc Price / P0)">TDF Factor</th>
        </tr>`;

      tbody.innerHTML = pageItems.map((prop, i) => {
        const rowNum = startIdx + i + 1;
        const p0Num = parseFloat(String(prop.p0).replace(/,/g, ''));
        let factorCell = '';
        if (!isNaN(p0Num) && p0Num > 0) {
          const mult = (newPrice / p0Num).toFixed(2);
          factorCell = `<span class="matrix-mult-badge">${mult}×</span>`;
        } else {
          factorCell = `<span class="matrix-mult-missing">Missing P0</span>`;
        }

        return `
          <tr>
            <td style="color: var(--text-muted); font-size: 0.75rem;">${rowNum}</td>
            <td style="font-family: monospace; font-weight: 700; color: #0f172a;">${escapeHtml(prop.rawHotelId)}</td>
            <td style="font-weight: 600; color: #1e293b; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(prop.hotelName)}">
              ${escapeHtml(prop.hotelName)}
            </td>
            <td class="cell-num-right" style="color: #0284c7; font-weight: 600;">₹${prop.p0 || '-'}</td>
            <td class="cell-num-right" style="color: #ea580c; font-weight: 600;">₹${targetAsk}</td>
            <td class="cell-num-right" style="color: #16a34a; font-weight: 600;">₹${newPrice}</td>
            <td class="cell-num-right">${factorCell}</td>
          </tr>`;
      }).join('');

    } else if (hasMultiDayGroup) {
      // SCENARIO 2: Grouped Day Targets (e.g. Mon-Thu same, Fri-Sat same, Sun different)
      thead.innerHTML = `
        <tr>
          <th style="min-width: 45px;">#</th>
          <th style="min-width: 95px;">CS ID</th>
          <th style="min-width: 220px;">Property Name</th>
          <th class="cell-num-right" style="min-width: 85px; color: #0284c7;" title="Hawkeye P0 Base Rate">Base P0</th>
          ${contiguousGroups.map(grp => {
            if (grp.isSkipped) {
              const label = grp.days.length === 1 ? grp.days[0].name : `${grp.days[0].name}–${grp.days[grp.days.length - 1].name}`;
              return `<th class="cell-num-right" style="min-width: 95px; color: #94a3b8;">${label}<br><span style="font-weight: 400; font-size: 0.72rem; color: #cbd5e1;">(Skipped)</span></th>`;
            }
            const label = grp.days.length === 1
              ? `${grp.days[0].name} (1 Day)`
              : `${grp.days[0].name}–${grp.days[grp.days.length - 1].name} (${grp.days.length} Days)`;
            const isWeekend = grp.days.some(d => d.isWeekend);
            return `<th class="cell-num-right" style="min-width: 120px; color: ${isWeekend ? '#92400e' : '#1e293b'};">
              ${label}<br>
              <span style="font-weight: 500; font-size: 0.72rem; color: #ea580c;">Target: ₹${grp.askPrice}</span>
            </th>`;
          }).join('')}
        </tr>`;

      tbody.innerHTML = pageItems.map((prop, i) => {
        const rowNum = startIdx + i + 1;
        const p0Num = parseFloat(String(prop.p0).replace(/,/g, ''));

        const cells = contiguousGroups.map(grp => {
          if (grp.isSkipped) {
            return `<td class="cell-num-right"><span class="matrix-mult-skipped">--</span></td>`;
          }
          if (isNaN(p0Num) || p0Num <= 0) {
            return `<td class="cell-num-right"><span class="matrix-mult-missing">Missing P0</span></td>`;
          }
          const newPrice = Math.round(grp.askPrice / 1.05 / flexFactor);
          const mult = (newPrice / p0Num).toFixed(2);
          return `<td class="cell-num-right"><span class="matrix-mult-badge">${mult}×</span></td>`;
        }).join('');

        return `
          <tr>
            <td style="color: var(--text-muted); font-size: 0.75rem;">${rowNum}</td>
            <td style="font-family: monospace; font-weight: 700; color: #0f172a;">${escapeHtml(prop.rawHotelId)}</td>
            <td style="font-weight: 600; color: #1e293b; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(prop.hotelName)}">
              ${escapeHtml(prop.hotelName)}
            </td>
            <td class="cell-num-right" style="color: #0284c7; font-weight: 600;">₹${prop.p0 || '-'}</td>
            ${cells}
          </tr>`;
      }).join('');

    } else {
      // SCENARIO 1: Different Daily Ask Prices Across All Days
      thead.innerHTML = `
        <tr>
          <th style="min-width: 45px;">#</th>
          <th style="min-width: 95px;">CS ID</th>
          <th style="min-width: 220px;">Property Name</th>
          <th class="cell-num-right" style="min-width: 85px; color: #0284c7;" title="Hawkeye P0 Base Rate">Base P0</th>
          ${weekDays.map(d => {
            if (d.skipped) {
              return `<th class="cell-num-right" style="min-width: 85px; color: #94a3b8;">${d.name}<br><span style="font-weight: 400; font-size: 0.72rem; color: #cbd5e1;">(Skipped)</span></th>`;
            }
            return `<th class="cell-num-right" style="min-width: 95px; color: ${d.isWeekend ? '#92400e' : '#1e293b'};">
              ${d.name}<br>
              <span style="font-weight: 500; font-size: 0.72rem; color: #ea580c;">Target: ₹${d.askPrice}</span>
            </th>`;
          }).join('')}
        </tr>`;

      tbody.innerHTML = pageItems.map((prop, i) => {
        const rowNum = startIdx + i + 1;
        const p0Num = parseFloat(String(prop.p0).replace(/,/g, ''));

        const cells = weekDays.map(d => {
          if (d.skipped) {
            return `<td class="cell-num-right"><span class="matrix-mult-skipped">--</span></td>`;
          }
          if (isNaN(p0Num) || p0Num <= 0) {
            return `<td class="cell-num-right"><span class="matrix-mult-missing">Missing P0</span></td>`;
          }
          const newPrice = Math.round(d.askPrice / 1.05 / flexFactor);
          const mult = (newPrice / p0Num).toFixed(2);
          return `<td class="cell-num-right"><span class="matrix-mult-badge">${mult}×</span></td>`;
        }).join('');

        return `
          <tr>
            <td style="color: var(--text-muted); font-size: 0.75rem;">${rowNum}</td>
            <td style="font-family: monospace; font-weight: 700; color: #0f172a;">${escapeHtml(prop.rawHotelId)}</td>
            <td style="font-weight: 600; color: #1e293b; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(prop.hotelName)}">
              ${escapeHtml(prop.hotelName)}
            </td>
            <td class="cell-num-right" style="color: #0284c7; font-weight: 600;">₹${prop.p0 || '-'}</td>
            ${cells}
          </tr>`;
      }).join('');
    }

    if (window.lucide) lucide.createIcons();
  }

  // Render Daily Preview Grid Table
  function renderCityBulkPreviewTable() {
    const tbody = document.getElementById('city-bulk-preview-tbody');
    const countBadge = document.getElementById('city-bulk-preview-count-badge');
    const pageBadge = document.getElementById('city-bulk-current-page-badge');
    const prevBtn = document.getElementById('btn-city-bulk-prev-page');
    const nextBtn = document.getElementById('btn-city-bulk-next-page');
    const paginationInfo = document.getElementById('city-bulk-pagination-info');

    if (!tbody) return;

    const totalFiltered = cityBulkFilteredRows.length;
    const totalMaster = cityBulkPreviewRows.length;

    if (countBadge) {
      countBadge.textContent = `${totalFiltered} of ${totalMaster} Rows`;
    }

    if (totalFiltered === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
            <i data-lucide="layers" style="width: 32px; height: 32px; margin-bottom: 8px; display: inline-block; opacity: 0.5;"></i>
            <div>${totalMaster === 0 ? 'Select a city, set dates & ask price, then click <strong>Generate Preview</strong>.' : 'No preview rows match your search filter.'}</div>
          </td>
        </tr>`;
      if (pageBadge) pageBadge.textContent = 'Page 1 of 1';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      if (paginationInfo) paginationInfo.textContent = '0 items';
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Pagination calculations
    const effectivePageSize = cityBulkPageSize === 'all' ? totalFiltered : parseInt(cityBulkPageSize, 10);
    const totalPages = Math.ceil(totalFiltered / effectivePageSize) || 1;

    if (cityBulkCurrentPage > totalPages) cityBulkCurrentPage = totalPages;
    if (cityBulkCurrentPage < 1) cityBulkCurrentPage = 1;

    const startIdx = (cityBulkCurrentPage - 1) * effectivePageSize;
    const endIdx = Math.min(startIdx + effectivePageSize, totalFiltered);
    const pageItems = cityBulkFilteredRows.slice(startIdx, endIdx);

    if (paginationInfo) {
      paginationInfo.textContent = `Showing ${startIdx + 1}–${endIdx} of ${totalFiltered}`;
    }
    if (pageBadge) {
      pageBadge.textContent = `Page ${cityBulkCurrentPage} of ${totalPages}`;
    }
    if (prevBtn) prevBtn.disabled = cityBulkCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = cityBulkCurrentPage >= totalPages;

    tbody.innerHTML = pageItems.map((r, i) => {
      const rowNum = startIdx + i + 1;
      const typeBadge = r.isWeekend
        ? `<span class="badge-weekend">Weekend</span>`
        : `<span class="badge-weekday">Weekday</span>`;

      const multiplierDisplay = r.isValid
        ? `<span style="font-weight: 700; color: #0284c7; background: #f0f9ff; padding: 2px 8px; border-radius: 4px; border: 1px solid #bae6fd;">${r.multiplier}×</span>`
        : `<span style="font-weight: 600; color: #dc2626; background: #fef2f2; padding: 2px 6px; border-radius: 4px; border: 1px solid #fecaca;" title="Missing P0 rate in Hawkeye dataset">Missing P0</span>`;

      return `
        <tr>
          <td style="color: var(--text-muted); font-size: 0.75rem;">${rowNum}</td>
          <td style="font-family: monospace; font-weight: 700; color: #0f172a;">${escapeHtml(r.rawHotelId)}</td>
          <td style="font-weight: 600; color: #1e293b; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(r.hotelName)}">
            ${escapeHtml(r.hotelName)}
          </td>
          <td>${escapeHtml(r.city)}</td>
          <td style="font-family: monospace; font-weight: 600;">${escapeHtml(r.date)}</td>
          <td><span style="font-weight: 600; color: ${r.isWeekend ? '#92400e' : '#475569'};">${escapeHtml(r.dayName)}</span></td>
          <td>${typeBadge}</td>
          <td class="cell-num-right" style="color: #0284c7; font-weight: 600;">₹${r.p0}</td>
          <td class="cell-num-right" style="color: #ea580c; font-weight: 600;">₹${r.askPrice}</td>
          <td class="cell-num-right" style="color: #16a34a; font-weight: 600;">₹${r.newPrice}</td>
          <td class="cell-num-right">${multiplierDisplay}</td>
        </tr>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // Download City Bulk Action Rules as CSV
  function downloadCityBulkCSV() {
    const validRows = cityBulkPreviewRows.filter(r => r.isValid);

    if (validRows.length === 0) {
      showToast('No valid rule rows available to export. Ensure properties have P0 prices loaded.', 'error');
      return;
    }

    const headers = ['hotel_ID', 'rule_type', 'start_range', 'end_range', 'multiplier', 'addition', 'start_price', 'end_price'];
    const chunkSize = 1000;
    const totalParts = Math.ceil(validRows.length / chunkSize);

    const citySelect = document.getElementById('city-bulk-city-select');
    const rawCityName = citySelect ? citySelect.value : 'city';
    const citySlug = rawCityName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const startDate = (document.getElementById('city-bulk-start-date')?.value || '').replace(/-/g, '');
    const endDate = (document.getElementById('city-bulk-end-date')?.value || '').replace(/-/g, '');

    for (let p = 0; p < totalParts; p++) {
      const chunk = validRows.slice(p * chunkSize, (p + 1) * chunkSize);
      let csvContent = headers.join(',') + '\n';

      chunk.forEach(row => {
        const line = [
          row.hotelId,
          'targetDate',
          row.yyyymmdd,
          row.yyyymmdd,
          row.multiplier,
          '',
          '',
          ''
        ];
        csvContent += line.join(',') + '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      const filename = totalParts > 1
        ? `city_bulk_${citySlug}_${startDate}_${endDate}_part${p + 1}.csv`
        : `city_bulk_${citySlug}_${startDate}_${endDate}.csv`;

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    showToast(`Successfully exported ${validRows.length} rule rows (${totalParts} CSV file${totalParts > 1 ? 's' : ''})!`, 'success');
  }

  // Copy City Bulk Joined Hotel IDs to Clipboard
  function copyCityBulkJoinedHotels() {
    const selectedHotels = cityBulkProperties
      .filter(p => p.selected)
      .map(p => (p.rawHotelId || p.hotelId || '').toString().trim())
      .filter(Boolean);

    if (selectedHotels.length === 0) {
      showToast('No properties selected in scope.', 'warning');
      return;
    }

    const textToCopy = selectedHotels.join(',');
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast(`Copied all ${selectedHotels.length} Joined Hotel IDs to clipboard!`, 'success');
    }).catch(err => {
      console.warn('Clipboard copy failed:', err);
      showToast('Could not copy to clipboard', 'error');
    });
  }

  // Update Joined Hotel IDs text box for City Bulk Action (Chunks into parts of max 100 hotel IDs for Hawkeye Admin)
  function updateCityBulkJoinedHotels() {
    const joinedBox = document.getElementById('city-bulk-joined-hotels-box');
    const container = document.getElementById('city-bulk-joined-hotels-container');
    const headerActions = document.getElementById('city-bulk-joined-hotels-header-actions');
    const btnCopy = document.getElementById('btn-city-bulk-copy');
    if (!joinedBox || !container) return;

    const selectedHotels = cityBulkProperties
      .filter(p => p.selected)
      .map(p => (p.rawHotelId || p.hotelId || '').toString().trim())
      .filter(Boolean);
    const total = selectedHotels.length;

    if (btnCopy) {
      btnCopy.disabled = total === 0;
    }

    if (total === 0) {
      joinedBox.style.display = 'none';
      container.innerHTML = '';
      if (headerActions) headerActions.innerHTML = '';
      return;
    }

    const CHUNK_SIZE = 100;
    const numParts = Math.ceil(total / CHUNK_SIZE);

    // Update header badge and actions
    if (headerActions) {
      if (numParts > 1) {
        const isCollapsed = joinedBox.classList.contains('collapsed');
        const iconSvg = isCollapsed
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`;
        headerActions.innerHTML = `
          <span class="joined-hotels-badge">${total} Hotels · ${numParts} Parts (Max 100 / part)</span>
          <button id="btn-city-bulk-copy-all-joined" class="btn btn-secondary btn-sm" title="Copy all ${total} hotel IDs" style="padding: 4px 10px; font-size: 0.75rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span>Copy All (${total})</span>
          </button>
          <button id="btn-city-bulk-toggle-joined-parts" class="btn btn-secondary btn-sm btn-toggle-joined" data-num-parts="${numParts}" title="Collapse or Expand parts list" style="padding: 4px 10px; font-size: 0.75rem;">
            ${iconSvg}
            <span class="toggle-text">${isCollapsed ? `Show Parts (${numParts})` : 'Collapse'}</span>
          </button>
        `;
      } else {
        headerActions.innerHTML = `
          <span class="joined-hotels-badge">${total} Hotel${total > 1 ? 's' : ''}</span>
        `;
      }
    }

    // Generate part rows
    let partsHtml = '';
    for (let i = 0; i < numParts; i++) {
      const startIdx = i * CHUNK_SIZE;
      const endIdx = Math.min((i + 1) * CHUNK_SIZE, total);
      const count = endIdx - startIdx;
      const partHotels = selectedHotels.slice(startIdx, endIdx);
      const joinedText = partHotels.join(',');
      const partNum = i + 1;

      if (numParts > 1) {
        partsHtml += `
          <div class="joined-hotels-part">
            <div class="joined-hotels-part-header">
              <span>Part ${partNum} (Hotels ${startIdx + 1}–${endIdx} · ${count} IDs)</span>
            </div>
            <div class="joined-hotels-body">
              <input type="text" class="joined-hotels-text" readonly value="${escapeHtml(joinedText)}" onclick="this.select()">
              <button class="btn btn-secondary btn-sm btn-city-bulk-copy-part" data-part="${partNum}" data-range="${startIdx + 1}–${endIdx}" data-count="${count}" title="Copy Part ${partNum}">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                <span>Copy Part ${partNum}</span>
              </button>
            </div>
          </div>
        `;
      } else {
        partsHtml += `
          <div class="joined-hotels-body">
            <input type="text" id="city-bulk-joined-hotels-text" class="joined-hotels-text" readonly value="${escapeHtml(joinedText)}" onclick="this.select()">
            <button id="btn-city-bulk-copy-joined" class="btn btn-secondary btn-sm btn-city-bulk-copy-part" data-part="1" data-range="1–${total}" data-count="${total}" title="Copy to Clipboard">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span>Copy</span>
            </button>
          </div>
        `;
      }
    }

    container.innerHTML = partsHtml;
    joinedBox.style.display = 'block';
  }

