# Claude Desktop Proxy

将 Claude Desktop 的 Anthropic Messages API 请求转换为 DeepSeek API 请求的本地代理服务。零外部依赖，仅使用 Node.js 内置模块。

## 工作原理

```
Claude Desktop                    proxy.js (localhost:3456)              DeepSeek API
     │                                  │                                    │
     │  POST /v1/messages               │                                    │
     │  model: "claude-opus-4-7"        │                                    │
     │ ────────────────────────────────>│                                    │
     │                                  │  翻译 model 字段                    │
     │                                  │  claude-opus-4-7 → deepseek-v4-pro  │
     │                                  │                                    │
     │                                  │  POST /anthropic/v1/messages       │
     │                                  │  model: "deepseek-v4-pro"          │
     │                                  │ ──────────────────────────────────>│
     │                                  │                                    │
     │                                  │  HTTP 200 + SSE stream             │
     │                                  │ <──────────────────────────────────│
     │                                  │                                    │
     │  HTTP 200 + SSE stream (.pipe)   │                                    │
     │ <────────────────────────────────│                                    │
```

代理程序拦截 Claude Desktop 的请求，将 Anthropic 模型名替换为 DeepSeek 模型名后转发至上游，其余字段（messages、stream、thinking、max_tokens、x-api-key 等）全部透传。

## 环境要求

- Node.js 18+

## 快速开始

```bash
# 启动代理
npm start
```

启动成功后输出：

```
[proxy] Claude → DeepSeek 代理已启动
[proxy] 监听地址: http://localhost:3456
[proxy] 上游地址: https://api.deepseek.com/anthropic
[proxy] 模型映射: { 'claude-opus-4-7': 'deepseek-v4-pro' }
[proxy] 等待请求...
```

## 配置 Claude Desktop

将 Claude Desktop 的 API endpoint 指向代理地址：

```
http://localhost:3456
```

x-api-key 填写你的 DeepSeek API Key，代理会原样透传至上游。

## 自定义配置

编辑 `config.json` 可修改以下配置：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `proxy.host` | 代理监听地址 | `localhost` |
| `proxy.port` | 代理监听端口 | `3456` |
| `upstream.baseUrl` | 上游 API 基础地址 | `https://api.deepseek.com/anthropic` |
| `modelMapping` | 模型名映射表 | `claude-opus-4-7` → `deepseek-v4-pro` |

### 添加更多模型映射

```json
{
  "modelMapping": {
    "claude-opus-4-7": "deepseek-v4-pro",
    "claude-sonnet-4-5": "deepseek-v3",
    "claude-haiku-3-5": "deepseek-chat"
  }
}
```

## 核心特性

- **零依赖**：仅使用 Node.js 内置 `http`、`https` 模块
- **模型翻译**：仅拦截 `POST /v1/messages`，解析并替换 body 中的 `model` 字段
- **流式透传**：SSE 响应使用 `.pipe()` 直接透传，不缓冲、不解析事件体
- **并发隔离**：每个请求独立处理，互不干扰，支持多模型并发请求
- **错误透传**：上游 4xx/5xx 原样返回，不吞没任何错误信息
- **灵活映射**：model 不在映射表中时保持原样透传，不影响其他请求

## 错误处理

| 场景 | HTTP 状态码 | 说明 |
|------|------------|------|
| JSON 解析失败 | 400 | 请求体不是合法的 JSON |
| 上游连接失败 | 502 | 无法连接到 DeepSeek API |
| 上游返回错误 | 原样透传 | 4xx/5xx 状态码和错误 body 直接返回 |

## 文件结构

```
DAILI/
├── proxy.js       # 核心代理逻辑
├── config.json    # 配置文件（模型映射、端口等）
├── package.json   # 项目元数据
└── README.md      # 说明文档
```

## 许可证

MIT
