import { Email } from "../models/emailModels.js";
import { createLogger } from "./logger.js";
import { TransactionExtractor } from "./transactionExtractor.js";

const logger = createLogger("DataProcessingPipeline");
const transactionExtractor = new TransactionExtractor();

const extractBody = (payload: any): string => {
  if (!payload) {
    return "";
  }

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    return payload.parts
      .map((part: any) => extractBody(part))
      .filter(Boolean)
      .join("\n");
  }

  return "";
};

export class DataProcessingPipeline {
  async processPipeline(userId: string, rawEmails: any[]) {
    logger.info(
      `Starting pipeline for user ${userId} with ${rawEmails.length} raw emails`,
    );
    const parsedEmails = this.parseEmails(rawEmails);
    logger.info(`Parsed ${parsedEmails.length} emails for user ${userId}`);

    const filteredEmails = this.filterEmails(parsedEmails);
    logger.info(
      `Filtered transaction candidates for user ${userId}: ${filteredEmails.length}/${parsedEmails.length}`,
    );

    const data = this.transformEmails(filteredEmails);
    logger.info(
      `Extracted transactions for user ${userId}: ${data.length}/${filteredEmails.length}`,
    );

    const operations = data.map((e: any) => ({
      updateOne: {
        filter: { messageId: e.id, userId },
        update: {
          $set: {
            messageId: e.id,
            userId,
            subject: e.subject,
            from: e.from,
            to: e.to || "",
            date: e.date,
            labels: e.labels,
            transactionData: e.transactionData || null,
          },
        },
        upsert: true,
      },
    }));

    if (operations.length > 0) {
      const result = await Email.bulkWrite(operations, { ordered: false });
      logger.info(
        `Bulk write completed for user ${userId}. inserted=${result.insertedCount}, upserted=${result.upsertedCount}`,
      );
    } else {
      logger.info(`No email operations to write for user ${userId}`);
    }
  }

  parseEmails(emails: any[]) {
    return emails.map((msg) => {
      const headers = msg.payload?.headers || [];
      const get = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name)?.value || "";

      const body = extractBody(msg.payload);

      return {
        id: msg.id,
        subject: get("subject"),
        from: get("from"),
        to: get("to"),
        date: new Date(get("date")),
        body,
        labels: msg.labelIds || [],
      };
    });
  }

  filterEmails(emails: any[]) {
    return emails.filter((e) => {
      const isNotSpam = !e.labels.includes("SPAM");
      const isNotDraft = !e.labels.includes("DRAFT");
      const isTransactional = transactionExtractor.isTransactionalEmail(e);
      if (!isNotSpam || !isNotDraft) return false;
      if (!isTransactional) {
        logger.debug(`Filtered out non-transactional email: ${e.subject}`);
        return false;
      }
      return true;
    });
  }

  transformEmails(emails: any[]) {
    return emails
      .map((e) => {
        const transaction = transactionExtractor.extractTransaction(e);
        if (!transaction) {
          logger.debug(`No transaction data extracted for: ${e.subject}`);
        }
        return {
          id: e.id,
          subject: e.subject,
          from: e.from,
          to: e.to,
          date: e.date,
          labels: e.labels,
          transactionData: transaction,
        };
      })
      .filter((e) => {
        if (e.transactionData) {
          return true;
        }

        logger.debug(`Dropping email without parsed transaction: ${e.subject}`);
        return false;
      });
  }
}
