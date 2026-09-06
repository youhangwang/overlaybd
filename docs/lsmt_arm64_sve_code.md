# overlaybd ARM64 查找优化：代码解读

面向要评审或接手这段代码的工程师。背景与原理见 `docs/lsmt_arm64_sve.md`，本文只讲代码：每个实现长什么样、为什么这样写、坑在哪。所有行号对应本文撰写时的源码状态。

## 1. 改动地图

| 文件 | 角色 |
|---|---|
| `src/overlaybd/lsmt/index.cpp` | 能力探测（`sve_supported`/`sve2_supported`）、NEON policy、SVE 桥接、分派点 `new_index_with_lineriazed_bptree()`、对拍 `verify_inner_search_impls()` |
| `src/overlaybd/lsmt/index_sve.cpp` | SVE 翻译单元（`extern "C"`，独立编译选项，约 40 行） |
| `src/overlaybd/lsmt/CMakeLists.txt` | SVE 工具链双检探针、`index_sve.cpp` 条件加入编译 |
| `src/overlaybd/lsmt/test/inner_search_test.cpp` | gtest 入口，调用对拍 |

x86 路径（`Avx512InnerSearch`）本轮零改动，实现解读见第 3 节。

## 2. 查找 policy 体系与语义基准

树的查找策略是模板参数：`IndexLBPT<KeyType, SearchPolicy>`。所有实现共用同一签名：

```cpp
static uint32_t inner_search(const KeyType *base, KeyType x);
```

语义：在节点的 `KEYS` 个升序 key 里，返回 **`key <= x` 的个数**——即第一个大于 x 的 key 的下标，也就是树下行该走的分支号（0..KEYS）。标量版是所有实现的语义基准（`index.cpp:102`）：

```cpp
static uint32_t inner_search(const KeyType *base, KeyType x) {
    uint32_t mask = 0;
#pragma GCC unroll 20
    for (uint32_t i = 0; i < KEYS; i++) {
        mask |= ( (base[i] <= x) << i );
    }
    return __builtin_popcount(mask);
}
```

逐位组装掩码再 popcount，和 SIMD 版"批量比较 + 计数"是同一套数学——这是对拍能逐位比对的根基。

这段代码是平台无关的模板：**它同时是 x86 与 aarch64 的标量档**——一套代码、两个架构，x86 上给无 AVX-512 的机器兜底，ARM 上给无 SVE 探测失败/降级构建兜底。注意它与旧版实现的区别：历史上 overlaybd 用 `std::lower_bound` 二分查找（42.2M/s 的标量版较其快 2.3 倍）。快的原因有二——`#pragma GCC unroll 20`（循环上限实为 16/8，20 是留余量的天花板）让循环完全展开，消灭 i++ 与回跳分支；**bitmask 写法全程零数据依赖分支**——不"找到就提前退出"，而是 16 次比较的结果各自落进掩码的一个位，最后 popcount 数 1 得分支号，对流水线完全友好。这也是它比比较次数更少的二分还快的反直觉之处。

## 3. AVX-512 实现（x86_64，本轮未改动）

它不是本次改动的一部分，但整个 policy 体系由它奠基，ARM 两个实现都是对它的移植。完整结构（`index.cpp:193`）：

```cpp
template<typename KeyType>
struct Avx512InnerSearch {
#ifdef __clang__
#pragma clang attribute push (__attribute__((target("avx512f"))), apply_to=function)
#else // __GNUC__
#pragma GCC push_options
#pragma GCC target ("avx512f")
#endif
    template<typename T = KeyType>
    static typename std::enable_if<std::is_same<T, uint64_t>::value, uint32_t>::type
    inner_search(const KeyType *base, KeyType x) {
        __m512i vx = _mm512_set1_epi64(x);
        __m512i data = _mm512_load_si512(base);
        uint8_t mask = _mm512_cmp_epu64_mask(vx, data, _MM_CMPINT_GE);
        return __builtin_popcount(mask);
    }
    // u32 版同型：__mmask16 + _mm512_cmp_epu32_mask，16 lane
#ifdef __clang__
#pragma clang attribute pop
#else // __GNUC__
#pragma GCC pop_options
#endif
};
```

