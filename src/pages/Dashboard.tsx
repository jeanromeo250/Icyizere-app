import { DollarSign, Package, TrendingUp, AlertTriangle, ShoppingCart, ArrowDownRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useProducts, useSales, useExpenses } from "@/lib/store";

export default function Dashboard() {
  const { products } = useProducts();
  const { sales } = useSales();
  const { expenses } = useExpenses();

  const today = new Date().toISOString().split("T")[0];
  const todaySales = sales.filter(s => s.date === today);
  const totalRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalProducts = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStockItems = products.filter(p => p.stock <= p.minStock);
  const profit = totalRevenue - totalExpenses;

  return (
    <div className="pb-24">
      <PageHeader title="ICYIZERE-BUSINESS" subtitle="Today's Overview" showNotification />

      <div className="px-4 space-y-4 mt-2">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Revenue"
            value={`RWF ${totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            variant="success"
            trend={`${todaySales.length} sales today`}
          />
          <StatCard
            title="Expenses"
            value={`RWF ${totalExpenses.toLocaleString()}`}
            icon={ArrowDownRight}
            variant="destructive"
            trend="This month"
          />
          <StatCard
            title="Stock"
            value={totalProducts.toString()}
            icon={Package}
            trend={`${products.length} products`}
          />
          <StatCard
            title="Profit"
            value={`RWF ${profit.toLocaleString()}`}
            icon={TrendingUp}
            variant={profit >= 0 ? "success" : "destructive"}
          />
        </div>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="font-semibold text-sm text-foreground">Low Stock Alert</span>
              <span className="ml-auto text-xs font-medium bg-warning/20 text-warning px-2 py-0.5 rounded-full">
                {lowStockItems.length}
              </span>
            </div>
            <div className="space-y-2">
              {lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{item.name}</span>
                  <span className="text-destructive font-semibold">{item.stock} left</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Sales */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Recent Sales
          </h3>
          <div className="space-y-3">
            {todaySales.slice(0, 5).map(sale => (
              <div key={sale.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-foreground">{sale.productName}</p>
                  <p className="text-xs text-muted-foreground">Qty: {sale.quantity} · {sale.employeeName}</p>
                </div>
                <span className="font-semibold text-success">RWF {sale.total.toLocaleString()}</span>
              </div>
            ))}
            {todaySales.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No sales today yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
