// Supabase-backed store hooks — no more localStorage / demo data
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// Untyped client for tables not yet in generated types
const db = createClient(
  "https://qdtdzkahltojqgjrqezc.supabase.co",
  "sb_publishable_1Uw8INt9gaMDpupVnw91Mg_kemNeWGc",
  { auth: { storage: localStorage, persistSession: true, autoRefreshToken: true } }
);

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
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
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

// ---------- useProducts ----------

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) return;
    const { data } = await db
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setProducts(
        data.map((r: any) => ({
          id: r.id,
          name: r.name,
          price: Number(r.price),
          stock: Number(r.stock),
          category: r.category ?? "General",
          minStock: Number(r.min_stock ?? 10),
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
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
          quantity: Number(r.quantity),
          total: Number(r.total),
          date: r.date,
          employeeName: r.employee_name ?? "Unknown",
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
    const { data, error } = await db
      .from("sales")
      .insert({
        product_id: s.productId,
        product_name: s.productName,
        quantity: s.quantity,
        total: s.total,
        date: s.date,
        employee_name: s.employeeName,
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
          employeeName: data.employee_name ?? "Unknown",
        },
        ...prev,
      ]);
    }
  };

  return { sales, addSale, loading };
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
      .eq("user_id", userId)
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
      .eq("user_id", userId)
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
