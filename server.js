require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const auth = require("./auth.js");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(auth.extractUser);
const PORT = process.env.PORT || 3000;

console.log("Starting Daily Pricing Dashboard server...");

// =====================================================
// GOOGLE OAUTH CONFIGURATION
// =====================================================

let client_id = process.env.GOOGLE_CLIENT_ID;
let client_secret = process.env.GOOGLE_CLIENT_SECRET;

if (!client_id || !client_secret) {
    if (fs.existsSync("./oauth/client-secret.json")) {
        try {
            const credentials = JSON.parse(
                fs.readFileSync("./oauth/client-secret.json", "utf8")
            );
            client_id = credentials.web.client_id;
            client_secret = credentials.web.client_secret;
        } catch (e) {
            console.warn("Could not read ./oauth/client-secret.json:", e.message);
        }
    }
}

const REDIRECT_URI =
    process.env.REDIRECT_URI ||
    `http://localhost:${PORT}/oauth2callback`;

// OAuth client used for Google LOGIN
const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    REDIRECT_URI
);

const TOKENS_PATH = "./oauth/tokens.json";

// Separate OAuth client used for Google SHEETS
const sheetsOAuthClient = new google.auth.OAuth2(
    client_id,
    client_secret,
    REDIRECT_URI
);

// Load saved Google Sheets tokens
if (process.env.GOOGLE_SAVED_TOKENS) {
    try {
        const envTokens = JSON.parse(process.env.GOOGLE_SAVED_TOKENS);

        sheetsOAuthClient.setCredentials(envTokens);

        console.log("Loaded saved Google Sheets OAuth tokens from environment variable ✅");
    } catch (err) {
        console.warn(
            "Error parsing GOOGLE_SAVED_TOKENS env var:",
            err.message
        );
    }
} else if (fs.existsSync(TOKENS_PATH)) {
    try {
        const savedTokens = JSON.parse(
            fs.readFileSync(TOKENS_PATH, "utf8")
        );

        sheetsOAuthClient.setCredentials(savedTokens);

        console.log("Loaded saved Google Sheets OAuth tokens from file ✅");
    } catch (err) {
        console.warn(
            "Error reading tokens file:",
            err.message
        );
    }
}

// Automatically save refreshed tokens
sheetsOAuthClient.on("tokens", (tokens) => {
    try {
        const currentTokens = { ...sheetsOAuthClient.credentials, ...tokens };
        if (fs.existsSync("./oauth")) {
            fs.writeFileSync(TOKENS_PATH, JSON.stringify(currentTokens, null, 2));
            console.log("Updated OAuth tokens saved to disk ✅");
        }
    } catch (e) {
        console.error("Error saving updated tokens:", e);
    }
});



// =====================================================
// YOUR GOOGLE SPREADSHEET
// =====================================================

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1HbhMErLh8N2CdkBBJ_ubiv6S2FYx5g1_pNqoFOPo8eE";

// =====================================================
// LOAD ACCESS CONTROL FROM GOOGLE SHEET
// =====================================================

async function loadAccessControl() {
    try {
        if (!sheetsOAuthClient.credentials.access_token) {
            console.warn("Access Control: Google Sheets token not available locally. Checking fallback...");
            const fallbackHost = process.env.FALLBACK_DATA_URL || "https://tdf-automator.vercel.app";
            try {
                const fetchRes = await fetch(`${fallbackHost}/api/sheet-data`);
                if (fetchRes.ok) {
                    const fallbackData = await fetchRes.json();
                    if (fallbackData?.data?.accessControl && fallbackData.data.accessControl.length > 1) {
                        auth.syncRosterFromSheetRows(fallbackData.data.accessControl);
                        console.log(`Synced ${fallbackData.data.accessControl.length - 1} users from fallback sheet-data ✅`);
                        return;
                    }
                }
            } catch (fbErr) {
                console.warn("Fallback access control fetch failed:", fbErr.message);
            }
            return;
        }

        const sheets = google.sheets({
            version: "v4",
            auth: sheetsOAuthClient
        });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Access Control!A:Z"
        });

        const rows = response.data.values || [];

        if (rows.length < 2) {
            console.warn("Access Control sheet is empty or has no users.");
            return;
        }

        auth.syncRosterFromSheetRows(rows);

        console.log(
            `Access Control loaded: ${rows.length - 1} users from Google Sheets ✅`
        );

    } catch (error) {
        console.error(
            "Failed to load Access Control from Google Sheets:",
            error.message
        );
    }
}
loadAccessControl();

