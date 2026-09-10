# ArkNexus 前端液态玻璃重构 — 设计规格

**日期**: 2026-09-10
**状态**: 已批准
**作者**: Claude (brainstorming 会话)
**影响范围**: frontend/ 全部 7 个 App + 通用组件 + 布局

---

## 1. 背景与目标

ArkNexus 已在 2025-09 完成了第一轮 Apple 风格重设计（毛玻璃 + 圆角 + 渐变）。本轮重构在保留功能不变的前提下，进一步提升：

- **美观高大上**：极光渐变 + 多层玻璃叠加 + 柔和光晕
- **动效炫酷**：细腻实用型（350ms 缓动，stagger 入场，涟漪反馈）
- **交互简单**：命令面板驱动（⌘K），可折叠图标侧边栏，键盘可达
- **布局合理**：图标侧栏节省屏幕，三栏 Email 复杂页保持但玻璃化

---

## 2. 设计决策摘要

| 决策 | 选择 |
|---|---|
| 设计方向 | 液态玻璃（Vision Pro / iOS 26 风格） |
| 主题模式 | Light + Dark 双模式（系统跟随 + 手动切换） |
| 动效强度 | 细腻实用型（页面 400ms / 卡片 350ms / 悬停 200ms） |
| 重构范围 | 全部 7 个 App |
| 主布局 | 可折叠图标侧边栏（悬停展开 64→240px） |
| UI 框架 | 保留 Ant Design 5，只重制 Layout/Card/Button |

---

## 3. 文件结构

```
frontend/src/
├── theme/
│   ├── tokens.ts          ← 新增：双模式设计 token
│   ├── ThemeProvider.tsx  ← 新增：light/dark 切换 + 持久化
│   └── antdTheme.ts       ← 改造：消费 tokens 生成 antd theme
├── components/
│   ├── glass/             ← 新增
│   │   ├── GlassCard.tsx
│   │   ├── GlassPanel.tsx
│   │   └── GlassButton.tsx
│   ├── motion/            ← 新增
│   │   ├── PageTransition.tsx
│   │   ├── FadeIn.tsx
│   │   └── motionPresets.ts
│   └── aurora/            ← 新增
│       └── AuroraBackground.tsx
├── layouts/
│   ├── MainLayout.tsx     ← 改造：图标可折叠侧边栏
│   ├── CollapsibleSidebar.tsx   ← 新增
│   └── TopBar.tsx         ← 改造：玻璃化
├── apps/                  ← 全部 7 个 App 改造
│   ├── auth/LoginPage.tsx
│   ├── init/InitPage.tsx
│   ├── dashboard/DashboardPage.tsx
│   ├── email/EmailInboxPage.tsx
│   ├── ai/AIChatPage.tsx
│   ├── settings/SettingsPage.tsx
│   └── profile/ProfilePage.tsx
└── index.css              ← 改造：增加玻璃工具类
```

---

## 4. 设计 Token 系统

集中于 `frontend/src/theme/tokens.ts`：

```
颜色（双模式）
├─ light: primary #007AFF, accent #5856D6, success #34C759, surface rgba(255,255,255,0.55)
└─ dark:  primary #0A84FF, accent #BF5AF2, success #30D158, surface rgba(28,28,30,0.55)

圆角：sm 8 / md 12 / lg 18 / xl 24 / full 999

间距：4 / 8 / 12 / 16 / 20 / 24 / 32 / 48

阴影：glass-sm / glass-md / glass-lg / glow-primary / glow-accent

动效曲线：easeLiquid = cubic-bezier(0.25, 0.1, 0.25, 1)
动效时长：fast 150 / base 250 / slow 400 / page 500
```

### 配色完整规则

| 角色 | Light | Dark | 用途 |
|---|---|---|---|
| Primary | `#007AFF` | `#0A84FF` | 主按钮、链接、聚焦态 |
| Accent | `#5856D6` | `#BF5AF2` | 渐变终点、Logo |
| Success | `#34C759` | `#30D158` | 成功、在线状态 |
| Warning | `#FF9500` | `#FF9F0A` | 警告 |
| Danger | `#FF3B30` | `#FF453A` | 删除、错误 |
| Surface | `rgba(255,255,255,0.55)` | `rgba(28,28,30,0.55)` | 玻璃卡片底色 |

