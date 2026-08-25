# ArkNexus 前端 Apple 风格重设计 — 概览

## 完成内容

对 ArkNexus 前端进行了全面的 Apple 设计风格重设计，所有现有功能保持不变，仅对视觉呈现、页面布局和交互细节进行了重新设计。

### 新增依赖（前端 UI 组件框架）

| 包 | 用途 |
|---|---|
| `tailwindcss@3.4.17` | 工具类 CSS 框架，精确控制 Apple 风格细节 |
| `framer-motion` | Apple 风格流畅动画过渡 |
| `lucide-react` | 精致、统一的图标系统（替代 @ant-design/icons） |

### 设计系统

- **`src/theme/appleTheme.ts`** — Ant Design 5 深度定制的 Apple 风格主题 token 配置
  - Apple 蓝色主色 (#0071e3)
  - SF Pro 字体栈 + 精细字号层级
  - 大圆角 (borderRadius 10-16-20)
  - 柔和阴影系统
  - 各组件单独定制 (Menu、Card、Button、Input、Modal、Drawer 等)

- **`src/index.css`** — 全局样式系统
  - Tailwind 基础层
  - CSS 变量定义 (--apple-blue, --apple-gray 等)
  - 毛玻璃效果类 (.glass, .glass-sidebar, .glass-header)
  - 动画关键帧 (fade-in, scale-in, slide-in)
  - Apple 风格滚动条
  - Ant Design 全局覆盖样式

### 重设计页面清单

1. **MainLayout** — 毛玻璃侧边栏 + 顶栏，渐变品牌 Logo，lucide 图标导航
2. **LoginPage** — 毛玻璃卡片，渐变背景装饰球，圆角表单
3. **InitPage** — Apple 风格步骤向导，毛玻璃容器，lucide 步骤图标
4. **DashboardPage** — 圆角统计卡片，渐变头像，精致时间线
5. **EmailInboxPage** — 三栏布局，圆角卡片，毛玻璃边框
6. **MailboxSidebar** — 圆角列表项，渐变头像圆，未读徽章
7. **FoldersPanel** — 系统文件夹/自定义文件夹/标签分区
8. **MessageList** — 渐变头像圆，未读蓝点，精致间距
9. **MessageView** — 分层信息卡片，附件下载卡片
10. **TopBar** — 圆角信息条，胶囊按钮
11. **DraftDrawer** — 圆角表单，胶囊保存按钮
12. **AIChatPage** — 对话列表 + 消息气泡（渐变头像 + iMessage 风格气泡）
13. **SettingsPage** — 服务卡片（渐变图标），配置表格
14. **ProfilePage** — 渐变头像卡，描述列表，安全设置

### 设计特征

- **简洁布局**：大面积留白，清晰层级
- **毛玻璃效果**：侧边栏、顶栏、登录卡片使用 backdrop-filter
- **圆角卡片**：统一 16px 大圆角，按钮 980px 胶囊形
- **细腻字体层级**：SF Pro 字体栈，-0.02em letter-spacing
- **柔和动画**：cubic-bezier(0.25, 0.1, 0.25, 1) 缓动曲线
- **精致图标**：lucide-react 1.8 线宽统一图标
- **渐变装饰**：品牌 Logo、头像、状态图标使用线性渐变

### 构建状态

- TypeScript 类型检查：✅ 通过
- Vite 生产构建：✅ 通过 (4947 模块，19.91s)
