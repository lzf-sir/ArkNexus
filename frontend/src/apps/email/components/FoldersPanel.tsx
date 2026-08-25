import {
  Badge,
  Button,
  Dropdown,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  FolderOutlined,
  InboxOutlined,
  PlusOutlined,
  StarFilled,
  TagsOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App } from "antd";
import { useState } from "react";
import {
  FolderInfo,
  LabelInfo,
  createFolder,
  createLabel,
  deleteFolder,
  deleteLabel,
  listFolders,
  listLabels,
  updateLabel,
} from "../api/client";

const { Text } = Typography;

const LABEL_COLORS = [
  "blue", "red", "green", "orange", "purple", "cyan", "magenta", "gold", "grey",
];

interface Props {
  selectedFolder: string;
  selectedLabelId: string | null;
  onSelectFolder: (slug: string) => void;
  onSelectLabel: (id: string | null) => void;
  counts?: {
    inbox?: number;
    trash?: number;
    starred?: number;
    folders?: Record<string, number>;
    labels?: Record<string, number>;
  };
}

export function FoldersPanel({
  selectedFolder,
  selectedLabelId,
  onSelectFolder,
  onSelectLabel,
  counts,
}: Props) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const foldersQ = useQuery<FolderInfo[]>({
    queryKey: ["folders"],
    queryFn: listFolders,
  });
  const labelsQ = useQuery<LabelInfo[]>({
    queryKey: ["labels"],
    queryFn: listLabels,
  });

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createLabelOpen, setCreateLabelOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("blue");

  const createFolderM = useMutation({
    mutationFn: (name: string) => createFolder({ name }),
    onSuccess: () => {
      message.success("已创建文件夹");
      qc.invalidateQueries({ queryKey: ["folders"] });
      setNewFolderName("");
      setCreateFolderOpen(false);
    },
    onError: (e: Error) => message.error(e.message),
  });

  const deleteFolderM = useMutation({
    mutationFn: (id: string) => deleteFolder(id),
    onSuccess: () => {
      message.success("已删除");
      qc.invalidateQueries({ queryKey: ["folders"] });
      if (selectedFolder !== "inbox" && selectedFolder !== "trash" && selectedFolder !== "starred" && selectedFolder !== "all") {
        onSelectFolder("inbox");
      }
    },
    onError: (e: Error) => message.error(e.message),
  });

  const createLabelM = useMutation({
    mutationFn: (p: { name: string; color: string }) => createLabel(p),
    onSuccess: () => {
      message.success("已创建标签");
      qc.invalidateQueries({ queryKey: ["labels"] });
      setNewLabelName("");
      setNewLabelColor("blue");
      setCreateLabelOpen(false);
    },
    onError: (e: Error) => message.error(e.message),
  });

  const deleteLabelM = useMutation({
    mutationFn: (id: string) => deleteLabel(id),
    onSuccess: () => {
      message.success("已删除标签");
      qc.invalidateQueries({ queryKey: ["labels"] });
      if (selectedLabelId) onSelectLabel(null);
    },
    onError: (e: Error) => message.error(e.message),
  });

  const updateLabelM = useMutation({
    mutationFn: (p: { id: string; color: string }) => updateLabel(p.id, { color: p.color }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labels"] });
    },
    onError: (e: Error) => message.error(e.message),
  });

  const folders = foldersQ.data ?? [];
  const labels = labelsQ.data ?? [];
  const systemFolders = folders.filter((f) => f.is_system);
  const customFolders = folders.filter((f) => !f.is_system);

  const folderItem = (f: FolderInfo, icon: React.ReactNode, count?: number) => {
    const isActive = selectedFolder === f.slug && !selectedLabelId;
    return (
      <div
        onClick={() => {
          onSelectFolder(f.slug);
          onSelectLabel(null);
        }}
        style={{
          cursor: "pointer",
          padding: "7px 10px",
          borderRadius: 8,
          background: isActive ? "rgba(0,113,227,0.08)" : "transparent",
          transition: "background 0.2s",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = "rgba(0,0,0,0.03)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = "transparent";
        }}
      >
        <Space size={8}>
          {icon}
          <Text strong={isActive} style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>
            {f.name}
          </Text>
        </Space>
        {count && count > 0 ? (
          <Badge count={count} size="small" />
        ) : null}
      </div>
    );
  };

  return (
    <Space direction="vertical" size="small" style={{ width: "100%" }}>
      {/* System folders */}
      {systemFolders.map((f) => {
        let icon = <FolderOutlined />;
        let count: number | undefined;
        if (f.slug === "inbox") {
          icon = <InboxOutlined />;
          count = counts?.inbox;
        } else if (f.slug === "trash") {
          icon = <DeleteOutlined />;
          count = counts?.trash;
        } else if (f.slug === "starred") {
          icon = <StarFilled style={{ color: "#fadb14" }} />;
          count = counts?.starred;
        }
        return <div key={f.id}>{folderItem(f, icon, count)}</div>;
      })}

      {/* Custom folders header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 8,
          padding: "0 10px",
        }}
      >
        <Space size={6}>
          <UnorderedListOutlined style={{ color: "#86868b", fontSize: 12 }} />
          <Text style={{ fontSize: 11, color: "#86868b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            我的文件夹
          </Text>
        </Space>
        <Tooltip title="新建文件夹">
          <Button
            size="small"
            type="text"
            icon={<PlusOutlined style={{ fontSize: 13 }} />}
            onClick={() => setCreateFolderOpen(true)}
            style={{ width: 24, height: 24, padding: 0 }}
          />
        </Tooltip>
      </div>
      {customFolders.map((f) => {
        const isActive = selectedFolder === f.id && !selectedLabelId;
        const count = counts?.folders?.[f.id];
        return (
          <div
            key={f.id}
            onClick={() => {
              onSelectFolder(f.id);
              onSelectLabel(null);
            }}
            style={{
              cursor: "pointer",
              padding: "7px 10px",
              borderRadius: 8,
              background: isActive ? "rgba(0,113,227,0.08)" : "transparent",
              transition: "background 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = "rgba(0,0,0,0.03)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <Space size={8}>
              <FolderOutlined style={{ color: "#86868b" }} />
              <Text strong={isActive} style={{ fontSize: 13 }}>
                {f.name}
              </Text>
              {count && count > 0 ? <Badge count={count} size="small" /> : null}
            </Space>
            <Popconfirm
              title="删除该文件夹？"
              onConfirm={(e) => {
                e?.stopPropagation();
                deleteFolderM.mutate(f.id);
              }}
              onCancel={(e) => e?.stopPropagation()}
            >
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                onClick={(e) => e.stopPropagation()}
                style={{ width: 24, height: 24, padding: 0 }}
              />
            </Popconfirm>
          </div>
        );
      })}
      {customFolders.length === 0 && (
        <div style={{ padding: "0 10px", fontSize: 12, color: "#86868b" }}>暂无</div>
      )}

      {/* Labels header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 8,
          padding: "0 10px",
        }}
      >
        <Space size={6}>
          <TagsOutlined style={{ color: "#86868b", fontSize: 12 }} />
          <Text style={{ fontSize: 11, color: "#86868b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            标签
          </Text>
        </Space>
        <Tooltip title="新建标签">
          <Button
            size="small"
            type="text"
            icon={<PlusOutlined style={{ fontSize: 13 }} />}
            onClick={() => setCreateLabelOpen(true)}
            style={{ width: 24, height: 24, padding: 0 }}
          />
        </Tooltip>
      </div>
      {labels.map((l) => {
        const isActive = selectedLabelId === l.id;
        return (
          <div
            key={l.id}
            onClick={() => {
              onSelectLabel(isActive ? null : l.id);
            }}
            style={{
              cursor: "pointer",
              padding: "7px 10px",
              borderRadius: 8,
              background: isActive ? "rgba(0,113,227,0.08)" : "transparent",
              transition: "background 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = "rgba(0,0,0,0.03)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <Tag color={l.color} style={{ margin: 0, borderRadius: 6, fontSize: 12 }}>
              {l.name}
            </Tag>
            <Dropdown
              menu={{
                items: [
                  {
                    key: "color",
                    label: "修改颜色",
                    children: LABEL_COLORS.map((c) => ({
                      key: c,
                      label: (
                        <Tag
                          color={c}
                          style={{ cursor: "pointer", marginInlineEnd: 0, borderRadius: 6 }}
                          onClick={() => updateLabelM.mutate({ id: l.id, color: c })}
                        >
                          {l.name}
                        </Tag>
                      ),
                    })),
                  },
                  {
                    key: "del",
                    danger: true,
                    label: "删除",
                    icon: <DeleteOutlined />,
                    onClick: () => deleteLabelM.mutate(l.id),
                  },
                ],
              }}
              trigger={["click"]}
            >
              <Button
                size="small"
                type="text"
                icon={<EditOutlined style={{ fontSize: 12 }} />}
                onClick={(e) => e.stopPropagation()}
                style={{ width: 24, height: 24, padding: 0 }}
              />
            </Dropdown>
          </div>
        );
      })}
      {labels.length === 0 && (
        <div style={{ padding: "0 10px", fontSize: 12, color: "#86868b" }}>暂无</div>
      )}

      {/* Create folder modal */}
      <Modal
        title="新建文件夹"
        open={createFolderOpen}
        onCancel={() => setCreateFolderOpen(false)}
        onOk={() => newFolderName.trim() && createFolderM.mutate(newFolderName.trim())}
        confirmLoading={createFolderM.isPending}
        okText="创建"
        cancelText="取消"
      >
        <Input
          autoFocus
          placeholder="文件夹名称"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={() => newFolderName.trim() && createFolderM.mutate(newFolderName.trim())}
          style={{ height: 40 }}
        />
      </Modal>

      {/* Create label modal */}
      <Modal
        title="新建标签"
        open={createLabelOpen}
        onCancel={() => setCreateLabelOpen(false)}
        onOk={() =>
          newLabelName.trim() &&
          createLabelM.mutate({ name: newLabelName.trim(), color: newLabelColor })
        }
        confirmLoading={createLabelM.isPending}
        okText="创建"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Input
            autoFocus
            placeholder="标签名称"
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
            style={{ height: 40 }}
          />
          <Select
            value={newLabelColor}
            onChange={(v) => setNewLabelColor(v)}
            style={{ width: "100%" }}
            options={LABEL_COLORS.map((c) => ({
              value: c,
              label: (
                <Tag color={c} style={{ marginInlineEnd: 0, borderRadius: 6 }}>
                  {c}
                </Tag>
              ),
            }))}
          />
        </Space>
      </Modal>
    </Space>
  );
}
