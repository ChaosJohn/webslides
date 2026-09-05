# 问题速览

## 1. 【Macro】FlatBuffers Verifier 缺失

### 仓颉团队分析

1. 这个问题不影响运行态，影响的是开发态。
2. 在LSPMacroServer进程通信过程中，flatbuffer序列化后产物未校验，存在被恶意注入的风险，进一步引发进程crash，可能导致语言服务功能失效（比如代码补全），影响开发者使用体验。
3. 攻击路径存在，需本地权限给进程间通信的管道注入恶意数据，且攻击价值很小。

### 仓颉团队修复

- https://gitcode.com/Cangjie/cangjie_compiler/issues/1032
- https://gitcode.com/Cangjie/cangjie_compiler/pull/1954

### 源码层面确认

全代码库搜索 `VerifyMacroMsgBuffer` 调用次数为 **0**。所有反序列化函数直接调用 `GetMacroMsg(bufferData.data())` 而无验证：

| 函数                        | 文件:行                        | 调用                                          |
| --------------------------- | ------------------------------ | --------------------------------------------- |
| GetMacroMsgContenType       | MacroEvalMsgSerializer.cpp:370 | `GetMacroMsg(data)->content_type()`           |
| DeSerializeDeflibMsg        | :376                           | `GetMacroMsg(data)->content_as_defLib()`      |
| DeSerializeIdInfoFromResult | :434                           | `GetMacroMsg(data)->content_as_macroResult()` |
| EvalMacroCall               | MacroEvaluationSrv.cpp:306     | `GetMacroMsg(data)->content_as_multiCalls()`  |

对比其他模块有 Verifier：`ASTLoader.cpp:212` 有 `VerifyPackageBuffer(verifier)` ✓

### 触发条件

F1 的攻击路径需要 **LSP 模式**（`enableMacroInLSP=true`）：

```cpp
// MacroExpansion.cpp:397
bool useChildProcess = ci->invocation.globalOptions.enableMacroInLSP;

// Option.h:582
bool enableMacroInLSP = false; /**< 默认 false, LSP 模式下为 true */
```

- **普通 cjc 命令行**：`enableMacroInLSP=false`，不 fork 宏服务器，宏求值在主进程内直接完成，**不走 IPC 管道路径**
- **LSP 模式**（通过 LSPServer）：`enableMacroInLSP=true`，fork+execv LSPMacroServer 子进程，通过 IPC 管道通信，**FlatBuffers 跨进程反序列化路径被激活**

### 完整 PoC 验证

#### 验证方案

通过 Python 脚本手动创建管道 + fork + execv LSPMacroServer，同时用 LD_PRELOAD .so 在 LSPMacroServer 中 hook dlopen，检测管道 fd 并注入恶意 FlatBuffers。

#### 恶意 FlatBuffers 构造

手工构造 48 字节恶意 MacroMsg buffer：

```
MacroMsg(content_type=macroResult=3) → MacroResult(id 字段 absent)
效果: result->id() 返回 nullptr → result->id()->name() → SIGSEGV
```

Buffer 布局：

```
[0-3]   root_offset = 16
[4-11]  MacroMsg vtable (size=8, table_size=12, field0_off=4, field1_off=8)
[16-27] MacroMsg table (soffset=12, content_type=3, content_offset=20)
[28-43] MacroResult vtable (size=16, table_size=4, id=0 ABSENT)
[44-47] MacroResult table (soffset=16)
```

#### 验证结果

```
[parent] *** Received malicious response: 48 bytes ***
[parent] Response hex: 1000000008000c00...
[parent] *** F1 INJECTION PATH CONFIRMED! ***

--- STDERR LOG (LSPMacroServer 子进程) ---
[F1] init pid=92799 exe=LSPMacroServer comm=LSPMacroServer
[F1] dlopen(libcangjie-runtime.so) pid=92799        ← 运行时库加载
[F1] dlopen(libc.so.6) pid=92799
[F1] cmdline: LSPMacroServer, rfd=3 wfd=6           ← 管道 fd 检测
[F1] check: is_macro=1 is_macro_srv=1 from_cmdline=1 pipes_found=2
[F1] *** Macro server detected via cmdline! Injecting... ***
[F1] *** INJECTING: rfd=3 wfd=6 ***
[F1]   read defLib (20)                               ← 成功读取管道消息
[F1]   sent defLib resp                               ← 成功发送 defLib 响应
[F1]   read macroCall (20)                            ← 成功读取 macroCall 请求
[F1]   *** SENT MALICIOUS (48 bytes) ***              ← 恶意 FlatBuffers 注入成功!
```

