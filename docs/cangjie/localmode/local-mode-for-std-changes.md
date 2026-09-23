# 标准库 local mode 适配变更总览

## interface Iterable<E>

```cangjie
public interface Iterable<E> {
    // 原始
    func iterator(): Iterator<E>

    // 新增
    func iterator(this @ local!): Iterator<E> @ local! {
        throw IllegalStateException("Current Type does not implement 'iterator' method for its @local! instance")
    }

    // 新增
    func iterator(this @ local?): Iterator<E> @ local? {
        throw IllegalStateException("Current Type does not implement 'iterator' method for its @local? instance")
    }

}
```

## abstract class Iterator<T>

```cangjie
public abstract class Iterator<T> <: Iterable<T> {
    // ---- 核心抽象方法 ----
    // 原始
    func next(): Option<T>

    // 新增
    public open func next(this @ local!): Option<T> @ local! {
        throw IllegalStateException("Current iterator does not implement 'next' method for its @local! instance")
    }

    // 新增
    public open func next(this @ local?): Option<T> @ local? {
        throw IllegalStateException("Current iterator does not implement 'next' method for its @local? instance")
    }

    // ---- 构造函数（新增） ----
    // 新增
    @Frozen
    public init(this @ local!) {}

    // 新增
    @Frozen
    public init(this @ local?) {}

    // ---- 自迭代（iterator 返回 this） ----
    // 新增
    @Frozen
    public func iterator(this @ local!): Iterator<T> @ local! { this }

    // 新增
    @Frozen
    public func iterator(this @ local?): Iterator<T> @ local? { this }

}
```

## interface ToString

```cangjie
public interface ToString {
    // 原始
    func toString(): String

    // 新增
    func toString(this @local?): String @local! {
        throw UnimplementedException("Current Type does not implement 'toString' method for its @local? instance")
    }

}
```

## class UnimplementedException（std.core 新增）

```cangjie
public class UnimplementedException <: Exception {
    // ---- 构造函数（全新类，无原始 API） ----
    // 新增
    public init()

    // 新增
    public init(message: String)

    // ---- 成员函数 ----
    // 新增
    protected override func getClassName(): String {
        return "UnimplementedException"
    }

}
```

## interface Parsable<T>

```cangjie
public interface Parsable<T> {
    // 原始
    static func parse(value: String): T

    // 原始
    static func tryParse(value: String): Option<T>

    // 新增
    static func parse(value: String @local?): T @local!

    // 新增
    static func tryParse(value: String @local?): Option<T> @local!

}
```

## interface Comparable<T>

```cangjie
public interface Comparable<T> <: Equatable<T> & Less<T> & Greater<T> & LessOrEqual<T> & GreaterOrEqual<T> {
    // 原始
    func compare(other: T): Ordering

    // 新增
    func compare(this @local?, other: T @local?): Ordering

    // 原始
    operator func <(other: T): Bool

    // 新增
    operator func <(this @local?, other: T @local?): Bool

    // 原始
    operator func >(other: T): Bool

    // 新增
    operator func >(this @local?, other: T @local?): Bool

    // 原始
    operator func <=(other: T): Bool

    // 新增
    operator func <=(this @local?, other: T @local?): Bool

    // 原始
    operator func >=(other: T): Bool

    // 新增
    operator func >=(this @local?, other: T @local?): Bool

}
```

## interface Hashable

```cangjie
public interface Hashable {
    // 原始
    func hashCode(): Int64

    // 新增
    func hashCode(this @local?): Int64

}
```

## interface Equatable<T>（含 Equal / NotEqual）

```cangjie
public interface Equatable<T> <: Equal<T> & NotEqual<T> {
    // ---- Equal<T> ----
    // 原始
    operator func ==(other: T): Bool

    // 新增
    operator func ==(this @ local?, other: T @ local?): Bool

    // ---- NotEqual<T> ----
    // 原始
    operator func !=(other: T): Bool

    // 新增
    operator func !=(this @ local?, other: T @ local?): Bool

    // ---- Equatable<T>（默认实现） ----
    // 新增
    operator func !=(this @ local?, other: T @ local?): Bool {
        !(this == other)
    }

}
```

## interface Collection<T>

```cangjie
public interface Collection<T> <: Iterable<T> {
    // 原始
    prop size: Int64

    // 原始
    func isEmpty(): Bool

    // 新增
    func isEmpty(this @ local?): Bool

    // 原始
    func toArray(): Array<T>

    // 新增
    func toArray(this @ local!): Array<T> @ local!

    // 新增
    func toArray(this @ local?): Array<T> @ local?

}
```

## interface ReadOnlyList<T>

```cangjie
public interface ReadOnlyList<T> <: Collection<T> {
    // 原始
    prop first: ?T

    // 新增
    prop first: ?T @local!

    // 新增
    prop first: ?T @local?

    // 原始
    prop last: ?T

    // 新增
    prop last: ?T @local!

    // 新增
    prop last: ?T @local?

    // 原始
    func get(index: Int64): ?T

    // 新增
    func get(this @ local!, index: Int64): ?T @ local!

    // 新增
    func get(this @ local?, index: Int64): ?T @ local?

    // 原始
    operator func [](index: Int64): T

    // 新增
    operator func [](this @ local!, index: Int64): T @ local!

    // 新增
    operator func [](this @ local?, index: Int64): T @ local?

}
```

## interface List<T>

