# 代码自动格式化 · code-formatter

> **让 AI 写出的每一行代码，都像精心排版过的一样。**

一个 ZCode 插件：AI 帮你写完代码的瞬间，它就默默把代码排版整齐——你什么都不用做，打开文件永远是干净的。

![Node](https://img.shields.io/badge/Node.js-20%2B-green) ![License](https://img.shields.io/badge/License-MIT-blue) ![Platform](https://img.shields.io/badge/平台-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

---

## 🤔 为什么你需要它？

**如果你是刚入门的小白：**
不会配置编辑器的格式化？不知道什么是 Prettier？没关系，装上它就"治好了"。AI 写出来的代码自动统一成规范的排版：缩进整齐、引号统一、该换行的地方换行。你只需要专注写功能，代码颜值插件包了。

**如果你是带团队的佬：**
团队里每人一个编辑器配置，提交历史里一半是"格式化打架"？装上它，所有经 AI 之手的代码都是同一套风格，diff 干净、review 轻松。已有的 `.prettierrc` 它会优先遵守，不会推翻你项目的规范。

**如果你是重度玩家：**
100% 本地运行（代码不外传）、WASM 内置 Go / C++ / Python 格式化引擎（不装工具链也能格式化）、自动读取你 VS Code / Cursor / Trae 里的 prettier 配置、项目级 `.prettierrc` 优先——所有规则都可定制。

## ✨ 效果一览

AI 生成的"狂野"代码，落盘即被驯服：

```tsx
// ✍️ AI 刚写出来的样子
import React,{useState}from "react"
export default function Counter(){const [n,setN]=useState(0);return (<div onClick={()=>setN(n+1)} className="box">{n}</div>)}
```

```tsx
// ⚡ 插件格式化后（0.1 秒内自动完成，无需任何操作）
import React, { useState } from "react";

export default function Counter() {
    const [n, setN] = useState(0);
    return (
        <div onClick={() => setN(n + 1)} className="box">
            {n}
        </div>
    );
}
```

## 📦 三步安装

1. 打开 ZCode 的 **插件市场 → 添加 → 添加插件市场**
2. 粘贴：`https://github.com/tubiaoku316/wall-format-plugins`
3. 在 **个人** 页找到「代码自动格式化」，点 **安装**，新建任务即可体验

> 唯一前提：电脑上装有 [Node.js](https://nodejs.org/) 20 或更高版本。
> 首次使用会自动在后台安装格式化引擎（约 1~3 分钟，一次性），之后即点即用。

## 🧩 支持的语言

| 场景 | 语言 |
|---|---|
| 前端 / 全栈 | **Vue** · JavaScript · **TypeScript** · JSX / TSX（**React**）· HTML · CSS / SCSS / Less · JSON · YAML · Markdown · GraphQL |
| 后端 / 通用 | **Java** · **Python** · **Go** · PHP · SQL · Shell · TOML · C / C++ |

> 格式化引擎全部本地运行：Python / Go / C++ 采用 WASM 版格式化器，**无需安装 Python、Go 或 LLVM**。

## 🛠️ 想改风格？处处可配

| 你想 | 怎么做 |
|---|---|
| 全局换一套风格 | 在 VS Code 等编辑器的 settings.json 里改 `prettier.*` 配置，插件**自动跟随** |
| 只给某个项目换 | 项目根目录放一个 `.prettierrc`，它的优先级最高 |
| 改插件兜底默认值 | 编辑插件目录下的 `defaults.json` |

优先级：**项目 `.prettierrc` > 编辑器配置 > 插件默认值**（与 prettier-vscode 行为一致）

## 🔒 隐私与安全

- 格式化 **100% 在本地完成**，代码不会被上传到任何服务器
- 有语法错误的半成品文件自动跳过，绝不阻塞 AI 对话
- `node_modules`、锁定文件、压缩文件、超大文件自动识别并跳过

## 📄 许可证

MIT · 欢迎 Issue 与 PR
