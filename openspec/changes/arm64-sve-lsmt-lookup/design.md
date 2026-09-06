# Design: arm64-sve-lsmt-lookup

## Context

LSMT 线性化 B+ 树的查找策略已是模板参数：`IndexLBPT<KeyType, SearchPolicy = DefaultInnerSearch>`（`src/overlaybd/lsmt/index.cpp:330`），x86_64 上由 `is_avx512f_supported()` 在建索引时选择 `Avx512InnerSearch`（`index.cpp:373`）。树下行每层调用一次 `inner_search`（`index.cpp:216`）；节点 = 16×u32 或 8×u64 key，恰好一条 cache line。ARM64 目前只有标量 `DefaultInnerSearch`。

真机实测（Kunpeng 920 7280Z，openEuler 24.03，gcc 12.3，微基准 `/root/armbench/`，正确性对拍零失配）：

| 内核 | 标量 | NEON-128 | SVE-256 |
|---|---|---|---|
| u32 / 16 keys | 23.6 ns | 12.0 ns (2.0x) | 8.1 ns (2.9x) |
| u64 / 8 keys | 15.9 ns | 13.1 ns (1.2x) | 8.3 ns (1.9x) |

该机器 SVE VL=32B（256-bit），但 **HWCAP2_SVE2=0**——是 SVE1；`/proc/cpuinfo` 的 svei8mm/svebf16/svef64mm 标志不代表 SVE2。gcc12 -O3 不会自动向量化 bitmask 归约循环（`-fopt-info-vec` 零输出），手写 intrinsic 无免费替代。

## Goals / Non-Goals

**Goals:**
- aarch64 查找内核 SIMD 加速：按硬件档位阶梯自适应——SVE2 / SVE1 / NEON / 标量四级，语义与标量逐位一致
- 二进制可移植：SVE 代码按需编译、运行时按 HWCAP 分派；老工具链（devtoolset-7）构建不受阻
- x86_64 及磁盘格式零改动，diff 最小化，保持上游可贡献形态

**Non-Goals:**
- 不做 zstd/lz4 解压路径或 CRC32C 的改造（CRC32C 已走 ARM 硬件指令）
- 不为本内核引入 SVE2-only 指令（compare+count 无 SVE2 受益指令；档位与探测位已预留，未来受益内核再增第二编译单元）；不承诺非鲲鹏 ARM 上的具体倍数
- 不引入新的第三方依赖（SVE via ACLE arm_sve.h，随编译器提供）
- 不做端到端 fio 调优（作为验证任务而非设计目标）

## Decisions

**D1 — 复用 SearchPolicy 模板位，不改架构。** 新增 `NeonInnerSearch` / `SveInnerSearch` 两个 policy struct（与 `DefaultInnerSearch`/`Avx512InnerSearch` 同签名：`static uint32_t inner_search(const KeyType*, KeyType)`），在 `new_index_with_lineriazed_bptree()` 的选择点扩展。*备选*：统一成单一 dispatch header——拒绝，diff 大且破坏 x86 现有形态。

**D2 — 选择逻辑：硬件档位阶梯与 x86 对偶。** aarch64 运行时按四级档位分派并报告：

| 档位 | 探测位 | 实现 | 示例硬件 |
|---|---|---|---|
| SVE2 | HWCAP_SVE + HWCAP2_SVE2 | SVE TU（SVE1 是 SVE2 严格子集，同一代码） | Neoverse V2/Grace、Graviton4 |
| SVE1 | HWCAP_SVE | SVE TU（VL-agnostic whilelt 写法） | 鲲鹏 920 (256-bit)、Graviton3 |
| NEON | aarch64 架构保证，免检 | NeonInnerSearch | NEON-only 机器 |
| 标量 | — | DefaultInnerSearch | 语义参考/编译降级终态 |

HWCAP2_SVE2 仅用于档位识别与日志；NEON 为 aarch64 架构基线，免运行时检查。*备选*：为 SVE2 单独编译单元——拒绝，compare+count 内核无 SVE2 受益指令，重复 TU 无收益；探测位已为未来受益内核预留扩展点。aarch64 无 `__builtin_cpu_supports` 型设施，getauxval 是标准做法（Linux 4.15+ 支持 SVE，目标内核 6.6）。

