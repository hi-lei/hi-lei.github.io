---
author: Lei
pubDatetime: 2026-04-21T00:00:00Z
title: "Verda CLI：一个网关，三种入口——人、AI 与 IDE"
featured: true
draft: false
tags:
  - cli
  - ai-agents
  - mcp
  - infrastructure
description: 关于 verda-cli 如何演进成一个同时面向人、AI agent 和 IDE 的统一入口，以及为什么 CLI 工具可能成为 AI 时代基础设施的关键界面之一——这是我的个人视角。
locale: cn
translationKey: verda-cli-one-gateway-three-interfaces
---

_我是 [Verda Cloud](https://verda.com) 的 [verda-cli](https://github.com/verda-cloud/verda-cli) 和 [verdagostack](https://github.com/verda-cloud/verdagostack) 的作者。这篇文章是我个人的观察，不代表公司立场——讲的是我们的 CLI 如何慢慢长成了一个供人、AI agent 和 IDE 工作流共同使用的界面。_

## Table of contents

## 为什么让 CLI 站在中心

大多数人对 CLI 的印象还停留在：那是硬核开发者或终端爱好者手动敲命令的工具。我看得不一样。在我眼里，CLI 正在成为未来的一种界面形态——不仅仅是人坐在终端里用的东西，而是一层可以同时服务 AI agent 和 IDE 的基础设施。

为 Verda Cloud 构建 [verda-cli](https://github.com/verda-cloud/verda-cli) 的过程中，我逐渐感觉到，这个 CLI 已经超出了“终端工具”的范畴。人要做的操作——创建实例、查看可用性、估算费用——也正是 AI agent 要做的操作，而且越来越是 IDE 工作流要做的操作。

由此自然浮现出一个简单的心智模型：**一个网关，三种入口**。

![示意图：三种入口——终端里的人、通过 MCP 的 AI agent、以及 IDE 加智能助手——都经过 verda-cli 进入 Verda Cloud，底下以 verdagostack 作为地基。](/images/verda-cli-gateway-diagram.svg)

三个入口。一个工具。一套命令面。一层认证。在我看来，到了这一步，CLI 就不再只是开发者工具，它开始更像一个控制平面。

这并不是什么全新的想法。`aws` CLI、`gcloud`、`kubectl` 早就是这种“统一网关”的样子了。真正不一样的是 2026 年的今天——**谁在用它**。不再只是人了。AI 编码 agent——Claude Code、Cursor、Codex——正在成为基础设施工具的一等用户，这彻底改变了我思考 CLI 设计方式的角度。

## 三种入口，同一个 CLI

### 终端：既能交互，也能脚本化

最直接的用法。交互模式下，verda-cli 提供向导式流程——多步引导，带进度条、动态选项和回退导航。不用背 flag，十三步之内就能部署一台 GPU VM。

自动化场景下，同一组命令可以通过 flag 非交互地使用：

```bash
# Interactive — wizard guides you
verda vm create

# Scripted — flags for CI/CD pipelines
verda vm create \
  --kind gpu \
  --instance-type 1V100.6V \
  --location FIN-01 \
  --os ubuntu-24.04-cuda-13.0-open-docker \
  --hostname gpu-runner
```

一条命令，两种模式。向导背后是我们基于 Bubble Tea 构建的 [TUI 向导引擎](/cn/posts/building-a-wizard-engine-for-terminal-uis-in-go/)——那篇上一期的文章写的就是它。

### AI Agents：MCP 与 Agent 模式

有意思的部分从这里开始。CLI 内建了一个 [MCP](https://modelcontextprotocol.io/)（Model Context Protocol）服务器——这是一套让 AI agent 以结构化方式调用工具的标准。

```json
{
  "mcpServers": {
    "verda": {
      "command": "verda",
      "args": ["mcp", "serve"]
    }
  }
}
```

把这段加到你 AI agent 的配置里，它就能用自然语言来管理基础设施：

```
"What GPU types are available right now?"
"Deploy a V100 with 100GB storage for my training job"
"How much are my running instances costing me per hour?"
"Shut down the training VM — the job finished"
```

底下还是 agent 在调 verda-cli 的工具。同一套认证、同一组 API、同一层校验——但界面不再是命令行，而是对话。

对于直接调用 CLI（不走 MCP）的脚本和自动化 agent，还有 `--agent` 模式：

```bash
verda --agent vm list              # JSON output, no interactive prompts
verda --agent vm create ...        # structured errors for missing flags
```

`--agent` 模式保证输出是机器可读的 JSON，错误是结构化的——没有 spinner，没有颜色码，也没有会把解析器搞崩的交互式提示。

### IDE：Skills、MCP 与扩展性

开发者住在 IDE 里，我们通过三条路径把 CLI 送到他们面前：

**IDE 里的 MCP**——同一个为独立 AI agent 服务的 MCP 服务器，也能在 AI 辅助 IDE 里工作。在 Cursor、Claude Code 或任何兼容 MCP 的工具里配好它，你的 AI 编码助手就能在不离开编辑器的前提下管理基础设施。

**AI 编码技能（Skills）**——可复用的 skill 文件，教会 AI 助手如何与 Verda 和 verdagostack 框架打交道。装上一个 skill，助手就知道怎么按照你们团队的约定去脚手架一个新服务、配置部署选项、或者装可观测性。

**IDE 里的终端**——CLI 在任何内嵌终端里都能工作。VS Code、JetBrains、Warp——交互式向导和 `--agent` 模式，行为完全一致。

关键原则是：**我们不规定你怎么集成**。AI 原生工作流就用 MCP，脚手架和编码辅助就用 skills，直接控制就用终端，混着用也行。

## 地基：verdagostack

图里 verdagostack 是画在 verda-cli 底下的。它是我们的 Go 共享库——让 CLI 成为可能的那些积木，同时也是任何 Go 应用可以复用的积木。

这为什么对整个生态故事重要？因为 CLI 不是一个巨石应用，它是由一组可组合的包拼出来的：

| Package             | 作用                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| `pkg/tui`           | Prompter 和 Status 接口——把终端 UI 的具体后端抽象掉                     |
| `pkg/tui/bubbletea` | Bubble Tea 后端，内置 8 套主题                                           |
| `pkg/tui/wizard`    | 向导引擎——带依赖追踪的多步流程                                          |
| `pkg/app`           | 基于 Cobra 和 Viper 的 CLI 应用框架                                      |
| `pkg/options`       | Flag 驱动、带校验的配置结构体                                            |
| `pkg/log`           | 基于 zap 的结构化日志                                                    |
| `pkg/otel`          | OpenTelemetry 追踪与指标                                                 |
| `pkg/server`        | HTTP、gRPC 和 Gin 服务端实现                                             |
| `pkg/db`            | 数据库构造器——PostgreSQL、CockroachDB、MySQL、Valkey                     |

CLI 用的是 `pkg/tui`、`pkg/app`、`pkg/options`。但同一套库也在给后端服务供能——一个团队在 Verda Cloud 上写 gRPC 服务，用的是 `pkg/server`、`pkg/db`、`pkg/otel`——同一套模式、同一套约定、同一套日志格式。

这是刻意为之的。当 AI 编码 skill 去脚手架一个新应用时，它生成的代码用的就是 verdagostack。不管你在造一个 CLI 工具、一个 Web 服务，还是一个训练流水线的 wrapper，模式都是一致的。一个库，支撑多种应用。

## 方向：AI Agent 作为基础设施的使用者

今天的 verda-cli，主要仍是人用的工具，AI agent 是一个在快速增长的次要入口。MCP 服务器能跑，agent 模式能跑，AI 助手已经可以部署 VM、查价格、关闭实例。

但这只是起点。

### 从助手到操作者

现在，AI agent 管理基础设施是因为人让它管。“给我的训练任务部署一台 V100。”人决定做什么，agent 决定怎么做。

下一步是能**自主运转**的 agent。想象一条 ML 训练工作流：

1. Agent 发现队列里有一个新的训练任务；
2. 跨地区查 GPU 可用性和 spot 价格；
3. 部署一台匹配 GPU 类型、总价最低的可用实例；
4. 挂上带训练数据的存储卷；
5. 启动训练容器；
6. 监控进度——一旦 spot 实例被抢占，就在别处重新部署；
7. 训练完成后保存模型、销毁实例；
8. 汇报成本和结果。

例行决策不再需要人在回路里。Agent 理解约束（预算、GPU 要求、数据本地性），并据此做运维层面的选择。人定策略，agent 执行。

### 平台本身也在长大

架构图右侧正在扩展：

- **Instances**——GPU 和 CPU 虚拟机（今天）
- **Volumes**——持久化存储（今天）
- **Clusters**——用于分布式训练的多节点 GPU 集群
- **Inference**——带自动扩缩的模型推理端点
- **Containers**——托管式容器工作负载

每一种新的资源都会通过同一个网关暴露出来。加进 API，暴露到 CLI，每一个入口——终端、AI agent、IDE——自动获得访问能力。今天知道怎么部署一台实例的 agent，明天就会用同样的模式部署一个推理端点。

### 为什么 CLI 是合适的中心

让 CLI 坐在中间有一个很实际的理由：**AI agent 天生就特别擅长用 CLI 工具。**

API 要求 agent 理解认证流、请求／响应 schema、分页、错误码。Web 控制台要求 agent 具备视觉理解和像素级交互能力。而 CLI 呢？AI agent 本来就会执行命令、会读 `--help`、会解析 JSON、会用管道和脚本把命令串起来。CLI 工具是文本进、文本出——这正是语言模型的母语。

这也是为什么 MCP 这么好用。协议把 CLI 命令暴露成结构化的工具，但心智模型没有变：调一个命令，拿到结果，决定下一步做什么。能读懂 `verda instance-types --gpu` 输出的 agent，就能就价格做推理；能跑 `verda availability --location FIN-01` 的 agent，就能做部署决策。

而且 CLI 还承载着**原始 API 并不承载的领域知识**：

- **向导逻辑**——CLI 知道 spot 实例不需要合约、镜像选项取决于实例规格、存储价格随地区变化；
- **认证管理**——profile、凭据解析、token 刷新。Agent 全都免费继承；
- **可组合性**——CLI 命令天然可以串起来。Agent 把 `verda availability`、`verda vm create`、`verda ssh` 拼成一条工作流，不需要自己去封装 API；
- **结构化的错误处理**——`--agent` 模式返回机器可读的错误，告诉 agent 到底哪里错了、该怎么修。

AI agent 不需要什么特殊的 API，它们需要的是一个好的 CLI——文档清晰、行为一致、输出结构化。这正是我们在优化的方向。

### 开发体验的闭环

把开发和部署串起来，完整图景是这样：

1. 开发者在 IDE 里写代码，AI 提供辅助；
2. AI 助手用 verdagostack 的 skill 按团队约定脚手架出服务；
3. 要部署时，同一个 AI 助手通过 MCP 去开基础设施；
4. CLI 处理复杂性——GPU 选型、定价、可用性、网络；
5. 服务跑在 Verda Cloud 上，享受 verdagostack 提供的同一套可观测性栈（日志、追踪、指标）；
6. AI agent 负责监控、扩缩、以及这套运行中基础设施的日常管理。

从代码到云，每一步都有 AI 参与。CLI 是那座桥。

## 再往前看

我们的起点很朴素：让 GPU 基础设施能从终端里方便地管起来。这个目标最终长成了一个生态——一个共享库、一套交互式向导引擎、一层 MCP 集成、一组 AI 编码 skill，以及一个通过同一个界面同时服务人和 AI agent 的可扩展平台。

“开发者工具”和“AI agent 工具”之间的边界正在消失。一个设计得当的 CLI，不必在两者之间二选一。只要命令一致、输出结构化、错误可操作——人和 agent 都能把它用好。

verda-cli 是开源项目，向导引擎和共享库作为 [verdagostack](https://github.com/verda-cloud/verdagostack) 的一部分发布。如果你在做云基础设施工具——或者在想怎么让自己的 CLI 对 AI agent 更友好——欢迎来聊。
