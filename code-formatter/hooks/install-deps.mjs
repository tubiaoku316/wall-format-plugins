// 后台依赖安装器：由 format.mjs 以独立进程方式启动（detached），不阻塞 hook
// 策略：先走默认 npm 源，失败后自动切换 npmmirror（国内加速）
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCK = path.join(ROOT, ".deps-installing");
const MARKER = path.join(ROOT, ".deps-installed");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

function npmInstall(extraArgs) {
    return spawnSync(NPM, ["install", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error", ...extraArgs], {
        cwd: ROOT,
        timeout: 10 * 60_000,
        stdio: "ignore",
        windowsHide: true,
        shell: process.platform === "win32",
    });
}

let ok = false;
try {
    ok = npmInstall([]).status === 0;
} catch {
    ok = false;
}
if (!ok) {
    try {
        ok = npmInstall(["--registry=https://registry.npmmirror.com"]).status === 0;
    } catch {
        ok = false;
    }
}

try {
    if (ok) writeFileSync(MARKER, String(Date.now()));
} finally {
    try {
        unlinkSync(LOCK);
    } catch {
        /* ignore */
    }
}
process.exit(ok ? 0 : 1);
