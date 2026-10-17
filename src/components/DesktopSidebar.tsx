import {
  Bell,
  Settings,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { BrandLogo, BRAND_NAME } from "@/components/BrandLogo";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { getPrimaryNavigationItems } from "@/components/navigationItems";

const utilityItems = [
  { icon: Bell, label: "Notifications", path: "/notifications" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const authPaths = ["/login", "/register", "/reset-password"];

export default function DesktopSidebar() {
  const location = useLocation();
  const { role, permissions, profile } = useAuth();

  if (authPaths.includes(location.pathname)) return null;

  const primaryItems = getPrimaryNavigationItems(
    role,
    permissions?.can_view_stock ?? null,
  );

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <NavLink to="/" className="flex items-center gap-3 border-b border-border px-5 py-5">
        <BrandLogo />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-foreground">{BRAND_NAME}</span>
          <span className="block text-xs text-muted-foreground">Business management</span>
        </span>
      </NavLink>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        {primaryItems.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            className={({ isActive }) =>
              cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("h-5 w-5 shrink-0", isActive && "stroke-[2.5]")} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        <p className="px-3 pb-2 pt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </p>
        {utilityItems.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("h-5 w-5 shrink-0", isActive && "stroke-[2.5]")} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className="truncate text-sm font-medium text-foreground">
          {profile?.full_name || "Your account"}
        </p>
        <p className="mt-0.5 text-xs capitalize text-muted-foreground">
          {role || "Business user"}
        </p>
      </div>
    </aside>
  );
}