```cangjie
public interface List<T> <: ReadOnlyList<T> {
    // ---- 设置内部成员（只适配 @local!） ----
    // 原始
    func add(element: T): Unit

    // 新增
    func add(this @ local!, element: T @ local!): Unit

    // 原始
    func add(all!: Collection<T>): Unit

    // 新增
    func add(this @ local!, all!: Collection<T> @ local!): Unit

    // 原始
    func add(element: T, at!: Int64): Unit

    // 新增
    func add(this @ local!, element: T @ local!, at!: Int64): Unit

    // 原始
    func add(all!: Collection<T>, at!: Int64): Unit

    // 新增
    func add(this @ local!, all!: Collection<T>, at!: Int64): Unit

    // ---- 删除 / 清空（@local!） ----
    // 原始
    func remove(at!: Int64): T

    // 新增
    func remove(this @ local!, at!: Int64): T @ local!

    // 原始
    func remove(range: Range<Int64>): Unit

    // 新增
    func remove(this @ local!, range: Range<Int64> @ local?): Unit

    // 原始
    func removeIf(predicate: (T) -> Bool): Unit

    // 新增
    func removeIf(predicate: ((T @ local!) -> Bool) @ local?): Unit

    // 原始
    func clear(): Unit

    // 新增
    func clear(this @ local!): Unit

    // ---- 设置内部成员（[]=/@local!） ----
    // 原始
    operator func [](index: Int64, value!: T): Unit

    // 新增
    operator func [](this @ local!, index: Int64, value!: T @ local!): Unit

}
```

## interface ListOfCopyable<T>（std.collection 新增接口）

```cangjie
public interface ListOfCopyable<T> <: ReadOnlyList<T> where T <: Copyable {
    // 新增
    func add(this @local?, element: T): Unit

    // 新增
    func add(this @local?, all!: Collection<T> @local?): Unit

    // 新增
    func add(this @local?, element: T, at!: Int64): Unit

    // 新增
    func add(this @local?, all!: Collection<T> @local?, at!: Int64): Unit

    // 新增
    func remove(this @local?, at!: Int64): T

    // 新增
    func remove(this @local?, range: Range<Int64> @local?): Unit

    // 新增
    func removeIf(this @local?, predicate: ((T) -> Bool) @local?): Unit

    // 新增
    func clear(this @local?): Unit

    // 新增
    operator func [](this @local?, index: Int64, value!: T): Unit

}
```

## extend<T> Array<T> where T <: Copyable（Copyable 扩展）

```cangjie
extend<T> Array<T> where T <: Copyable {
    // 原始
    @Frozen
    public operator func [](index: Int64, value!: T): Unit

    // 新增
    public operator func [](this @local?, index: Int64, value!: T): Unit

    // 原始
    @Frozen
    public operator func [](range: Range<Int64>, value!: Array<T>): Unit

    // 新增
    public operator func [](this @local?, range: Range<Int64> @local?, value!: Array<T> @local?): Unit

    // 原始
    @Frozen
    public func fill(value: T): Unit

    // 新增
    public func fill(this @local?, value: T): Unit

    // 原始
    @Frozen
    public func swap(index1: Int64, index2: Int64): Unit

    // 新增
    public func swap(this @local?, index1: Int64, index2: Int64): Unit

    // 原始
    @Frozen
    public func reverse(): Unit

    // 新增
    public func reverse(this @local?): Unit

    // 原始
    @Frozen
    public func copyTo(dst: Array<T>, srcStart: Int64, dstStart: Int64, copyLen: Int64): Unit

    // 原始
    @Frozen
    public func copyTo(dst: Array<T>): Unit

    // 新增
    public func copyTo(this @local?, dst: Array<T> @local?, srcStart: Int64, dstStart: Int64, copyLen: Int64): Unit

    // 新增
    public func copyTo(this @local?, dst: Array<T> @local?): Unit

}
```

## struct Array<T>

