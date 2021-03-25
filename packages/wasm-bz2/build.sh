#!/bin/bash

set -euo pipefail

WORK_DIR=`pwd`/`dirname $0`
IMAGE=emscripten/emsdk:2.0.15

# Clone the bzip2 repo
if [ ! -d "$WORK_DIR/vendor" ]; then
    mkdir -p "$WORK_DIR/vendor"
    git clone https://gitlab.com/federicomenaquintero/bzip2 "$WORK_DIR"/vendor/bzip2
    (cd "$WORK_DIR"/vendor/bzip2 && git checkout 6211b6500c8bec13a17707440d3a84ca8b34eed5)
fi

mkdir -p "$WORK_DIR/build"

# Produce a version string which would normally be created by CMake
echo '#define BZ_VERSION "wasm-bz2"' > "$WORK_DIR/build/bz_version.h"

function run_emcc() {
    docker run \
    --rm \
    -v $WORK_DIR:$WORK_DIR \
    -v "$WORK_DIR"/.emscripten_cache:/emsdk/upstream/emscripten/cache \
    -w "$WORK_DIR/build" \
    $IMAGE \
    emcc \
        -fno-rtti \
        -fno-exceptions \
        -flto \
        -Wall \
        --bind \
        -O3 \
        --profiling \
        -g4 \
        -DEMSCRIPTEN_HAS_UNBOUND_TYPE_NAMES=0 `# allows embind to work with rtti disabled` \
        -s ALLOW_MEMORY_GROWTH=1 \
        -s DEMANGLE_SUPPORT=1 \
        -s "EXPORTED_FUNCTIONS=['_malloc', '_free']" \
        -s "EXTRA_EXPORTED_RUNTIME_METHODS=['ccall', 'cwrap']" \
        -s FILESYSTEM=0 `# we don't need filesystem support. This should reduce file sizes` \
        -s MODULARIZE=1 \
        -s WARN_UNALIGNED=1 \
        -s WASM=1 \
        -s DISABLE_EXCEPTION_CATCHING=1 \
        -I"$WORK_DIR/build" `# for bz_version.h` \
        "$@"
}

run_emcc -c "$WORK_DIR"/vendor/bzip2/{bzlib,decompress,huffman,randtable,crctable}.c

run_emcc \
    -isystem $WORK_DIR/vendor \
    -std=c++17 \
    "$WORK_DIR/cpp/module.cpp" \
    "$WORK_DIR"/build/{bzlib,decompress,huffman,randtable,crctable}.o \
    -o "$WORK_DIR"/dist/module.js