要点逐条：

- **函数级 target 属性 = 代码生成的本地隔离**。`#pragma GCC target("avx512f")`（clang 用 attribute push）只对 pragma 之间的函数开启 AVX-512 代码生成，编译单元其余部分保持基线指令集。这与 SVE 的"独立 TU"是同一思想的两种落地：x86 上所有工具链都自带 AVX-512 intrinsics 头（immintrin.h），函数级开关即可；aarch64 老工具链连 `arm_sve.h` 都没有，只能整个 TU 构建期隔离。
- **对齐载入是安全的**。`_mm512_load_si512` 要求 64 字节对齐，而树节点数组用 `posix_memalign(&node, 64, N*sizeof(KeyType))` 分配（`index.cpp:274`），节点恰为 64 字节（16×u32 或 8×u64），每个节点天然对齐。
- **一条比较吃满整个节点**。512 位 = 16×u32（`__mmask16`）或 8×u64（`__mmask8`），`_mm512_cmp_*_mask` 一条指令完成节点内全部比较并直接产出位掩码，popcount 即分支号——没有循环，这是 x86 每秒查找数更高的根本原因。
- **谓词语义与标量严格对应**。`_MM_CMPINT_GE` 配合 `(vx, data)` 的参数序，判的是 `x >= data[i]`，即 `data[i] <= x`——与标量基准 `base[i] <= x` 逐位同义。
- **SFINAE 按 KeyType 选重载**。u32/u64 两个 `inner_search` 用 `std::enable_if` 互斥启用；ARM 侧用 Impl 模板特化达成同样效果，风格不同、机制等价。
- **非 x86 平台有替身**。`#else` 分支 `using Avx512InnerSearch = DefaultInnerSearch<KeyType>`——这个名字在所有平台都存在，分派代码无需条件编译；真正的把关在运行时 `is_avx512f_supported()`（`__builtin_cpu_supports("avx512f")`，`index.cpp:65`）。

**与 ARM 实现的对照**（为什么 ARM 拿不到"一条指令吃满节点"）：

| | AVX-512 | SVE 256 位（鲲鹏 920） |
|---|---|---|
| 一条比较覆盖 | 16×u32 / 8×u64 = 整节点 | 8×u32 / 4×u64 = 半节点 |
| 每节点比较轮数 | 1 | 2（VL-agnostic 循环） |
| 掩码 | 专用 mask 寄存器，popcount 即得 | bool 谓词 + `svaddv` 横向归约 |
| 代码隔离 | 函数级 target pragma | 独立 TU + 构建期探针 |
| 运行时探测 | `__builtin_cpu_supports` | `getauxval(AT_HWCAP)` |


### 为什么没有 AVX2（256 位）版本？

1. **mask 寄存器是 AVX-512 独有**：`_mm512_cmp_*_mask` 直接产出位掩码；AVX2 的比较产出全 1/全 0 向量，须经 `movemask` 绕行到 GPR，16 key 两轮约 8~10 uops（AVX-512 为 3~4）。能写，但失去"一条指令吃满节点"的形态。
2. **边际收益被稀释**：同宽的 ARM 实测（SVE-256 两轮）外推 AVX2 内核约有 2x，但 x86 标量基准本身是 unroll+bitmask 优化版（较二分已快 2.3 倍），且整条路径的结构红利（缓存）已拿走大头——内核再翻倍对端到端是二阶效应。
3. **只养一条 SIMD 线**：每多一个 policy 即全套对拍/基准/日志/文档。上游策略是旗舰 ISA（AVX-512，覆盖 SKL-SP 后服务器与 Zen4）一条 SIMD 线，其余交给标量 bitmask 路径——`lsmt_lookup.md` "Even in environments without AVX-512 support..." 即此意图。
4. **不对称的代价与覆盖面**：ARM 补四档阶梯近乎零成本（NEON 架构强制免检、SVE 探测现成），且 NEON 档覆盖 **100% 的 ARM64 用户**——此前他们全部跑标量。x86 的"基线 SIMD"是 SSE2（与 NEON 同为 128 位、同被架构强制纳入基线），理论上也能成档，但它只惠及无 AVX-512 的存量机器（新机器已走 AVX-512 档），覆盖面窄、又面对已优化的共享标量 bitmask 路径，上游未单独立档。两个架构的标量档本就是同一段 `DefaultInnerSearch`（见第 2 节）。

