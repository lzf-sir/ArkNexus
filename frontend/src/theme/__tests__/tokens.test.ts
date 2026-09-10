import { describe, it, expect } from "vitest";
import { tokens, getTokens } from "../tokens";

describe("design tokens", () => {
  it("exports light and dark token sets", () => {
    expect(tokens.light).toBeDefined();
    expect(tokens.dark).toBeDefined();
    expect(tokens.light.color.primary).toBe("#007AFF");
    expect(tokens.dark.color.primary).toBe("#0A84FF");
  });

  it("getTokens returns the correct set by mode", () => {
    expect(getTokens("light").color.primary).toBe("#007AFF");
    expect(getTokens("dark").color.primary).toBe("#0A84FF");
  });

  it("exposes motion durations and easings", () => {
    expect(tokens.motion.duration.page).toBe(500);
    expect(tokens.motion.easing.liquid).toBe("cubic-bezier(0.25, 0.1, 0.25, 1)");
  });
});
