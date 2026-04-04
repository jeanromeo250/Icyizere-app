import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, FileUp, Package, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import { useProducts, useStockEntries } from "@/lib/store";
import { cn } from "@/lib/utils";
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

  
  if (permissions && !permissions.can_add_stock && !permissions.can_remove_stock) {
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

    const supportedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv"
    ];

    if (!file.type.startsWith("image/") && !supportedTypes.includes(file.type)) {
      toast({ title: "Invalid file", description: "Please upload an image, PDF, DOCX, or text invoice.", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max file size is 10MB.", variant: "destructive" });
      return;
    }

    setInvoiceLoading(true);

    try {
      const rawText = await extractTextFromFile(file);
      const parsedItems = parseInvoiceText(rawText);

      if (!parsedItems.length) {
        toast({ title: "No items found", description: "We could not detect any invoice items. Please try a clearer invoice.", variant: "destructive" });
        return;
      }

      const matchedItems = parsedItems.map(item => {
        const match = findBestProductMatch(item.name, products);
        return {
          ...item,
          matchedProductId: match?.id ?? null,
          matchedProductName: match?.name ?? null,
        };
      });

      setInvoiceItems(matchedItems);
      setInvoiceMeta(parseInvoiceMeta(rawText));
      setInvoiceStep("review");
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: "Failed to parse invoice. Please try again.", variant: "destructive" });
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleConfirmInvoice = () => {
    const unmatched = invoiceItems.filter(item => !item.matchedProductId);
    if (unmatched.length > 0) {
      toast({
        title: "Missing products",
        description: `The following items were not found in stock: ${unmatched.map(item => item.name).join(", ")}. Add them as products first or correct the invoice data.`,
        variant: "destructive"
      });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    let added = 0;

    invoiceItems.forEach(item => {
      if (!item.matchedProductId) return;
      const product = products.find(p => p.id === item.matchedProductId);
      if (!product) return;

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
    });

    toast({ title: "Stock Updated", description: `${added} product(s) added to stock from invoice.` });
    setInvoiceDialogOpen(false);
    setInvoiceStep("upload");
    setInvoiceItems([]);
  };

  const unmatchedCount = invoiceItems.filter(item => !item.matchedProductId).length;

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

                {unmatchedCount > 0 && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <p className="font-semibold">Unmatched invoice items</p>
                    <p className="text-xs">{unmatchedCount} item{unmatchedCount === 1 ? "" : "s"} could not be found in stock. Match them manually or add the missing product first.</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setInvoiceStep("upload"); setInvoiceItems([]); }}>
                    Re-upload
                  </Button>
                  <Button
                    className="flex-1 bg-primary text-primary-foreground"
                    onClick={handleConfirmInvoice}
                    disabled={invoiceItems.length === 0 || unmatchedCount > 0}
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
  const [internalSelectedProduct, setInternalSelectedProduct] = useState(selectedProduct || "");
  const [productSearch, setProductSearch] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    setInternalSelectedProduct(selectedProduct || "");
  }, [selectedProduct]);

  const currentProductId = selectedProduct ?? internalSelectedProduct;
  const productValue = currentProductId;

  const setProduct = (productId: string) => {
    if (onProductChange) {
      onProductChange(productId);
    } else {
      setInternalSelectedProduct(productId);
    }
  };

  const selectedProductData = products.find(p => p.id === productValue);
  const maxQuantity = stockType === "out" && selectedProductData ? selectedProductData.stock : undefined;

  const filteredProducts = products
    .filter((product) => product.name.toLowerCase().includes(productSearch.toLowerCase()))
    .slice(0, 50);

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="product" value={productValue} />
      <div>
        <Label>Product</Label>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
            >
              <span>{selectedProductData ? selectedProductData.name : "Search product..."}</span>
              <span className="text-xs text-muted-foreground">Search</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput
                value={productSearch}
                onValueChange={setProductSearch}
                placeholder="Search products..."
              />
              <CommandList>
                <CommandEmpty>No products found.</CommandEmpty>
                <CommandGroup>
                  {filteredProducts.map(product => (
                    <CommandItem
                      key={product.id}
                      value={product.id}
                      onSelect={() => {
                        setProduct(product.id);
                        setPopoverOpen(false);
                        setProductSearch("");
                      }}
                    >
                      <Check className={cn(
                        "mr-2 h-4 w-4",
                        product.id === productValue ? "opacity-100" : "opacity-0"
                      )} />
                      {product.name}{stockType === "out" && product.stock !== undefined ? ` (${product.stock} available)` : ""}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedProductData && stockType === "out" && (
          <p className="text-xs text-muted-foreground mt-1">Available stock: {selectedProductData.stock} units</p>
        )}
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
      </div>
      <div>
        <Label>Note</Label>
        <Input name="note" placeholder={stockType === "in" ? "e.g. Supplier delivery" : "e.g. Customer sale"} />
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground">Confirm</Button>
    </form>
  );
}

