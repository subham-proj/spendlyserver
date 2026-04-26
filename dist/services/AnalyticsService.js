import { Email } from "../models/emailModels.js";
const round2 = (value) => Math.round(value * 100) / 100;
const pctChange = (current, previous) => {
    if (previous === 0) {
        return current === 0 ? 0 : null;
    }
    return round2(((current - previous) / previous) * 100);
};
const getTotalByType = (rows = [], type) => {
    return round2(rows.find((row) => row._id === type)?.total ?? 0);
};
const startOfDay = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
};
const buildDateWindows = (now) => {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEndExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const last30DaysStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    const previous30DaysStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59));
    const minDate = previousMonthStart < previous30DaysStart
        ? previousMonthStart
        : previous30DaysStart;
    return {
        now,
        monthStart,
        monthEndExclusive,
        previousMonthStart,
        last30DaysStart,
        previous30DaysStart,
        minDate,
    };
};
const buildSummaryPipeline = (userId, windows) => {
    return [
        {
            $match: {
                userId,
                transactionData: { $ne: null },
                "transactionData.date": {
                    $gte: windows.minDate,
                    $lt: windows.monthEndExclusive,
                },
            },
        },
        {
            $facet: {
                mtd: [
                    {
                        $match: {
                            "transactionData.date": {
                                $gte: windows.monthStart,
                                $lt: windows.monthEndExclusive,
                            },
                        },
                    },
                    {
                        $group: {
                            _id: "$transactionData.type",
                            total: { $sum: "$transactionData.amount" },
                        },
                    },
                ],
                previousMonth: [
                    {
                        $match: {
                            "transactionData.date": {
                                $gte: windows.previousMonthStart,
                                $lt: windows.monthStart,
                            },
                        },
                    },
                    {
                        $group: {
                            _id: "$transactionData.type",
                            total: { $sum: "$transactionData.amount" },
                        },
                    },
                ],
                last30Debits: [
                    {
                        $match: {
                            "transactionData.type": "debit",
                            "transactionData.date": {
                                $gte: windows.last30DaysStart,
                                $lt: windows.monthEndExclusive,
                            },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: "$transactionData.amount" },
                        },
                    },
                ],
                previous30Debits: [
                    {
                        $match: {
                            "transactionData.type": "debit",
                            "transactionData.date": {
                                $gte: windows.previous30DaysStart,
                                $lt: windows.last30DaysStart,
                            },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: "$transactionData.amount" },
                        },
                    },
                ],
            },
        },
    ];
};
const calculateMetrics = (facetResult) => {
    const mtdRows = facetResult.mtd ?? [];
    const previousMonthRows = facetResult.previousMonth ?? [];
    const expenseMtd = getTotalByType(mtdRows, "debit");
    const incomeMtd = getTotalByType(mtdRows, "credit");
    const netMtd = round2(incomeMtd - expenseMtd);
    const expensePreviousMonth = getTotalByType(previousMonthRows, "debit");
    const incomePreviousMonth = getTotalByType(previousMonthRows, "credit");
    const netPreviousMonth = round2(incomePreviousMonth - expensePreviousMonth);
    const last30DebitTotal = round2(facetResult.last30Debits?.[0]?.total ?? 0);
    const previous30DebitTotal = round2(facetResult.previous30Debits?.[0]?.total ?? 0);
    return {
        expenseMtd,
        incomeMtd,
        netMtd,
        expensePreviousMonth,
        incomePreviousMonth,
        netPreviousMonth,
        avgDailySpendLast30: round2(last30DebitTotal / 30),
        avgDailySpendPrevious30: round2(previous30DebitTotal / 30),
    };
};
const buildSummaryCards = (windows, metrics) => {
    return {
        period: {
            monthStart: windows.monthStart,
            monthEndExclusive: windows.monthEndExclusive,
            last30DaysStart: windows.last30DaysStart,
            now: windows.now,
        },
        cards: {
            totalExpenseMtd: {
                value: metrics.expenseMtd,
                previousMonthValue: metrics.expensePreviousMonth,
                changePct: pctChange(metrics.expenseMtd, metrics.expensePreviousMonth),
            },
            totalIncomeMtd: {
                value: metrics.incomeMtd,
                previousMonthValue: metrics.incomePreviousMonth,
                changePct: pctChange(metrics.incomeMtd, metrics.incomePreviousMonth),
            },
            netCashFlowMtd: {
                value: metrics.netMtd,
                previousMonthValue: metrics.netPreviousMonth,
                changePct: pctChange(metrics.netMtd, metrics.netPreviousMonth),
            },
            avgDailySpendLast30Days: {
                value: metrics.avgDailySpendLast30,
                previous30DaysValue: metrics.avgDailySpendPrevious30,
                changePct: pctChange(metrics.avgDailySpendLast30, metrics.avgDailySpendPrevious30),
            },
        },
    };
};
export class AnalyticsService {
    async getSummaryCards(userId, now = new Date()) {
        const windows = buildDateWindows(now);
        const pipeline = buildSummaryPipeline(userId, windows);
        const [facetResult] = await Email.aggregate(pipeline);
        const metrics = calculateMetrics(facetResult ?? {});
        return buildSummaryCards(windows, metrics);
    }
    async getDailyExpenseLast30Days(userId, now = new Date()) {
        const today = startOfDay(now);
        const start = startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29));
        const rows = await Email.aggregate([
            {
                $match: {
                    userId,
                    transactionData: { $ne: null },
                    "transactionData.type": "debit",
                    "transactionData.date": { $gte: start, $lte: now },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$transactionData.date",
                        },
                    },
                    total: { $sum: "$transactionData.amount" },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        const byDate = new Map(rows.map((r) => [r._id, r.total]));
        const data = Array.from({ length: 30 }, (_, i) => {
            const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
            const key = d.toISOString().slice(0, 10);
            return { date: key, amount: round2(byDate.get(key) ?? 0) };
        });
        return {
            data,
            period: {
                start: start.toISOString().slice(0, 10),
                end: today.toISOString().slice(0, 10),
            },
        };
    }
}
//# sourceMappingURL=AnalyticsService.js.map