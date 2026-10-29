# cangjie_runtime/stdlib 异常抛出穷举分析报告

- 扫描范围：`cangjie_runtime/stdlib/libs/std/` 全部 495 个 `.cj` 源文件
- 扫描时间：2026-10-28
- 交付物：本报告 + `throw_groups_summary.csv`（归并汇总）+ `throw_points_detail.csv`（逐抛出点明细）

## 1. 统计口径与方法

### 1.1 纳入范围

| 类别 | 定义 | 数量 | 处理方式 |
|---|---|---:|---|
| 直接抛出 | `throw XxxException("文本")` / `throw Xxx()`（含跨行构造、`+` 拼接、`${...}` 插值、`?? throw`、`case => throw`） | 1779 | 参与归并 |
| 间接抛出 | 先构造异常对象变量、后 `throw 变量`（消息文本已溯源还原） | 1 | 参与归并 |
| 工厂函数抛出 | `throw exception()` 形式，异常实例由调用方以 lambda 工厂提供，类型与消息均由调用方决定 | 2 | 动态文本组，参与归并 |
| 重新抛出 | `catch (e) { throw e }` / `case Err(v) => throw v` 等，无消息文本 | 33 | 不参与归并，明细 CSV 中以 `EXCL` 标注 |

- 全量校验：源码中所有真实代码行（排除注释、`TokenKind.THROW` 声明）里的 `throw` 共 **1815** 处 + 26 处 `return Err(...)`/lambda 工厂间接抛出（在 `Result.unwrap`、`getOrThrow` 等委托点抛出）= 1779 直接 + 28 Err包装 + 2 工厂函数抛出 + 1 间接 + 33 重抛。
- 无参构造（如 `throw ParseASTException()`）按"空模板"参与归并（模板为空字符串）。
- `unittest/mock` 等处通过渲染函数（`build { ... }`）拼装的文本，消息在运行期生成，标记为"动态文本"。

### 1.2 归并规则（按确认口径）

两条抛出记录归并为同一组，当且仅当：

1. **异常类名相同**；
2. **消息模板相同**：将 `${...}` 插值统一为 `${...}` 占位符后字面文本一致（插值内部表达式不参与比较）；
3. **同一故障模式**：模板关键字 + 所属模块推导的语义类目一致（如"参数非法""越界/超限""解析失败"），避免字面相同但语义异源的误归并。

### 1.3 消息变量溯源

57 处以变量/常量/函数调用作为消息实参的抛出点已逐一溯源至源码定义，包括：

- 命名常量：`YEAR_OUT_OF_RANGE`（12 处 `ArithmeticException`）、`WRONG_TARGET_MESSAGE`（2 处 `MacroException`）
- 私有消息构建函数：`arrayIndexOutOfBoundsExceptionMessage` 系列、`stringIndexOutOfBoundsExceptionMessage`、`generateExceptionMessage`（fs/path）
- 捕获异常透传：`ContentFormatException(e.message)`（UTF-8 解码失败包装，4 处）
- 调用方传参：`InfoNotFoundException(message)`（反射查找，调用方模板已核对）
- 运行期渲染：unittest/mock 的报告类文本，标记为动态文本

## 2. 总量概览

| 指标 | 数值 |
|---|---:|
| 扫描 `.cj` 文件 | 495 |
| 异常抛出点合计 | 1843（含 28 处 `return Err(...)` / lambda 工厂间接抛出补充点） |
| 参与归并的抛出点 | 1810 |
| 异常类名种类 | 60（另有 2 处由调用方工厂函数提供异常实例） |
| 归并后的格式组 | **1074** |
| 其中仅出现 1 次的组 | 814 |
| 最大组（ParseASTException 空模板） | 142 处 |

异常体系归属：`Exception` 系 1767 处（99.2%），`Error` 系 15 处（0.8%，`OutOfMemoryError` 9 + `Error` 5 + `StackOverflowError` 1）。

### 2.1 各模块抛出点分布

