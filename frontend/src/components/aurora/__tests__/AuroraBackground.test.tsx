import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AuroraBackground } from "../AuroraBackground";

describe("AuroraBackground", () => {
  it("renders 4 orb elements", () => {
    const { container } = render(<AuroraBackground />);
    const orbs = container.querySelectorAll('[data-aurora-orb]');
    expect(orbs.length).toBe(4);
  });

  it("is fixed positioned covering the viewport", () => {
    const { container } = render(<AuroraBackground />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/fixed/);
    expect(root.className).toMatch(/inset-0/);
  });
});
