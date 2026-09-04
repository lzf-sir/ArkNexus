import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Skeleton,
  Slider,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  Check,
  Key,
  SlidersHorizontal,
  Zap,
  Wifi,
  Loader2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AIConfigSnapshot,
  ConnectionTestResult,
  DefaultParams,
  ModelInfo,
  ProviderConfig,
  ProviderInfo,
  fetchAIConfig,
  saveAIDefaults,
  saveProviderConfig,
  setActiveSelection,
  testProviderConnection,
} from "../../ai/api/client";
import { REGION_COLOR, REGION_LABEL } from "../../ai/constants";

const { Title, Text, Paragraph } = Typography;

interface ParamForm {
  temperature: number | null;
  max_tokens: number | null;
  top_p: number | null;
}

export function AIModelSettings() {
  const queryClient = useQueryClient();
  const { message: toast } = App.useApp();

  const configQuery = useQuery({
    queryKey: ["ai-config"],
    queryFn: fetchAIConfig,
    staleTime: 30_000,
  });

  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [params, setParams] = useState<ParamForm>({
    temperature: null,
    max_tokens: null,
    top_p: null,
  });

  const snapshot: AIConfigSnapshot | undefined = configQuery.data;
  const providers = snapshot?.providers ?? [];
  const providerConfigs = snapshot?.provider_configs ?? [];
  const active = snapshot?.active ?? null;
  const defaultParams: DefaultParams | null = snapshot?.default_params ?? null;

  // Seed the param form once the snapshot arrives.
  useEffect(() => {
    if (defaultParams) {
      setParams({
        temperature: defaultParams.temperature,
        max_tokens: defaultParams.max_tokens,
        top_p: defaultParams.top_p,
      });
    }
  }, [defaultParams]);

  const providersById = useMemo(() => {
    const m: Record<string, ProviderInfo> = {};
    providers.forEach((p) => (m[p.id] = p));
    return m;
  }, [providers]);

  const activeProvider: ProviderInfo | null = active ? providersById[active.provider_id] ?? null : null;
  const activeModel: ModelInfo | null =
    activeProvider && active
      ? activeProvider.models.find((m) => m.id === active.model_id) ?? null
      : null;

  const grouped = useMemo(() => {
    const g: Record<string, (ProviderInfo & { configured: boolean })[]> = {};
    providers.forEach((p) => {
      const configured = !!providerConfigs.find((c) => c.provider_id === p.id)?.api_key_set;
      (g[p.region] = g[p.region] || []).push({ ...p, configured });
    });
    return g;
  }, [providers, providerConfigs]);

  const switchModel = async (providerId: string, modelId: string) => {
    try {
      await setActiveSelection({ provider_id: providerId, model_id: modelId });
      queryClient.invalidateQueries({ queryKey: ["ai-config"] });
      toast.success("已设为默认模型");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveParams = useMutation({
    mutationFn: () => saveAIDefaults(params),
    onSuccess: () => {
      toast.success("模型参数已保存");
      queryClient.invalidateQueries({ queryKey: ["ai-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testConnectionM = useMutation({
    mutationFn: (providerId: string) => testProviderConnection(providerId),
  });

  const paramsDirty =
    defaultParams &&
    (defaultParams.temperature !== params.temperature ||
      defaultParams.max_tokens !== params.max_tokens ||
      defaultParams.top_p !== params.top_p);

  if (configQuery.isLoading) {
    return (
      <Card className="apple-card" style={{ borderRadius: 16 }} loading={false}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {/* ===== 默认模型 ===== */}
      <Card className="apple-card" style={{ borderRadius: 16 }}>
        <Space align="center" style={{ marginBottom: 4 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, #0071e3 0%, #42a1ec 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={16} color="#fff" strokeWidth={2} />
          </div>
          <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>
            默认模型
          </Title>
        </Space>
        <Paragraph type="secondary" style={{ color: "#86868b", fontSize: 14, marginTop: 4, marginBottom: 16 }}>
          选择新建对话时默认使用的服务商与模型。如需更换服务商，请先在下方配置 API Key。
        </Paragraph>

        {providers.length === 0 ? (
          <Empty description="暂无可用模型（请确认 config-service 已连接）" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          Object.entries(grouped).map(([region, items]) => (
            <div key={region} style={{ marginBottom: 20 }}>
              <Tag color={REGION_COLOR[region]} style={{ borderRadius: 6, marginBottom: 12 }}>
                {REGION_LABEL[region] ?? region}
              </Tag>
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="apple-card-flat"
                    style={{ padding: 14, borderRadius: 12 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <Space>
                        <Text strong style={{ fontSize: 14 }}>{p.name}</Text>
                        <Text type="secondary" style={{ fontSize: 12, color: "#86868b" }}>{p.name_en}</Text>
                      </Space>
                      {p.configured ? (
                        <Tag color="success" style={{ borderRadius: 6 }}>已配置</Tag>
                      ) : (
                        <Button
                          size="small"
                          type="link"
                          icon={<Key size={13} strokeWidth={1.8} />}
                          onClick={() => setEditingProviderId(p.id)}
                          style={{ fontSize: 12, padding: 0, height: "auto" }}
                        >
                          配置 Key
                        </Button>
                      )}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: 8,
                      }}
                    >
                      {p.models.map((m) => {
                        const selected =
                          active?.provider_id === p.id && active?.model_id === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => switchModel(p.id, m.id)}
                            title={m.description}
                            style={{
                              cursor: "pointer",
                              padding: "10px 12px",
                              borderRadius: 10,
                              border: `1px solid ${selected ? "rgba(0,113,227,0.35)" : "rgba(0,0,0,0.06)"}`,
                              background: selected ? "rgba(0,113,227,0.06)" : "#fff",
                              transition: "all 0.18s cubic-bezier(0.25,0.1,0.25,1)",
                            }}
                            onMouseEnter={(e) => {
                              if (!selected) e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)";
                            }}
                            onMouseLeave={(e) => {
                              if (!selected) e.currentTarget.style.boxShadow = "none";
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <Text strong style={{ fontSize: 13, color: "#1d1d1f" }}>{m.name}</Text>
                              {selected && <Check size={15} color="#0071e3" strokeWidth={2.4} />}
                            </div>
                            <div style={{ color: "#86868b", fontSize: 11, marginTop: 4 }}>
                              {(m.context_window / 1000).toFixed(0)}K ctx
                              {m.tags?.includes("free") && (
                                <Tag color="green" style={{ marginLeft: 4, borderRadius: 4, fontSize: 10, padding: "0 4px" }}>免费</Tag>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </Space>
            </div>
          ))
        )}

        {activeProvider && activeModel && (
          <Alert
            type="info"
            showIcon
            style={{ borderRadius: 10, marginTop: 4 }}
            message={`当前默认模型：${activeProvider.name} · ${activeModel.name}`}
          />
        )}
      </Card>

      {/* ===== 服务商 API Key ===== */}
      <Card className="apple-card" style={{ borderRadius: 16 }}>
        <Space align="center" style={{ marginBottom: 4 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, #34c759 0%, #30d158 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Key size={16} color="#fff" strokeWidth={2} />
          </div>
          <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>
            服务商 API Key
          </Title>
        </Space>
        <Paragraph type="secondary" style={{ color: "#86868b", fontSize: 14, marginTop: 4, marginBottom: 16 }}>
          填写一个或多个服务商的 API Key。Key 会写入 config-service 的加密配置项，仅用于本服务调用上游。
        </Paragraph>

        {providers.length === 0 ? (
          <Empty description="暂无可用服务商" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          Object.entries(grouped).map(([region, items]) => (
            <div key={region} style={{ marginBottom: 16 }}>
              <Tag color={REGION_COLOR[region]} style={{ borderRadius: 6, marginBottom: 10 }}>
                {REGION_LABEL[region] ?? region}
              </Tag>
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                {items.map((p) => {
                  const cfg = providerConfigs.find((c) => c.provider_id === p.id);
                  const isConfigured = !!cfg?.api_key_set;
                  const isTesting =
                    testConnectionM.isPending &&
                    testConnectionM.variables === p.id;
                  return (
                    <div
                      key={p.id}
                      className="apple-card-flat"
                      style={{ padding: 14, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: "#86868b" }}>{p.name_en}</div>
                        <div style={{ fontSize: 12, color: "#86868b", marginTop: 4 }}>{p.description}</div>
                      </div>
                      <Space direction="vertical" align="end" size={6}>
                        {isConfigured ? (
                          <Tag color="success" style={{ borderRadius: 6 }}>已配置</Tag>
                        ) : (
                          <Tag style={{ borderRadius: 6 }}>未配置</Tag>
                        )}
                        <Space size={4}>
                          <Button
                            type="primary"
                            size="small"
                            icon={<Key size={13} strokeWidth={1.8} />}
                            onClick={() => setEditingProviderId(p.id)}
                            style={{ borderRadius: 8 }}
                          >
                            {isConfigured ? "修改" : "配置"}
                          </Button>
                          {isConfigured && (
                            <Tooltip title="发送一个最小请求验证 Key 是否可用">
                              <Button
                                size="small"
                                icon={
                                  isTesting ? (
                                    <Loader2 size={13} strokeWidth={1.8} className="animate-spin" />
                                  ) : (
                                    <Wifi size={13} strokeWidth={1.8} />
                                  )
                                }
                                onClick={() => testConnectionM.mutate(p.id)}
                                style={{ borderRadius: 8 }}
                              >
                                {isTesting ? "测试中" : "测试"}
                              </Button>
                            </Tooltip>
                          )}
                          {p.signup_url && (
                            <Button size="small" type="link" href={p.signup_url} target="_blank" style={{ fontSize: 12 }}>
                              获取 Key
                            </Button>
                          )}
                        </Space>
                      </Space>
                    </div>
                  );
                })}
              </Space>
            </div>
          ))
        )}
      </Card>

      {/* ===== 模型参数 ===== */}
      <Card className="apple-card" style={{ borderRadius: 16 }}>
        <Space align="center" style={{ marginBottom: 4 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, #ff9f0a 0%, #ffb340 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SlidersHorizontal size={16} color="#fff" strokeWidth={2} />
          </div>
          <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>
            模型参数
          </Title>
        </Space>
        <Paragraph type="secondary" style={{ color: "#86868b", fontSize: 14, marginTop: 4, marginBottom: 16 }}>
          新建对话时使用的默认生成参数。留空则使用模型/服务商默认值。
        </Paragraph>

        <div style={{ maxWidth: 560 }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <Text strong style={{ fontSize: 14 }}>Temperature（采样温度）</Text>
              <Text style={{ fontSize: 13, color: "#0071e3" }}>{params.temperature ?? "默认"}</Text>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.1}
              value={params.temperature ?? 0.7}
              onChange={(v) => setParams((s) => ({ ...s, temperature: v }))}
              tooltip={{ formatter: (v) => `${v}` }}
            />
            <Text type="secondary" style={{ fontSize: 12, color: "#86868b" }}>
              越低越确定/保守，越高越随机/发散。
            </Text>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <Text strong style={{ fontSize: 14 }}>Max Tokens（最大生成长度）</Text>
            </div>
            <InputNumber
              min={1}
              max={200000}
              style={{ width: 200 }}
              value={params.max_tokens ?? null}
              placeholder="默认 2048"
              onChange={(v) => setParams((s) => ({ ...s, max_tokens: v }))}
            />
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12, color: "#86868b" }}>
                单次回复最多生成的 token 数。
              </Text>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <Text strong style={{ fontSize: 14 }}>Top P（核采样概率）</Text>
              <Text style={{ fontSize: 13, color: "#0071e3" }}>{params.top_p ?? "默认"}</Text>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={params.top_p ?? 1}
              onChange={(v) => setParams((s) => ({ ...s, top_p: v }))}
              tooltip={{ formatter: (v) => `${v}` }}
            />
            <Text type="secondary" style={{ fontSize: 12, color: "#86868b" }}>
              与 temperature 类似的随机性控制，考虑概率累积前 P 的候选词。
            </Text>
          </div>

          <Space>
            <Button
              type="primary"
              loading={saveParams.isPending}
              onClick={() => saveParams.mutate()}
              style={{ borderRadius: 980 }}
              disabled={!paramsDirty}
            >
              保存参数
            </Button>
            <Button
              onClick={() =>
                setParams({ temperature: null, max_tokens: null, top_p: null })
              }
              style={{ borderRadius: 980 }}
            >
              恢复默认
            </Button>
          </Space>
        </div>
      </Card>

      {editingProviderId && (
        <ProviderKeyModal
          provider={providers.find((p) => p.id === editingProviderId)!}
          current={providerConfigs.find((c) => c.provider_id === editingProviderId)}
          onClose={() => setEditingProviderId(null)}
          onSaved={() => {
            setEditingProviderId(null);
            queryClient.invalidateQueries({ queryKey: ["ai-config"] });
            toast.success("已保存");
          }}
        />
      )}

      {/* Test connection result modal */}
      <Modal
        open={!!testConnectionM.data}
        title={
          <Space>
            {testConnectionM.data?.ok ? (
              <Check size={18} color="#34c759" strokeWidth={2.4} />
            ) : (
              <Wifi size={18} color="#ff3b30" strokeWidth={2.4} />
            )}
            <span>连接测试</span>
          </Space>
        }
        onCancel={() => testConnectionM.reset()}
        footer={[
          <Button key="ok" type="primary" onClick={() => testConnectionM.reset()}>
            关闭
          </Button>,
        ]}
        destroyOnClose
      >
        {testConnectionM.data && (
          <TestResultView result={testConnectionM.data} providerName={
            providers.find((p) => p.id === testConnectionM.variables)?.name ?? ""
          } />
        )}
      </Modal>
    </Space>
  );
}

function TestResultView({ result, providerName }: { result: ConnectionTestResult; providerName: string }) {
  const ok = result.ok;
  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Alert
        type={ok ? "success" : "error"}
        showIcon
        message={
          ok
            ? `${providerName} 连接成功`
            : `${providerName} 连接失败`
        }
        description={
          <Space direction="vertical" size={4}>
            {result.status !== null && (
              <span>HTTP 状态：{result.status}</span>
            )}
            {result.model && (
              <span>测试模型：{result.model}</span>
            )}
            <span>耗时：{result.latency_ms} ms</span>
          </Space>
        }
        style={{ borderRadius: 10 }}
      />
      <div
        style={{
          background: ok ? "rgba(52,199,89,0.06)" : "rgba(255,59,48,0.06)",
          border: `1px solid ${ok ? "rgba(52,199,89,0.20)" : "rgba(255,59,48,0.20)"}`,
          borderRadius: 10,
          padding: 12,
          fontSize: 13,
          color: "#1d1d1f",
          fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace",
          wordBreak: "break-word",
          maxHeight: 160,
          overflow: "auto",
        }}
      >
        {result.reply || "(无内容)"}
      </div>
    </Space>
  );
}

// ============================================================
// Provider Key modal (migrated from the AI chat settings drawer)
// ============================================================
function ProviderKeyModal({
  provider,
  current,
  onClose,
  onSaved,
}: {
  provider: ProviderInfo;
  current: ProviderConfig | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(current?.base_url_override ?? "");
  const save = useMutation({
    mutationFn: () =>
      saveProviderConfig(provider.id, {
        api_key: apiKey || null,
        base_url_override: baseUrl || null,
      }),
    onSuccess: onSaved,
  });
  return (
    <Modal
      open
      title={`配置 ${provider.name}`}
      onCancel={onClose}
      onOk={() => save.mutate()}
      confirmLoading={save.isPending}
      okText="保存"
      cancelText="取消"
    >
      <Paragraph type="secondary" style={{ color: "#86868b", fontSize: 14 }}>
        在 {provider.signup_url ? (
          <a href={provider.signup_url} target="_blank" rel="noreferrer" style={{ color: "#0071e3" }}>
            {provider.signup_url}
          </a>
        ) : (
          "服务商控制台"
        )}{" "}
        获取 API Key，填入下方。留空表示清除当前 Key。
      </Paragraph>
      <Input.Password
        placeholder={current?.api_key_set ? "已配置，输入新 Key 以覆盖" : "sk-..."}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        style={{ height: 40, marginBottom: 16 }}
      />
      <Text type="secondary" style={{ fontSize: 12 }}>
        Base URL 覆盖（可选）— 默认: {provider.base_url || "(无)"}
      </Text>
      <Input
        placeholder="https://your-proxy.example.com/v1"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        style={{ height: 40, marginTop: 6 }}
      />
    </Modal>
  );
}
