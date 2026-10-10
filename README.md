# wall-format-plugins

ZCode 插件市场（本地开发市场 / Git 市场源）。

## 包含的插件

### code-formatter 代码自动格式化

AI（ZCode）每次写入/编辑代码文件后，自动对该文件做原地格式化，无需任何手动操作。

- 支持：Vue / JS / TS / JSX / TSX / HTML / CSS / SCSS / JSON / YAML / Markdown / GraphQL / Java / PHP / SQL / Shell / TOML / Python / Go / C / C++
- 排版风格：4 空格缩进、双引号、分号、尾逗号、不按宽度折行（跟随你 VS Code / Cursor / Trae 里的 `prettier.*` 配置自动同步）
- 优先级：项目 `.prettierrc` > 编辑器 settings.json > 插件默认值
- 依赖：本机需安装 **Node.js 20+**（格式化引擎由 Node 运行；wasm 版 gofmt / clang-format / ruff 已内置，无需装 Go/LLVM/Python）

## 安装方法

1. 打开 ZCode 的 **插件市场 → 添加 → 添加插件市场**
2. 粘贴本仓库地址（Git 源）或本地解压后的目录
3. 在 **个人** 页找到「代码自动格式化」，点击 **安装**
4. 新建任务，让 AI 随便写个代码文件即可看到自动排版效果

## 更新

插件市场 → 市场源 → 刷新本市场 → 个人 → 对应插件 → 更新。

## 许可证

MIT
