// 一键启动：先把抖音解析 sidecar（docker）拉起来，再起测评后端 + web 前端。
// 用法：npm run dev
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const execFileAsync = promisify(execFile);
const SIDECAR = "http://localhost:8080";
const CONTAINER = "parse-video";
const IMAGE = "wujunwei928/parse-video";

async function sidecarUp() {
  try {
    await fetch(SIDECAR, { signal: AbortSignal.timeout(2000) });
    return true; // 能连上就算起来了（根路径可能 404，无所谓）
  } catch {
    return false;
  }
}

async function dockerCliPresent() {
  try { await execFileAsync("docker", ["--version"]); return true; }
  catch { return false; }
}

// 守护进程是否活着（CLI 在 ≠ daemon 在）。
async function daemonUp() {
  try { await execFileAsync("docker", ["info"], { timeout: 8000 }); return true; }
  catch { return false; }
}

const DESKTOP = "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe";

// daemon 没起就尝试拉起 Docker Desktop，并等它就绪（最多 ~90s）。
async function ensureDaemon() {
  if (await daemonUp()) return true;
  console.log("· Docker daemon 未运行，尝试启动 Docker Desktop…");
  try {
    spawn(DESKTOP, [], { detached: true, stdio: "ignore" }).unref();
  } catch (e) {
    console.warn(`⚠ 无法启动 Docker Desktop：${e.message.split("\n")[0]}`);
    return false;
  }
  for (let i = 0; i < 90; i++) {
    if (await daemonUp()) { console.log("✓ Docker daemon 就绪"); return true; }
    if (i % 10 === 0 && i) console.log(`  等待 Docker 启动中…（${i}s）`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.warn("⚠ Docker 90s 内没起来。抖音解析会失败，直链 + ASR + AI 仍可测。");
  return false;
}

async function ensureSidecar() {
  if (await sidecarUp()) { console.log("✓ parse-video sidecar 已在运行"); return; }
  if (!(await dockerCliPresent())) {
    console.warn("⚠ 未检测到 docker：抖音解析这步会失败，但直链 + ASR + AI 仍可测。");
    return;
  }
  if (!(await ensureDaemon())) return;
  console.log("· 启动 parse-video sidecar（docker）…");
  // 已存在同名容器就直接 start，否则 run 一个新的
  try { await execFileAsync("docker", ["start", CONTAINER]); }
  catch {
    try {
      await execFileAsync("docker", ["run", "-d", "--name", CONTAINER, "-p", "8080:8080", IMAGE]);
    } catch (e) {
      console.warn(`⚠ sidecar 启动失败：${e.message.split("\n")[0]}`);
      console.warn("  抖音解析这步会失败，直链 + ASR + AI 仍可测。");
      return;
    }
  }
  // 等它就绪（最多 ~20s）
  for (let i = 0; i < 20; i++) {
    if (await sidecarUp()) { console.log("✓ parse-video sidecar 就绪"); return; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.warn("⚠ sidecar 起了但 20s 内没响应，继续启动后端。");
}

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

await ensureSidecar();

console.log("· 启动测评后端（:6060）…");
spawn(process.execPath, ["eval/server.mjs"], { cwd: ROOT, stdio: "inherit" });

console.log("· 启动 web 前端（:3000）…\n");
spawn("npm", ["run", "dev"], {
  cwd: path.join(ROOT, "web"),
  stdio: "inherit",
  shell: process.platform === "win32",
});
