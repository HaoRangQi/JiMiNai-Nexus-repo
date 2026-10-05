# Gemini Nexus 项目总览

最后更新：2026-07-02

本文面向第一次接触本仓库的开发者、协作者和 AI 代理。目标不是重复 README 的安装说明，而是用接手视角回答四个问题：

1. 这是什么项目。
2. 它现在已经做到了什么程度。
3. 仓库里每一块代码分别负责什么。
4. 如果你要继续维护或开发，应该先看哪里、注意什么。

## 1. 一句话定义

**Gemini Nexus** 是一个基于 Chrome Manifest V3 的浏览器扩展，目标是给浏览器加上一层“原生 AI 操作层”。

它不是单一聊天侧边栏，而是把以下能力组合到一起：

- 多模型/多渠道聊天，包括 Gemini Web、Gemini 官方 API、OpenAI Compatible API 以及多个专门 API 渠道。
- 页面内划词、解释、翻译、总结、朗读、OCR、图片分析等内容脚本能力。
- 基于 Chrome DevTools Protocol 的浏览器控制能力，让模型可以对标签页执行导航、点击、填表、快照等操作。
- 通过 MCP 连接外部工具服务器，把浏览器扩展本身纳入更广义的 Agent 工具链。

## 2. 当前项目处于什么阶段

### 2.1 已发布状态

从 `package.json`、`manifest.json` 和 `CHANGELOG.md` 可见，仓库当前标记版本为 **v5.0.11**，最近一次发布记录日期为 **2026-06-02**。

这说明项目不是 PoC，而是已经连续发布多个版本、具备稳定演进轨迹的可用扩展。

### 2.2 最近一个月已经落地的重点能力

根据 `CHANGELOG.md`，2026-05 到 2026-06 这一轮迭代已经完成：

- 页面快捷键桥接、快速提问、区域 OCR 等页面级入口。
- Gemini Web TTS 逆向接入。
- 浏览器控制链路加强，包括快照 UID 稳定性、表单自动化和工具调用显示。
- 多个专门 API 渠道接入：OpenAI 官方、DeepSeek、Anthropic、OpenRouter、DashScope、智谱。
- 上下文压缩、历史编辑、历史搜索、导出、设置页增强、工具卡片展示等产品化能力。

结论：**主产品能力已经比较完整，当前主要不是“有没有功能”，而是“继续增强、维护和收敛复杂度”。**

### 2.3 当前工作树状态

截至 **2026-07-02**，当前工作树不是完全干净的状态。

从 `git status --short` 可以看到，本地还有一批未提交改动，重点集中在两条线：

- 设置页 / 连接配置相关文件。
- `proxy/` 与 `background/managers/api_bridge_manager.js` 相关的 **Gemini Web 本地 OpenAI 兼容代理桥接**。

这批改动说明仓库当前还在推进一个“把 Gemini Web 通过本地侧车暴露为 OpenAI 兼容接口”的方向。但从现状看，它**尚未完全整理成一致的可交付状态**，因为：

- `package.json` 中存在 `npm run proxy:start -> node proxy/server.js`。
- 但当前工作树里能看到 `proxy/bridge_server.js`、`proxy/openai_adapter.js`、`proxy/models.js` 等文件，**看不到 `proxy/server.js` 入口文件**。

因此，这条代理链路应视为：**方向明确、实现已做了大半，但当前分支里仍有收口工作要做。**

## 3. 这个项目到底解决什么问题

Gemini Nexus 解决的是“浏览器里的 AI 能力过于割裂”的问题。

典型产品形态通常只覆盖其中一个点：

- 只有一个聊天侧边栏。
- 只能调用单一模型。
- 只能在网页外部使用 AI。
- 不能控制浏览器，也不能接外部工具。

Gemini Nexus 的实际定位更像一个 **浏览器内 Agent 平台**：

- 侧边栏负责会话主界面。
- 内容脚本负责进入网页上下文。
- 后台服务负责调度模型、权限、截图、标签页、工具调用。
- MCP 和浏览器控制让模型不只是“回答”，而是能“操作”。

## 4. 架构总览

可以把仓库理解为 5 个主要运行域，加 1 个正在推进中的本地侧车：

### 4.1 `background/`

这是扩展的后台 Service Worker，也是整个项目的调度中心。

核心职责：

