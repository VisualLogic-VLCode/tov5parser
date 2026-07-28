# V5 动作组异步完成后 UI 未刷新问题说明

## 1. 问题与根因

V5 小模块动作组异步执行完成后缺少一次对应模块的 `fini()`，导致异步阶段更新的变量已经改变、绑定依赖也已经标记为 dirty，但 React 没有收到 `setState()` 提交，最终表现为 UI 没有重新渲染。

V5 运行时将一次变量更新拆成了两个阶段：

1. 更新变量、重新计算绑定依赖，并把相关运行时节点标记为 dirty。
2. 调用 `fini()` 消费 dirty，触发 React `setState()`，最终刷新 UI。

`setValue` 只完成第一阶段，本身不会直接触发 React 更新。

普通组件事件和小模块动作组对第二阶段的处理不同：

### 1.1 普通组件事件

普通 AST 事件会被编译为 async 函数，并在整个事件执行结束时调用：

```js
$sys.fini($self)
```

因此，普通同步 `setValue` 虽然不会立即更新 DOM，但会在事件结束时正常刷新 UI。

### 1.2 小模块动作组

小模块动作组的 `callFuncGroup` 被编译为：

```js
$code()
  .then(r => $cbParam(true, r))
  .catch(e => $cbParam(false, e))
```

该 Promise 完成分支没有调用 `fini()`。

与此同时，V5 Player 的 `modCall()` 只在启动动作组后立即执行一次：

```js
m.call(c, param, cb, sys, c)
sys.fini(c)
```

这次 `fini()` 只能提交动作组第一次 `await` 之前产生的同步更新。

当动作组调用服务或其他异步方法后：

1. 动作组启动。
2. 执行到第一个 `await`，暂时返回。
3. `modCall()` 执行启动阶段的 `fini()`。
4. 服务返回，动作组恢复执行。
5. 恢复后的代码调用变量 `setValue`，变量值和依赖已经更新并标脏。
6. 动作组 Promise 完成，但完成分支没有再次调用 `fini()`。
7. dirty 没有被提交，React UI 保持旧状态。

因此，真正的问题不是“异步 callback 中的 `setValue` 不会更新变量”，而是：

> 小模块动作组在异步执行完成时缺少一次对应模块的 `fini()`。

更通用地说，只要变量写入发生在最后一次 `fini()` 之后，并且后续没有新的 `fini()`，就可能出现“变量值已改变，但 UI 没有重新渲染”。

## 2. 推荐的架构修复位置

推荐修改 V5 Player 仓库：

```text
VxWidgets-player/dartIvx2.js
```

目标函数：

```text
modF.modCall()
```

该文件是 `VxWidgets-player` 中构建 Player 的 ES Module 输入，最终会被打包到线上：

```text
v41player/<版本号>/player.js
```

`runRct.js` 会直接导入 `dartIvx2.js`：

```js
export { mod, wrap } from './dartIvx2'
```

## 3. 推荐修改代码

### 3.1 当前实现

```js
modCall(name, param, cb) {
  var c = { t: { c: null, r: this, y: sys, t: this._rc.r.t }, ids: sys.ids }
  var m = this._sf ? this._sf[name] : sys.staticFns[name]
  if (cb) {
    m.call(c, param, cb, sys, c)
    sys.fini(c)
  } else {
    return new Promise(resolve => {
      m.call(
        c,
        param,
        (status, result) => resolve({ status, result }),
        sys,
        c
      )
      sys.fini(c)
    })
  }
}
```

### 3.2 建议实现

```js
modCall(name, param, cb) {
  var c = { t: { c: null, r: this, y: sys, t: this._rc.r.t }, ids: sys.ids }
  var m = this._sf ? this._sf[name] : sys.staticFns[name]

  if (cb) {
    m.call(
      c,
      param,
      (status, result) => {
        // 提交动作组异步阶段产生的变量和绑定变化。
        sys.fini(c)
        cb(status, result)
      },
      sys,
      c
    )

    // 保留原有行为：提交动作组第一次 await 之前的同步变化。
    sys.fini(c)
  } else {
    return new Promise(resolve => {
      m.call(
        c,
        param,
        (status, result) => {
          // 提交动作组异步阶段产生的变量和绑定变化。
          sys.fini(c)
          resolve({ status, result })
        },
        sys,
        c
      )

      // 保留原有行为：提交动作组第一次 await 之前的同步变化。
      sys.fini(c)
    })
  }
}
```

这两个 `fini()` 的职责不同：

- `m.call()` 返回后的 `fini()`：提交第一次 `await` 之前的同步变化。
- 动作组完成 callback 中的 `fini()`：提交异步恢复阶段产生的变化。