这张表也说明：ARM 上"两轮循环 + 显式归约"的写法不是风格偏好，而是向量宽度（512 vs 256）与谓词机制差异下的必然形态。

## 4. NEON 实现（`index.cpp:115` 附近，aarch64 基线）

NEON 是 aarch64 架构强制能力，**免运行时检测**，所以放在主编译单元、不隔离：

```cpp
template<> struct NeonInnerSearchImpl<uint32_t> {
    static uint32_t inner_search(const uint32_t *base, uint32_t x) {
        uint32x4_t vx = vdupq_n_u32(x);
        uint32_t c = 0;
        c += vaddvq_u32(vshrq_n_u32(vcleq_u32(vld1q_u32(base), vx), 31));
        c += vaddvq_u32(vshrq_n_u32(vcleq_u32(vld1q_u32(base + 4), vx), 31));
        c += vaddvq_u32(vshrq_n_u32(vcleq_u32(vld1q_u32(base + 8), vx), 31));
        c += vaddvq_u32(vshrq_n_u32(vcleq_u32(vld1q_u32(base + 12), vx), 31));
        return c;
    }
};
```

每一轮四个 intrinsic 一条龙：`vld1q_u32` 载入 4 个 key → `vcleq_u32` 无符号 ≤ 比较（每 lane 得 0 或 0xFFFFFFFF）→ `vshrq_n_u32(..., 31)` 把全 1 右移成 1 → `vaddvq_u32` 横向加总。16 key = 4 轮；u64 版同型，2 lane × 4 轮。u64 NEON 只有 1.2 倍收益（每轮仅 2 个有效 lane，归约占比高），但保持正收益且代码路径单一，故保留。

### 为什么保留 NEON 档（评审必问：x86 没有 SSE2 档，ARM 凭什么有 NEON 档？）

NEON 档的维护成本接近零：代码在主编译单元内（无独立 TU、无构建探针、无新 flag、无降级路径），对拍天然覆盖。而它的覆盖价值不成比例地大——**SVE 在 ARM 阵营的普及率远低于 AVX-512 在 x86 服务器上的普及率**：

| 机器 | NEON | SVE | 无 NEON 档时 |
|---|---|---|---|
| 鲲鹏 920 / Graviton3/4 / Cobalt 100 | ✓ | ✓ | 走 SVE，无损 |
| Graviton2（Neoverse N1，云上存量巨大） | ✓ | ✗ | u32 内核 2.0x → 1.0x |
| Ampere Altra（N1，Azure/GCP/Oracle 大量部署） | ✓ | ✗ | 同上 |

x86 只留 AVX-512 成立的前提是"无 AVX-512 的机器是存量尾部"；ARM 无 SVE 的机器（Neoverse N1 一代）是在役主力的一部分。这就是两架构基线策略不对称的正当性：ARM 基线 SIMD（NEON）覆盖 100% 在役机器且此前从未被 SIMD 覆盖，x86 基线（SSE2）只面对已有优化标量路径的存量机器。

## 5. SVE 实现（独立翻译单元 `index_sve.cpp`）

### 为什么 SVE 必须单独一个文件：把编译模型一次讲清