- 管理会话发送和模型请求分发。
- 管理 Gemini Web 登录态和鉴权上下文。
- 管理浏览器控制。
- 管理远程 MCP 连接。
- 响应来自 side panel、sandbox、content scripts 的消息。
- 维护右键菜单、快捷键、保活、侧边栏作用域等扩展级能力。

关键入口：

- `background/index.js`：启动后台各个 manager。
- `background/messages.js`：总消息入口。
- `background/managers/session_manager.js`：统一对外的会话发送入口。
- `background/managers/control_manager.js`：浏览器控制。
- `background/managers/mcp_remote_manager.js`：远程 MCP 工具接入。
- `background/managers/api_bridge_manager.js`：本地 API bridge，当前属于进行中的能力。

### 4.2 `sidepanel/`

这是浏览器侧边栏宿主层，负责 Chrome side panel 容器、状态桥接以及和 sandbox iframe 的通信。

可以把它理解为：

- `sidepanel/` 负责“壳”。
- `sandbox/` 负责“真正的聊天 UI”。

### 4.3 `sandbox/`

这是主聊天界面和设置界面所在的隔离渲染层，也是前端 UI 最重的部分。

核心职责：

- 渲染聊天记录、流式消息、思考内容、工具调用卡片、图片结果。
- 渲染设置页。
- 处理用户输入、历史恢复、会话状态、下载导出等 UI 行为。
- 以隔离方式安全渲染 Markdown、LaTeX、代码块。

特点：

- 没有使用 React/Vue 这类框架，而是原生 DOM 模块化组织。
- `docs/project-guidelines/frontend-components.md` 对这里的组件更新方式有明确约束。

### 4.4 `content/`

这是注入到页面内的内容脚本层，用来把 AI 能力带进网页本身。

核心职责：

- 划词工具栏。
- 页面内快捷键触发。
- 图片识别、OCR 选区、回填表单。
- YouTube 总结等特定页面增强。
- 页面级设置同步。

这部分代码决定了项目为什么不只是“聊天插件”，而是一个真正“进入网页语境”的扩展。

### 4.5 `services/` 与 `shared/`

`services/` 主要放各类 provider 适配器与服务逻辑，`shared/` 放跨运行域共享的基础模块。

其中最关键的是：

- `services/providers/web.js`：Gemini Web 逆向驱动。
- `services/providers/official.js`：Gemini 官方 API。
- `services/providers/openai_compatible.js`：OpenAI Compatible 及多个兼容渠道的核心适配。
- `services/providers/anthropic.js`：Anthropic 原生适配。
- `shared/models/`：模型目录、Thinking 等级等跨域共享配置。
- `shared/settings/`、`shared/config/`：连接配置和默认常量。

### 4.6 `proxy/`（进行中）

这是一个 **Node 本地侧车** 方向，目标是把浏览器扩展中的 Gemini Web 能力，通过本地 WebSocket bridge 暴露成 OpenAI 兼容 HTTP 接口，供 Cherry Studio、LobeChat 一类客户端使用。

从已存在文件可推断当前目标接口至少包括：

- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`

当前可确认的约束：

- v1 设计为 **local-only**。
- v1 设计为 **text-only**。
- tools / functions / 图片 / 文件输入在代理层会明确拒绝。

但当前分支中入口文件和对外文档尚未完全收口，因此不要把它视为已经正式发布的稳定能力。

## 5. 支撑产品的三条核心技术线

### 5.1 Gemini Web 逆向链路

这是项目最有区分度、也最脆弱的一条能力线。

项目通过复用已登录的 Gemini Web 页面会话，模拟其请求参数、上传流程和 `StreamGenerate` RPC，达到“免 API Key 直接使用 Gemini Web”的效果。

相关事实和约束已经写入：

- `docs/gemini-web-reverse.md`
- `services/providers/web.js`

这条链路的最大风险不是代码复杂度，而是 **上游页面协议漂移**。因此它是项目长期维护成本最高的部分之一。

### 5.2 浏览器控制链路

项目把 `chrome.debugger`、Chrome DevTools Protocol 和页面 Accessibility Tree 组织成一套工具调用能力。

这让模型不仅能回答，还能：

- 打开/切换/关闭页面。
- 观察页面结构。
- 点击、输入、填表、按键。
- 执行自定义脚本。

这部分能力的本质，是把扩展从“聊天 UI”提升到“浏览器 Agent 执行器”。

### 5.3 MCP 工具链路

项目支持通过 SSE、streamable HTTP、WebSocket 连接外部 MCP 服务器，把第三方工具引入当前会话。

这意味着 Gemini Nexus 的定位不只是自身内建功能，而是一个 **浏览器侧 AI + 工具网络入口**。

## 6. 主要目录说明

下面是接手时最值得优先理解的目录：

| 目录          | 作用                                                               |
| :------------ | :----------------------------------------------------------------- |
| `background/` | 后台 Service Worker、总调度、会话分发、浏览器控制、MCP、扩展级消息 |
| `content/`    | 页面内容脚本、划词工具栏、页面交互能力                             |
| `sidepanel/`  | 侧边栏宿主层和 iframe 桥接                                         |
| `sandbox/`    | 聊天 UI、设置 UI、安全渲染层                                       |
| `services/`   | Provider 适配器和服务逻辑                                          |
| `shared/`     | 跨运行域共享模块                                                   |
| `settings/`   | 独立设置页入口                                                     |
| `proxy/`      | 本地 OpenAI 兼容代理侧车，当前在推进中                             |
| `scripts/`    | 打包、漂移检查、发布等脚本                                         |
| `docs/`       | 协议文档、项目规范、内部规划文档                                   |

按当前扫描结果，`background/`、`sandbox/` 和 `content/` 是最重的三个代码区块，也是理解项目复杂度的关键。

## 7. 质量、测试与构建

从 `package.json` 可见，项目已有完整的基础验证链：

- `npm run build`
- `npm exec tsc -- --noEmit`
- `npm run test`
- `npm run lint:unused`
- `npm run check`

这意味着项目在工程化层面不是“手工堆功能”，而是已经具备持续回归验证能力。

同时，仓库中存在大量 `*.test.js` 文件，测试分布在 `background/`、`sandbox/`、`services/`、`proxy/` 等区域，说明作者在重要行为回归上是有意识的。

## 8. 当前已知风险与不一致点

以下内容对接手人非常重要：

### 8.1 Gemini Web 链路天然脆弱

因为它依赖逆向协议，任何 Gemini Web 页面结构、token、RPC 或上传流程变更都可能导致链路失效。

### 8.2 Web provider 不是全功能 provider

从代码和协议文档可见，Gemini Web 当前明确存在限制：

- 非图片附件不支持。
- 历史消息编辑不支持。
- 部分 image-preview 路由被主动禁用，等待重新验证。

### 8.3 本地代理链路仍处于收口阶段

当前工作树显示这条链路正在实现，但尚未和 README、脚本入口、完整交付文档保持完全一致。

最直接的信号就是：

- `package.json` 声明了 `proxy:start`。
- 当前代码树缺少对应的 `proxy/server.js`。

### 8.4 README 有轻微滞后信息

例如 README 中的“核心库”仍写有 `Fuse.js`，但当前 `package.json` 依赖中并没有这个包。这类信息不影响主功能，但说明 README 里个别描述可能略滞后于当前工作树。

## 9. 第三方或 AI 的推荐阅读顺序

如果你是第一次接手，建议按这个顺序看：

1. `README.zh-CN.md` 或 `README.md`
2. `manifest.json`
3. `background/index.js`
4. `background/messages.js`
5. `background/managers/session_manager.js`
6. `sidepanel/index.js` 与 `sandbox/index.js`
7. `services/providers/web.js`
8. `docs/gemini-web-reverse.md`
9. `background/managers/control_manager.js`
10. `background/managers/mcp_remote_manager.js`
11. `proxy/` 目录和 `background/managers/api_bridge_manager.js`

如果你是 AI 代理，这个顺序尤其重要，因为它能帮你先建立“主调用链”，再理解每个子系统的边界。

## 10. 当前最合理的项目判断

截至 2026-07-02，可以把 Gemini Nexus 判断为：

- **一个已经可用、功能密度很高的 Chrome AI 扩展**。
- **核心卖点是 Gemini Web 逆向能力 + 浏览器控制 + MCP 工具接入**。
- **主产品面已经完成得比较成熟**。
- **当前继续推进的重点之一，是把扩展内部能力进一步外露为本地 OpenAI 兼容代理**。

如果你要继续开发，这个项目最需要的不是“从零重写”，而是：

- 继续守住 Gemini Web 漂移维护。
- 控制后台调度复杂度。
- 把进行中的代理链路收口为真正可发布的文档化能力。
- 及时同步 README、脚本入口和实际代码状态，减少信息漂移。
