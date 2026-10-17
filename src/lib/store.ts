// Supabase-backed store hooks
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCreditStatus } from "@/lib/credit";

// Use the project's Supabase client (cast to any for tables not yet in generated types)
const db = supabase as any;

// ---------- Types ----------

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  minStock: number;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  total: number;
  date: string;
  employeeName: string;
  source?: "sale" | "loan_payment";
  customerName?: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
}

export interface CustomerCredit {
  id: string;
  customerName: string;
  productName: string;
  quantity: number;
  amountDue: number;
  paidAmount: number;
  status: "open" | "partial" | "paid" | "completed";
  date: string;
  dueDate: string;
  employeeName: string;
  note?: string;
}

export interface CustomerCreditPayment {
  id: string;
  creditId: string;
  amount: number;
  paidOn: string;
  employeeName: string;
  note?: string;
}

export interface StockEntry {
  id: string;
  productId: string;
  productName: string;
  type: "in" | "out";
  quantity: number;
  date: string;
  note: string;
}

// ---------- Helper ----------

async function getUserId(): Promise<string | null> {
  const { data } = await db.auth.getUser();
  return data.user?.id ?? null;
}

async function getUserFullName(): Promise<string | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await db.from("profiles").select("full_name").eq("user_id", userId).single();
  return data?.full_name ?? null;
}

export async function consumeEmployeeStock(
  productId: string,
  quantity: number,
  kind: "sale" | "out",
  note?: string,
) {
  return db.rpc("consume_employee_stock", {
    p_product_id: productId,
    p_quantity: quantity,
    p_kind: kind,
    p_total: 0,
    p_date: new Date().toISOString().split("T")[0],
    p_employee_name: await getUserFullName(),
    p_note: note ?? null,
  });
}

