# JiMiNai Nexus

基于 [Gemini Nexus](https://github.com/yeahhe365/Gemini-Nexus) 修改的 Chrome AI 扩展。本仓库主要尝试把 **Gemini 网页版转成本地 OpenAI 兼容 API**，供其他聊天客户端或脚本调用。

## 原项目能做什么

- 在浏览器侧边栏聊天，支持 Gemini 网页版、官方 API 和多个第三方模型渠道。
- 网页划词、翻译、总结、朗读、截图与图片分析。
- 让 AI 操作浏览器，并接入外部 MCP 工具。

## 这里改了什么

新增本地 API 桥接，复用浏览器中已登录的 Gemini 网页会话：

```text
聊天客户端 / 脚本 → 本地 Node.js 代理 → 浏览器扩展 → Gemini 网页版
```

已加入扩展后台桥接、设置页开关与连接地址，以及 `proxy/` 下的通信、请求转换和流式输出辅助模块。

目标是兼容 `/v1/chat/completions` 和 `/v1/responses`。第一版仅面向本机、纯文本请求，不支持工具调用或图片、文件输入。

**当前代理尚未完整收尾：** `npm run proxy:start` 指向的 `proxy/server.js` 缺失，暂时不能通过该命令启动完整 API 服务。

## 构建扩展

```bash
npm install
npm run package:extension
```

打开 Chrome 扩展管理页，启用开发者模式，选择“加载已解压的扩展程序”，加载 `artifacts/chrome-extension` 目录。使用 Gemini Web 渠道前，需要在浏览器中登录 Gemini。

## 更多说明

- [中文项目总览](docs/project-overview.zh-CN.md)：较详细的结构和背景说明，部分状态记录较旧。
- 原版说明：[中文](README.original.zh-CN.md) · [English](README.original.md)
- [MIT License](LICENSE)
