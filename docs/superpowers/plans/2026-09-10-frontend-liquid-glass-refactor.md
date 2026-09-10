# ArkNexus 前端液态玻璃重构 — 实施计划 1：基础设施 + 布局

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 建立液态玻璃设计系统的基础设施（design tokens、主题、极光背景、动效预设、玻璃组件库），并重构主布局为可折叠图标侧边栏 + 玻璃顶栏 + ⌘K 命令面板。让所有 7 个 App 都能立即使用新骨架。

**架构：** 保留 Ant Design 5 作为组件基础；新增 `theme/tokens.ts` 集中设计变量；通过 `ThemeProvider` 管理 light/dark 双模式（data-theme 属性挂在 `<html>`）；CSS 工具类实现三层玻璃叠加；framer-motion 提供动效；新 `CollapsibleSidebar` 替换现有 `MainLayout` 中的 `Sider`。

**技术栈：** React 18 + TypeScript + Vite + Ant Design 5 + Tailwind 3 + framer-motion 13 + lucide-react

---

## 现有代码上下文

实施前需熟悉的文件：

- `frontend/src/theme/ThemeContext.tsx` — **已存在**，支持 light/dark/system 三模式，需要扩展
- `frontend/src/theme/appleTheme.ts` — **已存在**，Ant Design ConfigProvider 主题配置，需重写
- `frontend/src/layouts/MainLayout.tsx` — **已存在**，包含 Sider + Header + Content + CommandPalette
- `frontend/src/components/CommandPalette.tsx` — **已存在**，⌘K 命令面板，需改造为玻璃样式
- `frontend/src/index.css` — **已存在**，包含 `.glass-sidebar` / `.glass-header` 等 Apple 风格工具类，需扩展
- `frontend/src/main.tsx` — **已存在**，应用入口，需包裹 ThemeProvider
- `frontend/src/App.tsx` — **已存在**，仅 `export default function App() { return <RouterProvider ... /> }`

---

## 文件结构（变更）

**新增：**

- `frontend/src/theme/tokens.ts` — 双模式设计 token
- `frontend/src/theme/ThemeProvider.tsx` — 替换 ThemeContext：data-theme + localStorage + antd 同步
- `frontend/src/theme/antdTheme.ts` — 替换 appleTheme.ts，消费 tokens
- `frontend/src/components/motion/motionPresets.ts` — 动效预设
- `frontend/src/components/motion/PageTransition.tsx` — 路由切换动效
- `frontend/src/components/motion/FadeIn.tsx` — 通用渐入容器
- `frontend/src/components/aurora/AuroraBackground.tsx` — 极光背景层
- `frontend/src/components/glass/GlassCard.tsx` — 玻璃卡片
- `frontend/src/components/glass/GlassPanel.tsx` — 玻璃面板（Modal/Drawer 用）
- `frontend/src/components/glass/GlassButton.tsx` — 玻璃按钮
- `frontend/src/layouts/CollapsibleSidebar.tsx` — 可折叠图标侧边栏

**修改：**

- `frontend/src/main.tsx` — 包裹 ThemeProvider + LazyMotion
- `frontend/src/App.tsx` — 增加 AuroraBackground 挂载点
- `frontend/src/layouts/MainLayout.tsx` — 重构：使用 CollapsibleSidebar + 改造 TopBar + 包裹 PageTransition
- `frontend/src/index.css` — 增加玻璃工具类（`.glass` / `.glass-elevated` / `.glass-tinted`）+ aurora 动画 + dark mode 适配
- `frontend/src/components/CommandPalette.tsx` — 改造为 glass-elevated Modal

**删除：**

- `frontend/src/theme/appleTheme.ts` — 替换为 antdTheme.ts
- `frontend/src/theme/ThemeContext.tsx` — 替换为 ThemeProvider.tsx

---

## 任务清单

### 任务 1：设计 Tokens 模块

**文件：**
- 创建：`frontend/src/theme/tokens.ts`
- 测试：`frontend/src/theme/__tests__/tokens.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
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
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd frontend && npx vitest run src/theme/__tests__/tokens.test.ts
```

预期：FAIL，提示 `tokens` 模块不存在。

- [ ] **步骤 3：实现 tokens.ts**

```ts
// frontend/src/theme/tokens.ts
export type ThemeMode = "light" | "dark";

export interface ColorTokens {
  primary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  surface: string;
  surfaceElevated: string;
  surfaceTinted: string;
  border: string;
  text: string;
  textMuted: string;
}

export interface RadiusTokens {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

export interface SpacingTokens {
  xs: 4;
  sm: 8;
  md: 12;
  base: 16;
  lg: 20;
  xl: 24;
  "2xl": 32;
  "3xl": 48;
}

export interface MotionTokens {
  duration: { fast: 150; base: 250; slow: 400; page: 500 };
  easing: { liquid: "cubic-bezier(0.25, 0.1, 0.25, 1)" };
}

export interface DesignTokens {
  color: ColorTokens;
  radius: RadiusTokens;
  spacing: SpacingTokens;
  motion: MotionTokens;
}

const light: DesignTokens = {
  color: {
    primary: "#007AFF",
    accent: "#5856D6",
    success: "#34C759",
    warning: "#FF9500",
    danger: "#FF3B30",
    surface: "rgba(255,255,255,0.55)",
    surfaceElevated: "rgba(255,255,255,0.7)",
    surfaceTinted: "rgba(0,122,255,0.12)",
    border: "rgba(255,255,255,0.7)",
    text: "#1d1d1f",
    textMuted: "#86868b",
  },
  radius: { sm: 8, md: 12, lg: 18, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, "2xl": 32, "3xl": 48 },
  motion: {
    duration: { fast: 150, base: 250, slow: 400, page: 500 },
    easing: { liquid: "cubic-bezier(0.25, 0.1, 0.25, 1)" },
  },
};

const dark: DesignTokens = {
  ...light,
  color: {
    primary: "#0A84FF",
    accent: "#BF5AF2",
    success: "#30D158",
    warning: "#FF9F0A",
    danger: "#FF453A",
    surface: "rgba(28,28,30,0.55)",
    surfaceElevated: "rgba(28,28,30,0.7)",
    surfaceTinted: "rgba(10,132,255,0.18)",
    border: "rgba(255,255,255,0.1)",
    text: "#f5f5f7",
    textMuted: "#98989d",
  },
};

export const tokens: Record<ThemeMode, DesignTokens> = { light, dark };
export const getTokens = (mode: ThemeMode): DesignTokens => tokens[mode];
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd frontend && npx vitest run src/theme/__tests__/tokens.test.ts
```

