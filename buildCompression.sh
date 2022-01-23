#!/bin/bash
emcc SK_ASCCompression.c -s EXPORTED_FUNCTIONS=_DecompressSK_ASC,_DecompressText,_malloc,_free -s EXPORTED_RUNTIME_METHODS=ccall,getValue -s ALLOW_MEMORY_GROWTH=1 -o skasc.js -fsanitize=undefined,address