完成 callback 中建议先调用 `fini()`，再通知上层动作继续执行。这样上层恢复后，当前小模块的 dirty 已经进入 React 更新流程。

不建议为了等待 React 真正完成渲染而把上层 callback 放入 `setState` 的完成回调中，否则可能改变原动作组的完成时序，甚至在组件已经卸载时阻塞后续动作。

## 4. 编译器侧的备选修复

另一个修改点位于：

```text
VxWidgets-player/ivxCvt.js
```

相关逻辑是 `callFuncGroup` 的代码生成分支。可以把：

```js
$code()
  .then(r => $cbParam(true, r))
  .catch(e => $cbParam(false, e))
```

修改为：

```js
$code()
  .then(r => {
    $sys.fini($self)
    $cbParam(true, r)
  })
  .catch(e => {
    $sys.fini($self)
    $cbParam(false, e)
  })
```

但当前仓库中的 `ivxCvt.js` 具有明显的 Dart 编译产物特征，仓库内没有对应的 Dart 源码。直接修改该文件可能在下一次从上游重新编译时被覆盖。

因此建议：

1. 优先在 `dartIvx2.js::modCall()` 修复模块动作组的运行生命周期。
2. 如果能找到 `ivxCvt.js` 对应的上游 Dart 编译器源码，再在上游生成逻辑中同步修复。
3. 不建议同时在 Player 和生成代码两处长期保留重复的完成态 `fini()`；应明确一个权威修复点。

## 5. 为什么优先修改 `modCall()`

优先修改 `modCall()` 有以下优势：

- `modCall()` 本身就是小模块方法的启动和完成边界。
- 可以统一覆盖成功和失败的动作组完成 callback。
- 不依赖案例是否由某一版 `ivxCvt` 生成。
- 不需要重新转换 `app.v5.json`。
- Player 发布后，加载新 Player 版本的旧案例也可以获得修复。
- 修复点集中在 Player 运行生命周期，不需要在案例数据中增加额外动作。

需要注意：线上预览页通过固定版本路径加载 Player，例如：

```text
v41player/20230911190146/player.js
```

修改 `dartIvx2.js` 后，需要重新构建和发布新的 Player 版本，并让预览/运行页面加载新版本，修复才会生效。

## 6. 建议验证场景

运行时修改后至少验证以下场景：

1. **同步动作组**
   - 动作组没有异步动作。
   - 调用变量 `setValue` 后 UI 正常更新。
   - 动作组 callback 只返回一次。

2. **异步动作组成功**
   - 服务成功返回。
   - 服务返回后调用变量 `setValue`。
   - tree-for、文本、显示状态等绑定均能更新。

3. **异步动作组失败**
   - 服务进入失败分支。
   - 失败分支更新变量或提示状态后 UI 正常刷新。
   - 上层能够收到失败状态。

4. **嵌套异步动作组**
   - 动作组内部调用另一个动作组。
   - 内外模块的 dirty 分别由正确的模块实例提交。
   - 不出现重复 callback 或后续动作阻塞。

5. **普通组件事件**
   - input、blur、click 等普通事件仍由事件尾 `fini()` 正常提交。
   - 不产生额外循环渲染。

6. **组件卸载**
   - 异步动作组完成前关闭弹窗或卸载小模块。
   - 不出现 React 对已卸载组件执行 `setState` 的警告或异常。
   - 如有需要，应在 `modCall()` 完成提交前增加模块存活状态判断。

7. **frp-pad 目标路径**
   - 顶部点击“全部”。
   - 翻到第二页。
   - 点击第一行空白“量体部门”单元格的搜索图标。
   - 首次打开弹窗即可显示部门列表，不需要关闭后再次打开。

## 7. 发布建议

建议分阶段处理：

1. 在 Player 分支修改 `dartIvx2.js::modCall()`。
2. 构建新的 `player.js`，在测试环境验证上述场景。
3. 使用原始问题案例验证动作组异步完成后能够直接刷新 UI。
4. 发布新的 V5 Player 版本。
5. 确认预览页和正式运行页均已切换到修复后的 Player 版本。

## 8. 最终结论

该问题的架构根因在 V5 Player 的小模块动作组完成生命周期：

> `modCall()` 在动作组启动时执行了 `fini()`，但动作组异步完成时没有再次执行 `fini()`。

推荐修复 `VxWidgets-player/dartIvx2.js` 中的 `modF.modCall()`，在动作组完成 callback 中对当前小模块执行一次 `sys.fini(c)`，同时保留启动阶段原有的 `fini()`。
