import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="flex items-start gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-foreground"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <p>
        You&apos;re offline. Cached pages may still open, but live data and changes
        require a connection.
      </p>
    </div>
  );
}
