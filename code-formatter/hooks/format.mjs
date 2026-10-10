#!/usr/bin/env node
/**
 * code-formatter PostToolUse hook
 *
 * 从 stdin 读取 ZCode/Claude hook JSON（tool_name + tool_input.file_path），
 * 对刚被 AI 写入/编辑的代码文件做原地格式化。
 *
 * 设计约束：
 * - 任何失败（不支持的语言、语法错误、依赖缺失）都静默退出 0，绝不阻塞 AI 循环
 * - 只有格式化成功且内容有变化时才写回（临时文件 + rename 原子替换）
 * - 项目里有 .prettierrc 时完全按项目的来；否则用插件自带 defaults.json
 */
import { readFileSync, writeFileSync, statSync, existsSync, renameSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PLUGIN_ROOT = path.resolve(import.meta.dirname, "..");
const BUDGET_MS = 30_000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const BOM = String.fromCharCode(0xfeff);

const DEFAULTS = JSON.parse(readFileSync(path.join(PLUGIN_ROOT, "defaults.json"), "utf8"));

const killSwitch = setTimeout(() => process.exit(0), BUDGET_MS);
killSwitch.unref?.();

/* ------------------------------------------------------------------ */
/* 语言 → 引擎 路由                                                     */
/* ------------------------------------------------------------------ */

// Prettier 内置 parser 的扩展名（parser 由 prettier 按 filepath 自动推断）
const PRETTIER_BUILTIN_EXTS = new Set([
  ".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx",
  ".vue", ".html", ".htm",
  ".css", ".scss", ".sass", ".less",
  ".json", ".jsonc", ".json5",
  ".md", ".markdown", ".mdx",
  ".yaml", ".yml",
  ".graphql", ".gql",
]);

// 需要 Prettier 插件的扩展名
const PRETTIER_PLUGIN_PKG = {
  ".java": "prettier-plugin-java",
  ".php": "@prettier/plugin-php",
  ".sql": "prettier-plugin-sql",
  ".sh": "prettier-plugin-sh",
  ".bash": "prettier-plugin-sh",
  ".zsh": "prettier-plugin-sh",
  ".toml": "prettier-plugin-toml",
};

const GOFMT_EXTS = new Set([".go"]);
const CLANG_FORMAT_EXTS = new Set([".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh", ".hxx", ".cs"]);
const RUFF_EXTS = new Set([".py", ".pyi"]);
const RUSTFMT_EXTS = new Set([".rs"]);

// 跳过：生成物、依赖、锁定文件、压缩文件
const SKIP_DIR_RE = /(^|[\\/])(node_modules|\.git|\.hg|\.svn|dist|build|out|output|vendor|target|venv|\.venv|__pycache__|\.idea|\.vscode|\.next|\.nuxt|\.svelte-kit|coverage|bower_components|\.terraform)([\\/]|$)/i;
const SKIP_FILE_RE = /(^|[\\/])(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|bun\.lock|composer\.lock|Cargo\.lock|poetry\.lock|Pipfile\.lock|Gemfile\.lock|go\.sum|\.prettierignore|\.gitignore|\.clang-format|_clang-format)([\\/]|$)/i;
const SKIP_SUFFIX_RE = /(\.min\.(js|mjs|cjs|css)$|\.d\.ts$|\.lock$)/i;

function shouldSkip(file) {
  if (SKIP_DIR_RE.test(file) || SKIP_FILE_RE.test(file) || SKIP_SUFFIX_RE.test(file)) return true;
  try {
    if (statSync(file).size > MAX_FILE_BYTES) return true;
  } catch {
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* 各引擎                                                              */
/* ------------------------------------------------------------------ */

let prettierModule = null;
async function loadPrettier() {
  if (prettierModule) return prettierModule;
  try {
    prettierModule = await import("prettier");
  } catch {
    await ensureDeps();
    prettierModule = await import("prettier");
  }
  return prettierModule;
}

/** 依赖意外缺失时（安装副本不带 node_modules）做一次自动补装 */
let depsEnsured = false;
async function ensureDeps() {
  if (depsEnsured) return;
  depsEnsured = true;
  const marker = path.join(PLUGIN_ROOT, ".deps-installed");
  if (existsSync(marker)) return;
  spawnSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error"], {
    cwd: PLUGIN_ROOT,
    timeout: 90_000,
    stdio: "ignore",
    windowsHide: true,
    shell: process.platform === "win32",
  });
  try {
    writeFileSync(marker, String(Date.now()));
  } catch {
    /* 只读环境就算了 */
  }
}

/** 把插件的多种导出形态统一成 prettier 认识的 plugin 对象 */
function pickPluginModule(mod) {
  if (mod?.parsers) return mod;
  if (mod?.default?.parsers) return mod.default;
  return null;
}

async function formatWithPrettier(file, source) {
  const prettier = await loadPrettier();
  const ext = path.extname(file).toLowerCase();
  const plugins = [];
  const pkg = PRETTIER_PLUGIN_PKG[ext];
  if (pkg) {
    const mod = pickPluginModule(await import(pkg));
    if (!mod) throw new Error(`plugin ${pkg} loaded but has no parsers`);
    plugins.push(mod);
  }

  // 优先级（对齐 prettier-vscode 的行为）：项目 .prettierrc > 编辑器 settings.json 的 prettier.* > 插件 defaults.json
  let options = { ...DEFAULTS, ...loadEditorPrettierSettings() };
  try {
    const config = await prettier.resolveConfig(file);
    if (config && Object.keys(config).length > 0) options = { ...options, ...config };
  } catch {
    /* 配置文件解析失败就当没有 */
  }
  // prettier-plugin-toml（tombi 引擎）printWidth 超过 255 会解析失败
  if (ext === ".toml" && options.printWidth > 255) options = { ...options, printWidth: 255 };

  return prettier.format(source, { ...options, filepath: file, plugins });
}

/* ------------------------------------------------------------------ */
/* 读取 VS Code / Cursor / Trae 等编辑器 settings.json 里的 prettier.* 配置 */
/* ------------------------------------------------------------------ */

const EDITOR_OPTION_KEYS = new Set([
  "printWidth", "tabWidth", "useTabs", "semi", "singleQuote", "jsxSingleQuote",
  "quoteProps", "trailingComma", "bracketSpacing", "bracketSameLine", "arrowParens",
  "proseWrap", "htmlWhitespaceSensitivity", "vueIndentScriptAndStyle",
  "singleAttributePerLine", "endOfLine", "objectWrap",
]);

let editorSettingsCache;

function loadEditorPrettierSettings() {
  if (editorSettingsCache !== undefined) return editorSettingsCache;
  editorSettingsCache = {};
  const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  const base =
    process.platform === "win32"
      ? appData
      : process.platform === "darwin"
        ? path.join(os.homedir(), "Library", "Application Support")
        : path.join(os.homedir(), ".config");
  // 依次找 VS Code 系编辑器，用第一个配置了 prettier.* 的
  for (const dir of ["Code", "Code - Insiders", "Cursor", "Trae", "Trae CN", "Windsurf", "VSCodium"]) {
    const settingsPath = path.join(base, dir, "User", "settings.json");
    try {
      if (!existsSync(settingsPath)) continue;
      const parsed = JSON.parse(stripJsonc(readFileSync(settingsPath, "utf8")));
      for (const [key, value] of Object.entries(parsed)) {
        if (
          key.startsWith("prettier.") &&
          EDITOR_OPTION_KEYS.has(key.slice(9)) &&
          typeof value !== "object" &&
          value !== null
        ) {
          editorSettingsCache[key.slice(9)] = value;
        }
      }
      if (Object.keys(editorSettingsCache).length > 0) break;
    } catch {
      /* 读不了就换下一个编辑器 */
    }
  }
  return editorSettingsCache;
}

/** VS Code 的 settings.json 是 JSONC（带注释和尾逗号），先转成纯 JSON */
function stripJsonc(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  let inStr = false;
  while (i < n) {
    const c = src[i];
    if (inStr) {
      out += c;
      if (c === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

async function formatWithGofmt(source) {
  const mod = await import("@wasm-fmt/gofmt");
  return mod.format(source);
}

// clang-format 的 ColumnLimit 用 0 表示不限宽；ruff 的 line-length 上限 65535
const CLANG_COLUMN_LIMIT = DEFAULTS.printWidth > 65535 ? 0 : DEFAULTS.printWidth;
const RUFF_LINE_LENGTH = Math.min(Math.max(DEFAULTS.printWidth, 1), 65535);

const CLANG_INLINE_STYLE = `{ BasedOnStyle: Google, ColumnLimit: ${CLANG_COLUMN_LIMIT}, IndentWidth: ${DEFAULTS.tabWidth}, AccessModifierOffset: -${DEFAULTS.tabWidth}, DerivePointerAlignment: false, PointerAlignment: Left }`;

async function formatWithClang(file, source) {
  const mod = await import("@wasm-fmt/clang-format");
  // 项目里有 .clang-format / _clang-format 时用项目风格，否则用与全局预设一致的内置风格
  let style = CLANG_INLINE_STYLE;
  for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
    for (const name of [".clang-format", "_clang-format"]) {
      const candidate = path.join(dir, name);
      if (existsSync(candidate)) {
        style = readFileSync(candidate, "utf8");
        break;
      }
    }
    if (style !== CLANG_INLINE_STYLE || dir === path.parse(dir).root) break;
  }
  return mod.format(source, path.basename(file), style);
}

async function formatWithRuff(source) {
  const mod = await import("@astral-sh/ruff-wasm-nodejs");
  const workspace = new mod.Workspace(
    {
      "line-length": RUFF_LINE_LENGTH,
      "indent-width": DEFAULTS.tabWidth,
      format: { "indent-style": "space", "quote-style": DEFAULTS.singleQuote === false ? "double" : "single" },
    },
    mod.PositionEncoding.Utf16,
  );
  try {
    return workspace.format(source);
  } finally {
    try {
      workspace.free();
    } catch {
      /* already freed */
    }
  }
}

/** Rust 无 WASM 方案：机器上装有 rustfmt 才能用 */
function formatWithNativeRustfmt(source) {
  const bin = process.platform === "win32" ? "rustfmt.exe" : "rustfmt";
  const probe = spawnSync(bin, ["--version"], { timeout: 5_000, windowsHide: true });
  if (probe.error || probe.status !== 0) return null;
  const res = spawnSync(bin, ["--emit", "stdout", "--edition", "2021"], {
    input: source,
    encoding: "utf8",
    timeout: 15_000,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  return res.status === 0 ? res.stdout : null;
}

function engineFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (PRETTIER_BUILTIN_EXTS.has(ext) || PRETTIER_PLUGIN_PKG[ext])
    return { name: "prettier", run: (src) => formatWithPrettier(file, src) };
  if (GOFMT_EXTS.has(ext)) return { name: "gofmt", run: (src) => formatWithGofmt(src) };
  if (CLANG_FORMAT_EXTS.has(ext)) return { name: "clang-format", run: (src) => formatWithClang(file, src) };
  if (RUFF_EXTS.has(ext)) return { name: "ruff", run: (src) => formatWithRuff(src) };
  if (RUSTFMT_EXTS.has(ext)) return { name: "rustfmt", run: (src) => formatWithNativeRustfmt(src) };
  return null;
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */

function readStdinPayload() {
  if (process.stdin.isTTY) return null;
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return null;
  }
}

function writeAtomic(file, content) {
  const tmp = `${file}.cf-tmp-${process.pid}`;
  writeFileSync(tmp, content);
  try {
    renameSync(tmp, file);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

function emit(payload) {
  try {
    process.stdout.write(JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

async function main() {
  const payload = readStdinPayload();
  if (!payload) return;

  const input = payload.tool_input || {};
  const rawPath = input.file_path || input.notebook_path || (payload.tool_response && payload.tool_response.filePath);
  if (!rawPath || typeof rawPath !== "string") return;

  const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
  const file = path.isAbsolute(rawPath) ? rawPath : path.resolve(cwd, rawPath);
  if (shouldSkip(file)) return;

  const engine = engineFor(file);
  if (!engine) return;

  let source = readFileSync(file, "utf8");
  const hadBom = source.charCodeAt(0) === 0xfeff;
  if (hadBom) source = source.slice(1);
  if (source.trim() === "") return;

  const formatted = await engine.run(source);
  if (typeof formatted !== "string" || formatted === source) return;

  let output = formatted;
  if (hadBom && !output.startsWith(BOM)) output = BOM + output;

  writeAtomic(file, output);
  emit({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `code-formatter: 已自动格式化 ${path.basename(file)}（${engine.name}）。若接下来 Edit 的 old_string 因排版变化而匹配失败，请先重新读取该文件。`,
    },
  });
}

export { loadEditorPrettierSettings, stripJsonc };

// 只有直接运行（作为 hook）时才走主流程；被测试脚本 import 时只提供函数
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((err) => {
      try {
        process.stderr.write(`code-formatter: skipped (${(err && err.message) || err})\n`);
      } catch {
        /* ignore */
      }
    })
    .finally(() => process.exit(0));
}
