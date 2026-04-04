import { Sun, Moon, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showNotification?: boolean;
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between px-4 pt-4 pb-2">
      <div>
        <h1 className="text-xl font-display font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-secondary text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>
        <button
          onClick={() => navigate("/settings")}
          className="p-2 rounded-full bg-secondary text-foreground"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