// =====================================================
// GOOGLE LOGIN
// =====================================================

app.get(["/auth/google", "/api/auth/google"], (req, res) => {

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",

        scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/spreadsheets.readonly"
        ]
    });

    res.redirect(authUrl);
});
app.get(["/api/auth/me", "/auth/me"], auth.requireAuth, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name,
            role: req.user.role
        }
    });
});


// =====================================================
// GOOGLE OAUTH CALLBACK
// =====================================================

app.get(["/oauth2callback", "/api/oauth2callback"], async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send("No authorization code received.");
    }

    try {
        // Exchange Google authorization code for login tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        sheetsOAuthClient.setCredentials(tokens);
        try {
            if (!fs.existsSync("./oauth")) {
                fs.mkdirSync("./oauth", { recursive: true });
            }
            fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
            console.log("Updated OAuth tokens saved to disk ✅");
        } catch (e) {
            console.warn("Could not save tokens to disk:", e.message);
        }

        // Get the Google user's identity
        const oauth2 = google.oauth2({
            auth: oauth2Client,
            version: "v2"
        });

        const { data: googleUser } = await oauth2.userinfo.get();

        const email = googleUser.email;

        console.log("Google user:", email);

        // Check whether this Google account is approved
        let user = auth.findUserByEmail(email);

        if (!user) {
            await loadAccessControl();
            user = auth.findUserByEmail(email);
        }

        if (!user) {
            return res.status(403).send(`
                <h1>Access Denied</h1>
                <p>Your Google account is not authorized to use TDF Automator.</p>
                <p>Logged in as: ${email}</p>
            `);
        }

        // Create application session
        const token = auth.generateToken(user);

        // Store session in HTTP-only cookie
        auth.setSessionCookie(res, token);

        console.log(
            `Login successful: ${email} (${user.role})`
        );

        // Return to the deployed application
        const frontendUrl =
            process.env.FRONTEND_URL || "/";

        res.redirect(frontendUrl);

    } catch (error) {
        console.error("OAuth error:", error);

        res.status(500).send(`
            <h1>Authentication failed ❌</h1>
            <p>${error.message || 'Please try again.'}</p>
        `);
    }
});

// =====================================================
// USER AUTHENTICATION & RBAC ENDPOINTS
// =====================================================

// Localhost-only session bootstrap (strictly disabled on Vercel and Production)
if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
    app.get("/api/auth/local-session", (req, res) => {
        const adminUser = auth.findUserByEmail("aditya.kumar@treebo.com");
        if (!adminUser) return res.status(404).send("Admin user not found");
        const token = auth.generateToken(adminUser);
        auth.setSessionCookie(res, token);
        res.redirect("/");
    });
}

app.get(["/api/auth/config", "/auth/config"], (req, res) => {
    res.json({
        success: true,
        clientId: client_id || "906825685733-khfmgsv2dhl427p1fkdv524etudsi39i.apps.googleusercontent.com"
    });
});

app.get(["/api/me", "/me"], (req, res) => {
    if (!req.user) {
        return res.json({ authenticated: false, user: null });
    }
    res.json({ authenticated: true, user: req.user });
});

app.get(["/api/auth/roster", "/auth/roster"], (req, res) => {
    const list = auth.getRoster().filter(u => u.active).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role
    }));
    res.json({ success: true, roster: list });
});

app.post(["/api/auth/google", "/auth/google"], async (req, res) => {
    try {
        const { credential } = req.body || {};
        if (!credential) {
            return res.status(400).json({ success: false, error: "Missing Google credential token" });
        }

        const { OAuth2Client } = require("google-auth-library");
        const client = new OAuth2Client(client_id);
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: client_id
        });
        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name || email.split("@")[0];

        // Identify role automatically from email without asking who they are
        let matchedUser = auth.findUserByEmail(email);

        if (!matchedUser) {
            await loadAccessControl();
            matchedUser = auth.findUserByEmail(email);
        }

        if (!matchedUser) {
            return res.status(403).json({
                success: false,
                error: "Your Google account is not authorized to use TDF Automator. Please contact your administrator."
            });
        }

        const token = auth.generateToken(matchedUser);
        auth.setSessionCookie(res, token);

        res.json({
            success: true,
            user: {
                id: matchedUser.id,
                email: matchedUser.email,
                name: matchedUser.name,
                role: matchedUser.role,
                picture: payload.picture
            },
            token
        });
    } catch (err) {
        console.error("Google sign in verification error:", err);
        res.status(401).json({
            success: false,
            error: `Google verification failed: ${err.message}`
        });
    }
});

