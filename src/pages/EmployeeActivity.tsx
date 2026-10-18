import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Calendar,
  CircleAlert,
  Loader2,
  Package,
  Receipt,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Period = "today" | "week" | "month" | "year" | "all";

interface ActivityEntry {
  id: string;
  action: string;
  details: Json | null;
  created_at: string;
}

interface EmployeeProfile {
  full_name: string | null;
}

interface ProductRow {
  id: string;
  name: string;
  category: string | null;
  price: number | string;
  min_stock: number | string | null;
}

interface AllocationRow {
  product_id: string;
  quantity: number | string;
  updated_at: string;
}

interface SaleRow {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number | string;
  total: number | string;
  date: string;
  created_at: string;
  employee_name: string | null;
}

interface StockEntryRow {
  id: string;
  product_id: string | null;
  product_name: string;
  type: string;
  quantity: number | string;
  date: string;
  created_at: string;
  note: string | null;
}

interface QueryError {
  message: string;
}

interface QueryResult<T> {
  data: T | null;
  error: QueryError | null;
}

interface EmployeeQuery<T> extends PromiseLike<QueryResult<T[]>> {
  eq(column: string, value: string): EmployeeQuery<T>;
  gte(column: string, value: string): EmployeeQuery<T>;
  order(column: string, options?: { ascending: boolean }): EmployeeQuery<T>;
  limit(count: number): EmployeeQuery<T>;
  maybeSingle(): Promise<QueryResult<T>>;
}

interface EmployeeProductStock {
  id: string;
  name: string;
  category: string;
  price: number;
  minStock: number;
  currentStock: number;
  received: number;
  sold: number;
  removed: number;
  updatedAt: string | null;
}

interface StockMovement {
  id: string;
  productName: string;
  type: "in" | "out" | "sale";
  quantity: number;
  date: string;
  note: string;
  total?: number;
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

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
  all: "All Time",
};

function selectFrom<T>(table: string, columns: string): EmployeeQuery<T> {
  const relation = supabase.from(table as never) as unknown as {
    select: (selectedColumns: string) => EmployeeQuery<T>;
  };
  return relation.select(columns);
}

function getPeriodStart(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start.setDate(start.getDate() - 6);
      return start;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
      return null;
  }
}