#### 完整攻击链路

```
1. LSPServer (enableMacroInLSP=true) fork+execv LSPMacroServer
   → 创建 IPC 管道 (pipefdP2C + pipefdC2P)                    ✅ 确认
2. LD_PRELOAD .so 在 LSPMacroServer 中加载
   → constructor 执行, dlopen hook 激活                       ✅ 确认
3. dlopen hook 检测到管道 fd (rfd=3, wfd=6)
   → 通过 /proc/self/cmdline 获取                             ✅ 确认
4. f1_inject.so 模拟宏服务器流程:
   a. 读取 defLib 请求 (从 pipefdP2C[0])                     ✅ 确认
   b. 发送 defLib 响应 (到 pipefdC2P[1])                      ✅ 确认
   c. 读取 macroCall 请求                                     ✅ 确认
   d. 发送恶意 FlatBuffers 响应                               ✅ 确认
5. 客户端 (LSPServer) 收到恶意 FlatBuffers
   → 调用 DeserializeMacroCallsResult() 无 Verifier
   → GetMacroMsg(data)->content_as_macroResult()->id() = nullptr
   → nullptr->name() → SIGSEGV                               ✅ 路径确认
```

#### F1 最终定性

**F1 确认为 Critical 级真漏洞**。攻击者可以通过 LD_PRELOAD 或恶意 .so 注入 LSPMacroServer 子进程，通过 IPC 管道向 LSPServer 客户端注入恶意 FlatBuffers 消息，利用缺失的 `VerifyMacroMsgBuffer()` 导致空指针/OOB/OOM 崩溃。

触发条件：LSP 模式（LSPServer 是标准 IDE 集成工具，实际使用场景）。

## 2. 【HLE】注释闭合突破注入 (hle)

### 仓颉团队分析

1. PoC有效，如果达成注入，注入的代码可以**自动执行**
2. 实际达成注入的可行性较低：HLE生成的桥接层代码，如果有注释闭合的注入，语法高亮很明显
3. HLE工具使用场景有限

### 仓颉团队修复

- https://gitcode.com/Cangjie/cangjie_tools/issues/596
- https://gitcode.com/Cangjie/cangjie_tools/pull/1151

### 原始审计信息

| 属性          | 值                                               |
| ------------- | ------------------------------------------------ |
| **原始编号**  | Finding 18 (CAND-015)                            |
| **CWE**       | CWE-94: Code Injection                           |
| **原始 CVSS** | 6.4 (MEDIUM) AV:L/AC:L/PR:N/UI:R/S:U/C:L/I:H/A:N |
| **文件**      | `hyperlangExtension/src/tool/util.cj:12-18`      |

### 源码分析 (来自原始审计报告)

```cangjie
public func addComment(msg: String, reason!: ?String = None): Tokens {
    if (let Some(r) <- reason) {
        Tokens([Token(TokenKind.COMMENT, "// ${r}"), nl,
                Token(TokenKind.COMMENT, "/*${msg}*/"), nl])  // ← msg 未转义 */
    } else {
        Tokens([Token(TokenKind.COMMENT, "/*${msg}*/"), nl])
    }
}
```

原始报告判定：如果 `msg` 包含 `*/`，注释提前闭合，后续内容变为代码。

### 审计判定依据

原始报告判定 `addComment` 函数将不可信输入 `msg` 包裹在 `/*${msg}*/` 注释中，但不转义 `*/`。若 msg 含 `*/`，注释提前闭合，msg 后续内容变成可执行代码。

### 源码补充验证 (本次验证发现)

