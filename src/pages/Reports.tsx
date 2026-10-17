import { useState, useMemo } from "react";
import { BarChart3, DollarSign, TrendingUp, TrendingDown, Receipt, PieChart, HandCoins, Download, Search } from "lucide-react";
import { jsPDF } from "jspdf";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useSales, useExpenses, useCustomerCredits, useProducts, useStockEntries } from "@/lib/store";
import { format, subDays, startOfWeek, startOfMonth, startOfYear, isAfter, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

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
  const { permissions } = useAuth();

  // Check if user has permission to view stock (required for reports)
  if (permissions && !permissions.can_view_stock) {
    return <Navigate to="/" replace />;
  }

  const { sales, loading: salesLoading } = useSales();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { credits, loading: creditsLoading } = useCustomerCredits();
  const { products, loading: productsLoading } = useProducts();
  const { entries: stockEntries, loading: stockLoading } = useStockEntries();
  const [period, setPeriod] = useState<Period>("month");
  const [loanClientSearch, setLoanClientSearch] = useState("");
  const [loanReportDate, setLoanReportDate] = useState("");
  const [loanReportApplied, setLoanReportApplied] = useState(false);

  const filtered = useMemo(() => {
    const start = getStartDate(period);
    const filteredSales = start
      ? sales.filter(s => isAfter(parseISO(s.date), start) || s.date === format(start, "yyyy-MM-dd"))
      : sales;
    const filteredExpenses = start
      ? expenses.filter(e => isAfter(parseISO(e.date), start) || e.date === format(start, "yyyy-MM-dd"))
      : expenses;
    const filteredStockEntries = start
      ? stockEntries.filter(e => isAfter(parseISO(e.date), start) || e.date === format(start, "yyyy-MM-dd"))
      : stockEntries;
    const filteredCredits = start
      ? credits.filter(c => isAfter(parseISO(c.date), start) || c.date === format(start, "yyyy-MM-dd"))
      : credits;
    return { sales: filteredSales, expenses: filteredExpenses, stockEntries: filteredStockEntries, credits: filteredCredits };
  }, [sales, expenses, stockEntries, credits, period]);

  const totalSales = filtered.sales.reduce((s, v) => s + v.total, 0);
  const totalExpenses = filtered.expenses.reduce((s, v) => s + v.amount, 0);
  const netProfit = totalSales - totalExpenses;
  const estimatedTax = Math.max(0, netProfit * TAX_RATE);
  const afterTax = netProfit - estimatedTax;
  const stockAdded = filtered.stockEntries.filter((entry) => entry.type === "in").reduce((sum, entry) => sum + entry.quantity, 0);
  const stockRemoved = filtered.stockEntries.filter((entry) => entry.type === "out").reduce((sum, entry) => sum + entry.quantity, 0);
  const totalStockUnits = products.reduce((sum, product) => sum + product.stock, 0);
  const periodLoanAmount = filtered.credits.reduce((sum, credit) => sum + Number(credit.amountDue || 0), 0);
  const periodLoanPaid = filtered.credits.reduce((sum, credit) => sum + Number(credit.paidAmount || 0), 0);
  const periodLoanOutstanding = filtered.credits.reduce((sum, credit) => sum + Math.max(0, Number(credit.amountDue || 0) - Number(credit.paidAmount || 0)), 0);

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

  const loading = salesLoading || expensesLoading || creditsLoading || productsLoading || stockLoading;

  const filteredLoanReport = useMemo(() => {
    const clientQuery = loanClientSearch.trim().toLowerCase();
    return credits.filter((credit) => {
      const matchesClient = !clientQuery || credit.customerName.toLowerCase().includes(clientQuery);
      const matchesDate = !loanReportDate || credit.date === loanReportDate || credit.dueDate === loanReportDate;
      return matchesClient && matchesDate;
    });
  }, [credits, loanClientSearch, loanReportDate]);

  const downloadLoanReport = () => {
    if (filteredLoanReport.length === 0) return;

    const document = new jsPDF();
    document.setFontSize(18);
    document.text("ICYIZERE BUSINESS - Loan Report", 14, 18);
    document.setFontSize(10);
    document.text(`Client: ${loanClientSearch.trim() || "All clients"}`, 14, 27);
    document.text(`Date: ${loanReportDate || "All dates"}`, 14, 34);

    let y = 46;
    filteredLoanReport.forEach((credit, index) => {
      const remaining = Math.max(0, Number(credit.amountDue || 0) - Number(credit.paidAmount || 0));
      document.setFontSize(11);
      document.text(`${index + 1}. ${credit.customerName} - ${credit.productName}`, 14, y);
      document.setFontSize(9);
      document.text(`Recorded: ${credit.date} | Due: ${credit.dueDate || credit.date}`, 18, y + 6);
      document.text(`Loan: RWF ${Number(credit.amountDue || 0).toLocaleString()} | Paid: RWF ${Number(credit.paidAmount || 0).toLocaleString()} | Remaining: RWF ${remaining.toLocaleString()} | Status: ${credit.status}`, 18, y + 12);
      y += 23;
      if (y > 275) {
        document.addPage();
        y = 20;
      }
    });

    document.save(`loan-report-${loanReportDate || "all-dates"}.pdf`);
  };

  const downloadFullReport = () => {
    const document = new jsPDF();
    const money = (value: number) => `RWF ${value.toLocaleString()}`;
    const reportDate = format(new Date(), "yyyy-MM-dd");
    let y = 18;

    const addLine = (text: string, size = 9) => {
      const lines = document.splitTextToSize(text, 180) as string[];
      if (y + lines.length * 5 > 280) {
        document.addPage();
        y = 18;
      }
      document.setFontSize(size);
      document.text(lines, 14, y);
      y += lines.length * 5 + 2;
    };

    document.setFontSize(20);
    document.text("ICYIZERE BUSINESS", 14, y);
    y += 8;
    document.setFontSize(14);
    document.text(`${periodLabel[period]} Financial Report`, 14, y);
    y += 6;
    addLine(`Generated: ${reportDate} | Report period: ${periodLabel[period]}`, 9);

    addLine("CALCULATED SUMMARY", 13);
    addLine(`Revenue = sum of sales totals: ${money(totalSales)}`);
    addLine(`Expenses = sum of expense amounts: ${money(totalExpenses)}`);
    addLine(`Stock = current quantity across all products: ${totalStockUnits} units`);
    addLine(`Profit = revenue - expenses: ${money(netProfit)}`);
    addLine(`Estimated tax = max(0, profit x 18%): ${money(estimatedTax)}`);
    addLine(`Profit after tax = profit - estimated tax: ${money(afterTax)}`);
    addLine(`Loans created in period: ${money(periodLoanAmount)} | Paid: ${money(periodLoanPaid)} | Outstanding: ${money(periodLoanOutstanding)}`);
    addLine(`Stock added: ${stockAdded} units | Stock removed: ${stockRemoved} units | Products currently listed: ${products.length}`);

    addLine("SALES TRANSACTIONS", 13);
    filtered.sales.forEach((sale, index) => {
      addLine(`${index + 1}. ${sale.date} | ${sale.productName} | Qty ${sale.quantity} | ${money(sale.total)} | ${(sale.source ?? "sale").replace("_", " ")} | ${sale.employeeName}`);
    });
    if (filtered.sales.length === 0) addLine("No sales transactions in this period.");

    addLine("EXPENSE TRANSACTIONS", 13);
    filtered.expenses.forEach((expense, index) => {
      addLine(`${index + 1}. ${expense.date} | ${expense.category} | ${money(expense.amount)} | ${expense.description || "No description"}`);
    });
    if (filtered.expenses.length === 0) addLine("No expense transactions in this period.");

    addLine("STOCK TRANSACTIONS", 13);
    filtered.stockEntries.forEach((entry, index) => {
      addLine(`${index + 1}. ${entry.date} | ${entry.type === "in" ? "Added" : "Removed"} | ${entry.productName} | Qty ${entry.quantity} | ${entry.note || "No note"}`);
    });
    if (filtered.stockEntries.length === 0) addLine("No stock transactions in this period.");

    addLine("LOAN TRANSACTIONS", 13);
    filtered.credits.forEach((credit, index) => {
      const remaining = Math.max(0, Number(credit.amountDue || 0) - Number(credit.paidAmount || 0));
      addLine(`${index + 1}. ${credit.date} | ${credit.customerName} | ${credit.productName} | Loan ${money(Number(credit.amountDue || 0))} | Paid ${money(Number(credit.paidAmount || 0))} | Remain ${money(remaining)} | ${credit.status}`);
    });
    if (filtered.credits.length === 0) addLine("No loan transactions in this period.");

    document.save(`icyizere-${period}-report-${reportDate}.pdf`);
  };

  const periodLabel: Record<Period, string> = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    year: "This Year",
    all: "All Time",
  };

  return (
    <div className="pb-24 lg:pb-8">
      <PageHeader title="Reports" subtitle={`${periodLabel[period]} Summary`} />

      <div className="mx-auto mt-2 max-w-screen-xl space-y-4 px-4 sm:px-6 lg:px-8">
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

        <Button type="button" onClick={downloadFullReport} disabled={loading} className="w-full">
          <Download className="h-4 w-4" />
          Download Complete {periodLabel[period]} Report
        </Button>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                  <span className="font-bold text-warning">RWF {estimatedTax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Profit After Tax</span>
                  <span className={`font-bold ${afterTax >= 0 ? "text-success" : "text-destructive"}`}>RWF {afterTax.toLocaleString()}</span>
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
                      <span className="font-semibold text-success">RWF {data.total.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <HandCoins className="h-4 w-4 text-amber-600" />
                  Loan Report
                </h3>
                <span className="text-xs text-muted-foreground">{loanReportApplied ? `${filteredLoanReport.length} match(es)` : "Search to view"}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={loanClientSearch}
                    onChange={(event) => setLoanClientSearch(event.target.value)}
                    placeholder="Search one client"
                    className="h-9 pl-9"
                  />
                </div>
                <Input
                  type="date"
                  value={loanReportDate}
                  onChange={(event) => setLoanReportDate(event.target.value)}
                  aria-label="Loan report date"
                  className="h-9"
                />
                <Button type="button" onClick={() => setLoanReportApplied(true)} className="h-9">
                  Search
                </Button>
              </div>
              {loanReportApplied && (
                <>
                  {filteredLoanReport.length > 0 ? (
                    <div className="space-y-2">
                      {filteredLoanReport.map((credit) => {
                        const remaining = Math.max(0, Number(credit.amountDue || 0) - Number(credit.paidAmount || 0));
                        return (
                          <div key={credit.id} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-foreground">{credit.customerName}</span>
                              <span className="text-xs capitalize text-muted-foreground">{credit.status}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{credit.productName} · Recorded {credit.date} · Due {credit.dueDate || credit.date}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Loan: RWF {Number(credit.amountDue || 0).toLocaleString()} · Paid: RWF {Number(credit.paidAmount || 0).toLocaleString()} · Remain: RWF {remaining.toLocaleString()}</p>
                          </div>
                        );
                      })}
                      <Button type="button" variant="outline" onClick={downloadLoanReport} className="w-full">
                        <Download className="h-4 w-4" /> Download Loan Report
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No loans found for this client and date.</p>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