预期：3 个测试全部 PASS。

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/theme/tokens.ts frontend/src/theme/__tests__/tokens.test.ts
git commit -m "feat(theme): add design tokens module with light/dark variants"
```

---

### 任务 2：ThemeProvider（替换 ThemeContext）

**文件：**
- 创建：`frontend/src/theme/ThemeProvider.tsx`
- 删除：`frontend/src/theme/ThemeContext.tsx`
- 修改：`frontend/src/main.tsx`
- 测试：`frontend/src/theme/__tests__/ThemeProvider.test.tsx`

- [ ] **步骤 1：编写失败的测试**

```tsx
// frontend/src/theme/__tests__/ThemeProvider.test.tsx
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
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd frontend && npx vitest run src/theme/__tests__/ThemeProvider.test.tsx
```

预期：FAIL，ThemeProvider 模块不存在。

- [ ] **步骤 3：实现 ThemeProvider.tsx**

```tsx
// frontend/src/theme/ThemeProvider.tsx
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { ThemeMode } from "./tokens";

type Mode = ThemeMode | "system";
type Resolved = "light" | "dark";

interface ThemeCtx {
  mode: Mode;
  resolved: Resolved;
  setMode: (m: Mode) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = "arknexus-theme-mode";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as Mode) || "system";
  });
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: Resolved = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  const setMode = (m: Mode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_KEY, m);
  };

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used within ThemeProvider");
  return v;
}
```

- [ ] **步骤 4：更新 main.tsx 包裹 ThemeProvider**

```tsx
// frontend/src/main.tsx — 修改 imports + root render
import { ThemeProvider } from "./theme/ThemeProvider";
// ... 现有 imports 保留

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
```

- [ ] **步骤 5：删除旧的 ThemeContext.tsx**

```bash
git rm frontend/src/theme/ThemeContext.tsx
```

- [ ] **步骤 6：找到所有引用 ThemeContext 的文件并迁移**

```bash
cd frontend && npx rg "from.*theme/ThemeContext" --files-with-matches
```

预期输出：可能包含 `layouts/MainLayout.tsx` 等。**手动将每个 `useTheme, ThemeMode` 引用改为从 `../theme/ThemeProvider` 导入。** `Mode` 类型现在是 `"light" | "dark" | "system"`，旧的 `ThemeMode` 类型删除。

- [ ] **步骤 7：运行测试验证通过**

```bash
cd frontend && npx vitest run src/theme/__tests__/ThemeProvider.test.tsx
```

预期：3 个测试全部 PASS。

- [ ] **步骤 8：运行类型检查**

```bash
cd frontend && npx tsc -b --noEmit
```

预期：0 错误。

- [ ] **步骤 9：Commit**

```bash
git add frontend/src/theme/ThemeProvider.tsx frontend/src/theme/__tests__/ThemeProvider.test.tsx frontend/src/main.tsx
git commit -m "feat(theme): add ThemeProvider with data-theme attribute + localStorage"
```

---

### 任务 3：Ant Design 主题集成

**文件：**
- 创建：`frontend/src/theme/antdTheme.ts`
- 删除：`frontend/src/theme/appleTheme.ts`
- 修改：`frontend/src/main.tsx`（包裹 antd ConfigProvider）
- 测试：与 antd 集成通过快照测试

- [ ] **步骤 1：编写失败的测试**

```tsx
// frontend/src/theme/__tests__/antdTheme.test.ts
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
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd frontend && npx vitest run src/theme/__tests__/antdTheme.test.ts
```

预期：FAIL。

- [ ] **步骤 3：实现 antdTheme.ts**

```ts
// frontend/src/theme/antdTheme.ts
import { theme, type ThemeConfig } from "antd";
import { getTokens, type ThemeMode } from "./tokens";

