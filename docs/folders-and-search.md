# 标签 / 文件夹 / 回收站 与全文搜索

第一阶段临时邮箱之外，email-service 又新加了"组织"和"搜索"两个轴。

## 1. 文件夹（folders）

`folders` 表保存两类记录：

- **系统文件夹**：`slug` 必须是 `inbox` / `trash` / `starred` 之一，`owner_id` 为 NULL。`ensure_system_folders()` 会在邮箱服务启动时自动创建。
- **自定义文件夹**：用户新建的，`owner_id` 指向该用户，`slug` 固定为 `custom`。

`messages` 表新增 `folder_id` 与 `is_trashed` 两个字段：收到的邮件默认进入 `inbox`；移到回收站时 `is_trashed=true`（不删行），调用 `empty_trash` 才会物理删除。

前端侧：左侧栏 `FoldersPanel` 渲染系统文件夹、自定义文件夹和标签（标签见下一节）。

## 2. 标签（labels）

`labels` 表 + `message_labels` 关联表。每个标签属于一个 owner。颜色是受控枚举（`blue / red / green / orange / purple / cyan / magenta / gold / grey`），方便前端一致地渲染。

`/api/v1/messages/{id}/labels` 端点：

- `GET` 列出当前 message 已经贴的标签
- `PUT` 替换（覆盖）当前标签集合，body 是 `{"label_ids": [...]}`

## 3. 回收站流程

```
   list ─► [t ]restore ─► inbox
   list ─► [t ]delete  ─► 物理删除（attachment 文件一并清理）
   /trash/empty ─► 一次性清空当前用户的所有 is_trashed=true 邮件
```

> 30 天保留策略仍然有效：超过 30 天 `received_at` 的邮件会被 `run_cleanup()` 一并清掉。

## 4. 全文搜索 + 高亮

`app/services/search_service.py` 提供统一的 `search_messages(...)`。根据当前绑定引擎的 dialect 自动选择：

- **SQLite**（开发）：`LIKE %q%` 在 subject / from / body_text 上模糊匹配，命中处用 `<mark>...</mark>` 高亮。
- **PostgreSQL**（生产）：
  - `messages.search_tsv` 列是 `tsvector`，加权 A/B/B/C（subject > from > name > body）。
  - GIN 索引 `ix_messages_search_tsv`。
  - 触发器 `messages_search_tsv_trigger` 在 INSERT / UPDATE (subject, from_address, from_name, body_text) 时自动更新 `search_tsv`。
  - 查询用 `websearch_to_tsquery` + `ts_rank` 排序。
  - 高亮用 `ts_headline('simple', body, query, 'StartSel=<mark>,StopSel=</mark>')` 返回带 HTML 的 preview。

切换到 PostgreSQL 后只需调用 `search_service.ensure_search_index(session)`（幂等），它会执行 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`、`CREATE INDEX ... USING GIN`、建触发器、回填历史数据。

```sql
-- 迁移后自动触发的几条 DDL
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_tsv tsvector;
CREATE INDEX IF NOT EXISTS ix_messages_search_tsv ON messages USING GIN (search_tsv);

CREATE OR REPLACE FUNCTION messages_search_tsv_update() RETURNS trigger AS $func$
BEGIN
    NEW.search_tsv :=
        setweight(to_tsvector('simple', coalesce(NEW.subject, '')), 'A')
        || setweight(to_tsvector('simple', coalesce(NEW.from_address, '')), 'B')
        || setweight(to_tsvector('simple', coalesce(NEW.from_name, '')), 'B')
        || setweight(to_tsvector('simple', coalesce(NEW.body_text, '')), 'C');
    RETURN NEW;
END
$func$ LANGUAGE plpgsql;

CREATE TRIGGER messages_search_tsv_trigger
BEFORE INSERT OR UPDATE OF subject, from_address, from_name, body_text
ON messages FOR EACH ROW EXECUTE FUNCTION messages_search_tsv_update();
```

## 5. 端点速览

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/v1/folders` | GET / POST / PATCH / DELETE | 自定义文件夹管理 |
| `/api/v1/labels` | GET / POST / PATCH / DELETE | 标签管理 |
| `/api/v1/messages/{id}/labels` | GET / PUT | 邮件上的标签 |
| `/api/v1/messages/{id}/trash` | POST | 移到回收站 |
| `/api/v1/messages/{id}/restore` | POST | 从回收站恢复 |
| `/api/v1/trash/empty` | POST | 清空当前用户回收站 |
| `/api/v1/mailboxes/{id}/messages/search?q=...` | GET | 全文搜索（含高亮） |

## 6. 后续可铺的方向

- 全文搜索跨 mailbox（user 级搜索）
- 自定义文件夹 UI 拖拽（move 邮件到 folder）
- 标签批量操作（apply / remove to selection）
- 搜索结果分组 / 分面
