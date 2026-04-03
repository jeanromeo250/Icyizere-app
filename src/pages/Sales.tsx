import { useState } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { useProducts, useSales } from "@/lib/store";

export default function Sales() {
  const { products, updateProduct } = useProducts();
  const { sales, addSale } = useSales();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);

  const product = products.find(p => p.id === selectedProduct);
  const total = product ? product.price * quantity : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    addSale({
      productId: product.id,
      productName: product.name,
      quantity,
      total,
      date: new Date().toISOString().split("T")[0],
      employeeName: "Manager",
    });

    updateProduct(product.id, { stock: Math.max(0, product.stock - quantity) });
    setDialogOpen(false);
    setSelectedProduct("");
    setQuantity(1);
  };

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="pb-24">
      <PageHeader title="Sales" subtitle={`RWF ${totalRevenue.toLocaleString()} total revenue`} />

      <div className="px-4 space-y-4 mt-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-primary text-primary-foreground gap-2">
              <Plus className="h-4 w-4" /> New Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-2xl">
            <DialogHeader><DialogTitle>Record Sale</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label>Product</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.filter(p => p.stock > 0).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} (${p.price})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input type="number" min="1" max={product?.stock || 1} value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} />
              </div>
              {product && (
                <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-sm">
                  <p className="text-muted-foreground">Total: <span className="font-bold text-foreground text-lg">${total.toFixed(2)}</span></p>
                  <p className="text-xs text-muted-foreground">Available stock: {product.stock}</p>
                </div>
              )}
              <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={!product}>Confirm Sale</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Sales List */}
        <div className="space-y-2">
          {sales.slice().reverse().map(sale => (
            <div key={sale.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="p-2 rounded-lg bg-primary/10">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{sale.productName}</p>
                <p className="text-xs text-muted-foreground">Qty: {sale.quantity} · {sale.employeeName} · {sale.date}</p>
              </div>
              <span className="font-semibold text-success text-sm">${sale.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
