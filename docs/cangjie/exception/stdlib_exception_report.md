# 仓颉标准库异常类型一览

> 范围：`stdlib/libs/std` 全部源码，统计了所有 `<: Exception` / `<: Error` 的类（含二级继承）。
> 共 **67 个异常/Error 子类**（不含 `Exception`/`Error` 基类本身，其中 2 个是 Error 子类：`OutOfMemoryError`、`StackOverflowError`），逐包分布见第 19 节。
> 所有类型均与官方文档（19 个 `*_package_exceptions.md`，56 个条目）核对过；`ExceptionThrownCheckResult` 名字像异常，实际是 `ErrorCheckResult` 的子类（数据模型类），已排除。

## 0. 基类

| 基类 | 所在包 | 说明 |
|---|---|---|
| `Exception` | std.core | 所有异常的父类。`toString()` 返回 `"类名: 消息"`；`printStackTrace()` 先打印 `An exception has occurred:`，再逐帧打印 `\t at 类::方法(文件:行号)`，`causedBy` 链会打印 `Caused by: ...` |
| `Error` | std.core | 严重错误的基类（程序一般不捕获恢复）。不可继承、不可实例化，但可以 catch。`printStackTrace()` 打印 `An exception has occurred: 类名: 消息` 和堆栈 |

注意：仓颉的继承语法是 `<:`（如 `class Foo <: Exception`），不是 `extends`。

---

## 1. std.core（核心包，16 个子类 + 2 个基类）

### 1.1 Exception 子类（14 个）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `IllegalArgumentException` | Exception | 参数不合法（标准库内抛出次数最多，450+ 处） | 参数越界、含空字符、格式错误等 | `IllegalArgumentException: Invalid argument 'n': expected a positive value, got '-1'.`<br>`IllegalArgumentException: Path contains null character.` |
| `IllegalFormatException` | IllegalArgumentException | 格式串或待解析文本格式不对 | `toString("{:x}")` 格式串写错、`Ipv4Address.parse`/`Ipv6Address.parse` 解析失败 | `IllegalFormatException: Invalid CIDR network string: '10.0.0.300/24'.`<br>`IllegalFormatException: Unable to parse IP: 'abc'.` |
| `IllegalStateException` | Exception | 对象当前状态不允许该操作 | `LinkedList` 节点不在链上、Socket 重复 bind、并发读写、console 读失败 | `IllegalStateException: Socket is already bound.`<br>`IllegalStateException: Unbalanced lock-unlock invocations.` |
| `ArithmeticException` | Exception | 算术运算出错（open 类，可被继承） | 除零（编译器内建抛出点 `throwArithmeticException`）、`BigInt`/`Decimal` 除零、`Duration` 溢出 | `ArithmeticException: Division by zero.`<br>`ArithmeticException: Duration value overflow.` |
| `OverflowException` | ArithmeticException | 整数运算溢出 | `@OverflowThrowing` 注解的整数运算、`abs(Int64.Min)`、`BigInt` 转 `Int8/16/32/64` 越界、`ByteBuffer` 容量超限 | `OverflowException: The absolute value of Int64.Min overflows.`<br>`OverflowException: Value out of Int64 range.` |
| `IndexOutOfBoundsException` | Exception | 下标越界（编译器内建抛出点） | `Array`/`String`/`ArrayList` 用 `[]` 访问越界、slice 越界 | `IndexOutOfBoundsException: Index out of bounds: index is '5', but array size is '3'.`<br>`IndexOutOfBoundsException: Index out of bounds: negative index, srcStart is '-1', dstStart is '0'.` |
| `NegativeArraySizeException` | Exception | 数组长度是负数（编译器内建抛出点） | 像 `Array<Int64>(-1, repeat: 0)` 这样的负长度构造 | `NegativeArraySizeException`（通常空消息） |
| `NoneValueException` | Exception | `Option<T>` 是 `None` 时还去取值 | `Option.getOrThrow()`、`HashMap.getOrThrow`、argopt 位置参数缺失 | `NoneValueException: Value does not exist.`（无参构造则空消息） |
| `TimeoutException` | Exception | 阻塞等待超时 | `Future.get(timeout)` 等待超时 | `TimeoutException`（通常空消息） |
| `UnsupportedException` | Exception | 当前平台或场景不支持该功能 | reflect 读抽象属性的值、解析不支持的地址类型 | `UnsupportedException: Cannot get value from abstract property 'x'.`<br>`UnsupportedException: Current not supported.` |
| `IllegalMemoryException` | Exception | 内存操作错误 | `CString.subCString`/malloc 失败、`ArrayBlockingQueue` 容量分配失败 | `IllegalMemoryException: Failed to allocate memory for capacity '-1'.`<br>`IllegalMemoryException: Malloc failed.` |
| `SpawnException` | Exception | 线程创建（spawn）出错 | 线程创建失败。目前 std 内部没有抛出点，留给 runtime/用户使用 | （预留类型，std 内暂无 throw 点） |
| `IncompatiblePackageException` | Exception | 包版本不兼容 | runtime 加载字节码时检测到不兼容包（`throwImplicitException(id=3)`，由运行时注入消息） | `IncompatiblePackageException: package xxx is compiled with incompatible version.`（消息由 runtime 生成） |
| `ExclusiveScopeException` | Exception | 包装 `exclusiveScope` 闭包里抛出的异常，并保留原堆栈 | `exclusiveScope { ... }` 内部抛异常时由它重新抛出；不能主动构造，只能捕获 | `ExclusiveScopeException: <原异常消息>` |

