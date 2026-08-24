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
  selectedFolder: string; // "inbox" | "trash" | "starred" | folder_id | "all"
  selectedLabelId: string | null;
  onSelectFolder: (slug: string) => void;
  onSelectLabel: (id: string | null) => void;
  /** Total counts per folder/label (for badges). Optional. */
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
      <List.Item
        onClick={() => {
          onSelectFolder(f.slug);
          onSelectLabel(null);
        }}
        style={{
          cursor: "pointer",
          padding: "6px 8px",
          borderRadius: 4,
          background: isActive ? "rgba(22,119,255,0.08)" : "transparent",
        }}
      >
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Space size={6}>
            {icon}
            <Text strong={isActive}>{f.name}</Text>
          </Space>
          {count && count > 0 ? (
            <Badge count={count} size="small" />
          ) : null}
        </Space>
      </List.Item>
    );
  };

  return (
    <Space direction="vertical" size="small" style={{ width: "100%" }}>
      {/* System folders */}
      <List
        size="small"
        dataSource={systemFolders}
        split={false}
        renderItem={(f) => {
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
          return folderItem(f, icon, count);
        }}
      />

      {/* Custom folders */}
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginTop: 8 }}
      >
        <Space size={4}>
          <UnorderedListOutlined />
          <Text type="secondary" style={{ fontSize: 12 }}>我的文件夹</Text>
        </Space>
        <Tooltip title="新建文件夹">
          <Button
            size="small"
            type="text"
            icon={<PlusOutlined />}
            onClick={() => setCreateFolderOpen(true)}
          />
        </Tooltip>
      </Space>
      <List
        size="small"
        split={false}
        dataSource={customFolders}
        locale={{ emptyText: <span style={{ fontSize: 12, color: "#999" }}>暂无</span> }}
        renderItem={(f) => {
          const isActive = selectedFolder === f.id && !selectedLabelId;
          const count = counts?.folders?.[f.id];
          return (
            <List.Item
              onClick={() => {
                onSelectFolder(f.id);
                onSelectLabel(null);
              }}
              style={{
                cursor: "pointer",
                padding: "6px 8px",
                borderRadius: 4,
                background: isActive ? "rgba(22,119,255,0.08)" : "transparent",
              }}
            >
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Space size={6}>
                  <FolderOutlined />
                  <Text strong={isActive}>{f.name}</Text>
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
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              </Space>
            </List.Item>
          );
        }}
      />

      {/* Labels */}
      <Space
        style={{ width: "100%", justifyContent: "space-between", marginTop: 8 }}
      >
        <Space size={4}>
          <TagsOutlined />
          <Text type="secondary" style={{ fontSize: 12 }}>标签</Text>
        </Space>
        <Tooltip title="新建标签">
          <Button
            size="small"
            type="text"
            icon={<PlusOutlined />}
            onClick={() => setCreateLabelOpen(true)}
          />
        </Tooltip>
      </Space>
      <List
        size="small"
        split={false}
        dataSource={labels}
        locale={{ emptyText: <span style={{ fontSize: 12, color: "#999" }}>暂无</span> }}
        renderItem={(l) => {
          const isActive = selectedLabelId === l.id;
          return (
            <List.Item
              onClick={() => {
                onSelectLabel(isActive ? null : l.id);
              }}
              style={{
                cursor: "pointer",
                padding: "6px 8px",
                borderRadius: 4,
                background: isActive ? "rgba(22,119,255,0.08)" : "transparent",
              }}
            >
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Space size={6}>
                  <Tag color={l.color} style={{ marginInlineEnd: 0 }}>
                    {l.name}
                  </Tag>
                </Space>
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
                              style={{ cursor: "pointer", marginInlineEnd: 0 }}
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
                    icon={<EditOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Dropdown>
              </Space>
            </List.Item>
          );
        }}
      />

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
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input
            autoFocus
            placeholder="标签名称"
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
          />
          <Select
            value={newLabelColor}
            onChange={(v) => setNewLabelColor(v)}
            style={{ width: "100%" }}
            options={LABEL_COLORS.map((c) => ({
              value: c,
              label: (
                <Tag color={c} style={{ marginInlineEnd: 0 }}>
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
