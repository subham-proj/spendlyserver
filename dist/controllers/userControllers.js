import asyncHandler from "express-async-handler";
import { oAuth2Client, mobileOAuth2Client } from "../index.js";
import { SCOPES } from "../contants/globalConstants.js";
import { User } from "../models/userModels.js";
import { google } from "googleapis";
import { generateToken } from "../middleware/authMiddleware.js";
const VALID_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
// Fetches the user's display name and profile photo from Google
async function fetchGoogleUserInfo(accessToken) {
    try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok)
            return { name: null, picture: null };
        const data = await res.json();
        return { name: data.name ?? null, picture: data.picture ?? null };
    }
    catch {
        return { name: null, picture: null };
    }
}
export const oAuthHandler = asyncHandler(async (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
    });
    res.redirect(authUrl);
});
export const callbackHandler = asyncHandler(async (req, res) => {
    const { code } = req.query;
    if (!code || typeof code !== "string") {
        res.status(400).json({ error: "Authorization code is required" });
        return;
    }
    try {
        const result = await oAuth2Client.getToken(code);
        const { tokens } = result;
        oAuth2Client.setCredentials(tokens);
        const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
        const profile = await gmail.users.getProfile({ userId: "me" });
        if (!profile?.data?.emailAddress) {
            res.status(500).json({ error: "No email address found in Gmail profile" });
            return;
        }
        const email = profile.data.emailAddress;
        const { name, picture } = await fetchGoogleUserInfo(tokens.access_token);
        const user = await User.findOneAndUpdate({ email }, {
            email,
            name,
            picture,
            accessToken: tokens.access_token || null,
            refreshToken: tokens.refresh_token || null,
            scope: tokens.scope || null,
            refreshTokenExpiresIn: tokens.refresh_token_expires_in ?? null,
            expiryDate: tokens.expiry_date ?? null,
        }, { upsert: true, new: true });
        try {
            const watchRes = await gmail.users.watch({
                userId: "me",
                requestBody: {
                    labelIds: ["INBOX"],
                    topicName: process.env.GMAIL_PUBSUB_TOPIC,
                },
            });
            if (watchRes.data.historyId) {
                await User.findOneAndUpdate({ email }, { $set: { lastHistoryId: watchRes.data.historyId.toString() } });
            }
            console.log(`[OAuth] Gmail watch registered for ${email}`);
        }
        catch (watchErr) {
            console.warn(`[OAuth] gmail.users.watch failed for ${email}:`, watchErr.message);
        }
        const jwtToken = generateToken(user._id.toString());
        res.json({ message: "Authenticated!", user, token: jwtToken, googleTokens: tokens });
    }
    catch (err) {
        const error = err;
        res.status(500).json({ error: error.message });
    }
});
export const getMobileAuthUrl = asyncHandler(async (req, res) => {
    const authUrl = mobileOAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
    });
    res.json({ authUrl });
});
export const mobileCallbackHandler = asyncHandler(async (req, res) => {
    const { code } = req.query;
    if (!code || typeof code !== "string") {
        res.redirect("spendly://auth/callback?error=missing_code");
        return;
    }
    try {
        const result = await mobileOAuth2Client.getToken(code);
        const { tokens } = result;
        mobileOAuth2Client.setCredentials(tokens);
        const gmail = google.gmail({ version: "v1", auth: mobileOAuth2Client });
        const profile = await gmail.users.getProfile({ userId: "me" });
        if (!profile?.data?.emailAddress) {
            res.redirect("spendly://auth/callback?error=no_email");
            return;
        }
        const email = profile.data.emailAddress;
        const { name, picture } = await fetchGoogleUserInfo(tokens.access_token);
        const user = await User.findOneAndUpdate({ email }, {
            email,
            name,
            picture,
            accessToken: tokens.access_token || null,
            refreshToken: tokens.refresh_token || null,
            scope: tokens.scope || null,
            refreshTokenExpiresIn: tokens.refresh_token_expires_in ?? null,
            expiryDate: tokens.expiry_date ?? null,
        }, { upsert: true, new: true });
        try {
            const watchRes = await gmail.users.watch({
                userId: "me",
                requestBody: {
                    labelIds: ["INBOX"],
                    topicName: process.env.GMAIL_PUBSUB_TOPIC,
                },
            });
            if (watchRes.data.historyId) {
                await User.findOneAndUpdate({ email }, { $set: { lastHistoryId: watchRes.data.historyId.toString() } });
            }
            console.log(`[Mobile OAuth] Gmail watch registered for ${email}`);
        }
        catch (watchErr) {
            console.warn(`[Mobile OAuth] gmail.users.watch failed for ${email}:`, watchErr.message);
        }
        const jwtToken = generateToken(user._id.toString());
        res.redirect(`spendly://auth/callback?token=${jwtToken}`);
    }
    catch (err) {
        const error = err;
        console.error("[Mobile OAuth] Callback error:", error.message);
        res.redirect(`spendly://auth/callback?error=${encodeURIComponent(error.message)}`);
    }
});
// GET /api/users/me — returns safe profile fields + preferences
export const getUserProfile = asyncHandler(async (req, res) => {
    const user = req.user;
    // Lazy backfill: if name/picture were never stored (user logged in before
    // this feature landed), fetch them now using the stored access token and
    // persist so subsequent calls don't need to hit Google again.
    if (!user.name && user.accessToken) {
        const { name, picture } = await fetchGoogleUserInfo(user.accessToken);
        if (name || picture) {
            await User.findByIdAndUpdate(user._id, { $set: { name, picture } });
            user.name = name;
            user.picture = picture;
        }
    }
    res.json({
        email: user.email,
        name: user.name ?? null,
        picture: user.picture ?? null,
        memberSince: user.createdAt,
        gmailConnected: user.accessToken !== null,
        lastSynced: user.updatedAt,
        preferences: {
            currency: user.preferences?.currency ?? 'INR',
            notificationsEnabled: user.preferences?.notificationsEnabled ?? true,
            themeMode: user.preferences?.themeMode ?? 'system',
        },
    });
});
// PATCH /api/users/preferences — updates currency, notifications, theme, push token
export const updatePreferences = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const { currency, notificationsEnabled, themeMode, expoPushToken } = req.body;
    const update = {};
    if (currency !== undefined) {
        if (!VALID_CURRENCIES.includes(currency)) {
            res.status(400).json({ error: `Invalid currency. Must be one of: ${VALID_CURRENCIES.join(', ')}` });
            return;
        }
        update['preferences.currency'] = currency;
    }
    if (notificationsEnabled !== undefined) {
        update['preferences.notificationsEnabled'] = Boolean(notificationsEnabled);
    }
    if (themeMode !== undefined) {
        update['preferences.themeMode'] = themeMode;
    }
    if (expoPushToken !== undefined) {
        update['preferences.expoPushToken'] = expoPushToken;
    }
    await User.findByIdAndUpdate(userId, { $set: update });
    res.json({ success: true });
});
//# sourceMappingURL=userControllers.js.map