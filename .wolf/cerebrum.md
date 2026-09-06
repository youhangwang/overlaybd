# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-09-03

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

- **[2026-09-04] ARM 优化必须覆盖完整硬件档位阶梯**（用户明确要求）：设计要自适应 SVE2/SVE1/NEON/标量各类硬件，而不是只覆盖手头验证过的机器。立项时按"探测位 + 档位日志 + 回退终态"表达完整阶梯；SVE1 代码是 SVE2 严格子集这个事实用来覆盖 SVE2 档，不写重复代码。
## Key Learnings

- **Project:** overlaybd
- **Description:** Overlaybd (overlay block device) is a novel layering block-level image format, which is design for container, secure container and applicable to virtual machine. And it is an open-source implementatio
- **[2026-09-03] ARM64 支持面（代码触点地图）**：overlaybd 的 arch 分叉只有 3 处手写代码 + 构建层。① CRC32C：`src/overlaybd/zfile/crc32/crc32c.cpp` — 派发链 DSA(x86)→ISAL(x86)→hw intrinsic（x86=SSE4.2，arm=`__ARM_FEATURE_CRC32`，由根 CMakeLists 的 `-march=armv8-a+crc` 打开）→纯表软算；② LSMT 索引查找：`src/overlaybd/lsmt/index.cpp` — AVX-512 线性化 B+ 树仅 `__x86_64__`，**ARM 落到标量 fallback（DefaultInnerSearch），无 NEON 版 = 最大 ARM 优化机会**（docs/lsmt_lookup.md：avx512 比 lower_bound 快 10x，loop+bitmask 也快 4-5x）；③ x86-only 加速 DSA/ISAL/QAT 全靠 ENABLE_* 开关，release 构建显式关闭，ARM 上天然为 off。构建层：根 CMakeLists 白名单 x86_64/aarch64/arm64 + ARM 专属 flags；release CI 用 buildx+QEMU 出 linux/arm64 包（从未在真机上跑过验证）。核心代码不做 CPU 亲和/NUMA 管理（唯一 NUMA 相关是 QAT 的 qaeMemAllocNUMA）；线程调度全在 photon。测试真机：Kunpeng 920 (320C/4NUMA/1TB, openEuler 24.03 SP3, ssh root@192.168.25.61)，CRC32 扩展全核具备。
- **[2026-09-04] Kunpeng 920 实测：256-bit SVE1（非 SVE2），LSMT 查找内核 SIMD 收益 2-3x**。真机 /proc/cpuinfo：sve + svei8mm/svebf16/svef64mm，但 HWCAP2_SVE2=0 → 编译必须用 `-march=armv8.2-a+sve`（用 +sve2 会 SIGILL）；SVE 向量长度 32B=256bit（8×u32 lane，近似 AVX2 宽度）。微基准（/root/armbench/，正确性对拍全过）：u32 节点查找 标量 23.6ns → NEON 12.0ns (2.0x) → SVE 8.1ns (2.9x)，且 L1/RAM 四档工作集收益稳定（RAM 档不趋同，MLP 摊薄 miss）；u64 NEON 只有 1.2-1.4x（2 lane），SVE 1.9-2.1x。gcc12 -O3 自动向量化该 bitmask 循环失败（fopt-info-vec 0 条）→ 手写 SIMD 无免费替代。集成点：`IndexLBPT<KeyType, SearchPolicy>` 模板 + `is_avx512f_supported()` 运行时选择（index.cpp:373），ARM 对偶接法 = HWCAP_SVE 检查选 SVE policy，NEON 作 aarch64 基线。真实查找 = 树下行 3-4 次 inner_search/次。

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

- **[2026-09-04] 不要用单次大 Write 重生成含大量中文的 markdown 文件**：本会话连续 3 次长 CJK Write 输出乱码/截断（design.md 曾只剩 13 行残骸）。改为小分块 `cat >>` 追加 + 每块 `tail` 校验，一次通过。规则：长 CJK 文档重建一律分块，逐块核验后再继续。
## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->

## Do-Not-Repeat (added 2026-09-05)
- **不要把大段 CJK+标记（SVG/HTML 图块）塞进单个 Edit new_string**：本会话两次产出损坏属性（divided-by-nothing、</h>2、<section-heading> 等）。规则：大图/大块插入用 cat >> heredoc 分块 + 立即跑垃圾 grep（section-heading|divided-by-nothing|text-anchor="key" 等）；修复时 sed 范围删除 + 短锚点重插，old_string 一律从 Read 输出精确复制，禁止凭记忆重建。md 版本允许 ASCII 图（代码围栏），HTML 才用 SVG。

## User Preferences / Decisions (2026-09-05)
- **ARM SIMD 阶梯决策：保留 NEON 档**。用户曾提议砍掉 NEON 镜像 x86 两档结构，经覆盖面分析（无 SVE 的在役 ARM 云主机 Graviton2/Altra 依赖 NEON 获得 u32 2.0x；NEON 维护成本趋零）后决定保留。论证已入 code 文档第 4 节与 design.md D5。后续勿再提删 NEON；同理勿建议给 x86 加 SSE2/AVX2 档（FAQ 已记录上游策略）。
