# code-formatter 代码自动格式化插件

AI（ZCode）每次 **写入 / 编辑（Write / Edit / MultiEdit）** 代码文件后，hook 自动对该文件做原地格式化。无需手动触发，格式失败的文件（如有语法错误的半成品）会静默跳过，绝不阻塞对话。

## 支持的语言与格式化引擎

| 语言 | 扩展名 | 引擎 |
|---|---|---|
| JS / TS / JSX / TSX | js mjs cjs jsx ts mts cts tsx | Prettier 内置 |
| Vue 单文件组件 | vue | Prettier 内置 |
| HTML / CSS / SCSS / Less | html htm css scss sass less | Prettier 内置 |
| JSON / YAML / Markdown / GraphQL | json jsonc json5 yaml yml md mdx graphql gql | Prettier 内置 |
| Java | java | prettier-plugin-java |
| PHP | php | @prettier/plugin-php |
| SQL | sql | prettier-plugin-sql |
| Shell | sh bash zsh | prettier-plugin-sh |
| TOML | toml | prettier-plugin-toml |
| Python | py pyi | Ruff（WASM，无需装 Python） |
| Go | go | gofmt（WASM，无需装 Go） |
| C / C++ | c h cc cpp cxx h hh hpp | clang-format（WASM，无需装 LLVM） |
| C#（实验） | cs | clang-format（WASM） |
| Rust | rs | 需机器上装有 rustfmt，否则自动跳过 |

> Kotlin 暂不支持：社区 prettier-plugin-kotlin 与 Prettier 3.9 不兼容（运行报错），后续插件修复后再加入。

## 排版规则

优先级（对齐 prettier-vscode 的行为）：**项目 `.prettierrc` > 编辑器 settings.json 的 `prettier.*` 配置 > 插件 defaults.json**

插件会自动读取本机这些编辑器的用户设置（读到第一个有 `prettier.*` 配置的为止），你在编辑器里改规则，插件自动跟随：
VS Code / VS Code Insiders / Cursor / Trae / Trae CN / Windsurf / VSCodium

没有项目配置、也没装上述编辑器时，使用 defaults.json 的默认值：

- **不限行宽**（`printWidth: 10000000000`，与常见编辑器「不按宽度折行」用法一致）
- 缩进 **4 空格**
- **双引号、有行尾分号**、尾逗号（Prettier v3 默认）
- JSX/HTML 右括号与最后一个属性同行（`bracketSameLine: true`）
- `htmlWhitespaceSensitivity: ignore`、Vue `<script>/<style>` 不额外缩进
- 换行符统一 `lf`（Git 自动转换，Windows 无碍）

各格式化引擎的行宽做了兼容钳制：Ruff 上限 65535，clang-format 超限时用 0（不限宽），TOML（tombi 引擎）上限 255。

## 修改默认排版

推荐直接在编辑器（如 VS Code）的 settings.json 里改 `prettier.*` 配置，插件自动同步。也可以编辑本插件目录下 [`defaults.json`](defaults.json)（改动后到插件市场刷新并更新插件即可生效）。项目里的 `.prettierrc` 优先级最高，适合单个项目用不同规则。

## 自动跳过的文件

`node_modules`、`dist`、`build`、`target`、`.git` 等目录；`package-lock.json`、`pnpm-lock.yaml`、`Cargo.lock`、`*.min.js` 等锁定/压缩文件；超过 2MB 的文件；不支持的扩展名。