先补三个地基概念：

**① 编译单元（TU）**：一个 .cpp 文件就是一次独立编译。编译器逐个文件编译成目标文件，最后由链接器拼成程序。**编译选项是按文件生效的**——可以给 A 文件开某个指令集，给 B 文件不开。

**② `-march`**：告诉编译器"这个文件允许生成哪些指令"。overlaybd 根 CMake 给**所有** aarch64 文件统一设了 `-march=armv8-a+crc`（所有 ARM64 CPU 都支持的基础指令集 + CRC 扩展）。这是刻意选的最低公共分母：保证一个二进制能在任何 ARM64 机器上跑。

**③ 编译时允许 ≠ 运行时有**：某段代码被编译出 SVE 指令后，跑到无 SVE 的机器上就是 SIGILL（进程崩溃）。编译器的许可和机器的能力是两回事。

有了地基，原文那句话展开就是"三条路只剩一条"：

**路 1：把 SVE 代码直接写进 index.cpp？** 不行。index.cpp 用全局 `-march=armv8-a+crc`，SVE intrinsic（`svld1_u32` 这些）在没开 +sve 的文件里**连编译都过不了**。要让它们过，就得提升整个文件的 march——但这样一来文件里其他普通代码也被"允许"用 SVE，编译器自动向量化随时可能改写其中任何一段。更致命的是发布矩阵：centos7 + gcc7 **连 `arm_sve.h` 这个头文件都没有**（SVE intrinsics 从 GCC 10 才提供），头文件一 include，整个项目在老工具链上直接编译失败。

**路 2：给所有 aarch64 文件全局开 `-march=armv8.2-a+sve`？** 两个死结。其一，gcc7 不认识 +sve 这个 flag，整个项目编译失败（比路 1 死得更早）。其二，就算全用新工具链：全局开 SVE 意味着**项目中任何一段代码**（photon 协程库、压缩、校验……）都可能被编译器自动改写成 SVE 指令——二进制从此只能在有 SVE 的机器上跑，Graviton2 / Ampere Altra 全军覆没。"一个二进制跑所有 ARM64"的承诺就此作废。

**路 3（被选中的）：单独 TU + 探针 + extern "C" 桥。**
- `index_sve.cpp` 成为**全项目唯一**被允许生成 SVE 指令的文件（CMake 只给它单独设 `-march=armv8.2-a+sve`）。SVE 指令被物理隔离在这一间"实验室"里，运行时由 `sve_supported()` 把守。
- 工具链不行怎么办？CMake 探针（第 7 节）先验：认不认 flag、`arm_sve.h` 在不在。不行就**这个文件干脆不参与编译**，宏 `OVERLAYBD_ENABLE_SVE` 也不定义，主代码里的桥接分支从源码层面消失——构建照常。
- 主代码怎么调用它？跨文件调函数本来就要声明；这里特意声明成 `extern "C"`（C 链接）：绕开 C++ 名字修饰，让这条缝合线成为最简单、最不会出错的形式——两边用完全相同的名字和调用约定接头，互不依赖对方的 C++ 细节。

**类比**：项目是一栋楼，每个 .cpp 是一个车间，`-march` 是车间的设备许可证。SVE 是一台特殊机床：不能要求全楼换许可证（老检查员 gcc7 直接驳回整栋楼），也不能人手一台（任何人偷偷用了，产品送到旧工厂就炸）。办法：只给一间实验室配机床、发许可证；探针决定这间实验室建不建；门口挂 C 语言招牌（extern "C"），别的车间照招牌喊人；实验室没建成时，招牌和电话一起拆（宏开关），没人打空。

**x86 为什么不需要这一套**：AVX-512 同样是特殊指令，但它靠**函数级** pragma 就地开关（第 3 节的 `#pragma GCC target`）——因为所有 x86 工具链天生自带 AVX-512 头文件，且函数级 target 属性在 x86 上是成熟统一机制。aarch64 工具链矩阵不具备这两个前提（gcc7 连头文件都没有），所以只能做"整间房"级别的隔离。这间实验室的全部代码只有约 40 行：


