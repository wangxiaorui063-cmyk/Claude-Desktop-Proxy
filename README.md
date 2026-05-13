<h1 align="center">Claude Desktop Proxy</h1>

<p align="center">
  <strong>将 Claude Desktop 的 API 请求代理转发至 DeepSeek，零外部依赖</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/Dependencies-0-green" alt="Zero Dependencies">
</p>

---

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

## 特性

- **零依赖** — 仅使用 Node.js 内置 `http`、`https` 模块
- **模型翻译** — 仅拦截 `POST /v1/messages`，解析并替换 `model` 字段
- **流式透传** — SSE 响应使用 `.pipe()` 直接透传，不缓冲、不解析事件体
- **并发隔离** — 每个请求独立处理，互不干扰，支持多模型并发请求
- **错误透传** — 上游 4xx/5xx 原样返回，不吞没任何错误信息
- **灵活映射** — model 不在映射表中时保持原样透传，不影响其他请求

## 环境要求

- Node.js 18+

## 快速开始

### 1. 启动代理

```bash
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

### 2. 配置 Claude Desktop

将 Claude Desktop 的 API endpoint 指向代理地址：

```
http://localhost:3456
```

`x-api-key` 填写你的 DeepSeek API Key，代理会原样透传至上游。

## 配置说明

编辑 `config.json` 可修改以下配置：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `proxy.host` | 代理监听地址 | `localhost` |
| `proxy.port` | 代理监听端口 | `3456` |
| `upstream.baseUrl` | 上游 API 基础地址 | `https://api.deepseek.com/anthropic` |
| `modelMapping` | 模型名映射表 | 见下方示例 |

### 模型映射

Claude Desktop 内部会根据任务复杂度使用不同模型（Opus / Sonnet / Haiku），你可以在 `modelMapping` 中为每个模型指定对应的 DeepSeek 模型：

```json
{
  "modelMapping": {
    "claude-opus-4-7": "deepseek-v4-pro",
    "claude-sonnet-4-5": "deepseek-v3",
    "claude-haiku-4-5-20251001": "deepseek-v4-flash"
  }
}
```

> **提示**：如果请求中的模型名不在映射表中，代理会保持原样转发，并在日志中输出 `[model] xxx (无映射，保持原样)`。遇到此情况时，将该模型名添加到映射表即可。

## 错误处理

| 场景 | HTTP 状态码 | 说明 |
|------|------------|------|
| JSON 解析失败 | 400 | 请求体不是合法的 JSON |
| 上游连接失败 | 502 | 无法连接到 DeepSeek API |
| 上游返回错误 | 原样透传 | 4xx/5xx 状态码和错误 body 直接返回 |

## 文件结构

```
claude-desktop-proxy/
├── proxy.js       # 核心代理逻辑
├── config.json    # 配置文件（模型映射、端口等）
├── package.json   # 项目元数据
└── README.md      # 说明文档
```

## 许可证

[MIT](LICENSE)
