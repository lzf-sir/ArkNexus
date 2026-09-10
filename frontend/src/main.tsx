import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, App as AntApp } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import zhCN from "antd/locale/zh_CN";
import "antd/dist/reset.css";
import "./index.css";
import { router } from "./router";
import { AuthProvider } from "./apps/auth/AuthContext";
import { buildAntdTheme } from "./theme/antdTheme";
import { ThemeProvider } from "./theme/ThemeProvider";
import type { ThemeMode } from "./theme/tokens";

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
  // ThemeProvider writes the resolved mode to `data-theme`. We observe that
  // attribute (rather than threading state through context) so the ConfigProvider
  // picks up every flip — including ones triggered by `prefers-color-scheme`
  // changes inside ThemeProvider.
  const [mode, setMode] = useState<ThemeMode>(() =>
    document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setMode(
        document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
      );
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <ConfigProvider locale={zhCN} theme={buildAntdTheme(mode)}>
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
