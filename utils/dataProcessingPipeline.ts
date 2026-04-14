import { Email } from "../models/emailModels.js";
import { createLogger } from "./logger.js";

const logger = createLogger("DataProcessingPipeline");

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
    const pipeline = [
      this.parseEmails,
      this.filterEmails,
      this.transformEmails,
    ];

    let data = rawEmails;
    for (const step of pipeline) {
      data = await step(data);
      logger.debug(`After step ${step.name}, ${data.length} emails remain`);
    }

    const operations = data.map((e: any) => ({
      updateOne: {
        filter: { messageId: e.id, userId },
        update: {
          $setOnInsert: {
            messageId: e.id,
            userId,
            subject: e.subject,
            from: e.from,
            to: e.to || "",
            date: e.date,
            body: e.body,
            labels: e.labels,
            raw: e.raw,
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
        raw: msg,
      };
    });
  }

  filterEmails(emails: any[]) {
    return emails.filter((e) => {
      const isNotSpam = !e.labels.includes("SPAM");
      const isNotDraft = !e.labels.includes("DRAFT");
      return isNotSpam && isNotDraft;
    });
  }

  transformEmails(emails: any[]) {
    return emails.map((e) => ({
      id: e.id,
      subject: e.subject,
      from: e.from,
      to: e.to,
      body: e.body?.slice(0, 10000),
      date: e.date,
      labels: e.labels,
      raw: e.raw,
    }));
  }
}
