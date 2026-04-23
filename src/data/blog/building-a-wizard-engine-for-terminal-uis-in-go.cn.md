---
author: Lei
pubDatetime: 2026-04-21T00:00:00Z
title: 为 Go 终端 UI 构建多步向导引擎
featured: true
draft: false
tags:
  - go
  - tui
  - cli
  - bubble-tea
description: 我们如何在 Bubble Tea 之上构建一套声明式的向导引擎，用它来编排 Verda CLI 中一条 13 步的 VM 部署流程——具备依赖追踪、回退导航和 actor 模型视图。
locale: cn
translationKey: building-a-wizard-engine-for-terminal-uis-in-go
---

![Verda CLI 向导演示——一条 13 步的 VM 部署流程，带进度条、动态选项和回退导航](/images/wizard-demo.gif)

*我是 Verda Cloud 的 [verda-cli](https://github.com/verda-cloud/verda-cli) 和 [verdagostack](https://github.com/verda-cloud/verdagostack) 的作者，我们在 [Verda.com](https://verda.com) 构建 GPU 云基础设施。这篇文章要讲的，是我们在开源 CLI 工具里解决过的一个具体问题。*

## Table of contents

## 起点：问题是什么

在做 [Verda CLI](https://github.com/verda-cloud/verda-cli)——一个管理 GPU 云基础设施的命令行工具——的时候，我们遇到了一个很常见的难题：部署一台 VM 需要从用户那里收集十几个信息。地区、实例规格、操作系统镜像、SSH 密钥、存储卷、启动脚本、计费方式、合约周期……清单相当长。

简单地平铺一串提示是远远不够的。用户希望能够：

- **往回走**，去改之前填过的答案；
- **看到进度**，知道自己走到了流程的哪一步；
- **跳过**不适用的步骤（例如 spot 实例不需要选合约）；
- **根据前面的选择动态拿到选项**（可用镜像取决于实例规格）；
- **原地跑一个子流程**（比如在向导中间新建一把 SSH 密钥，不跳出当前流程）；
- **看到一份会随选择变化的费用汇总**。

我们需要一个**向导引擎**：能编排多步交互流程，带依赖追踪、回退导航和可扩展的 UI 组件。而且它必须跑在终端里。

## 为什么是 Go，而不是 React？

如果让你从零开始做一个多步的终端向导，**React 生态其实是个相当不错的选择**。[Ink](https://github.com/vadimdemedes/ink) 把 React 的声明式组件模型带进了终端——JSX、hooks、状态管理、以及整个 npm 生态，全都能直接拿来用。它在可组合性上优势巨大：一个向导步骤就是一个组件，步骤组装成流程，流程在项目之间复用。再往上叠一层 [Pastel](https://github.com/vadimdemedes/pastel) 就能加路由。Cloudflare 的 Wrangler 之类的工具，正是沿着这条路走出来的。

**那我们为什么没用？**

因为我们团队写 Go。Verda CLI 是 Go，API SDK 是 Go，共享库 `verdagostack` 也是 Go。为了 TUI 这一层引入一个 Node.js 运行时，意味着：

- 多一套构建管线和依赖树；
- 终端用户要额外装 Node.js；
- 在 Go（业务逻辑）和 TypeScript（UI）之间反复切换；
- 我们已有的 Go 包（options、logging、error types）全都复用不了。

我们希望向导引擎住在*同一个*二进制里，而不是作为一个独立进程存在。

在 Go 生态里，**[Bubble Tea](https://github.com/charmbracelet/bubbletea)** 是毋庸置疑的地基。它成熟、活跃，底层遵循 The Elm Architecture；Lip Gloss 负责样式、Bubbles 提供组件，都是扎实的原语。但 Bubble Tea 是个*框架*，不是向导工具包——它给你文本输入、列表和 spinner，不给你带依赖追踪和回退的多步流程。

Go 里其他的选项要么不行：**Survey** 已归档；**Huh** 处理的是表单，而不是带异步 loader 的动态向导。没有现成的东西能给我们一个声明式的、基于步骤的引擎。

所以我们在 Bubble Tea 之上自己写了一个。

## 小插曲：什么是 The Elm Architecture

Bubble Tea 建立在 [The Elm Architecture](https://guide.elm-lang.org/architecture/)（简称 TEA）之上——这是 Elm 语言里长出来的一种交互式程序的构建范式，后来也影响了 JavaScript 世界的 Redux。核心思想很简单，三块东西：

- **Model**——应用状态；
- **View**——把状态渲染到屏幕的函数；
- **Update**——接收消息、产生新状态的函数。

三者组成一个闭环：View 渲染 Model，用户与之交互，交互产生消息，Update 用消息算出新 Model，View 再次渲染。

在 Bubble Tea 里，它长这样：

```go
type Model struct {
    cursor  int
    choices []string
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.KeyPressMsg:
        if msg.String() == "up"   { m.cursor-- }
        if msg.String() == "down" { m.cursor++ }
    }
    return m, nil
}

func (m Model) View() string {
    // render choices with cursor indicator
}
```

这个模式在单屏场景里非常优雅——一个选择列表、一个文本输入、一个 spinner 都对。Model 持有状态，Update 处理输入，View 渲染输出，干净、可预测、易测试。正如 Elm 指南所说，这个模式是“自然涌现”的——不需要你强行套壳。

但向导不是单屏。它是一*串*屏幕，每一屏都依赖前面的答案、需要从 API 拉数据、还要把状态分享给进度条和费用汇总之类的视图。TEA 只给你一对 Model／Update，一个 13 步、带动态依赖的向导，需要的是在它之上多一层：一个管弦乐式的 orchestrator，去决定*哪个* model 是激活状态、*哪些*状态要往后传、*当前提示之外*的视图如何保持同步。

向导引擎填的就是这个缺口。

## 终端向导究竟难在哪

用 Bubble Tea 做一个单独的提示很直接。但要做一个包含 13 步、还有 API 调用、分支判断和子流程的向导，问题就开始冒出来了。

### 1. stdin 的归属问题

Bubble Tea 通过 `tea.Program` 接管终端的原始模式。一个 program，一个 stdin reader。可是在向导里，某一步的 loader 可能自己要弹一个交互式提示——比如让用户在半途创建一把新的 SSH 密钥。这就意味着会有第二个 `tea.Program` 试图去读同一个 stdin。两个程序抢输入。终端状态错乱。按键丢失。

### 2. 状态回卷

用户期望按下 Esc 就能回到上一步。但向导里的“回到上一步”不只是重新展示前一屏。你需要：

- 把绑定到前一步的那个值清掉；
- 让任何依赖这个值的缓存数据作废；
- 跳过那些被自动跳过或被 flag 固定住的步骤；
- 如果依赖变了，重新跑一遍 loader。

每一次步骤跳转都必须可完全逆转——否则陈旧的状态就会漏到后面的步骤里。

### 3. 动态依赖

可用的 OS 镜像依赖于所选实例规格。实例规格又依赖于计费方式和类型（GPU 还是 CPU）。合约选项只在非 spot 计费下才出现。这不是静态表单——流程的形状本身会跟着用户输入变化。你需要一张依赖图，而不是一个平铺的列表。

### 4. 带反馈的异步加载

每一步都可能要去 API 拉数据。不能让用户盯着一个冻住的终端发呆。你需要 spinner，可是 spinner 本身就是 Bubble Tea 程序——于是又回到了 stdin 的归属问题。

### 5. 超越提示本身的可扩展 UI

一个追踪完成度的进度条。一条展示当前键位提示的 hint bar。一份会随选择实时变化的费用汇总。这些都不是提示——它们是*视图*，会对向导状态做出反应。Bubble Tea 本身并没有为此内建模式。

## 我们造了什么

我们把这个向导引擎做成了 [verdagostack](https://github.com/verda-cloud/verdagostack)——也就是我们共享 Go 库——的一部分。设计上分四层：

```
┌─────────────────────────────────────────────┐
│  应用层（verda-cli）                         │
│  定义 Flow、Step 和自定义 View               │
├─────────────────────────────────────────────┤
│  向导引擎                                    │
│  编排步骤、管理状态、处理导航                 │
├─────────────────────────────────────────────┤
│  MessageBus + 视图（actor 模型）             │
│  ProgressView、HintBarView、自定义 view      │
├─────────────────────────────────────────────┤
│  Prompter + Status（抽象接口）               │
│  Bubbletea 后端（或测试用的 mock）           │
└─────────────────────────────────────────────┘
```

### 声明式的步骤

一个向导流程就是一个步骤列表。每一步声明它*需要什么*，引擎负责*如何做*。

```go
type Step struct {
    Name        string
    Prompt      PromptType                    // Select, TextInput, Confirm, ...
    Required    bool
    Loader      LoaderFunc                    // fetch choices (async, with spinner)
    DependsOn   []string                      // invalidate when these steps change
    ShouldSkip  func(collected map[string]any) bool
    Default     func(collected map[string]any) any
    Validate    func(value any) error
    Setter      func(value any)               // write to caller's struct
    Resetter    func()                        // clear on back/skip
    IsSet       func() bool                   // pre-filled via flag?
    Value       func() any                    // current pre-filled value
}
```

这就是关键抽象。应用层在定义一个步骤时，只需要说：“这是一个 select 提示，它依赖于 `billing-type`，这是怎么加载候选项，这是怎么校验，这是把结果写到哪。”剩下的由引擎处理。

来看一个真实例子——VM 创建里的合约步骤：

```go
wizard.Step{
    Name:      "contract",
    Prompt:    wizard.SelectPrompt,
    Required:  true,
    DependsOn: []string{"billing-type"},
    ShouldSkip: func(c map[string]any) bool {
        return c["billing-type"] == "spot"  // no contract for spot instances
    },
    Loader: func(ctx context.Context, _ tui.Prompter, status tui.Status, store *wizard.Store) ([]wizard.Choice, error) {
        choices := []wizard.Choice{
            {Label: "Pay as you go", Value: "payg"},
        }
        periods, err := withSpinner(ctx, status, "Loading contract options...", func() ([]Period, error) {
            return client.LongTerm.GetInstancePeriods(ctx)
        })
        // ... build choices from API response
        return choices, nil
    },
    Setter:   func(v any) { opts.Contract = v.(string) },
    Resetter: func() { opts.Contract = "" },
}
```

注意几点：Loader 拿到一个 `status` 用来显示 spinner，还拿到一个 `store` 用来读前面的答案；`DependsOn` 告诉引擎——如果 `billing-type` 改了，这个 loader 要重新跑；`ShouldSkip` 则直接把 spot 场景下的这一整步去掉。

### 引擎：导航是怎么工作的

引擎一步一步往下走，但它不是一个傻循环。每一步在显示给用户之前都会被评估：

- **跳过**——这一步不适用（spot 计费 → 没有合约步骤）；
- **预填**——这个值已经通过 CLI flag 给过了，不再弹提示；
- **加载并提示**——从 API 拉候选项，然后弹出来。

真正有意思的是**回退**。用户按 Esc 时，引擎不是简单地再次展示上一屏，而是会*重置*任何依赖那个答案的东西。把计费方式从预留改成 spot？合约步骤消失，实例规格候选项按 spot 价格重新加载，费用汇总也跟着更新——全部自动完成。

之所以能做到，是因为每一步都声明了自己的依赖：

```go
DependsOn: []string{"billing-type"}
```

一旦依赖变化，引擎就把下游缓存的候选项作废，下次进入时重新跑 loader。这不需要应用层管——引擎自己搞定。

有一个我们不得不处理的边角情况：如果某一步是 required、却没有任何可用候选项怎么办？用户既不能跳过，也没得选。引擎会**自动倒带**到最近的那个依赖上，好让用户去改一个更早的答案、可能解锁出一些选项。防止无限循环的守卫也在那儿。

结果就是：用户可以在一条 13 步的流程里自由前进后退，而向导始终保持自洽。

### 视图：对向导状态做出反应

向导不只是一串提示。你还想要一条进度条、一行上下文相关的键位提示、也许再加一份会实时更新的费用汇总。这些都是*视图*——会对向导状态做出反应、但本身不是提示的 UI 元素。

我们把视图建模成互相独立的 actor。每个视图只做一件事：

```go
type View interface {
    Update(msg any) (render string, publish []any)
    Subscribe() []reflect.Type
}
```

视图收到消息，返回要渲染的内容，可以选择性地再发出消息给其他视图。就这么简单。视图彼此不知道对方，也不知道引擎的内部细节，它们只是对事件做反应。

**MessageBus** 负责在引擎和视图之间派发事件。当引擎推进到新的一步，它广播一条 `StepChangedMsg`；当用户完成一步，它广播 `CollectedChangedMsg`。视图按各自关心的消息类型订阅：

- **ProgressView** 订阅 step 变化 → 更新“Step 4 of 13”以及进度条；
- **HintBarView** 订阅 step 变化 → 展示相关键位提示（“↑/↓ 导航，键入过滤，esc 回退”）；
- **SummaryView**（verda-cli 里自定义的）订阅收集值的变化 → 随着用户选择实例规格和存储，重新算出费用明细。

总线只在输出真的变了的时候才重渲染对应视图——不闪烁，也没有多余的终端写入。

这套模式让扩展变得非常容易。`verda vm create` 需要一份部署费用汇总时，我们只写了一个 `summaryView` 结构体，让它订阅值的变化、查一下定价、渲染出一张表。引擎和其他视图，一行都没改。

### 解决 stdin 的归属问题

回忆一下核心难点：Bubble Tea 的 `tea.Program` 独占 stdin，一个 program 一个 reader。可我们的向导，既有会显示 spinner 的 loader（spinner 本身就是 `tea.Program`），也有会跑交互式子流程的步骤（半路创建 SSH 密钥——又是一个提示，又是一个 program）。

我们用两种执行模式解决：

**单步一 program 模式**（默认，真实终端）：引擎为每个提示跑一个全新的 `tea.Program`。在执行某一步的 loader 之前，先停掉当前 program——把 stdin 让出来，给 loader 创建 spinner 或子提示用。Loader 跑完，再为下一步的提示启一个新 program。交接干净，没有竞争。

**持久 program 模式**（管道输入、测试）：整个向导只跑一个 `tea.Program`，搭配一个**组合模型**——一个外层 model 把所有提示都包起来，根据步骤推进切换当前激活的那个。这个模式之所以存在，是因为在管道输入下反复重启 program 会丢掉缓冲区里的字节。

```go
if e.reader != nil {
    return e.runPersistentProgram(ctx)  // pipe: one program, composite model
}
return e.runPerPromptProgram(ctx)       // terminal: fresh program per step
```

组合模型会收到 `showPromptMsg` 来切换当前提示，先处理向导级的快捷键（Ctrl+C、Esc）再把事件转发给激活的提示，并且把向导自己和当前提示的 hint bar 合并到一起。

这是整件事里最难搞对的部分。我们迭代了三次——git 历史讲得明明白白。但最终的结果是：loader 可以放心地显示 spinner、跑子提示，甚至启动嵌套的选择流程，而不会撞上 stdin 冲突。

## 做出来之后是这样

来看看一条向导流程跑起来是什么样。Verda CLI 的 `verda vm create` 命令是一个 13 步的向导：

```
$ verda vm create

 ████████████░░░░░░░░  Step 4 of 13

? Instance type
  > 1× V100 16GB — €1.23/hr
    1× A100 40GB — €2.45/hr
    8× H100 80GB — €25.60/hr

  ↑/↓ navigate  type to filter  enter select  esc back
```

用户依次选择计费方式、合约、GPU 类型、实例规格、地区、OS 镜像、存储卷、SSH 密钥、启动脚本——一路伴随着实时进度条、上下文提示，最后在确认前还能看到一份费用汇总。

在代码里定义这个流程是声明式的：

```go
flow := &wizard.Flow{
    Name: "vm-create",
    Layout: []wizard.ViewDef{
        {ID: "progress", View: wizard.NewProgressView(wizard.WithProgressPercent())},
        {ID: "hints",    View: wizard.NewHintBarView(wizard.WithHintStyle(bubbletea.HintStyle()))},
    },
    Steps: []wizard.Step{
        stepBillingType(opts),
        stepContract(getClient, opts),
        stepKind(opts),
        stepInstanceType(getClient, cache, opts),
        stepLocation(getClient, cache, opts),
        stepImage(getClient, opts),
        stepOSVolumeSize(opts),
        stepStorage(getClient, cache, opts),
        stepSSHKeys(getClient, opts),
        stepStartupScript(getClient, opts),
        stepHostname(opts),
        stepDescription(opts),
        stepConfirmDeploy(opts),
    },
}

engine := wizard.NewEngine(prompter, status, wizard.WithExitConfirmation())
engine.Run(ctx, flow)
```

每一步都是自洽的：它知道怎么加载候选项、何时跳过自己、依赖谁、结果写到哪里。增加、删除、重新排序——导航和依赖由引擎托管。

同一个引擎也驱动着 `verda auth login`（4 步）、`verda template create`（VM 流程的变体），以及我们之后任何需要的向导。它随 `verdagostack` 一起发布，任何 Go CLI 都能用。

## 重来一次，我们会做不同

**一开始就选组合模型。** 我们先做了单步一 program 模式，撞上 stdin 竞争，才回头设计的组合模型。如果一开始就把问题想清楚，我们就直接从那儿起步了。

**正式的步骤图，而不是一个列表。** 现在步骤是一个带 `DependsOn` 字符串的有序切片，做成一个正儿八经的 DAG 会让依赖求解更明确，也能支持独立步骤的并行加载。

**把子流程做成一等公民。** 我们的存储步骤在 loader 里跑了一个自己的选择循环——能工作，但这种模式应该在引擎里被设计成一级概念。

## 小结

- **Bubble Tea 是合适的地基**——但多步向导需要在它之上再加一层编排。
- **声明步骤，不要硬编码。** 把 loader、依赖和跳过条件都做成步骤定义的一部分，难的那部分就交给引擎。
- **actor 模型式的视图**让 UI 关注点解耦。加那份费用汇总时，引擎代码一行都没动。
- **stdin 的归属权是终端 UI 里最难的问题。** 提前为它留出设计余地。

这个向导引擎作为 [verdagostack](https://github.com/verda-cloud/verdagostack/tree/main/pkg/tui/wizard) 的一部分已经开源。如果你正在用 Go 做多步 CLI 流程，欢迎来看看。
