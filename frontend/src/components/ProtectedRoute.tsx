import { Spin } from "antd";
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchStatus } from "../apps/init/api/client";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const statusQuery = useQuery({
    queryKey: ["init-status"],
    queryFn: fetchStatus,
    retry: false,
    staleTime: 60_000,
  });

  if (statusQuery.isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin tip="检查系统状态..." />
      </div>
    );
  }

  // If init API failed, treat as uninitialized (safer default).
  const initialized = !!statusQuery.data?.initialized;
  if (!initialized) {
    return <Navigate to="/init" replace />;
  }

  // System initialized, but user might still need to log in. We don't check
  // auth here — that's a higher-level concern. Let children decide.
  void location;
  return <>{children}</>;
}