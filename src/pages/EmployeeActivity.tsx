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

  useEffect(() => {
    if (!employeeId || role !== "manager") return;
    fetchActivity();
    fetchEmployeeName();
  }, [employeeId, period, role]);

  const fetchEmployeeName = async () => {
    const { data } = await (supabase
      .from("profiles" as any) as any)
      .select("full_name")
      .eq("user_id", employeeId!)
      .single();
    if (data) setEmployeeName(data.full_name);
  };

  const fetchActivity = async () => {
    let query = supabase
      .from("activity_log")
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
  const totalSales = activities.filter((a) => a.action === "record_sale").length;
  const totalStockIn = activities.filter((a) => a.action === "stock_in").length;
  const totalStockOut = activities.filter((a) => a.action === "stock_out").length;
  const totalRevenue = activities
    .filter((a) => a.action === "record_sale")
    .reduce((sum, a) => {
      const d = getDetails(a.details);
      return sum + (parseFloat(d.total || "0") || 0);
    }, 0);

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
