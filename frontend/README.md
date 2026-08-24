# ArkNexus Frontend

React + Ant Design 5 single-page app for the ArkNexus personal workstation.

## Stack

- **Vite 5** + **React 18** + **TypeScript**
- **Ant Design 5** (with zhCN locale)
- **React Router 6** for routing
- **TanStack Query 5** for server state
- **Axios** for HTTP, **Day.js** for dates

## Development

```powershell
npm install
npm run dev      # http://localhost:5173 → proxies /api/* to backend
```

The Vite dev server proxies `/api/*` to `http://127.0.0.1:8000` (see `vite.config.ts`).

## Production build

```powershell
npm run build    # outputs to dist/
```

You can then serve `dist/` via any static server (Nginx in the docker-compose).

## Layout

```
src/
├── apps/
│   ├── dashboard/        # Landing page listing available micro-apps
│   └── email/            # Temp-mail app
│       ├── api/          # Axios client + typed wrappers
│       ├── components/   # MailboxSidebar / MessageList / MessageView / ComposeDrawer / TopBar
│       ├── pages/        # EmailInboxPage (composition root)
│       └── EmailApp.tsx
├── layouts/              # MainLayout (sider + header)
├── App.tsx               # placeholder
├── main.tsx              # React entrypoint
├── router.tsx            # Routes
└── index.css             # Global styles
```