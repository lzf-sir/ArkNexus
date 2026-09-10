import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GlassCard } from "../GlassCard";

describe("GlassCard", () => {
  it("renders children with glass class", () => {
    render(<GlassCard>content</GlassCard>);
    const el = screen.getByText("content");
    expect(el.className).toMatch(/glass/);
  });

  it("applies hover variant class", () => {
    render(<GlassCard hover>content</GlassCard>);
    const el = screen.getByText("content");
    expect(el.className).toMatch(/hover/);
  });
});
