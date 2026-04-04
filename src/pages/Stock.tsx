import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, FileUp, Package, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/PageHeader";
import { useProducts, useStockEntries } from "@/lib/store";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  matchedProductId: string | null;
  matchedProductName: string | null;
}

export default function Stock() {
  const { permissions } = useAuth();

  // Check if user has permission to view stock
  if (permissions && !permissions.can_view_stock) {
    return <Navigate to="/" replace />;
  }

  const { products, updateProduct } = useProducts();
  const { entries, addEntry } = useStockEntries();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stockType, setStockType] = useState<"in" | "out">("in");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [invoiceMeta, setInvoiceMeta] = useState<{ invoiceTotal?: number; supplier?: string; invoiceDate?: string }>({});
  const [invoiceStep, setInvoiceStep] = useState<"upload" | "review">("upload");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const productId = fd.get("product") as string;
    const quantity = parseInt(fd.get("quantity") as string);
    const note = fd.get("note") as string;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Validation: Prevent stock out if quantity exceeds available stock
    if (stockType === "out" && quantity > product.stock) {
      toast({
        title: "Insufficient Stock",
        description: `Cannot remove ${quantity} units. Only ${product.stock} units available for ${product.name}.`,
        variant: "destructive"
      });
      return;
    }

    addEntry({
      productId,
      productName: product.name,
      type: stockType,
      quantity,
      date: new Date().toISOString().split("T")[0],
      note,
    });

    updateProduct(productId, {
      stock: stockType === "in" ? product.stock + quantity : Math.max(0, product.stock - quantity),
    });

    setDialogOpen(false);
  };

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Please upload an image or PDF of the invoice.", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max file size is 10MB.", variant: "destructive" });
      return;
    }

    setInvoiceLoading(true);

    try {
      const base64 = await fileToBase64(file);

      const { data, error } = await supabase.functions.invoke("parse-invoice", {
        body: {
          imageBase64: base64,
          mimeType: file.type,
          existingProducts: products.map(p => ({ id: p.id, name: p.name })),
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({ title: "Could not parse invoice", description: data.error, variant: "destructive" });
        return;
      }

      setInvoiceItems(data.items || []);
      setInvoiceMeta({ invoiceTotal: data.invoiceTotal, supplier: data.supplier, invoiceDate: data.invoiceDate });
      setInvoiceStep("review");
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: "Failed to parse invoice. Please try again.", variant: "destructive" });
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleConfirmInvoice = () => {
    const today = new Date().toISOString().split("T")[0];
    let added = 0;

    invoiceItems.forEach(item => {
      if (item.matchedProductId) {
        const product = products.find(p => p.id === item.matchedProductId);
        if (product) {
          addEntry({
            productId: product.id,
            productName: product.name,
            type: "in",
            quantity: item.quantity,
            date: today,
            note: `Invoice: ${invoiceMeta.supplier || "Supplier"} · RWF ${item.unitPrice}/unit`,
          });
          updateProduct(product.id, { stock: product.stock + item.quantity });
          added++;
        }
      }
    });

    toast({ title: "Stock Updated", description: `${added} product(s) added to stock from invoice.` });
    setInvoiceDialogOpen(false);
    setInvoiceStep("upload");
    setInvoiceItems([]);
  };

  const updateItemMatch = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    setInvoiceItems(prev => prev.map((item, i) =>
      i === index ? { ...item, matchedProductId: productId, matchedProductName: product?.name || null } : item
    ));
  };

  const removeItem = (index: number) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="pb-24">
      <PageHeader title="Stock" subtitle="Manage inventory" />

      <div className="px-4 space-y-4 mt-2">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Dialog open={dialogOpen && stockType === "in"} onOpenChange={(o) => { setDialogOpen(o); setStockType("in"); }}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-3 p-4 rounded-xl border border-success/30 bg-success/5 text-left">
                <div className="p-2 rounded-lg bg-success/20">
                  <ArrowDownToLine className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Stock IN</p>
                  <p className="text-xs text-muted-foreground">Add manually</p>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-2xl">
              <DialogHeader><DialogTitle>Stock IN</DialogTitle></DialogHeader>
              <StockForm products={products} onSubmit={handleSubmit} stockType="in" />
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen && stockType === "out"} onOpenChange={(o) => { setDialogOpen(o); setStockType("out"); if (!o) setSelectedProduct(""); }}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-3 p-4 rounded-xl border border-warning/30 bg-warning/5 text-left">
                <div className="p-2 rounded-lg bg-warning/20">
                  <ArrowUpFromLine className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Stock OUT</p>
                  <p className="text-xs text-muted-foreground">Record outflow</p>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-2xl">
              <DialogHeader><DialogTitle>Stock OUT</DialogTitle></DialogHeader>
              <StockForm
                products={products}
                onSubmit={handleSubmit}
                stockType="out"
                selectedProduct={selectedProduct}
                onProductChange={setSelectedProduct}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Invoice Upload Button */}
        <Dialog open={invoiceDialogOpen} onOpenChange={(o) => { setInvoiceDialogOpen(o); if (!o) { setInvoiceStep("upload"); setInvoiceItems([]); } }}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5 text-left w-full">
              <div className="p-2 rounded-lg bg-primary/20">
                <FileUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">Stock IN via Invoice</p>
                <p className="text-xs text-muted-foreground">Upload invoice to auto-add stock</p>
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>{invoiceStep === "upload" ? "Upload Invoice" : "Review Items"}</DialogTitle>
            </DialogHeader>

            {invoiceStep === "upload" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload an image or photo of your purchase invoice. The system will automatically extract products, quantities, and prices.
                </p>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                  {invoiceLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">Analyzing invoice...</p>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-3">
                      <FileUp className="h-10 w-10 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Tap to upload invoice</p>
                      <p className="text-xs text-muted-foreground">JPG, PNG or PDF · Max 10MB</p>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={handleInvoiceUpload}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {invoiceStep === "review" && (
              <div className="space-y-4">
                {/* Invoice Meta */}
                {(invoiceMeta.supplier || invoiceMeta.invoiceDate) && (
                  <div className="rounded-xl border border-border bg-secondary/50 p-3 text-sm">
                    {invoiceMeta.supplier && <p><span className="font-medium text-foreground">Supplier:</span> <span className="text-muted-foreground">{invoiceMeta.supplier}</span></p>}
                    {invoiceMeta.invoiceDate && <p><span className="font-medium text-foreground">Date:</span> <span className="text-muted-foreground">{invoiceMeta.invoiceDate}</span></p>}
                    {invoiceMeta.invoiceTotal != null && <p><span className="font-medium text-foreground">Total:</span> <span className="text-muted-foreground">RWF {invoiceMeta.invoiceTotal.toLocaleString()}</span></p>}
                  </div>
                )}

                {/* Items */}
                {invoiceItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No items found in invoice</p>
                ) : (
                  <div className="space-y-3">
                    {invoiceItems.map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-border bg-card p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Qty: {item.quantity} · RWF {item.unitPrice}/unit · Total: RWF {item.totalPrice}
                            </p>
                          </div>
                          <button onClick={() => removeItem(idx)} className="p-1 text-muted-foreground hover:text-destructive">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div>
                          <Label className="text-xs">Match to product</Label>
                          <Select
                            value={item.matchedProductId || ""}
                            onValueChange={(v) => updateItemMatch(idx, v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {item.matchedProductId && (
                          <div className="flex items-center gap-1 text-xs text-success">
                            <Check className="h-3 w-3" />
                            Matched: {item.matchedProductName}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setInvoiceStep("upload"); setInvoiceItems([]); }}>
                    Re-upload
                  </Button>
                  <Button
                    className="flex-1 bg-primary text-primary-foreground"
                    onClick={handleConfirmInvoice}
                    disabled={invoiceItems.filter(i => i.matchedProductId).length === 0}
                  >
                    Add {invoiceItems.filter(i => i.matchedProductId).length} to Stock
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* All Products Current Stock Table */}
        <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
          <h3 className="font-semibold text-foreground mb-4 text-base">All Products — Current Stock</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground text-xs">Product</th>
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground text-xs">Category</th>
                  <th className="text-right py-2 px-2 font-semibold text-muted-foreground text-xs">Available</th>
                  <th className="text-right py-2 px-2 font-semibold text-muted-foreground text-xs">Min</th>
                  <th className="text-center py-2 px-2 font-semibold text-muted-foreground text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id} className="border-b border-border/50">
                    <td className="py-3 px-2 text-foreground font-medium">{product.name}</td>
                    <td className="py-3 px-2 text-muted-foreground">{product.category || "-"}</td>
                    <td className="py-3 px-2 text-foreground text-right font-medium">{product.stock}</td>
                    <td className="py-3 px-2 text-muted-foreground text-right">{product.minStock}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={cn(
                        "text-xs font-semibold px-2 py-1 rounded",
                        product.stock > product.minStock
                          ? "bg-success/20 text-success"
                          : "bg-warning/20 text-warning"
                      )}>
                        {product.stock > product.minStock ? "OK" : "LOW"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No products added yet</p>
            )}
          </div>
        </div>

        {/* Stock Movement History Table */}
        <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
          <h3 className="font-semibold text-foreground mb-4 text-base">Stock Movement History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground text-xs">Date</th>
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground text-xs">Product</th>
                  <th className="text-center py-2 px-2 font-semibold text-muted-foreground text-xs">Type</th>
                  <th className="text-right py-2 px-2 font-semibold text-muted-foreground text-xs">Qty</th>
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground text-xs">Note</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice().reverse().map(entry => (
                  <tr key={entry.id} className="border-b border-border/50">
                    <td className="py-3 px-2 text-muted-foreground text-xs">{entry.date}</td>
                    <td className="py-3 px-2 text-foreground font-medium">{entry.productName}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={cn(
                        "text-xs font-semibold px-2 py-1 rounded",
                        entry.type === "in"
                          ? "bg-success/20 text-success"
                          : "bg-destructive/20 text-destructive"
                      )}>
                        {entry.type === "in" ? "IN" : "OUT"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-foreground font-semibold text-right">{entry.quantity}</td>
                    <td className="py-3 px-2 text-muted-foreground text-xs max-w-xs truncate">{entry.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No stock movements yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function StockForm({
  products,
  onSubmit,
  stockType,
  selectedProduct,
  onProductChange
}: {
  products: { id: string; name: string; stock?: number }[];
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  stockType: "in" | "out";
  selectedProduct?: string;
  onProductChange?: (productId: string) => void;
}) {
  const selectedProductData = products.find(p => p.id === selectedProduct);
  const maxQuantity = stockType === "out" && selectedProductData ? selectedProductData.stock : undefined;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label>Product</Label>
        <Select name="product" required value={selectedProduct} onValueChange={onProductChange}>
          <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
          <SelectContent>
            {products.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}{stockType === "out" && p.stock !== undefined ? ` (${p.stock} available)` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Quantity</Label>
        <Input
          name="quantity"
          type="number"
          min="1"
          max={maxQuantity}
          required
          placeholder={stockType === "out" && maxQuantity ? `Max: ${maxQuantity}` : undefined}
        />
        {stockType === "out" && selectedProductData && (
          <p className="text-xs text-muted-foreground mt-1">
            Available stock: {selectedProductData.stock} units
          </p>
        )}
      </div>
      <div>
        <Label>Note</Label>
        <Input name="note" placeholder={stockType === "in" ? "e.g. Supplier delivery" : "e.g. Customer sale"} />
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground">Confirm</Button>
    </form>
  );
}
