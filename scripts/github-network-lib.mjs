import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
export function transientNetworkError(error) {
  return /SSL_ERROR_SYSCALL|SSL_connect|TLS|Failed to connect|Could not resolve|Connection (?:reset|timed out)|unable to access|unexpected EOF|HTTP (?:429|5\d\d)|\b(?:502|503|504)\b|ETIMEDOUT|ECONNRESET/i.test(`${error.message || ""}\n${error.stderr || ""}`)
    && !/non-fast-forward|Not possible to fast-forward|Authentication failed|Permission denied|401|403|404|certificate|self.signed/i.test(`${error.message || ""}\n${error.stderr || ""}`);
}

export async function githubNetwork(command, args, { cwd, env = process.env, executor = execute, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log } = {}) {
  let lastError;
  for (const [attempt, route] of ["configured", "direct", "direct-http1", "direct-http1"].entries()) {
    const childEnv = { ...env, GIT_TERMINAL_PROMPT: "0" };
    const gitOptions = ["-c", "http.lowSpeedLimit=1", "-c", "http.lowSpeedTime=20"];
    if (route !== "configured") {
      for (const key of Object.keys(childEnv)) if (/^(https?|all|no)_proxy$/i.test(key)) delete childEnv[key];
      childEnv.NO_PROXY = "github.com,api.github.com";
      gitOptions.push("-c", "http.proxy=");
    }
    if (route === "direct-http1") gitOptions.push("-c", "http.version=HTTP/1.1");
    try {
      const result = await executor(command, command === "git" ? [...gitOptions, ...args] : args, { cwd, env: childEnv, encoding: "utf8", timeout: 45_000, maxBuffer: 8 * 1024 * 1024 });
      return result.stdout || "";
    } catch (error) {
      lastError = error;
      if (!error.killed && !transientNetworkError(error)) throw error;
      log(`[github-network] ${command} ${args[0]} failed via ${route}; attempt ${attempt + 1}/4`);
      if (attempt < 3) await sleep([2000, 5000, 10000][attempt]);
    }
  }
  throw lastError;
}