```cpp
extern "C" uint32_t lsmt_sve_inner_search_u32(const uint32_t *base, uint32_t x) {
    uint32_t cnt = 0;
    for (uint32_t i = 0; i < 16;) {
        svbool_t pg = svwhilelt_b32((uint64_t)i, (uint64_t)16);
        svuint32_t d = svld1_u32(pg, base + i);
        svbool_t c = svcmple_u32(pg, d, svdup_u32(x));
        cnt += (uint32_t)svaddv_u32(c, svdup_u32(1));
        i += svcntw();
    }
    return cnt;
}
```

### 逐行通俗解读：这个循环为什么能兼容任意向量长度

先建立一句话直觉：**这段代码没有出现任何具体宽度（8、256、512……），它把所有"本该需要知道宽度"的问题，都变成了运行时向硬件提问。**

```c
extern "C" uint32_t lsmt_sve_inner_search_u32(const uint32_t *base, uint32_t x) {
```
给 C++ 模板世界开的一扇 C 接口的门——SVE 代码要用特殊编译选项单独编译（见下），两边只能用最朴素的函数签名接头。`base` 是节点里 16 个 key 的起始地址，`x` 是要找的目标值。

```c
    uint32_t cnt = 0;
```
计数器清零。整个函数要回答的问题："16 个 key 里，有几个 ≤ x"——这个数就是树下行该走的分支号。

```c
    for (uint32_t i = 0; i < 16;) {
```
`i` 是"处理到第几个 key 了"。注意小括号里**没有 `i++`**——每轮前进几个，要等循环体里问过硬件才知道。

```c
        svbool_t pg = svwhilelt_b32((uint64_t)i, (uint64_t)16);
```
生成"考勤表"。规则一句话：**从第 i 个起、到第 16 个之前，全部点亮；超出的保持熄灭。** 指令名就是它的英语定义（while less than）。硬件向量越宽，这张表能点亮的越多，但最多亮到 16 为止——多余 lane 永远熄灭。

```c
        svuint32_t d = svld1_u32(pg, base + i);
```
按考勤表载入：在岗的 lane 从内存搬回对应的 key；**不在岗的 lane 硬件保证不碰内存**——不是软件写了 if 去跳过，是载入指令天生只读活跃位。2048 位的机器跑这段代码也不会越界读，原因全在这。

```c
        svbool_t c = svcmple_u32(pg, d, svdup_u32(x));
```
逐 lane 比较。`svdup_u32(x)` 是"广播"：把一个目标值 x 复制成一排，供 8 个 key 同时比对。比较结果又是一张谓词（答题卡）：每个 lane 一位，≤ 记"是"。`pg` 仍然在场——不在岗的 lane 连比较都不参与。

```c
        cnt += (uint32_t)svaddv_u32(c, svdup_u32(1));
```
数答题卡上有几个"是"。做法：造一排全 1，然后"横向加总"（addv：把一排数加成一个数），且只在 c 亮着的 lane 上执行——亮 3 个就是 +3。本轮计数并入 cnt。

```c
        i += svcntw();
```
本轮前进几个 key？**问硬件**。`svcntw`（count words）返回"你一条向量装得下几个 u32"：鲲鹏 920 答 8（256 位），128 位机器答 4，512 位机器答 16。这个数在编译期不存在，只活在运行时。

```c
    return cnt;
```
所有轮次累计完，返回分支号。

三种硬件各走一遍，看"考勤表"如何自动收尾：

- **128 位机器（每轮 4 个）**：4 轮，每轮考勤表整批全亮，4 轮干净走完 16 个。
- **512 位机器（每轮 16 个）**：1 轮，考勤表从 0 亮到 15，单轮吃满。
- **384 位机器（每轮 12 个，架构允许的"怪宽度"）**：第 1 轮亮 0..11；`i` 变 12 后，`whilelt(12, 16)` 只亮 12..15——**考勤表自动只剩 4 个在岗**，第 2 轮照样正确收尾。

