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
            console.warn("Access Control: Google Sheets token not available.");
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
            `Access Control loaded: ${rows.length - 1} users`
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
            <p>Please try again.</p>
        `);
    }
});

// =====================================================
// USER AUTHENTICATION & RBAC ENDPOINTS
// =====================================================

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

app.get(
    ["/api/auth/roster", "/auth/roster"],
    auth.requireRole("Admin"),
    (req, res) => {
    const list = auth.getRoster().filter(u => u.active).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role
    }));
    res.json({ success: true, roster: list });
});


// =========================================================================
// ADMIN ACCESS CONTROL API
// Google Sheet: Access Control!A:E
// Columns: ID | Name | Email | Role | Active
// =========================================================================

const ACCESS_CONTROL_RANGE = "Access Control!A:E";

const ALLOWED_ROLES = [
    "Admin",
    "Pricing Manager",
    "RevOps",
    "Zonal Ops"
];

async function getAccessControlRows() {
    if (!sheetsOAuthClient.credentials.access_token) {
        throw new Error("Google Sheets authentication is required.");
    }

    const sheets = google.sheets({
        version: "v4",
        auth: sheetsOAuthClient
    });

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: ACCESS_CONTROL_RANGE
    });

    return response.data.values || [];
}

async function saveAccessControlRows(rows) {
    if (!sheetsOAuthClient.credentials.access_token) {
        throw new Error("Google Sheets authentication is required.");
    }

    const sheets = google.sheets({
        version: "v4",
        auth: sheetsOAuthClient
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: ACCESS_CONTROL_RANGE,
        valueInputOption: "USER_ENTERED",
        requestBody: {
            values: rows
        }
    });

    auth.syncRosterFromSheetRows(rows);
}

app.get(
    "/api/admin/access-control",
    auth.requireRole("Admin"),
    async (req, res) => {
        try {
            const rows = await getAccessControlRows();

            if (rows.length === 0) {
                return res.json({
                    success: true,
                    users: []
                });
            }

            const headers = rows[0].map(h =>
                String(h || "").trim().toLowerCase()
            );

            const colId = headers.indexOf("id");
            const colName = headers.indexOf("name");
            const colEmail = headers.indexOf("email");
            const colRole = headers.indexOf("role");
            const colActive = headers.indexOf("active");

            const users = rows
                .slice(1)
                .filter(row => row[colEmail])
                .map(row => ({
                    id: row[colId] || "",
                    name: row[colName] || "",
                    email: String(row[colEmail] || "").trim().toLowerCase(),
                    role: row[colRole] || "Pricing Manager",
                    active: String(row[colActive] || "true").toLowerCase() !== "false"
                }));

            res.json({
                success: true,
                users
            });

        } catch (error) {
            console.error("Admin Access Control GET error:", error);

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

app.post(
    "/api/admin/access-control",
    auth.requireRole("Admin"),
    async (req, res) => {
        try {
            const {
                name,
                email,
                role = "Pricing Manager",
                active = true
            } = req.body;

            const cleanName = String(name || "").trim();
            const cleanEmail = String(email || "").trim().toLowerCase();
            const cleanRole = String(role || "").trim();

            if (!cleanName || !cleanEmail) {
                return res.status(400).json({
                    success: false,
                    message: "Name and email are required."
                });
            }

            if (!cleanEmail.includes("@")) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid email address."
                });
            }

            if (!ALLOWED_ROLES.includes(cleanRole)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid role."
                });
            }

            const rows = await getAccessControlRows();

            const existingUser = rows
                .slice(1)
                .find(row =>
                    String(row[2] || "").trim().toLowerCase() === cleanEmail
                );

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "A user with this email already exists."
                });
            }

            const userId = `usr_${Date.now()}`;

            rows.push([
                userId,
                cleanName,
                cleanEmail,
                cleanRole,
                active ? "TRUE" : "FALSE"
            ]);

            await saveAccessControlRows(rows);

            res.json({
                success: true,
                message: "User added successfully.",
                user: {
                    id: userId,
                    name: cleanName,
                    email: cleanEmail,
                    role: cleanRole,
                    active: Boolean(active)
                }
            });

        } catch (error) {
            console.error("Admin Access Control POST error:", error);

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

app.put(
    "/api/admin/access-control/:email",
    auth.requireRole("Admin"),
    async (req, res) => {
        try {
            const originalEmail = decodeURIComponent(req.params.email)
                .trim()
                .toLowerCase();

            const {
                name,
                email,
                role,
                active
            } = req.body;

            const rows = await getAccessControlRows();

            const rowIndex = rows.findIndex((row, index) =>
                index > 0 &&
                String(row[2] || "").trim().toLowerCase() === originalEmail
            );

            if (rowIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: "User not found."
                });
            }

            const currentRow = rows[rowIndex];

            const updatedName =
                name !== undefined
                    ? String(name).trim()
                    : String(currentRow[1] || "").trim();

            const updatedEmail =
                email !== undefined
                    ? String(email).trim().toLowerCase()
                    : String(currentRow[2] || "").trim().toLowerCase();

            const updatedRole =
                role !== undefined
                    ? String(role).trim()
                    : String(currentRow[3] || "Pricing Manager").trim();

            const updatedActive =
                active !== undefined
                    ? Boolean(active)
                    : String(currentRow[4] || "true").toLowerCase() !== "false";

            if (!updatedName || !updatedEmail) {
                return res.status(400).json({
                    success: false,
                    message: "Name and email are required."
                });
            }

            if (!updatedEmail.includes("@")) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide a valid email address."
                });
            }

            if (!ALLOWED_ROLES.includes(updatedRole)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid role."
                });
            }

            const duplicate = rows.some((row, index) =>
                index !== rowIndex &&
                String(row[2] || "").trim().toLowerCase() === updatedEmail
            );

            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message: "Another user already has this email address."
                });
            }

            const currentAdminEmail = String(req.user?.email || "")
                .trim()
                .toLowerCase();

            if (
                originalEmail === currentAdminEmail &&
                !updatedActive
            ) {
                return res.status(400).json({
                    success: false,
                    message: "You cannot deactivate your own Admin account."
                });
            }

            rows[rowIndex] = [
                currentRow[0] || `usr_${rowIndex}`,
                updatedName,
                updatedEmail,
                updatedRole,
                updatedActive ? "TRUE" : "FALSE"
            ];

            await saveAccessControlRows(rows);

            res.json({
                success: true,
                message: "User updated successfully.",
                user: {
                    id: rows[rowIndex][0],
                    name: updatedName,
                    email: updatedEmail,
                    role: updatedRole,
                    active: updatedActive
                }
            });

        } catch (error) {
            console.error("Admin Access Control PUT error:", error);

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

app.delete(
    "/api/admin/access-control/:email",
    auth.requireRole("Admin"),
    async (req, res) => {
        try {
            const email = decodeURIComponent(req.params.email)
                .trim()
                .toLowerCase();

            const currentAdminEmail = String(req.user?.email || "")
                .trim()
                .toLowerCase();

            if (email === currentAdminEmail) {
                return res.status(400).json({
                    success: false,
                    message: "You cannot deactivate your own Admin account."
                });
            }

            const rows = await getAccessControlRows();

            const rowIndex = rows.findIndex((row, index) =>
                index > 0 &&
                String(row[2] || "").trim().toLowerCase() === email
            );

            if (rowIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: "User not found."
                });
            }

            rows[rowIndex][4] = "FALSE";

            await saveAccessControlRows(rows);

            res.json({
                success: true,
                message: "User deactivated successfully."
            });

        } catch (error) {
            console.error("Admin Access Control DELETE error:", error);

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

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
// GOOGLE SHEETS TEST API (WITH ROLE-BASED ACCESS CONTROL)
// =====================================================

app.get(["/api/sheet-data", "/sheet-data"], async (req, res) => {

    try {

        // Make sure Google OAuth credentials are ready
        if (!sheetsOAuthClient.credentials.access_token) {

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
                "Hawkeye Base Rates!A:ZZ"
            ]
        });

        const valueRanges = response.data.valueRanges || [];

        // Role-based data filtration:
        // Hawkeye Base Rates is accessible to ALL roles (Admin, Pricing Manager, RevOps, Zonal Ops).
        // Daily Pricing Dashboard portfolio data is exclusive to Admin & Pricing Managers.
        const userRole = (req.user?.role || "Pricing Manager").toLowerCase();
        const canViewDailyPricing = userRole.includes("admin") || userRole.includes("pricing");

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
                hawkeyeBaseRates: valueRanges[6]?.values || []
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
// FRONTEND SERVING (PRODUCTION DIST) OR TEST HOME PAGE
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
    app.get("/", (req, res) => {
        res.send(`
            <h1>Daily Pricing Dashboard Backend</h1>
            <p>Server is running ✅</p>
            <p><a href="/auth/google">Login with Google</a></p>
            <p><a href="/api/sheet-data">Test Google Sheet Data</a></p>
        `);
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