```cangjie
public struct Array<T> {
    // ---- 构造函数 ----
    // 原始
    @Frozen
    public const init()

    // 新增
    public const init(this @local!)

    // 原始
    @Frozen
    public init(size: Int64, repeat!: T)

    // 新增
    public init(this @local!, size: Int64, repeat!: T @local!)

    // 原始
    @Frozen
    public init(size: Int64, initElement: (Int64) -> T)

    // 新增
    public init(this @local!, size: Int64, initElement: ((Int64) -> T @local!) @ local?)

    // 新增
    init(this @local!, elements: Collection<T> @local!)

    // 新增
    init(this @local?, elements: Collection<T> @local?)

    // 新增
    public init(this @local?, size: Int64, initElement: ((Int64) -> T @local?) @ local?)

    // ---- 等价于构造函数的方法（产生新实例，@local! 版本） ----
    // 原始
    @Frozen
    public func slice(start: Int64, len: Int64): Array<T>

    // 新增
    @Frozen
    public func slice(this @local!, start: Int64, len: Int64): Array<T> @local!

    // 新增
    @Frozen
    public func slice(this @local?, start: Int64, len: Int64): Array<T> @local?

    // 原始
    @Frozen
    public func clone(): Array<T>

    // 新增
    @Frozen
    public func clone(this @local!): Array<T> @local!

    // 新增
    @Frozen
    public func clone(this @local?): Array<T> @local?

    // 原始
    @Frozen
    public func clone(range: Range<Int64>): Array<T>

    // 新增
    @Frozen
    public func clone(this @local!, range: Range<Int64> @ local?): Array<T> @local!

    // 新增
    @Frozen
    public func clone(this @local?, range: Range<Int64> @ local?): Array<T> @local?

    // 原始
    @Frozen
    public func copyTo(dst: Array<T>, srcStart: Int64, dstStart: Int64, copyLen: Int64): Unit

    // 新增
    public func copyTo(this @local!, dst: Array<T> @local!, srcStart: Int64, dstStart: Int64, copyLen: Int64): Unit

    // 原始
    @Frozen
    public func copyTo(dst: Array<T>): Unit

    // 新增
    public func copyTo(this @local!, dst: Array<T> @local!): Unit

    // 原始
    @Frozen
    public func concat(other: Array<T>): Array<T>

    // 新增
    public func concat(this @local!, other: Array<T> @local!): Array<T> @local!

    // 原始
    @Frozen
    public func splitAt(mid: Int64): (Array<T>, Array<T>)

    // 新增
    @Frozen
    public func splitAt(this @local!, mid: Int64): (Array<T>, Array<T>) @local!

    // 新增
    @Frozen
    public func splitAt(this @local?, mid: Int64): (Array<T>, Array<T>) @local?

    // 原始
    @Frozen
    public func repeat(n: Int64): Array<T>

    // 新增
    public func repeat(this @local!, n: Int64): Array<T> @local!

    // 原始
    @Frozen
    public func map<R>(transform: (T) -> R): Array<R>

    // 新增
    public func map<R>(this @local!, transform: ((T @local!) -> R @local!) @local?): Array<R> @local!

    // 原始
    @When[env != "ohos"]
    public func step(count: Int64): Array<T>

    // 新增
    @When[env != "ohos"]
    public func step(this @local!, count: Int64): Array<T> @local!

    // 原始
    @When[env != "ohos"]
    public func take(count: Int64): Array<T>

    // 新增
    @When[env != "ohos"]
    public func take(this @local!, count: Int64): Array<T> @local!

    // 原始
    @When[env != "ohos"]
    public func skip(count: Int64): Array<T>

    // 新增
    @When[env != "ohos"]
    public func skip(this @local!, count: Int64): Array<T> @local!

    // 原始
    @When[env != "ohos"]
    public func filter(predicate: (T) -> Bool): Array<T>

    // 新增
    @When[env != "ohos"]
    public func filter(this @local!, predicate: ((T @local?) -> Bool) @local?): Array<T> @local!

    // 原始
    @When[env != "ohos"]
    public func flatMap<R>(transform: (T) -> Array<R>): Array<R>

    // 新增
    @When[env != "ohos"]
    public func flatMap<R>(this @local!, transform: ((T @local!) -> Array<R> @local!) @local?): Array<R> @local!

    // 原始
    @When[env != "ohos"]
    public func filterMap<R>(transform: (T) -> ?R): Array<R>

    // 新增
    @When[env != "ohos"]
    public func filterMap<R>(this @local!, transform: ((T @local!) -> ?R @local!) @local?): Array<R> @local!

    // 原始
    @When[env != "ohos"]
    public func intersperse(separator: T): Array<T>

    // 新增
    @When[env != "ohos"]
    public func intersperse(this @local!, separator: T @local!): Array<T> @local!

    // 原始
    @When[env != "ohos"]
    public func forEach(action: (T) -> Unit): Unit

    // 新增
    @When[env != "ohos"]
    public func forEach(this @local!, action: ((T @local!) -> Unit) @local?): Unit

    // ---- prop（first / last） ----
    // 原始
    @Frozen
    public prop first: Option<T>

    // 新增
    public prop first: Option<T> @local!

    // 新增
    public prop first: Option<T> @local?

    // 原始
    @Frozen
    public prop last: Option<T>

    // 新增
    public prop last: Option<T> @local!

    // 新增
    public prop last: Option<T> @local?

    // ---- 获取内部数据（get / [] / indexOf / lastIndexOf） ----
    // 原始
    @Frozen
    public func get(index: Int64): Option<T>

    // 新增
    @Frozen
    public func get(this @local!, index: Int64): Option<T> @local!

    // 新增
    @Frozen
    public func get(this @local?, index: Int64): Option<T> @local?

    // 原始
    @Frozen
    public operator func [](index: Int64): T

    // 新增
    @Frozen
    public operator func [](this @local!, index: Int64): T @local!

    // 新增
    @Frozen
    public operator func [](this @local?, index: Int64): T @local?

    // 原始
    @Frozen
    public operator func [](range: Range<Int64>): Array<T>

    // 新增
    @Frozen
    public operator func [](this @local!, range: Range<Int64>): Array<T> @local!

    // 新增
    @Frozen
    public operator func [](this @local?, range: Range<Int64>): Array<T> @local?

    // 原始
    @Frozen
    public func indexOf(element: T): Option<Int64>

    // 原始
    @Frozen
    public func indexOf(element: T, fromIndex: Int64): Option<Int64>

    // 原始
    @Frozen
    public func indexOf(elements: Array<T>): Option<Int64>

    // 原始
    @Frozen
    public func indexOf(elements: Array<T>, fromIndex: Int64): Option<Int64>

    // 新增
    @Frozen
    public func indexOf(this @local?, element: T @local?, fromIndex: Int64): Option<Int64>

    // 新增
    public func indexOf(this @local?, elements: Array<T> @local?): Option<Int64>

    // 新增
    public func indexOf(this @local?, elements: Array<T> @local?, fromIndex: Int64): Option<Int64>

    // 原始
    @Frozen
    public func lastIndexOf(element: T): Option<Int64>

    // 原始
    @Frozen
    public func lastIndexOf(element: T, fromIndex: Int64): Option<Int64>

    // 原始
    @Frozen
    public func lastIndexOf(elements: Array<T>): Option<Int64>

    // 原始
    @Frozen
    public func lastIndexOf(elements: Array<T>, fromIndex: Int64): Option<Int64>

    // 新增
    @Frozen
    public func lastIndexOf(this @local?, element: T @local?): Option<Int64>

    // 新增
    @Frozen
    public func lastIndexOf(this @local?, element: T @local?, fromIndex: Int64): Option<Int64>

    // 新增
    @Frozen
    public func lastIndexOf(this @local?, elements: Array<T> @local?): Option<Int64>

    // 新增
    @Frozen
    public func lastIndexOf(this @local?, elements: Array<T> @local?, fromIndex: Int64): Option<Int64>

    // ---- 设置内部成员（[]=/fill，@local! 版本） ----
    // 原始
    @Frozen
    public operator func [](index: Int64, value!: T): Unit

    // 新增
    @Frozen
    public operator func [](this @local!, index: Int64, value!: T @local!): Unit

    // 原始
    @Frozen
    public operator func [](range: Range<Int64>, value!: Array<T>): Unit

    // 新增
    @Frozen
    public operator func [](this @local!, range: Range<Int64>, value!: Array<T> @local!): Unit

    // 原始
    @Frozen
    public func fill(value: T): Unit

    // 新增
    @Frozen
    public func fill(this @local!, value: T @local!): Unit

    // ---- 原地数据变换（@local! 版本） ----
    // 原始
    @Frozen
    public func reverse(): Unit

    // 新增
    @Frozen
    public func reverse(this @local!): Unit

    // 原始
    @Frozen
    public func swap(index1: Int64, index2: Int64): Unit

    // 新增
    @Frozen
    public func swap(this @local!, index1: Int64, index2: Int64): Unit

    // ---- 判定与计算 ----
    // 原始
    @Frozen
    public func isEmpty(): Bool

    // 新增
    @Frozen
    public func isEmpty(this @local?): Bool {
        return this.len == 0
    }

    // 原始
    @When[env != "ohos"]
    public func all(predicate: (T) -> Bool): Bool

    // 新增
    @When[env != "ohos"]
    public func all(this @ local?, predicate: ((T @ local?) -> Bool) @ local?): Bool

    // 原始
    @When[env != "ohos"]
    public func any(predicate: (T) -> Bool): Bool

    // 新增
    @When[env != "ohos"]
    public func any(this @ local?, predicate: ((T @ local?) -> Bool) @ local?): Bool

    // 原始
    @When[env != "ohos"]
    public func none(predicate: (T) -> Bool): Bool

    // 新增
    @When[env != "ohos"]
    public func none(this @ local?, predicate: ((T @ local?) -> Bool) @ local?): Bool

    // 原始
    @When[env != "ohos"]
    public func fold<R>(initial: R, operation: (R, T) -> R): R

    // 新增
    @When[env != "ohos"]
    public func fold<R>(this @local!, initial: R @ local!, operation: ((R, T) @ local! -> R @ local!) @local?): R @local!

    // 原始
    @When[env != "ohos"]
    public func reduce(operation: (T, T) -> T): Option<T>

    // 原始
    public func zip<R>(other: Array<R>): Array<(T, R)>

    // 原始
    public func enumerate(): Array<(Int64, T)>

    // 原始
    @Frozen
    public func contains(element: T): Bool

    // 原始
    @Frozen
    public func trimStart(set: Array<T>) / trimEnd(...) / removePrefix(...) / removeSuffix(...)

    // 原始
    public func flatten(): Array<T>

    // ---- Collection / Equatable / ToString 接口实现 ----
    // 原始
    @Frozen
    public prop size: Int64

    // 原始
    @Frozen
    public func iterator(): Iterator<T>

    // 原始
    @Frozen
    public func toArray(): Array<T>

    // 原始
    @Frozen
    public func toString(): String

    // 原始
    @Frozen
    public const operator func ==(other: Array<T>): Bool / !=（Equatable 扩展）

}
```

