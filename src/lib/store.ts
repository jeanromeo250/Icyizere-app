// In-memory store for MVP (will be replaced with Lovable Cloud later)
import { useState, useEffect } from "react";

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

const DEMO_PRODUCTS: Product[] = [
  { id: "1", name: "Wireless Earbuds", price: 29.99, stock: 45, category: "Electronics", minStock: 10 },
  { id: "2", name: "Phone Case", price: 12.99, stock: 120, category: "Accessories", minStock: 20 },
  { id: "3", name: "USB-C Cable", price: 8.99, stock: 5, category: "Electronics", minStock: 15 },
  { id: "4", name: "Screen Protector", price: 6.99, stock: 200, category: "Accessories", minStock: 30 },
  { id: "5", name: "Bluetooth Speaker", price: 45.99, stock: 18, category: "Electronics", minStock: 10 },
  { id: "6", name: "Laptop Stand", price: 34.99, stock: 3, category: "Office", minStock: 5 },
];

const DEMO_SALES: Sale[] = [
  { id: "1", productId: "1", productName: "Wireless Earbuds", quantity: 2, total: 59.98, date: "2026-03-29", employeeName: "John" },
  { id: "2", productId: "2", productName: "Phone Case", quantity: 5, total: 64.95, date: "2026-03-29", employeeName: "Sarah" },
  { id: "3", productId: "5", productName: "Bluetooth Speaker", quantity: 1, total: 45.99, date: "2026-03-29", employeeName: "John" },
  { id: "4", productId: "4", productName: "Screen Protector", quantity: 3, total: 20.97, date: "2026-03-28", employeeName: "Sarah" },
];

const DEMO_EXPENSES: Expense[] = [
  { id: "1", category: "Rent", amount: 1200, description: "Monthly rent", date: "2026-03-01" },
  { id: "2", category: "Electricity", amount: 180, description: "March bill", date: "2026-03-15" },
  { id: "3", category: "Water", amount: 45, description: "March bill", date: "2026-03-15" },
];

const DEMO_STOCK_ENTRIES: StockEntry[] = [
  { id: "1", productId: "1", productName: "Wireless Earbuds", type: "in", quantity: 50, date: "2026-03-25", note: "Supplier delivery" },
  { id: "2", productId: "1", productName: "Wireless Earbuds", type: "out", quantity: 2, date: "2026-03-29", note: "Sale" },
  { id: "3", productId: "3", productName: "USB-C Cable", type: "out", quantity: 10, date: "2026-03-28", note: "Sale" },
];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>(() => loadFromStorage("eshop_products", DEMO_PRODUCTS));

  useEffect(() => { saveToStorage("eshop_products", products); }, [products]);

  const addProduct = (p: Omit<Product, "id">) => {
    setProducts(prev => [...prev, { ...p, id: Date.now().toString() }]);
  };

  const updateProduct = (id: string, p: Partial<Product>) => {
    setProducts(prev => prev.map(item => item.id === id ? { ...item, ...p } : item));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(item => item.id !== id));
  };

  return { products, addProduct, updateProduct, deleteProduct, setProducts };
}

export function useSales() {
  const [sales, setSales] = useState<Sale[]>(() => loadFromStorage("eshop_sales", DEMO_SALES));
  useEffect(() => { saveToStorage("eshop_sales", sales); }, [sales]);

  const addSale = (s: Omit<Sale, "id">) => {
    setSales(prev => [...prev, { ...s, id: Date.now().toString() }]);
  };

  return { sales, addSale };
}

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>(() => loadFromStorage("eshop_expenses", DEMO_EXPENSES));
  useEffect(() => { saveToStorage("eshop_expenses", expenses); }, [expenses]);

  const addExpense = (e: Omit<Expense, "id">) => {
    setExpenses(prev => [...prev, { ...e, id: Date.now().toString() }]);
  };

  return { expenses, addExpense };
}

export function useStockEntries() {
  const [entries, setEntries] = useState<StockEntry[]>(() => loadFromStorage("eshop_stock", DEMO_STOCK_ENTRIES));
  useEffect(() => { saveToStorage("eshop_stock", entries); }, [entries]);

  const addEntry = (e: Omit<StockEntry, "id">) => {
    setEntries(prev => [...prev, { ...e, id: Date.now().toString() }]);
  };

  return { entries, addEntry };
}
