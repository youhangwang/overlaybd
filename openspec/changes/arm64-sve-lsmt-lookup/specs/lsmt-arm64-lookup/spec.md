# Delta spec: lsmt-arm64-lookup

## Purpose

Defines how the LSMT linearized B+tree index lookup selects its inner-search implementation on ARM64 hardware, guaranteeing that every implementation path (SVE, AdvSIMD, scalar) yields identical lookup results and that binaries built with SIMD support remain correct on hardware lacking it.

## ADDED Requirements

### Requirement: Hardware-adaptive lookup acceleration on ARM64

On ARM64, when an index using the linearized B+tree is created, the system SHALL select the inner-search implementation by descending a runtime capability ladder — SVE2-capable, SVE-capable (both served by the SVE implementation), then AdvSIMD, then scalar — and SHALL report the detected tier (SVE2-capable / SVE-capable / AdvSIMD / scalar) so the active path is observable. Selection on non-ARM64 platforms SHALL be unchanged from current behavior.

#### Scenario: SVE2-capable hardware selects SVE path

- **WHEN** overlaybd runs on ARM64 hardware advertising both SVE and SVE2 capabilities (e.g. ARMv9 Neoverse-class cores)
- **THEN** lookups are served by the SVE implementation (SVE1 code is architecturally valid on SVE2), the reported tier is SVE2-capable, and benefits scale with the hardware vector length

#### Scenario: SVE-capable hardware selects SVE path

- **WHEN** overlaybd runs on ARM64 hardware whose kernel advertises the SVE hardware capability (e.g. Kunpeng 920)
- **THEN** the accelerated-search selection log is emitted, the reported tier is SVE-capable, and lookups are served by the SVE implementation

#### Scenario: AdvSIMD-only hardware keeps full functionality

- **WHEN** overlaybd runs on ARM64 hardware without SVE (AdvSIMD baseline only)
- **THEN** lookups are served by the AdvSIMD implementation, the reported tier is AdvSIMD, and index behavior is fully functional

#### Scenario: Non-ARM64 platforms unchanged

- **WHEN** overlaybd runs on x86_64
- **THEN** implementation selection proceeds exactly as before this change (AVX-512 when supported, scalar fallback otherwise)

### Requirement: Identical lookup results across implementations

Every selectable inner-search implementation SHALL return the same result as the scalar reference implementation for the same index content and query offset, including boundary conditions (query below all keys, above all keys, exactly equal to a key, and indexes containing padding/empty entries).

#### Scenario: Randomized cross-validation

- **WHEN** indexes populated with randomized mapping sets are queried through every compiled implementation on the same query set
- **THEN** all implementations return results identical to the scalar reference with zero mismatches

#### Scenario: Boundary and padded-index agreement

- **WHEN** queries hit key-range boundaries (first key, last key, gaps between mappings) on trees whose leaf level is padded
- **THEN** every implementation agrees with the scalar reference

### Requirement: SVE vector-length independence

The SVE implementation SHALL produce correct results for any runtime SVE vector length supported by the hardware, without compile-time vector-length assumptions.

#### Scenario: Different vector lengths agree

- **WHEN** the SVE implementation executes on hardware with different SVE vector lengths (e.g. 128-bit and 256-bit)
- **THEN** lookup results remain identical to the scalar reference on each platform

### Requirement: Binaries remain portable across ARM64 capability levels

The build SHALL produce binaries that load and operate correctly on ARM64 systems lacking SVE, even though the build compiled an SVE implementation; capability detection MUST be performed at runtime, not build time.

#### Scenario: SVE-enabled binary on non-SVE machine

- **WHEN** a binary built with SVE support starts on ARM64 hardware without SVE
- **THEN** startup and index operations succeed via the non-SVE path, with no illegal-instruction faults

### Requirement: Compiler feature detection in the build

The build system SHALL compile the SVE implementation only when the toolchain supports SVE code generation, and SHALL fall back to building without it (AdvSIMD/scalar paths only) when it does not, without failing the build.

#### Scenario: Older toolchain without SVE support

- **WHEN** the project is built with a toolchain that cannot generate SVE code (e.g. devtoolset-7 based release builds)
- **THEN** the build succeeds and the produced binary uses the AdvSIMD or scalar path at runtime
