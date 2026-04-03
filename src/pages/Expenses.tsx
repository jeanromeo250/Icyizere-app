import { useState } from "react";
import { Plus, Receipt, Zap, Droplets, Home, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { useExpenses } from "@/lib/store";

const categoryIcons: Record<string, React.ReactNode> = {
  Rent: <Home className="h-4 w-4" />,
  Electricity: <Zap className="h-4 w-4" />,
  Water: <Droplets className="h-4 w-4" />,
  Other: <MoreHorizontal className="h-4 w-4" />,
};

export default function Expenses() {
  const { expenses, addExpense } = useExpenses();
  const [dialogOpen, setDialogOpen] = useState(false);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addExpense({
      category: fd.get("category") as string,
      amount: parseFloat(fd.get("amount") as string),
      description: fd.get("description") as string,
      date: new Date().toISOString().split("T")[0],
    });
    setDialogOpen(false);
  };

  return (
    <div className="pb-24">
      <PageHeader title="Expenses" subtitle={`RWF ${totalExpenses.toLocaleString()} total`} />

      <div className="px-4 space-y-4 mt-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-primary text-primary-foreground gap-2">
              <Plus className="h-4 w-4" /> Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-2xl">
            <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label>Category</Label>
                <Select name="category" required defaultValue="Rent">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rent">Rent</SelectItem>
                    <SelectItem value="Electricity">Electricity</SelectItem>
                    <SelectItem value="Water">Water</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Amount</Label><Input name="amount" type="number" step="0.01" required /></div>
              <div><Label>Description</Label><Input name="description" placeholder="e.g. Monthly rent" required /></div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground">Add Expense</Button>
            </form>
          </DialogContent>
        </Dialog>

        <div className="space-y-2">
          {expenses.slice().reverse().map(expense => (
            <div key={expense.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                {categoryIcons[expense.category] || <Receipt className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{expense.description}</p>
                <p className="text-xs text-muted-foreground">{expense.category} · {expense.date}</p>
              </div>
              <span className="font-semibold text-destructive text-sm">-RWF {expense.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
