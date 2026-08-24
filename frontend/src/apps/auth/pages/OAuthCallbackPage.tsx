import { App, Spin, Typography } from "antd";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../AuthContext";

const { Title, Paragraph } = Typography;

/**
 * The OAuth callback flow normally happens via browser redirect from the
 * provider back to the backend (/auth/oauth/{provider}/callback). The backend
 * returns a JSON token in the response body — not navigable. To bridge this,
 * we configure the provider to redirect to this page along with the token,
 * OR we hit the backend directly via fetch and persist the token.
 *
 * For simplicity, the backend's callback returns a JSON body; we POST a
 * request to it via the Authorization header pattern instead. As an
 * alternative, we expose a query-string-driven callback flow that the
 * backend will redirect to with the token included:
 */
export function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const { message } = App.useApp();

  useEffect(() => {
    const token = params.get("token");
    const userJson = params.get("user");
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        setSession(token, user);
        message.success("使用 OAuth 登录成功");
        navigate("/", { replace: true });
      } catch (e) {
        message.error((e as Error).message);
        navigate("/login", { replace: true });
      }
    } else {
      const error = params.get("error") || "OAuth callback missing token";
      message.error(error);
      navigate("/login", { replace: true });
    }
  }, [params, navigate, setSession, message]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f2f5",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 16 }}>
          正在完成 OAuth 登录…
        </Title>
        <Paragraph type="secondary">请稍候</Paragraph>
      </div>
    </div>
  );
}