export function buildAntdTheme(mode: ThemeMode): ThemeConfig {
  const t = getTokens(mode);
  return {
    algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: t.color.primary,
      colorSuccess: t.color.success,
      colorWarning: t.color.warning,
      colorError: t.color.danger,
      colorInfo: t.color.primary,
      borderRadius: t.radius.md,
      borderRadiusLG: t.radius.lg,
      borderRadiusSM: t.radius.sm,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif',
      motionDurationFast: `${t.motion.duration.fast}ms`,
      motionDurationMid: `${t.motion.duration.base}ms`,
      motionDurationSlow: `${t.motion.duration.slow}ms`,
    },
    components: {
      Button: { borderRadius: t.radius.full, controlHeight: 36 },
      Card: { borderRadiusLG: t.radius.lg, paddingLG: t.spacing.lg },
      Modal: { borderRadiusLG: t.radius.lg },
      Drawer: { paddingLG: t.spacing.lg },
      Input: { borderRadius: t.radius.md, controlHeight: 38 },
      Menu: { itemBorderRadius: t.radius.md, itemHeight: 40 },
      Tag: { borderRadiusSM: t.radius.full },
    },
  };
}
```

- [ ] **步骤 4：在 main.tsx 包裹 ConfigProvider**

```tsx
// frontend/src/main.tsx（继续上一步的修改）
import { ConfigProvider, App as AntApp } from "antd";
import { buildAntdTheme } from "./theme/antdTheme";

function ThemedApp() {
  // 读取当前 data-theme，作为 state 触发 re-render
  const [mode, setMode] = useState<"light" | "dark">(() =>
    document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setMode(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <ConfigProvider theme={buildAntdTheme(mode)}>
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  </React.StrictMode>
);
```

- [ ] **步骤 5：删除 appleTheme.ts**

```bash
git rm frontend/src/theme/appleTheme.ts
```

- [ ] **步骤 6：运行测试验证通过**

```bash
cd frontend && npx vitest run src/theme/__tests__/antdTheme.test.ts
```

预期：3 个测试 PASS。

- [ ] **步骤 7：运行类型检查 + 构建**

```bash
cd frontend && npx tsc -b && npx vite build
```

预期：tsc 0 错误，vite build 成功。

- [ ] **步骤 8：Commit**

```bash
git add frontend/src/theme/antdTheme.ts frontend/src/main.tsx frontend/src/theme/__tests__/antdTheme.test.ts
git commit -m "feat(theme): build antd theme from tokens + ConfigProvider integration"
```

---

### 任务 4：玻璃 CSS 工具类

**文件：**
- 修改：`frontend/src/index.css`（在 `@layer utilities` 块内追加）

- [ ] **步骤 1：在 index.css 末尾追加玻璃工具类**

打开 `frontend/src/index.css`，找到文件末尾的 Tailwind directives 之前，追加：

```css
@layer utilities {
  /* 三层玻璃叠加 */
  .glass {
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(30px) saturate(180%);
    -webkit-backdrop-filter: blur(30px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.7);
    box-shadow: 0 4px 24px rgba(31, 38, 135, 0.08);
  }

  .glass-elevated {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(40px) saturate(200%);
    -webkit-backdrop-filter: blur(40px) saturate(200%);
    box-shadow: 0 20px 60px rgba(31, 38, 135, 0.15);
  }

  .glass-tinted {
    background: rgba(0, 122, 255, 0.12);
    backdrop-filter: blur(30px) saturate(180%);
    -webkit-backdrop-filter: blur(30px) saturate(180%);
    border: 1px solid rgba(0, 122, 255, 0.3);
  }

  /* Dark mode */
  [data-theme="dark"] .glass {
    background: rgba(28, 28, 30, 0.55);
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  }

  [data-theme="dark"] .glass-elevated {
    background: rgba(28, 28, 30, 0.7);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  [data-theme="dark"] .glass-tinted {
    background: rgba(10, 132, 255, 0.18);
    border-color: rgba(10, 132, 255, 0.4);
  }

  /* 全局颜色过渡（主题切换） */
  :root {
    transition: background-color 350ms cubic-bezier(0.25, 0.1, 0.25, 1),
      color 350ms cubic-bezier(0.25, 0.1, 0.25, 1);
  }

  /* 减弱动效 */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

- [ ] **步骤 2：在浏览器中验证**

```bash
cd frontend && npx vite dev
```

打开 http://localhost:5173/login → 临时在某个 div 上加 `className="glass"` 验证效果（开发完成后移除）。

- [ ] **步骤 3：构建验证**

```bash
cd frontend && npx vite build
```

预期：构建成功无错误。

- [ ] **步骤 4：Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(theme): add glass utility classes + dark mode variants"
```

---

### 任务 5：极光背景组件

**文件：**
- 创建：`frontend/src/components/aurora/AuroraBackground.tsx`
- 测试：`frontend/src/components/aurora/__tests__/AuroraBackground.test.tsx`

- [ ] **步骤 1：编写失败的测试**

```tsx
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
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd frontend && npx vitest run src/components/aurora/__tests__/AuroraBackground.test.tsx
```

预期：FAIL。

- [ ] **步骤 3：实现 AuroraBackground.tsx**

```tsx
// frontend/src/components/aurora/AuroraBackground.tsx
import { useEffect, useRef } from "react";

interface Orb {
  color: string;
  size: number;
  startX: string;
  startY: string;
  driftX: number;
  driftY: number;
  duration: number;
  opacity: number;
}

const ORBS: Orb[] = [
  { color: "rgba(0,150,255,0.5)", size: 600, startX: "-10%", startY: "-10%", driftX: 80, driftY: 60, duration: 14, opacity: 0.22 },
  { color: "rgba(150,80,255,0.5)", size: 700, startX: "70%", startY: "20%", driftX: -100, driftY: 80, duration: 16, opacity: 0.18 },
  { color: "rgba(255,100,200,0.5)", size: 650, startX: "20%", startY: "70%", driftX: 120, driftY: -60, duration: 15, opacity: 0.18 },
  { color: "rgba(0,230,168,0.5)", size: 550, startX: "50%", startY: "50%", driftX: -60, driftY: -100, duration: 18, opacity: 0.12 },
];

function OrbEl({ orb }: { orb: Orb }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: `translate(${orb.driftX}px, ${orb.driftY}px)` },
        { transform: "translate(0, 0)" },
      ],
      { duration: orb.duration * 1000, iterations: Infinity, easing: "ease-in-out" }
    );
  }, [orb.driftX, orb.driftY, orb.duration]);

  return (
    <div
      ref={ref}
      data-aurora-orb
      aria-hidden
      style={{
        position: "absolute",
        left: orb.startX,
        top: orb.startY,
        width: orb.size,
        height: orb.size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
        filter: `blur(80px)`,
        opacity: orb.opacity,
        willChange: "transform",
        pointerEvents: "none",
      }}
    />
  );
}

