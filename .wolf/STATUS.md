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
- **[2026-09-04] 本地 Fedora 虚机**：`ssh fedora` 免密直达（见 env notes）；guest 无 SVE（VirtualBox 不透传）
- **[2026-09-04] 优化博客初稿**（对外分享，面向非底层读者）：`docs/lsmt_arm64_sve.md`（中文，137 行）+ HTML 排版版 /tmp/overlaybd-blog/index.html（4 张 SVG 机制图）；读者测试跑心中

## 🚀 Next phase

**Goal:** 完成 arm64-sve-lsmt-lookup 剩余任务 4.3（fio 端到端收益量化）后归档。

### 并行支线（本轮中断点）
1. **博客定稿**：`docs/lsmt_arm64_sve.md`（十节+三附录，含总装图/轮次表/自动选树规则，互链 code 文档）为对外分享版；HTML 排版版 /tmp/overlaybd-blog/index.html 已同步（内容抽查一致），artifact 待 /login 后可发布
2. **新增代码解读文档**：`docs/lsmt_arm64_sve_code.md`（约 230 行 10 节+子节：AVX-512 详解、谓词vs mask、**CNTP 扩展点**、AVX2 FAQ、SSE2/基线对照、双架构共享标量档说明），全部代码引用经源码核实
3. **CNTP vs ADDV 微基准（挂起）**：鲲鹏盒子 192.168.25.61 当前 SSH 超时连不上；待恢复后跑 `svaddv_u32(c,1)` vs `svcntp_b32(pg,c)` 的 inner_search 对比（探针思路已在 code 文档第 5 节，本机 clang16 仅能验签名、Darwin 后端拒绝 SVE 代码生成）；若 addv 是瓶颈则 index_sve.cpp 一行改 cntp。另：本机 VBox guest 无 SVE（不透传）已确认，SVE2 档只能靠盒子/UTM-QEMU
4. **NEON 去留决策（已定）**：用户提议砍 NEON 镜像 x86 两档，经覆盖面分析后决定保留（论证入 code 文档第 4 节 + design.md D5 补充）；决策与"勿再提删 NEON/加 SSE2 档"已入 cerebrum
2. **QEMU SVE2 冒烟**（用户已选"只冒烟"）：brew qemu 已装好；VM dev 已按 ACPI 关机（未确认 poweroff 状态）；下一步 `qemu-img convert -c -f vdi -O qcow2 "/Users/johan/VirtualBox VMs/dev/dev.vdi" ~/qemu-vm/fedora-sve.qcow2` → `qemu-system-aarch64 -M virt -cpu max -smp 4 -m 4G -drive file=…,if=virtio -bios /opt/homebrew/share/qemu/edk2-aarch64-code.fd -nic user,hostfwd=tcp::2223-:22 -nographic` → guest 装 gcc，编译运行 /tmp/sve2-smoke/sve2_smoke.c（期望 tier=SVE2 + svhadd 结果 650）

### Acceptance criteria
1. 鲲鹏920 上 4K randread（热读）SVE 分派开/关 fio 对比，IOPS/延迟数字记录进 tasks.md 4.3
2. /opsx:archive 归档，specs/lsmt-arm64-lookup 进入主 spec

### Closed decisions
- 见 change design.md D1-D6；新增 OVERLAYBD_DISABLE_SVE CMake 开关（apply 期决策）

### Open decisions
- 4.3 的验证形态：完整 containerd+snapshotter 栈 vs overlaybd tcmu iSCSI 直挂 fio vs 接受内核级证据收尾

## ⚠️ Environment notes

- 本地 VirtualBox 虚机 `dev`（Fedora 44 aarch64）：`ssh fedora` 免密直达（NAT 2222→22，规则运行时生效，VM 关机后需 `VBoxManage modifyvm dev --natpf1 "ssh,tcp,,2222,,22"` 持久化）。guest CPU **无 SVE/SVE2**（VirtualBox 不透传），只能测 NEON 档回归 + lsmt 对拍 + tcmu 冒烟；SVE1 档在鲲鹏盒子，SVE2 档暂无可用硬件/模拟器（UTM-QEMU `-cpu max` 理论可测，慢但功能正确）
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