## struct String

```cangjie
public struct String <: Collection<Byte> & Comparable<String> & Hashable & ToString {
    // ---- 构造函数 ----
    // 原始
    public static const empty: String = String()

    // 原始
    @Frozen
    public const init()

    // 新增
    public const init(this @local!)

    // 原始
    @Frozen
    public init(value: Array<Rune>)

    // 新增
    @Frozen
    public init(this @local!, value: Array<Rune> @ local?)

    // 原始
    @Frozen
    public init(value: Collection<Rune>)

    // 新增
    @Frozen
    public init(this @local!, value: Collection<Rune> @local?)

    // 新增
    public init(this @local!, value: String @ local?)

    // 新增
    public init(value: String @ local?)

    // ---- 等价于构造函数的方法（产生新串，@local! 版本） ----
    // 原始
    @Frozen
    public func clone(): String

    // 新增
    public func clone(this @local!): String @local!

    // 原始
    @Frozen
    public func toArray(): Array<Byte>

    // 新增
    public func toArray(this @local!): Array<Byte> @local!

    // 原始
    @Frozen
    public func toRuneArray(): Array<Rune>

    // 新增
    @Frozen
    public func toRuneArray(this @local!): Array<Rune> @local!

    // 原始
    @Frozen
    public operator const func +(other: String): String

    // 新增
    @Frozen
    public operator func +(this @local!, other: String @local?): String @local!

    // 原始
    @Frozen
    public operator const func *(count: Int64): String

    // 新增
    @Frozen
    public operator func *(this @local!, count: Int64): String @local!

    // 原始
    @Frozen
    public func replace(old: String, new: String): String

    // 新增
    @Frozen
    public func replace(this @local!, old: String @local!, new: String @local?): String @local!

    // 原始
    @Frozen
    public func toAsciiLower(): String

    // 新增
    @Frozen
    public func toAsciiLower(this @local!): String @local!

    // 原始
    @Frozen
    public func toAsciiUpper(): String

    // 新增
    @Frozen
    public func toAsciiUpper(this @local!): String @local!

    // 原始
    @Frozen
    public func toAsciiTitle(): String

    // 新增
    @Frozen
    public func toAsciiTitle(this @local!): String @local!

    // 原始
    @Frozen
    public func trimAscii(): String

    // 新增
    @Frozen
    public func trimAscii(this @local!): String @local!

    // 原始
    @Frozen
    public func trimAsciiStart(): String

    // 新增
    @Frozen
    public func trimAsciiStart(this @local!): String @local!

    // 原始
    @Frozen
    public func trimAsciiEnd(): String

    // 新增
    @Frozen
    public func trimAsciiEnd(this @local!): String @local!

    // 原始
    @Frozen
    public func removePrefix(prefix: String): String

    // 新增
    @Frozen
    public func removePrefix(this @local!, prefix: String @local?): String @local!

    // 原始
    @Frozen
    public func removeSuffix(suffix: String): String

    // 新增
    @Frozen
    public func removeSuffix(this @local!, suffix: String @local?): String @local!

    // 原始
    @Frozen
    public func split(str: String, removeEmpty!: Bool = false): Array<String>

    // 新增
    @Frozen
    public func split(this @local!, str: String @local?, removeEmpty!: Bool = false): Array<String> @local!

    // 原始
    @Frozen
    public func split(str: String, maxSplits: Int64, removeEmpty!: Bool = false): Array<String>

    // 新增
    @Frozen
    public func split(this @local!, str: String @local?, maxSplits: Int64, removeEmpty!: Bool = false): Array<String> @local!

    // 原始
    @Frozen
    public static func fromUtf8(utf8Data: Array<UInt8>): String

    // 新增
    @Frozen
    public static func fromUtf8(utf8Data: Array<UInt8> @ local?): String @local!

    // 原始
    @Frozen
    public unsafe static func fromUtf8Unchecked(utf8Data: Array<UInt8>): String

    // 新增
    @Frozen
    public unsafe static func fromUtf8Unchecked(utf8Data: Array<UInt8> @ local?): String @local!

    // 原始
    @Frozen
    public static func join(strArray: Array<String>, delimiter!: String = String.empty): String

    // 新增
    @Frozen
    public static func join(strArray: Array<String> @local!, delimiter!: String): String @local!

    // 原始
    @Frozen
    public func padStart(totalWidth: Int64, padding!: String = " "): String

    // 新增
    @Frozen
    public func padStart(this @local!, totalWidth: Int64, padding!: String = " "): String @local!

    // 原始
    @Frozen
    public func padEnd(totalWidth: Int64, padding!: String = " "): String

    // 新增
    @Frozen
    public func padEnd(this @local!, totalWidth: Int64, padding!: String = " "): String @local!

    // 原始
    @Frozen
    public unsafe func rawData(): Array<Byte>

    // 新增
    @Frozen
    public unsafe func rawData(this @local!): Array<Byte> @local!

    // ---- prop（size） ----
    // 原始
    @Frozen
    public prop size: Int64

    // 新增
    public prop size: Int64 @local?

    // ---- 判定类（@local? 版本） ----
    // 原始
    @Frozen
    public func isEmpty(): Bool

    // 新增
    public func isEmpty(this @local?): Bool

    // 原始
    @Frozen
    public func isAscii(): Bool

    // 新增
    public func isAscii(this @local?): Bool

    // 原始
    @Frozen
    public func isAsciiBlank(): Bool

    // 新增
    public func isAsciiBlank(this @local?): Bool

    // 原始
    @Frozen
    public func contains(str: String): Bool

    // 新增
    public func contains(this @local?, str: String @local?): Bool

    // 原始
    @Frozen
    public func startsWith(prefix: String): Bool

    // 新增
    @Frozen
    public func startsWith(this @local?, prefix: String @local?): Bool

    // 原始
    @Frozen
    public func endsWith(suffix: String): Bool

    // 新增
    @Frozen
    public func endsWith(this @local?, suffix: String @local?): Bool

    // 原始
    @Frozen
    public func equalsIgnoreAsciiCase(other: String): Bool

    // 新增
    @Frozen
    public func equalsIgnoreAsciiCase(this @local?, other: String @local?): Bool

    // ---- 获取内部数据 ----
    // 原始
    @Frozen
    public func get(index: Int64): Option<Byte>

    // 新增
    @Frozen
    public func get(this @local?, index: Int64): Option<Byte>

    // 原始
    @Frozen
    public operator const func [](index: Int64): Byte

    // 新增
    @Frozen
    public operator const func [](this @local?, index: Int64): Byte

    // 原始
    @Frozen
    public operator const func [](range: Range<Int64>): String

    // 新增
    @Frozen
    public operator const func [](this @local!, range: Range<Int64> @ local?): String @local!

    // 新增
    @Frozen
    public operator const func [](this @local?, range: Range<Int64> @ local?): String @local?

    // 原始
    @Frozen
    public func indexOf(b: Byte): Option<Int64> / indexOf(b, fromIndex)

    // 原始
    @Frozen
    public func indexOf(str: String): Option<Int64> / indexOf(str, fromIndex)

    // 新增
    @Frozen
    public func indexOf(this @local?, b: Byte): Option<Int64>

    // 新增
    @Frozen
    public func indexOf(this @local?, str: String @local?): Option<Int64>

    // 原始
    @Frozen
    public func lastIndexOf(b: Byte)(, fromIndex) / lastIndexOf(str)(, fromIndex)

    // 原始
    @Frozen
    public func count(str: String): Int64

    // 原始
    @Frozen
    public func lazySplit(str: String, removeEmpty!: Bool = false)(, maxSplits)

    // ---- Comparable 接口（比较，@local? 版本） ----
    // 原始
    @Frozen
    public func compare(str: String): Ordering

    // 新增
    @Frozen
    public func compare(this @local?, str: String @local?): Ordering

    // 原始
    @Frozen
    public operator const func ==(other: String): Bool / !=

    // 新增
    @Frozen
    public operator const func ==(this @local?, other: String @local?): Bool

    // 新增
    @Frozen
    public operator const func !=(this @local?, other: String @local?): Bool

    // 原始
    @Frozen
    public operator const func <(other: String): Bool

    // 新增
    @Frozen
    public operator const func <(this @local?, other: String @local?): Bool

    // 原始
    @Frozen
    public operator const func <=(other: String): Bool

    // 新增
    @Frozen
    public operator const func <=(this @local?, other: String @local?): Bool

    // 原始
    @Frozen
    public operator const func >(other: String): Bool

    // 新增
    @Frozen
    public operator const func >(this @local?, other: String @local?): Bool

    // 原始
    @Frozen
    public operator const func >=(other: String): Bool

    // 新增
    @Frozen
    public operator const func >=(this @local?, other: String @local?): Bool

    // ---- Hashable 接口 ----
    // 原始
    @Frozen
    public func hashCode(): Int64

    // 新增
    @Frozen
    public func hashCode(this @local?): Int64

    // ---- ToString 接口 ----
    // 原始
    @Frozen
    public func toString(): String

    // 新增
    @Frozen
    public func toString(this @local?): String @local!

    // ---- 迭代器 ----
    // 原始
    @Frozen
    public func iterator(): Iterator<Byte>

    // 新增
    @Frozen
    public func iterator(this @local!): Iterator<Byte> @local!

    // 新增
    @Frozen
    public func iterator(this @local?): Iterator<Byte> @local?

    // 原始
    @Frozen
    public func runes(): Iterator<Rune>

    // 新增
    @Frozen
    public func runes(this @local!): Iterator<Rune> @local!

    // 新增
    @Frozen
    public func runes(this @local?): Iterator<Rune> @local?

    // 原始
    @Frozen
    public func lines(): Iterator<String>

    // 新增
    @Frozen
    public func lines(this @local!): Iterator<String> @local!

    // 新增
    @Frozen
    public func lines(this @local?): Iterator<String> @local?

    // 原始
    public func lastIndexOf(b: Byte, fromIndex: Int64) 等 4 个变体 / count / lazySplit×2 / trimStart(set)×3 / trimEnd(set)×3 / withRawData / checkUtf8Encoding / getBytes×2 / getSize

}
```

