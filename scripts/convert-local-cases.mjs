// 本地批量转换：localCases/v4/**/*.json → localCases/v5/<相对目录>/<原名>.v5.json
//
// 用法：
//   node scripts/convert-local-cases.mjs                  # 递归转换 v4/ 下全部 *.json
//   node scripts/convert-local-cases.mjs demo.json other  # 只转换指定文件（可省略 .json 后缀）
//   node scripts/convert-local-cases.mjs case/app.json    # 保留案例名称目录
//   node scripts/convert-local-cases.mjs demo --ntype 5   # 显式指定案例类型
//   node scripts/convert-local-cases.mjs demo --diag      # 额外输出公式转换报错报告
//
// --diag 会在 v5 输出旁生成 <原名>.convert-errors.json / .md，
// 每条报错对应到节点 id、事件块 bid、v5 事件行 ln 与属性名。
//
// 输入既可以是裸的 4.x 案例 JSON（{ case, stage, server }），也可以是完整
// 请求体（{ action, v4CaseJson, ntype }）——后者自动取 v4CaseJson 与 ntype。
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import {
  convertV4CaseJsonToV5CaseJson,
  convertV4CaseJsonToV5CaseJsonDetailed,
  loadRuntimeMaps,
} from '../index.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const V4_DIR = path.join(repoRoot, 'localCases', 'v4');
const V5_DIR = path.join(repoRoot, 'localCases', 'v5');

function parseArgs(argv) {
  const files = [];
  let ntype;
  let diag = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--ntype') {
      ntype = Number(argv[i + 1]);
      if (!Number.isFinite(ntype)) {
        console.error(`--ntype 需要数字参数，收到: ${argv[i + 1]}`);
        process.exit(1);
      }
      i += 1;
    } else if (argv[i] === '--diag') {
      diag = true;
    } else {
      files.push(argv[i]);
    }
  }
  return { files, ntype, diag };
}

const { files: requested, ntype: cliNtype, diag } = parseArgs(process.argv.slice(2));

// ---------- --diag：公式转换报错报告 ----------

function renderDiagMarkdown(report) {
  const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const trunc = (s, n) => {
    s = String(s ?? '');
    return s.length > n ? `${s.slice(0, n)}…` : s;
  };
  const lines = [];
  const summary = report.summary;
  lines.push(`# ${report.case} 公式转换报错报告`);
  lines.push('');
  lines.push(`- 报错总数：${summary.total}，去重合并后 ${summary.uniqueTotal} 条`);
  lines.push(
    `- 其中 **降级为空值 \`{op:'val'}\`（逻辑丢失）${summary.droppedTotal} 条**；` +
      `自定义表达式（jsfn）兜底（逻辑保留）${summary.customExprTotal} 条`
  );
  lines.push('- `ln` 为 v5 事件行 id，复用 v4 事件块 `bid`；标注“拆循环”的动作行 ln 是转换时新生成的 xid');
  lines.push('- 属性名列：事件动作参数名 / 节点属性绑定名（标注 bind）');
  lines.push('');
  lines.push('## 报错类别汇总');
  lines.push('');
  lines.push('| 报错 | 次数 |');
  lines.push('| --- | ---: |');
  for (const [cat, count] of Object.entries(summary.byCategory)) {
    lines.push(`| ${esc(cat)} | ${count} |`);
  }

  const renderRows = (records) => {
    lines.push('| 次数 | 报错 | 节点 id | 节点类型·名称 | 事件块 bid（=ln） | 触发→动作 | 属性名 | 公式 code |');
    lines.push('| ---: | --- | --- | --- | --- | --- | --- | --- |');
    for (const r of records) {
      const nodeDesc = [r.nodeType, r.nodeName].filter(Boolean).join(' · ');
      const bidDesc = r.bid
        ? r.ln === r.bid ? r.bid : `${r.bid}（拆循环，ln 另生成）`
        : '（属性绑定，无事件块）';
      const trigger = [r.triggerName, r.actionName].filter(Boolean).join(' → ');
      const prop = r.prop ? (r.propKind === 'bind' ? `${r.prop}（bind）` : r.prop) : '';
      lines.push(
        `| ${r.count} | ${esc(trunc(r.message, 60))} | ${esc(r.nodeId ?? '')} | ${esc(nodeDesc)} | ${esc(bidDesc)} | ${esc(trigger)} | ${esc(prop)} | \`${esc(trunc(r.code, 100))}\` |`
      );
    }
  };

  const dropped = report.records.filter((r) => r.outcome === 'dropped');
  const customExpr = report.records.filter((r) => r.outcome === 'custom-expr');
  lines.push('');
  lines.push(`## 降级为空值的公式（逻辑丢失，${dropped.length} 条）`);
  lines.push('');
  renderRows(dropped);
  lines.push('');
  lines.push(`## 自定义表达式兜底的公式（逻辑保留为 jsfn，${customExpr.length} 条）`);
  lines.push('');
  renderRows(customExpr);
  lines.push('');
  return lines.join('\n');
}

