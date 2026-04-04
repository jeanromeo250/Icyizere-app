import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, DollarSign, ShoppingCart, Activity, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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

export default function EmployeePerformance() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [employeeName, setEmployeeName] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [performanceData, setPerformanceData] = useState({
    totalSales: 0,
    salesCount: 0,
    averageSale: 0,
    activityCount: 0,
    topProducts: [] as { name: string; count: number; total: number }[],
    dailySales: [] as { date: string; total: number; count: number }[],
  });

  useEffect(() => {
    if (!employeeId || role !== "manager") return;
    fetchEmployeeData();
  }, [employeeId, period, role]);

  const fetchEmployeeData = async () => {
    // Get employee name
    const { data: profile } = await (supabase
      .from("profiles" as any) as any)
      .select("full_name")
      .eq("user_id", employeeId!)
      .single();

    if (profile) setEmployeeName(profile.full_name);

    // Get filtered data based on period
    const start = getStartDate(period);
    let salesQuery = (supabase
      .from("sales" as any) as any)
      .select("*")
      .eq("employee_name", profile?.full_name || "");

    let activityQuery = (supabase
      .from("activity_log" as any) as any)
      .select("*")
      .eq("user_id", employeeId!);

    if (start) {
      const startDateStr = format(start, "yyyy-MM-dd");
      salesQuery = salesQuery.gte("date", startDateStr);
      activityQuery = activityQuery.gte("created_at", start.toISOString());
    }

    const [salesResult, activityResult] = await Promise.all([
      salesQuery,
      activityQuery,
    ]);

    const sales = salesResult.data || [];
    const activities = activityResult.data || [];

    // Calculate metrics
    const totalSales = sales.reduce((sum: number, sale: any) => sum + Number(sale.total), 0);
    const salesCount = sales.length;
    const averageSale = salesCount > 0 ? totalSales / salesCount : 0;
    const activityCount = activities.length;

    // Top products
    const productMap: Record<string, { count: number; total: number }> = {};
    sales.forEach((sale: any) => {
      if (!productMap[sale.product_name]) {
        productMap[sale.product_name] = { count: 0, total: 0 };
      }
      productMap[sale.product_name].count += Number(sale.quantity);
      productMap[sale.product_name].total += Number(sale.total);
    });

    const topProducts = Object.entries(productMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Daily sales for chart
    const dailyMap: Record<string, { total: number; count: number }> = {};
    sales.forEach((sale: any) => {
      if (!dailyMap[sale.date]) {
        dailyMap[sale.date] = { total: 0, count: 0 };
      }
      dailyMap[sale.date].total += Number(sale.total);
      dailyMap[sale.date].count += 1;
    });

    const dailySales = Object.entries(dailyMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setPerformanceData({
      totalSales,
      salesCount,
      averageSale,
      activityCount,
      topProducts,
      dailySales,
    });
  };

  if (role !== "manager") {
    return (
      <div className="pb-24">
        <PageHeader title="Employee Performance" subtitle="Access restricted" />
        <div className="px-4 mt-8 text-center">
          <p className="text-muted-foreground">Only managers can access this page.</p>
        </div>
      </div>
    );
  }

  const periodLabel: Record<Period, string> = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    year: "This Year",
    all: "All Time",
  };

  return (
    <div className="pb-24">
      <PageHeader title={`${employeeName}'s Performance`} subtitle={`${periodLabel[period]} Summary`} />

      <div className="px-4 space-y-4 mt-2">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/employees")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employees
        </Button>

        {/* Period Selector */}
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>

        {/* Performance Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Total Sales"
            value={`RWF ${performanceData.totalSales.toLocaleString()}`}
            icon={DollarSign}
            variant="success"
            compact
          />
          <StatCard
            title="Transactions"
            value={performanceData.salesCount.toString()}
            icon={ShoppingCart}
            compact
          />
          <StatCard
            title="Average Sale"
            value={`RWF ${performanceData.averageSale.toLocaleString()}`}
            icon={TrendingUp}
            variant="accent"
            compact
          />
          <StatCard
            title="Activities"
            value={performanceData.activityCount.toString()}
            icon={Activity}
            compact
          />
        </div>

        {/* Top Products */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Top Products
          </h3>
          {performanceData.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No sales data for this period</p>
          ) : (
            <div className="space-y-3">
              {performanceData.topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.count} units sold</p>
                    </div>
                  </div>
                  <span className="font-semibold text-success text-sm">
                    RWF {product.total.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Daily Sales Chart Placeholder */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Daily Performance
          </h3>
          {performanceData.dailySales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No daily data for this period</p>
          ) : (
            <div className="space-y-2">
              {performanceData.dailySales.slice(-7).map((day) => (
                <div key={day.date} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{format(new Date(day.date), "MMM dd")}</span>
                  <div className="text-right">
                    <p className="font-medium text-foreground">RWF {day.total.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{day.count} sales</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}