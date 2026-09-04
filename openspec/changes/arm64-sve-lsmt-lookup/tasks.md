# Tasks: arm64-sve-lsmt-lookup

## 1. AdvSIMD（NEON）policy — aarch64 基线加速

- [x] 1.1 在 `src/overlaybd/lsmt/index.cpp` 新增 `NeonInnerSearch`（u32：4 组 `vcleq_u32`+`vshrq_n`+`vaddvq`；u64：2-lane 同型），签名与 `DefaultInnerSearch` 一致；`new_index_with_lineriazed_bptree()` 选择点加 `__aarch64__` 分支，aarch64 默认走 NEON
- [x] 1.2 x86_64 构建回归：确认 `__aarch64__` 分支不影响 x86 编译产物与 `Avx512InnerSearch` 选择逻辑（本地 cmake 构建通过即可验证）

## 2. SVE1 实现 + 构建接线

- [x] 2.1 新增独立 SVE 翻译单元（VL-agnostic：`svwhilelt` + `svcmple_u32/_u64` + `svaddv`，extern "C" 桥接），编译 flag **固定 `-march=armv8.2-a+sve`，禁用 `+sve2`**（鲲鹏 920 HWCAP2_SVE2=0，注释说明原因）
- [x] 2.2 CMake 构建探测：`check_cxx_compiler_flag(-march=armv8.2-a+sve)` + 含 `<arm_sve.h>` 的最小探针 TU 双检；不支持则跳过 SVE TU（devtoolset-7 路径不破），支持则加入 lsmt 库源
- [x] 2.3 运行时分派与档位可观测：`sve_supported()`（`getauxval(AT_HWCAP) & HWCAP_SVE`）+ `sve2_supported()`（`HWCAP2_SVE2`，仅用于档位日志），aarch64 档位序 SVE2/SVE1 → NEON → 标量，选择日志报告检测到的档位（与 `is_avx512f_supported()` 同型接入 `new_index_with_lineriazed_bptree()`）

## 3. 正确性与构建矩阵

- [x] 3.1 `src/overlaybd/lsmt/test/` 增加对拍测试：随机映射集 + 边界查询（首/末 key、key 间 gap、x 等于某 key、padded leaf），所有已编译实现 vs 标量引用逐位一致（零失配）
- [x] 3.2 降级路径验证：模拟 SVE 探测失败（无 SVE 工具链/显式关闭）构建成功，运行时落 NEON/标量；确认产物可在无 SVE 的 aarch64 语义下正确（单测内以编译宏模拟）

## 4. 真机验证（Kunpeng 920 7280Z，ssh root@192.168.25.61）

- [x] 4.1 冒烟：鲲鹏机上构建 + 运行 lsmt 单测，确认选择日志命中 SVE1 档（VL=256bit）、无 SIGILL、对拍零失配；SVE2 档由 SVE1⊂SVE2 架构保证，获得 SVE2 真机后补冒烟
- [x] 4.2 内核微基准：以 /root/armbench/ 方法复核树内实现的 标量 vs NEON vs SVE 数字（预期 u32 ≥2x、SVE ≥2.5x @L1）
- [ ] 4.3 端到端收益：鲲鹏机构建完整 overlaybd，大索引镜像 4K randread（缓存热读）fio 前后对比（SVE 分派开/关），量化 IOPS/延迟收益并记录

## 5. 文档与收尾

- [x] 5.1 更新 `docs/lsmt_lookup.md`：补充 ARM64 硬件档位表（SVE2/SVE1/NEON/标量：探测位、示例硬件、920 实测数据），对齐 x86 表格格式
- [ ] 5.2 `openspec validate --strict` 通过，tasks 全勾，准备归档