### 1.2 Error 子类（2 个，均不可继承、不可实例化）

| 名称 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|
| `OutOfMemoryError` | 堆内存耗尽 | 对象分配失败时由 runtime `throwImplicitException(id=0/2)` 抛出 | `OutOfMemoryError`（通常空消息） |
| `StackOverflowError` | 调用栈溢出 | 无限递归等把栈耗尽（`id=1` 内建抛出点）；`printStackTrace` 会折叠重复帧并提示 `... Some frames are not displayed ...` | `StackOverflowError`（通常空消息） |

---

## 2. std.collection（1 个）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `ConcurrentModificationException` | Exception | 迭代集合时发现集合被并发修改 | `HashMap`/`TreeMap`/`ArrayList` 迭代期间被结构性修改、`HashMap.removeIf` 谓词里改集合 | `ConcurrentModificationException: The predicate cannot contain a modify operation.`（无参构造则空消息） |

## 3. std.io（2 个）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `IOException` | Exception | IO 流异常的基类 | 读写失败、seek 到流开头之前、编码转换失败 | `IOException: Failed to seek: position '-1' is before the beginning of the stream.`<br>`IOException: Failed to write Int64 value '100'.` |
| `ContentFormatException` | Exception | 读到的内容格式不符合预期 | `StringReader`/`Scanner` 读到无法按类型解析的内容（比如对非数字调 `readInt64`） | `ContentFormatException: Invalid UTF-8 sequence: input stream ended prematurely.`（常转发底层解析异常的消息） |

## 4. std.fs / std.process（各 1 个）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `FSException` | IOException | 文件/目录操作出错 | 目录已存在、路径不存在、拷贝/创建/改权限失败 | `FSException: Cannot create directory: '/tmp/a' already exists.`<br>`FSException: Invalid argument 'path': '/tmp/x' is not a directory.` |
| `ProcessException` | IOException | 子进程/当前进程操作出错 | 进程不存在或已死、kill 了被复用的 pid、命令不可用 | `ProcessException: Process '12345' does not exist.`<br>`ProcessException: Process name is unavailable.` |