export function AuroraBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {ORBS.map((orb, i) => (
        <OrbEl key={i} orb={orb} />
      ))}
    </div>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd frontend && npx vitest run src/components/aurora/__tests__/AuroraBackground.test.tsx
```

预期：2 个测试 PASS。

- [ ] **步骤 5：在 App.tsx 挂载 AuroraBackground**

```tsx
// frontend/src/App.tsx
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AuroraBackground } from "./components/aurora/AuroraBackground";

export default function App() {
  return (
    <>
      <AuroraBackground />
      <RouterProvider router={router} />
    </>
  );
}
```

- [ ] **步骤 6：手动验证**

```bash
cd frontend && npx vite dev
```

打开 http://localhost:5173/login，观察极光背景缓慢漂移。

- [ ] **步骤 7：Commit**

```bash
git add frontend/src/components/aurora/AuroraBackground.tsx frontend/src/components/aurora/__tests__/AuroraBackground.test.tsx frontend/src/App.tsx
git commit -m "feat(aurora): add drifting gradient background component"
```

---

### 任务 6：动效预设

**文件：**
- 创建：`frontend/src/components/motion/motionPresets.ts`

- [ ] **步骤 1：实现 motionPresets.ts**

```ts
// frontend/src/components/motion/motionPresets.ts
import type { Variants, Transition } from "framer-motion";

export const EASE_LIQUID = [0.25, 0.1, 0.25, 1] as const;

export const transitions = {
  fast: { duration: 0.15, ease: EASE_LIQUID } satisfies Transition,
  base: { duration: 0.25, ease: EASE_LIQUID } satisfies Transition,
  slow: { duration: 0.4, ease: EASE_LIQUID } satisfies Transition,
  page: { duration: 0.5, ease: EASE_LIQUID } satisfies Transition,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transitions.base },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: transitions.slow },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: transitions.base },
};

export const stagger = (delayChildren = 0, staggerChildren = 0.06): Variants => ({
  hidden: {},
  show: { transition: { delayChildren, staggerChildren } },
});

export const hoverLift = {
  scale: 1.02,
  y: -4,
  transition: { duration: 0.2, ease: EASE_LIQUID },
};

export const pressSink = {
  scale: 0.96,
  transition: { duration: 0.12, ease: EASE_LIQUID },
};
```

- [ ] **步骤 2：类型检查**

```bash
cd frontend && npx tsc -b --noEmit
```

预期：0 错误。

- [ ] **步骤 3：Commit**

```bash
git add frontend/src/components/motion/motionPresets.ts
git commit -m "feat(motion): add framer-motion preset variants and transitions"
```

---

### 任务 7：PageTransition 组件

**文件：**
- 创建：`frontend/src/components/motion/PageTransition.tsx`
- 测试：`frontend/src/components/motion/__tests__/PageTransition.test.tsx`

- [ ] **步骤 1：编写失败的测试**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { PageTransition } from "../PageTransition";

describe("PageTransition", () => {
  it("renders children inside Outlet context", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<PageTransition />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(getByText("Home")).toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd frontend && npx vitest run src/components/motion/__tests__/PageTransition.test.tsx
```

预期：FAIL。

- [ ] **步骤 3：实现 PageTransition.tsx**

```tsx
// frontend/src/components/motion/PageTransition.tsx
import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { transitions } from "./motionPresets";

export function PageTransition() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={transitions.page}
        style={{ width: "100%" }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd frontend && npx vitest run src/components/motion/__tests__/PageTransition.test.tsx
```

预期：1 个测试 PASS。

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/components/motion/PageTransition.tsx frontend/src/components/motion/__tests__/PageTransition.test.tsx
git commit -m "feat(motion): add PageTransition for route changes"
```

---

### 任务 8：FadeIn 容器

**文件：**
- 创建：`frontend/src/components/motion/FadeIn.tsx`

- [ ] **步骤 1：实现 FadeIn.tsx**

```tsx
// frontend/src/components/motion/FadeIn.tsx
import { motion, type HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import { slideUp, stagger, fadeIn } from "./motionPresets";

interface FadeInProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  variant?: "fade" | "slide";
  delay?: number;
}

