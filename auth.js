const jwt = require("jsonwebtoken")
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const COOKIE_NAME = "tdf_session";

// =========================================================================
// DEFAULT TEAM ROSTER (14 Users across 4 Roles)
// Based on MULTI_USER_ACCESS_PLAN.md
// =========================================================================
let dynamicRoster = [
  // 1. Admin (RevOps Lead)
  { id: "usr_admin", email: "admin@treebo.com", name: "Admin (RevOps Lead)", role: "Admin", active: true },
  { id: "usr_aditya", email: "aditya.kumar@treebo.com", name: "Aditya Kumar", role: "Admin", active: true },

  // 2. Pricing Managers (8 Users)
  { id: "usr_pm1", email: "pm1@treebo.com", name: "Pricing Manager 1", role: "Pricing Manager", active: true },
  { id: "usr_pm2", email: "pm2@treebo.com", name: "Pricing Manager 2", role: "Pricing Manager", active: true },
  { id: "usr_pm3", email: "pm3@treebo.com", name: "Pricing Manager 3", role: "Pricing Manager", active: true },
  { id: "usr_pm4", email: "pm4@treebo.com", name: "Pricing Manager 4", role: "Pricing Manager", active: true },
  { id: "usr_pm5", email: "pm5@treebo.com", name: "Pricing Manager 5", role: "Pricing Manager", active: true },
  { id: "usr_pm6", email: "pm6@treebo.com", name: "Pricing Manager 6", role: "Pricing Manager", active: true },
  { id: "usr_pm7", email: "pm7@treebo.com", name: "Pricing Manager 7", role: "Pricing Manager", active: true },
  { id: "usr_pm8", email: "pm8@treebo.com", name: "Pricing Manager 8", role: "Pricing Manager", active: true },

  // 3. RevOps Team (3 Users)
  { id: "usr_rev1", email: "revops1@treebo.com", name: "RevOps Team 1", role: "RevOps", active: true },
  { id: "usr_rev2", email: "revops2@treebo.com", name: "RevOps Team 2", role: "RevOps", active: true },
  { id: "usr_rev3", email: "revops3@treebo.com", name: "RevOps Team 3", role: "RevOps", active: true },

  // 4. Zonal Ops Team (3 Users)
  { id: "usr_zonal1", email: "zonal1@treebo.com", name: "Zonal Ops 1", role: "Zonal Ops", active: true },
  { id: "usr_zonal2", email: "zonal2@treebo.com", name: "Zonal Ops 2", role: "Zonal Ops", active: true },
  { id: "usr_zonal3", email: "zonal3@treebo.com", name: "Zonal Ops 3", role: "Zonal Ops", active: true }
];

// Helper: Sync roster from Google Sheets 'Access Control' tab rows if available
function syncRosterFromSheetRows(sheetRows) {
  if (!Array.isArray(sheetRows) || sheetRows.length < 2) return;
  const headers = sheetRows[0].map(h => String(h || '').trim().toLowerCase());
  const colEmail = headers.findIndex(h => h.includes('email'));
  const colName = headers.findIndex(h => h.includes('name'));
  const colRole = headers.findIndex(h => h.includes('role'));
  const colActive = headers.findIndex(h => h.includes('active') || h.includes('status'));

  if (colEmail === -1 || colRole === -1) return;

  const parsed = [];
  for (let i = 1; i < sheetRows.length; i++) {
    const row = sheetRows[i];
    const email = String(row[colEmail] || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    const name = colName !== -1 ? String(row[colName] || email.split('@')[0]).trim() : email.split('@')[0];
    const roleRaw = String(row[colRole] || 'Pricing Manager').trim();
    const activeStr = colActive !== -1 ? String(row[colActive] || 'true').trim().toLowerCase() : 'true';
    const active = activeStr !== 'false' && activeStr !== 'no' && activeStr !== '0';

    parsed.push({
      id: `usr_${parsed.length + 1}`,
      email,
      name,
      role: normalizeRole(roleRaw),
      active
    });
  }

  if (parsed.length > 0) {
    dynamicRoster = parsed;
    console.log(`Synced ${parsed.length} team members from Google Sheets Access Control tab ✅`);
  }
}

function normalizeRole(roleStr) {
  const r = String(roleStr || '').toLowerCase().trim();
  if (r.includes('admin')) return 'Admin';
  if (r.includes('pricing') || r.includes('pm')) return 'Pricing Manager';
  if (r.includes('revops') || r.includes('rev ops')) return 'RevOps';
  if (r.includes('zonal') || r.includes('ops')) return 'Zonal Ops';
  return 'Pricing Manager';
}

function getRoster() {
  return dynamicRoster;
}

function findUserByEmail(email) {
  if (!email) return null;

  const cleanEmail = email.toLowerCase().trim();

  // Only users present in the approved roster can log in
  const found = dynamicRoster.find(
    user =>
      user.email.toLowerCase() === cleanEmail &&
      user.active === true
  );

  return found || null;
}


function findUserById(id) {
  return dynamicRoster.find(u => u.id === id && u.active);
}

// =========================================================================
// JWT SESSION MANAGEMENT
// =========================================================================

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax"
  });
}

// Middleware: Extracts user from cookie or Bearer token header
function extractUser(req, res, next) {
  let token = req.cookies?.[COOKIE_NAME];
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      token = parts[1];
    }
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    req.user = null;
  }
  next();
}

// Middleware: Requires user to be authenticated
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Please sign in."
    });
  }
  next();
}

// Middleware: Restricts route to specific roles
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Authentication required." });
    }
    const userRole = (req.user.role || "").toLowerCase();
    const hasRole = allowedRoles.some(r => r.toLowerCase() === userRole);
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: `Access Denied: '${req.user.role}' role does not have permission for this resource.`
      });
    }
    next();
  };
}

module.exports = {
  getRoster,
  syncRosterFromSheetRows,
  findUserByEmail,
  findUserById,
  generateToken,
  setSessionCookie,
  clearSessionCookie,
  extractUser,
  requireAuth,
  requireRole,
  COOKIE_NAME
};