## 5. std.net（2 个）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `SocketException` | IOException | Socket 操作出错 | 没连接就读写、重复 bind/connect、socket 已关闭 | `SocketException: Socket is not connected.`<br>`SocketException: Socket is already closed` |
| `SocketTimeoutException` | Exception | Socket 操作超时 | connect/read/write 超时 | `SocketTimeoutException: Failed to connect: connect timeout.` |

## 6. std.sync（1 个）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `IllegalSynchronizationStateException` | Exception | 锁/条件变量处于不该出现的状态 | 没加锁先解锁、Condition 不是这个 Monitor 创建的 | `IllegalSynchronizationStateException: Cannot unlock mutex: not locked by current thread.` |

## 7. std.env（1 个）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `EnvException` | Exception | 进程环境（命令行/环境变量/工作目录）操作失败 | `getVariables`、`setVariable`、初始化进程信息失败 | `EnvException: Failed to set variable 'PATH'.`<br>`EnvException: Process is already closed.` |

## 8. std.time（2 个）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `InvalidDataException` | Exception | 时区数据加载失败 | 解析 `/etc/localtime`、tzdata/TZIF 文件损坏、找不到时区 | `InvalidDataException: Failed to parse the timezone data.`<br>`InvalidDataException: No valid timezone file is found.` |
| `TimeParseException` | Exception | 时间字符串解析失败 | `DateTime.parse`、内容和格式对不上 | `TimeParseException: Zone offset does not match.` |

## 9. std.regex（1 个）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `RegexException` | Exception | 正则编译/匹配出错 | 正则语法错、模式编译失败、内存分配失败 | `RegexException: Failed to compile pattern '([a-z' at offset 5.` |

## 10. std.reflect（6 个，构成一条继承链）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `ReflectException` | Exception | 反射异常的基类（open） | 捕获反射相关异常时的统一父类型 | `ReflectException: <msg>`（源码里的 getClassName 末尾多带一个空格，是个已知小瑕疵） |
| `InfoNotFoundException` | ReflectException | 找不到对应的类型/成员信息 | 找不到超类信息、枚举构造器不存在 | `InfoNotFoundException: Enum constructor 'Red' not found in 'default.Color'.` |
| `MisMatchException` | ReflectException | 调用时类型对不上 | `TypeInfo` 指针强转失败、调用参数类型不匹配 | `MisMatchException: ...` |
| `IllegalSetException` | ReflectException | 试图修改不可变的类型/成员 | 通过反射 set 不可变属性 | `IllegalSetException: ...` |
| `IllegalTypeException` | ReflectException | 传入的类型不是要求的类型 | 要枚举类型却传了别的类型名 | `IllegalTypeException: Expected an enum type name (e.g. 'default.E'), but got 'default.Int'.` |
| `InvocationTargetException` | ReflectException | 包装"被调用函数内部抛出的异常" | 反射构造抽象类、调用的目标方法自己抛了异常 | `InvocationTargetException: Cannot construct abstract class 'MyAbs'.` |

## 11. std.database.sql（1 个）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `SqlException` | Exception | SQL 数据库操作异常，额外带 `sqlState`（5 字符状态码）和 `errorCode`（厂商错误码）两个属性 | 驱动重复注册、连接池已关闭、SQL 执行出错（错误码由驱动填入） | `SqlException: Connection pool is closed.`<br>`SqlException: Duplicate database driver 'sqlite'.` |

## 12. std.argmax（1 个）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `ArgumentParseException` | Exception | 命令行参数解析失败 | 选项不认识、缺选项值、选项格式不对、短选项组合里有未注册项 | `ArgumentParseException: Missing option value for '--name'.`<br>`ArgumentParseException: Unexpected value for '-v'.` |

