# impersonated-fetch

一个支持 TLS 指纹模拟的 Node.js Fetch 风格 HTTP 客户端。本项目将 Python 的 [requests-go](https://github.com/wangluozhe/requests-go) 库移植到 Node.js，通过原生 Go 后端提供 TLS/JA3 指纹伪装和 JA4 导向的头部控制功能。

## 概述

`impersonated-fetch` 将熟悉的 Fetch API 接口与高级 TLS 指纹功能相结合。它可以让你发送模拟特定浏览器指纹的 HTTP 请求，帮助你绕过依赖 TLS 和 HTTP/2 指纹识别的反爬虫检测系统。

本项目通过 Koffi FFI 调用原生 Go 后端，实现纯 JavaScript 无法完成的底层 TLS 控制。

## 安装

```bash
npm install impersonated-fetch
```

本包使用可选依赖来自动安装适合你平台的原生后端。如果可选依赖被禁用，请手动安装后端：

```bash
npm install impersonated-fetch @impersonated-fetch/backend-linux-x64
```

## 快速开始

```typescript
import { fetch, TLS_CHROME_LATEST } from 'impersonated-fetch';

// 使用 Chrome TLS 指纹发送简单的 GET 请求
const response = await fetch('https://httpbin.org/get', {
  tls: TLS_CHROME_LATEST,
});

const data = await response.json();
console.log(data);
```

### 带 Cookie 持久化的会话

```typescript
import { Client, TLS_CHROME_LATEST } from 'impersonated-fetch';

const client = new Client({
  tls: TLS_CHROME_LATEST,
});

// Cookie 会自动在请求间持久化
await client.fetch('https://example.com/login', {
  method: 'POST',
  body: JSON.stringify({ username: 'user', password: 'pass' }),
});

const response = await client.fetch('https://example.com/profile');
await client.close();
```

## 主要特性

- **TLS 指纹伪装**: 支持 JA3 指纹，提供 JA4 导向的头部控制
- **HTTP/2 设置控制**: 完全控制 HTTP/2 的 SETTINGS、WINDOW_UPDATE 和 PRIORITY 帧
- **Cookie 持久化**: 通过 `Client`/`Session` 类使用 tough-cookie 实现内置 Cookie 容器
- **浏览器预设**: 提供 Chrome、Firefox、Edge 和 Safari 的预配置指纹
- **JA3 随机化**: 内置选项可随机化 JA3 签名
- **代理支持**: 支持 HTTP、HTTPS 和 SOCKS5 代理
- **流式响应**: 原生 ReadableStream 支持响应流
- **自定义头部顺序**: 控制 HTTP 头部的发送顺序
- **基于 Promise 的 API**: 原生 async/await 支持，兼容标准 Fetch API

## 项目结构

这是一个使用 pnpm/Nx 管理的 monorepo，包含以下包：

```
impersonated-fetch/
├── packages/
│   ├── impersonated-fetch/    # 主 TypeScript 包
│   └── native-backend/        # Go 原生后端包
├── examples/                  # 使用示例
└── .github/workflows/          # CI/CD 工作流
```

### 包说明

- **[impersonated-fetch](./packages/impersonated-fetch/README.md)**: 提供 TLS 模拟功能的 Fetch API 主 TypeScript 包
- **[native-backend](./packages/native-backend/README.md)**: 用于构建原生共享库后端的 Go 源码包

## 开发

### 环境要求

- Node.js 18+ 和 pnpm 11+
- Go 1.25+（用于原生后端开发）
- Nx（用于 monorepo 任务编排）

### 初始化

```bash
# 安装依赖
pnpm install

# 构建主包
pnpm run build

# 构建原生后端（需要 Go）
pnpm run native-backend:build

# 运行测试
pnpm test
```

### 可用脚本

- `pnpm run build` - 构建主 TypeScript 包
- `pnpm run test` - 运行所有测试
- `pnpm run lint` - 运行代码检查
- `pnpm run typecheck` - 运行 TypeScript 类型检查
- `pnpm run native-backend:build` - 构建原生 Go 后端
- `pnpm run native-backend:package-generate` - 生成平台特定的 npm 包

## 支持的平台

- **Linux**: x64, x32, ARM64
- **macOS**: x64, ARM64 (Apple Silicon)
- **Windows**: x64, x32, ARM64

## 安全声明

本包设计用于合法用途，如网络爬虫、自动化测试以及获得适当授权的安全研究。请勿将其用于绕过你不拥有或未经授权测试的系统上的安全措施。

## 贡献

欢迎贡献代码。请确保你的代码遵循现有模式，并包含适当的测试。

## 许可证

MIT

## 致谢

- [@wangluozhe](https://github.com/wangluozhe) 开发了原始的 requests-go 库