export function FadeIn({ children, variant = "slide", delay = 0, ...rest }: FadeInProps) {
  const variants = variant === "fade" ? fadeIn : slideUp;
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="show"
      transition={{ delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

interface FadeInStaggerProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  staggerChildren?: number;
  delayChildren?: number;
}

export function FadeInStagger({ children, staggerChildren = 0.06, delayChildren = 0, ...rest }: FadeInStaggerProps) {
  return (
    <motion.div
      variants={stagger(delayChildren, staggerChildren)}
      initial="hidden"
      animate="show"
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export const FadeInItem = motion.div;
```

- [ ] **步骤 2：类型检查**

```bash
cd frontend && npx tsc -b --noEmit
```

预期：0 错误。

- [ ] **步骤 3：Commit**

```bash
git add frontend/src/components/motion/FadeIn.tsx
git commit -m "feat(motion): add FadeIn and FadeInStagger containers"
```

---

### 任务 9：GlassCard 组件

**文件：**
- 创建：`frontend/src/components/glass/GlassCard.tsx`
- 测试：`frontend/src/components/glass/__tests__/GlassCard.test.tsx`

- [ ] **步骤 1：编写失败的测试**

```tsx
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
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd frontend && npx vitest run src/components/glass/__tests__/GlassCard.test.tsx
```

预期：FAIL。

- [ ] **步骤 3：实现 GlassCard.tsx**

```tsx
// frontend/src/components/glass/GlassCard.tsx
import { motion, type HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import { hoverLift } from "../motion/motionPresets";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  hover?: boolean;
  padding?: number | string;
  radius?: number;
}

export function GlassCard({
  children,
  hover = false,
  padding = 20,
  radius = 18,
  className = "",
  ...rest
}: GlassCardProps) {
  return (
    <motion.div
      className={`glass ${className}`}
      style={{
        padding,
        borderRadius: radius,
        ...(rest.style || {}),
      }}
      whileHover={hover ? hoverLift : undefined}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd frontend && npx vitest run src/components/glass/__tests__/GlassCard.test.tsx
```

预期：2 个测试 PASS。

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/components/glass/GlassCard.tsx frontend/src/components/glass/__tests__/GlassCard.test.tsx
git commit -m "feat(glass): add GlassCard component with optional hover lift"
```

---

### 任务 10：GlassPanel 组件（用于 Modal/Drawer）

**文件：**
- 创建：`frontend/src/components/glass/GlassPanel.tsx`

- [ ] **步骤 1：实现 GlassPanel.tsx**

```tsx
// frontend/src/components/glass/GlassPanel.tsx
import { motion, type HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import { transitions } from "../motion/motionPresets";

interface GlassPanelProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  radius?: number;
  padding?: number | string;
  variant?: "default" | "elevated" | "tinted";
}

export function GlassPanel({
  children,
  radius = 24,
  padding = 24,
  variant = "elevated",
  className = "",
  ...rest
}: GlassPanelProps) {
  const classNames = {
    default: "glass",
    elevated: "glass-elevated",
    tinted: "glass-tinted",
  };
  return (
    <motion.div
      className={`${classNames[variant]} ${className}`}
      style={{
        padding,
        borderRadius: radius,
        ...(rest.style || {}),
      }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={transitions.base}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **步骤 2：Commit**

```bash
git add frontend/src/components/glass/GlassPanel.tsx
git commit -m "feat(glass): add GlassPanel for modals and elevated surfaces"
```

---

### 任务 11：GlassButton 组件

**文件：**
- 创建：`frontend/src/components/glass/GlassButton.tsx`
- 测试：`frontend/src/components/glass/__tests__/GlassButton.test.tsx`

- [ ] **步骤 1：编写失败的测试**

```tsx
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
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd frontend && npx vitest run src/components/glass/__tests__/GlassButton.test.tsx
```

预期：FAIL。

- [ ] **步骤 3：实现 GlassButton.tsx**

```tsx
// frontend/src/components/glass/GlassButton.tsx
import { motion, type HTMLMotionProps } from "framer-motion";
import { ReactNode, useState } from "react";
import { pressSink } from "../motion/motionPresets";

type Variant = "primary" | "ghost" | "tinted";

interface GlassButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: ReactNode;
  variant?: Variant;
  loading?: boolean;
  block?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: "glass-tinted",
  ghost: "glass",
  tinted: "glass-tinted",
};

export function GlassButton({
  children,
  variant = "ghost",
  loading = false,
  block = false,
  disabled = false,
  className = "",
  onClick,
  ...rest
}: GlassButtonProps) {
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, key: Date.now() });
    setTimeout(() => setRipple(null), 600);
    onClick?.(e);
  };

  const isDisabled = disabled || loading;

  return (
    <motion.button
      type="button"
      className={`${variantClass[variant]} ${className}`.trim()}
      whileTap={isDisabled ? undefined : pressSink}
      disabled={isDisabled}
      onClick={handleClick}
      style={{
        position: "relative",
        overflow: "hidden",
        border: "none",
        padding: "8px 18px",
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 600,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.5 : 1,
        width: block ? "100%" : "auto",
        color: variant === "primary" ? "var(--apple-blue, #007AFF)" : "inherit",
        ...(rest.style || {}),
      }}
      {...rest}
    >
      {loading ? <span>...</span> : children}
      {ripple && (
        <motion.span
          key={ripple.key}
          initial={{ scale: 0, opacity: 0.4 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: ripple.x - 50,
            top: ripple.y - 50,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.5)",
            pointerEvents: "none",
          }}
        />
      )}
    </motion.button>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd frontend && npx vitest run src/components/glass/__tests__/GlassButton.test.tsx
```

预期：2 个测试 PASS。

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/components/glass/GlassButton.tsx frontend/src/components/glass/__tests__/GlassButton.test.tsx
git commit -m "feat(glass): add GlassButton with ripple and press feedback"
```

---

### 任务 12：CollapsibleSidebar 组件

**文件：**
- 创建：`frontend/src/layouts/CollapsibleSidebar.tsx`
- 测试：`frontend/src/layouts/__tests__/CollapsibleSidebar.test.tsx`

- [ ] **步骤 1：编写失败的测试**

```tsx
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
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd frontend && npx vitest run src/layouts/__tests__/CollapsibleSidebar.test.tsx
```

预期：FAIL。

- [ ] **步骤 3：实现 CollapsibleSidebar.tsx**

```tsx
// frontend/src/layouts/CollapsibleSidebar.tsx
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { ReactNode, useState } from "react";
import { transitions } from "../components/motion/motionPresets";

export interface SidebarItem {
  key: string;
  label: string;
  icon: ReactNode;
  to: string;
}

interface Props {
  items: SidebarItem[];
  brand?: ReactNode;
  footer?: ReactNode;
  onNavigate?: (to: string) => void;
}

const COLLAPSED = 64;
const EXPANDED = 240;

export function CollapsibleSidebar({ items, brand, footer, onNavigate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();

  return (
    <motion.aside
      role="navigation"
      aria-label="主导航"
      className="glass"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      animate={{ width: expanded ? EXPANDED : COLLAPSED }}
      transition={transitions.base}
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: 12,
        gap: 8,
        overflow: "hidden",
        zIndex: 50,
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 8px",
          height: 44,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, #0096FF, #9650FF)",
            flexShrink: 0,
          }}
        />
        <motion.span
          initial={false}
          animate={{ opacity: expanded ? 1 : 0, width: expanded ? "auto" : 0 }}
          transition={transitions.fast}
          style={{
            fontWeight: 700,
            fontSize: 16,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {brand || "ArkNexus"}
        </motion.span>
      </div>

      {/* Nav items */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {items.map((item) => {
          const active = location.pathname === item.to
            || location.pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.key}
              to={item.to}
              onClick={() => onNavigate?.(item.to)}
              className={active ? "glass-tinted" : ""}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 12,
                color: "inherit",
                textDecoration: "none",
                position: "relative",
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                transition: "background 0.2s",
              }}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-indicator"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 3,
                    borderRadius: 999,
                    background: "linear-gradient(180deg, #007AFF, #9650FF)",
                  }}
                />
              )}
              <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                {item.icon}
              </span>
              <motion.span
                initial={false}
                animate={{ opacity: expanded ? 1 : 0, width: expanded ? "auto" : 0 }}
                transition={transitions.fast}
                style={{ whiteSpace: "nowrap", overflow: "hidden" }}
              >
                {item.label}
              </motion.span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {footer && (
        <div style={{ flexShrink: 0, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          {footer}
        </div>
      )}
    </motion.aside>
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd frontend && npx vitest run src/layouts/__tests__/CollapsibleSidebar.test.tsx
```

预期：3 个测试 PASS。

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/layouts/CollapsibleSidebar.tsx frontend/src/layouts/__tests__/CollapsibleSidebar.test.tsx
git commit -m "feat(layout): add hover-expand CollapsibleSidebar with glass styling"
```

---

### 任务 13：MainLayout 重构

**文件：**
- 修改：`frontend/src/layouts/MainLayout.tsx`
- 修改：`frontend/src/router.tsx`

- [ ] **步骤 1：重写 MainLayout.tsx 头部**

打开 `frontend/src/layouts/MainLayout.tsx`，将整个 import 块替换为：

```tsx
import { Layout, Avatar, Dropdown, Button, Tooltip, Drawer } from "antd";
import {
  LayoutDashboard,
  Mail,
  Bot,
  Settings as SettingsIcon,
  User,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Menu as MenuIcon,
} from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { App as AntApp } from "antd";
import { useAuth } from "../apps/auth/AuthContext";
import { useTheme } from "../theme/ThemeProvider";
import { CollapsibleSidebar, type SidebarItem } from "./CollapsibleSidebar";
import { CommandPalette } from "../components/CommandPalette";
import { PwaInstallBanner } from "../components/PwaInstallBanner";
import { NotificationCenter } from "../components/NotificationCenter";
```

- [ ] **步骤 2：替换 navItems 为新结构**

将 `navItems` 常量替换为：

```tsx
const navItems: SidebarItem[] = [
  { key: "/", label: "概览", icon: <LayoutDashboard size={18} strokeWidth={1.8} />, to: "/" },
  { key: "/ai", label: "AI 助手", icon: <Bot size={18} strokeWidth={1.8} />, to: "/ai/chat" },
  { key: "/email", label: "临时邮箱", icon: <Mail size={18} strokeWidth={1.8} />, to: "/email" },
  { key: "/settings", label: "系统设置", icon: <SettingsIcon size={18} strokeWidth={1.8} />, to: "/settings" },
];
```

- [ ] **步骤 3：替换组件返回值**

将 `return (...)` 内的整个 JSX 替换为：

```tsx
return (
  <Layout style={{ minHeight: "100vh", background: "transparent" }}>
    <CollapsibleSidebar
      items={navItems}
      brand="ArkNexus"
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 4px" }}>
          <Tooltip title="主题">
            <Dropdown
              menu={{
                items: [
                  { key: "light", icon: <Sun size={14} strokeWidth={1.8} />, label: "浅色", onClick: () => setMode("light") },
                  { key: "dark", icon: <Moon size={14} strokeWidth={1.8} />, label: "深色", onClick: () => setMode("dark") },
                  { key: "system", icon: <Monitor size={14} strokeWidth={1.8} />, label: "跟随系统", onClick: () => setMode("system") },
                ],
              }}
              trigger={["click"]}
            >
              <Button
                type="text"
                size="small"
                icon={resolved === "dark" ? <Moon size={15} strokeWidth={1.8} /> : <Sun size={15} strokeWidth={1.8} />}
                style={{ width: 32, height: 32, padding: 0, borderRadius: 8 }}
              />
            </Dropdown>
          </Tooltip>
        </div>
      }
    />

    <Layout style={{ background: "transparent" }}>
      <Header
        className="glass"
        style={{
          position: "sticky",
          top: 12,
          zIndex: 100,
          height: 56,
          margin: "12px 16px 0 16px",
          borderRadius: 14,
          paddingInline: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button
            type="text"
            size="small"
            icon={<MenuIcon size={18} strokeWidth={1.8} />}
            onClick={() => setMobileNavOpen(true)}
            className="mobile-only"
            style={{ width: 32, height: 32, padding: 0, display: "none", borderRadius: 8 }}
            aria-label="打开菜单"
          />
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>
            个人超级工作台
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {user && (
            <Dropdown
              menu={{
                items: [
                  { key: "profile", icon: <User size={14} strokeWidth={1.8} />, label: "个人资料", onClick: () => navigate("/profile") },
                  { type: "divider" },
                  { key: "logout", icon: <LogOut size={14} strokeWidth={1.8} />, label: "登出", onClick: onLogout },
                ],
              }}
              trigger={["click"]}
            >
              <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 999 }}>
                <Avatar
                  size={30}
                  style={{
                    background: "linear-gradient(135deg, #007AFF, #9650FF)",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {(user.display_name || user.email)[0]?.toUpperCase()}
                </Avatar>
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  {user.display_name || user.email}
                </span>
              </div>
            </Dropdown>
          )}
        </div>
      </Header>

      <Content style={{ padding: 24, minHeight: "calc(100vh - 80px)" }}>
        <Outlet />
      </Content>
    </Layout>

    <CommandPalette />
    <PwaInstallBanner />
    <NotificationCenter />

    <Drawer
      title="ArkNexus"
      placement="left"
      open={mobileNavOpen}
      onClose={() => setMobileNavOpen(false)}
      width={260}
    >
      {/* mobile menu items - simplified version of navItems */}
      {navItems.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          onClick={() => setMobileNavOpen(false)}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, color: "inherit" }}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </Drawer>
  </Layout>
);
```

注意：需要从 `useTheme()` 解构 `setMode` 和 `resolved`，并移除 `selectedKey`、`themeOptions`、`Link2` 等不再使用的引用；`mobileNavOpen` state 需保留。

- [ ] **步骤 4：在 router.tsx 包裹 PageTransition**

修改 `frontend/src/router.tsx`：

```tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { PageTransition } from "./components/motion/PageTransition";
import { DashboardPage } from "./apps/dashboard/DashboardPage";
import { EmailApp } from "./apps/email/EmailApp";
import { EmailInboxPage } from "./apps/email/pages/EmailInboxPage";
import { LoginPage } from "./apps/auth/pages/LoginPage";
import { OAuthCallbackPage } from "./apps/auth/pages/OAuthCallbackPage";
import { AIChatPage } from "./apps/ai/pages/AIChatPage";
import { SettingsPage } from "./apps/settings/pages/SettingsPage";
import { ProfilePage } from "./apps/profile/ProfilePage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { InitPage } from "./apps/init/InitPage";

export const router = createBrowserRouter([
  { path: "/init", element: <InitPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/auth/oauth/callback", element: <OAuthCallbackPage /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { element: <PageTransition />, children: [
        { index: true, element: <DashboardPage /> },
        {
          path: "email",
          element: <EmailApp />,
          children: [
            { index: true, element: <EmailInboxPage /> },
            { path: ":mailboxId", element: <EmailInboxPage /> },
          ],
        },
        {
          path: "ai",
          children: [
            { index: true, element: <Navigate to="chat" replace /> },
            { path: "chat", element: <AIChatPage /> },
          ],
        },
        { path: "settings", element: <SettingsPage /> },
        { path: "profile", element: <ProfilePage /> },
        { path: "*", element: <Navigate to="/" replace /> },
      ]},
    ],
  },
]);
```

- [ ] **步骤 5：类型检查**

```bash
cd frontend && npx tsc -b --noEmit
```

预期：0 错误。**如有错误，按错误信息修复 imports / 缺失变量。**

- [ ] **步骤 6：手动验证**

```bash
cd frontend && npx vite dev
```

访问 http://localhost:5173 → 登录 → 验证：
- 侧边栏图标可见
- 鼠标悬停侧边栏，展开到 240px
- 切换页面有渐入动画
- 顶栏呈玻璃叠加效果
- 主题切换按钮工作正常

- [ ] **步骤 7：Commit**

```bash
git add frontend/src/layouts/MainLayout.tsx frontend/src/router.tsx
git commit -m "refactor(layout): integrate CollapsibleSidebar + PageTransition"
```

---

### 任务 14：CommandPalette 玻璃化

**文件：**
- 修改：`frontend/src/components/CommandPalette.tsx`

- [ ] **步骤 1：读取现有实现以了解结构**

```bash
wc -l frontend/src/components/CommandPalette.tsx
```

- [ ] **步骤 2：包装 Modal 为玻璃样式**

打开 `frontend/src/components/CommandPalette.tsx`，将 Modal 的 `className` 改为 `glass-elevated`，并加入缩放渐入：

```tsx
<Modal
  open={open}
  onCancel={onClose}
  footer={null}
  closable={false}
  width={640}
  centered
  classNames={{ content: "glass-elevated", mask: "command-palette-mask" }}
  styles={{
    content: { padding: 0, borderRadius: 18, overflow: "hidden" },
    mask: { backdropFilter: "blur(20px)", background: "rgba(0,0,0,0.2)" },
  }}
  // 保留其他 props