## 13. std.ast（3 个）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `ASTException` | Exception | AST 库的通用异常 | 构造节点失败、Token 种类不对 | `ASTException: Illegal token kind: expected '@' or '@!', got 'IDENTIFIER'.` |
| `ParseASTException` | Exception | 解析源码构造 AST 节点失败 | `parseDecl`/`parseExpr` 失败、节点缺少位置信息 | `ParseASTException: 'Node' has no begin position.` |
| `MacroContextException` | Exception | 上下文宏相关接口出错 | 宏上下文的父节点检查失败（getClassName 返回的是 `MacroAssertParentException`，源码瑕疵） | `MacroContextException: Parent macro context check failed for macro '@Strategy'.` |

## 14. std.math.numeric（1 个，包内部）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `PrecisionMismatchException` | Exception | Decimal 精度对不上（非 public，包内使用） | `Decimal` 运算/缩放时精度达不到要求 | `PrecisionMismatchException`（多为空消息） |

## 15. std.overflow（2 个）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `OvershiftException` | Exception | 移位位数超过操作数位宽 | `ThrowingOp` 扩展的 `throwingShl/throwingShr`，如 `Int8.throwingShl(9)` | `OvershiftException: Right operand exceeds bit width of left operand.` |
| `UndershiftException` | Exception | 移位位数为负（文档定义：shift count < 0） | `ThrowingOp` 移位接口预留抛出点 | `UndershiftException` |

## 16. std.runtime（2 个，包内部）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `ProfilingInfoException` | Exception | CPU 采样启动/停止失败 | `startCPUProfiling`/`stopCPUProfiling` 返回失败 | `ProfilingInfoException: Failed to start cpu profiling.` |
| `MemoryInfoException` | Exception | 堆转储（heap dump）失败 | `dumpHeapData` 相关接口失败 | `MemoryInfoException: Failed to dump heap data.` |

## 17. std.unittest 系列（测试框架，23 个）

### 17.1 公开断言/框架异常（std.unittest）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `AssertException` | Exception | `@Expect`/`@Assert` 断言失败时抛出 | `assert_true(x)`、`@Expect(a == b)` 校验不过 | `AssertException: <CheckResult 渲染的失败描述>`（常为空串，失败详情由框架另外渲染） |
| `AssertIntermediateException` | Exception | `@PowerAssert` 表达式求值本身抛异常时的中间包装，带表达式、断言图和原始异常 | `@PowerAssert(x/y == 1)` 且 `y == 0` | `AssertIntermediateException: <表达式> ... original stack trace ...` |
| `UnittestException` | Exception | unittest 框架的通用异常基类（open） | 框架内部继承使用 | `UnittestException: <msg>` |
| `UnittestCliOptionsFormatException` | UnittestException | 命令行选项格式错误 | `--filter` 等选项参数写得不合要求 | `Wrong '--filter' option argument format. <expected>, got: 'xxx'.` |
| `UnittestTimeoutException` | Exception | 用例执行超时 | `@Timeout` 配置的超时到达，框架中断用例 | `UnittestTimeoutException`（空消息） |
| `ErrorWrapperException` | Exception | 把 `Error` 包装成 Exception 往外传（消息是 Error 的堆栈文本） | 框架内部把 OOM 等错误统一上报 | `<Error 的堆栈消息文本>` |
| `BenchmarkStoppedError` | Exception | 基准测试步骤中断的标记（内部类） | benchmark 里断言失败，提前结束压测循环 | `BenchmarkStoppedError`（空消息） |

### 17.2 公开校验异常（std.unittest.common）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `UnittestOptionValidationException` | Exception | 框架检查配置选项没通过 | `@Configuration` 选项没写校验器、类型不对 | `UnittestOptionValidationException: Option 'parallelism' has no validators. Use '@Validator' macro.` |
| `JsonException` | Exception（protected，包内） | unittest 内部 JSON 编解码失败 | 序列化/反序列化报告数据 | `JsonException: Invalid JSON data:\n<errMsg>` |
| `DataModelException` | Exception（protected，包内） | DataModel 数据模型类型对不上 | 反序列化时遇到 `Expected DataModelInt.` 之类的情况 | `DataModelException: Expected DataModelInt.` |