**D3 — SVE 编译单元独立编译，flag 固定 `-march=armv8.2-a+sve`，单一 TU 服务 SVE1+SVE2 档。** 根 CMakeLists 的全局 `-march=armv8-a+crc` 不含 SVE，且不能全局提升（上游需覆盖所有 aarch64）。SVE 函数放独立 .cpp + 独立编译选项；VL-agnostic 写法天然覆盖 128/256/512-bit 向量长度。**硬规则：禁用 `+sve2`**（鲲鹏 920 实测 HWCAP2_SVE2=0，SVE2 指令会 SIGILL；待未来出现 SVE2 受益内核再引入第二 TU）。*备选*：`-msve-vector-bits=256` 定长编译——拒绝，跨硬件脆弱。

**D4 — 构建期特性探测，SVE TU 可选。** `check_cxx_compiler_flag(-march=armv8.2-a+sve)` + 探针编译（含 `<arm_sve.h>` 的最小 TU）双检；失败（如 devtoolset-7 的 gcc7）时跳过 SVE TU，NEON/标量路径照常，构建不失败。release build.sh（centos7 用 gcc7）不传任何新开关即自动降级。*备选*：要求 gcc≥10——拒绝，会破坏既有 release 矩阵。

**D5 — NEON 版保留 u64 路径。** u64 NEON 仅 1.2x（2 lane/寄存器，归约开销大），仍快于标量且保持单一代码路径；正确性对拍零成本。*备选*：u64 回退标量——拒绝，收益为正、无复杂度代价。 补充论证（apply 期评审问题）：NEON 档整体不可删——无 SVE 的在役 ARM 云主机（Graviton2、Ampere Altra 等 Neoverse N1 一代）依赖它获得 u32 内核 2.0x，删后回落标量；NEON 无独立 TU/探针/flag，维护成本趋零。与 x86 不设 SSE2 档的不对称由此正当化：ARM 基线 SIMD 覆盖 100% 在役机器，x86 基线只面对已有优化标量路径的存量。

**D6 — 正确性验证 = 对拍测试进树。** 在 `src/overlaybd/lsmt/test/` 增加测试：随机映射集 + 边界查询（首/末 key、key 间 gap、x 等于某 key、padded leaf），各实现结果与标量引用逐位比对；运行于 x86 CI（标量 vs AVX-512）与鲲鹏真机（全档位路径）。微基准 `/root/armbench/` 保持仓库外工具，不入树。

## Risks / Trade-offs

- [SVE1/SVE2 flag 混淆导致 SIGILL] → D3 硬规则 + 鲲鹏真机冒烟任务前置；代码注释警示
- [老工具链无 arm_sve.h（gcc<10）] → D4 双重构建探测，SVE TU 构建期可选；发布矩阵全数验证
- [SVE2 档无本地真机验证] → SVE1 代码是 SVE2 的架构级严格子集（同一 TU 直接运行）；档位日志可观测；获得 SVE2 真机（Graviton3/4、Neoverse V2）后补冒烟
- [VL 差异（128-bit SVE 机器收益缩水）] → VL-agnostic 写法保证正确性；性能随 VL 缩放是预期行为
- [SIMD 收益被端到端噪声稀释] → 微基准已证内核 2~3x；真机 fio 前后对比作为验收任务，量化落地收益
- [policy 数量增长（标量/AVX-512/NEON/SVE 四个）] → 全部同签名模板，无运行时多态开销；选择点单处集中

## Migration Plan

纯增量：合并后 aarch64 二进制自动获得新路径，无需数据/格式迁移。回滚 = revert 提交或构建期 SVE 探测失败即自动回到 NEON/标量，风险面收敛在单文件单函数选择点。

## Open Questions

（无——SVE2/SVE1/NEON/标量四级档位、收益数量级、集成点均已勘定。SVE2 真机验证依赖硬件可得性，列为风险缓解而非阻塞项；端到端收益百分比为任务 4.3 产出，不影响本设计。）
