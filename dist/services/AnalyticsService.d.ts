interface DashboardSummary {
    period: {
        monthStart: Date;
        monthEndExclusive: Date;
        last30DaysStart: Date;
        now: Date;
    };
    cards: {
        totalExpenseMtd: {
            value: number;
            previousMonthValue: number;
            changePct: number | null;
        };
        totalIncomeMtd: {
            value: number;
            previousMonthValue: number;
            changePct: number | null;
        };
        netCashFlowMtd: {
            value: number;
            previousMonthValue: number;
            changePct: number | null;
        };
        avgDailySpendLast30Days: {
            value: number;
            previous30DaysValue: number;
            changePct: number | null;
        };
    };
}
interface DailyExpense {
    date: string;
    amount: number;
}
interface DailyExpenseResponse {
    data: DailyExpense[];
    period: {
        start: string;
        end: string;
    };
}
export declare class AnalyticsService {
    getSummaryCards(userId: string, now?: Date): Promise<DashboardSummary>;
    getDailyExpenseLast30Days(userId: string, now?: Date): Promise<DailyExpenseResponse>;
}
export {};
//# sourceMappingURL=AnalyticsService.d.ts.map