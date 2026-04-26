import asyncHandler from "express-async-handler";
import { EmailSyncService } from "../services/EmailSyncService.js";
import { Email } from "../models/emailModels.js";
import { GmailSync } from "../models/gmailSyncModels.js";
export const triggerInitialSync = asyncHandler(async (req, res) => {
    const userId = req.userId ?? req.user?._id.toString();
    if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const syncService = new EmailSyncService();
    await syncService.initialSync(userId);
    res.status(200).json({ message: "Initial sync completed" });
});
export const clearUserData = asyncHandler(async (req, res) => {
    const userId = req.userId ?? req.user?._id.toString();
    if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const [emails, gmailSync] = await Promise.all([
        Email.deleteMany({ userId }),
        GmailSync.deleteMany({ userId }),
    ]);
    res.status(200).json({
        message: "User data cleared",
        deleted: {
            emails: emails.deletedCount,
            gmailSyncs: gmailSync.deletedCount,
        },
    });
});
//# sourceMappingURL=syncController.js.map