// SVE1 implementation of the LSMT B+tree inner search.
//
// This TU is compiled with -march=armv8.2-a+sve (SVE1, NOT +sve2):
// SVE1 code is a strict architectural subset of SVE2, so the same code
// serves SVE1 and SVE2-capable hardware. Never compile this TU with
// +sve2 -- hardware without SVE2 (e.g. Kunpeng 920, measured
// HWCAP2_SVE2=0) would fault with SIGILL on SVE2 instructions.
#include <cstdint>
#include <arm_sve.h>

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

extern "C" uint32_t lsmt_sve_inner_search_u64(const uint64_t *base, uint64_t x) {
    uint32_t cnt = 0;
    for (uint32_t i = 0; i < 8;) {
        svbool_t pg = svwhilelt_b64((uint64_t)i, (uint64_t)8);
        svuint64_t d = svld1_u64(pg, base + i);
        svbool_t c = svcmple_u64(pg, d, svdup_u64(x));
        cnt += (uint32_t)svaddv_u64(c, svdup_u64(1));
        i += svcntd();
    }
    return cnt;
}

extern "C" uint32_t lsmt_sve_vl_bytes() {
    return svcntb();
}
