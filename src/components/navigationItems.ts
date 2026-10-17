import {
  BarChart3,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingCart,
  Users,
  Warehouse,
} from "lucide-react";

const primaryItems = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: Package, label: "Products", path: "/products" },
  { icon: ShoppingCart, label: "Sales", path: "/sales" },
  { icon: Receipt, label: "Expenses", path: "/expenses" },
  { icon: Warehouse, label: "Stock", path: "/stock" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
];

export function getPrimaryNavigationItems(
  role: string | null,
  canViewStock: boolean | null,
) {
  return [
    ...primaryItems.filter(
      (item) => item.label !== "Reports" || canViewStock !== false,
    ),
    ...(role === "manager"
      ? [{ icon: Users, label: "Employees", path: "/employees" }]
      : []),
  ];
}
