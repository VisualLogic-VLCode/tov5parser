# AWS 运维手册（aws-cn / cn-northwest-1 / 账号 587849590304）

本文记录 tov5parser 线上环境的全部 AWS CLI 操作：凭证配置、日常运维、
以及 2026-07-08 首次搭建时实际执行过的一次性命令（环境重建时照抄可用）。
调用接口的方式见 README「Lambda」与「线上环境」章节。

## 0. 前置：凭证配置（每台新机器一次）

密钥材料在 `vl-case-json-converter-aws-cn-access/`（已 gitignore，只在本机，
丢失找管理员重发）。安装 AWS CLI 后：

```bash
brew install awscli   # macOS

aws configure --profile vl-case-json-converter-cn
# AWS Access Key ID:     凭证 JSON 里的 AccessKeyId
# AWS Secret Access Key: 凭证 JSON 里的 SecretAccessKey
# Default region name:   cn-northwest-1
# Default output format: json

# 验证（Account 应为 587849590304，Arn 含 user/vl-case-json-converter-deployer）
aws sts get-caller-identity --profile vl-case-json-converter-cn
```

注意：中国区与全球区凭证不通用；该 IAM 用户仅有 CLI 访问，无控制台密码；
权限按 `vl-case-json-converter*` 资源名前缀限定（详见 deployer-iam-policy.json）。

以下命令统一省略 `--profile vl-case-json-converter-cn --region cn-northwest-1`，
实际执行时补上（或 `export AWS_PROFILE=vl-case-json-converter-cn`）。

## 1. 日常运维

```bash
# 日常部署（打包→S3 中转→更新代码→发版本→切 prod 别名→冒烟）
npm run deploy:lambda:prod -- --smoke

# 查函数当前配置 / 版本列表 / prod 别名指向
aws lambda get-function-configuration --function-name vl-case-json-converter
aws lambda list-versions-by-function --function-name vl-case-json-converter \
  --query 'Versions[].{V:Version,Desc:Description}'
aws lambda get-alias --function-name vl-case-json-converter --name prod

# 回滚：把 prod 别名指回旧版本（秒级生效，端点不变）
aws lambda update-alias --function-name vl-case-json-converter \
  --name prod --function-version <旧版本号>

# 查函数日志（近 30 分钟 / 持续跟踪）
aws logs tail /aws/lambda/vl-case-json-converter --since 30m
aws logs tail /aws/lambda/vl-case-json-converter --follow

# 手动 invoke 冒烟（绕过 API Gateway 直测函数）
echo '{"headers":{},"body":"{\"action\":\"version\"}"}' > /tmp/smoke.json
aws lambda invoke --function-name vl-case-json-converter --qualifier prod \
  --payload fileb:///tmp/smoke.json /tmp/smoke.out && cat /tmp/smoke.out

# 查看中转桶内容（部署包 / 大 JSON 中转）
aws s3 ls s3://vl-case-json-converter/lambda-packages/vl-case-json-converter/
aws s3 ls s3://vl-case-json-converter/transfer/in/
```

## 2. 一次性搭建记录（2026-07-08 实际执行，重建环境照此顺序）

```bash
# ① 执行角色（信任 Lambda 服务 + 基础日志权限）
aws iam create-role --role-name vl-case-json-converter-lambda-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name vl-case-json-converter-lambda-role \
  --policy-arn arn:aws-cn:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# ② 给执行角色挂中转桶读写（大 JSON 通道需要 Lambda 运行时读写 S3）
aws iam put-role-policy --role-name vl-case-json-converter-lambda-role \
  --policy-name s3-transfer-rw \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Sid":"TransferBucketRW","Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:ListBucket"],"Resource":["arn:aws-cn:s3:::vl-case-json-converter","arn:aws-cn:s3:::vl-case-json-converter/*"]}]}'

# ③ S3 桶：由管理员创建（部署账号无 s3:CreateBucket）。
#    桶名 vl-case-json-converter，阻止公共访问全开，
#    transfer/ 前缀配 3 天自动过期生命周期规则。

# ④ 创建函数（zip 由 npm run package:runtime 产出；1.6MB 可直传）
aws lambda create-function --function-name vl-case-json-converter \
  --runtime nodejs20.x --handler lambdaIndex.handler \
  --role arn:aws-cn:iam::587849590304:role/vl-case-json-converter-lambda-role \
  --memory-size 2048 --timeout 120 \
  --zip-file fileb://archive.runtime-tov5.zip
aws lambda wait function-active-v2 --function-name vl-case-json-converter

# ⑤ 发布版本 + 建 prod 别名（调用方永远走别名）
aws lambda publish-version --function-name vl-case-json-converter --description "initial"
aws lambda create-alias --function-name vl-case-json-converter --name prod --function-version 1

# ⑥ API Gateway HTTP API（quick create 直连 prod 别名，默认路由 ANY /）
aws apigatewayv2 create-api --name vl-case-json-converter --protocol-type HTTP \
  --target arn:aws-cn:lambda:cn-northwest-1:587849590304:function:vl-case-json-converter:prod
# → 返回 ApiId（现网为 ui9kfbjiwd）与 ApiEndpoint（即公网端点）

# ⑦ 授权 API Gateway 调用函数别名（<api-id> 换成上一步返回值）
aws lambda add-permission --function-name vl-case-json-converter --qualifier prod \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
  --source-arn "arn:aws-cn:execute-api:cn-northwest-1:587849590304:<api-id>/*"
```

## 3. 已知权限边界（实测）

- 部署用户无 `s3:CreateBucket`、`s3:ListAllMyBuckets`、`iam:ListRoles`、
  `iam:GetRolePolicy`（对角色可写内联策略但读不回）——超出边界的操作找管理员；
- 资源名必须落在 `vl-case-json-converter*` 前缀内，其他名字一律 AccessDenied；
- 函数名是 `vl-case-json-converter`（无 -prod 后缀，prod 是别名不是函数名的一部分）。