function formatQuantity(quantity: number): string {
  return quantity.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatRwf(amount: number): string {
  return `RWF ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function getDetails(details: Json | null): Record<string, Json> {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  return details;
}

function getDetailText(value: Json | undefined): string | null {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return null;
}

export default function EmployeeActivity() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [employeeName, setEmployeeName] = useState("");
  const [period, setPeriod] = useState<Period>("today");
  const [products, setProducts] = useState<EmployeeProductStock[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [salesCount, setSalesCount] = useState(0);
  const [stockInQuantity, setStockInQuantity] = useState(0);
  const [stockOutQuantity, setStockOutQuantity] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId || role !== "manager" || !user) return;

    let cancelled = false;
    const fetchEmployeeData = async () => {
      setLoading(true);
      const start = getPeriodStart(period);
      const startDate = start?.toISOString().slice(0, 10);

      const profileQuery = selectFrom<EmployeeProfile>("profiles", "full_name")
        .eq("user_id", employeeId)
        .maybeSingle();
      const productQuery = selectFrom<ProductRow>("products", "id, name, category, price, min_stock")
        .eq("user_id", user.id)
        .order("name");
      const allocationQuery = selectFrom<AllocationRow>(
        "employee_stock_allocations",
        "product_id, quantity, updated_at",
      )
        .eq("manager_user_id", user.id)
        .eq("employee_user_id", employeeId);
      let salesQuery = selectFrom<SaleRow>(
        "sales",
        "id, product_id, product_name, quantity, total, date, created_at, employee_name",
      )
        .eq("user_id", employeeId);
      let stockQuery = selectFrom<StockEntryRow>(
        "stock_entries",
        "id, product_id, product_name, type, quantity, date, created_at, note",
      )
        .eq("user_id", employeeId);
      let activityQuery = selectFrom<ActivityEntry>("activity_log", "id, action, details, created_at")
        .eq("user_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (startDate) {
        salesQuery = salesQuery.gte("date", startDate);
        stockQuery = stockQuery.gte("date", startDate);
        activityQuery = activityQuery.gte("created_at", start!.toISOString());
      }

      const [profileResult, productResult, allocationResult, salesResult, stockResult, activityResult] =
        await Promise.all([profileQuery, productQuery, allocationQuery, salesQuery, stockQuery, activityQuery]);

      if (cancelled) return;

      const queryErrors = [
        profileResult.error,
        productResult.error,
        allocationResult.error,
        salesResult.error,
        stockResult.error,
        activityResult.error,
      ].filter((error): error is QueryError => error !== null);

      if (queryErrors.length) {
        toast.error(`Failed to load employee activity: ${queryErrors.map((error) => error.message).join("; ")}`);
        setEmployeeName("Employee");
        setActivities([]);
        setProducts([]);
        setMovements([]);
        setSalesCount(0);
        setStockInQuantity(0);
        setStockOutQuantity(0);
        setTotalRevenue(0);
        setLoading(false);
        return;
      }

      const fullName = profileResult.data?.full_name || "Employee";
      let sales: SaleRow[] = salesResult.data || [];
      if (sales.length === 0 && fullName !== "Employee") {
        const { data: fallbackSales, error } = await selectFrom<SaleRow>(
          "sales",
          "id, product_id, product_name, quantity, total, date, created_at, employee_name",
        )
          .eq("employee_name", fullName)
          .gte("date", startDate || "0000-01-01");
        if (cancelled) return;
        if (error) {
          toast.error(`Failed to load employee sales: ${error.message}`);
          setEmployeeName(fullName);
          setActivities([]);
          setProducts([]);
          setMovements([]);
          setSalesCount(0);
          setStockInQuantity(0);
          setStockOutQuantity(0);
          setTotalRevenue(0);
          setLoading(false);
          return;
        }
        sales = fallbackSales || [];
      }

      const productRows = productResult.data || [];
      const productById = new Map(productRows.map((product) => [product.id, product]));
      const productIdByName = new Map(
        productRows.map((product) => [String(product.name).toLocaleLowerCase(), product.id]),
      );
      const keyForProduct = (productId: string | null, productName: string) =>
        productId || productIdByName.get(productName.toLocaleLowerCase()) || `name:${productName}`;
      const stockEntries = stockResult.data || [];
      const allocationRows = allocationResult.data || [];

      const employeeProducts = allocationRows.map((allocation) => {
        const product = productById.get(allocation.product_id);
        const name = product?.name || "Deleted product";
        const productKey = keyForProduct(allocation.product_id, name);
        const productSales = sales.filter((sale) =>
          keyForProduct(sale.product_id, sale.product_name || "") === productKey,
        );
        const productEntries = stockEntries.filter((entry) =>
          keyForProduct(entry.product_id, entry.product_name || "") === productKey,
        );

        return {
          id: allocation.product_id,
          name,
          category: product?.category || "General",
          price: Number(product?.price || 0),
          minStock: Number(product?.min_stock || 0),
          currentStock: Number(allocation.quantity || 0),
          received: productEntries
            .filter((entry) => entry.type === "in")
            .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0),
          sold: productSales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0),
          removed: productEntries
            .filter((entry) => entry.type === "out")
            .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0),
          updatedAt: allocation.updated_at || null,
        };
      });

      const stockMovements: StockMovement[] = [
        ...stockEntries.map((entry) => ({
          id: `stock-${entry.id}`,
          productName: entry.product_name || "Product",
          type: entry.type === "in" ? "in" as const : "out" as const,
          quantity: Number(entry.quantity || 0),
          date: entry.created_at || entry.date,
          note: entry.note || "",
        })),
        ...sales.map((sale) => ({
          id: `sale-${sale.id}`,
          productName: sale.product_name || "Product",
          type: "sale" as const,
          quantity: Number(sale.quantity || 0),
          date: sale.created_at || sale.date,
          note: "Stock reduced by sale",
          total: Number(sale.total || 0),
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setEmployeeName(fullName !== "Employee" ? fullName : sales[0]?.employee_name || fullName);
      setProducts(employeeProducts);
      setMovements(stockMovements);
      setActivities(activityResult.data || []);
      setSalesCount(sales.length);
      setTotalRevenue(sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0));
      setStockInQuantity(
        stockEntries
          .filter((entry) => entry.type === "in")
          .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0),
      );
      setStockOutQuantity(
        stockEntries
          .filter((entry) => entry.type === "out")
          .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0),
      );
      setLoading(false);
    };

    void fetchEmployeeData();
    return () => {
      cancelled = true;
    };
  }, [employeeId, period, role, user]);

  if (role !== "manager") {
    return (
      <div className="mx-auto max-w-screen-xl px-4 pb-24 pt-8 text-center sm:px-6 lg:px-8 lg:pb-8">
        <p className="text-muted-foreground">Access restricted to managers.</p>
      </div>
    );
  }

  const totalCurrentStock = products.reduce((sum, product) => sum + product.currentStock, 0);
  const totalStockValue = products.reduce((sum, product) => sum + product.currentStock * product.price, 0);

  return (
    <div className="pb-24 lg:pb-8">
      <div className="px-4 pt-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" onClick={() => navigate("/employees")} className="mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to employees
        </Button>
      </div>

      <PageHeader title={employeeName || "Employee"} subtitle="Activity & Performance" />

      <div className="mx-auto mt-2 max-w-screen-xl space-y-4 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Performance summary</h2>
            <p className="text-sm text-muted-foreground">{PERIOD_LABELS[period]}</p>
          </div>
          <Select value={period} onValueChange={(value: Period) => setPeriod(value)}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Activity period">
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
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold text-foreground">{salesCount}</p>
            <p className="text-xs text-muted-foreground">Sales made</p>
          </div>
          <div className="rounded-xl border border-success/20 bg-success/10 p-4">
            <p className="text-2xl font-bold text-success">{formatRwf(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">Sales revenue</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold text-foreground">{formatQuantity(stockInQuantity)}</p>
            <p className="text-xs text-muted-foreground">Stock received</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-bold text-foreground">{formatQuantity(stockOutQuantity)}</p>
            <p className="text-xs text-muted-foreground">Stock returned / removed</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-col gap-1 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-foreground">
                <Package className="h-4 w-4 text-primary" />
                Employee stock
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Current assigned balance, with movements for {PERIOD_LABELS[period].toLowerCase()}.
              </p>
            </div>
            <div className="text-sm sm:text-right">
              <p className="font-semibold text-foreground">{formatQuantity(totalCurrentStock)} units on hand</p>
              <p className="text-xs text-muted-foreground">Retail value {formatRwf(totalStockValue)}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading employee stock…
            </div>
          ) : products.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No stock has been assigned to this employee yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-secondary/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Received</th>
                    <th className="px-4 py-3 text-right font-medium">Sold</th>
                    <th className="px-4 py-3 text-right font-medium">Other out</th>
                    <th className="px-4 py-3 text-right font-medium">Available</th>
                    <th className="px-4 py-3 text-right font-medium">Min. stock</th>
                    <th className="px-4 py-3 text-right font-medium">Unit price</th>
                    <th className="px-4 py-3 text-right font-medium">Stock value</th>
                    <th className="px-4 py-3 font-medium">Last updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((product) => {
                    const isLow = product.currentStock <= product.minStock;
                    return (
                      <tr key={product.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-foreground">{product.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{product.category}</td>
                        <td className="px-4 py-3 text-right text-foreground">{formatQuantity(product.received)}</td>
                        <td className="px-4 py-3 text-right text-foreground">{formatQuantity(product.sold)}</td>
                        <td className="px-4 py-3 text-right text-foreground">{formatQuantity(product.removed)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${isLow ? "text-destructive" : "text-foreground"}`}>
                            {formatQuantity(product.currentStock)}
                          </span>
                          {isLow && <CircleAlert className="ml-1 inline h-3.5 w-3.5 text-destructive" aria-label="Low stock" />}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatQuantity(product.minStock)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatRwf(product.price)}</td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          {formatRwf(product.currentStock * product.price)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {product.updatedAt ? new Date(product.updatedAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-border bg-secondary/30 font-semibold text-foreground">
                  <tr>
                    <td className="px-4 py-3" colSpan={5}>Total assigned balance</td>
                    <td className="px-4 py-3 text-right">{formatQuantity(totalCurrentStock)}</td>
                    <td className="px-4 py-3" colSpan={2}></td>
                    <td className="px-4 py-3 text-right">{formatRwf(totalStockValue)}</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <ArrowDownToLine className="h-4 w-4 text-primary" />
            Stock movement history
            <span className="ml-auto text-xs font-normal text-muted-foreground">{movements.length} movements</span>
          </h3>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading stock movements…</p>
          ) : movements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No stock movements for {PERIOD_LABELS[period].toLowerCase()}.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {movements.slice(0, 100).map((movement) => {
                const isIn = movement.type === "in";
                const isSale = movement.type === "sale";
                return (
                  <div key={movement.id} className="flex items-start gap-3 py-3">
                    <div className={`mt-0.5 rounded-lg p-2 ${
                      isIn ? "bg-success/10 text-success" : isSale ? "bg-accent/10 text-accent" : "bg-warning/10 text-warning"
                    }`}>
                      {isIn ? <ArrowDownToLine className="h-4 w-4" /> : isSale ? <ShoppingCart className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-medium text-foreground">{movement.productName}</p>
                        <span className="text-xs text-muted-foreground">
                          {isIn ? "Stock received" : isSale ? "Sale" : "Stock removed"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(movement.date).toLocaleString()} {movement.note && `· ${movement.note}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-semibold ${
                        isIn ? "text-success" : isSale ? "text-accent" : "text-warning"
                      }`}>
                        {isIn ? "+" : "−"}{formatQuantity(movement.quantity)}
                      </p>
                      {movement.total !== undefined && (
                        <p className="text-xs text-muted-foreground">{formatRwf(movement.total)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {movements.length > 100 && (
                <p className="pt-3 text-center text-xs text-muted-foreground">
                  Showing the latest 100 of {movements.length} movements.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
            <Activity className="h-4 w-4 text-primary" />
            Activity log
            <span className="ml-auto text-xs font-normal text-muted-foreground">{activities.length}</span>
          </h3>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading activity…</p>
          ) : activities.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No activity for this period.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => {
                const Icon = ACTION_ICONS[activity.action] || Activity;
                const color = ACTION_COLORS[activity.action] || "bg-muted text-muted-foreground";
                const details = getDetails(activity.details);
                const productName = getDetailText(details.productName);
                const total = getDetailText(details.total);
                const quantity = getDetailText(details.quantity);

                return (
                  <div key={activity.id} className="flex items-start gap-3 text-sm">
                    <div className={`rounded-lg p-1.5 ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium capitalize text-foreground">{activity.action.replace(/_/g, " ")}</p>
                      {productName && <p className="text-xs text-muted-foreground">{productName}</p>}
                      {total && <p className="text-xs font-medium text-success">{formatRwf(Number(total))}</p>}
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                    {quantity && <span className="text-xs font-semibold text-muted-foreground">Qty: {quantity}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          Stock balances are current; received, sold, removed, and activity totals use the selected period.
        </p>
      </div>
    </div>
  );
}
