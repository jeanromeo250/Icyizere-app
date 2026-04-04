import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, Calendar, Package, ShoppingCart, Receipt, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface ActivityEntry {
  id: string;
  action: string;
  details: Json | null;
  created_at: string;
}

const ACTION_ICONS: Record<string, typeof Activity> = {
  stock_in: ArrowDownToLine,
  stock_out: ArrowUpFromLine,
  add_product: Package,
  edit_product: Package,
  delete_product: Package,
  record_sale: ShoppingCart,
  add_expense: Receipt,
};

const ACTION_COLORS: Record<string, string> = {
  stock_in: "bg-success/10 text-success",
  stock_out: "bg-warning/10 text-warning",
  add_product: "bg-primary/10 text-primary",
  edit_product: "bg-primary/10 text-primary",
  delete_product: "bg-destructive/10 text-destructive",
  record_sale: "bg-accent/10 text-accent",
  add_expense: "bg-warning/10 text-warning",
};

export default function EmployeeActivity() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [employeeName, setEmployeeName] = useState("");
  const [period, setPeriod] = useState("today");
  const [products, setProducts] = useState<any[]>([]);
  const [salesCount, setSalesCount] = useState(0);
  const [stockInQuantity, setStockInQuantity] = useState(0);
  const [stockOutQuantity, setStockOutQuantity] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    if (!employeeId || role !== "manager") return;
    fetchEmployeeData();
    fetchProducts();
    fetchActivity();
  }, [employeeId, period, role]);

  const fetchEmployeeData = async () => {
    const { data: profile } = await (supabase
      .from("profiles" as any) as any)
      .select("full_name")
      .eq("user_id", employeeId!)
      .single();

    const fullName = profile?.full_name || "Employee";
    setEmployeeName(fullName);

    let start: Date | null = null;
    if (period === "today") {
      start = new Date();
      start.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else if (period === "year") {
      start = new Date();
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    }

    const startDate = start ? start.toISOString().split("T")[0] : undefined;

    const salesQuery = (supabase
      .from("sales" as any) as any)
      .select("total, quantity")
      .eq("user_id", employeeId!);
    if (startDate) {
      salesQuery.gte("date", startDate);
    }

    const { data: salesData } = await salesQuery;
    let sales = salesData || [];

    if ((!sales || sales.length === 0) && fullName && fullName !== "Employee") {
      const fallbackQuery = (supabase
        .from("sales" as any) as any)
        .select("total, quantity")
        .eq("employee_name", fullName);
      if (startDate) {
        fallbackQuery.gte("date", startDate);
      }
      const { data: fallbackSales } = await fallbackQuery;
      sales = fallbackSales || [];
    }

    const revenue = sales.reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);
    setSalesCount(sales.length);
    setTotalRevenue(revenue);

    const stockQuery = (supabase
      .from("stock_entries" as any) as any)
      .select("type, quantity")
      .eq("user_id", employeeId!);
    if (startDate) {
      stockQuery.gte("date", startDate);
    }
    const { data: stockEntries } = await stockQuery;

    const entries = stockEntries || [];
    const inQuantity = entries
      .filter((entry: any) => entry.type === "in")
      .reduce((sum: number, entry: any) => sum + Number(entry.quantity || 0), 0);
    const outQuantity = entries
      .filter((entry: any) => entry.type === "out")
      .reduce((sum: number, entry: any) => sum + Number(entry.quantity || 0), 0);

    setStockInQuantity(inQuantity);
    setStockOutQuantity(outQuantity);
  };

  const fetchProducts = async () => {
    const { data } = await (supabase
      .from("products" as any) as any)
      .select("*")
      .order("name");
    if (data) setProducts(data);
  };

  const fetchActivity = async () => {
    let query = (supabase
      .from("activity_log" as any) as any)
      .select("*")
      .eq("user_id", employeeId!)
      .order("created_at", { ascending: false });

    const now = new Date();
    if (period === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      query = query.gte("created_at", start);
    } else if (period === "week") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", start);
    } else if (period === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      query = query.gte("created_at", start);
    } else if (period === "year") {
      const start = new Date(now.getFullYear(), 0, 1).toISOString();
      query = query.gte("created_at", start);
    }

    const { data } = await query.limit(100);
    setActivities(data || []);
  };

  const getDetails = (details: Json | null): Record<string, string> => {
    if (!details || typeof details !== "object" || Array.isArray(details)) return {};
    return details as Record<string, string>;
  };

  // Compute summary
  const totalSales = salesCount;
  const totalStockIn = stockInQuantity;
  const totalStockOut = stockOutQuantity;

  if (role !== "manager") {
    return (
      <div className="pb-24 px-4 pt-8 text-center">
        <p className="text-muted-foreground">Access restricted to managers.</p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="px-4 pt-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/employees")} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <PageHeader title={employeeName || "Employee"} subtitle="Activity & Performance" />

      <div className="px-4 space-y-4 mt-2">
        {/* Period Selector */}
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>

        {/* Performance Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalSales}</p>
            <p className="text-xs text-muted-foreground">Sales Made</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-success">${totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalStockIn}</p>
            <p className="text-xs text-muted-foreground">Stock IN</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalStockOut}</p>
            <p className="text-xs text-muted-foreground">Stock OUT</p>
          </div>
        </div>

        {/* Current Stock Overview */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Current Stock Levels ({products.length} products)
          </h3>

          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No products found.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {products.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.category || "General"}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${product.stock <= product.min_stock ? "text-destructive" : "text-foreground"}`}>
                      {product.stock} units
                    </p>
                    <p className="text-xs text-muted-foreground">Min: {product.min_stock}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Activity Log ({activities.length})
          </h3>

          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No activity in this period.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((act) => {
                const Icon = ACTION_ICONS[act.action] || Activity;
                const color = ACTION_COLORS[act.action] || "bg-muted text-muted-foreground";
                const details = getDetails(act.details);
                const time = new Date(act.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const date = new Date(act.created_at).toLocaleDateString();

                return (
                  <div key={act.id} className="flex items-start gap-3 text-sm">
                    <div className={`p-1.5 rounded-lg ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground capitalize">
                        {act.action.replace(/_/g, " ")}
                      </p>
                      {details.productName && (
                        <p className="text-xs text-muted-foreground">{details.productName}</p>
                      )}
                      {details.total && (
                        <p className="text-xs text-success font-medium">${details.total}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{date} · {time}</p>
                    </div>
                    {details.quantity && (
                      <span className="text-xs font-semibold text-muted-foreground">
                        Qty: {details.quantity}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
