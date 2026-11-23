const fs = require("node:fs");
const path = require("node:path");

const owner = "DpGhostCat";
const repo = "-";
const token = process.env.XUNYE_GITHUB_TOKEN;
const root = path.resolve(__dirname, "..");
const apiBase = "https://api.github.com";

if (!token) {
  console.error("XUNYE_GITHUB_TOKEN is required.");
  process.exit(1);
}

function request(url, options = {}) {
  return (async () => {
    let lastError;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "xunye-release-publisher",
            ...(options.headers || {}),
          },
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`${options.method || "GET"} ${url} -> ${response.status}: ${body}`);
        }
        if (response.status === 204) return null;
        return response.json();
      } catch (error) {
        lastError = error;
        if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 700));
      }
    }
    throw lastError;
  })();
}

function gitJson(url, method = "GET", body) {
  return request(`${apiBase}${url}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

function shouldPublish(relativePath) {
  if (relativePath.startsWith(".git/")) return false;
  if (relativePath.startsWith(".runtime/")) return false;
  if (relativePath.startsWith("data/") && relativePath !== "data/.gitkeep") return false;
  if (relativePath.startsWith("release/windows-stage/")) return false;
  if (relativePath === "release/Xunye-Windows-Setup.exe") return false;
  if (relativePath === "release/Xunye-Windows-x64.zip") return false;
  if (relativePath.startsWith("release/~")) return false;
  return true;
}

function collectFiles(directory, prefix = "") {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolute, relative));
    } else if (entry.isFile() && shouldPublish(relative)) {
      files.push({ relative, absolute });
    }
  }
  return files;
}

async function runLimited(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

async function ensureRelease(commitSha) {
  try {
    return await gitJson(`/repos/${owner}/${repo}/releases/tags/v1.0.0`);
  } catch (error) {
    if (!String(error.message).includes("-> 404")) throw error;
  }
  return gitJson(`/repos/${owner}/${repo}/releases`, "POST", {
    tag_name: "v1.0.0",
    target_commitish: commitSha,
    name: "寻页 XUNYE v1.0.0",
    body: [
      "寻页首个可安装版本。",
      "",
      "### Windows",
      "- `Xunye-Windows-Setup.exe`：安装到当前用户目录，创建桌面快捷方式。",
      "- `Xunye-Windows-x64.zip`：免安装版本，解压后运行 `Xunye.vbs`。",
      "",
      "安装包内置 Node.js 运行时和 SQLite 数据库，无需另外安装环境。",
      "默认运行在 `http://127.0.0.1:3777`，手机端和管理端均已包含。",
      "",
      "演示账号：`reader`、`author`、`admin`，密码均为 `123456`。",
    ].join("\n"),
    draft: false,
    prerelease: false,
  });
}

async function uploadAsset(release, fileName, contentType) {
  const absolute = path.join(root, "release", fileName);
  if (!fs.existsSync(absolute)) {
    console.log(`Skip missing release asset: ${fileName}`);
    return null;
  }
  console.log(`Uploading release asset: ${fileName}`);
  const response = await fetch(
    `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(fileName)}`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "xunye-release-publisher",
      },
      body: fs.readFileSync(absolute),
    },
  );
  if (!response.ok) {
    throw new Error(`Upload ${fileName} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function main() {
  const account = await gitJson("/user");
  if (account.login.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(`Authenticated as ${account.login}, expected ${owner}`);
  }
  console.log(`Authenticated as ${account.login}`);

  const repository = await gitJson(`/repos/${owner}/${repo}`);
  const branch = repository.default_branch;
  const ref = await gitJson(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  const parentCommitSha = ref.object.sha;
  const parentCommit = await gitJson(`/repos/${owner}/${repo}/git/commits/${parentCommitSha}`);
  const files = collectFiles(root).sort((left, right) => left.relative.localeCompare(right.relative));
  console.log(`Preparing ${files.length} source files...`);

  const blobs = new Array(files.length);
  let completed = 0;
  await runLimited(files, 4, async (file, index) => {
    const blob = await gitJson(`/repos/${owner}/${repo}/git/blobs`, "POST", {
      content: fs.readFileSync(file.absolute).toString("base64"),
      encoding: "base64",
    });
    blobs[index] = {
      path: file.relative,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    };
    completed += 1;
    if (completed % 10 === 0 || completed === files.length) {
      console.log(`  ${completed}/${files.length}`);
    }
  });

  const tree = await gitJson(`/repos/${owner}/${repo}/git/trees`, "POST", {
    base_tree: parentCommit.tree.sha,
    tree: blobs,
  });
  const commit = await gitJson(`/repos/${owner}/${repo}/git/commits`, "POST", {
    message: "feat: complete Xunye reading platform and Windows installer",
    tree: tree.sha,
    parents: [parentCommitSha],
  });
  await gitJson(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, "PATCH", {
    sha: commit.sha,
    force: false,
  });
  console.log(`Code published: https://github.com/${owner}/${repo}/commit/${commit.sha}`);

  const release = await ensureRelease(commit.sha);
  const existingAssets = await gitJson(`/repos/${owner}/${repo}/releases/${release.id}/assets`);
  const existingNames = new Set(existingAssets.map((asset) => asset.name));

  for (const [fileName, contentType] of [
    ["Xunye-Windows-Setup.exe", "application/vnd.microsoft.portable-executable"],
    ["Xunye-Windows-x64.zip", "application/zip"],
  ]) {
    if (existingNames.has(fileName)) {
      console.log(`Release asset already exists: ${fileName}`);
      continue;
    }
    await uploadAsset(release, fileName, contentType);
  }

  console.log(`Release: https://github.com/${owner}/${repo}/releases/tag/v1.0.0`);
  console.log(`Download: https://github.com/${owner}/${repo}/releases/latest`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