## class ArrayList<T>

```cangjie
public class ArrayList<T> <: List<T> {
    // ---- 构造函数 ----
    // 原始
    @Frozen
    public init()

    // 新增
    @Frozen
    public init(this @local!)

    // 原始
    @Frozen
    public init(capacity: Int64)

    // 新增
    @Frozen
    public init(this @local!, capacity: Int64)

    // 原始
    @Frozen
    public init(size: Int64, initElement: (Int64) -> T)

    // 新增
    @Frozen
    public init(this @local!, size: Int64, initElement: ((Int64) -> T @local!) @local?)

    // 原始
    @Frozen
    public init(elements: Collection<T>)

    // 新增
    @Frozen
    public init(this @local!, elements: Collection<T> @local!)

    // 原始
    @Frozen
    public static func of(elements: Array<T>): ArrayList<T>

    // 原始
    @Frozen
    public unsafe func getRawArray(): Array<T>

    // 新增
    @Frozen
    public init(this @local?, elements: Collection<T> @local?)

    // 新增
    @Frozen
    public init(this @local?, size: Int64, initElement: ((Int64) -> T @local?) @ local?)

    // ---- 等价于构造函数的方法（@local! 版本） ----
    // 原始
    @Frozen
    public func toArray(): Array<T>

    // 新增
    @Frozen
    public func toArray(this @local!): Array<T> @local!

    // 新增
    @Frozen
    public func toArray(this @local?): Array<T> @local?

    // 原始
    @Frozen
    public func clone(): ArrayList<T>

    // 新增
    @Frozen
    public func clone(this @local!): ArrayList<T> @local!

    // 新增
    @Frozen
    public func clone(this @local?): ArrayList<T> @local?

    // 原始
    @When[env != "ohos"]
    public func filter(predicate: (T) -> Bool): ArrayList<T>

    // 新增
    @When[env != "ohos"]
    public func filter(this @local!, predicate: ((T @local?) -> Bool) @local?): ArrayList<T> @local!

    // 原始
    @When[env != "ohos"]
    public func map<R>(transform: (T) -> R): ArrayList<R>

    // 新增
    @When[env != "ohos"]
    public func map<R>(this @local!, transform: ((T @local!) -> R @local!) @local?): ArrayList<R> @local!

    // 原始
    @When[env != "ohos"]
    public func flatMap<R>(transform: (T) -> ArrayList<R>): ArrayList<R>

    // 新增
    @When[env != "ohos"]
    public func flatMap<R>(this @local!, transform: ((T @local!) -> ArrayList<R> @local!) @local?): ArrayList<R> @local!

    // 原始
    @When[env != "ohos"]
    public func filterMap<R>(transform: (T) -> ?R): ArrayList<R>

    // 新增
    @When[env != "ohos"]
    public func filterMap<R>(this @local!, transform: ((T @local!) -> ?R @local!) @local?): ArrayList<R> @local!

    // 原始
    @When[env != "ohos"]
    public func step(count: Int64): ArrayList<T>

    // 新增
    @When[env != "ohos"]
    public func step(this @local!, count: Int64): ArrayList<T> @local!

    // 原始
    @When[env != "ohos"]
    public func take(count: Int64): ArrayList<T>

    // 新增
    @When[env != "ohos"]
    public func take(this @local!, count: Int64): ArrayList<T> @local!

    // 原始
    @When[env != "ohos"]
    public func skip(count: Int64): ArrayList<T>

    // 新增
    @When[env != "ohos"]
    public func skip(this @local!, count: Int64): ArrayList<T> @local!

    // 原始
    @When[env != "ohos"]
    public func intersperse(separator: T): ArrayList<T>

    // 新增
    @When[env != "ohos"]
    public func intersperse(this @local!, separator: T @local!): ArrayList<T> @local!

    // 原始
    @When[env != "ohos"]
    public func zip<R>(other: ArrayList<R>): ArrayList<(T, R)>

    // 新增
    @When[env != "ohos"]
    public func zip<R>(this @local!, other: ArrayList<R> @local!): ArrayList<(T, R)> @local!

    // 原始
    @When[env != "ohos"]
    public func enumerate(): ArrayList<(Int64, T)>

    // 新增
    @When[env != "ohos"]
    public func enumerate(this @local!): ArrayList<(Int64, T)> @local!

    // 原始
    @When[env != "ohos"]
    public func fold<R>(initial: R, operation: (R, T) -> R): R

    // 新增
    @When[env != "ohos"]
    public func fold<R>(this @local!, initial: R @local!, operation: ((R, T) @local! -> R @local!) @local?): R @local!

    // 原始
    @When[env != "ohos"]
    public func reduce(operation: (T, T) -> T): Option<T>

    // 新增
    @When[env != "ohos"]
    public func reduce(this @local!, operation: ((T, T) @local! -> T @local!) @local?): Option<T> @local!

    // ---- prop（capacity / size / first / last） ----
    // 原始
    @Frozen
    public prop capacity: Int64

    // 新增
    public prop capacity: Int64 @local?

    // 原始
    @Frozen
    public prop size: Int64

    // 新增
    public prop size: Int64 @local?

    // 原始
    @Frozen
    public prop first: ?T

    // 新增
    public prop first: ?T @local!

    // 新增
    public prop first: ?T @local?

    // 原始
    @Frozen
    public prop last: ?T

    // 新增
    public prop last: ?T @local!

    // 新增
    public prop last: ?T @local?

    // ---- 获取内部数据（get / [] / slice） ----
    // 原始
    @Frozen
    public func get(index: Int64): ?T

    // 新增
    @Frozen
    public func get(this @local!, index: Int64): ?T @local!

    // 新增
    @Frozen
    public func get(this @local?, index: Int64): ?T @local?

    // 原始
    @Frozen
    public operator func [](index: Int64): T

    // 新增
    @Frozen
    public operator func [](this @local!, index: Int64): T @local!

    // 新增
    @Frozen
    public operator func [](this @local?, index: Int64): T @local?

    // 原始
    @Frozen
    public func slice(range: Range<Int64>): ArrayList<T>

    // 新增
    @Frozen
    public func slice(this @local!, range: Range<Int64> @local?): ArrayList<T> @local!

    // 新增
    @Frozen
    public func slice(this @local?, range: Range<Int64> @local?): ArrayList<T> @local?

    // 原始
    @Frozen
    public operator func [](range: Range<Int64>): ArrayList<T>

    // 新增
    @Frozen
    public operator func [](this @local!, range: Range<Int64> @local?): ArrayList<T> @local!

    // 新增
    @Frozen
    public operator func [](this @local?, range: Range<Int64> @local?): ArrayList<T> @local?

    // ---- List 接口成员（设置内部成员，@local! 版本） ----
    // 原始
    @Frozen
    public func add(element: T): Unit

    // 新增
    @Frozen
    public func add(this @local!, element: T @local!): Unit

    // 原始
    @Frozen
    public func add(all!: Collection<T>): Unit

    // 新增
    @Frozen
    public func add(this @local!, all!: Collection<T> @local!): Unit

    // 原始
    @Frozen
    public func add(element: T, at!: Int64): Unit

    // 新增
    @Frozen
    public func add(this @local!, element: T @local!, at!: Int64): Unit

    // 原始
    @Frozen
    public func add(all!: Collection<T>, at!: Int64): Unit

    // 原始
    @Frozen
    public func remove(at!: Int64): T

    // 新增
    @Frozen
    public func remove(this @local!, at!: Int64): T @local!

    // 原始
    @Frozen
    public func remove(range: Range<Int64>): Unit

    // 新增
    @Frozen
    public func remove(this @local!, range: Range<Int64> @ local?): Unit

    // 原始
    @Frozen
    public func removeIf(predicate: (T) -> Bool): Unit

    // 新增
    @Frozen
    public func removeIf(this @local!, predicate: ((T @local!) -> Bool) @local?): Unit

    // 原始
    @Frozen
    public func clear(): Unit

    // 新增
    @Frozen
    public func clear(this @local!): Unit

    // 原始
    @Frozen
    public operator func [](index: Int64, value!: T): Unit

    // 新增
    @Frozen
    public operator func [](this @local!, index: Int64, value!: T @local!): Unit

    // ---- 原地数据变换 / 排序 ----
    // 原始
    @Frozen
    public func reverse(): Unit

    // 新增
    @Frozen
    public func reverse(this @local!): Unit

    // 原始
    @Frozen
    public func reserve(additional: Int64): Unit

    // 原始
    @Frozen
    public func sort(stable!: Bool) / sort() / sortDescending(...)

    // 原始
    @Frozen
    public func sortBy(comparator!: (T, T) -> Ordering) 等 2 个

    // ---- 判定与计算 ----
    // 原始
    @Frozen
    public func isEmpty(): Bool

    // 新增
    @Frozen
    public func isEmpty(this @local?): Bool

    // 原始
    @When[env != "ohos"]
    public func all(predicate: (T) -> Bool): Bool

    // 新增
    @When[env != "ohos"]
    public func all(this @local?, predicate: ((T @local?) -> Bool) @local?): Bool

    // 原始
    @When[env != "ohos"]
    public func any(predicate: (T) -> Bool): Bool

    // 新增
    @When[env != "ohos"]
    public func any(this @local?, predicate: ((T @local?) -> Bool) @local?): Bool

    // 原始
    @When[env != "ohos"]
    public func none(predicate: (T) -> Bool): Bool

    // 新增
    @When[env != "ohos"]
    public func none(this @local?, predicate: ((T @local?) -> Bool) @local?): Bool

    // 原始
    @Frozen
    public func contains(element: T): Bool

    // 原始
    @Frozen
    public func toString(): String

    // 原始
    @Frozen
    public operator func ==(other: ArrayList<T>) / !=

    // ---- 迭代器 ----
    // 原始
    @Frozen
    public func iterator(): Iterator<T>

    // 新增
    @Frozen
    public func iterator(this @local!): Iterator<T> @local!

    // 新增
    @Frozen
    public func iterator(this @local?): Iterator<T> @local?

}
```