| 模块 | 抛出点 | 模块 | 抛出点 |
|---|---:|---|---:|
| ast(语法树) | 398 | binary(二进制) | 30 |
| unittest(测试框架) | 296 | regex(正则) | 30 |
| time(时间) | 141 | convert(转换) | 26 |
| core(基础库) | 138 | deriving(宏派生) | 25 |
| net(网络) | 132 | io(流) | 24 |
| reflect(反射) | 115 | overflow(溢出) | 21 |
| math(数学) | 105 | argopt(参数解析) | 18 |
| fs(文件系统) | 76 | env / runtime / database | 14 / 13 / 13 |
| collection(集合) | 65 | random | 11 |
| process(进程) | 53 | posix / console | 1 / 1 |
| sync(同步) | 36 | 其余(unicode/sort/ref/interop/objectpool) | 0 |

### 2.2 抛出次数 Top 15 异常类

| 异常类 | 次数 | 典型用途 |
|---|---:|---|
| IllegalArgumentException | 433 | 参数校验（归一后 249 种模板，原文 263 种） |
| ParseASTException | 191 | AST 解析失败（空模板为主） |
| ASTException | 169 | AST 节点构造/访问错误 |
| Exception | 104 | 通用/内部错误 |
| FSException | 68 | 文件操作失败 |
| SocketException | 64 | 套接字错误 |
| MacroException | 63 | 宏展开错误 |
| TimeParseException | 61 | 时间解析失败 |
| IndexOutOfBoundsException | 52 | 索引越界 |
| InvalidDataException | 48 | 时区数据非法 |
| JsonException | 43 | JSON 解析错误 |
| ProcessException | 38 | 子进程错误 |
| IllegalTypeException | 37 | 反射类型不匹配 |
| ArithmeticException | 36 | 算术错误（含年份超界 12 处） |
| IllegalMemoryException | 31 | 内存分配失败 |

## 3. 故障模式分类汇总

按第 1.2 节规则归并出的 1074 个格式组，映射到 43 个故障模式。组数 = 消息格式种类；次数 = 该模式下抛出点数量。

| 故障模式 | 组数 | 次数 | 故障模式 | 组数 | 次数 |
|---|---:|---:|---|---:|---:|
| 参数非法 | 287 | 438 | 文件系统错误 | 12 | 13 |
| 操作失败 | 121 | 158 | 动态文本(运行期拼装) | 16 | 28 |
| AST 操作错误 | 96 | 153 | 内存问题 | 9 | 14 |
| 宏使用错误 | 58 | 67 | 并发修改 | 7 | 16 |
| 解析失败 | 67 | 128 | 不可达分支 | 7 | 23 |
| 越界/超限 | 37 | 77 | 数据模型错误 | 7 | 23 |
| 通用异常 | 36 | 51 | 时间数据非法 | 7 | 11 |
| 数值溢出 | 29 | 58 | 权限不足 | 7 | 8 |
| 状态非法 | 27 | 42 | 反射错误 | 7 | 9 |
| 重复/已存在 | 27 | 32 | 断言失败 | 3 | 4 |
| 未实现/不支持 | 26 | 33 | 正则错误 | 6 | 7 |
| 套接字错误 | 28 | 38 | SQL 错误 | 6 | 11 |
| 编码非法 | 19 | 24 | 原生交互错误 | 5 | 5 |
| 其他 | 16 | 19 | 调用失败 | 6 | 12 |
| 无消息文本(空模板) | 16 | 184 | 算术错误 / 格式非法 / Mock 使用错误 | 各1 | 3/3/1 |
| 进程错误 | 16 | 21 | 内部错误 / 超时 | 各2 | 3/2 |
| 类型非法 | 16 | 16 | 除零 / 空值访问 / 内存耗尽 / 环境错误 | 各1 | 6/3/2/1 |
| 目标不存在 | 15 | 25 |  |  |  |
| 数据格式非法 | 15 | 16 |  |  |  |

### 3.1 主要故障模式与代表格式

**参数非法（287 组 / 438 次）**，最多的模式，遍布所有模块：

- `IllegalArgumentException` `Invalid interval: 'min' must be less or equal to 'max', got 'min' = '${...}', 'max' = '${...}'.` ×13
- `IllegalArgumentException` `Buffer size is 0, need at least 1 byte.` ×12
- `IllegalArgumentException` `Invalid argument 'upper': must be positive, got '${...}'.` ×8
- `IllegalArgumentException` `Invalid argument 'x': must be in range [-1.0, 1.0].` ×6

**操作失败（121 组 / 158 次）**，文件/网络/内存/进程等系统级失败：

- `IllegalMemoryException` `Failed to allocate memory in 'setItem'.` ×7
- `IllegalArgumentException` `The part of value convert failed.` ×6（convert 数值转换）
- `ProcessException` `Failed to create process.` ×4

