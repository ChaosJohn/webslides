# cjpm 对命令注入的防护措施

> 分析对象：`cangjie_tools/cjpm`（Cangjie Project Manager）

cjpm 的防注入策略可概括为：**"配置/输入先过正则白名单 + 危险字符黑名单，执行时统一 argv 直传不经过 shell，唯一的 `system()` 调用只喂固定常量"**。

## 1. 默认不经过 shell，用 argv 直传

绝大多数外部命令走 `std.process.launch(exe, args, ...)`，无 shell 解释：

- `execAndToTerminal` / `execWithOutput` / `execAndToFile`：`src/config/common_util.cj:21-98`

这些函数覆盖了 cjc 编译、git、cjlint、测试/构建脚本二进制、`cjpm-xxx` 扩展命令等所有外部调用：

- `cjpm-xxx` 扩展命令：`src/implement/expanded_cmd.cj:24-28`
- git 命令：`src/implement/git.cj:23,62`
- cjc 编译：`src/implement/build_parallel.cj:1831`、`src/implement/dep_model.cj:747,1541` 等

由于不经过 shell，`;`、`&&`、`$()`、反引号等元字符不会被解释。

## 2. 字段级正则/黑白名单校验

### 2.1 危险字符黑名单

`safeCheck` / `safeCheckResult`：`src/config/verify.cj:254-270`

```cangjie
@When[os == "Linux" || os == "macOS"]
let REGEXP_COMMAND_INJECTION = "[|;&$><`!\n\\\\]+"
@When[os == "Windows"]
let REGEXP_COMMAND_INJECTION = "[|;&$><`!\n]+"
```

`verify.cj:41-44`。应用于：

- `compile-option`、`override-compile-option`、`link-option`：`src/config/package.cj:172-177`
- `target-dir`、`script-dir`：`src/config/package.cj:175-176`、`src/config/common_util.cj:121-124`
- cLib 路径：`src/config/ffi.cj:73`
- dependency `commit-id`：`src/config/dependencies.cj:201`
- CLI 参数：`--target-dir`、`--enable-features`、`--filter`、`--include-tags/--exclude-tags`：`src/command/common.cj:59-115`

### 2.2 白名单校验

包名/依赖名强制白名单 `^[_a-zA-Z][_a-zA-Z0-9]*$`，间接限制了进入命令/路径的字符：

- `nameCheck` / `organizationCheck` / `dependenciesNameCheck`：`src/config/verify.cj:47-99`

版本号只允许数字和点：

- `REGEXP_VERSION`：`src/config/verify.cj:21-23`

C 库名白名单：

- `REGEXP_C_LIB_NAME = "^[A-Za-z0-9\\._\\-#%\\+,=@\\[\\]\\^\\{\\}~]+$"`：`src/config/verify.cj:33`

## 3. git URL 安全校验

`checkSafeUrl`：`src/config/meta_data.cj:369-372`

```cangjie
public func checkSafeUrl(url: String): Bool {
    return !url.startsWith("-") && !url.contains("`") &&
        !url.contains("--upload-pack=") && !Regex(URL_WITH_SPACE).matches(url)
}
```

- 拒绝以 `-` 开头的 URL（防 git 选项注入）
- 拒绝含反引号的 URL
- 拒绝 `--upload-pack=`（防 git 协议命令注入）
- 拒绝含空白的 URL

`checkLegalUrl`：`src/config/meta_data.cj:361-367` 限定协议白名单（`/`、`file:`、`git:`、`git@`、`http:`、`https:`、`ssh:` 等）。

在 git 依赖下载前强制检查：`src/implement/git.cj:99`。

## 4. 命令字符串→参数数组再执行

`extractOptionByString` / `parseEachArgs`：`src/config/common_util.cj:201-322`

把 `"remote add --no-tags origin ${url}"` 这类字符串按空格/引号拆成 argv，再交给 `launch`，不进入 shell 语义。引号不闭合时整个字符串作为单个参数返回（安全）。

用途：

- `src/implement/git.cj:50-62`（git clone 系列命令）
- `src/implement/build_script.cj:360-369`（build.cj 编译命令）

## 5. git 运行环境加固

`src/implement/git.cj:20-21,45-47`：

- `GIT_TERMINAL_PROMPT=0`：禁止交互式凭据提示，防钓鱼/注入
- `GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=ask"`：SSH 批处理模式加固
- 用 `GIT_DIR` / `GIT_WORK_TREE` 限定仓库位置

## 6. 交叉编译 target 校验

`crossCompileCheck`：`src/command/common.cj:140-178`

- 只允许 `^[-_a-zA-Z0-9.]*$`
- 拒绝 `.` / `..` 路径段

防止 `--target` 参数逃逸到路径或编译选项中。

## 7. 唯一的 shell 面已收敛

`exec()`：`src/config/common_util.cj:77-84`

```cangjie
foreign func system(command: CString): Int32
```

只在 coverage 处理中使用，命令是固定格式的 `cp` / `mv`：

- `src/implement/test.cj:377-392`（`collectCovData`）
- `src/implement/test.cj:1321`（`backupGcnoData`）

参数来源全部为：

- 常量（`COPY_COMMAND`、`MOVE_COMMAND`、`BUILD_GCNO_OUTPUT`、`TEST_GCNO_OUTPUT`、`REMOVE_OUTPUT` 等）
- 已通过 `nameCheck` 校验的包名（`pkgName`）

不存在自由输入，注入风险被上游校验封死。

## 8. 其他加固点

- **环境变量传入**：`EnvironmentBuilder`（`src/config/environment_builder.cj`）以 key-value 对传给子进程，不做字符串拼接。
- **扩展命令名限制**：`checkExpandedCmd`（`src/implement/expanded_cmd.cj:58-67`）用 `cjpm-<arg0>` 拼文件名并在 PATH 中查找，找不到即拒绝执行，不经过 shell。
- **源码目录约束**：`srcDirCheck`（`src/config/verify.cj:314-330`）要求 src-dir 位于模块目录内。
- **target-dir / script-dir 路径校验**：`getOriginTargetDirectory` / `getScriptDirectory`（`src/config/common_util.cj:109-174`）对清理目标做 `safeCheck`。

## 总结

| 防护层 | 措施 | 关键位置 |
|---|---|---|
| 执行方式 | 优先 `launch(argv)` 直传，不用 shell | `common_util.cj:21-98` |
| 输入校验 | 白名单 + 危险字符黑名单 | `verify.cj:254-270` |
| git URL | 协议白名单 + 拒绝选项注入 | `meta_data.cj:361-372` |
| 字符串命令 | 拆成 argv 再执行 | `common_util.cj:201-322` |
| git 环境 | 禁交互、限仓库 | `git.cj:20-21,45-47` |
| 残余 shell 面 | 只喂固定常量 | `test.cj:377-392,1321` |