### 17.3 Mock 框架异常（std.unittest.mock，PrettyException 子类支持格式化彩色打印）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `PrettyException` | Exception & PrettyPrintable | Mock 框架异常的基类（抽象），能用 PrettyText 做格式化输出 | 仅作基类 | —— |
| `MockFrameworkException` | PrettyException | Mock API 用法不符合框架要求 | stub 验证后又去打桩、配置写错 | `MockFrameworkException: <格式化描述>` |
| `MockFrameworkInternalError` | PrettyException | 框架内部错误，正常使用不会碰到 | 框架自身 bug 的防御性抛出 | `MockFrameworkInternalError: <格式化描述>` |
| `ExpectationFailedException` | PrettyException | mock 配置的期望（Expectation）没被满足 | 期望调用 3 次实际只调了 1 次 | `ExpectationFailedException: Expectation violated: ...`（PrettyText 报告） |
| `UnstubbedInvocationException` | PrettyException | 被测调用没有对应的 stub | 调了没打桩的 mock 函数 | `UnstubbedInvocationException: ...` |
| `UnhandledCallException` | PrettyException | 所有 stub 都没处理这个调用 | 多个 stub 全都不匹配 | `UnhandledCallException: ...` |
| `VerificationFailedException` | PrettyException | `verify` 校验失败 | `@Verify` 校验调用次数/参数不满足 | `VerificationFailedException: ...` |

### 17.4 Mock 内部异常（std.unittest.mock.internal，protected 包）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `IllegalMockCallException` | Exception | 在 runtime-error mock 模式或非 frozen 泛型函数里调了 mock 函数 | 在不允许的上下文里用 mock | `Mock functions shouldn't be called in the runtime-error mocking mode or inside non-frozen generic functions` |
| `NoDefaultValueForMockException` | Exception | mock 返回类型没有默认值实现 | stub 的返回类型没实现 `DefaultValue` 等接口 | `No provided default value for a return type \`MyType\`. Make sure such type implements \`DefaultValue<MyType>\` interface` |
| `MockReturnValueTypeMismatchException` | Exception | stub 返回值类型和声明对不上 | `@Stub` 返回类型写错 | `Type of the stub's return value doesn't match the corresponding declaration's return type. Please make sure that type in stub is \`Int64\`` |
| `UninitializedStaticCallHandler` | Exception | 静态声明的调用处理器没初始化就被用 | 框架内部防御 | `Call handler for static declarations should be initialized before its usage` |

### 17.5 测试宏异常（std.unittest.testmacro / std.unittest.mock.mockmacro，macro 包内部）

| 异常名称 | 继承自 | 作用 | 典型抛出场景 | 消息示例 |
|---|---|---|---|---|
| `MacroException` | Exception | 测试宏展开失败（消息自动加前缀 `macro failed to expand.\n`） | `@Strategy` 等宏放在了不合适的声明上 | `Test framework: macro failed to expand.\n@Strategy macro must be placed on a function.`（getClassName 返回 `Test framework`，源码瑕疵） |
| `MalformedMacroException` | Exception | mock 宏源码语法错误（带语法错误列表） | `@Mock` 宏展开时解析失败 | `MalformedMacroException: <message>` |

---

## 18. 几个值得注意的规律

1. **两棵树**：`Exception` 对应预期内、可以恢复的错误；`Error`（`OutOfMemoryError`/`StackOverflowError`）是严重故障，程序一般只捕获记录，不做恢复。
2. **编译器/runtime 内建抛出点**（`core/runtime_call_throw_exception.cj`）：除零→`ArithmeticException("Division by zero.")`、整数溢出→`OverflowException`、数组越界→`IndexOutOfBoundsException`、负数组长度→`NegativeArraySizeException`、栈溢出→`StackOverflowError`、OOM→`OutOfMemoryError`、包不兼容→`IncompatiblePackageException`。写代码时这些异常不需要手动 throw，编译器会自动插入。
3. **消息风格很统一**，常见模板：
   - `Invalid argument 'X': <原因>.`（IllegalArgumentException）
   - `Failed to <动作>: <原因>.`（FSException/EnvException/ProcessException/RegexException）
   - `<对象> is/has been <状态>.`（SocketException/ProcessException/IllegalStateException）
