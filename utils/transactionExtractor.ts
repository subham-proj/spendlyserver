// TransactionExtractor: Extracts transaction data from emails for Indian banks and payment apps

export interface TransactionData {
  amount: number;
  currency: string;
  type: "credit" | "debit";
  merchant: string;
  category: string;
  date: Date;
  description: string;
  confidence: number;
  source: string;
}

export class TransactionExtractor {
  private static transactionKeywords = [
    "debited",
    "credited",
    "payment",
    "received",
    "sent",
    "paid",
    "spent",
    "transaction",
    "amount",
    "rs",
    "inr",
    "₹",
  ];

  private static senderPatterns = [
    /@(?:.*\.)?(?:hdfcbank|icicibank|axisbank|sbi|onlinesbi|kotak|yesbank|indusind|idfcfirstbank|bankofbaroda|federalbank|canarabank|pnb|unionbank|aubank)\./i,
    /@(?:.*\.)?(?:paytm|phonepe|googlepay|tez|amazonpay|mobikwik|freecharge|cred|slice|simpl)\./i,
    /\b(?:bank|upi|wallet|card|netbanking|imps|neft|rtgs)\b/i,
  ];

  private static debitPatterns = [
    /\b(?:debited|debit|paid|spent|sent|withdrawn|charged|deducted|purchase|payment made|bill paid)\b/i,
  ];

  private static creditPatterns = [
    /\b(?:credited|credit|received|deposited|refund|cashback|reversal|reversed)\b/i,
  ];

  private static amountPatterns = [
    /(?:rs\.?|inr|mrp|amt\.?|amount|rs)\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /₹\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];

  isTransactionalEmail(email: any): boolean {
    const subject = this.normalize(email.subject);
    const body = this.normalize(email.body);
    const from = this.normalize(email.from);
    const content = `${subject} ${body}`.trim();

    if (!content) {
      return false;
    }

    const hasAmount = this.extractAmount(content) !== null;
    const hasTransactionKeyword = TransactionExtractor.transactionKeywords.some(
      (keyword) => content.includes(keyword),
    );
    const hasSenderSignal = TransactionExtractor.senderPatterns.some((pattern) =>
      pattern.test(from),
    );
    const hasDirectionSignal =
      this.matchesAny(content, TransactionExtractor.debitPatterns) ||
      this.matchesAny(content, TransactionExtractor.creditPatterns);
    const hasReferenceSignal =
      /\b(?:upi|utr|rrn|ref(?:erence)?(?: no)?|transaction id|txn id|a\/c|account|card ending|avl bal|available balance)\b/i.test(
        content,
      );

    return (
      hasAmount &&
      ((hasDirectionSignal && (hasTransactionKeyword || hasSenderSignal)) ||
        (hasSenderSignal && hasReferenceSignal))
    );
  }

  extractTransaction(email: any): TransactionData | null {
    const subject = this.normalize(email.subject);
    const body = this.normalize(email.body);
    const from = this.normalize(email.from);
    const content = `${subject}\n${body}`.trim();

    if (!this.isTransactionalEmail(email)) {
      return null;
    }

    const amount = this.extractAmount(content);
    if (!amount || amount <= 0) return null;

    // Type
    const type = this.inferType(content);

    // Merchant
    const merchant = this.extractMerchant(content, from);

    // Date
    const date = this.parseDate(email.date);

    // Confidence
    let confidence = 0.65;
    if (merchant && merchant !== "Unknown") confidence += 0.1;
    if (type) confidence += 0.1;
    if (TransactionExtractor.senderPatterns.some((pattern) => pattern.test(from)))
      confidence += 0.1;
    if (/\b(?:upi|utr|rrn|transaction id|txn id|ref(?:erence)? no)\b/i.test(content))
      confidence += 0.05;
    if (confidence > 1) confidence = 1;

    // Category (basic)
    let category = "other";
    if (/swiggy|zomato|dominos|pizza|restaurant|cafe|food/i.test(merchant))
      category = "food";
    if (
      /uber|ola|rapido|taxi|auto|metro|bus|train|flight|airline/i.test(merchant)
    )
      category = "transport";
    if (
      /amazon|flipkart|myntra|bigbasket|grofers|shopping|store/i.test(merchant)
    )
      category = "shopping";
    if (/netflix|prime|hotstar|bookmyshow|movie|theatre|game/i.test(merchant))
      category = "entertainment";
    if (/electricity|water|gas|phone|internet|mobile|recharge/i.test(merchant))
      category = "utilities";
    if (/hospital|doctor|pharmacy|medical|health/i.test(merchant))
      category = "healthcare";

    return {
      amount,
      currency: "INR",
      type,
      merchant: merchant || "Unknown",
      category,
      date,
      description: subject || "",
      confidence,
      source: email.from || "",
    };
  }

  private normalize(value: unknown): string {
    if (typeof value !== "string") {
      return "";
    }

    return value.replace(/\s+/g, " ").trim();
  }

  private matchesAny(content: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(content));
  }

  private extractAmount(content: string): number | null {
    for (const pattern of TransactionExtractor.amountPatterns) {
      const match = content.match(pattern);
      if (!match) {
        continue;
      }

      const amount = parseFloat(match[1].replace(/,/g, ""));
      if (Number.isFinite(amount) && amount > 0) {
        return amount;
      }
    }

    return null;
  }

  private inferType(content: string): "credit" | "debit" {
    const hasCreditSignal = this.matchesAny(
      content,
      TransactionExtractor.creditPatterns,
    );
    const hasDebitSignal = this.matchesAny(
      content,
      TransactionExtractor.debitPatterns,
    );

    if (hasCreditSignal && !hasDebitSignal) {
      return "credit";
    }

    if (hasDebitSignal && !hasCreditSignal) {
      return "debit";
    }

    if (/\b(?:refund|cashback|reversal)\b/i.test(content)) {
      return "credit";
    }

    return "debit";
  }

  private extractMerchant(content: string, from: string): string {
    const merchantPatterns = [
      /\b(?:paid to|payment to|sent to|credited to|received from|transferred to)\s+([A-Za-z0-9&.,\- ]{2,60})/i,
      /\b(?:spent on|payment at|purchase at|debited at|used at|at)\s+([A-Za-z0-9&.,\- ]{2,60})/i,
      /\bmerchant[:\-]\s*([A-Za-z0-9&.,\- ]{2,60})/i,
      /\bupi[:\-]?\s*([A-Za-z0-9@._\- ]{2,60})/i,
    ];

    for (const pattern of merchantPatterns) {
      const match = content.match(pattern);
      if (!match) {
        continue;
      }

      const cleaned = match[1]
        .replace(/\b(?:on|via|using|through|ref|utr|txn|avl|ending)\b.*$/i, "")
        .replace(/[.;,:\-]+$/g, "")
        .trim();

      if (cleaned.length >= 2) {
        return cleaned;
      }
    }

    const senderNameMatch = from.match(/^"?([^"<@]+)"?\s*</);
    if (senderNameMatch?.[1]) {
      return senderNameMatch[1].trim();
    }

    const senderDomainMatch = from.match(/@([a-z0-9.-]+)/i);
    if (senderDomainMatch?.[1]) {
      return senderDomainMatch[1].split(".")[0];
    }

    return "";
  }

  private parseDate(value: unknown): Date {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return new Date();
  }
}