>
```

- [ ] **步骤 3：构建验证**

```bash
cd frontend && npx vite build
```

预期：构建成功。

- [ ] **步骤 4：手动验证**

```bash
cd frontend && npx vite dev
```

登录后按 ⌘K 或 Ctrl+K，验证命令面板呈玻璃叠加效果，背景模糊。

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/components/CommandPalette.tsx
git commit -m "refactor(command): apply glass-elevated styling to CommandPalette"
```

---

### 任务 15：移除遗留 CSS 工具类

**文件：**
- 修改：`frontend/src/index.css`

- [ ] **步骤 1：搜索遗留 Apple 风格类**

```bash
cd frontend && npx rg "\.glass-sidebar|\.glass-header" frontend/src/index.css
```

预期看到现有的 `.glass-sidebar` 和 `.glass-header` 定义。

- [ ] **步骤 2：删除遗留类定义**

打开 `frontend/src/index.css`，找到并**删除**以下块（保留 `.glass` / `.glass-elevated` / `.glass-tinted` 在新位置的定义）：

- `.glass-sidebar { ... }`（如果存在）
- `.glass-header { ... }`（如果存在）

注意：只删除定义块；如果 CollapsibleSidebar 已用 `glass` 类替代，确保 `glass-sidebar` 类名不再被引用。如有引用，改为 `glass`。

