import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { getPrimaryNavigationItems } from "@/components/navigationItems";

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, permissions } = useAuth();

  const hiddenPaths = ["/login", "/register", "/reset-password"];
  if (hiddenPaths.includes(location.pathname)) return null;

  const navItems = getPrimaryNavigationItems(role, permissions?.can_view_stock ?? null);

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-screen-2xl -translate-x-1/2 border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom lg:hidden">
      <div className="mx-auto grid min-h-14 max-w-3xl grid-flow-col auto-cols-fr items-center px-2 py-1 sm:px-4">
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-all",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium leading-tight sm:text-xs">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
