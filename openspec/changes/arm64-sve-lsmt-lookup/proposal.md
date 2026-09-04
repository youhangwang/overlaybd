# Proposal: arm64-sve-lsmt-lookup

## Why

overlaybd 的 LSMT 线性化 B+ 树索引查找在 x86_64 上有 AVX-512 加速路径（`Avx512InnerSearch`，宣称较 `std::lower_bound` 快 10x），但 ARM64 只落到标量 fallback（`DefaultInnerSearch`）。ARM64 是官方发布目标（release CI 产出 linux/arm64 包），其查找路径却从未被向量化。实测（Kunpeng 920 7280Z 真机，256-bit SVE1）：查找内核标量 23.6ns → SVE 8.1ns，**2.9x 加速且在 L1→256MB 全部四档工作集下稳定成立**。overlaybd 已有的 arch 分叉模式（`is_avx512f_supported()` 运行时选择 policy）使该收益可以零风险接入。

## What Changes

- 新增 `NeonInnerSearch`（128-bit AdvSIMD，aarch64 基线能力）与 `SveInnerSearch`（SVE1，VL-agnostic 写法）两个查找 policy，语义与现有实现严格一致（对拍验证）
- ARM64 上按完整硬件档位自适应：**SVE2 → SVE1 → NEON → 标量**四级运行时分派（SVE2/SVE1 共用同一 SVE 编译单元——SVE1 代码是 SVE2 的严格子集，收益随硬件向量长度 128→512-bit 缩放；`HWCAP_SVE`/`HWCAP2_SVE2` 双探测 + 档位日志可观测）；SVE 编译单元用 `-march=armv8.2-a+sve` 单独编译（**禁用 +sve2**：鲲鹏 920 实测 HWCAP2_SVE2=0，+sve2 指令会 SIGILL）
- x86_64 行为不变（AVX-512 支持检测逻辑原样保留）；磁盘格式、依赖、API 均不变
- 附带：gcc12 -O3 不会自动向量化该 bitmask 循环（实测确认），手写 intrinsic 是唯一路径；微基准与正确性对拍工具已就绪（鲲鹏机 /root/armbench/）

## Capabilities

### New Capabilities

- `lsmt-arm64-lookup`: LSMT 线性化 B+ 树查找在 ARM64 上的实现选择行为——按硬件能力档位（SVE2 / SVE1 / AdvSIMD / 标量）运行时分派并报告检测到的档位，各实现查找结果逐位一致，能力不足时安全回退

### Modified Capabilities

（无——现有 spec 目录为空，x86_64 行为本变更不触碰）

## Impact

- **代码**：`src/overlaybd/lsmt/index.cpp`（新增两个 policy struct + 运行时分派点 `new_index_with_lineriazed_bptree`）、新增 SVE 翻译单元（独立编译 flag）、`src/overlaybd/lsmt/CMakeLists.txt`（或根 CMake）增加 SVE TU 编译规则、ARM64 测试
- **性能**：ARM64 查找内核 2~3x（鲲鹏 920 实测）；x86_64 与非 aarch64 平台零影响
- **风险**：SVE1/SVE2 编译 flag 混淆（已实测规避）；SVE VL 跨硬件差异（VL-agnostic whilelt 写法天然规避）；正确性风险由多实现对拍测试覆盖
- **验证环境**：真机 Kunpeng 920（320C/4NUMA/openEuler 24.03，ssh root@192.168.25.61），微基准 `/root/armbench/`