**AST 操作错误（96 组 / 153 次）**，ast 模块特有，含 `PropDecl has no 'get()' function.`、`Unsupported 'ArrayList<T>' in function toTokens().` 等节点访问/构造错误。

**解析失败（67 组 / 128 次）**：

- `JsonException` `Failed to parse JSON data.` ×26
- `InvalidDataException` `Failed to parse the timezone data.` ×21（tzdata 加载）
- `InvalidDataException` `Failed to parse the timezone file.` ×13

**越界/超限（37 组 / 77 次）**：

- `IllegalArgumentException` `String size '${...}' exceeds maximum allowed size '${...}'.` ×11
- `IndexOutOfBoundsException` `Buffer size ${...} is too small, need at least 2/4/8 bytes.`（各 ×6）
- `IndexOutOfBoundsException` `Index out of bounds: index is '${...}', but array size is '${...}'.`（core 数组/字符串）

**数值溢出（29 组 / 58 次）+ 移位越界（1 组 / 20 次）**：

- `OvershiftException` `Right operand exceeds bit width of left operand.` ×20（overflow 模块统一抛出）
- `ArithmeticException` `The result of year is outside the range [-999,999,999, 999,999,999].` ×12（time 模块常量 `YEAR_OUT_OF_RANGE`）
- `ArithmeticException` `Duration value overflow.` ×10（含 2 处 lambda 工厂）

**无消息文本（16 组 / 184 次）**，异常发生点不含上下文信息，排障需依赖类名与堆栈：

- `ParseASTException` 空模板 ×142（AST 解析失败，错误详情在 FFI 层）
- `ConcurrentModificationException` 空模板 ×13（集合并发修改）
- `OutOfMemoryError` 空模板 ×6 + `NoneValueException` ×3 + `TimeoutException` ×3 等

**状态非法（27 组 / 42 次）**：`IllegalSynchronizationStateException` `Inconsistent state.` ×10（sync/并发原语）、`Node does not belong to any LinkedList.` ×3 等。

**重复/已存在（27 组 / 32 次）**：ast 中重复声明检查为主，如 `This name is already defined: '${...}'.` 系列。

**未实现/不支持（26 组 / 33 次）**：跨平台/后端差异导致，如 `Interface ${...} is not supported.` ×6、Windows/POSIX 分支的功能缺失。

**套接字错误（28 组 / 38 次）**：`SocketException` 携带 `Failed to accept/write/connect/read: ...` 前缀的细分格式。

**不可达分支（7 组 / 23 次）**：`Exception` `Unreachable.` ×15（unittest 10 处 + deriving 宏展开 5 处）+ `Exception` `Unreachable code.` ×2（collection 并发队列）+ `Internal error: unexpected IPAddress type.` ×6。

### 3.2 动态文本组（15 组 / 28 次）

消息由调用方传入或运行期渲染，无静态模板，已单独成组（CSV 中模板列为 `${...}` 形式）：

| 异常类 | 次数 | 文本来源 |
|---|---:|---|
| MockFrameworkException | 9 | mock 报告渲染器（`build { ... }` DSL，含 4 处多行渲染块） |
| (调用方工厂函数) | 2 | `getOrThrow(exception: () -> Exception)` / `getOrFail` 的异常工厂，类型与消息均由调用方决定 |
| IllegalArgumentException | 3 | mock cardinality 校验 lambda、delta 校验消息、原生解析错误串（ast/ffi） |
| ParseASTException | 1 | 原生解析器错误串透传（ast/ffi） |
| InfoNotFoundException | 2 | 反射查找的调用方传参消息 |
| AssertException | 2 | unittest `fail()` 的 message 参数透传 |
| ArithmeticException / Error | 各1 | runtime 原生侧传入 |
| ExclusiveScopeException | 1 | 包装内层异常 |
| AssertIntermediateException | 1 | 断言中间态包装 |
| ExpectationFailedException / IncompatiblePackageException / MacroException / MalformedMacroException / VerificationFailedException | 各1 | 渲染报告/透传 |

### 3.3 Err 包装与 lambda 工厂抛出（28 处）

