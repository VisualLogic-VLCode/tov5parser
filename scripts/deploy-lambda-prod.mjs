#!/usr/bin/env node
// 部署 tov5parser lambda：打包 → S3 → 更新函数代码 → 发布版本 → 切 alias。
// 流程与 vlparser 的 scripts/deploy-lambda-prod.mjs 同构（精简版），
// 另支持 --create --role <arn> 首次创建函数。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRuntimePackage } from './package-runtime.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// 部署目标：AWS 中国区账号（与 vlparser 的全球区账号相互独立；
// 中国区 ARN 前缀为 arn:aws-cn）。凭证 profile 见 vl-case-json-converter-aws-cn-access/README.md。
// 资源名按管理员授权范围命名（vl-case-json-converter*）。
// 部署包经 S3 桶中转（默认 vl-case-json-converter，同时也是大 JSON 转换的中转桶）；
// --bucket '' 可切换为直传 zip（包 ~1.6MB，直传也可行）。
const defaults = {
  region: 'cn-northwest-1',
  expectedAccount: '587849590304',
  profile: 'vl-case-json-converter-cn',
  functionName: 'vl-case-json-converter',
  alias: 'prod',
  bucket: 'vl-case-json-converter',
  s3Prefix: 'lambda-packages/vl-case-json-converter',
  runtime: 'nodejs20.x',
  handler: 'lambdaIndex.handler',
  memorySize: '2048',
  timeout: '120',
  role: 'arn:aws-cn:iam::587849590304:role/vl-case-json-converter-lambda-role',
  keepHistory: false,
  zipPath: path.join(repoRoot, 'archive.runtime-tov5.zip'),
  description: '',
  requireClean: true,
  runTests: false,
  smoke: false,
  create: false,
  dryRun: false,
};

function printHelp() {
  console.log(`Usage:
  npm run deploy:lambda:prod -- [options]

Defaults:
  Updates ${defaults.functionName} in ${defaults.region}, publishes a numbered
  version, and cuts alias ${defaults.alias} to it (alias cut = traffic switch).
  The zip is staged via s3://${defaults.bucket} by default; pass --bucket '' for direct upload.
  Uses AWS profile "${defaults.profile}" unless AWS_PROFILE is already set.

Options:
  --create                 First-time deploy: create the function (requires --role)
  --role <arn>             Execution role ARN for --create
  --run-tests              Run npm test before packaging
  --smoke                  Invoke the alias with {action:"version"} after switching
  --dry-run                Package and print the plan without changing AWS
  --allow-dirty            Do not require a clean git tree
  --keep-history           Upload to a commit/timestamp S3 key instead of latest.zip
  --description <text>     Lambda version description
  --function-name <name>   Lambda function name (default ${defaults.functionName})
  --alias <name>           Lambda alias (default ${defaults.alias})
  --region <region>        AWS region (default ${defaults.region})
  --profile <name>         AWS CLI profile (default ${defaults.profile})
  --account <id>           Expected AWS account (default ${defaults.expectedAccount})
  --bucket <name>          Optional: stage the zip via this S3 bucket instead of direct upload
  --s3-prefix <prefix>     S3 key prefix (default ${defaults.s3Prefix})
  --memory <mb>            Memory size for --create (default ${defaults.memorySize})
  --timeout <seconds>      Timeout for --create (default ${defaults.timeout})
  --help                   Show this help
`);
}

