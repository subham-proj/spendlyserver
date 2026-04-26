import { getGroq } from "./groqClient.js";
const VALID_CATEGORIES = [
    "food", "shopping", "travel", "utilities",
    "entertainment", "health", "finance", "transfer", "other",
];
const SYSTEM_PROMPT = `You are a financial email parser for Indian users.
Given an email's subject, sender, and snippet, determine if it is a transactional email — i.e. a bank alert, UPI/payment notification, credit/debit card transaction, wallet transaction, or bill payment confirmation.
If it is transactional, extract the financial details.

Respond with a single JSON object matching this exact schema (no markdown, no extra keys):
{
  "isTransactional": boolean,
  "amount": number | null,
  "currency": "INR" | "USD" | "EUR" | string,
  "merchant": string | null,
  "category": "food" | "shopping" | "travel" | "utilities" | "entertainment" | "health" | "finance" | "transfer" | "other" | null,
  "transactionType": "debit" | "credit" | null,
  "transactionDate": "ISO-8601 date string" | null
}

Rules:
- amount must be a plain number (no currency symbols, no commas), e.g. 1500.00
- If the email is a newsletter, promotional, or non-financial, set isTransactional to false and all other fields to null.
- For UPI peer-to-peer transfers set category to "transfer".
- For EMI, loan repayment, mutual fund SIP, stock purchase set category to "finance".`;
// Strip zero-width chars and collapse whitespace that HTML emails embed as spacers.
// Without this, Gmail snippets from marketing emails are just ‌ ‌ ‌ ‌ — useless to Groq.
function cleanSnippet(raw) {
    return raw
        .replace(/[\u200b\u200c\u200d\u00ad\ufeff\u2060]/g, "") // zero-width chars
        .replace(/\s+/g, " ")
        .trim();
}
export async function extractTransaction(subject, from, snippet, emailDate) {
    const cleanedSnippet = cleanSnippet(snippet);
    console.log("[TransactionExtractor] Input →", { subject, from, snippet: cleanedSnippet.slice(0, 80) });
    const fallback = {
        isTransactional: false,
        amount: null,
        currency: "INR",
        merchant: null,
        category: null,
        transactionType: null,
        transactionDate: null,
    };
    try {
        const completion = await getGroq().chat.completions.create({
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Subject: ${subject}\nFrom: ${from}\nSnippet: ${cleanedSnippet}\nEmail date: ${emailDate}`,
                },
            ],
            temperature: 0,
            max_tokens: 256,
        });
        const raw = completion.choices[0]?.message?.content;
        if (!raw)
            return fallback;
        const parsed = JSON.parse(raw);
        console.log("[TransactionExtractor] Groq result →", parsed);
        // Sanitise category and transactionType so invalid Groq outputs don't break the DB enum
        if (parsed.category && !VALID_CATEGORIES.includes(parsed.category)) {
            parsed.category = "other";
        }
        if (parsed.transactionType && !["debit", "credit"].includes(parsed.transactionType)) {
            parsed.transactionType = null;
        }
        return parsed;
    }
    catch (err) {
        console.warn("[TransactionExtractor] Groq call failed:", err.message);
        return fallback;
    }
}
//# sourceMappingURL=transactionExtractor.js.map