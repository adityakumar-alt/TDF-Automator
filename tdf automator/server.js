require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
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

const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/oauth2callback`;

const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    REDIRECT_URI
);

const TOKENS_PATH = "./oauth/tokens.json";

// Load saved tokens: check env var first, then file
if (process.env.GOOGLE_SAVED_TOKENS) {
    try {
        const envTokens = JSON.parse(process.env.GOOGLE_SAVED_TOKENS);
        oauth2Client.setCredentials(envTokens);
        console.log("Loaded saved OAuth tokens from environment variable ✅");
    } catch (err) {
        console.warn("Error parsing GOOGLE_SAVED_TOKENS env var:", err.message);
    }
} else if (fs.existsSync(TOKENS_PATH)) {
    try {
        const savedTokens = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8"));
        oauth2Client.setCredentials(savedTokens);
        console.log("Loaded saved OAuth tokens from file ✅");
    } catch (err) {
        console.warn("Error reading tokens file:", err.message);
    }
}

// Automatically save refreshed tokens
oauth2Client.on("tokens", (tokens) => {
    try {
        const currentTokens = { ...oauth2Client.credentials, ...tokens };
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
// GOOGLE LOGIN
// =====================================================

app.get("/auth/google", (req, res) => {

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",

        scope: [
            "https://www.googleapis.com/auth/spreadsheets.readonly"
        ]
    });

    res.redirect(authUrl);
});

// =====================================================
// GOOGLE OAUTH CALLBACK
// =====================================================

app.get("/oauth2callback", async (req, res) => {

    const { code } = req.query;

    if (!code) {
        return res.status(400).send("No authorization code received.");
    }

    try {

        const { tokens } = await oauth2Client.getToken(code);

        oauth2Client.setCredentials(tokens);

        try {
            fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
            console.log("OAuth tokens saved to disk ✅");
        } catch (saveErr) {
            console.error("Failed to save tokens to file:", saveErr);
        }

        console.log("Google authentication successful.");

        res.send(`
            <h1>Google authentication successful ✅</h1>
            <p>You can close this tab and return to your project.</p>
        `);

    } catch (error) {

        console.error("OAuth error:", error);

        res.status(500).send(`
            <h1>Authentication failed ❌</h1>
            <p>${error.message}</p>
        `);

    }
});

// =====================================================
// GOOGLE SHEETS TEST API
// =====================================================

app.get("/api/sheet-data", async (req, res) => {

    try {

        // Make sure we are authenticated
        if (!oauth2Client.credentials.access_token) {

            return res.status(401).json({
                success: false,
                message: "Google authentication required.",
                loginUrl: "/auth/google"
            });

        }

        const sheets = google.sheets({
            version: "v4",
            auth: oauth2Client
        });

        // Fetch all tabs in ONE request
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,

            ranges: [
                "future occ%!A:Z",
                "next 10 days factors!A:Z",
                "Rate flex!A:Z",
                "Benchmark Occ!A:G",
                "Channel RNs!A:P",
                "Future rates!A:D"
            ]
        });

        const valueRanges = response.data.valueRanges || [];

        res.json({
            success: true,

            data: {
                futureOcc: valueRanges[0]?.values || [],
                next10DaysFactors: valueRanges[1]?.values || [],
                rateFlex: valueRanges[2]?.values || [],
                benchmarkOcc: valueRanges[3]?.values || [],
                channelRNs: valueRanges[4]?.values || [],
                futureRates: valueRanges[5]?.values || []
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
// START SERVER
// =====================================================

app.listen(PORT, () => {

    console.log(
        `Daily Pricing Dashboard server running at http://localhost:${PORT}`
    );

});