function parseArgs(argv) {
  const args = { ...defaults };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--create': args.create = true; break;
      case '--role': args.role = next(); break;
      case '--run-tests': args.runTests = true; break;
      case '--smoke': args.smoke = true; break;
      case '--dry-run': args.dryRun = true; break;
      case '--allow-dirty': args.requireClean = false; break;
      case '--keep-history': args.keepHistory = true; break;
      case '--description': args.description = next(); break;
      case '--function-name': args.functionName = next(); break;
      case '--alias': args.alias = next(); break;
      case '--region': args.region = next(); break;
      case '--profile': args.profile = next(); break;
      case '--account': args.expectedAccount = next(); break;
      case '--bucket': args.bucket = next(); break;
      case '--s3-prefix': args.s3Prefix = next(); break;
      case '--memory': args.memorySize = next(); break;
      case '--timeout': args.timeout = next(); break;
      case '--help': printHelp(); process.exit(0); break;
      default:
        throw new Error(`Unknown option: ${arg} (see --help)`);
    }
  }
  if (args.create && !args.role) {
    throw new Error('--create requires --role <execution-role-arn>');
  }
  if (!args.expectedAccount) {
    throw new Error(
      'AWS account not set. Pass --account <id>, or fill defaults.expectedAccount in scripts/deploy-lambda-prod.mjs.',
    );
  }
  return args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    cwd: repoRoot,
    env: { ...process.env, AWS_MAX_ATTEMPTS: '5' },
  });
  if (result.status !== 0) {
    const stderr = options.capture ? `\n${result.stderr}` : '';
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})${stderr}`);
  }
  return options.capture ? result.stdout.trim() : undefined;
}

function findAwsBin() {
  const fromShell = spawnSync('/bin/zsh', ['-lc', 'command -v aws || true'], {
    encoding: 'utf8',
  }).stdout.trim();
  const candidates = [fromShell, '/usr/local/bin/aws', '/opt/homebrew/bin/aws']
    .filter(Boolean);
  const awsBin = candidates.find((candidate) => fs.existsSync(candidate));
  if (!awsBin) throw new Error('AWS CLI not found.');
  return awsBin;
}

function ensureGitState(args) {
  const shortHead = run('git', ['rev-parse', '--short', 'HEAD'], {
    capture: true,
  });
  if (args.requireClean) {
    const status = run('git', ['status', '--short'], { capture: true });
    if (status) {
      throw new Error(
        `Git tree is not clean. Commit changes or pass --allow-dirty.\n${status}`,
      );
    }
  }
  return { shortHead };
}

function verifyAwsIdentity(awsBin, args) {
  const identityJson = run(
    awsBin,
    ['sts', 'get-caller-identity', '--region', args.region, '--output', 'json'],
    { capture: true },
  );
  const identity = JSON.parse(identityJson);
  if (identity.Account !== args.expectedAccount) {
    throw new Error(
      `Wrong AWS account: expected ${args.expectedAccount}, got ${identity.Account}.`,
    );
  }
  console.log(`AWS account ok: ${identity.Account}`);
}

function timestampForKey() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
}

function smokeInvoke(awsBin, args, version) {
  const payloadPath = path.join(repoRoot, `.lambda-smoke-${process.pid}.json`);
  const outputPath = path.join(repoRoot, `.lambda-smoke-${process.pid}.out`);
  fs.writeFileSync(
    payloadPath,
    JSON.stringify({ headers: {}, body: JSON.stringify({ action: 'version' }) }),
  );
  try {
    const invokeMeta = run(
      awsBin,
      [
        'lambda', 'invoke',
        '--region', args.region,
        '--function-name', args.functionName,
        '--qualifier', args.alias,
        '--payload', `fileb://${payloadPath}`,
        outputPath,
        '--query',
        '{StatusCode:StatusCode,ExecutedVersion:ExecutedVersion,FunctionError:FunctionError}',
        '--output', 'json',
      ],
      { capture: true },
    );
    const meta = JSON.parse(invokeMeta);
    if (version && String(meta.ExecutedVersion) !== String(version)) {
      throw new Error(
        `Smoke invoke executed version ${meta.ExecutedVersion}, expected ${version}.`,
      );
    }
    console.log(`Smoke invoke ok: ${invokeMeta}`);
    console.log(fs.readFileSync(outputPath, 'utf8'));
  } finally {
    fs.rmSync(payloadPath, { force: true });
    fs.rmSync(outputPath, { force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.profile && !process.env.AWS_PROFILE) {
    process.env.AWS_PROFILE = args.profile;
  }
  const { shortHead } = ensureGitState(args);
  const awsBin = findAwsBin();
  const description =
    args.description || `tov5parser ${shortHead} ${new Date().toISOString()}`;

  console.log(`Deploying ${args.functionName}:${args.alias} from ${shortHead}`);
  verifyAwsIdentity(awsBin, args);

  if (args.runTests) run('npm', ['test']);
  await buildRuntimePackage({ zipPath: args.zipPath });

  // 部署包很小（~1.6MB），默认直传；提供 --bucket 时走 S3 中转（大包/留档场景）
  const useS3 = Boolean(args.bucket);
  let s3Key = '';
  if (useS3) {
    const s3BasePrefix = args.s3Prefix.replace(/\/+$/, '');
    s3Key = args.keepHistory
      ? `${s3BasePrefix}/archive-${shortHead}-${timestampForKey()}.zip`
      : `${s3BasePrefix}/latest.zip`;
    console.log(`S3 package: s3://${args.bucket}/${s3Key}`);
  } else {
    console.log(`Direct zip upload: ${args.zipPath}`);
  }

  if (args.dryRun) {
    console.log('Dry run complete; AWS mutation commands were not executed.');
    return;
  }

  if (useS3) {
    run(awsBin, [
      's3', 'cp', args.zipPath, `s3://${args.bucket}/${s3Key}`,
      '--region', args.region, '--only-show-errors',
    ]);
  }

  if (args.create) {
    console.log(`Creating function ${args.functionName} ...`);
    const codeArgs = useS3
      ? ['--code', `S3Bucket=${args.bucket},S3Key=${s3Key}`]
      : ['--zip-file', `fileb://${args.zipPath}`];
    run(awsBin, [
      'lambda', 'create-function',
      '--region', args.region,
      '--function-name', args.functionName,
      '--runtime', args.runtime,
      '--handler', args.handler,
      '--role', args.role,
      '--memory-size', args.memorySize,
      '--timeout', args.timeout,
      ...codeArgs,
      '--description', description,
      '--query', '{FunctionName:FunctionName,State:State,Runtime:Runtime}',
      '--output', 'json',
    ]);
    run(awsBin, [
      'lambda', 'wait', 'function-active-v2',
      '--region', args.region, '--function-name', args.functionName,
    ]);
  } else {
    const codeArgs = useS3
      ? ['--s3-bucket', args.bucket, '--s3-key', s3Key]
      : ['--zip-file', `fileb://${args.zipPath}`];
    run(awsBin, [
      'lambda', 'update-function-code',
      '--region', args.region,
      '--function-name', args.functionName,
      ...codeArgs,
      '--query',
      '{FunctionName:FunctionName,LastUpdateStatus:LastUpdateStatus,CodeSha256:CodeSha256}',
      '--output', 'json',
    ]);
    run(awsBin, [
      'lambda', 'wait', 'function-updated',
      '--region', args.region, '--function-name', args.functionName,
    ]);
  }

  const publishJson = run(
    awsBin,
    [
      'lambda', 'publish-version',
      '--region', args.region,
      '--function-name', args.functionName,
      '--description', description,
      '--query', '{Version:Version,CodeSha256:CodeSha256}',
      '--output', 'json',
    ],
    { capture: true },
  );
  const published = JSON.parse(publishJson);
  console.log(`Published version ${published.Version}`);

  if (args.create) {
    run(awsBin, [
      'lambda', 'create-alias',
      '--region', args.region,
      '--function-name', args.functionName,
      '--name', args.alias,
      '--function-version', published.Version,
      '--output', 'json',
    ]);
  } else {
    run(awsBin, [
      'lambda', 'update-alias',
      '--region', args.region,
      '--function-name', args.functionName,
      '--name', args.alias,
      '--function-version', published.Version,
      '--routing-config', 'AdditionalVersionWeights={}',
      '--query', '{Name:Name,FunctionVersion:FunctionVersion}',
      '--output', 'json',
    ]);
  }

  if (args.smoke) smokeInvoke(awsBin, args, published.Version);

  console.log(
    `Done. ${args.functionName}:${args.alias} now points to version ${published.Version}.`,
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
