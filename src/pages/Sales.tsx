import { useState } from "react";
import { Plus, ShoppingCart, DollarSign, TrendingUp, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useProducts, useSales } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";

export default function Sales() {
  const { profile } = useAuth();
  const { products, updateProduct } = useProducts();
  const { sales, addSale } = useSales();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [pricePerUnit, setPricePerUnit] = useState(0);
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  const total = selectedProduct ? pricePerUnit * quantity : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    addSale({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity,
      total,
      date: new Date().toISOString().split("T")[0],
      employeeName: profile?.full_name || "Manager",
    });

    updateProduct(selectedProduct.id, { stock: Math.max(0, selectedProduct.stock - quantity) });
    setDialogOpen(false);
    setSelectedProduct(null);
    setQuantity(1);
    setPricePerUnit(0);
  };

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const today = new Date().toISOString().split("T")[0];
  const todaySales = sales.filter(s => s.date === today);
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="pb-24">
      <PageHeader title="Sales" subtitle="Record and monitor sales" />

      <div className="px-4 space-y-4 mt-2">
        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            title="Total Sales"
            value={`RWF ${totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            variant="success"
            compact
          />
          <StatCard
            title="Today's Revenue"
            value={`RWF ${todayRevenue.toLocaleString()}`}
            icon={TrendingUp}
            variant="accent"
            compact
          />
          <StatCard
            title="Transactions"
            value={sales.length.toString()}
            icon={ShoppingCart}
            compact
          />
        </div>

        {/* Record Sale Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-primary text-primary-foreground gap-2">
              <Plus className="h-4 w-4" /> Record Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Record Sale</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label>Product</Label>
                <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productSearchOpen}
                      className="w-full justify-between"
                    >
                      {selectedProduct ? selectedProduct.name : "Search and select product..."}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search products..." />
                      <CommandList>
                        <CommandEmpty>No products found.</CommandEmpty>
                        <CommandGroup>
                          {products.filter(p => p.stock > 0).map((product) => (
                            <CommandItem
                              key={product.id}
                              value={product.name}
                              onSelect={() => {
                                setSelectedProduct(product);
                                setPricePerUnit(product.price);
                                setProductSearchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedProduct?.id === product.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {product.name} (Stock: {product.stock})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedProduct?.stock || 1}
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label>Price per Unit (RWF)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricePerUnit}
                    onChange={e => setPricePerUnit(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              {selectedProduct && (
                <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-sm">
                  <p className="text-muted-foreground">
                    Total: <span className="font-bold text-foreground text-lg">RWF {total.toLocaleString()}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Available stock: {selectedProduct.stock}</p>
                </div>
              )}
              <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={!selectedProduct}>
                Confirm Sale
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Sales List */}
        <div className="space-y-2">
          {sales.slice().reverse().map(sale => (
            <div
              key={sale.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
            >
              <div className="p-2 rounded-lg bg-primary/10">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{sale.productName}</p>
                <p className="text-xs text-muted-foreground">
                  Qty: {sale.quantity} · {sale.employeeName} · {sale.date}
                </p>
              </div>
              <span className="font-semibold text-success text-sm">RWF {sale.total.toLocaleString()}</span>
            </div>
          ))}
          {sales.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No sales recorded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
