# APIKG4SYN 代码仓分析报告

> 分析日期：2026-08-15

## 1. 项目概述

**APIKG4SYN** 是一个研究论文代码仓，目标是利用 **API 知识图谱（Knowledge Graph）** 自动生成 HarmonyOS/ArkTS 的 **API 合成训练数据**，用于微调大型语言模型（LLM），然后通过 **HarmonyOS Benchmark** 评测微调效果。

完整流水线分为 4 个阶段：

```
HarmonyOS API 源码文档 (.d.ts)
        │
        ▼
 ① 知识图谱构建 (construct_KG)      ──►  Neo4j 知识图谱 + info_score
        │
        ▼
 ② 单 API 数据生成 (generate_single_api_data)      ──►  6400-Single-API.json
        │
 ③ 多 API 数据生成 (generate_multi_api_data) ──►  1600-Multi-API.json  (配 MCTS)
        │
        ▼
   OHBen.json (8000 条合并数据集)  ──►  微调 LLM
        │
        ▼
 ④ 评测 (eval)  ──►  HarmonyOS Benchmark (108 条)  ──►  pass@1
```

## 2. 目录结构

```
APIKG4SYN/
├── config/                          # 全局配置（LLM Key/URL、Neo4j 连接）
├── construct_KG/                    # ① 知识图谱构建
│   ├── extract_api_info.py          #    解析 .d.ts 声明文件 → JSON
│   ├── json2KG.py                   #    JSON → Neo4j 图
│   ├── UE_score.py                  #    LLM 打分计算 info_score
│   └── utils.py                     #    LoggerWriter 日志重定向
├── generate_single_api_data/        # ② 单 API 数据生成
│   ├── generate_single_api_data.py  #    LangGraph 主流程
│   ├── node.py                      #    图节点：出题、生成代码、Neo4j 查询
│   ├── prompt.py                    #    出题/写代码 Prompt 模板
│   └── util.py                      #    编译诊断提取与编译模拟
├── generate_multi_api_data/         # ③ 多 API 数据生成
│   ├── generate_multi_api_data.py   #    MCTS 路径搜索 + LangGraph 主流程
│   ├── node.py / prompt.py / util.py
├── eval/                            # ④ 评测
│   ├── eval.py                      #    LLM 生成代码，写入 DevEco 工程
│   ├── run_with_eval_out_benchmark.py  # 跑单元测试，算 pass@1
│   ├── feedback.bat                 #    hvigorw test 编译脚本
│   └── utils.py                     #    编译诊断解析
├── HarmonyOS-API/                   # 776 个 HarmonyOS API 声明文件（.d.ts / .d.ets）
├── 6400-Single-API.json             # 6,400 条单 API 训练数据
├── 1600-Multi-API.json              # 1,600 条多 API 训练数据
├── OHBen.json                       # 8,000 条（1,600 + 6,400 合并），用于微调
├── HarmonyOS Benchmark.json         # 108 条人工评测集（instruction/code/test）
├── eval_data/                       # 各模型评测实验结果
│   ├── deepseek/  gpt/  mistral/  qwen/
└── RQ3_group/                       # RQ3 消融实验分组数据
```

## 3. 各阶段详解

### 3.1 知识图谱构建 `construct_KG/`

**`extract_api_info.py`**（718 行，核心解析器）
- 基于**状态机**（`process_by_state_machine`）逐行扫描 `.d.ts` 文件中的 JSDoc 注释块（`/** ... */`）
- 通过正则识别模块级结构：`class` / `interface` / `namespace` / `enum` / `struct` / `type_alias` / `method` / `property` / `call_signature` / `enum_member` / `export_import`
- 维护 `上级`（parent）与 `所属模块`，输出带层级（`层级` 字段）的节点 JSON
- 模块名从 `@kit` 注释提取

**`json2KG.py`**
- 用 `MERGE` 幂等写入 Neo4j，类型映射为 `Module/Class/Interface/Property/Method/Enum/...` 标签
- 构建 `HAS_METHOD` / `HAS_PROPERTY` 等父子关系 + `BELONGS_TO` 模块关系
- `build_unique_key` 递归生成带层级前缀的唯一键

**`UE_score.py`**（信息量/不确定性评估）
- 对每个含成员的非叶节点，把成员语料喂给 LLM，让其按"成员属于该结构体的概率"打分 0~1
- 用信息熵公式 `Σ -log2(p)` 汇总为 `info_score` 写入节点
- info_score 后续供多 API 生成的 MCTS 当作路径权重使用

### 3.2 单 API 数据生成 `generate_single_api_data/`

- 基于 **LangGraph 状态图**：

```
START → generate_question → generate_code ──(router)──► (generate_code | END)
```

