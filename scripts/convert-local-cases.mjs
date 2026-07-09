// 本地批量转换：localCases/v4/*.json → localCases/v5/<原名>.v5.json
//
// 用法：
//   node scripts/convert-local-cases.mjs                  # 转换 v4/ 下全部 *.json
//   node scripts/convert-local-cases.mjs demo.json other  # 只转换指定文件（可省略 .json 后缀）
//   node scripts/convert-local-cases.mjs demo --ntype 5   # 显式指定案例类型
//
// 输入既可以是裸的 4.x 案例 JSON（{ case, stage, server }），也可以是完整
// 请求体（{ action, v4CaseJson, ntype }）——后者自动取 v4CaseJson 与 ntype。
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { convertV4CaseJsonToV5CaseJson, loadRuntimeMaps } from '../index.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const V4_DIR = path.join(__dirname, '..', 'localCases', 'v4');
const V5_DIR = path.join(__dirname, '..', 'localCases', 'v5');

function parseArgs(argv) {
  const files = [];
  let ntype;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--ntype') {
      ntype = Number(argv[i + 1]);
      if (!Number.isFinite(ntype)) {
        console.error(`--ntype 需要数字参数，收到: ${argv[i + 1]}`);
        process.exit(1);
      }
      i += 1;
    } else {
      files.push(argv[i]);
    }
  }
  return { files, ntype };
}

const { files: requested, ntype: cliNtype } = parseArgs(process.argv.slice(2));

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
    const v5CaseJson = convertV4CaseJsonToV5CaseJson({ v4CaseJson, ntype });
    fs.writeFileSync(outPath, JSON.stringify(v5CaseJson, null, 2));
    const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
    console.log(`✔ ${name} → localCases/v5/${path.basename(outPath)} (${kb} KB, ${Date.now() - started}ms)`);
  } catch (err) {
    failed += 1;
    console.error(`✘ ${name}: ${err.message}`);
  }
}

console.log(`完成：${targets.length - failed}/${targets.length} 成功`);
process.exit(failed ? 1 : 0);
