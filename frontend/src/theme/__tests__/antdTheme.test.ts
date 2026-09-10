import { describe, it, expect } from "vitest";
import { buildAntdTheme } from "../antdTheme";

describe("buildAntdTheme", () => {
  it("produces an antd theme with primary color from tokens", () => {
    const theme = buildAntdTheme("light");
    expect(theme.token?.colorPrimary).toBe("#007AFF");
  });

  it("produces dark variant with dark primary", () => {
    const theme = buildAntdTheme("dark");
    expect(theme.token?.colorPrimary).toBe("#0A84FF");
  });

  it("applies large border radius from tokens", () => {
    const theme = buildAntdTheme("light");
    expect(theme.token?.borderRadius).toBe(10);
  });
});