- [ ] **步骤 3：构建验证**

```bash
cd frontend && npx vite build
```

预期：构建成功无 CSS 警告。

- [ ] **步骤 4：手动验证**

```bash
cd frontend && npx vite dev
```

视觉检查：侧边栏和顶栏仍正确显示玻璃叠加，无样式丢失。

- [ ] **步骤 5：Commit**

```bash
git add frontend/src/index.css
git commit -m "refactor(css): remove legacy glass-sidebar and glass-header classes"
```

---

### 任务 16：最终验证与构建

**文件：**
- 修改：所有先前任务产生的文件（如有）

- [ ] **步骤 1：完整类型检查**

```bash
cd frontend && npx tsc -b
```

预期：0 错误。

- [ ] **步骤 2：完整测试**

```bash
cd frontend && npx vitest run
```

预期：所有测试通过。

- [ ] **步骤 3：生产构建**

```bash
cd frontend && npx vite build
```

预期：构建成功，无 warning。

- [ ] **步骤 4：手动冒烟测试**

```bash
cd frontend && npx vite dev
```

完整流程：
1. 打开 http://localhost:5173 → 自动跳 /init（如未初始化）或 /login
2. 完成登录流程
3. 进入 Dashboard
4. 悬停侧边栏，确认 64 → 240px 展开动画
5. 切换到 Email → Chat → Settings → Profile，确认页面切换渐入动画
6. 按 ⌘K，确认命令面板玻璃化外观
7. 切换主题（浅色 → 深色 → 跟随系统），确认过渡平滑
8. 浏览器开发者工具 → Performance 面板，录制页面切换，确认无明显掉帧

