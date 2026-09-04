// Cross-validation of LSMT inner-search implementations (scalar reference vs
// AVX-512 / NEON / SVE tiers) -- see LSMT::verify_inner_search_impls() in
// index.cpp for what is covered (randomized + boundary inputs, kernel and
// tree level).
#include <gtest/gtest.h>
#include "../index.h"

TEST(inner_search, cross_validation) {
    ASSERT_EQ(0, LSMT::verify_inner_search_impls());
}
