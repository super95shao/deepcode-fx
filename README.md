# DeepCode FX

Forked from [DeepCode VSCode](https://marketplace.visualstudio.com/items?itemName=vegamo.deepcode-vscode)

An interactive CLI tool embedded in VSCode that helps users complete software engineering tasks with AI assistance, optimized for DeepSeek V4 models.

> 🧠 **Fun fact**: This plugin was itself built with DeepSeek V4 — AI writing AI tools. How meta is that?

## Differences from Original

| Feature | Original | This Fork |
|---------|----------|-----------|
| Diff Summary | None | Collapsible `Changes` parent with `+N -M (N files)` per-file breakdown and clickable line numbers |
| Settings Page | None | In-plugin settings UI with Global/Project collapsible sections, API key, model, thinking toggles |
| Workspace Switching | None | Browse and load sessions across all projects; banner prompt + one-click switch when opening cross-project conversations |
| Model Quick Switcher | None | Dropdown in toolbar to switch `pro` / `flash` (saves to both global + project settings) |
| Reasoning Quick Switcher | None | Dropdown in toolbar to toggle `max` / `high` (saves to both global + project settings) |
| Line-number Jump | None | Clickable line numbers in all diff previews that open VSCode at the exact line |
| Edit Matching | Basic exact match | Added normalized line-by-line matching: tolerates tab/space indentation differences, trailing whitespace, and Read-tool line-number prefixes |
| Context Compression | None | Actively compresses conversation context to optimize token usage and reduce API costs |
| Balance Display | None | Shows API balance in the UI; clicking the balance auto-navigates to the usage page |
| Smart Scrolling | Always scroll to bottom | Auto-scroll only when user is at bottom; forced scroll on initial load and user messages only |
| Model Support | Multiple providers | DeepSeek-only (V4), simplified codebase |
| Chinese Localization | None | Toolbar buttons automatically display Chinese labels when VSCode language is Chinese |
| Extension IDs | `ccui.*` | `deepcode-fx.*` — can coexist with the original plugin |

## Requirements

- VSCode ^1.85.0
- A DeepSeek API key

## Configuration

Settings are stored in two locations (project settings override global settings):

- **Global**: `~/.deepcode/settings.json`
- **Project**: `{workspaceRoot}/.deepcode/settings.json`

Example:
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

## Quick Operation

- **Toolbar dropdowns**: Quickly switch model (`pro`/`flash`) and reasoning effort (`max`/`high`) without opening settings
- **Settings gear**: Full settings page with global, project, and workspace scopes
- **Workspace banner**: When loading a conversation from another project, a banner appears with a one-click "Switch here" button
- **Diff summary**: After each assistant response, a collapsible `Changes` section shows all file modifications with per-file line-number navigation
- **Smart scrolling**: Browsing history won't be interrupted by new messages; auto-scroll only when already at the bottom

## Build & Package

```bash
# 1. Install dependencies
npm install

# 2. Compile
npm run compile

# 3. Package into .vsix (requires @vscode/vsce)
npm install -g @vscode/vsce
vsce package

# 4. Share the generated .vsix file
```

The `.vsix` file can be installed by anyone via VSCode's `Extensions → ⋮ → Install from VSIX...`.

No network or marketplace account needed — just give your colleague the `.vsix` file.