`net` 模块的 IP 解析使用 `return Err(IllegalFormatException(...))` 包装错误（25 处，模板含 `Failed to parse '${...}': ...` 与 `Expect IP/port in '${...}'` 系列），实际抛出发生在 `Result.unwrap`（`throw v`，重抛行）。`core/duration.cj` 2 处与 `net/socket_impl_common.cj` 1 处通过 `getOrThrow(lambda)` 工厂在委托点抛出。这 26 处已按其静态消息模板入组（明细 CSV 来源类型为“Err包装抛出”）。

## 4. 关键观察

1. **消息格式高度分散**：1810 个带异常抛出归并为 1074 组，其中 814 组（75%）只出现 1 次。stdlib 的异常消息以"现场即写"为主，复用模板集中在 AST（`ParseASTException`/`ASTException`）、时区数据（`InvalidDataException`）和集合/缓冲区边界检查。
2. **IllegalArgumentException 是事实上的通用校验异常**：433 次、归一后 249 种模板（原文 263 种），覆盖参数、范围、格式、状态等多种语义，故障模式横跨 7 类。若需治理，可按"参数非法 / 越界 / 格式非法"拆分更精确的异常类型。
3. **空模板异常集中在 ast 模块**：142 处 `ParseASTException()` 无消息，排障时丢失了失败原因（原生解析错误串在 FFI 层即被丢弃）。这是 stdlib 中最值得改进的一处。
4. **`Unreachable.` 兜底模式**：unittest 框架对穷举 match 的兜底共 20 处（`Unreachable.`/`Unreachable code.`，unittest 12、deriving 6、collection 2），加上 core 的 `Internal error:` 系列，构成运行时不变量断言的惯用法。
5. **Error 系使用克制**：仅 15 处（OOM/栈溢出/运行时内部错误），符合"Error 表示不可恢复"的语义。
6. **重抛模式统一**：33 处重抛全部为 catch 透传或枚举解包（`Result.unwrap` / `Future.get`），无"吞掉再抛新异常丢上下文"的反模式；但 `ContentFormatException(e.message)` 这类包装保留了原因文本。

## 5. 交付文件说明

| 文件 | 内容 | 行数 |
|---|---|---:|
| `throw_groups_summary.csv` | 每行一个归并组：组ID、异常类名、父类、消息模板(归一)、故障模式、故障模式说明、抛出次数、涉及模块、示例位置 | 1074 |
| `throw_points_detail.csv` | 每行一个抛出点：组ID、异常类名、父类、消息模板(原始/归一)、故障模式、来源类型、模块、文件、行号、源码原文；重抛行组ID为 EXCL | 1810 + 33 |
| 本报告 | 分类方法、统计、故障模式映射、观察结论 | - |

### 5.1 明细 CSV 字段说明

- **消息模板(原始)**：静态文本 + `${...}` 插值原样保留；动态文本组保留 `${...}` 占位描述。
- **消息模板(归一)**：所有 `${...}` 内部表达式统一为 `${...}` 后的文本，即归并键之一。
- **来源类型**：直接抛出 / 间接抛出(构造后抛变量) / 工厂函数抛出(调用方提供实例) / Err包装抛出 / 重新抛出。
- **组ID**：`G0001`-`G1074` 按组内抛出次数降序编号；`EXCL` 表示重新抛出（不参与归并）。

## 6. 方法与局限

- 解析器为带状态机的词法级抽取：处理块/行注释、原始字符串、转义、跨行括号配对、`+` 拼接、`${...}` 插值；已通过 40 处随机抽样回溯源码验证、全量行号对齐校验（0 偏移）和全量覆盖率校验（0 遗漏）。
- 局限 1：跨函数的间接抛出（构造异常在 A 函数、抛出在 B 函数）仅 1 处（`globalOutOfMemoryError`），已纳入；其余 51 处变量抛出均为 catch 透传，按约定排除。
- 局限 2：运行期渲染的动态文本与调用方工厂/传参消息（共 28 处、15 组，见 3.2 节）无法还原为单一静态模板，已如实标注而非强行归并。
- 局限 3：故障模式由模板关键字 + 模块上下文推导并经人工复核，属语义近似分类；同一组内故障模式必然一致，反之不同模式不会归并。
- 局限 4：`unittest/testmacro` 与 `deriving` 中 `quote(...)` 宏模板内的 9 处 `throw`（含 5 处带文本、4 处重抛）是为用户代码生成的代码片段，并非 stdlib 运行时自身抛出点；已保留在统计中并在明细 CSV 的“备注”列标出。