- `generate_comprehensive_question`：查 Neo4j 获取实体成员 corpus，让 LLM 一次生成 `num=3` 道练习题，且强制题目显式指定用到的 API 方法/属性
- `generate_student_code`：LLM 生成 ArkTS 实现代码，`save_student_code` 保存到 DevEco 工程的 `functions/` 目录
- 数据字段：`module / entity / labels / question / student_code`

### 3.3 多 API 数据生成 `generate_multi_api_data/`

核心贡献，在单 API 基础上引入了 **MCTS（蒙特卡洛树搜索）**：

1. `build_nx_graph`：以模块下所有带 `info_score` 的节点为点，**两两全连接**，边权 = 两端点平均分
2. `mcts_search`：对排在前 `start_nodes_limit` 的高分节点各跑一次 MCTS，内含 **选择（UCB1）/ 扩展 / 模拟 / 回溯**
3. `extract_top_paths`：取 top-k 路径，每条路径随机采样 2~3 个节点组成 `entity_group`
4. 组合多个 API 生成**跨 API 练习题**（`multi_api_question_prompt`）

### 3.4 评测 `eval/`

- `eval.py`：逐条把 Benchmark 的 `instruction` + `test` 交给 LLM，生成 ArkTS 代码，按测试文件 import 路径回填到工程
- `run_with_eval_out_benchmark.py`：将生成代码与单元测试写入工程，调用 `feedback.bat`（`hvigorw test`）真实编译执行测试，统计 **pass@1**
- `eval_data/`：DeepSeek / Qwen / Mistral / GPT 各模型结果，含 `-with_out_SFT`（无微调基线）与不同训练数据量（2000/4000/6000/8000）的对比

## 4. 数据集详情

| 文件 | 条数 | 字段 | 用途 |
|---|---|---|---|
| `6400-Single-API.json` | 6,400 | instruction / input / output / system / history | 微调 |
| `1600-Multi-API.json` | 1,600 | instruction / input / output / system / history | 微调 |
| `OHBen.json` | 8,000 | 上面两者合并 | 微调最终版 |
| `HarmonyOS Benchmark.json` | 108 | instruction / code / test | 评测（pass@1） |
| `eval_data/*` | 108×模型 | … / model_output / test_passed | 评测结果 |

## 5. 当前存在的问题

### 5.1 不可直接运行
- `config/__init__.py:6-16`：API Key、URL、Neo4j 账号密码、模型名全部为 `"Your ..."` 占位符
- 大量硬编码 Windows 路径（`/root/research/...`、`path\to\your\...`），依赖 DevEco Studio 环境
- 无 `requirements.txt` / 依赖清单，无法一键复现

### 5.2 疑似未提交的 Bug
- `generate_single_api_data/node.py:130`：`generate_student_code` 引用了未定义的变量 `entity_name_str` / `entity_desc_str`（会抛 `NameError`）——与其在 `generate_comprehensive_question` 中已设好的状态变量不一致
- `generate_single_api_data.py:77`：输出文件名为 `training_data_{module}_{safe_name}_{version}`，其中 `{module}` 与 `{safe_name}` 均派生自同一 module，文件名冗余/易冲突
- `generate_multi_api_data.py:210`：`sample_nodes_per_path=random.randint(2,3)` 在类初始化时只求值一次，随机性被削弱

### 5.3 文档与代码不一致
- README 写 `1400-Multi-API.json`，实际文件名为 `1600-Multi-API.json`
- 代码内 `@kit` module 名、路径均为占位，需逐个替换才能运行

### 5.4 其他
- 仅支持 Windows 批处理（`feedback.bat`），无跨平台方案
- 生成/评测过程依赖本地 Neo4j 服务开启

## 6. 技术栈

| 组件 | 用途 |
|---|---|
| LangChain / LangGraph | Agent 状态图编排（出题→写码循环） |
| Neo4j (Python Driver) | API 知识图谱存储与查询 |
| networkx | MCTS 搜索图构建 |
| pydantic | 结构化 LLM 输出（TypedDict 约束） |
| langchain-openai / langchain-ollama | LLM 后端 |
| hvigorw / DevEco Studio | ArkTS 编译与单元测试执行 |

## 7. 复现步骤（概览）

1. 安装依赖并配置 `config/__init__.py`（LLM、Neo4j）
2. `python construct_KG/extract_api_info.py` 解析 API 文档 → JSON
3. `python construct_KG/json2KG.py` 导入 Neo4j
4. `python construct_KG/UE_score.py` 计算 info_score
5. `python generate_single_api_data/generate_single_api_data.py` 生成单 API 数据
6. `python generate_multi_api_data/generate_multi_api_data.py` 生成多 API 数据（MCTS）
7. 用 OHBen.json 微调 LLM
8. `python eval/eval.py` 生成模型输出，`python eval/run_with_eval_out_benchmark.py` 统计 pass@1