设计本质：标量思维写循环，收尾要 `if (剩余个数 < 每批个数)` 特判；SVE 把这个判断**下沉成一条指令**（whilelt），软件永远只写理想情况。三个运行时提问——本轮从哪开始（`i`）、每轮几个（`svcntw`）、本轮处理到哪（`whilelt`）——就是兼容任意长度的全部秘密。对照 x86：AVX-512 的宽度在编译期定死为 512 位（选了 `-march=avx512f` 就是承诺），所以它不需要这些提问；SVE 用运行时宽度换通用性，一份二进制跑遍所有 SVE 机器。

要点逐条：

- **`whilelt` / `svcntw` / 谓词化载入**：三者的逐行机制见上方"逐行通俗解读"，各宽度下的行为见下文"VL 不定长"一节。
- **文件头注释是硬规则**：本 TU 固定 `-march=armv8.2-a+sve`、**禁止 `+sve2`**。鲲鹏 920 实测 `HWCAP2_SVE2=0`，若编译出 SVE2 指令，运行到即 SIGILL。SVE1 代码是 SVE2 的架构子集，同一 TU 直接服务两代硬件，无需第二份。
- **`lsmt_sve_vl_bytes()`**：返回 `svcntb()`（向量长度字节数），仅供分派日志使用。

### 谓词寄存器 vs AVX-512 的 mask 寄存器

`svcmple` 的结果 `svbool_t` 就是 SVE 的"mask"——与 `_mm512_cmp_*_mask` 直接产出 `__mmask16` 形态对应，比较结果都直接落入专用寄存器（P0-P15 vs k0-k7）。差异在掩码的身份：AVX-512 的 k 寄存器是独立寄存器类，既做向量运算开关也能 KMOV 到 GPR 参与位运算；SVE 谓词只做向量运算的"舵"（每字节 1 位），要从谓词拿到标量计数需一次跨界归约。全梯队对比：

- **AVX-512**：比较 → k 寄存器 → popcount，零跨界；
- **SVE**：比较 → P 寄存器 → 每轮一次 `svaddv`（或 CNTP，见下）；
- **NEON**：无任何掩码/谓词寄存器——比较产出全 1/全 0 向量，须 `vshrq` 移位成 0/1 再 `vaddvq` 横加，每轮 4 条指令。

### 扩展点：CNTP

SVE 有专门数谓词的指令 CNTP：`svcntp_b32(pg, c)`（governing + operand 双谓词）一条指令直接给出 c 中活跃 32 位元素个数，是 AVX-512 "mask→popcount" 的直系对应。现行代码用 `svaddv_u32(c, svdup_u32(1))`（全 1 向量横向加总，更通用的 ACLE 习语），两者函数等价（c ⊆ pg 时）。签名已在本机 clang 16 的 `arm_sve.h` 下编译验证（Darwin 后端不支持 SVE 代码生成，仅能验签名）；**性能差异未实测**——若鲲鹏真机微基准显示 addv 是瓶颈，`cnt += svcntp_b32(pg, c)` 是一处一行的候选优化。

### 术语：谓词（predicate）

谓词 = 逐 lane 的"是/否"答案打包成的寄存器（标量代码里 `mask |= (base[i] <= x) << i` 手工攒的位掩码，就是它的 GPR 雏形）。代码里 `svbool_t` 一个类型扮演三个角色：

```cpp
svbool_t pg = svwhilelt_b32(i, 16);      // ① 考勤表：本轮哪些 lane 在岗（循环边界）
svuint32_t d = svld1_u32(pg, base + i);  // ② 开关（governing predicate）：不在岗的 lane 不访存
svbool_t c = svcmple_u32(pg, d, x);      // ③ 答题卡：每个 key 是否 <= x（比较结果）
```

