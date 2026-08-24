import {
  Alert,
  App,
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Space,
} from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { createDraft } from "../api/client";
import type { Mailbox } from "../api/client";

const { TextArea } = Input;

interface Props {
  open: boolean;
  mailbox: Mailbox | null;
  onClose: () => void;
}

interface FormShape {
  to_addresses: string[];
  cc_addresses?: string[];
  subject: string;
  body_text?: string;
}

export function DraftDrawer({ open, mailbox, onClose }: Props) {
  const [form] = Form.useForm<FormShape>();
  const { message: toast } = App.useApp();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  const draftMutation = useMutation({
    mutationFn: (values: FormShape) =>
      createDraft(mailbox!.id, {
        to_addresses: values.to_addresses,
        cc_addresses: values.cc_addresses ?? [],
        subject: values.subject,
        body_text: values.body_text,
      }),
    onSuccess: () => {
      toast.success("已保存为草稿");
      queryClient.invalidateQueries({ queryKey: ["drafts", mailbox!.id] });
      form.resetFields();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={mailbox ? `从 ${mailbox.address} 创建草稿` : "创建草稿"}
      width={620}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            onClick={async () => {
              try {
                await form.validateFields();
              } catch {
                return;
              }
              draftMutation.mutate(form.getFieldsValue());
            }}
            loading={draftMutation.isPending}
          >
            保存草稿
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        message="本服务仅提供收件能力，不发送邮件。草稿仅供本地记录，请使用你的主邮箱发送。"
        style={{ marginBottom: 16 }}
      />
      {!mailbox && (
        <Alert type="warning" showIcon message="请先在左侧选择一个邮箱。" />
      )}
      {mailbox && (
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => draftMutation.mutate(values)}
          initialValues={{ to_addresses: [], cc_addresses: [] }}
        >
          <Form.Item name="to_addresses" label="收件人（仅记录）">
            <Select
              mode="tags"
              placeholder="alice@example.com, bob@example.com"
              tokenSeparators={[",", " ", ";"]}
            />
          </Form.Item>
          <Form.Item name="cc_addresses" label="抄送（仅记录）">
            <Select
              mode="tags"
              placeholder="可选"
              tokenSeparators={[",", " ", ";"]}
            />
          </Form.Item>
          <Form.Item name="subject" label="主题">
            <Input maxLength={998} placeholder="邮件主题" />
          </Form.Item>
          <Form.Item name="body_text" label="正文">
            <TextArea
              autoSize={{ minRows: 8, maxRows: 16 }}
              placeholder="邮件正文（纯文本）"
            />
          </Form.Item>
        </Form>
      )}
    </Drawer>
  );
}