1. **addComment 调用点确认**：`trans_object.cj:454` 调用 `addComment(arkCategory + signature)`，signature 来自 `ObjectType.signature()` (common.cj:552-568)。
2. **signature 拼入属性值**：`ObjectType.signature()` 拼入 `properties[i].signature()`，后者 (common.cj:463-478) 拼入 `propValue`：

```cangjie
msg += "${propKey}${optionFlg}: ${propType} = ${propValue};"
```

1. **propValue 来自 .d.ts**：analysis.js (line 164-166) 用 `fileContent.substring(pos, end)` 提取注释原始文本（含 `/*` 和 `*/`），不转义。
2. **原始报告的 PoC 不可行**：报告用 `declare class "Legit */..."`（类名是字符串），但 TypeScript 语法不允许 `declare class` 的类名为 StringLiteral。
3. **实际可行载荷**：class 属性值含 `*/`（TypeScript 允许属性初始化器为字符串）。

### POC 验证过程

**POC 文件**: `tp_poc/tp9_comment_break/`

**步骤 1: 构造恶意 .d.ts**

```typescript
declare class CangjieTutorial {
    evilSample: string = "*/class AutoRunClass { static init() { // evil task } }/*";
}
```

**步骤 2: 执行 hle 生成 .cj**

```bash
hle -i evil.d.ts -o output -j ~/cangjie/tools/dtsparser/analysis.js
```

**步骤 3: 检查生成的 .cj 文件**

生成的 `evil.cj` 第 19-21 行：

```cangjie
/*class DeclareKeyword CangjieTutorial {
    evilSample: String = "*/class AutoRunClass { static init() { // evil task } }/*";
    }*/
```

解析：

- `/*class DeclareKeyword CangjieTutorial {\n    evilSample: String = "` → 注释开始
- `*/` → **注释结束!**
- `class AutoRunClass { static init() { // evil task } }` → **代码!** (不在注释里)
- `/*";\n    }` → 新注释开始
- `*/` → 注释结束

### 验证结论

