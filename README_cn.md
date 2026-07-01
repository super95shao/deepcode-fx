# DeepCode FX

Forked from [DeepCode VSCode](https://marketplace.visualstudio.com/items?itemName=vegamo.deepcode-vscode)

DeepCode FX 是基于 DeepCode VSCode 的增强 fork，在保留原版功能的基础上，增加了大量 UI 和交互优化。

> 🧠 **趣事**：本插件就是用它自己（DeepSeek V4）开发的——AI 在写 AI 工具，够套娃的吧？

## 与原版的差异

| 功能 | 原版 | 本 Fork |
|------|------|---------|
| Diff 汇总 | 无 | 可折叠的 `Changes` 汇总，显示 `+N -M (N files)`，每个文件有独立的增删统计和可点击行号 |
| 设置页面 | 无 | 插件内置设置界面，支持 Global / Project 折叠分区，API key、模型、思考开关等 |
| 工作区切换 | 无 | 跨项目浏览所有对话记录；加载其他项目的对话时显示横幅提示，一键切换工作区 |
| 模型快捷切换 | 无 | 底部工具栏下拉菜单，在 `pro` / `flash` 之间切换（同时保存到 global 和 project 配置） |
| 思考强度快捷切换 | 无 | 底部工具栏下拉菜单，在 `max` / `high` 之间切换 |
| 行号跳转 | 无 | 所有 diff 预览中的行号皆可点击，直接打开 VSCode 对应文件并跳转到该行 |
| Diff 编辑匹配 | 基础精确匹配 | 逐行标准化对比：容忍 tab/空格缩进差异、行尾空白、Read 工具行号前缀 |
| 上下文压缩 | 无 | 主动压缩对话上下文，优化 token 用量，降低 API 成本 |
| 余额显示 | 无 | 界面中显示 API 余额，点击余额自动跳转至 usage 页面 |
| 智能滚屏 | 始终滚到底部 | 仅在用户位于底部时自动追底；初次加载和用户发消息时强制滚动 |
| 模型支持 | 多模型 | 仅 DeepSeek (V4)，代码更精简 |
| 中文界面 | 无 | 工具栏按钮在 VSCode 语言为中文时自动显示中文标签 |
| 扩展 ID | `ccui.*` | `deepcode-fx.*` — 可与原版共存 |

## 环境要求

- VSCode ^1.85.0
- DeepSeek API key

## 配置

配置文件分两级（项目级覆盖全局级）：

- **全局**: `~/.deepcode/settings.json`
- **项目**: `{工作区根目录}/.deepcode/settings.json`

示例：
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

## 快速上手

- **工具栏下拉菜单**：切换模型和思考强度无需打开设置页
- **设置齿轮**：管理全局/项目配置和工作区路径
- **工作区横幅**：打开其他项目的对话时，顶部横幅提示，点击 `Switch here` 一键切换
- **Diff 汇总**：每次回复后，折叠的 `Changes` 区域显示所有文件修改，每个文件标注 +/-
- **智能滚屏**：查看旧消息不会被新消息打断

## 构建与打包

```bash
# 1. 安装依赖
npm install

# 2. 编译
npm run compile

# 3. 打包为 .vsix（需要 @vscode/vsce）
npm install -g @vscode/vsce
vsce package

# 4. 分享生成的 .vsix 文件
```

其他人拿到 `.vsix` 文件后，通过 VSCode 的 `扩展 → ⋮ → Install from VSIX...` 安装即可。

不需要市场上架，也不需要联网账号，直接把 `.vsix` 发给同事就行。