function normalizeInvoiceText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findBestProductMatch(name: string, products: { id: string; name: string }[]) {
  const normalizedName = normalizeInvoiceText(name);
  if (!normalizedName) return null;

  const exactMatch = products.find(product => normalizeInvoiceText(product.name) === normalizedName);
  if (exactMatch) return exactMatch;

  const containsMatch = products.find(product => normalizeInvoiceText(product.name).includes(normalizedName) || normalizedName.includes(normalizeInvoiceText(product.name)));
  if (containsMatch) return containsMatch;

  const tokenMatches = products.map(product => {
    const productTokens = normalizeInvoiceText(product.name).split(" ").filter(Boolean);
    const invoiceTokens = normalizedName.split(" ").filter(Boolean);
    const commonTokens = productTokens.filter(token => invoiceTokens.includes(token));
    return {
      product,
      score: commonTokens.length,
    };
  }).filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score);

  return tokenMatches.length ? tokenMatches[0].product : null;
}

function extractInvoiceDate(text: string): string | undefined {
  const match = text.match(/\b(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\b/);
  return match?.[0];
}

function parseInvoiceMeta(text: string) {
  return {
    supplier: undefined,
    invoiceDate: extractInvoiceDate(text),
    invoiceTotal: undefined,
  };
}

function parseInvoiceText(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !/invoice|subtotal|total|tax|amount|balance|qty|quantity|unit price|description/i.test(line));

  const items: InvoiceItem[] = [];

  for (const line of lines) {
    const normalizedLine = line.replace(/,/g, "");
    const numbers = Array.from(normalizedLine.matchAll(/\d+(?:\.\d+)?/g)).map(match => match[0]);
    if (numbers.length < 2) continue;

    const quantity = parseInt(numbers[0], 10);
    if (isNaN(quantity) || quantity <= 0) continue;

    const totalPrice = parseFloat(numbers[numbers.length - 1]);
    if (isNaN(totalPrice)) continue;

    const unitPrice = numbers.length >= 2 ? parseFloat(numbers[numbers.length - 2]) || totalPrice / quantity : totalPrice / quantity;
    const firstNumberIndex = normalizedLine.indexOf(numbers[0]);
    const name = firstNumberIndex >= 0 ? line.slice(0, firstNumberIndex).trim() : line;
    if (!name || name.length < 2) continue;

    items.push({
      name,
      quantity,
      unitPrice,
      totalPrice,
      matchedProductId: null,
      matchedProductName: null,
    });
  }

  return items;
}

async function extractTextFromFile(file: File) {
  if (file.type.startsWith("image/")) {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker({ logger: () => null });
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    const { data } = await worker.recognize(file);
    await worker.terminate();
    return data.text;
  }

  if (file.type === "application/pdf") {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const url = URL.createObjectURL(file);
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(" ");
      text += `${pageText}\n`;
    }
    URL.revokeObjectURL(url);
    return text;
  }

  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const { default: mammothLib } = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammothLib.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (file.type === "text/plain" || file.type === "text/csv") {
    return await file.text();
  }

  throw new Error("Unsupported invoice file type");
}