**✅ 注释闭合突破确认成功**。class AutoRunClass { static init() { // evil task } } 突破注释变成代码，出现在生成的 .cj 文件中。

**但完整 RCE 链较长**：

1. 注入代码需是合法仓颉代码
2. 生成的 .cj 需能编译通过（实测因其他 hle 生成语法问题编译失败）
3. 编译产物需被执行

**影响范围窄**：hle 是小众工具，仅用于鸿蒙 ArkTS 互操作场景，大部分仓颉开发者不使用。

## 3. 【cjdb】int8_t 循环变量溢出导致无限循环和越界读取

### 仓颉团队分析

1. 编码问题，类型不匹配
2. 无攻击路径

### 仓颉团队修复

- https://gitcode.com/Cangjie/llvm-project/issues/193
- https://gitcode.com/Cangjie/llvm-project/pull/610

### 源码分析

漏洞代码位于 `ItaniumABILanguageRuntime.cpp` 第 522-536 行：

```cpp
uint8_t type_arg_num = func_ti.typeArgNum;   // 来自debuggee，范围0-255
uint64_t type_args = (uint64_t)func_ti.typeArgs;
// ...
if (type_arg_num < 1) {                       // 仅检查下限
  return CompilerType();
}
// para_typeinfo: type_args[1..type_arg_num-1]
std::vector<CompilerType> param_types;
for (int8_t i = 1; i < type_arg_num; i++) {   // 漏洞行：int8_t vs uint8_t 比较
  m_process->ReadMemory(type_args + i * BitsPerByte,   // i为负时地址下溢
                        &para_ti_addr, sizeof(uint64_t), error);
  // ...
}
```

### 数据流追踪

```
被调试进程内存中的 TypeInfo.typeArgNum (uint8_t, 攻击者可控)
  → 赋给 uint8_t type_arg_num (值域 0-255)
  → for (int8_t i = 1; i < type_arg_num; i++)
     当 type_arg_num > 127 时:
       int8_t i 从 127 溢出到 -128（C++ 有符号溢出是未定义行为）
       i < type_arg_num: int8_t(-128) vs uint8_t(200)
       → 整型提升为 int(-128) < int(200) → true → 循环继续
       type_args + (-128) * 8 → type_args - 1024 → 越界读取
  → 进程内存读取越界 → 崩溃或信息泄露
```

### 第二处同类漏洞

同一文件第 601-613 行存在第二处相同模式的漏洞：

```cpp
CompilerType ItaniumABILanguageRuntime::GetDynamicCFuncType(...) {
    int8_t type_arg_num = typeInfo.typeArgNum;  // uint8_t → int8_t 截断
    // ...
    int8_t para_num = type_arg_num - 1;
    for (int8_t i = 0; i < para_num; i++) {     // 同样的溢出模式
        // ...
    }
}
```

### 攻击可达性分析

**入口点**: 调试器在解析被调试进程中的动态类型信息时自动触发

**可达性确认**:

- `GetDynamicFuncType` 在第 396 行和 1115 行被 `GetDynamicTypeFromGenericTypeInfo` 调用
- 该函数在调试器需要解析 Cangjie 语言的函数类型时自动调用（例如：显示变量类型、表达式求值等场景）
- `typeArgNum` 字段来自被调试进程内存中的 `TypeInfo` 结构体，攻击者通过构造恶意被调试程序可完全控制该字段
- **触发无需用户交互**：调试器在 stop event 处理中自动刷新类型信息

### PoC 构造

**攻击步骤**：

1. 构造恶意 Cangjie 程序，使其在运行时创建如下的 `TypeInfo` 结构体：

```c
// 恶意 TypeInfo 结构体（在被调试进程内存中）
struct TypeInfo {
    uint64_t name;       // 任意有效指针
    uint32_t name_size;  // 任意值
    uint8_t type;        // UG_FUNC
    uint8_t typeArgNum;  // 恶意值: 200 (0xC8, >127)
    // ...
    uint64_t typeArgs;   // 指向受控内存区域
};
```

1. 使用 LLDB 调试该程序，当调试器尝试获取某个函数指针的动态类型时，触发 `GetDynamicFuncType`
2. **漏洞触发过程**：
   - `type_arg_num = 200` (uint8_t)
   - 循环 `for (int8_t i = 1; i < 200; i++)`:
     - i=1..126: 正常迭代（126次）
     - i=127: 循环体执行后 `i++`，`int8_t` 从 127 溢出为 -128（**UB**）
     - i=-128..-1: 比较 `int8_t(-128) < uint8_t(200)` → `int(-128) < int(200)` → true，继续（128次）
     - i=0..199: 正常迭代（200次）
   - **总迭代次数: 454 次**（而非预期的 199 次）
   - 当 i < 0 时，`type_args + i * 8` 计算为 `type_args - 8, type_args - 16, ...`，从 type_args 之前的内存区域读取数据
3. **影响**：
   - 越界读取：从类型参数缓冲区之前的堆/栈内存读取数据
   - `para_ti_addr` 被污染为越界读取的值
   - 后续 `ReadMemory(para_ti_addr, ...)` 在调试器进程中读取任意地址
   - `param_types.push_back(GetDynamicTypeFromGenericTypeInfo(ast, fieldti))` 可能导致堆上的 vector 无限增长（OOM）
   - 最终导致调试器崩溃

### 修复建议

```cpp
// 方案1: 将循环变量改为 uint8_t 或 size_t
for (uint8_t i = 1; i < type_arg_num; i++) { ... }

// 方案2: 添加上限检查（防止恶意 type_arg_num 值过大）
if (type_arg_num > 127 || type_arg_num < 1) {
    return CompilerType();
}

// 方案3 (最安全): 组合使用
if (type_arg_num < 1 || type_arg_num > 64) {  // 合理上限
    return CompilerType();
}
for (size_t i = 1; i < type_arg_num; i++) { ... }
```

## 4. 【std】IPv6 字面量解析器协议不兼容缺陷

### 仓颉团队分析

1. 未按RFC协议进行代码实现
2. 无攻击路径

### 仓颉团队修复

- https://gitcode.com/Cangjie/cangjie_runtime/issues/833
- https://gitcode.com/Cangjie/cangjie_runtime/pull/1708
- https://gitcode.com/Cangjie/cangjie_test/pull/2068

### 问题描述

当前版本的IPv6 解析器会错误拒绝 RFC 4291 允许的 `x:x:x:x:x:x:d.d.d.d` 形式，即：

```text
1:2:3:4:5:6:1.2.3.4
```

RFC 4291 第 2.2 节明确允许这种“6 个 hextet + 末尾嵌入 IPv4”的文本表示形式，系统 `inet_pton(AF_INET6, ...)` 也接受它。
RFC 参考：[https://www.rfc-editor.org/rfc/rfc4291.html](https://link.gitcode.com/?target=https%3A%2F%2Fwww.rfc-editor.org%2Frfc%2Frfc4291.html&from=https%3A%2F%2Fgitcode.com%2FCangjie%2Fcangjie_runtime%2Fissues%2F833&lang=zh&theme=white)

## 5. 【std】CJ_FS_OpenFile 符号链接跟随 (TOCTOU)

### 仓颉团队分析

1. 无稳定攻击路径，需要本地权限，并在竞态条件下对文件替换

### 仓颉团队修复

- https://gitcode.com/Cangjie/cangjie_runtime/issues/845
- https://gitcode.com/Cangjie/cangjie_runtime/pull/1725
- https://gitcode.com/Cangjie/cangjie_test/pull/2094

### 漏洞代码

```c
// stdlib/libs/std/fs/native/file_system_unix.c:700
extern FsInfo* CJ_FS_OpenFile(const char* path, int32_t openMode)
{
    char realPath[PATH_MAX + 1] = {0x00};
    const char* filePath = realPath;

    if (realpath(path, realPath) == NULL) {
        if (errno != ENOENT) { /* error */ return result; }
        filePath = path;     // ★ ENOENT 时回退到原始 path（可能含符号链接）
    }

    // ★ open() 未加 O_NOFOLLOW → 跟随符号链接
    int32_t fd = open(filePath, (int)(access), DEFFILEMODE);
}
```

### 漏洞描述

`CJ_FS_OpenFile` 在 `realpath()` 返回 NULL 且 `errno == ENOENT`（文件不存在）时，回退到使用原始 `path` 调用 `open()`。此处 `open()` 未设置 `O_NOFOLLOW` 标志，因此如果 `path` 是符号链接，`open()` 会跟随链接操作目标文件。

在 `realpath()` 检查与 `open()` 调用之间存在 TOCTOU 竞态窗口：攻击者可在 `realpath()` 返回 NULL（文件不存在）后、`open()` 执行前，将 `path` 替换为指向敏感文件（如 `/etc/passwd`、`/flag.txt`）的符号链接，使 `open()` 跟随链接写入或读取目标文件。

### 最小利用场景

任何使用 `std.fs.File(path, OpenMode.Write)` 创建文件的服务：

```cangjie
// 用户上传文件 — 一行代码触发
let f = File(uploadPath, OpenMode.Write)  // 内部调用 CJ_FS_OpenFile
f.write(data)
// 攻击者在 realpath → open 间隙把 uploadPath 替换为符号链接 → 任意文件覆盖
```

### PoC

```python
import os, threading, time

TARGET_FILE = "/etc/cron.d/payload"  # 目标：覆盖 cron 任务实现 RCE
UPLOAD_PATH = "/tmp/uploads/log.txt"

os.makedirs("/tmp/uploads", exist_ok=True)

def victim_create():
    """模拟 Cangjie File.create: exists → open (无 O_NOFOLLOW)"""
    if not os.path.exists(UPLOAD_PATH):
        time.sleep(0.01)  # TOCTOU 窗口
        # Cangjie 内部: open(filePath, O_WRONLY|O_CREAT|O_TRUNC) 无 O_NOFOLLOW
        with open(UPLOAD_PATH, "w") as f:
            f.write("* * * * * root cat /flag.txt > /tmp/pwned\n")

def attacker_race():
    """在 exists → open 间隙替换为符号链接"""
    time.sleep(0.005)
    try: os.unlink(UPLOAD_PATH)
    except: pass
    os.symlink(TARGET_FILE, UPLOAD_PATH)  # 指向 cron 任务文件

t1 = threading.Thread(target=victim_create)
t2 = threading.Thread(target=attacker_race)
t1.start(); t2.start()
t1.join(); t2.join()
# 如果竞态命中: /etc/cron.d/payload 被覆盖为 cron 任务 → root RCE
```

### 修复建议

在所有 `open()` 调用中添加 `O_NOFOLLOW` 标志，拒绝跟随符号链接。对创建操作使用 `O_CREAT | O_EXCL | O_NOFOLLOW` 原子创建。

## 6. 【stdx】crypto/keys 加密路径密码未清零

### 仓颉团队分析

1. 编码问题
2. 攻击路径存在，dump内存会导致信息泄露

### 仓颉团队修复

- https://gitcode.com/Cangjie/cangjie_stdx/issues/366
- https://gitcode.com/Cangjie/cangjie_stdx/pull/782

### 漏洞描述

私钥加密路径中，用户密码通过 `LibC.mallocCString(password).asResource()` 复制到 malloc 分配的堆缓冲区，传递给 C 函数 `EncryptPrivateKey`。该 C 函数使用密码进行 PKCS8 加密，但**返回前从未清零密码缓冲区**。`asResource()` 析构调用 `free()` 不清零内存 — 密码字节残留在已释放堆内存中。

**关键对比**: 解密路径 (keys.c:284) **明确调用** `memset_s` 清零密码，加密路径**没有**。

**问题代码:**

```cangjie
// keys/keys.cj:382 — 加密路径
try (passwordCStr = LibC.mallocCString(password).asResource(), ...) {
    // C 函数 EncryptPrivateKey 不清零密码
} // passwordCStr 释放但不清零 → 密码残留在已释放堆内存
// keys/native/keys.c:284 — 解密路径 (正确, 作为对比)
(void)memset_s((void*)params->password, passwordLength, 0, passwordLength);

// keys/native/keys.c:350-409 — EncryptPrivateKey (缺少 memset_s)
// line 355: passwordLength = strlen(password)
// line 373: DYN_PKCS8_set0_pbe(password, (int)passwordLength, ...)
// line 407: return CJ_OK;  ← 返回前无 memset_s
```

**数据流路径:**

```
[Source] 用户密码 (敏感输入)
  → keys.cj:382 LibC.mallocCString(password).asResource() — 复制密码到堆
  → keys.cj:388 cjX509EncryptPrivateKey(keyBytes, passwordCStr.value, ...)
  → keys.c:350 EncryptPrivateKey(password, ...)
  → keys.c:373 DYN_PKCS8_set0_pbe(password, ...) — 使用密码
  → keys.c:407 return CJ_OK — 密码未清零 ← 漏洞触发点
  → keys.cj:382 try 块退出 — asResource() dtor 调用 LibC.free()
  → free() 不清零内存 — 密码字节残留在已释放堆块中
[Sink] 已释放堆内存中的密码字节 — 可通过堆检查/内存转储恢复
```

**PoC 验证 (poc_crypto_002):**

```
验证方式: 源码对比 (加密路径 vs 解密路径)
验证结果: ✅ 非对称遗漏确认

[1] DECRYPT path (keys.c:284):
    (void)memset_s((void*)params->password, passwordLength, 0, passwordLength);
    → 密码已清零 ✓

[2] ENCRYPT path (keys.c:350-409):
    // 无 memset_s 调用
    // 密码在 DYN_PKCS8_set0_pbe(password, ...) 使用后未清零
    → 密码未清零 ✗

[3] 非对称性证明: 解密有清零, 加密没有 → 遗漏 bug
```

**触发条件:**

1. 用户调用 `encodeToDer(password: ...)` 加密私钥
2. 密码通过 `LibC.mallocCString` 复制到堆内存
3. C 函数 `EncryptPrivateKey` 使用密码但不清零
4. `try(...)` 退出，`free()` 释放但不清零
5. 密码字节残留在已释放堆块中

**攻击场景:**

- **场景 A — 堆检查**: 攻击者通过内存读取漏洞扫描已释放堆块，找到密码
- **场景 B — Core dump**: 进程崩溃后 core dump 包含堆，攻击者分析找到密码
- **场景 C — Swap**: 进程内存换出到 swap，密码在 swap 文件中

**修复建议:**

```c
// 在 keys.c EncryptPrivateKey 返回前添加 (约 line 407):
(void)memset_s((void*)password, passwordLength, 0, passwordLength);
// 或使用已有的 DYN_OPENSSL_cleanse(password, passwordLength, dynMsg)
```

## 7. 【stdx】crypto/keys 中 PKCS8 加密路径 algorithm 对象泄漏

### 仓颉团队分析

1. 编码问题
2. 无攻击路径

### 仓颉团队修复

- https://gitcode.com/Cangjie/cangjie_stdx/issues/366
- https://gitcode.com/Cangjie/cangjie_stdx/pull/782

### 问题描述

 `EncryptPrivateKey` 中 `PKCS8_set0_pbe` 失败时仅释放 `p8info`，`algorithm` 未释放。

**修复建议:** 添加 `DYN_X509_ALGOR_free(algorithm, dynMsg)` 在错误路径

## 8. 【stdx】crypto/digest 中 SM3 失败路径悬空指针导致析构二次释放

### 仓颉团队分析

1. 编码问题
2. 无攻击路径

### 仓颉团队修复

- https://gitcode.com/Cangjie/cangjie_stdx/issues/368
- https://gitcode.com/Cangjie/cangjie_stdx/pull/783

### 关键代码段

```cangjie
public func reset(): Unit {
    unsafe {
        if (!sm3Ctx.isNull()) {
            mdCtxFree(sm3Ctx)
            sm3Ctx = CPointer<Unit>()
        }
        sm3Ctx = mdCtxNew()
        try {
            var res = digestInitEx(sm3Ctx, sm3())
            if (res != 1) { throw CryptoException("...") }
        } catch (e: Exception) {
            mdCtxFree(sm3Ctx)
            throw e
        }
    }
}

~init() {
    if (!sm3Ctx.isNull()) { mdCtxFree(sm3Ctx) }
}
```

### 漏洞细节与影响

`reset()` 的 catch 分支释放 `sm3Ctx` 后没有置空；调用者捕获异常并保留对象时，析构器仍看到非空悬空指针并再次释放。仓库中的提交 `0936382` 已在相邻释放点加入置空操作，说明该生命周期不变量是已知要求。触发需要 `digestInitEx`/SM3 提供者初始化失败，常见结果是堆损坏或进程崩溃，理论上可能演变为内存破坏利用。

## 9.【stdx】HTTP/1.1 chunked 请求体绕过配置的请求大小限制

### 仓颉团队分析

1. 攻击路径存在，但属于1:1攻击范畴

### 仓颉团队修复

- https://gitcode.com/Cangjie/cangjie_stdx/issues/369
- https://gitcode.com/Cangjie/cangjie_stdx/pull/785
- https://gitcode.com/Cangjie/cangjie_test/pull/2071

### 代码文件路径

- `src/stdx/net/http/http_server1_1.cj`（问题入口，约 340-350 行）
- `src/stdx/net/http/http_body.cj`（`HttpChunkedBodyProvider` 累计未校验）
- 受影响源码修订版本：`550b27fde4b3c6372902777fc79b16c20ca04e7d`

### 问题代码

仅当请求携带 `Content-Length` 时才校验 `maxRequestBodySize`，chunked 分支直接进入 body provider：

```cangjie
// src/stdx/net/http/http_server1_1.cj
let (contentLength, chunked) = checkHeaderFields(headers, version)
if (let Some(s) <- contentLength) {
    if (maxRequestBodySize != 0 && maxRequestBodySize < s) {
        throw HttpStatusException(...)   // chunked 时 contentLength 为 None，不进入此分支
    }
}
...
case chunked =>
    request._bodySize = None
    HttpChunkedBodyProvider(this, request, readTimer)   // 未传入限制
```

provider 仅累计字节数，累计后从不与限制比较：

```cangjie
// src/stdx/net/http/http_body.cj
let chunkSize = readChunkSize()
this.contentLength += chunkSize          // 缺少与 maxRequestBodySize 的比较
if (chunkSize == 0) { eof = true; ... }
return chunkSize
```

### 问题根因

1. **限制校验仅依赖可选的 `Content-Length`**：chunked 编码无预知总量，应改为逐 chunk 累计校验，但现有代码在 `contentLength` 为 `None` 时直接跳过限制判断。
2. **`HttpChunkedBodyProvider` 未接收/比较 `maxRequestBodySize`**：每 chunk 大小累加后直接返回给 handler，缺失 `bytes_seen + chunk_size > limit` 的不变式。
3. **默认读超时为 `Duration.Max`**：即使 handler 不消费 body，`consumeRequest` 也会反复读取丢弃，攻击者可慢速发送，无超时兜底。

### 问题影响

- 未认证客户端可经 `Transfer-Encoding: chunked` 流式发送任意大小/故意慢速的请求体。
- 消耗连接、解析器、工作线程、带宽资源；handler 缓冲时还会耗尽内存。
- 默认 2 MiB 的 `maxRequestBodySize` 对 chunked 请求形同虚设；多连接并发可放大影响。
- 不涉及请求走私（现有解析已拒绝 `Content-Length` 与 `Transfer-Encoding` 共存等歧义）。

### 问题定级

**中危（Medium）**——可用性问题。可实现远程资源耗尽，但取决于连接数限制与 handler 缓冲行为，非代码执行。

## 10. 【stdx】Tar 解压可经父级符号链接删除目标目录之外的文件

### 仓颉团队分析

1. 攻击路径存在，需要有本地权限感知目录结构

### 仓颉团队修复

- https://gitcode.com/Cangjie/cangjie_stdx/issues/375
- https://gitcode.com/Cangjie/cangjie_stdx/pull/797
- https://gitcode.com/Cangjie/cangjie_test/pull/2089

### 代码文件路径

- `src/stdx/compress/tar/tar.cj`
- 受影响源码修订版本：`550b27fde4b3c6372902777fc79b16c20ca04e7d`

### 问题代码

`Tar.extract` 在覆写删除之前未校验解析后的父级路径是否仍在解压根内：

```cangjie
// src/stdx/compress/tar/tar.cj
if (exists(entryPath)) {
    if (!overwrite) {
        throw TarException("File ${entryPath} already exists and overwrite is false.")
    }
    if (!FileInfo(entryPath).isDirectory()) {
        remove(entryPath)   // 父级为符号链接时，删除会落到解压根之外
    }
}
// 父级 canonicalize 校验在 remove 之后才执行
match (entry.entryType) {
    case TarEntryType.RegularFile | TarEntryType.Directory =>
        let parentDir = entryPath.parent
        ensureRegularFileParentWithinDirectory(parentDir, destAbsoluteDir, entry.name)
    case _ => ()
}
```

符号链接与硬链接分支同样跳过解析后父级校验：

```cangjie
case TarEntryType.Symlink =>
    checkSymbolicLinkTarget(entry.linkName, entryPath, destAbsoluteDir)
    SymbolicLink.create(entryPath, to: Path(entry.linkName))
case TarEntryType.HardLink =>
    let hardLinkTarget = checkHardLinkTarget(entry.linkName, destAbsoluteDir)
    HardLink.create(entryPath, to: hardLinkTarget)
```

### 问题根因

1. **先删除后校验**：`remove(entryPath)` 在 `ensureRegularFileParentWithinDirectory` 之前执行，词法校验（`isPathWithinDirectory` + `normalize()`）无法解析已存在于解压根下的父级符号链接。
2. **符号链接/硬链接分支缺失父级校验**：仅校验了链接目标，未校验 `entryPath.parent` 解析后是否仍在解压根内。
3. **check-then-use 可竞态**：基于路径名校验后再次解析存在 TOCTOU 竞争。

### 问题影响

- 当 `overwrite: true` 且解压根下存在（或被竞态植入）父级符号链接时，攻击者可经成员名 `sub/<target>` 删除解压根之外的非目录文件。
- 符号链接/硬链接条目可在解压根之外创建链接。
- 影响以嵌入进程的权限执行外部文件系统变更（删除/链接创建）。
- 缓解条件：`overwrite: false` 会中止；私有不可变目标目录可防御预置符号链接路径。

### 问题定级

**中危（Medium）**——文件系统完整性问题。需要解压根下存在或可竞态植入的父级符号链接作为前提，非无限制的归档路径穿越。

