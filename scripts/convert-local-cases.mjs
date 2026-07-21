// 本地批量转换：localCases/v4/*.json → localCases/v5/<原名>.v5.json
//
// 用法：
//   node scripts/convert-local-cases.mjs                  # 转换 v4/ 下全部 *.json
//   node scripts/convert-local-cases.mjs demo.json other  # 只转换指定文件（可省略 .json 后缀）
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
import { convertV4CaseJsonToV5CaseJson, loadRuntimeMaps } from '../index.js';
import {
  enableConvertDiag,
  disableConvertDiag,
  getDiagRecords,
} from '../v4ToV5/utils/convertDiag.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const V4_DIR = path.join(__dirname, '..', 'localCases', 'v4');
const V5_DIR = path.join(__dirname, '..', 'localCases', 'v5');

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

// 遍历案例节点树，建立 id → { type, name } 索引（节点名在 uis.name）。
// 节点树除 children 外还挂在 classes（自定义组件类定义）下。
function collectNodeIndex(v4CaseJson) {
  const map = new Map();
  const walkNode = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.id) map.set(node.id, { type: node.type, name: node.uis?.name });
    for (const child of node.children || []) walkNode(child);
    for (const child of node.classes || []) walkNode(child);
  };
  for (const key of ['stage', 'server', 'case']) walkNode(v4CaseJson?.[key]);
  return map;
}

// 遍历所有事件树，建立 bid → 事件块信息 索引
function collectBlockIndex(v4CaseJson) {
  const map = new Map();
  const walkBlock = (block, eventNodeId) => {
    if (!block || typeof block !== 'object') return;
    if (block.bid) {
      map.set(block.bid, {
        blockType: block.type,
        triggerName: block.triggerName,
        actionName: block.action?.name,
        object: block.object,
        eventNodeId,
        // 画布多对象动作转换时拆成循环块，动作行 ln 改用新生成的 xid（bid 归拆出的循环行）
        lnIsRegenerated: ['multiObjs', 'randMultiObjs'].includes(block.object),
      });
    }
    for (const child of block.children || []) walkBlock(child, eventNodeId);
  };
  const walkNode = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const event of node.events?.list || []) walkBlock(event?.tree, node.id);
    for (const child of node.children || []) walkNode(child);
    for (const child of node.classes || []) walkNode(child);
  };
  for (const key of ['stage', 'server', 'case']) walkNode(v4CaseJson?.[key]);
  return map;
}

function buildDiagReport({ caseName, records, nodeIndex, blockIndex }) {
  const enriched = records.map((r) => {
    const node = nodeIndex.get(r.nodeId) || {};
    const block = (r.blockId && blockIndex.get(r.blockId)) || {};
    const prop = r.paramName ?? r.actionParamName ?? r.bindName ?? null;
    return {
      message: r.message,
      phase: r.phase,
      // custom-expr-fallback：逻辑以自定义表达式（jsfn）保留；其余：公式降级为空值、逻辑丢失
      outcome: r.phase === 'custom-expr-fallback' ? 'custom-expr' : 'dropped',
      nodeId: r.nodeId ?? null,
      nodeType: node.type ?? null,
      nodeName: node.name ?? null,
      bid: r.blockId ?? null,
      // v5 事件行 ln 复用 v4 事件块 bid（multiObjs 拆循环的动作行除外）
      ln: r.blockId ? (block.lnIsRegenerated ? null : r.blockId) : null,
      lnNote: block.lnIsRegenerated ? 'multiObjs 拆循环，动作行 ln 为转换时新生成的 xid' : undefined,
      prop,
      propKind:
        r.paramName != null ? 'paramName'
        : r.actionParamName != null ? 'actionParam'
        : r.bindName != null ? 'bind'
        : null,
      triggerName: block.triggerName ?? null,
      actionName: block.actionName ?? null,
      blockType: block.blockType ?? null,
      scope: r.scope ?? null,
      code: r.code ?? null,
    };
  });

  // 相同（节点/块/属性/公式/报错/阶段）合并计数
  const grouped = new Map();
  for (const item of enriched) {
    const key = [item.nodeId, item.bid, item.prop, item.code, item.message, item.phase].join('');
    const found = grouped.get(key);
    if (found) found.count += 1;
    else grouped.set(key, { ...item, count: 1 });
  }
  const unique = [...grouped.values()].sort((a, b) => b.count - a.count);

  // 报错类别汇总（去掉位置数字便于归类）
  const category = (m) => (m || '').replace(/ at character \d+/, '');
  const byCategory = {};
  for (const item of enriched) {
    const c = category(item.message);
    byCategory[c] = (byCategory[c] || 0) + 1;
  }

  const droppedTotal = enriched.filter((r) => r.outcome === 'dropped').length;
  return {
    case: caseName,
    total: enriched.length,
    droppedTotal,
    customExprTotal: enriched.length - droppedTotal,
    uniqueTotal: unique.length,
    byCategory: Object.fromEntries(Object.entries(byCategory).sort((a, b) => b[1] - a[1])),
    records: unique,
  };
}