## extend<T> ArrayList<T> <: ListOfCopyable<T> where T <: Copyable（ArrayList Copyable 扩展）

```cangjie
extend<T> ArrayList<T> <: ListOfCopyable<T> where T <: Copyable {
    // ---- List 设置方法的 @local? 版本（实现 ListOfCopyable<T>） ----
    // 新增
    public func add(this @local?, element: T): Unit

    // 新增
    public func add(this @local?, all!: Collection<T> @local?): Unit

    // 新增
    public func add(this @local?, element: T, at!: Int64): Unit

    // 新增
    public func add(this @local?, all!: Collection<T> @local?, at!: Int64): Unit

    // 新增
    public func remove(this @local?, at!: Int64): T

    // 新增
    public func remove(this @local?, range: Range<Int64> @local?): Unit

    // 新增
    public func removeIf(this @local?, predicate: ((T) -> Bool) @local?): Unit

    // 新增
    public func clear(this @local?): Unit

    // 新增
    public operator func [](this @local?, index: Int64, value!: T): Unit

    // ---- ArrayList 特有方法（不在 List/ListOfCopyable 接口中） ----
    // 新增
    @Frozen
    public func reverse(this @local?): Unit

    // 新增
    @Frozen
    public func reserve(this @local?, additional: Int64): Unit

}
```

## class HashMap<K, V>（最小化按需适配）

```cangjie
public class HashMap<K, V> <: Map<K, V> where K <: Hashable & Equatable<K> {
    // ---- 构造函数 ----
    // 新增
    @Frozen
    public init(this @local!)

    // 新增
    @Frozen
    public init(this @local!, capacity: Int64)

    // ---- 设置内部成员 ----
    // 新增
    @Frozen
    public func add(this @local!, key: K @local!, value: V @local!): Option<V> @local!

    // ---- 获取内部数据 ----
    // 新增
    @Frozen
    public func get(this @local!, key: K @local?): Option<V> @local!

    // 新增
    @Frozen
    public func get(this @local?, key: K @local?): Option<V> @local?

    // ---- 判定类 ----
    // 新增
    @Frozen
    public func contains(this @local?, key: K @local?): Bool

    // ---- prop ----
    // 新增
    @Frozen
    public prop size: Int64 @local?

}
```
