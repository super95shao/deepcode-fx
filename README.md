# DeepCode FX

Forked from [DeepCode VSCode](https://marketplace.visualstudio.com/items?itemName=vegamo.deepcode-vscode) / 派生自 DeepCode VSCode

An interactive CLI tool embedded in VSCode that helps users complete software engineering tasks with AI assistance, optimized for DeepSeek V4 models.
VSCode 内置的交互式 AI 编程助手，专为 DeepSeek V4 模型优化。

> 🧠 **Fun fact / 趣事**: This plugin was itself built with DeepSeek V4 — AI writing AI tools. How meta is that?
> 本插件就是用它自己（DeepSeek V4）开发的——AI 写 AI 工具，够套娃的吧？

## Differences from Original / 与原版的差异

| Feature / 功能                              | Original / 原版 | This Fork / 本 Fork                                                                   |
| ------------------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| 差异汇总 / Diff Summary                     | 无              | 可折叠的 `Changes` 汇总，显示 `+N -M (N files)`，每个文件有独立的增删统计和可跳转行号 |
| 差异编辑匹配 / Edit Matching                | 基础精确匹配    | 逐行标准化对比：容忍 tab/空格缩进差异、行尾空白、Read 工具行号前缀                    |
| 上下文压缩 / Context Compression            | 无              | 主动压缩对话上下文，优化 token 用量，降低 API 成本                                    |
| 余额显示 / Balance Display                  | 无              | 界面中显示 API 余额，点击余额自动跳转至 usage 页面                                    |
| 模型快捷切换 / Model Quick Switcher         | 无              | 底部工具栏下拉菜单，在 `pro` / `flash` 之间切换（同时保存到 global 和 project 配置）  |
| 思考强度快捷切换 / Reasoning Quick Switcher | 无              | 底部工具栏下拉菜单，在 `max` / `high` 之间切换                                        |
| 工作区切换 / Workspace Switching            | 无              | 跨项目浏览所有对话记录；加载其他项目的对话时显示横幅提示，一键切换工作区              |
| 设置页面 / Settings Page                    | 无              | 插件内置设置界面，支持 Global / Project 折叠分区，API key、模型、思考开关等           |
| 智能滚屏 / Smart Scrolling                  | 始终滚到底部    | 仅在用户位于底部时自动追底；初次加载和用户发消息时强制滚动                            |
| 模型支持 / Model Support                    | 多模型          | 仅 DeepSeek (V4)，代码更精简                                                          |
| 中文界面 / Chinese Localization             | 无              | 工具栏按钮在 VSCode 语言为中文时自动显示中文标签                                      |
| 扩展 ID / Extension IDs                     | `ccui.*`        | `deepcode-fx.*` — 可与原版共存                                                        |

## Requirements / 环境要求

- VSCode ^1.85.0
- A DeepSeek API key / DeepSeek API key

## Configuration / 配置

Settings are stored in two locations (project settings override global settings):
配置文件分两级（项目级覆盖全局级）：

- **Global / 全局**: `~/.deepcode/settings.json`
- **Project / 项目**: `{workspaceRoot}/.deepcode/settings.json`

Example / 示例:

```json
{
  "env": {
    "MODEL": "deepseek-v4-pro",
    "BASE_URL": "https://api.deepseek.com",
    "API_KEY": "sk-..."
  },
  "thinkingEnabled": true,
  "reasoningEffort": "max"
}
```

## Quick Operation / 快速上手

- **Toolbar dropdowns / 工具栏下拉**: Quickly switch model (`pro`/`flash`) and reasoning effort (`max`/`high`) without opening settings
- **Settings gear / 设置齿轮**: Full settings page with global, project, and workspace scopes
- **Workspace banner / 工作区横幅**: When loading a conversation from another project, a banner appears with a one-click "Switch here" button
- **Diff summary / Diff 汇总**: After each assistant response, a collapsible `Changes` section shows all file modifications with per-file line-number navigation
- **Smart scrolling / 智能滚屏**: Browsing history won't be interrupted by new messages; auto-scroll only when already at the bottom

## Build & Package / 构建与打包

```bash
# 1. Install dependencies / 安装依赖
npm install

# 2. Compile / 编译
npm run compile

# 3. Package into .vsix (requires @vscode/vsce) / 打包为 .vsix (需要 @vscode/vsce)
npm install -g @vscode/vsce
vsce package

```
