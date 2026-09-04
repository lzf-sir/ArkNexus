// Onboarding card shown on the AI chat page when no provider is configured.
// Guides first-time users through the 3-step setup: configure → activate → chat.
//
// Why a dedicated component?
// - Existing empty state is a single line ("请前往系统设置...") which is easy to miss.
// - The product goal of M1.1 is to reduce Day-1 abandonment by surfacing the next
//   best step in-context with a clear call-to-action.

import { Alert, Space, Button, Tag, Typography, Divider } from "antd";
import {
  KeyRound,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { ProviderInfo } from "../api/client";
import { REGION_COLOR, REGION_LABEL } from "../constants";

const { Title: TitleText, Text, Paragraph } = Typography;

interface Props {
  providers: ProviderInfo[]; // catalog of supported providers
  configuredProviderIds: string[]; // ids that have an API key set
  activeProviderId?: string;
  onUseDemoKey?: () => void;
  demoKeyAvailable?: boolean;
}

export function AIOnboarding({
  providers,
  configuredProviderIds,
  activeProviderId,
  onUseDemoKey,
  demoKeyAvailable = false,
}: Props) {
  // Pick three recommended providers to surface as quick-start cards. The intent
  // is to make the first configuration decision feel small ("pick one of three")
  // instead of an overwhelming catalog scroll.
  const recommendedIds = ["openai", "anthropic", "openrouter"];
  const recommended = recommendedIds
    .map((id) => providers.find((p) => p.id === id))
    .filter((p): p is ProviderInfo => !!p);

  const steps = [
    {
      icon: <KeyRound size={18} strokeWidth={1.8} />,
      title: "填入 API Key",
      body: "选择一个 LLM 服务商，粘贴 API Key。Key 仅存在本地数据库，从不外发。",
      done: configuredProviderIds.length > 0,
    },
    {
      icon: <CheckCircle2 size={18} strokeWidth={1.8} />,
      title: "激活模型",
      body: "在模型列表勾选你想用的模型，并设为「当前激活」。",
      done: !!activeProviderId,
    },
    {
      icon: <MessageSquare size={18} strokeWidth={1.8} />,
      title: "开始对话",
      body: "点击左下角「新建对话」，即可与 AI 畅聊。",
      done: false,
    },
  ];

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "40px auto",
        padding: "0 16px",
      }}
      className="apple-fade-in"
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            margin: "0 auto 16px",
            background: "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 18px rgba(0,113,227,0.25)",
          }}
        >
          <Sparkles size={28} color="#fff" strokeWidth={2} />
        </div>
        <TitleText level={3} style={{ margin: 0, letterSpacing: "-0.01em" }}>
          欢迎使用 AI 助手
        </TitleText>
        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          完成下面 3 步即可开始对话，整个过程不到 2 分钟。
        </Paragraph>
      </div>

      {/* Steps */}
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: 16,
          padding: "20px 24px",
          marginBottom: 20,
        }}
      >
        {steps.map((s, i) => (
          <div key={i}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: s.done ? "#34c759" : "#f5f5f7",
                  color: s.done ? "#fff" : "#1d1d1f",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {s.done ? <CheckCircle2 size={18} strokeWidth={2.2} /> : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <Text strong style={{ fontSize: 14 }}>
                  {s.title}
                </Text>
                <Paragraph
                  type="secondary"
                  style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.6 }}
                >
                  {s.body}
                </Paragraph>
              </div>
            </div>
            {i < steps.length - 1 && (
              <Divider style={{ margin: "16px 0 16px 50px", borderColor: "rgba(0,0,0,0.04)" }} />
            )}
          </div>
        ))}
      </div>

      {/* Recommended providers */}
      {recommended.length > 0 && (
        <>
          <div
            style={{
              fontSize: 11,
              color: "#86868b",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 10,
              marginLeft: 4,
            }}
          >
            推荐服务商
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {recommended.map((p) => {
              const configured = configuredProviderIds.includes(p.id);
              return (
                <a
                  key={p.id}
                  href={p.signup_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="apple-card-hover"
                  style={{
                    display: "block",
                    background: "#fff",
                    border: configured
                      ? "1px solid #34c759"
                      : "1px solid rgba(0,0,0,0.06)",
                    borderRadius: 14,
                    padding: 14,
                    textDecoration: "none",
                    color: "inherit",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <Text strong style={{ fontSize: 14 }}>
                      {p.name}
                    </Text>
                    <Tag
                      color={REGION_COLOR[p.region]}
                      style={{ margin: 0, borderRadius: 6, fontSize: 10 }}
                    >
                      {REGION_LABEL[p.region]}
                    </Tag>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
                    {p.description.slice(0, 60)}
                    {p.description.length > 60 ? "..." : ""}
                  </Text>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: configured ? "#34c759" : "#0071e3",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {configured ? (
                      <>
                        <CheckCircle2 size={11} strokeWidth={2} /> 已配置
                      </>
                    ) : (
                      <>
                        <ExternalLink size={11} strokeWidth={2} /> 获取 API Key
                      </>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </>
      )}

      {/* Primary CTA */}
      <Space
        direction="vertical"
        size={10}
        style={{ width: "100%", alignItems: "center" }}
      >
        <Link to="/settings?module=ai">
          <Button
            type="primary"
            size="large"
            icon={<Zap size={16} strokeWidth={2} />}
            style={{
              borderRadius: 12,
              height: 44,
              padding: "0 28px",
              fontSize: 15,
              fontWeight: 500,
              boxShadow: "0 4px 14px rgba(0,113,227,0.25)",
            }}
          >
            前往 AI 模型配置 <ArrowRight size={14} strokeWidth={2} style={{ marginLeft: 4 }} />
          </Button>
        </Link>
        {demoKeyAvailable && onUseDemoKey && (
          <Button
            type="link"
            icon={<Sparkles size={14} strokeWidth={1.8} />}
            onClick={onUseDemoKey}
            style={{ fontSize: 13 }}
          >
            或使用 Demo 模式试用 5 次
          </Button>
        )}
      </Space>

      {/* Privacy note */}
      <Alert
        type="info"
        showIcon
        message="隐私提示"
        description="API Key 仅保存在你自己的数据库，ArkNexus 不会将其转发给任何第三方。流式响应经 Cloudflare 加密转发。"
        style={{
          marginTop: 24,
          borderRadius: 12,
          background: "rgba(0,113,227,0.04)",
          border: "1px solid rgba(0,113,227,0.15)",
        }}
      />
    </div>
  );
}