app.post(["/api/auth/logout", "/auth/logout"], (req, res) => {
    auth.clearSessionCookie(res);
    res.json({ success: true, message: "Logged out successfully" });
});

// =====================================================
// ACCESS CONTROL & RBAC CRUD ENDPOINTS (ADMIN ONLY)
// =====================================================

const ACCESS_CONTROL_RANGE = "Access Control!A:E";
const ALLOWED_ROLES = ["Admin", "Pricing Manager", "RevOps", "Zonal Ops"];

async function getAccessControlFromSheet() {
    if (!sheetsOAuthClient.credentials.access_token) {
        const fallbackHost = process.env.FALLBACK_DATA_URL || "https://tdf-automator.vercel.app";
        try {
            const fetchRes = await fetch(`${fallbackHost}/api/sheet-data`);
            if (fetchRes.ok) {
                const fallbackData = await fetchRes.json();
                if (fallbackData?.data?.accessControl && fallbackData.data.accessControl.length > 1) {
                    return fallbackData.data.accessControl;
                }
            }
        } catch (e) { }
        return null;
    }
    try {
        const sheets = google.sheets({ version: "v4", auth: sheetsOAuthClient });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: ACCESS_CONTROL_RANGE
        });
        return response.data.values || [];
    } catch (err) {
        console.warn("Could not read Access Control tab from Google Sheets:", err.message);
        return null;
    }
}

