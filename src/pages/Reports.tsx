import { useState, useMemo } from "react";
import { BarChart3, DollarSign, TrendingUp, TrendingDown, Receipt, PieChart } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useSales, useExpenses } from "@/lib/store";
import { format, subDays, startOfWeek, startOfMonth, startOfYear, isAfter, parseISO } from "date-fns";

type Period = "today" | "week" | "month" | "year" | "all";

function getStartDate(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": return startOfWeek(now, { weekStartsOn: 1 });
    case "month": return startOfMonth(now);
    case "year": return startOfYear(now);
    case "all": return null;
  }
}

const TAX_RATE = 0.18; // 18% estimated tax

export default function Reports() {
  const { sales, loading: salesLoading } = useSales();
  const { expenses, loading: expensesLoading } = useExpenses();
  const [period, setPeriod] = useState<Period>("month");

  const filtered = useMemo(() => {
    const start = getStartDate(period);
    const filteredSales = start
      ? sales.filter(s => isAfter(parseISO(s.date), start) || s.date === format(start, "yyyy-MM-dd"))
      : sales;
    const filteredExpenses = start
      ? expenses.filter(e => isAfter(parseISO(e.date), start) || e.date === format(start, "yyyy-MM-dd"))
      : expenses;
    return { sales: filteredSales, expenses: filteredExpenses };
  }, [sales, expenses, period]);

  const totalSales = filtered.sales.reduce((s, v) => s + v.total, 0);
  const totalExpenses = filtered.expenses.reduce((s, v) => s + v.amount, 0);
  const netProfit = totalSales - totalExpenses;
  const estimatedTax = Math.max(0, netProfit * TAX_RATE);
  const afterTax = netProfit - estimatedTax;

  // Expenses breakdown by category
  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.expenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered.expenses]);

  // Sales by product
  const salesByProduct = useMemo(() => {
    const map: Record<string, { qty: number; total: number }> = {};
    filtered.sales.forEach(s => {
      if (!map[s.productName]) map[s.productName] = { qty: 0, total: 0 };
      map[s.productName].qty += s.quantity;
      map[s.productName].total += s.total;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filtered.sales]);

  const loading = salesLoading || expensesLoading;

  const periodLabel: Record<Period, string> = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    year: "This Year",
    all: "All Time",
  };

  return (
    <div className="pb-24">
      <PageHeader title="Reports" subtitle={`${periodLabel[period]} Summary`} />

      <div className="px-4 space-y-4 mt-2">
        {/* Period Selector */}
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Daily (Today)</SelectItem>
            <SelectItem value="week">Weekly (This Week)</SelectItem>
            <SelectItem value="month">Monthly (This Month)</SelectItem>
            <SelectItem value="year">Yearly (This Year)</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard title="Total Sales" value={`RWF ${totalSales.toLocaleString()}`} icon={DollarSign} variant="success" trend={`${filtered.sales.length} transactions`} />
              <StatCard title="Total Expenses" value={`RWF ${totalExpenses.toLocaleString()}`} icon={TrendingDown} variant="destructive" trend={`${filtered.expenses.length} entries`} />
              <StatCard title="Net Profit" value={`RWF ${netProfit.toLocaleString()}`} icon={TrendingUp} variant={netProfit >= 0 ? "success" : "destructive"} />
              <StatCard title="Est. Tax (18%)" value={`RWF ${estimatedTax.toLocaleString()}`} icon={Receipt} variant="warning" trend={`After tax: RWF ${afterTax.toLocaleString()}`} />
            </div>

            {/* Sales vs Expenses Bar */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Sales vs Expenses
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Sales</span>
                    <span className="font-medium text-success">RWF {totalSales.toLocaleString()}</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-success transition-all"
                      style={{ width: `${totalSales + totalExpenses > 0 ? (totalSales / (totalSales + totalExpenses)) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Expenses</span>
                    <span className="font-medium text-destructive">RWF {totalExpenses.toLocaleString()}</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-destructive transition-all"
                      style={{ width: `${totalSales + totalExpenses > 0 ? (totalExpenses / (totalSales + totalExpenses)) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Expenses Breakdown */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-destructive" />
                Expenses Breakdown
              </h3>
              {expensesByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No expenses in this period</p>
              ) : (
                <div className="space-y-2">
                  {expensesByCategory.map(([cat, amount]) => (
                    <div key={cat} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{cat}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-destructive/70" style={{ width: `${(amount / totalExpenses) * 100}%` }} />
                        </div>
                        <span className="font-medium text-destructive w-24 text-right">RWF {amount.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tax Summary */}
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-warning" />
                Tax Summary
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross Revenue</span>
                  <span className="font-medium text-foreground">RWF {totalSales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Deductions</span>
                  <span className="font-medium text-destructive">-RWF {totalExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxable Income</span>
                  <span className="font-medium text-foreground">RWF {netProfit.toLocaleString()}</span>
                </div>
                <div className="border-t border-border my-1" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Tax (18%)</span>
                  <span className="font-bold text-warning">${estimatedTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Profit After Tax</span>
                  <span className={`font-bold ${afterTax >= 0 ? "text-success" : "text-destructive"}`}>${afterTax.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Top Products */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                Top Selling Products
              </h3>
              {salesByProduct.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No sales in this period</p>
              ) : (
                <div className="space-y-2">
                  {salesByProduct.slice(0, 10).map(([name, data]) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-foreground font-medium">{name}</span>
                        <span className="text-xs text-muted-foreground ml-2">×{data.qty}</span>
                      </div>
                      <span className="font-semibold text-success">${data.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
