import type { TransactionCategory, TransactionType } from "../models/transactionModel.js";
export interface ExtractionResult {
    isTransactional: boolean;
    amount: number | null;
    currency: string;
    merchant: string | null;
    shortName: string | null;
    category: TransactionCategory | null;
    transactionType: TransactionType | null;
    transactionDate: string | null;
}
export declare function extractTransaction(subject: string, from: string, snippet: string, emailDate: string): Promise<ExtractionResult>;
//# sourceMappingURL=transactionExtractor.d.ts.map