物理形态：16 个谓词寄存器 P0~P15，每字节 1 位（u32 元素占 4 位）——比 AVX-512 的 mask 寄存器（每元素 1 位）粒度更细，因此只当"舵"用、计数需跨界（svaddv/CNTP）。NEON 没有谓词寄存器，只能用全 1 向量 + 移位 + 横加模拟——三种实现的硬件差异，核心就在谓词支持程度。

### VL 不定长：同一份编译产物在各硬件上的行为

SVE 的向量长度由硬件在运行时决定（128~2048 位、128 位步进），编译期未知。上面的循环对此的全部处理就是三行：`svwhilelt_b32(i, 16)` 由循环边界生成活跃谓词（自动消化不整除与超大 VL）、`i += svcntw()` 步长运行时读硬件（CNTW 指令）、`svld1_u32(pg, ...)` 谓词化载入（不活跃 lane 不碰内存——超大 VL 不会越界读）：

| 硬件 VL | svcntw() | 行为 | 轮数 |
|---|---|---|---|
| 128 位 | 4 | 每轮活跃 4 lane | 4 |
| 256 位（鲲鹏 920） | 8 | 每轮 8 | 2 |
| 384 位（架构允许的中间值） | 12 | 第 2 轮 whilelt 只激活 4 lane | 2 |
| 512 位 | 16 | 单轮吃满 | 1 |
| 1024 / 2048 位 | 32 / 64 | whilelt 钳到 16，多余 lane 不活跃、不访存 | 1 |

正确性对所有行成立，收益随宽度缩放（design 风险表："VL-agnostic 写法保证正确性；性能随 VL 缩放是预期行为"）。附带一处对照：`svld1` 谓词化逐 lane 载入无对齐要求，而 x86 的 `_mm512_load_si512` 是对齐载入（需第 3 节的 64B 对齐分配）——VL-agnostic 写法连对齐问题都顺带规避。

u64 版同型（8 key、`svwhilelt_b64`/`svcntd`）。桥接侧（`index.cpp:168` 附近）用 `#if defined(__aarch64__) && defined(OVERLAYBD_ENABLE_SVE)` 包裹，宏由 CMake 注入——TU 没编进来时，整个 SVE 分支从源码层面消失。

## 6. 运行时分派（`new_index_with_lineriazed_bptree()`，`index.cpp:466` 附近）

建索引时的选择链，优先级从高到低：

```cpp
if (is_avx512f_supported()) {          // x86_64：原有逻辑，未动
    return new IndexLBPTAcc<KeyType>(...);
}
#if defined(__aarch64__) && defined(OVERLAYBD_ENABLE_SVE)
    if (sve_supported()) {
        LOG_INFO("using SVE search for linearized b+tree, tier=",
                 sve2_supported() ? "SVE2" : "SVE1", ", vl_bytes=", lsmt_sve_vl_bytes());
        return new IndexLBPTSve<KeyType>(...);
    }
#endif
#ifdef __aarch64__
    LOG_INFO("using NEON search for linearized b+tree, tier=NEON");
    return new IndexLBPTNeon<KeyType>(...);
#endif
    return new IndexLBPT<KeyType>(...); // 标量兜底
```

探测位（`index.cpp:79`）：`sve_supported()` = `getauxval(AT_HWCAP) & (1<<22)`（HWCAP_SVE）；`sve2_supported()` = `AT_HWCAP2 & (1<<1)`。**HWCAP2_SVE2 只影响日志分档，不影响代码路径**——因为本内核没有 SVE2 专属指令，档位只用于可观测性。另有一层保底：树构建失败时回落到原有的二分查找 `Index`，与本次优化无关的历史行为。

## 7. 构建接线（`src/overlaybd/lsmt/CMakeLists.txt`）

设计目标：SVE 加速是**纯增益**，任何工具链上构建都不能因此失败。

