import { Spin } from "antd";
import { Rocket } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listOAuthProviders } from "../api/oauth";
import { LoginCard } from "./components/LoginCard";

export function LoginPage() {
  const providersQuery = useQuery({
    queryKey: ["oauth-providers"],
    queryFn: listOAuthProviders,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      {providersQuery.isLoading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Rocket size={20} />
          <Spin />
        </div>
      ) : (
        <LoginCard configuredProviders={providersQuery.data?.configured ?? []} />
      )}
    </div>
  );
}
