import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, App as AntApp, theme as antdTheme } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import zhCN from "antd/locale/zh_CN";
import "antd/dist/reset.css";
import "./index.css";
import { router } from "./router";
import { AuthProvider } from "./apps/auth/AuthContext";
import { appleTheme, appleDarkTheme } from "./theme/appleTheme";
import { ThemeProvider, useTheme } from "./theme/ThemeContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ThemedApp() {
  const { resolved } = useTheme();
  const [tick, setTick] = useState(0);
  // The `dark` class is applied by ThemeContext on mount and on every change.
  // Force a small re-render after mount so ConfigProvider picks the right theme
  // on first paint (we read the class from `document.documentElement`).
  useEffect(() => {
    setTick((n) => n + 1);
  }, [resolved]);
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        ...(resolved === "dark" ? appleDarkTheme : appleTheme),
        algorithm: resolved === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
      key={tick}
    >
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </ConfigProvider>
  );
}

function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemedApp />
      </AuthProvider>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  </React.StrictMode>
);