- [ ] **步骤 5：Commit（如有遗留修改）**

```bash
git status
# 如有修改：
git add -A && git commit -m "chore: post-implementation cleanup"
```

- [ ] **步骤 6：打 tag**

```bash
git tag -a v0.2.0-liquid-glass-foundation -m "Foundation: design tokens, theme, glass components, layout"
```

---

## 自检（计划作者执行）

**1. 规格覆盖度：**

| 规格章节 | 实现任务 |
|---|---|
| 4. 设计 Token 系统 | 任务 1 |
| 5.1 AuroraBackground | 任务 5 |
| 5.2 玻璃叠加层 | 任务 4 |
| 5.3 玻璃组件封装 | 任务 9, 10, 11 |
| 6.1 动效预设 | 任务 6 |
| 6.2 应用层级（路由切换） | 任务 7 |
| 6.2 应用层级（卡片入场） | 任务 8 |
| 6.3 减弱动效 | 任务 4 |
| 7.1 CollapsibleSidebar | 任务 12 |
| 7.2 TopBar | 任务 13（嵌入 MainLayout） |
| 7.3 CommandPalette | 任务 14 |
| 7.4 PageTransition | 任务 7 |
| 7.5 AuroraBackground | 任务 5 |
| 9.3 可访问性（减弱动效） | 任务 4 |
| 10. 迁移路径步骤 1-3 | 任务 1-15 |

**未覆盖（属计划 2-3）：**
- 7 个 App 的页面级重构（Login / Init / Dashboard / Email / Chat / Settings / Profile）
- 视觉回归测试（Playwright 截图基线）
- 错误处理 toast 重制

**2. 占位符扫描：** 无 "TODO" / "TBD" / "类似任务 N"。

**3. 类型一致性：**
- `tokens.light` / `tokens.dark` 在任务 1 定义，任务 3 消费 ✓
- `useTheme()` 从 ThemeProvider 导出，任务 2 定义，任务 13 消费 ✓
- `buildAntdTheme()` 在任务 3 定义，任务 3 自身消费 ✓
- `motion` 预设（slideUp / hoverLift / pressSink）在任务 6 定义，任务 7/8/9/10/11/12 消费 ✓
- `SidebarItem` 在任务 12 定义，任务 13 消费 ✓

无不一致。

---

## 执行选项

计划已完成并保存到 `docs/superpowers/plans/2026-09-10-frontend-liquid-glass-refactor.md`。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

选哪种方式？
