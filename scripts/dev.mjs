import { existsSync, rmSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { join } from "node:path";

const appDirectory = process.cwd();
const port = process.env.PORT ?? "3000";
const nextBinary = join(appDirectory, "node_modules", ".bin", "next");

if (!existsSync(nextBinary)) {
  console.error("MedTwin dependencies are missing. Run npm install first.");
  process.exit(1);
}

const listeners = listeningPids(port);
for (const pid of listeners) {
  if (!isThisMedTwinDevServer(pid)) {
    console.error(`Port ${port} is in use by a process outside this MedTwin workspace (PID ${pid}).`);
    console.error("It was not stopped automatically. Stop that application or set PORT to another available port.");
    process.exit(1);
  }
  console.log(`Stopping existing MedTwin development server (PID ${pid})…`);
  process.kill(pid, "SIGTERM");
}

if (listeners.length) await releaseMedTwinPort(port, 3_000);

// Next can leave this lock behind if a previous development process was
// interrupted. It belongs solely to this workspace and is safe to recreate.
const lockPath = join(appDirectory, ".next", "dev", "lock");
if (existsSync(lockPath)) rmSync(lockPath, { force: true });

const child = spawn(process.execPath, [nextBinary, "dev", "--port", port], {
  cwd: appDirectory,
  stdio: "inherit",
  env: process.env,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.exit(0);
  process.exit(code ?? 1);
});

function listeningPids(targetPort) {
  try {
    return execFileSync("lsof", ["-nP", "-iTCP:" + targetPort, "-sTCP:LISTEN", "-t"], { encoding: "utf8" })
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number)
      .filter(Number.isInteger);
  } catch {
    return [];
  }
}

function isThisMedTwinDevServer(pid) {
  try {
    const command = execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
    if (!/(?:next(?:\s+dev)?|next-server)/.test(command)) return false;
    const cwd = execFileSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { encoding: "utf8" })
      .split("\n")
      .find((line) => line.startsWith("n"))
      ?.slice(1);
    return cwd === appDirectory;
  } catch {
    return false;
  }
}

async function releaseMedTwinPort(targetPort, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (listeningPids(targetPort).length === 0) return;
    await delay(100);
  }

  const remaining = listeningPids(targetPort);
  for (const pid of remaining) {
    if (!isThisMedTwinDevServer(pid)) {
      console.error(`Port ${targetPort} became occupied by an unrelated process (PID ${pid}).`);
      process.exit(1);
    }
    console.log(`Force-stopping unresponsive MedTwin development server (PID ${pid})…`);
    process.kill(pid, "SIGKILL");
  }

  const forceDeadline = Date.now() + 1_000;
  while (Date.now() < forceDeadline) {
    if (listeningPids(targetPort).length === 0) return;
    await delay(100);
  }
  console.error(`MedTwin development server did not release port ${targetPort} in time.`);
  process.exit(1);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
