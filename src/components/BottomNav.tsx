import { LayoutDashboard, Package, ArrowLeftRight, ShoppingCart, Receipt, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const baseItems = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: Package, label: "Products", path: "/products" },
  { icon: ArrowLeftRight, label: "Stock", path: "/stock" },
  { icon: ShoppingCart, label: "Sales", path: "/sales" },
  { icon: Receipt, label: "Expenses", path: "/expenses" },
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
      ? [{ icon: Users, label: "Team", path: "/employees" }]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom">
      <div className="flex items-center justify-around py-1.5">
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{label}</span>
              {active && <div className="h-0.5 w-4 rounded-full bg-primary mt-0.5" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
