import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NetworkStatus from "./NetworkStatus";
import PwaInstallPrompt from "./PwaInstallPrompt";

describe("NetworkStatus", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("shows an offline message and clears it when connectivity returns", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<NetworkStatus />);

    expect(screen.getByRole("status")).toHaveTextContent(/you're offline/i);

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    fireEvent(window, new Event("online"));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("PwaInstallPrompt", () => {
  it("offers the native prompt only after the browser signals installability", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt"), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    });

    render(<PwaInstallPrompt />);
    expect(screen.queryByRole("button", { name: /install app/i })).not.toBeInTheDocument();
    expect(screen.getByText(/how to install/i)).toBeInTheDocument();

    fireEvent(window, event);
    fireEvent.click(await screen.findByRole("button", { name: /install app/i }));

    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByText(/how to install/i)).not.toBeInTheDocument());
  });

  it("provides a browser-menu fallback if the native prompt fails", async () => {
    const event = Object.assign(new Event("beforeinstallprompt"), {
      prompt: vi.fn().mockRejectedValue(new Error("Prompt unavailable")),
      userChoice: Promise.resolve({ outcome: "dismissed" as const, platform: "web" }),
    });

    render(<PwaInstallPrompt />);
    fireEvent(window, event);
    fireEvent.click(await screen.findByRole("button", { name: /install app/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/use the browser menu/i);
    expect(screen.getByText(/how to install/i)).toBeInTheDocument();
  });

  it("hides install guidance after the browser reports successful installation", async () => {
    render(<PwaInstallPrompt />);

    fireEvent(window, new Event("appinstalled"));

    await waitFor(() => expect(screen.queryByText(/how to install/i)).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /install app/i })).not.toBeInTheDocument();
  });
});
