#!/bin/bash
emcc SK_ASCCompression.c -s EXPORTED_FUNCTIONS=_DecompressSK_ASC,_malloc,_free -s WASM=0 -s EXPORTED_RUNTIME_METHODS=ccall,getValue -s ALLOW_MEMORY_GROWTH=1 -o skasc.js
