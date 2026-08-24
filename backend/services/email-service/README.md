# ArkNexus — email-service

临时邮箱微服务。基于 **FastAPI + SQLAlchemy 2 + aiosmtpd**。

## 能力

- 随机生成 `xxx@arknexus.local` 形式的邮箱地址
- 通过内嵌 SMTP 接收任意发往已激活地址的邮件
- HTML / 纯文本 / 附件 / 主题 / 发件人一应俱全
- 多邮箱切换（前端）
- 30 天保留，到期自动清理（含附件文件）
- 通过 SMTP 中继发信；未配置时退化为控制台模式

## 本地开发

```powershell
# 1. 创建虚拟环境
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. 安装依赖
pip install -r requirements.txt

# 3. 复制环境变量
copy .env.example .env

# 4. 初始化数据库
python scripts\init_db.py

# 5. 启动
python -m app.main
```

启动后：

| 地址 | 说明 |
|---|---|
| `http://localhost:8000/` | 健康检查 |
| `http://localhost:8000/docs` | Swagger UI |
| `0.0.0.0:1025` | SMTP 接收端口 |
| `./data/email_service.db` | SQLite 数据 |
| `./data/attachments/` | 附件目录 |

## 关键端点

```
POST   /api/v1/mailboxes                    # 创建临时邮箱
GET    /api/v1/mailboxes                    # 列表
GET    /api/v1/mailboxes/{id}/messages      # 该邮箱下的邮件
GET    /api/v1/messages/{id}                # 读取邮件
POST   /api/v1/mailboxes/{id}/send          # 发信
POST   /api/v1/system/cleanup               # 手动触发清理
GET    /api/v1/system/stats                 # 统计
```

## 测试

```powershell
python scripts\send_test_mail.py
```

向上一步刚创建的 `xxx@arknexus.local` 发一封测试邮件，前端能立刻看到。