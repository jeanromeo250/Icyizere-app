import { useMemo, useState, useEffect } from "react";
import { Plus, ShoppingCart, DollarSign, TrendingUp, Search, Check, HandCoins, CalendarClock, AlertTriangle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { useProducts, useSales, useCustomerCredits } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { summarizeCustomerCredits } from "@/lib/credit";
import { toast } from "@/hooks/use-toast";

export default function Sales() {
  const { profile, role } = useAuth();
  const { products, updateProduct, setProducts } = useProducts();
  const { sales, addSale, addEmployeeSale } = useSales();
  const { credits, addCustomerCredit, updateCustomerCredit, recordPayment, paymentsByCredit, fetchCreditPayments } = useCustomerCredits();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState("1");
  const [pricePerUnit, setPricePerUnit] = useState(0);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [loanProductName, setLoanProductName] = useState("");
  const [selectedLoanProduct, setSelectedLoanProduct] = useState<any>(null);
  const [loanProductSearchOpen, setLoanProductSearchOpen] = useState(false);
  const [loanQuantity, setLoanQuantity] = useState(1);
  const [loanAmount, setLoanAmount] = useState(0);
  const [loanDueDate, setLoanDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [loanNote, setLoanNote] = useState("");
  const [loanSearch, setLoanSearch] = useState("");
  const [showLoanList, setShowLoanList] = useState(false);
  const [showCompletedLoans, setShowCompletedLoans] = useState(false);
  const [salesSearch, setSalesSearch] = useState("");
  const [salesProduct, setSalesProduct] = useState("");
  const [salesStartDate, setSalesStartDate] = useState("");
  const [salesEndDate, setSalesEndDate] = useState("");
  const [salesSource, setSalesSource] = useState("all");
  const [salesFilterApplied, setSalesFilterApplied] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerDetailOpen, setCustomerDetailOpen] = useState(false);
  const [customerPaymentInput, setCustomerPaymentInput] = useState<Record<string, string>>({});

  const saleQuantity = Number(quantity);
  const total = selectedProduct ? pricePerUnit * saleQuantity : 0;
  const summary = useMemo(() => summarizeCustomerCredits(
    credits.map((credit) => ({
      customerName: credit.customerName,
      amountDue: credit.amountDue,
      paidAmount: credit.paidAmount,
      dueDate: credit.dueDate,
    }))
  ), [credits]);

  const activeLoans = useMemo(
    () => credits.filter((credit) => Number(credit.amountDue || 0) > Number(credit.paidAmount || 0) && credit.status !== "completed"),
    [credits]
  );

  const completedLoans = useMemo(
    () => credits.filter((credit) => Number(credit.amountDue || 0) <= Number(credit.paidAmount || 0) || credit.status === "completed"),
    [credits]
  );

  const filteredLoans = useMemo(() => {
    const query = loanSearch.trim().toLowerCase();
    const source = activeLoans;
    if (!query) return source;

    return source.filter((credit) => {
      const matchesName = credit.customerName.toLowerCase().includes(query);
      const matchesDate = credit.dueDate?.toLowerCase().includes(query) || credit.date.toLowerCase().includes(query);
      const matchesProduct = credit.productName.toLowerCase().includes(query);
      return matchesName || matchesDate || matchesProduct;
    });
  }, [activeLoans, loanSearch]);

  const filteredSales = useMemo(() => {
    const query = salesSearch.trim().toLowerCase();
    const productQuery = salesProduct.trim().toLowerCase();
    const hasSearchCriteria = Boolean(query || productQuery || salesStartDate || salesEndDate || salesSource !== "all");

    if (!hasSearchCriteria) return [];

    return sales.filter((sale) => {
      const matchesQuery = !query ||
        sale.productName.toLowerCase().includes(query) ||
        sale.employeeName.toLowerCase().includes(query) ||
        (sale.customerName ?? "").toLowerCase().includes(query) ||
        sale.date.toLowerCase().includes(query);

      const matchesProduct = !productQuery || sale.productName.toLowerCase().includes(productQuery);
      const matchesDate = salesStartDate && salesEndDate
        ? sale.date >= salesStartDate && sale.date <= salesEndDate
        : salesStartDate || salesEndDate
          ? sale.date === (salesStartDate || salesEndDate)
          : true;
      const matchesSource = salesSource === "all" || (sale.source ?? "sale") === salesSource;

      return matchesQuery && matchesProduct && matchesDate && matchesSource;
    }).slice().reverse();
  }, [sales, salesSearch, salesProduct, salesStartDate, salesEndDate, salesSource]);

  const filteredCompletedLoans = useMemo(() => {
    const query = loanSearch.trim().toLowerCase();
    const source = completedLoans;
    if (!query) return source;

    return source.filter((credit) => {
      const matchesName = credit.customerName.toLowerCase().includes(query);
      const matchesDate = credit.dueDate?.toLowerCase().includes(query) || credit.date.toLowerCase().includes(query);
      const matchesProduct = credit.productName.toLowerCase().includes(query);
      return matchesName || matchesDate || matchesProduct;
    });
  }, [completedLoans, loanSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    if (!Number.isFinite(saleQuantity) || saleQuantity <= 0 || saleQuantity > selectedProduct.stock) {
      toast({
        title: "Invalid quantity",
        description: `Enter a quantity greater than 0 and no more than the ${selectedProduct.stock} units in stock.`,
        variant: "destructive",
      });
      return;
    }

    const sale = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: saleQuantity,
      total,
      date: new Date().toISOString().split("T")[0],
      employeeName: profile?.full_name || "Manager",
    };

    if (role === "employee") {
      const recorded = await addEmployeeSale(sale);
      if (!recorded) {
        toast({
          title: "Sale not recorded",
          description: "The employee stock may have changed. Refresh and try again.",
          variant: "destructive",
        });
        return;
      }
      setProducts((current) => current.map((product) =>
        product.id === selectedProduct.id
          ? { ...product, stock: Math.max(0, product.stock - saleQuantity) }
          : product
      ));
    } else {
      addSale(sale);
      updateProduct(selectedProduct.id, { stock: Math.max(0, selectedProduct.stock - saleQuantity) });
    }
    setDialogOpen(false);
    setSelectedProduct(null);
    setQuantity("1");
    setPricePerUnit(0);
  };

  const handleLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const productLabel = (selectedLoanProduct?.name || loanProductName || "").trim();
    if (!customerName.trim() || !productLabel || loanAmount <= 0) return;

    addCustomerCredit({
      customerName: customerName.trim(),
      productName: productLabel,
      quantity: loanQuantity,
      amountDue: loanAmount,
      paidAmount: 0,
      status: "open",
      date: new Date().toISOString().split("T")[0],
      dueDate: loanDueDate,
      employeeName: profile?.full_name || "Manager",
      note: loanNote.trim(),
    });

    setLoanDialogOpen(false);
    setCustomerName("");
    setLoanProductName("");
    setSelectedLoanProduct(null);
    setLoanQuantity(1);
    setLoanAmount(0);
    setLoanDueDate(new Date().toISOString().split("T")[0]);
    setLoanNote("");
  };

  const openCustomerDetail = async (credit: any) => {
    setSelectedCustomer(credit);
    setCustomerDetailOpen(true);
    await fetchCreditPayments(credit.id);
  };

  const handleCustomerDetailPayment = async (credit: any) => {
    const remaining = Math.max(0, Number(credit.amountDue || 0) - Number(credit.paidAmount || 0));
    const amountInput = customerPaymentInput[credit.id];
    const amount = Number(amountInput && amountInput !== "" ? amountInput : remaining);

    if (!amount || amount <= 0 || amount > remaining) return;

    await recordPayment(credit.id, amount, profile?.full_name || "Manager", "Payment from customer detail");
    setCustomerPaymentInput((prev) => ({ ...prev, [credit.id]: "" }));
    await fetchCreditPayments(credit.id);
    setSelectedCustomer({ ...credit, paidAmount: Number(credit.paidAmount || 0) + amount });
  };

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const today = new Date().toISOString().split("T")[0];
  const todaySales = sales.filter(s => s.date === today);
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="pb-24 lg:pb-8">
      <PageHeader title="Sales" subtitle="Record and monitor sales" />

      <div className="mx-auto mt-2 max-w-screen-xl space-y-4 px-4 sm:px-6 lg:px-8">
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

        <div className="grid grid-cols-2 gap-3">
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
                      <Button variant="outline" role="combobox" aria-expanded={productSearchOpen} className="w-full justify-between">
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
                                <Check className={cn("mr-2 h-4 w-4", selectedProduct?.id === product.id ? "opacity-100" : "opacity-0")} />
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
                    <Input type="number" min="0" max={selectedProduct?.stock} step="any" required value={quantity} onChange={e => setQuantity(e.target.value)} />
                  </div>
                  <div>
                    <Label>Price per Unit (RWF)</Label>
                    <Input type="number" step="0.01" min="0" value={pricePerUnit} onChange={e => setPricePerUnit(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                {selectedProduct && (
                  <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-sm">
                    <p className="text-muted-foreground">Total: <span className="font-bold text-foreground text-lg">RWF {total.toLocaleString()}</span></p>
                    <p className="text-xs text-muted-foreground">Available stock: {selectedProduct.stock}</p>
                  </div>
                )}
                <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={!selectedProduct}>Confirm Sale</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={loanDialogOpen} onOpenChange={setLoanDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-amber-500 text-white gap-2">
                <HandCoins className="h-4 w-4" /> Record Loan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-2xl">
              <DialogHeader>
                <DialogTitle>Record Loan / Credit</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleLoanSubmit} className="space-y-3">
                <div>
                  <Label>Customer name</Label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. John Ndayisenga" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Product</Label>
                    <Popover open={loanProductSearchOpen} onOpenChange={setLoanProductSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={loanProductSearchOpen} className="w-full justify-between">
                          {selectedLoanProduct ? selectedLoanProduct.name : "Search and select product..."}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search products..." />
                          <CommandList>
                            <CommandEmpty>No products found.</CommandEmpty>
                            <CommandGroup>
                              {products.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={product.name}
                                  onSelect={() => {
                                    setSelectedLoanProduct(product);
                                    setLoanProductName(product.name);
                                    setLoanProductSearchOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", selectedLoanProduct?.id === product.id ? "opacity-100" : "opacity-0")} />
                                  {product.name} (Stock: {product.stock})
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input type="number" min="1" value={loanQuantity} onChange={e => setLoanQuantity(parseInt(e.target.value) || 1)} />
                  </div>
                </div>
                <div>
                  <Label>Amount owed (RWF)</Label>
                  <Input type="number" min="0" step="100" value={loanAmount} onChange={e => setLoanAmount(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Due date</Label>
                  <Input type="date" value={loanDueDate} onChange={e => setLoanDueDate(e.target.value)} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={loanNote} onChange={e => setLoanNote(e.target.value)} placeholder="Payment plan or reminder" />
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                  <p className="text-muted-foreground">Customer owes: <span className="font-bold text-foreground text-lg">RWF {loanAmount.toLocaleString()}</span></p>
                  <p className="text-xs text-muted-foreground">This is saved separately from sales and will show in the loan list.</p>
                </div>
                <Button type="submit" className="w-full bg-amber-500 text-white" disabled={!customerName.trim() || !(selectedLoanProduct?.name || loanProductName.trim()) || loanAmount <= 0}>Save Loan</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Loans</p>
            <span className="text-xs text-amber-600 font-medium">{summary.activeCustomers} customers</span>
          </div>
          <p className="text-2xl font-bold text-foreground">RWF {summary.totalOutstanding.toLocaleString()}</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Due today: {summary.dueTodayCount}</span>
            <span>Overdue: {summary.overdueCount}</span>
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={() => setShowLoanList((prev) => !prev)}>
            {showLoanList ? "Hide Loan List" : "Unhide Loan List"}
          </Button>
        </div>

        {showLoanList && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input value={loanSearch} onChange={e => setLoanSearch(e.target.value)} placeholder="Search customer, date or product" className="h-9" />
            </div>

            <div className="space-y-2">
              {filteredLoans.length > 0 ? filteredLoans.map((credit) => {
                const isOverdue = credit.dueDate && credit.dueDate < today && credit.amountDue > credit.paidAmount;
                const isDueToday = credit.dueDate === today && credit.amountDue > credit.paidAmount;
                const outstanding = Math.max(0, credit.amountDue - credit.paidAmount);

                return (
                  <div key={credit.id} className="flex items-start gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <HandCoins className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={() => openCustomerDetail(credit)} className="font-medium text-foreground text-sm truncate text-left underline-offset-2 hover:underline">
                          {credit.customerName}
                        </button>
                        <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-amber-500/10 text-amber-700">
                          {credit.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{credit.productName} · Qty: {credit.quantity}</p>
                      <p className="text-xs text-muted-foreground">Recorded: {credit.date}</p>
                      <p className="text-xs text-muted-foreground">Due: {credit.dueDate || credit.date}</p>
                      {isOverdue && (
                        <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-red-600"><AlertTriangle className="h-3 w-3" /> Overdue, customer did not pay on time.</p>
                      )}
                      {isDueToday && (
                        <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-orange-600"><CalendarClock className="h-3 w-3" /> Due today. Customer should pay today.</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-700 text-sm">RWF {outstanding.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">owed</p>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground text-center py-8">No active loans found for this search.</p>
              )}
            </div>

            <div className="border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setShowCompletedLoans((prev) => !prev)}
                className="w-full text-left text-sm font-medium text-foreground"
              >
                {showCompletedLoans ? "Hide completed loans" : `Show completed loans (${filteredCompletedLoans.length})`}
              </button>

              {showCompletedLoans && (
                <div className="mt-3 space-y-2">
                  {filteredCompletedLoans.length > 0 ? filteredCompletedLoans.map((credit) => (
                    <div key={credit.id} className="flex items-start gap-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <Check className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <button type="button" onClick={() => openCustomerDetail(credit)} className="font-medium text-foreground text-sm truncate text-left underline-offset-2 hover:underline">
                            {credit.customerName}
                          </button>
                          <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700">
                            {credit.status || "completed"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{credit.productName} · Qty: {credit.quantity}</p>
                        <p className="text-xs text-muted-foreground">Total paid: RWF {Number(credit.paidAmount || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Completed on: {credit.date}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No completed loans found.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <Dialog open={customerDetailOpen} onOpenChange={setCustomerDetailOpen}>
          <DialogContent className="max-w-[90vw] rounded-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedCustomer?.customerName ?? "Customer details"}</DialogTitle>
            </DialogHeader>
            {selectedCustomer && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-muted-foreground text-xs">Total Loan</p>
                    <p className="font-semibold">RWF {Number(selectedCustomer.amountDue || 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-muted-foreground text-xs">Total Paid</p>
                    <p className="font-semibold">RWF {Number(selectedCustomer.paidAmount || 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-muted-foreground text-xs">Remaining</p>
                    <p className="font-semibold">RWF {Math.max(0, Number(selectedCustomer.amountDue || 0) - Number(selectedCustomer.paidAmount || 0)).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-muted-foreground text-xs">Status</p>
                    <p className="font-semibold capitalize">{selectedCustomer.status}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Amount to pay</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      max={Math.max(0, Number(selectedCustomer.amountDue || 0) - Number(selectedCustomer.paidAmount || 0))}
                      value={customerPaymentInput[selectedCustomer.id] || ""}
                      onChange={(e) => setCustomerPaymentInput((prev) => ({ ...prev, [selectedCustomer.id]: e.target.value }))}
                      placeholder={`Max ${Math.max(0, Number(selectedCustomer.amountDue || 0) - Number(selectedCustomer.paidAmount || 0)).toLocaleString()}`}
                    />
                    <Button type="button" onClick={() => handleCustomerDetailPayment(selectedCustomer)} className="bg-emerald-600 text-white">
                      Pay
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">If left empty, the system will pay the remaining balance.</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Payment history</p>
                  {(paymentsByCredit[selectedCustomer.id] ?? []).length > 0 ? (
                    <div className="space-y-2">
                      {(paymentsByCredit[selectedCustomer.id] ?? []).map((payment) => (
                        <div key={payment.id} className="rounded-lg border border-border p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">RWF {Number(payment.amount || 0).toLocaleString()}</span>
                            <span className="text-muted-foreground">{payment.paidOn}</span>
                          </div>
                          <p className="text-muted-foreground">By: {payment.employeeName}</p>
                          {payment.note && <p className="text-muted-foreground">Note: {payment.note}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No payment recorded yet.</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Sales records</p>
            <span className="text-xs text-muted-foreground">{filteredSales.length} match{filteredSales.length === 1 ? "" : "es"}</span>
          </div>

          <div className="grid gap-2">
            <Input
              value={salesSearch}
              onChange={(e) => setSalesSearch(e.target.value)}
              placeholder="Search product, customer, employee or date"
              className="h-9"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={salesProduct}
                onChange={(e) => setSalesProduct(e.target.value)}
                placeholder="Product name"
                className="h-9"
              />
              <Input
                type="date"
                value={salesStartDate}
                onChange={(e) => setSalesStartDate(e.target.value)}
                aria-label="Sales start date"
                className="h-9"
              />
              <Input
                type="date"
                value={salesEndDate}
                onChange={(e) => setSalesEndDate(e.target.value)}
                aria-label="Sales end date"
                className="h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={salesSource}
                onChange={(e) => setSalesSource(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All sales</option>
                <option value="sale">Regular sales</option>
                <option value="loan">Loan records</option>
                <option value="loan_payment">Loan payments</option>
              </select>
              <Button type="button" onClick={() => setSalesFilterApplied(true)} className="h-9 px-3 bg-primary text-primary-foreground">
                Search
              </Button>
            </div>
          </div>

          {salesFilterApplied && (
            <div className="space-y-2">
              {filteredSales.map(sale => (
                <div key={sale.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className="p-2 rounded-lg bg-primary/10"><ShoppingCart className="h-4 w-4 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground text-sm truncate">{sale.productName}</p>
                      <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
                        {(sale.source ?? "sale").replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Qty: {sale.quantity} · {sale.employeeName} · {sale.date}</p>
                    {sale.customerName && <p className="text-[10px] text-muted-foreground">Customer: {sale.customerName}</p>}
                  </div>
                  <span className="font-semibold text-success text-sm">RWF {sale.total.toLocaleString()}</span>
                </div>
              ))}
              {filteredSales.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No sales match this search.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
