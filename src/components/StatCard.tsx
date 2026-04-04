import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  variant?: "default" | "success" | "warning" | "destructive" | "accent";
  compact?: boolean;
}

const variantStyles = {
  default: "bg-card border-border",
  success: "bg-success/10 border-success/20",
  warning: "bg-warning/10 border-warning/20",
  destructive: "bg-destructive/10 border-destructive/20",
  accent: "bg-accent/10 border-accent/20",
};

const iconStyles = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  destructive: "bg-destructive/20 text-destructive",
  accent: "bg-accent/20 text-accent",
};

export default function StatCard({ title, value, icon: Icon, trend, variant = "default", compact = false }: StatCardProps) {
  if (compact) {
    return (
      <div className={cn("rounded-xl border p-3 space-y-2", variantStyles[variant])}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground truncate">{title}</span>
          <div className={cn("p-2 rounded-lg flex-shrink-0", iconStyles[variant])}>
            <Icon className="h-3 w-3" />
          </div>
        </div>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border p-4 space-y-2", variantStyles[variant])}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
        <div className={cn("p-2 rounded-lg", iconStyles[variant])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
      {trend && <p className="text-xs text-muted-foreground">{trend}</p>}
    </div>
  );
}