4. **异常打印格式**：
   ```text
   An exception has occurred:
   ArithmeticException: Division by zero.
       at std.math.numeric::divide(big_int.cj:903)
   Caused by: <cause 链，可选>
   ```
5. **包内部异常**（`PrecisionMismatchException`、`ProfilingInfoException`、`MemoryInfoException`、`JsonException`、`DataModelException`、mock internal 系列、macro 包异常）没有公开导出，用户代码引不到，捕获时只能按父类型处理。

## 19. 逐包统计

**口径**：公开文档（19 个 `*_package_exceptions.md`）收录了 56 个条目（54 个具体异常 + `Exception`/`Error` 基类）；另有 13 个只在源码里出现、公开文档没提的内部类型：

`BenchmarkStoppedError`、`ErrorWrapperException`（std.unittest 内部）｜`JsonException`、`DataModelException`（std.unittest.common，protected）｜`IllegalMockCallException`、`NoDefaultValueForMockException`、`MockReturnValueTypeMismatchException`、`UninitializedStaticCallHandler`（std.unittest.mock.internal，protected）｜`MacroException`（std.unittest.testmacro，macro 包）｜`MalformedMacroException`（std.unittest.mock.mockmacro，macro 包）｜`PrecisionMismatchException`（std.math.numeric，包内）｜`ProfilingInfoException`、`MemoryInfoException`（std.runtime 内部）。

| 包 | 数量 | 异常类型 |
|---|---|---|
| std.core | 16 | ArithmeticException, OverflowException, IllegalArgumentException, IllegalFormatException, IllegalStateException, IndexOutOfBoundsException, NegativeArraySizeException, NoneValueException, TimeoutException, UnsupportedException, IllegalMemoryException, SpawnException, IncompatiblePackageException, ExclusiveScopeException, OutOfMemoryError(Error), StackOverflowError(Error)（另有 Exception/Error 基类本身） |
| std.collection | 1 | ConcurrentModificationException |
| std.io | 2 | IOException, ContentFormatException |
| std.fs | 1 | FSException |
| std.process | 1 | ProcessException |
| std.net | 2 | SocketException, SocketTimeoutException |
| std.sync | 1 | IllegalSynchronizationStateException |
| std.env | 1 | EnvException |
| std.time | 2 | InvalidDataException, TimeParseException |
| std.regex | 1 | RegexException |
| std.reflect | 6 | ReflectException, InfoNotFoundException, MisMatchException, IllegalSetException, IllegalTypeException, InvocationTargetException |
| std.database.sql | 1 | SqlException |
| std.argmax | 1 | ArgumentParseException |
| std.ast | 3 | ASTException, ParseASTException, MacroContextException |
| std.math.numeric | 1 | PrecisionMismatchException |
| std.overflow | 2 | OvershiftException, UndershiftException |
| std.runtime | 2 | ProfilingInfoException, MemoryInfoException |
| std.unittest(+common/mock/testmacro) | 23 | AssertException, AssertIntermediateException, UnittestException, UnittestCliOptionsFormatException, UnittestTimeoutException, ErrorWrapperException, BenchmarkStoppedError, UnittestOptionValidationException, JsonException, DataModelException, PrettyException, MockFrameworkException, MockFrameworkInternalError, ExpectationFailedException, UnstubbedInvocationException, UnhandledCallException, VerificationFailedException, IllegalMockCallException, NoDefaultValueForMockException, MockReturnValueTypeMismatchException, UninitializedStaticCallHandler, MacroException, MalformedMacroException |
