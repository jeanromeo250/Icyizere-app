import { Bell, TrendingUp, TrendingDown, Package, ShoppingCart, Receipt, FileText, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useProducts, useSales, useExpenses, useStockEntries } from "@/lib/store";
import { format } from "date-fns";

interface NotificationItem {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  value?: string;
  variant: "success" | "destructive" | "warning" | "default";
  time: string;
}

export default function Notifications() {
  const { products } = useProducts();
  const { sales } = useSales();
  const { expenses } = useExpenses();
  const { entries } = useStockEntries();

  const today = format(new Date(), "yyyy-MM-dd");

  // Today's data
  const todaySales = sales.filter(s => s.date === today);
  const todayExpenses = expenses.filter(e => e.date === today);
  const todayStockIn = entries.filter(e => e.type === "in" && e.date === today);
  const todayStockOut = entries.filter(e => e.type === "out" && e.date === today);
  const lowStockItems = products.filter(p => p.stock <= p.minStock);

  const totalSalesRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const totalExpensesAmount = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalStockInQty = todayStockIn.reduce((sum, e) => sum + e.quantity, 0);
  const totalStockOutQty = todayStockOut.reduce((sum, e) => sum + e.quantity, 0);

  // Build notifications
  const notifications: NotificationItem[] = [];

  // Sales summary
  if (todaySales.length > 0) {
    notifications.push({
      id: "sales-summary",
      icon: ShoppingCart,
      title: "Today's Sales",
      description: `${todaySales.length} sale(s) recorded today`,
      value: `$${totalSalesRevenue.toFixed(2)}`,
      variant: "success",
      time: "Today",
    });
    // Individual sales
    todaySales.forEach(sale => {
      notifications.push({
        id: `sale-${sale.id}`,
        icon: TrendingUp,
        title: `Sold: ${sale.productName}`,
        description: `Qty: ${sale.quantity} · by ${sale.employeeName}`,
        value: `$${sale.total.toFixed(2)}`,
        variant: "success",
        time: sale.date,
      });
    });
  }

  // Stock IN summary
  if (todayStockIn.length > 0) {
    notifications.push({
      id: "stock-in-summary",
      icon: ArrowUpCircle,
      title: "Stock Added Today",
      description: `${todayStockIn.length} item(s) added to stock`,
      value: `+${totalStockInQty} units`,
      variant: "success",
      time: "Today",
    });
    todayStockIn.forEach(entry => {
      notifications.push({
        id: `stockin-${entry.id}`,
        icon: Package,
        title: `Stock In: ${entry.productName}`,
        description: entry.note || "Added to inventory",
        value: `+${entry.quantity}`,
        variant: "default",
        time: entry.date,
      });
    });
  }

  // Stock OUT summary
  if (todayStockOut.length > 0) {
    notifications.push({
      id: "stock-out-summary",
      icon: ArrowDownCircle,
      title: "Stock Removed Today",
      description: `${todayStockOut.length} item(s) removed from stock`,
      value: `-${totalStockOutQty} units`,
      variant: "destructive",
      time: "Today",
    });
    todayStockOut.forEach(entry => {
      notifications.push({
        id: `stockout-${entry.id}`,
        icon: TrendingDown,
        title: `Stock Out: ${entry.productName}`,
        description: entry.note || "Removed from inventory",
        value: `-${entry.quantity}`,
        variant: "destructive",
        time: entry.date,
      });
    });
  }

  // Expenses summary
  if (todayExpenses.length > 0) {
    notifications.push({
      id: "expenses-summary",
      icon: Receipt,
      title: "Today's Expenses",
      description: `${todayExpenses.length} expense(s) recorded`,
      value: `$${totalExpensesAmount.toFixed(2)}`,
      variant: "warning",
      time: "Today",
    });
    todayExpenses.forEach(exp => {
      notifications.push({
        id: `expense-${exp.id}`,
        icon: FileText,
        title: `Expense: ${exp.category}`,
        description: exp.description,
        value: `$${exp.amount.toFixed(2)}`,
        variant: "warning",
        time: exp.date,
      });
    });
  }

  // Low stock alerts
  lowStockItems.forEach(item => {
    notifications.push({
      id: `lowstock-${item.id}`,
      icon: Package,
      title: `Low Stock: ${item.name}`,
      description: `Only ${item.stock} left (min: ${item.minStock})`,
      variant: "destructive",
      time: "Now",
    });
  });

  // No activity fallback
  if (notifications.length === 0) {
    notifications.push({
      id: "no-activity",
      icon: Bell,
      title: "No Activity Today",
      description: "There are no notifications for today yet.",
      variant: "default",
      time: "Today",
    });
  }

  const variantStyles = {
    success: "border-success/30 bg-success/5",
    destructive: "border-destructive/30 bg-destructive/5",
    warning: "border-warning/30 bg-warning/5",
    default: "border-border bg-card",
  };

  const iconStyles = {
    success: "text-success bg-success/10",
    destructive: "text-destructive bg-destructive/10",
    warning: "text-warning bg-warning/10",
    default: "text-muted-foreground bg-secondary",
  };

  return (
    <div className="pb-24">
      <PageHeader title="Notifications" subtitle="Today's Activity" />

      {/* Daily Summary Cards */}
      <div className="px-4 mt-2 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-success/30 bg-success/5 p-3">
            <p className="text-xs text-muted-foreground font-medium">Total Sold</p>
            <p className="text-lg font-bold text-success">${totalSalesRevenue.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{todaySales.length} sales</p>
          </div>
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
            <p className="text-xs text-muted-foreground font-medium">Expenses</p>
            <p className="text-lg font-bold text-warning">${totalExpensesAmount.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{todayExpenses.length} entries</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground font-medium">Stock In</p>
            <p className="text-lg font-bold text-foreground">+{totalStockInQty}</p>
            <p className="text-[10px] text-muted-foreground">{todayStockIn.length} items</p>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs text-muted-foreground font-medium">Stock Out</p>
            <p className="text-lg font-bold text-destructive">-{totalStockOutQty}</p>
            <p className="text-[10px] text-muted-foreground">{todayStockOut.length} items</p>
          </div>
        </div>
      </div>

      {/* Notification Feed */}
      <div className="px-4 space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
          <Bell className="h-4 w-4 text-primary" />
          Activity Feed
        </h3>
        {notifications.map(n => (
          <div
            key={n.id}
            className={`rounded-xl border p-3 flex items-start gap-3 ${variantStyles[n.variant]}`}
          >
            <div className={`p-2 rounded-lg shrink-0 ${iconStyles[n.variant]}`}>
              <n.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground truncate">{n.title}</p>
                {n.value && (
                  <span className="text-sm font-bold text-foreground shrink-0">{n.value}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