// ---------- useProducts ----------

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    const { data: employeeLink, error: employeeLinkError } = await db
      .from("employee_permissions")
      .select("manager_user_id")
      .eq("employee_user_id", userId)
      .maybeSingle();
    if (employeeLinkError) {
      console.error("Failed to determine employee stock owner:", employeeLinkError);
      setProducts([]);
      setLoading(false);
      return;
    }
    const ownerId = employeeLink?.manager_user_id ?? userId;
    const { data, error } = await db
      .from("products")
      .select("*")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to fetch products:", error);
      setProducts([]);
      setLoading(false);
      return;
    }
    if (data) {
      let employeeStock: Record<string, number> = {};
      if (employeeLink) {
        const { data: allocations, error } = await db
          .from("employee_stock_allocations")
          .select("product_id, quantity")
          .eq("employee_user_id", userId);
        if (error) {
          console.error("Failed to fetch employee stock:", error);
          setProducts([]);
          setLoading(false);
          return;
        }
        employeeStock = Object.fromEntries(
          (allocations ?? [])
            .filter((allocation: any) => Number(allocation.quantity) > 0)
            .map((allocation: any) => [allocation.product_id, Number(allocation.quantity)])
        );
      }
      setProducts(
        data
          .filter((r: any) => !employeeLink || employeeStock[r.id] !== undefined)
          .map((r: any) => ({
            id: r.id,
            name: r.name,
            price: Number(r.price),
            stock: employeeLink ? employeeStock[r.id] : Number(r.stock),
            category: r.category ?? "General",
            minStock: Number(r.min_stock ?? 10),
          }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();

    const { data: authListener } = db.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        fetchProducts();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchProducts]);

  const addProduct = async (p: Omit<Product, "id">) => {
    const userId = await getUserId();
    if (!userId) return;
    const { data, error } = await db
      .from("products")
      .insert({
        name: p.name,
        price: p.price,
        stock: p.stock,
        category: p.category,
        min_stock: p.minStock,
        user_id: userId,
      })
      .select()
      .single();
    if (!error && data) {
      setProducts((prev) => [
        {
          id: data.id,
          name: data.name,
          price: Number(data.price),
          stock: Number(data.stock),
          category: data.category ?? "General",
          minStock: Number(data.min_stock ?? 10),
        },
        ...prev,
      ]);
    }
  };

  const updateProduct = async (id: string, p: Partial<Product>) => {
    const updates: any = {};
    if (p.name !== undefined) updates.name = p.name;
    if (p.price !== undefined) updates.price = p.price;
    if (p.stock !== undefined) updates.stock = p.stock;
    if (p.category !== undefined) updates.category = p.category;
    if (p.minStock !== undefined) updates.min_stock = p.minStock;

    const { error } = await db.from("products").update(updates).eq("id", id);
    if (!error) {
      setProducts((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...p } : item))
      );
    }
  };

  const deleteProduct = async (id: string) => {
    const { error } = await db.from("products").delete().eq("id", id);
    if (!error) {
      setProducts((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return { products, addProduct, updateProduct, deleteProduct, setProducts, loading };
}

// ---------- useSales ----------

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSales = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) return;
    const { data } = await db
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setSales(
        data.map((r: any) => ({
          id: r.id,
          productId: r.product_id,
          productName: r.product_name,
          quantity: Number(r.quantity ?? 1),
          total: Number(r.total ?? 0),
          date: r.date,
          employeeName: r.employee_name ?? "Unknown",
          source: (r.source as "sale" | "loan_payment") ?? "sale",
          customerName: r.customer_name ?? undefined,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const addSale = async (s: Omit<Sale, "id">) => {
    const userId = await getUserId();
    if (!userId) return;
    const fullName = s.employeeName || (await getUserFullName()) || "Unknown";
    const source = s.source ?? "sale";
    const { data, error } = await db
      .from("sales")
      .insert({
        product_id: s.productId,
        product_name: s.productName,
        quantity: s.quantity,
        total: s.total,
        date: s.date,
        employee_name: fullName,
        source,
        customer_name: s.customerName ?? null,
        user_id: userId,
      })
      .select()
      .single();
    if (!error && data) {
      setSales((prev) => [
        {
          id: data.id,
          productId: data.product_id,
          productName: data.product_name,
          quantity: Number(data.quantity),
          total: Number(data.total),
          date: data.date,
          employeeName: data.employee_name ?? fullName,
          source: (data.source as "sale" | "loan_payment") ?? source,
          customerName: data.customer_name ?? s.customerName,
        },
        ...prev,
      ]);
    }
  };

  const addEmployeeSale = async (s: Omit<Sale, "id">) => {
    const userId = await getUserId();
    if (!userId) return false;
    const fullName = s.employeeName || (await getUserFullName()) || "Unknown";
    const { data: saleId, error } = await db.rpc("consume_employee_stock", {
      p_product_id: s.productId,
      p_quantity: s.quantity,
      p_kind: "sale",
      p_total: s.total,
      p_date: s.date,
      p_employee_name: fullName,
      p_note: null,
    });
    if (error || !saleId) {
      console.error("Failed to record employee sale:", error);
      return false;
    }
    setSales((prev) => [{ ...s, id: saleId, employeeName: fullName }, ...prev]);
    return true;
  };

  return { sales, addSale, addEmployeeSale, loading };
}

// ---------- useCustomerCredits ----------

export function useCustomerCredits() {
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [paymentsByCredit, setPaymentsByCredit] = useState<Record<string, CustomerCreditPayment[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) return;
    const { data } = await db
      .from("customer_credits")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setCredits(
        data.map((r: any) => ({
          id: r.id,
          customerName: r.customer_name ?? "Unknown customer",
          productName: r.product_name ?? "Product",
          quantity: Number(r.quantity ?? 1),
          amountDue: Number(r.amount_due ?? 0),
          paidAmount: Number(r.paid_amount ?? 0),
          status: (r.status as "open" | "partial" | "paid" | "completed") ?? "open",
          date: r.date,
          dueDate: r.due_date ?? r.date,
          employeeName: r.employee_name ?? "Unknown",
          note: r.note ?? "",
        }))
      );
    }
    setLoading(false);
  }, []);

  const fetchCreditPayments = useCallback(async (creditId: string) => {
    const userId = await getUserId();
    if (!userId) return [] as CustomerCreditPayment[];

    const { data } = await db
      .from("customer_credit_payments")
      .select("*")
      .eq("credit_id", creditId)
      .order("paid_on", { ascending: false });

    const mapped = (data ?? []).map((r: any) => ({
      id: r.id,
      creditId: r.credit_id,
      amount: Number(r.amount ?? 0),
      paidOn: r.paid_on,
      employeeName: r.employee_name ?? "Unknown",
      note: r.note ?? "",
    }));

    setPaymentsByCredit((prev) => ({ ...prev, [creditId]: mapped }));
    return mapped;
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const addCustomerCredit = async (c: Omit<CustomerCredit, "id" | "status" | "paidAmount" > & { paidAmount?: number; status?: "open" | "partial" | "paid" }) => {
    const userId = await getUserId();
    if (!userId) return;
    const fullName = c.employeeName || (await getUserFullName()) || "Unknown";
    const amountDue = Number(c.amountDue ?? 0);
    const paidAmount = Number(c.paidAmount ?? 0);
    const dueDate = c.dueDate || c.date;
    const status = c.status ?? getCreditStatus(amountDue, paidAmount);

    const { data, error } = await db
      .from("customer_credits")
      .insert({
        customer_name: c.customerName,
        product_name: c.productName,
        quantity: c.quantity,
        amount_due: amountDue,
        paid_amount: paidAmount,
        status,
        date: c.date,
        due_date: dueDate,
        note: c.note ?? "",
        employee_name: fullName,
        user_id: userId,
      })
      .select()
      .single();

    if (!error && data) {
      await db.from("sales").insert({
        product_id: null,
        product_name: `Loan - ${c.customerName}`,
        quantity: c.quantity,
        total: amountDue,
        date: c.date,
        employee_name: fullName,
        source: "loan",
        customer_name: c.customerName,
        user_id: userId,
      });
      setCredits((prev) => [
        {
          id: data.id,
          customerName: data.customer_name ?? c.customerName,
          productName: data.product_name ?? c.productName,
          quantity: Number(data.quantity ?? c.quantity),
          amountDue: Number(data.amount_due ?? amountDue),
          paidAmount: Number(data.paid_amount ?? paidAmount),
          status: (data.status as "open" | "partial" | "paid" | "completed") ?? status,
          date: data.date,
          dueDate: data.due_date ?? dueDate,
          employeeName: data.employee_name ?? fullName,
          note: data.note ?? c.note ?? "",
        },
        ...prev,
      ]);
    }
  };

  const updateCustomerCredit = async (id: string, updates: Partial<Pick<CustomerCredit, "amountDue" | "paidAmount" | "status">>) => {
    const userId = await getUserId();
    if (!userId) return;

    const payload: any = {};
    if (updates.amountDue !== undefined) payload.amount_due = updates.amountDue;
    if (updates.paidAmount !== undefined) payload.paid_amount = updates.paidAmount;
    if (updates.status !== undefined) payload.status = updates.status;

    const currentRecord = credits.find((credit) => credit.id === id);
    if (currentRecord && updates.paidAmount !== undefined) {
      const nextStatus = getCreditStatus(
        updates.amountDue ?? currentRecord.amountDue,
        updates.paidAmount
      );
      payload.status = nextStatus;
    } else if (updates.status !== undefined) {
      payload.status = updates.status;
    }

    const { data, error } = await db
      .from("customer_credits")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      setCredits((prev) =>
        prev.map((credit) =>
          credit.id === id
            ? {
                ...credit,
                amountDue: Number(data.amount_due ?? credit.amountDue),
                paidAmount: Number(data.paid_amount ?? credit.paidAmount),
                status: (data.status as "open" | "partial" | "paid" | "completed") ?? credit.status,
              }
            : credit
        )
      );
    }
  };

  const recordPayment = async (creditId: string, amount: number, employeeName?: string, note?: string) => {
    const userId = await getUserId();
    if (!userId || amount <= 0) return;

    const currentCredit = credits.find((credit) => credit.id === creditId);
    if (!currentCredit) return;

    const fullName = employeeName || (await getUserFullName()) || "Unknown";
    const paidOn = new Date().toISOString().split("T")[0];

    const { data, error } = await db
      .from("customer_credit_payments")
      .insert({
        credit_id: creditId,
        amount,
        paid_on: paidOn,
        employee_name: fullName,
        note: note ?? "",
        user_id: userId,
      })
      .select()
      .single();

    if (error || !data) return;

    const nextPaidAmount = Number(currentCredit.paidAmount || 0) + amount;
    const nextStatus = getCreditStatus(currentCredit.amountDue, nextPaidAmount);

    await updateCustomerCredit(creditId, {
      paidAmount: nextPaidAmount,
      status: nextStatus,
    });

    const paymentEntry: CustomerCreditPayment = {
      id: data.id,
      creditId: creditId,
      amount: Number(data.amount ?? amount),
      paidOn: data.paid_on ?? paidOn,
      employeeName: data.employee_name ?? fullName,
      note: data.note ?? note ?? "",
    };

    setPaymentsByCredit((prev) => ({
      ...prev,
      [creditId]: [paymentEntry, ...(prev[creditId] ?? [])],
    }));

    await db.from("sales").insert({
      product_id: null,
      product_name: `Loan payment - ${currentCredit.customerName}`,
      quantity: 1,
      total: amount,
      date: paidOn,
      employee_name: fullName,
      user_id: userId,
    });
  };

  return { credits, paymentsByCredit, addCustomerCredit, updateCustomerCredit, recordPayment, fetchCreditPayments, loading };
}

// ---------- useExpenses ----------

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) return;
    const { data } = await db
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setExpenses(
        data.map((r: any) => ({
          id: r.id,
          category: r.category,
          amount: Number(r.amount),
          description: r.description ?? "",
          date: r.date,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const addExpense = async (e: Omit<Expense, "id">) => {
    const userId = await getUserId();
    if (!userId) return;
    const { data, error } = await db
      .from("expenses")
      .insert({
        category: e.category,
        amount: e.amount,
        description: e.description,
        date: e.date,
        user_id: userId,
      })
      .select()
      .single();
    if (!error && data) {
      setExpenses((prev) => [
        {
          id: data.id,
          category: data.category,
          amount: Number(data.amount),
          description: data.description ?? "",
          date: data.date,
        },
        ...prev,
      ]);
    }
  };

  return { expenses, addExpense, loading };
}

// ---------- useStockEntries ----------

export function useStockEntries() {
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) return;
    const { data } = await db
      .from("stock_entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setEntries(
        data.map((r: any) => ({
          id: r.id,
          productId: r.product_id,
          productName: r.product_name,
          type: r.type as "in" | "out",
          quantity: Number(r.quantity),
          date: r.date,
          note: r.note ?? "",
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addEntry = async (e: Omit<StockEntry, "id">) => {
    const userId = await getUserId();
    if (!userId) return;
    const { data, error } = await db
      .from("stock_entries")
      .insert({
        product_id: e.productId,
        product_name: e.productName,
        type: e.type,
        quantity: e.quantity,
        date: e.date,
        note: e.note,
        user_id: userId,
      })
      .select()
      .single();
    if (!error && data) {
      setEntries((prev) => [
        {
          id: data.id,
          productId: data.product_id,
          productName: data.product_name,
          type: data.type as "in" | "out",
          quantity: Number(data.quantity),
          date: data.date,
          note: data.note ?? "",
        },
        ...prev,
      ]);
    }
  };

  return { entries, addEntry, loading };
}
