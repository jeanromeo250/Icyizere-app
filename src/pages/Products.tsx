import { useState } from "react";
import { Plus, Search, Pencil, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { useProducts, Product } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function Products() {
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const isAddingNew = dialogOpen && !editing;

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get("name") as string,
      price: parseFloat(fd.get("price") as string),
      stock: parseInt(fd.get("stock") as string),
      category: fd.get("category") as string,
      minStock: parseInt(fd.get("minStock") as string),
    };

    if (editing) {
      updateProduct(editing.id, data);
    } else {
      addProduct(data);
    }
    setEditing(null);
    setDialogOpen(false);
  };

  return (
    <div className="pb-24">
      <PageHeader title="Products" subtitle={`${products.length} items`} />

      <div className="px-4 space-y-4 mt-2">
        {/* Search + Add */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              disabled={isAddingNew}
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button size="icon" className="shrink-0 bg-primary text-primary-foreground">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div><Label>Name</Label><Input name="name" defaultValue={editing?.name} required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Price</Label><Input name="price" type="number" step="0.01" defaultValue={editing?.price} required /></div>
                  <div><Label>Stock</Label><Input name="stock" type="number" defaultValue={editing?.stock} required /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Category</Label><Input name="category" defaultValue={editing?.category || "General"} required /></div>
                  <div><Label>Min Stock</Label><Input name="minStock" type="number" defaultValue={editing?.minStock || 10} required /></div>
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground">{editing ? "Update" : "Add Product"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Product List */}
        <div className="space-y-2">
          {filtered.map(product => (
            <div key={product.id} className={cn(
              "flex items-center gap-3 p-3 rounded-xl border border-border bg-card",
              isAddingNew && "opacity-50 pointer-events-none"
            )}>
              <div className={cn(
                "p-2.5 rounded-lg",
                product.stock <= product.minStock ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
              )}>
                <Package className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.category} · Stock: {product.stock}</p>
              </div>
              <span className="font-semibold text-foreground text-sm">RWF {product.price.toLocaleString()}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditing(product); setDialogOpen(true); }}
                  disabled={isAddingNew}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteProduct(product.id)}
                  disabled={isAddingNew}
                  className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