async function syncAllUsersToGoogleSheet(usersList) {
    if (!sheetsOAuthClient.credentials.access_token) {
        return false;
    }
    try {
        const sheets = google.sheets({ version: "v4", auth: sheetsOAuthClient });
        const headers = ["ID", "Name", "Email", "Role", "Active"];
        const rows = [headers];
        for (const u of usersList) {
            rows.push([
                u.id || "",
                u.name || "",
                u.email || "",
                u.role || "Pricing Manager",
                u.active !== false ? "TRUE" : "FALSE"
            ]);
        }
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Access Control!A1:E${rows.length}`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: rows }
        });
        console.log(`Saved ${usersList.length} users to Google Sheets Access Control tab ✅`);
        return true;
    } catch (err) {
        console.error("Failed to write to Google Sheets Access Control tab:", err.message);
        return false;
    }
}

// 1. GET /api/admin/access-control - List all users
app.get("/api/admin/access-control", auth.requireRole(["Admin"]), async (req, res) => {
    try {
        const sheetRows = await getAccessControlFromSheet();
        if (sheetRows && sheetRows.length >= 2) {
            auth.syncRosterFromSheetRows(sheetRows);
        }
        const users = auth.getRoster().map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            active: Boolean(u.active)
        }));
        res.json({
            success: true,
            users,
            source: sheetRows ? "google_sheets" : "local_memory",
            total: users.length
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. POST /api/admin/access-control - Create user
app.post("/api/admin/access-control", auth.requireRole(["Admin"]), async (req, res) => {
    try {
        const { name, email, role, active } = req.body || {};
        const cleanName = String(name || "").trim();
        const cleanEmail = String(email || "").trim().toLowerCase();
        const cleanRole = String(role || "Pricing Manager").trim();
        const isActive = active !== false;

        if (!cleanName) {
            return res.status(400).json({ success: false, message: "User name is required." });
        }
        if (!cleanEmail || !cleanEmail.includes("@")) {
            return res.status(400).json({ success: false, message: "A valid email address is required." });
        }

        // Check for duplicates
        const existing = auth.getRoster().find(u => u.email.toLowerCase() === cleanEmail);
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `User with email "${cleanEmail}" already exists in the roster.`
            });
        }

        const newUser = auth.upsertUser({
            name: cleanName,
            email: cleanEmail,
            role: cleanRole,
            active: isActive
        });

        const syncedToSheet = await syncAllUsersToGoogleSheet(auth.getRoster());

        res.json({
            success: true,
            message: `User ${cleanEmail} added successfully.`,
            user: newUser,
            syncedToSheet
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3. PUT /api/admin/access-control/:email - Update user
app.put("/api/admin/access-control/:email", auth.requireRole(["Admin"]), async (req, res) => {
    try {
        const targetEmail = decodeURIComponent(req.params.email || "").trim().toLowerCase();
        const { name, email: newEmail, role, active } = req.body || {};

        if (!targetEmail) {
            return res.status(400).json({ success: false, message: "Target email is required." });
        }

        const currentRoster = auth.getRoster();
        const existingUser = currentRoster.find(u => u.email.toLowerCase() === targetEmail);
        if (!existingUser) {
            return res.status(404).json({ success: false, message: `User "${targetEmail}" not found.` });
        }

        // Guard against admin locking themselves out
        const isCurrentAdmin = req.user && req.user.email.toLowerCase() === targetEmail;
        if (isCurrentAdmin) {
            if (active === false) {
                return res.status(400).json({
                    success: false,
                    message: "Safety Guard: You cannot deactivate your own admin account."
                });
            }
            if (role && auth.normalizeRole(role) !== "Admin") {
                return res.status(400).json({
                    success: false,
                    message: "Safety Guard: You cannot demote your own account from Admin."
                });
            }
        }

        const updates = {};
        if (name !== undefined) updates.name = String(name).trim();
        if (role !== undefined) updates.role = auth.normalizeRole(role);
        if (active !== undefined) updates.active = Boolean(active);
        if (newEmail && newEmail.toLowerCase() !== targetEmail) {
            const duplicate = currentRoster.find(u => u.email.toLowerCase() === newEmail.toLowerCase() && u.email.toLowerCase() !== targetEmail);
            if (duplicate) {
                return res.status(400).json({ success: false, message: `Email "${newEmail}" is already in use by another user.` });
            }
            updates.email = newEmail.toLowerCase().trim();
        }

        const updatedUser = auth.updateUserByEmail(targetEmail, updates);
        const syncedToSheet = await syncAllUsersToGoogleSheet(auth.getRoster());

        res.json({
            success: true,
            message: `User ${targetEmail} updated successfully.`,
            user: updatedUser,
            syncedToSheet
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. DELETE /api/admin/access-control/:email - Soft delete / Deactivate user
app.delete("/api/admin/access-control/:email", auth.requireRole(["Admin"]), async (req, res) => {
    try {
        const targetEmail = decodeURIComponent(req.params.email || "").trim().toLowerCase();
        if (!targetEmail) {
            return res.status(400).json({ success: false, message: "Target email is required." });
        }

        // Guard against admin self-deactivation
        if (req.user && req.user.email.toLowerCase() === targetEmail) {
            return res.status(400).json({
                success: false,
                message: "Safety Guard: You cannot deactivate your own admin account."
            });
        }

        const deactivated = auth.deactivateUser(targetEmail);
        if (!deactivated) {
            return res.status(404).json({ success: false, message: `User "${targetEmail}" not found.` });
        }

        const syncedToSheet = await syncAllUsersToGoogleSheet(auth.getRoster());

        res.json({
            success: true,
            message: `User ${targetEmail} deactivated successfully.`,
            user: deactivated,
            syncedToSheet
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. POST /api/admin/access-control/sync - Manually trigger sync with Google Sheets
app.post("/api/admin/access-control/sync", auth.requireRole(["Admin"]), async (req, res) => {
    try {
        await loadAccessControl();
        res.json({
            success: true,
            count: auth.getRoster().length,
            message: "Access control roster synced with Google Sheets."
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// GOOGLE SHEETS TEST API (WITH ROLE-BASED ACCESS CONTROL)
// =====================================================

app.get(["/api/sheet-data", "/sheet-data"], async (req, res) => {

    try {

        // Make sure Google OAuth credentials are ready
        if (!sheetsOAuthClient.credentials.access_token) {
            // When running locally without direct Google Sheets OAuth tokens,
            // proxy/fetch live portfolio dataset from the deployed production backend
            const fallbackHost = process.env.FALLBACK_DATA_URL || "https://tdf-automator.vercel.app";
            try {
                console.log(`Local Google Sheets credentials not configured. Fetching live portfolio data from ${fallbackHost}/api/sheet-data...`);
                const fetchRes = await fetch(`${fallbackHost}/api/sheet-data`);
                if (fetchRes.ok) {
                    const fallbackData = await fetchRes.json();
                    if (fallbackData && fallbackData.success) {
                        if (fallbackData.data?.accessControl && fallbackData.data.accessControl.length > 1) {
                            auth.syncRosterFromSheetRows(fallbackData.data.accessControl);
                        }
                        return res.json(fallbackData);
                    }
                }
            } catch (fallbackErr) {
                console.warn("Fallback to production sheet-data failed:", fallbackErr.message);
            }

            return res.status(401).json({
                success: false,
                message: "Google authentication required.",
                loginUrl: "/auth/google"
            });

        }

        const sheets = google.sheets({
            version: "v4",
            auth: sheetsOAuthClient
        });

        // Fetch tabs in ONE request
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,

            ranges: [
                "future occ%!A:Z",
                "next 10 days factors!A:Z",
                "Rate flex!A:Z",
                "Benchmark Occ!A:G",
                "Channel RNs!A:P",
                "Future rates!A:D",
                "Hawkeye Base Rates!A:ZZ",
                "Access Control!A:Z"
            ]
        });

        const valueRanges = response.data.valueRanges || [];

        // Role-based data filtration:
        // Hawkeye Base Rates is accessible to ALL roles (Admin, Pricing Manager, RevOps, Zonal Ops).
        // Daily Pricing Dashboard portfolio data is exclusive to Admin & Pricing Managers.
        const userRole = (req.user?.role || "Pricing Manager").toLowerCase();
        const canViewDailyPricing = userRole.includes("admin") || userRole.includes("pricing");

        // Sync access control roster in memory if loaded
        if (valueRanges[7]?.values && valueRanges[7].values.length > 1) {
            auth.syncRosterFromSheetRows(valueRanges[7].values);
        }

        res.json({
            success: true,
            userRole: req.user?.role || "Pricing Manager",
            canViewDailyPricing,

            data: {
                // If RevOps or Zonal Ops, return empty portfolio matrices to save bandwidth and enforce access
                futureOcc: canViewDailyPricing ? (valueRanges[0]?.values || []) : [],
                next10DaysFactors: canViewDailyPricing ? (valueRanges[1]?.values || []) : [],
                rateFlex: canViewDailyPricing ? (valueRanges[2]?.values || []) : [],
                benchmarkOcc: canViewDailyPricing ? (valueRanges[3]?.values || []) : [],
                channelRNs: canViewDailyPricing ? (valueRanges[4]?.values || []) : [],
                futureRates: canViewDailyPricing ? (valueRanges[5]?.values || []) : [],
                // Hawkeye Base Rates available to all
                hawkeyeBaseRates: valueRanges[6]?.values || [],
                // Access Control roster tab
                accessControl: valueRanges[7]?.values || []
            }
        });

    } catch (error) {

        console.error("Google Sheets API error:");
        console.error(error);

        res.status(500).json({
            success: false,
            error: error.message
        });

    }
});

// =====================================================
// FRONTEND SERVING (PRODUCTION DIST) OR LOCAL STATIC FILES
// =====================================================

const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
    console.log("Serving production frontend build from /dist ✅");
    app.use(express.static(distPath));
    app.use((req, res, next) => {
        if (
            req.path.startsWith("/api") ||
            req.path.startsWith("/auth") ||
            req.path.startsWith("/oauth2callback")
        ) {
            return next();
        }
        res.sendFile(path.join(distPath, "index.html"));
    });
} else {
    app.use(express.static(__dirname));
    app.use((req, res, next) => {
        if (
            req.path.startsWith("/api") ||
            req.path.startsWith("/auth") ||
            req.path.startsWith("/oauth2callback")
        ) {
            return next();
        }
        res.sendFile(path.join(__dirname, "index.html"));
    });
}

// =====================================================
// START SERVER (Local Development) & EXPORT (Vercel Serverless)
// =====================================================

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(
            `Daily Pricing Dashboard server running at http://localhost:${PORT}`
        );
    });
}

module.exports = app;
