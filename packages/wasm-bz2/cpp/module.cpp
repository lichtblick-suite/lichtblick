#include <bzip2/bzlib.h>
#include <emscripten/bind.h>

static const char *errorCodeToString(int code) {
  switch (code) {
  case BZ_SEQUENCE_ERROR:
    return "BZ_SEQUENCE_ERROR";
  case BZ_PARAM_ERROR:
    return "BZ_PARAM_ERROR";
  case BZ_MEM_ERROR:
    return "BZ_MEM_ERROR";
  case BZ_DATA_ERROR:
    return "BZ_DATA_ERROR";
  case BZ_DATA_ERROR_MAGIC:
    return "BZ_DATA_ERROR_MAGIC";
  case BZ_IO_ERROR:
    return "BZ_IO_ERROR";
  case BZ_UNEXPECTED_EOF:
    return "BZ_UNEXPECTED_EOF";
  case BZ_OUTBUFF_FULL:
    return "BZ_OUTBUFF_FULL";
  case BZ_CONFIG_ERROR:
    return "BZ_CONFIG_ERROR";
  }
  return nullptr;
}

emscripten::val decompress(uintptr_t dest, unsigned int destLen, uintptr_t src,
                           unsigned int srcLen, int small) {
  int ret = BZ2_bzBuffToBuffDecompress(reinterpret_cast<char *>(dest), &destLen,
                                       reinterpret_cast<char *>(src), srcLen,
                                       small, /*verbosity*/ 0);
  auto result = emscripten::val::object();
  result.set("code", emscripten::val(ret));
  if (ret == BZ_OK) {
    result.set("buffer", emscripten::val(emscripten::typed_memory_view(
                             destLen, reinterpret_cast<uint8_t *>(dest))));
  } else if (const char *str = errorCodeToString(ret)) {
    result.set("error", emscripten::val(str));
  }
  return result;
}

EMSCRIPTEN_BINDINGS(wasm_bz2) {
  emscripten::function("decompress", &decompress);
}
