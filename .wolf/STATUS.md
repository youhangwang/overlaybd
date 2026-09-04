# STATUS — overlaybd

> Last updated: 2026-09-04 (apply 进行中)

## ✅ Done

- **[2026-09-03] 探索：ARM64 触点地图** — LSMT 查找是唯一无 ARM SIMD 的热点（详见 cerebrum）
- **[2026-09-04] 微基准实测** — 鲲鹏920 256-bit SVE1：u32 内核 标量23.6→NEON 12.0(2.0x)→SVE 8.1(2.9x)；u64 1.9x。基准在 /root/armbench/（盒）/ /tmp/armbench/（本地）
- **[2026-09-04] 立项 arm64-sve-lsmt-lookup** — 4/4 artifacts，四级档位自适应（SVE2/SVE1/NEON/标量）
- **[2026-09-04] apply 11/12 任务**：
  - index.cpp: NeonInnerSearch/SveInnerSearch policy + sve_supported/sve2_supported + 档位日志 + verify_inner_search_impls 对拍函数
  - index_sve.cpp（+sve 编译，禁+sve2）+ lsmt CMake 探针（真机 ENABLED）+ OVERLAYBD_DISABLE_SVE 逃生开关
  - 鲲鹏真机：SVE acceleration ENABLED；35/35 lsmt 单测 PASSED；tier=SVE1 vl_bytes=32 日志确认；对拍零失配
  - 降级构建：OVERLAYBD_DISABLE_SVE=1 → RC=0 且 SVE 符号=0
  - x86 本地 -fsyntax-only 回归通过；docs/lsmt_lookup.md 已补 ARM 档位表

## 🚀 Next phase

**Goal:** 完成 arm64-sve-lsmt-lookup 剩余任务 4.3（fio 端到端收益量化）后归档。

### Acceptance criteria
1. 鲲鹏920 上 4K randread（热读）SVE 分派开/关 fio 对比，IOPS/延迟数字记录进 tasks.md 4.3
2. /opsx:archive 归档，specs/lsmt-arm64-lookup 进入主 spec

### Closed decisions
- 见 change design.md D1-D6；新增 OVERLAYBD_DISABLE_SVE CMake 开关（apply 期决策）

### Open decisions
- 4.3 的验证形态：完整 containerd+snapshotter 栈 vs overlaybd tcmu iSCSI 直挂 fio vs 接受内核级证据收尾

## ⚠️ Environment notes

- 盒子 github 闪断：FetchContent 需 FETCHCONTENT_SOURCE_DIR_* 覆盖；/root/deps/ 已备全（photon/rapidjson/tcmu/e2fsprogs/erofs-utils，erofs-utils 从 build/_deps 拷出）
- 盒子构建目录：/root/overlaybd-src/build（SVE enabled）/ build-nosve（降级）；源与本地同步（tar 排除 .git/openspec/.wolf/docs）
- 盒子缺包已装：e2fsprogs-devel libzstd-devel pkg-config gtest-devel gflags-devel
- 盒子磁盘 95% 满；cmake 覆盖参数写在 /root/*.sh 脚本里

## 🔧 Useful commands

```bash
# 跑 lsmt 单测: ssh ... 'cd /root/overlaybd-src/build/output && ./lsmt_test --gtest_filter=inner_search*'
# 微基准:      ssh ... 'cd /root/armbench && ./bench'
```

## 📚 References

- openspec/changes/arm64-sve-lsmt-lookup/（proposal/design/tasks，10/12 勾选）
- .wolf/cerebrum.md — 档位阶梯偏好 + 长 CJK 分块写入规则 + buglog: 生成损坏/small→x/边界条件