1. `file(GLOB)` 之后 `list(REMOVE_ITEM ... index_sve.cpp)`——默认不编；
2. 仅当 `CMAKE_SYSTEM_PROCESSOR` 匹配 aarch64 且未设 `OVERLAYBD_DISABLE_SVE` 时做**双检**：
   - `check_cxx_compiler_flag("-march=armv8.2-a+sve")`（编译器认不认这个 flag）；
   - `check_cxx_source_compiles` 编译一段最小探针 TU（含 `svwhilelt/svld1/svcmple/svaddv`，确认 `arm_sve.h` 真实可用）；
3. 双检通过：`target_sources` 加回 `index_sve.cpp`，`set_source_files_properties` 单独给它 `-march=armv8.2-a+sve`，并 `target_compile_definitions(... PUBLIC OVERLAYBD_ENABLE_SVE)` 打开源码里的桥接分支；
4. 任一失败：跳过，CMake 输出 `LSMT SVE acceleration: DISABLED (toolchain probe failed)`，devtoolset-7（gcc7）等老工具链自动落 NEON/标量。

`OVERLAYBD_DISABLE_SVE=1`（cmake 开关）可强制跳过全部探测，作为逃生门。

## 8. 对拍验证（`verify_inner_search_impls()`，`index.cpp:1103`）

测试入口在 `test/inner_search_test.cpp`（一个 `TEST(inner_search, cross_validation)`，断言对拍函数返回 0）。对拍本体在 index.cpp 里，结构：

- **固定种子**的 xorshift64（`0x243F6A8885A308D3`）——失败可复现，不依赖随机设备；
- **4096 组试验**，每组生成一个升序节点（u32 16-key 与 u64 8-key 各一套）；
- **查询值三类混合**：边界哨兵（`0 / 1 / 0x7fffffff / 0x80000000 / 0xffffffff` 等，含无符号比较的翻极值点）、恰好等于某个已存 key、纯随机——覆盖对拍最怕的"边界算错但均值正确"；
- 每个 SIMD 实现（NEON / SVE / 条件编译的 AVX-512）与标量引用逐位比对，失配计数，返回非零即失败。

运行方式（构建产物目录下）：

```bash
./lsmt_test --gtest_filter=inner_search*
```

## 9. 已知坑与扩展点

| 事项 | 说明 |
|---|---|
| `+sve2` 禁令 | 见第 5 节；SVE2-only 指令在鲲鹏 920 上 SIGILL，硬规则写在 `index_sve.cpp` 文件头注释 |
| SVE2 档位 | 已预留探测与日志（`sve2_supported()`），但当前内核无 SVE2 受益指令；未来引入第二 SVE2 TU 时在此扩展 |
| SVE2 真机验证 | 尚未做（SVE1 ⊂ SVE2 架构保证兼容性）；拿到 SVE2 硬件后先跑 `inner_search*` 对拍冒烟 |
| u32/u64 树选择 | 建索引时自动：卷 < 2TB 且段数 < 约 3.86 亿用 u32，否则 u64（`index.cpp:1090`） |
| 老工具链 | gcc < 10 无 `arm_sve.h`，双检自动降级，构建不失败 |
| 性能复测 | 微基准方法与数字见 `docs/lsmt_lookup.md` 与 `docs/lsmt_arm64_sve.md` |

## 10. 改动清单速览

一次读路径上，ARM64 的变化只有一处分派、两个新 policy、一个新 TU：

```
建索引 (new_index_with_lineriazed_bptree)
  ├─ x86:  AVX-512（原有）           ── 未改动
  ├─ arm:  SVE（HWCAP_SVE 探测）     ── 新增：index_sve.cpp + 桥接
  ├─ arm:  NEON（架构保证，免检）     ── 新增：NeonInnerSearch
  └─ 兜底: 标量 DefaultInnerSearch    ── 原有，语义基准
```
