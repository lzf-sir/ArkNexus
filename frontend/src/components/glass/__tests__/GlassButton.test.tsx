import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GlassButton } from "../GlassButton";

describe("GlassButton", () => {
  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<GlassButton onClick={onClick}>Click</GlassButton>);
    fireEvent.click(screen.getByText("Click"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is true", () => {
    const onClick = vi.fn();
    render(<GlassButton disabled onClick={onClick}>Click</GlassButton>);
    fireEvent.click(screen.getByText("Click"));
    expect(onClick).not.toHaveBeenCalled();
  });
});