字体：保留现有 SF Pro 字体栈（已生效），标题字重 700，正文 400-500。

---

## 5. 视觉系统

### 5.1 AuroraBackground（极光背景）

全局背景层，由 3-4 个模糊渐变球体缓慢漂移组成：

```tsx
<AuroraBackground>
  {/* 内部：position: fixed，z-index: -1 */}
  {/* 3-4 个 absolute 定位的 div：
      • 蓝 (#0096FF)  opacity 0.18-0.25
      • 紫 (#9650FF)  opacity 0.15-0.20
      • 粉 (#FF64C8)  opacity 0.15-0.20
      • 青 (#00E6A8)  opacity 0.10-0.15
      • filter: blur(80-120px)
      • 10-15s ease-in-out infinite alternate 动画漂移
   */}
</AuroraBackground>
```

- **启用范围**：LoginPage、DashboardPage、EmailInboxPage、AIChatPage
- **不启用**：InitPage（向导）、SettingsPage、ProfilePage（用静态渐变即可）

### 5.2 玻璃叠加层（CSS 工具类）

```css
/* 三层玻璃系统 */
.glass {
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(30px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.7);
  box-shadow: 0 4px 24px rgba(31,38,135,0.08);
}

.glass-elevated {  /* 弹窗、Modal */
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(40px) saturate(200%);
  box-shadow: 0 20px 60px rgba(31,38,135,0.15);
}

.glass-tinted {  /* 强调色玻璃，用于选中态 */
  background: rgba(0,122,255,0.12);
  backdrop-filter: blur(30px) saturate(180%);
  border: 1px solid rgba(0,122,255,0.3);
}

/* dark mode */
[data-theme="dark"] .glass {
  background: rgba(28,28,30,0.55);
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 4px 24px rgba(0,0,0,0.3);
}
```

### 5.3 玻璃组件封装

```tsx
<GlassCard hover>          // hover 时上浮 4px + 阴影加深
<GlassPanel variant="elevated">  // 用于 Modal / Drawer
<GlassButton variant="primary|ghost|tinted">  // 替代 antd Button
```

---

## 6. 动效系统

### 6.1 动效预设（motionPresets.ts）

```ts
export const motion = {
  // 进入
  fadeIn:     { from: { opacity: 0 }, to: { opacity: 1 }, duration: 250 },
  slideUp:    { from: { opacity: 0, y: 20 }, to: { opacity: 1, y: 0 }, duration: 350 },
  scaleIn:    { from: { opacity: 0, scale: 0.96 }, to: { opacity: 1, scale: 1 }, duration: 250 },

  // 交互反馈
  hoverLift:  { scale: 1.02, y: -4, duration: 200 },
  pressSink:  { scale: 0.96, duration: 120 },
  ripple:     { duration: 600, ease: 'easeOut' },

  // 页面切换
  pageEnter:  { from: { opacity: 0, y: 12 }, to: { opacity: 1, y: 0 }, duration: 400 },
  pageExit:   { from: { opacity: 1 }, to: { opacity: 0 }, duration: 200 },

  // 背景
  auroraDrift: { duration: 12000, repeat: Infinity, ease: 'easeInOut' },
}
```

### 6.2 应用层级

| 场景 | 动效 | 实现 |
|---|---|---|
| 路由切换 | 渐显 + 12px 上滑 400ms | `<PageTransition>` 包裹 `Outlet` |
| 卡片入场 | stagger 渐入（每张延迟 60ms） | framer-motion variants |
| 卡片悬停 | 上浮 4px + 阴影加深 200ms | whileHover |
| 按钮点击 | 涟漪 + 0.96 缩放 120ms | antd Button + 自定义 ripple |
| Modal/Drawer | 缩放渐入 250ms（已有） | antd 默认 + 主题覆盖 |
| AI 消息气泡 | 从下方 20px 滑入 + 渐显 | framer-motion AnimatePresence |
| 通知 Toast | 从顶部滑入 + 自动消失 | antd notification + glass-tinted |
| 极光背景 | 12s 缓慢漂移 | CSS @keyframes |
| 主题切换 | 350ms 全局颜色过渡 | CSS transition on `:root` |
| 加载骨架 | 渐变扫描 1.5s 循环 | antd Skeleton + 自定义 |

