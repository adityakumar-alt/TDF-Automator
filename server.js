const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());
const PORT = 3000;

console.log("Starting TDF Google Sheets server...");

// =====================================================
// GOOGLE OAUTH CONFIGURATION
// =====================================================

const credentials = JSON.parse(
    fs.readFileSync("./oauth/client-secret.json", "utf8")
);

const { client_id, client_secret } = credentials.web;

const REDIRECT_URI = "http://localhost:3000/oauth2callback";

const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    REDIRECT_URI
);

const TOKENS_PATH = "./oauth/tokens.json";

// Load saved tokens if available
if (fs.existsSync(TOKENS_PATH)) {
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
        fs.writeFileSync(TOKENS_PATH, JSON.stringify(currentTokens, null, 2));
        console.log("Updated OAuth tokens saved to disk ✅");
    } catch (e) {
        console.error("Error saving updated tokens:", e);
    }
});

// =====================================================
// YOUR GOOGLE SPREADSHEET
// =====================================================

const SPREADSHEET_ID =
    "1HbhMErLh8N2CdkBBJ_ubiv6S2FYx5g1_pNqoFOPo8eE";

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

        // Fetch all three tabs in ONE request
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,

            ranges: [
                "future occ%!A:Z",
                "next 10 days factors!A:Z",
                "Rate flex!A:Z"
            ]
        });

        const valueRanges = response.data.valueRanges || [];

        res.json({
            success: true,

            data: {
                futureOcc: valueRanges[0]?.values || [],
                next10DaysFactors: valueRanges[1]?.values || [],
                rateFlex: valueRanges[2]?.values || []
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
// TEST HOME PAGE
// =====================================================

app.get("/", (req, res) => {

    res.send(`
        <h1>TDF Dashboard Backend</h1>

        <p>Server is running ✅</p>

        <p>
            <a href="/auth/google">
                Login with Google
            </a>
        </p>

        <p>
            After login:
            <a href="/api/sheet-data">
                Test Google Sheet Data
            </a>
        </p>
    `);

});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {

    console.log(
        `TDF Dashboard server running at http://localhost:${PORT}`
    );

});