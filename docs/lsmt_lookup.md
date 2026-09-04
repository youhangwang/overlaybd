# Lookup Algorithm in LSMT

## Description

LBA lookup in LSMT can be abstracted as a segment search problem, searching within a sorted set of non-overlapping intervals. Previously, we used binary search via std::lower_bound. Now, we've adopted a linearized B+ tree combined with AVX-512, which better exploits CPU cache efficiency and delivers over a 10X speedup in lookup performance. Even in environments without AVX-512 support, using a loop optimized with bitmask still yields significant performance gains.


## Performance

| segment count | b+tree + avx512 | b+tree + loop + bitmask | lower bound |
|---------------|-----------------|---------------|-------------|
| 1k   | 220 M/s | 42.2 M/s | 18.3 M/s |
| 10k  | 160 M/s | 30.7 M/s | 12.8 M/s |
| 100k | 108 M/s | 21.8 M/s | 8.6 M/s  |
| 1M   | 57.4 M/s | 15.2 M/s | 5.6 M/s  |
## ARM64 Hardware Tier Ladder

On aarch64, the inner search adapts to runtime CPU capability, selecting the
best available tier (see `src/overlaybd/lsmt/index.cpp` and `index_sve.cpp`):

| Tier | Detection | Implementation | Example hardware |
|------|-----------|----------------|------------------|
| SVE2 | HWCAP_SVE + HWCAP2_SVE2 | SVE TU (SVE1 is a strict subset of SVE2, same code) | Neoverse V2 / Grace, Graviton4 |
| SVE1 | HWCAP_SVE | SVE TU (VL-agnostic, benefits scale with vector length) | Kunpeng 920 (256-bit), Graviton3 |
| NEON | mandatory on aarch64 (no check) | AdvSIMD compare-count, 128-bit | NEON-only machines |
| scalar | build/toolchain fallback | unrolled bitmask loop | semantic reference / degraded builds |

The selection is reported at index creation time via the log, e.g.
`using SVE search for linearized b+tree, tier=SVE1, vl_bytes=32`.

Measured on Kunpeng 920 7280Z (256-bit SVE1, openEuler 24.03, gcc 12.3),
single-thread ns per inner_search (16x u32 keys / 8x u64 keys per node):

| kernel | scalar | NEON-128 | SVE-256 |
|--------|--------|----------|---------|
| u32 / 16 keys | 23.6 | 12.0 (2.0x) | 8.1 (2.9x) |
| u64 / 8 keys | 15.9 | 13.1 (1.2x) | 8.3 (1.9x) |

The gain is stable across working sets from L1 (32KB) to RAM (256MB).
Correctness of every tier is cross-validated against the scalar reference by
`LSMT::verify_inner_search_impls()` (see `src/overlaybd/lsmt/test/`).