fs.mkdirSync(V4_DIR, { recursive: true });
fs.mkdirSync(V5_DIR, { recursive: true });

function normalizeTargetName(file) {
  const withExt = file.endsWith('.json') ? file : `${file}.json`;
  const normalized = path.normalize(withExt);
  if (
    path.isAbsolute(normalized) ||
    normalized === '..' ||
    normalized.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`案例路径必须位于 localCases/v4 内: ${file}`);
  }
  return normalized;
}

function collectJsonTargets(dir, relativeDir = '') {
  const targets = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      targets.push(...collectJsonTargets(path.join(dir, entry.name), relativePath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      targets.push(relativePath);
    }
  }
  return targets;
}

const targets = requested.length
  ? requested.map(normalizeTargetName)
  : collectJsonTargets(V4_DIR).sort();

if (!targets.length) {
  console.log(`localCases/v4 下没有 .json 文件。把 4.x 案例 JSON 放进去再运行：\n  ${V4_DIR}`);
  process.exit(0);
}

loadRuntimeMaps();

let failed = 0;
for (const name of targets) {
  const inPath = path.join(V4_DIR, name);
  const outPath = path.join(
    V5_DIR,
    path.dirname(name),
    `${path.basename(name, '.json')}.v5.json`,
  );
  const started = Date.now();
  try {
    const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
    // 兼容完整请求体：取其中的 v4CaseJson / ntype
    const v4CaseJson = raw.v4CaseJson || raw;
    const ntype = cliNtype ?? raw.ntype;
    const conversion = diag
      ? convertV4CaseJsonToV5CaseJsonDetailed({ v4CaseJson, ntype })
      : {
          v5CaseJson: convertV4CaseJsonToV5CaseJson({ v4CaseJson, ntype }),
          diagnostics: null,
        };
    const { v5CaseJson } = conversion;
    // 案例产物可能很大，统一输出紧凑 JSON；诊断报告仍保留美化格式便于阅读。
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(v5CaseJson));
    const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
    console.log(
      `✔ ${name} → ${path.relative(repoRoot, outPath)} (${kb} KB, ${Date.now() - started}ms)`,
    );
    if (diag) {
      const report = { ...conversion.diagnostics, case: name };
      const jsonPath = outPath.replace(/\.v5\.json$/, '.convert-errors.json');
      const mdPath = outPath.replace(/\.v5\.json$/, '.convert-errors.md');
      fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
      fs.writeFileSync(mdPath, renderDiagMarkdown(report));
      console.log(
        `  诊断：${report.summary.total} 条公式报错（空值降级 ${report.summary.droppedTotal} · jsfn 兜底 ${report.summary.customExprTotal} · 去重 ${report.summary.uniqueTotal}）→ ${path.relative(repoRoot, mdPath)} / .json`,
      );
    }
  } catch (err) {
    failed += 1;
    console.error(`✘ ${name}: ${err.message}`);
  }
}

console.log(`完成：${targets.length - failed}/${targets.length} 成功`);
process.exit(failed ? 1 : 0);
