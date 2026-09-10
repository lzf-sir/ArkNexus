import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CollapsibleSidebar } from "../CollapsibleSidebar";

const NAV = [
  { key: "/", label: "Home", icon: <span data-testid="icon-home">🏠</span> },
  { key: "/email", label: "Email", icon: <span data-testid="icon-email">📧</span> },
];

describe("CollapsibleSidebar", () => {
  it("renders collapsed (64px) by default", () => {
    render(
      <MemoryRouter><CollapsibleSidebar items={NAV} /></MemoryRouter>
    );
    const el = screen.getByRole("navigation");
    expect(el).toHaveStyle({ width: "64px" });
  });

  it("expands to 240px on hover", () => {
    render(
      <MemoryRouter><CollapsibleSidebar items={NAV} /></MemoryRouter>
    );
    fireEvent.mouseEnter(screen.getByRole("navigation"));
    expect(screen.getByRole("navigation")).toHaveStyle({ width: "240px" });
  });

  it("calls onNavigate when item is clicked", () => {
    const onNav = vi.fn();
    render(
      <MemoryRouter><CollapsibleSidebar items={NAV} onNavigate={onNav} /></MemoryRouter>
    );
    fireEvent.click(screen.getByText("Email"));
    expect(onNav).toHaveBeenCalledWith("/email");
  });
});
