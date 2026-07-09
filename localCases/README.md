# localCases — 本地案例转换工作区

把 4.x 案例 JSON（4.1 编辑器 saveDealCase 产物：`{ case, stage, server }`）
放进 `v4/`，转换出的 5.x JSON 放 `v5/`，文件名约定 `<原名>.v5.json`。

## 方式一：localServer（走 lambda handler，与线上一致）

```bash
node localServer.js          # http://localhost:3457
```

若 `v4/` 里放的是**裸案例 JSON**，用 jq 包装成请求体、再从响应中取出 v5：

```bash
jq -n --slurpfile c localCases/v4/demo.json \
  '{action:"convertV4ToV5", v4CaseJson:$c[0], ntype:5}' \
  | curl -s -X POST http://localhost:3457/ -H 'Content-Type: application/json' -d @- \
  | jq '.data.v5CaseJson' > localCases/v5/demo.v5.json
```

若放的是**完整请求体**（`{ "action":"convertV4ToV5", "v4CaseJson":{...}, "ntype":5 }`）：

```bash
curl -s -X POST http://localhost:3457/ -H 'Content-Type: application/json' \
  -d @localCases/v4/demo.json | jq '.data.v5CaseJson' > localCases/v5/demo.v5.json
```

转换失败时响应为 `{ "code": 10003, "message": ... }`（参数错误 10001），
此时 `.data.v5CaseJson` 为 null，先看整体响应排查。

## 方式二：直接调库（不起服务，批量）

```bash
npm run convert:local                       # 转换 v4/ 下全部 *.json
npm run convert:local -- demo.json          # 只转换指定文件（可省略 .json 后缀）
npm run convert:local -- demo --ntype 5     # 显式指定案例类型（缺省从 stage 根节点推断）
```

裸案例 JSON 与完整请求体两种输入都支持。

---

本目录中的案例 JSON 默认不入库（见根 .gitignore），仅本 README 被跟踪。
