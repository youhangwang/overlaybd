# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-09-05T16:01:53.896Z
> Files: 222 tracked | Anatomy hits: 0 | Misses: 0

> Project structure index. Auto-maintained by OpenWolf hooks and daemon.
> Run `openwolf scan` to generate, or wait for the first Claude Code session.
> Status: Pending initial scan

## ./

- `.clang-format` (~58 tok)
- `.gitignore` — Git ignore rules (~12 tok)
- `.gitmodules` (~112 tok)
- `CLAUDE.md` — OpenWolf (~34 tok)
- `CMakeLists.txt` — CMake build configuration (~766 tok)
- `CONTRIBUTING.md` — Contributing (~670 tok)
- `GEMINI.md` — OpenWolf (~75 tok)
- `LICENSE` — Project license (~3029 tok)
- `MAINTAINERS` — overlaybd maintainers (~168 tok)
- `README.md` — Project documentation (~5919 tok)

## .claude/

- `settings.json` (~665 tok)

## .claude/commands/

- `designqc.md` (~343 tok)
- `reframe.md` — Mode: migrate [framework] (~551 tok)
- `security-audit.md` — Layer 1 — Dependencies (~510 tok)

## .claude/commands/opsx/

- `apply.md` — Implementing: <change-name> (schema: <schema-name>) (~2006 tok)
- `archive.md` — Archive Complete (~2867 tok)
- `explore.md` — The Stance (~2962 tok)
- `propose.md` (~2765 tok)
- `sync.md` — Purpose (~3092 tok)
- `update.md` — /*.md`). Do NOT write to `resolvedOutputPath`: for a glob artifact it is still the glob pattern, not a real file. (~1666 tok)

## .claude/rules/

- `openwolf.md` (~251 tok)

## .claude/skills/openspec-apply-change/

- `SKILL.md` — Implementing: <change-name> (schema: <schema-name>) (~2041 tok)

## .claude/skills/openspec-archive-change/

- `SKILL.md` — Archive Complete (~2661 tok)

## .claude/skills/openspec-explore/

- `SKILL.md` — The Stance (~3683 tok)

## .claude/skills/openspec-propose/

- `SKILL.md` (~2820 tok)

## .claude/skills/openspec-sync-specs/

- `SKILL.md` — Purpose (~3121 tok)

## .claude/skills/openspec-update-change/

- `SKILL.md` — /*.md`). Do NOT write to `resolvedOutputPath`: for a glob artifact it is still the glob pattern, not a real file. (~1707 tok)

## .github/

- `dependabot.yml` — Keep dependencies up to date automatically. (~172 tok)
- `PULL_REQUEST_TEMPLATE.md` (~189 tok)

## .github/ISSUE_TEMPLATE/

- `bug-report.yaml` — you may not use this file except in compliance with the License. (~615 tok)
- `config.yml` — you may not use this file except in compliance with the License. (~234 tok)
- `feature-request.yaml` — you may not use this file except in compliance with the License. (~520 tok)

## .github/workflows/

- `cmake.yml` — CI: CMake (~1490 tok)
- `project-checks.yml` — CI: Project Checks (~654 tok)
- `release.yml` — CI: Release (~1444 tok)

## .github/workflows/release/

- `build.sh` — you may not use this file except in compliance with the License. (~1739 tok)
- `Dockerfile` — Docker container definition (~254 tok)

## CMake/

- `Findaio.cmake` (~64 tok)
- `FindCURL.cmake` (~742 tok)
- `Finde2fs.cmake` (~615 tok)
- `FindOpenSSL.cmake` (~707 tok)
- `Findphoton.cmake` (~210 tok)
- `FindRapidJSON.cmake` (~143 tok)
- `Findtcmu.cmake` (~107 tok)
- `pack.cmake` (~232 tok)

## baselayers/

- `CMakeLists.txt` — CMake build configuration (~84 tok)

## docs/

- `.nojekyll` (~0 tok)
- `cache.md` — Overlaybd File Cache (~631 tok)
- `ctimg.md` — Why Containers and Secure Containers Should Use Overlaybd Images (~4042 tok)
- `dadi-aliyun-2020-en.md` — Launching 10,000 Containers in Seconds: Inside Alibaba Cloud's Container Image Acceleration (~972 tok)
- `dadi-aliyun-2020.md` — 秒级启动万个容器，探秘阿里云容器镜像加速黑科技 (~373 tok)
- `index.html` — Overlay Block Device (~923 tok)
- `lsmt_arm64_sve.md` — 让容器镜像学会按需读取：overlaybd 的 ARM64 查找优化 (~2302 tok)
- `lsmt_lookup.md` — Lookup Algorithm in LSMT (~210 tok)
- `README.md` — Project documentation (~5567 tok)
- `sbimg.md` — Why Agent Sandboxes Should Use Overlaybd Images (~4168 tok)
- `vmimg.md` — Why Virtual Machines Should Use Overlaybd Images (~3611 tok)

## openspec/

- `config.yaml` (~264 tok)

## openspec/changes/arm64-sve-lsmt-lookup/

- `design.md` — Design: arm64-sve-lsmt-lookup (~156 tok)
- `proposal.md` — Proposal: arm64-sve-lsmt-lookup (~415 tok)
- `tasks.md` — Tasks: arm64-sve-lsmt-lookup (~434 tok)

## openspec/changes/arm64-sve-lsmt-lookup/specs/lsmt-arm64-lookup/

- `spec.md` — Delta spec: lsmt-arm64-lookup (~1117 tok)

## src/

- `api_server.cpp` — Declares ApiHandler (~1754 tok)
- `api_server.h` — Declares std (~215 tok)
- `bk_download.cpp` — Declares std (~2242 tok)
- `bk_download.h` — Declares ImageFile (~570 tok)
- `CMakeLists.txt` — CMake build configuration (~512 tok)
- `config.h` — Declares int (~1623 tok)
- `exporter_handler.h` — Declares char (~1180 tok)
- `exporter_server.h` — Declares OverlayBDMetric (~744 tok)
- `image_file.cpp` — Declares std (~6815 tok)
- `image_file.h` — Declares ImageFile (~1460 tok)
- `image_service.cpp` — Declares char (~7393 tok)
- `image_service.h` — Declares ImageService (~779 tok)
- `main.cpp` — Declares TCMUDevLoop (~4562 tok)
- `metrics_fs.h` — Declares MetricFile (~841 tok)
- `prefetch.cpp` — Declares PrefetcherImpl (~5682 tok)
- `prefetch.h` — Declares Prefetcher (~862 tok)
- `switch_file.cpp` — Declares char (~1787 tok)
- `switch_file.h` — Declares ISwitchFile (~309 tok)
- `textexporter.h` — Declares auto (~1806 tok)
- `version.h` — pragma once (~41 tok)

## src/example_config/

- `cred.json` (~38 tok)
- `overlaybd-registryv2.json` (~192 tok)
- `overlaybd-tcmu.service` (~114 tok)
- `overlaybd.json` (~299 tok)
- `redis.obd.config.json` (~436 tok)
- `stream-conv.yaml` (~77 tok)

## src/overlaybd/

- `base64.h` — pragma once (~883 tok)
- `CMakeLists.txt` — CMake build configuration (~142 tok)
- `config_util.h` — Declares struct (~1630 tok)

## src/overlaybd/cache/

- `cache.cpp` (~1211 tok)
- `cache.h` — Declares int (~1530 tok)
- `cached_fs.cpp` — Declares uint64_t (~4306 tok)
- `CMakeLists.txt` — CMake build configuration (~115 tok)
- `forwardcfs.h` — Declares IForwardCachedFile (~657 tok)
- `pool_store.h` — Declares ListType (~2819 tok)
- `store.cpp` — Declares uint32_t (~4489 tok)

## src/overlaybd/cache/download_cache/

- `CMakeLists.txt` — CMake build configuration (~45 tok)
- `download_cache.cpp` — Declares DownloadCacheFs (~3757 tok)

## src/overlaybd/cache/full_file_cache/

- `cache_pool.cpp` — Declares uint64_t (~2821 tok)
- `cache_pool.h` — Declares FileCachePool (~1048 tok)
- `cache_store.cpp` — Declares uint64_t (~2057 tok)
- `cache_store.h` — Declares FileCachePool (~716 tok)
- `CMakeLists.txt` — CMake build configuration (~46 tok)

## src/overlaybd/cache/gzip_cache/

- `cached_fs.cpp` — Declares GzipCachedFsImpl (~830 tok)
- `cached_fs.h` — Declares GzipCachedFs (~326 tok)
- `CMakeLists.txt` — CMake build configuration (~53 tok)

## src/overlaybd/cache/ocf_cache/

- `CMakeLists.txt` — CMake build configuration (~203 tok)
- `ocf_cache.cpp` — include <sys/stat.h> (~2973 tok)
- `ocf_namespace.cpp` — include "ocf_namespace.h" (~1707 tok)
- `ocf_namespace.h` — pragma once (~330 tok)

## src/overlaybd/cache/ocf_cache/ease_bindings/

- `ctx.cpp` — include "ctx.h" (~2344 tok)
- `ctx.h` — pragma once (~510 tok)
- `provider.cpp` — include "provider.h" (~3018 tok)
- `provider.h` — pragma once (~717 tok)
- `queue.cpp` — include "queue.h" (~534 tok)
- `queue.h` — pragma once (~44 tok)
- `volume.cpp` — include "volume.h" (~2026 tok)
- `volume.h` — pragma once (~96 tok)

## src/overlaybd/cache/ocf_cache/ease_bindings/env/

- `ocf_env_headers.h` — ifndef __OCF_ENV_HEADERS_H__ (~117 tok)
- `ocf_env_list.h` — List entry structure mimicking linux kernel based one. (~1270 tok)
- `ocf_env.cpp` — include <photon/thread/thread.h> (~2240 tok)
- `ocf_env.h` — ifndef __OCF_ENV_H__ (~3206 tok)
- `utils_mpool.cpp` — ifdef __cplusplus (~878 tok)
- `utils_mpool.h` — ifndef UTILS_MPOOL_H_ (~621 tok)

## src/overlaybd/cache/ocf_cache/test/

- `CMakeLists.txt` — CMake build configuration (~127 tok)
- `flags.conf` — multi_files_test=false (~79 tok)
- `ocf_perf_test.cpp` — include <fcntl.h> (~5090 tok)

## src/overlaybd/cache/policy/

- `lru.h` — Declares LRU (~1346 tok)

## src/overlaybd/cache/test/

- `cache_test.cpp` — Declares std (~5352 tok)
- `CMakeLists.txt` — CMake build configuration (~112 tok)
- `random_generator.h` — Declares RandomValueGen (~480 tok)

## src/overlaybd/gzindex/

- `CMakeLists.txt` — CMake build configuration (~62 tok)
- `gzfile_index.h` — Declares IndexFilterRecorder (~912 tok)
- `gzfile.cpp` — Declares GzFile (~3781 tok)
- `gzfile.h` — Declares char (~368 tok)
- `gzip_index_create.cpp` — Declares IndexFileHeader (~3824 tok)

## src/overlaybd/gzindex/test/

- `CMakeLists.txt` — CMake build configuration (~123 tok)
- `test.cpp` — Declares GzIndexTest (~6327 tok)

## src/overlaybd/gzip/

- `CMakeLists.txt` — CMake build configuration (~66 tok)
- `gz.cpp` — Declares GzAdaptorFile (~2961 tok)
- `gz.h` — Declares IGzFile (~325 tok)

## src/overlaybd/lsmt/

- `CMakeLists.txt` — Declares uint32_t (~452 tok)
- `file.cpp` — Declares SegmentMapping (~20108 tok)
- `file.h` — Declares int (~2149 tok)
- `format_spec.md` — Overlaybd read-only layer blob format (~1393 tok)
- `index_sve.cpp` — SVE1 implementation of the LSMT B+tree inner search. (~176 tok)
- `index.cpp` — Declares Segment (~11690 tok)
- `index.h` — Declares uint64_t (~2374 tok)

## src/overlaybd/lsmt/test/

- `CMakeLists.txt` (~115 tok)
- `lsmt-filetest.h` — Declares static (~5962 tok)
- `test.cpp` — Declares SegmentMapping (~11582 tok)

## src/overlaybd/registryfs/

- `CMakeLists.txt` — CMake build configuration (~64 tok)
- `registryfs_v2.cpp` — Declares estring (~9382 tok)
- `registryfs.cpp` — Declares estring (~5926 tok)
- `registryfs.h` — Declares RegistryFS (~696 tok)

## src/overlaybd/stream_convertor/

- `CMakeLists.txt` — CMake build configuration (~93 tok)
- `config_utils.h` — pragma once (~671 tok)
- `config.h` (~442 tok)
- `stream_conv.cpp` — include <fcntl.h> (~2542 tok)

## src/overlaybd/tar/

- `CMakeLists.txt` — CMake build configuration (~67 tok)
- `header.cpp` — include "libtar.h" (~3617 tok)
- `libtar.cpp` — include "libtar.h" (~3270 tok)
- `libtar.h` — pragma once (~2335 tok)
- `tar_file.cpp` — Declares char (~3402 tok)
- `tar_file.h` (~290 tok)
- `whiteout.cpp` — include "libtar.h" (~963 tok)

## src/overlaybd/tar/erofs/

- `CMakeLists.txt` — CMake build configuration (~327 tok)
- `erofs_common.cpp` — Declares for (~2821 tok)
- `erofs_common.h` — Declares cls (~996 tok)
- `erofs_fs.cpp` — Declares char (~4951 tok)
- `erofs_fs.h` — Declares ErofsFileSystem (~970 tok)
- `liberofs.cpp` — include "erofs_common.h" (~2437 tok)
- `liberofs.h` — ifndef TAREROFS_INTERFACE_H (~143 tok)

## src/overlaybd/tar/erofs/test/

- `CMakeLists.txt` — CMake build configuration (~298 tok)
- `erofs_simple.cpp` — Declares ErofsTest (~16772 tok)
- `erofs_stress_base.cpp` — Declares char (~4702 tok)
- `erofs_stress_base.h` — Declares NODE_TYPE (~2609 tok)
- `erofs_stress.cpp` — func: xattr, xattr (~11272 tok)

## src/overlaybd/tar/test/

- `CMakeLists.txt` — CMake build configuration (~119 tok)
- `test.cpp` — Declares TarTest (~4469 tok)

## src/overlaybd/zfile/

- `CMakeLists.txt` — CMake build configuration (~653 tok)
- `compressor.cpp` — Declares BaseCompressor (~4014 tok)
- `compressor.h` — Declares IFile (~978 tok)
- `format_spec.md` — ZFile format (~904 tok)
- `README.md` — Project documentation (~994 tok)
- `zfile.cpp` — Declares static (~15710 tok)
- `zfile.h` — Declares static (~454 tok)

## src/overlaybd/zfile/crc32/

- `crc32c.cpp` — ************************************************************* (~12374 tok)
- `crc32c.h` — Declares void (~326 tok)

## src/overlaybd/zfile/lz4/

- `lz4-qat.cpp` — include "lz4-qat.h" (~4591 tok)
- `lz4-qat.h` — ifndef ZFILE_LZ4_QAT_H (~528 tok)
- `lz4.c` — Declares union (~25101 tok)
- `lz4.h` — Introduction (~9103 tok)
- `test.c` — include "lz4.h" // This is all that is required to expose the prototypes for basic compression and decompression. (~1610 tok)

## src/overlaybd/zfile/test/

- `CMakeLists.txt` — CMake build configuration (~111 tok)
- `test.cpp` — Declares ZFileTest (~3722 tok)

## src/overlaybd/zfile/thirdparty/

- `CMakeLists.txt` — CMake build configuration (~319 tok)

## src/overlaybd/zstd/

- `CMakeLists.txt` — CMake build configuration (~52 tok)
- `zstdfile.cpp` — Declares ZStdAdaptorFile (~1056 tok)
- `zstdfile.h` (~264 tok)

## src/test/

- `CMakeLists.txt` — CMake build configuration (~533 tok)
- `image_service_test.cpp` — Declares DevIDGetTest (~5338 tok)
- `resize_test.cpp` — Declares char (~3142 tok)
- `simple_credsrv_test.cpp` — include <gtest/gtest.h> (~1227 tok)
- `trace_test.cpp` — include <fcntl.h> (~2485 tok)

## src/tools/

- `CLI11.hpp` — detection of rtti (~95915 tok)
- `CMakeLists.txt` — CMake build configuration (~599 tok)
- `comm_func.cpp` — Declares char (~1197 tok)
- `comm_func.h` — Declares char (~562 tok)
- `overlaybd-apply.cpp` — Declares FIFOFile (~1990 tok)
- `overlaybd-commit.cpp` — Declares char (~2553 tok)
- `overlaybd-create.cpp` — Declares char (~1165 tok)
- `overlaybd-merge.cpp` — Declares FIFOFile (~1725 tok)
- `overlaybd-resize.cpp` — Declares std (~1112 tok)
- `overlaybd-zfile.cpp` — Declares IStreamFile (~1884 tok)
- `qcow2converter.cpp` — include <cstdio> (~11349 tok)
- `qcow2converter.h` — pragma once (~144 tok)
- `sha256file.cpp` — include <fcntl.h> (~966 tok)
- `sha256file.h` — include <photon/fs/localfs.h> (~100 tok)
- `turboOCI-apply.cpp` — Declares string (~1651 tok)