### 6.3 减弱动效支持

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 6.4 性能策略

- 极光背景用 CSS transform（GPU 加速），不用 left/top
- 路由切换用 framer-motion 的 `LazyMotion` 减少包体积
- 长列表用 `react-virtual`（如果邮件列表超过 200 项）

---

## 7. 核心组件

### 7.1 CollapsibleSidebar

```
默认状态：宽 64px，仅图标
悬停状态：宽 240px，图标 + 文字 + 渐显（250ms）
展开收起：背景遮罩，外部点击自动折叠（仅 mobile）

导航项：
  • Dashboard (LayoutDashboard)
  • Email       (Mail)
  • AI Chat     (Sparkles)
  • Settings    (Settings)
  • Profile     (User)
```

激活态：glass-tinted + 主色左边 3px 渐变指示条（缩入动画 200ms）。

### 7.2 TopBar

```
┌─────────────────────────────────────────────────────────────┐
│  [面包屑]              [⌘K 搜索框]      [通知] [主题] [头像]│
└─────────────────────────────────────────────────────────────┘
```

- 整体用 `.glass`，圆角 14px，距顶 12px，左右 16px
- 搜索框是 `<CommandPalette>` 触发器
- 主题切换按钮：太阳/月亮图标，切换时 350ms 颜色过渡

### 7.3 CommandPalette（⌘K 命令面板）

antd Modal + glass-elevated + framer-motion 缩放渐入：

- 全局模糊背景（backdrop-filter: blur(20px)）
- 居中卡片，宽 640px，高 400px
- 实时模糊搜索：页面、邮箱、AI 会话、设置项
- 上下方向键导航，Enter 跳转
- ESC 关闭

### 7.4 PageTransition

包裹 `<Outlet>`，监听 `location.pathname` 变化：

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.4 }}
  >
    <Outlet />
  </motion.div>