function renderDiagMarkdown(report) {
  const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const trunc = (s, n) => {
    s = String(s ?? '');
    return s.length > n ? `${s.slice(0, n)}…` : s;
  };
  const lines = [];
  lines.push(`# ${report.case} 公式转换报错报告`);
  lines.push('');
  lines.push(`- 报错总数：${report.total}，去重合并后 ${report.uniqueTotal} 条`);
  lines.push(
    `- 其中 **降级为空值 \`{op:'val'}\`（逻辑丢失）${report.droppedTotal} 条**；` +
      `自定义表达式（jsfn）兜底（逻辑保留）${report.customExprTotal} 条`
  );
  lines.push('- `ln` 为 v5 事件行 id，复用 v4 事件块 `bid`；标注“拆循环”的动作行 ln 是转换时新生成的 xid');
  lines.push('- 属性名列：事件动作参数名 / 节点属性绑定名（标注 bind）');
  lines.push('');
  lines.push('## 报错类别汇总');
  lines.push('');
  lines.push('| 报错 | 次数 |');
  lines.push('| --- | ---: |');
  for (const [cat, count] of Object.entries(report.byCategory)) {
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

const targets = requested.length
  ? requested.map((f) => (f.endsWith('.json') ? f : `${f}.json`))
  : fs.readdirSync(V4_DIR).filter((f) => f.endsWith('.json')).sort();

if (!targets.length) {
  console.log(`localCases/v4 下没有 .json 文件。把 4.x 案例 JSON 放进去再运行：\n  ${V4_DIR}`);
  process.exit(0);
}

loadRuntimeMaps();

let failed = 0;
for (const name of targets) {
  const inPath = path.join(V4_DIR, name);
  const outPath = path.join(V5_DIR, `${path.basename(name, '.json')}.v5.json`);
  const started = Date.now();
  try {
    const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
    // 兼容完整请求体：取其中的 v4CaseJson / ntype
    const v4CaseJson = raw.v4CaseJson || raw;
    const ntype = cliNtype ?? raw.ntype;
    if (diag) enableConvertDiag();
    const v5CaseJson = convertV4CaseJsonToV5CaseJson({ v4CaseJson, ntype });
    // 案例产物可能很大，统一输出紧凑 JSON；诊断报告仍保留美化格式便于阅读。
    fs.writeFileSync(outPath, JSON.stringify(v5CaseJson));
    const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
    console.log(`✔ ${name} → localCases/v5/${path.basename(outPath)} (${kb} KB, ${Date.now() - started}ms)`);
    if (diag) {
      const records = getDiagRecords();
      disableConvertDiag();
      const report = buildDiagReport({
        caseName: name,
        records,
        nodeIndex: collectNodeIndex(v4CaseJson),
        blockIndex: collectBlockIndex(v4CaseJson),
      });
      const jsonPath = outPath.replace(/\.v5\.json$/, '.convert-errors.json');
      const mdPath = outPath.replace(/\.v5\.json$/, '.convert-errors.md');
      fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
      fs.writeFileSync(mdPath, renderDiagMarkdown(report));
      console.log(
        `  诊断：${report.total} 条公式报错（空值降级 ${report.droppedTotal} · jsfn 兜底 ${report.customExprTotal} · 去重 ${report.uniqueTotal}）→ localCases/v5/${path.basename(mdPath)} / .json`
      );
    }
  } catch (err) {
    failed += 1;
    if (diag) disableConvertDiag();
    console.error(`✘ ${name}: ${err.message}`);
  }
}

console.log(`完成：${targets.length - failed}/${targets.length} 成功`);
process.exit(failed ? 1 : 0);
