import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../ThemeProvider";

function Consumer() {
  const { mode, resolved, setMode } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setMode("dark")}>dark</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to system mode", () => {
    render(<ThemeProvider><Consumer /></ThemeProvider>);
    expect(screen.getByTestId("mode").textContent).toBe("system");
  });

  it("setMode updates data-theme attribute on <html>", () => {
    render(<ThemeProvider><Consumer /></ThemeProvider>);
    act(() => { screen.getByText("dark").click(); });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("persists mode to localStorage", () => {
    render(<ThemeProvider><Consumer /></ThemeProvider>);
    act(() => { screen.getByText("dark").click(); });
    expect(localStorage.getItem("arknexus-theme-mode")).toBe("dark");
  });
});