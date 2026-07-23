import MapCreator from '../utils/MapCreator.js';
import { ast2js } from './ast2js.js';

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function removeFakeCbInner(ast) {
  if (!Array.isArray(ast?.args)) return;
  for (let index = ast.args.length - 1; index >= 0; index -= 1) {
    const arg = ast.args[index];
    if (arg?.op === 'alambda' && arg._fakeCbInner) {
      ast.args.splice(index, 1);
    }
  }
  ast.args.forEach(removeFakeCbInner);
}

function addNodesToMap(node, nodeMap) {
  if (!node || typeof node !== 'object') return;
  if (node.id) nodeMap[node.id] = node;
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => addNodesToMap(child, nodeMap));
  }
}

function buildServerNodeMap(server) {
  const nodeMap = {};
  addNodesToMap(server, nodeMap);
  if (Array.isArray(server?.classes)) {
    server.classes.forEach((classNode) => addNodesToMap(classNode, nodeMap));
  }
  return nodeMap;
}

function applyInParamHandling({ code, node, paramLooseMode }) {
  const inParams = node?.props?.inParams;
  if (!Array.isArray(inParams)) return code;

  const isFuncGroup = node.type === 'data-funcGroup';
  const paramPrefix = isFuncGroup ? `fParam${node.id}` : 'param';

  if (paramLooseMode) {
    const conversions = inParams
      .filter((param) => param?.type && param.type !== 'JsonVal')
      .map((param) => {
        const type = `${param.type.slice(0, 1).toUpperCase()}${param.type.slice(1)}`;
        return `${paramPrefix}.${param.name} = to${type}(${paramPrefix}.${param.name});`;
      })
      .join('');
    return conversions + code;
  }

  const errorCode = isFuncGroup
    ? `cbFParam${node.id}('fail', { detail: _typeError, _vl_type_error_: true });\nreturn;`
    : '$result = { detail: _typeError, _vl_type_error_: true };\nreturn;';
  return `let _typeError = _checkInParamsTypeError(${JSON.stringify(
    inParams,
  )}, ${paramPrefix});
if (_typeError) {
${errorCode}
}
${code}`;
}

function applyServerEventPostProcess({ code, event, node, paramLooseMode }) {
  let eventCode = code;
  if (event?.name === 'callTimerService') {
    eventCode =
      '$timerServiceResult=undefined; ' +
      eventCode +
      ' if($timerServiceResult!==undefined){$result=$timerServiceResult} else {$result=undefined};';
  }
  return applyInParamHandling({
    code: eventCode,
    node,
    paramLooseMode,
  });
}

function compileNodeTree({
  node,
  globalNodeMap,
  javaMap,
  paramLooseMode,
}) {
  const localNodeMap = {};
  addNodesToMap(node, localNodeMap);
  let compiledCount = 0;

  const walk = (currentNode) => {
    const events = currentNode?.events?.list;
    if (Array.isArray(events)) {
      events.forEach((event) => {
        if (!event?.ast) return;
        const ast = deepClone(event.ast);
        removeFakeCbInner(ast);
        const code = ast2js({
          ast,
          eventNodeId: currentNode.id,
          getNodeByIdFunc: (id) => localNodeMap[id] || globalNodeMap[id],
          javaMap,
        });
        event._code = applyServerEventPostProcess({
          code,
          event,
          node: currentNode,
          paramLooseMode,
        });
        if (currentNode.type === 'data-funcGroup') {
          currentNode.props ||= {};
          currentNode.props._code = event._code;
        }
        compiledCount += 1;
      });
    }
    if (Array.isArray(currentNode?.children)) {
      currentNode.children.forEach(walk);
    }
  };

  walk(node);
  return compiledCount;
}

function compileV5ServerAst(caseJson) {
  const server = caseJson?.server;
  if (!server || typeof server !== 'object') return 0;

  server.props ||= {};
  server.props.v2 = 1;

  const globalNodeMap = buildServerNodeMap(server);
  const javaMap = MapCreator.getVxJaMap() || {};
  let compiledCount = compileNodeTree({
    node: server,
    globalNodeMap,
    javaMap,
    paramLooseMode: server.props.paramLooseMode,
  });

  if (Array.isArray(server.classes)) {
    server.classes.forEach((classNode) => {
      compiledCount += compileNodeTree({
        node: classNode,
        globalNodeMap,
        javaMap,
        paramLooseMode:
          classNode?.props?.paramLooseMode ?? server.props.paramLooseMode,
      });
    });
  }

  return compiledCount;
}

export { compileV5ServerAst };
