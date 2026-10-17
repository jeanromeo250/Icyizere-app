import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isAppInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isAppInstalled);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;

    const promptEvent = installPrompt;
    setInstallPrompt(null);
    setInstallError(null);

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
    } catch {
      setInstallError(
        "The browser couldn't open the installation prompt. Use the browser menu to install this app."
      );
    }
  };

  if (installed) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
      {installPrompt && (
        <Button type="button" size="sm" onClick={install}>
          <Download aria-hidden="true" />
          Install app
        </Button>
      )}
      {installError && (
        <p className="text-xs text-destructive" role="alert">
          {installError}
        </p>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer rounded-sm py-1 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          How to install
        </summary>
        <p className="max-w-md py-2">
          In Chrome or Edge, use the install icon in the address bar or choose
          Install app from the browser menu. On iPhone or iPad, open this site in
          Safari, tap Share, then Add to Home Screen. On Android, use Chrome&apos;s
          Install app or Add to Home screen menu option. On macOS, Safari 17 or
          later can add the site to the Dock from the File menu.
        </p>
      </details>
    </div>
  );
}
