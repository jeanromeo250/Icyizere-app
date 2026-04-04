import { LayoutDashboard, Package, ShoppingCart, Receipt, Users, BarChart3, Bell, Warehouse } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const baseItems = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: Package, label: "Products", path: "/products" },
  { icon: ShoppingCart, label: "Sales", path: "/sales" },
  { icon: Receipt, label: "Expenses", path: "/expenses" },
  { icon: Warehouse, label: "Stock", path: "/stock" },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();

  const hiddenPaths = ["/login", "/register"];
  if (hiddenPaths.includes(location.pathname)) return null;

  const navItems = [
    ...baseItems,
    ...(role === "manager"
      ? [
          { icon: BarChart3, label: "Reports", path: "/reports" },
          { icon: Users, label: "Team", path: "/employees" },
        ]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom">
      <div className="flex items-center justify-around py-1">
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg transition-all min-w-0",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4", active && "stroke-[2.5]")} />
              <span className="text-[9px] font-medium leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
