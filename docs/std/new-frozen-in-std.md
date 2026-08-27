# @Frozen 注解新增情况分析报告

> 分析时间：2026-08-27

## 1. 分析范围与基线

- **基线 commit**：`ee1e549e` — `!251 merge feat_update_issue_template into main`（2025-11-14，`release/OpenHarmony-release-6.0.2` 分支从 main 的分叉点）
- **分析目标**：比较分叉点之后，`stdlib` 目录下是否新增 `@Frozen` 注解
- **排查分支**：`release/OpenHarmony-release-6.0.2`、`dev`、`main`

## 2. 结论摘要

| 分支 | `@Frozen` 总数 | 相对基线新增 |
|------|---------------|------------|
| ee1e549e（基线） | 779 | — |
| **release/OpenHarmony-release-6.0.2** | 779 | **0（无新增）** |
| dev | 784 | **+10** |
| main | 784 | **+10** |

> `release/OpenHarmony-release-6.0.2` 分支的分叉点之后 **stdlib 没有任何新增的 `@Frozen` 注解**；dev 和 main 则各有 10 处新增。

## 3. 新增 `@Frozen` 明细（dev / main，共 10 处）

### 3.1 `stdlib/libs/std/core/box.cj`（1 处）

```cangjie
public class Box<T> {
    public var value: T
    @Frozen
    public init(v: T) {
        value = v
    }
```

### 3.2 `stdlib/libs/std/unittest/measurements.cj`（9 处，本文件为新增文件）

| 序号 | 注解位置 |
|------|---------|
| 1 | `Measurement` 接口 — `func setup(): Unit {}` |
| 2 | `Measurement` 接口 — `func measure(): Float64`（默认返回 `0.0`）|
| 3 | `Measurement` 接口 — `prop info: MeasurementInfo` |
| 4 | `TimeNow` 构造 — `public init(unit: ?TimeUnit)` |
| 5 | `TimeNow` 构造 — `public init() {}` |
| 6 | `TimeNow` — `public func measure(): Float64` |
| 7 | `CpuCycles` — `public func measure(): Float64`（`GetRdtscp()`）|
| 8 | `Perf` 测量 — `public func measure(): Float64`（`ReadPerf()`）|
| 9 | `MeasurementBase` — `public func measure(): Float64`（`lastAccountedResult = measureRaw()`）|

## 4. 引入提交定位

```text
cdebc703  feat(unittest): improve benchmarking for allocation heavy code
          Author: Konstantin Anisimov <anisimov.konstantin3@huawei.com>
          Date:   Tue Oct 14 18:08:03 2025 +0300
```

**dev 分支上 Box/measurements 中新增 `@Frozen` 的溯源 commit**（`git log -L` 验证 `box.cj`、`measurements.cj` 的 `@Frozen` 均来自此提交）：

| 分支 | 引入 commit | 说明 |
|------|------------|------|
| dev | `cdebc703` | feat(unittest): improve benchmarking for allocation heavy code |
| main | `8475e6e1` | feat: sync dev to main（把 `cdebc703` 的变更同步进 main）|

**影响面**：25 个文件，+1949 / -919 行。除 `@Frozen` 外，还包含：

- 新增文件：`stdlib/libs/std/unittest/measurements.cj`（+530）、`memory_stats.cj`（+90）
- 重构文件：`bench_test_case.cj`（±934）、`bench_executor.cj`、`statistics.cj`、`report_bench_html.cj` 等
- 配套改动：`runtime/` 下 `CompilerCalls.*`、`CommonAlias.h`、`MacAlias.h`（GC 信息导出）

## 6. 其它检出到 `@Frozen` 变化的 commit（非新增来源）

`git log -S "@Frozen"` 会命中所有改变 `@Frozen` 行数的提交，但以下提交只移动/改写既有 `@Frozen`，对最终 diff **净贡献为 0**，不属于新增来源：

```text
991dc563  fix: improve benchmarking with less than O2 optimization levels
ef19a6fc  fix(math): function log/log2/log10 update comments
4c76bb8b  fix(math): fix fmod() only checks positive infinity
3e0358dd  fix: optimize the collection API of the non-iterator version
9792583f  feat: add noniterable api for collection
c1bfb722  fix: round code from sig to cangjie_runtime        (main 侧对应同步)
```

**特别说明**：同一个 commit `cdebc703` 内部既新增也删除了 `@Frozen`——
- 新增 13 处：`measurements.cj`(9)、`box.cj`(1)、`date_time.cj`(1)、`testmacro/instrumentation.cj`(2)
- 删除 6 处：`bench_test_case.cj`(4)、`statistics.cj`(1)、`date_time.cj`(1，与新增互相抵消)

最终相对基线（ee1e549e -> dev）的净变化为 **+10 / -5**，即 §3 所列内容。

## 7. 分支归属验证

```bash
# 6.0.2 分支是否包含引入 commit
git merge-base --is-ancestor cdebc703 origin/release/OpenHarmony-release-6.0.2
# => NOT in release 6.0.2

# 6.0.2 相对基线的 @Frozen 增删行数
git diff ee1e549e origin/release/OpenHarmony-release-6.0.2 -- stdlib \
  | grep -cE '^[+-][[:space:]]*@Frozen'
# => 0
```

## 8. 结论

1. **`release/OpenHarmony-release-6.0.2`**：分叉点后 stdlib 无任何 `@Frozen` 新增 / 删除，`@Frozen` 使用与基线完全一致（779 处）。
2. **`dev` / `main`**：各自新增 10 处 `@Frozen`，均源自同一个提交 `cdebc703`（unittest 基准测试重构），且两者新增内容完全相同。
3. 若目标是不让 OpenHarmony 6.0 分支无意带入新的 `@Frozen`（如验证 `@Frozen` 语义/ABI 稳定性），则当前 6.0.2 分支**无需处理**；如需与新特性对齐，则在合入 dev/main 时需关注 `cdebc703` 带来的 10 处 `@Frozen` 变更。