</AnimatePresence>
```

### 7.5 AuroraBackground

如第 5.1 节所述，作为布局背景层挂载，4 个 App 使用。

---

## 8. 7 个 App 页面设计

### 8.1 LoginPage（首屏印象）
- 极光背景 + 居中玻璃卡片（宽 400px）
- Logo 渐变方块 + 标题 "欢迎回到 ArkNexus"
- OAuth 按钮：GitHub（黑底）/ Google（白底）→ 改为 GlassButton + Provider 图标
- 邮箱密码登录：3 个 Input + 登录按钮
- 加载时按钮内显示 spinner
- 入场：卡片从下方 20px 滑入 + 渐显 400ms

### 8.2 InitPage（首次访问向导）
- 顶部进度条（4 步，激活步用渐变色填充）
- 当前步骤卡片从右侧滑入（stagger 50ms）
- 每步：图标（lucide）+ 标题 + 表单 + 下一步按钮
- 完成步骤：✅ 渐入 + 轻量化成功音效（可选）
- 完成后整页渐隐 → 跳 /login

### 8.3 DashboardPage（主页）
- 4 个统计卡（毛玻璃 + 数字 + 趋势箭头 + sparkline）
- "最近活动" 时间线（邮件、AI、设置变更）
- "快捷入口" 4 个圆形玻璃按钮
- "服务状态" 卡片（4 个微服务心跳指示灯，绿/黄/红）
- 卡片入场 stagger 60ms

### 8.4 EmailInboxPage（三栏复杂页）
```
┌─────────────────────────────────────────────────────────┐
│ Sidebar │ Folders  │ MessageList │ MessageView         │
│ 64px    │ 240px    │ 360px       │ flex                 │
└─────────────────────────────────────────────────────────┘
```
- 三栏分隔线改为 1px 透明 + 微弱阴影
- Folders：树形文件夹 + 标签（玻璃化树节点）
- MessageList：每条 = 头像圆 + 发件人 + 主题 + 摘要 + 时间，未读蓝点
- MessageView：发件人头 + 主题 + HTML body + 附件卡片
- 切换邮件时右侧 200ms 交叉淡入

### 8.5 AIChatPage（对话页）
- 左侧会话列表（260px），右侧对话区
- 用户消息：右侧，玻璃 tinted（蓝紫渐变）+ 头像
- AI 消息：左侧，白色玻璃 + 流式输出（字符逐个出现）
- 输入框：底部固定，玻璃叠加 + 发送按钮
- 切换会话：fade transition 250ms
- 加载：AI 消息气泡内三个跳动小点（dot wave）

### 8.6 SettingsPage（系统设置）
- 左侧分类导航（图标 + 文字）
- 右侧设置表单（服务配置、密钥、主题）
- 保存按钮：右下角浮动玻璃按钮（sticky）
- 修改项：实时显示 "已修改" 标记（橙色小点）

### 8.7 ProfilePage（个人资料）
- 顶部：渐变头像大圆 + 用户名 + 角色徽章
- 中部：tab 切换（基本信息 / 安全 / OAuth 关联）
- 信息卡片：描述列表风格
- 安全：修改密码 / 启用 2FA / 登出所有设备

---

## 9. 错误处理与质量保证

### 9.1 错误处理

| 场景 | 处理 |
|---|---|
| 网络错误 | Glass-tinted 红色 Toast："连接失败，请重试" |
| 401 Token 过期 | 自动刷新 → 失败则跳登录页（带 toast） |
| 表单验证 | Input 下方红色文字 + Input 边框变红 + 轻抖动 200ms |
| 加载失败 | 空状态插画 + "重试" 按钮（玻璃） |
| 404 | 极光背景 + 玻璃卡片 "页面不存在" + 返回按钮 |
| 服务降级 | Dashboard 服务状态卡片自动标红 + 弹通知 |

### 9.2 性能目标
- 首屏 LCP < 2.0s（dev 环境）
- 路由切换 < 400ms
- 滚动 60fps（虚拟列表兜底）
- 极光背景 GPU 加速，CPU 占用 < 5%

### 9.3 可访问性
- 所有交互元素键盘可达
- focus 环：2px 主色半透明外发光
- 颜色对比度 AA 级
- `prefers-reduced-motion` 减弱动效
- aria-label 完整

### 9.4 测试策略
- **视觉回归**：用 Playwright 截图 4 个关键页面（Login / Dashboard / Email / Chat），锁定基线
- **单元测试**：玻璃组件、动效预设、主题切换（vitest）
- **交互测试**：命令面板、主题切换、侧边栏展开（Playwright）
- **构建验证**：`tsc -b` 通过 + `vite build` 无 warning

---

## 10. 迁移路径

按以下顺序渐进，每个 App 完成后单独 commit：

1. **基础设施**：tokens + ThemeProvider + AuroraBackground + PageTransition
2. **通用组件**：GlassCard / GlassButton / GlassPanel
3. **布局**：MainLayout + CollapsibleSidebar + TopBar + CommandPalette
4. **页面**（按顺序）：Login → Init → Dashboard → Email → Chat → Settings → Profile
5. **验证**：每完成 1 个 App 跑构建 + Playwright 截图

便于回滚，每个 commit 独立可发布。

---

## 11. 风险与限制

- **antd 样式优先级**：部分 antd 组件默认阴影/边框可能穿透玻璃效果，需要 ConfigProvider 反复调试
- **backdrop-filter 兼容性**：Safari 全支持，Chrome 76+，Firefox 103+（生产可接受）
- **性能**：极光背景在低端机可能掉帧，已用 CSS transform 优化；如仍不达标可降级为静态渐变
- **包体积**：新增 framer-motion + lucide-react 已在依赖中，无新依赖

---

## 12. 成功标准

- ✅ 7 个 App 全部玻璃化
- ✅ 双主题切换流畅（无闪烁）
- ✅ 路由切换 < 400ms
- ✅ 首屏 LCP < 2.0s
- ✅ Playwright 截图基线锁定
- ✅ TypeScript 严格模式无错误
- ✅ 构建无 warning
- ✅ 减弱动效、键盘可达、AA 对比度全过
