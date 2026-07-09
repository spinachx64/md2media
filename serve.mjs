#!/usr/bin/env node
// 本地预览服务：左边选文件/主题，右边实时渲染，一键复制到公众号。
//
// 用法:
//   node serve.mjs [--port 5333] [--dir ..]
//
// 打开 http://localhost:5333 ，选一篇文章和主题，看效果，点“复制”按钮
// 把富文本写入剪贴板，直接粘贴进公众号编辑器。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, listThemes, listThemesWithColor } from './render.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { port: 5333, dir: path.resolve(__dirname, '..') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port' || argv[i] === '-p') args.port = Number(argv[++i]);
    else if (argv[i] === '--dir' || argv[i] === '-d') args.dir = path.resolve(argv[++i]);
  }
  return args;
}

const { port, dir } = parseArgs(process.argv.slice(2));

// 递归列出 dir 下的 .md 文件（跳过 node_modules / 隐藏目录），返回相对路径
function listMarkdown(root) {
  const out = [];
  function walk(d) {
    for (const name of fs.readdirSync(d)) {
      if (name.startsWith('.') || name === 'node_modules') continue;
      const full = path.join(d, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (name.endsWith('.md')) out.push(path.relative(root, full));
    }
  }
  walk(root);
  return out.sort();
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// 防目录穿越：请求的文件必须落在 dir 内部
function safeResolve(root, rel) {
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
    return;
  }

  if (url.pathname === '/api/files') {
    return json(res, 200, { files: listMarkdown(dir), themes: listThemesWithColor() });
  }

  if (url.pathname === '/api/render') {
    const rel = url.searchParams.get('file') || '';
    const theme = url.searchParams.get('theme') || 'mint-terminal';
    const full = safeResolve(dir, rel);
    if (!full || !fs.existsSync(full)) return json(res, 404, { error: '文件不存在' });
    try {
      const md = fs.readFileSync(full, 'utf8');
      return json(res, 200, { html: render(md, theme) });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  res.writeHead(404); res.end('Not found');
});

// 预览页前端：左侧控制栏 + 右侧“公众号预览”，轮询式实时刷新 + 复制按钮
const PAGE = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>md2media 预览</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "PingFang SC", sans-serif; display: flex; height: 100vh; background: #f0f2f5; }
  #side { width: 280px; padding: 16px; background: #fff; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
  #side h1 { font-size: 15px; margin: 0 0 4px; color: #111; }
  #side label { font-size: 12px; color: #666; display: block; margin-bottom: 6px; }
  button { width: 100%; padding: 8px; font-size: 13px; border-radius: 6px; cursor: pointer; background: #07c160; color: #fff; border: none; font-weight: 600; }
  button:hover { background: #06ad56; }
  #status { font-size: 12px; color: #888; min-height: 16px; }
  #main { flex: 1; overflow-y: auto; display: flex; justify-content: center; align-items: flex-start; padding: 24px; }
  /* 模拟公众号内容宽度 */
  #frame { width: 677px; max-width: 100%; background: #fff; padding: 20px; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }

  /* 目录树：文件夹可收起/展开，点文件选文章 */
  #tree { font-size: 13px; line-height: 1.5; user-select: none; max-height: 42vh; overflow-y: auto; border: 1px solid #eef0f2; border-radius: 6px; padding: 4px; }
  .node { border-radius: 4px; }
  .dir-row, .file-row { display: flex; align-items: center; gap: 4px; padding: 4px 6px; cursor: pointer; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dir-row:hover, .file-row:hover { background: #f2f4f7; }
  .caret { display: inline-block; width: 12px; color: #999; transition: transform .12s; flex: none; }
  .node.collapsed > .children { display: none; }
  .node.collapsed > .dir-row .caret { transform: rotate(-90deg); }
  .children { margin-left: 14px; }
  .file-row.active { background: #07c160; color: #fff; }
  .file-row .name { overflow: hidden; text-overflow: ellipsis; }
  .icon { flex: none; }

  /* 主题色块：平铺，悬停显示主题名 */
  #themes { display: flex; flex-wrap: wrap; gap: 8px; }
  .swatch { width: 34px; height: 34px; border-radius: 8px; cursor: pointer; border: 2px solid transparent; box-shadow: 0 1px 2px rgba(0,0,0,.12); transition: transform .1s; }
  .swatch:hover { transform: scale(1.08); }
  .swatch.active { border-color: #111; box-shadow: 0 0 0 2px #fff, 0 0 0 4px #111; }
</style>
</head>
<body>
  <div id="side">
    <h1>md2media 预览</h1>
    <div>
      <label>文章</label>
      <div id="tree"></div>
    </div>
    <div>
      <label>主题</label>
      <div id="themes"></div>
    </div>
    <button id="copy">复制到公众号</button>
    <div id="status"></div>
    <div style="font-size:11px;color:#aab;line-height:1.6;margin-top:auto">
      改完 md 直接切回来会自动刷新。<br>点“复制”后粘贴进公众号编辑器即带样式。
    </div>
  </div>
  <div id="main"><div id="frame">选择一篇文章…</div></div>

<script>
const $tree = document.getElementById('tree');
const $themes = document.getElementById('themes');
const $frame = document.getElementById('frame');
const $status = document.getElementById('status');
let lastHtml = '';

// 选中状态：文章路径 + 主题名，都存 localStorage，刷新后恢复
const LS_FILE = 'md2media.file';
const LS_THEME = 'md2media.theme';
const LS_COLLAPSED = 'md2media.collapsed'; // 收起的文件夹路径集合
let curFile = localStorage.getItem(LS_FILE) || '';
let curTheme = localStorage.getItem(LS_THEME) || '';
let collapsed = new Set(JSON.parse(localStorage.getItem(LS_COLLAPSED) || '[]'));

// 扁平的相对路径列表 → 嵌套目录树 { dirs: Map, files: [] }
function buildTree(files) {
  const root = { dirs: new Map(), files: [] };
  for (const rel of files) {
    const parts = rel.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { dirs: new Map(), files: [] });
      node = node.dirs.get(parts[i]);
    }
    node.files.push({ name: parts[parts.length - 1], path: rel });
  }
  return root;
}

// 递归渲染一个目录节点为 DOM，dirPath 是当前目录的完整相对路径
function renderNode(node, dirPath) {
  const frag = document.createDocumentFragment();
  // 文件夹在前，按名称排序
  const dirNames = [...node.dirs.keys()].sort();
  for (const name of dirNames) {
    const full = dirPath ? dirPath + '/' + name : name;
    const wrap = document.createElement('div');
    wrap.className = 'node' + (collapsed.has(full) ? ' collapsed' : '');

    const row = document.createElement('div');
    row.className = 'dir-row';
    row.innerHTML = '<span class="caret">▾</span><span class="icon">📁</span><span class="name">' + name + '</span>';
    row.onclick = () => {
      if (collapsed.has(full)) collapsed.delete(full); else collapsed.add(full);
      localStorage.setItem(LS_COLLAPSED, JSON.stringify([...collapsed]));
      wrap.classList.toggle('collapsed');
    };
    wrap.appendChild(row);

    const children = document.createElement('div');
    children.className = 'children';
    children.appendChild(renderNode(node.dirs.get(name), full));
    wrap.appendChild(children);
    frag.appendChild(wrap);
  }
  // 文件
  for (const f of node.files) {
    const row = document.createElement('div');
    row.className = 'file-row' + (f.path === curFile ? ' active' : '');
    row.dataset.path = f.path;
    row.innerHTML = '<span class="icon">📄</span><span class="name">' + f.name + '</span>';
    row.onclick = () => selectFile(f.path);
    frag.appendChild(row);
  }
  return frag;
}

function selectFile(path) {
  curFile = path;
  localStorage.setItem(LS_FILE, path);
  for (const el of $tree.querySelectorAll('.file-row')) {
    el.classList.toggle('active', el.dataset.path === path);
  }
  renderNow();
}

// 展开包含当前文章的所有父级文件夹，保证刷新后能看到高亮项
function expandTo(path) {
  const parts = path.split('/');
  let acc = '';
  for (let i = 0; i < parts.length - 1; i++) {
    acc = acc ? acc + '/' + parts[i] : parts[i];
    collapsed.delete(acc);
  }
  localStorage.setItem(LS_COLLAPSED, JSON.stringify([...collapsed]));
}

function renderThemes(themes) {
  $themes.innerHTML = '';
  for (const t of themes) {
    const sw = document.createElement('div');
    sw.className = 'swatch' + (t.name === curTheme ? ' active' : '');
    sw.style.background = t.color;
    sw.title = t.name;
    sw.onclick = () => {
      curTheme = t.name;
      localStorage.setItem(LS_THEME, t.name);
      for (const el of $themes.querySelectorAll('.swatch')) el.classList.remove('active');
      sw.classList.add('active');
      renderNow();
    };
    $themes.appendChild(sw);
  }
}

async function loadLists() {
  const r = await fetch('/api/files').then(r => r.json());
  const files = r.files;
  const themes = r.themes;

  // 恢复上次选择：文件不存在则退回第一篇；主题同理
  if (!files.includes(curFile)) curFile = files[0] || '';
  if (!themes.some(t => t.name === curTheme)) curTheme = (themes[0] && themes[0].name) || '';

  if (curFile) expandTo(curFile);
  $tree.innerHTML = '';
  $tree.appendChild(renderNode(buildTree(files), ''));
  renderThemes(themes);
}

async function renderNow() {
  if (!curFile) return;
  const r = await fetch('/api/render?file=' + encodeURIComponent(curFile) + '&theme=' + encodeURIComponent(curTheme)).then(r => r.json());
  if (r.error) { $status.textContent = '出错: ' + r.error; return; }
  lastHtml = r.html;
  $frame.innerHTML = r.html;
  $status.textContent = '已渲染 ' + new Date().toLocaleTimeString();
}

// 窗口重新聚焦时自动刷新，方便边改 md 边看
window.addEventListener('focus', renderNow);

// 关键：剪贴板必须同时写入 text/html 和 text/plain 两份。
// 微信粘贴时用 text/plain 判断原始换行、用 text/html 拿样式；只给 text/html
// 会走降级重排、丢换行。text/plain 用 innerText（保留渲染后的真实换行）。
// 这就是 mdnice 剪贴板能同时粘进记事本(纯文本)和公众号(富文本)的原因。
document.getElementById('copy').onclick = async () => {
  if (!lastHtml) return;
  try {
    const htmlBlob = new Blob([lastHtml], { type: 'text/html' });
    const textBlob = new Blob([$frame.innerText], { type: 'text/plain' });
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob }),
    ]);
    $status.textContent = '已复制（含纯文本+富文本），去公众号粘贴吧';
  } catch (e) {
    $status.textContent = '复制失败: ' + e.message;
  }
};

loadLists().then(renderNow);
</script>
</body>
</html>`;

server.listen(port, () => {
  console.log(`md2media 预览: http://localhost:${port}`);
  console.log(`文章目录: ${dir}`);
  console.log(`可用主题: ${listThemes().join(', ')}`);
});
