AS := ppc-unknown-linux-gnu-as
OBJCOPY := ppc-unknown-linux-gnu-objcopy
EMCC := emcc

all: compression compression_bypass debug floating_items loading_memory script_circle text_memory bpe

bpe:
	$(AS) -mgekko assembly/bpe/allocate.s -o bpe.temp
	$(OBJCOPY) bpe.temp -O binary -j .text assets/bpe/allocate.bin
	rm bpe.temp
	
	$(AS) -mgekko assembly/bpe/free.s -o bpe.temp
	$(OBJCOPY) bpe.temp -O binary -j .text assets/bpe/free.bin
	rm bpe.temp
	
	$(AS) -mgekko assembly/bpe/read.s -o bpe.temp
	$(OBJCOPY) bpe.temp -O binary -j .text assets/bpe/read.bin
	rm bpe.temp
	
	$(AS) -mgekko assembly/bpe/suballocate.s -o bpe.temp
	$(OBJCOPY) bpe.temp -O binary -j .text assets/bpe/suballocate.bin
	rm bpe.temp

text_memory:
	$(AS) -mgekko assembly/textMemory.s -o textMemory.temp
	$(OBJCOPY) textMemory.temp -O binary -j .text assets/textMemory.bin
	rm textMemory.temp

script_circle:
	$(AS) -mgekko assembly/scriptCircle.s -o scriptCircle.temp
	$(OBJCOPY) scriptCircle.temp -O binary -j .text assets/scriptCircle.bin
	rm scriptCircle.temp

loading_memory:
	$(AS) -mgekko assembly/loadingMemory.s -o loadingMemory.temp
	$(OBJCOPY) loadingMemory.temp -O binary -j .text assets/loadingMemory.bin
	rm loadingMemory.temp

	$(AS) -mgekko assembly/loadingAllocate.s -o loadingAllocate.temp
	$(OBJCOPY) loadingAllocate.temp -O binary -j .text assets/loadingAllocate.bin
	rm loadingAllocate.temp

floating_items:
	$(AS) -mgekko assembly/floatingItems.s -o floatingItems.temp
	$(OBJCOPY) floatingItems.temp -O binary -j .text assets/floatingItems.bin
	rm floatingItems.temp

debug:
	$(AS) -mgekko assembly/debug.s -o debug.temp
	$(OBJCOPY) debug.temp -O binary -j .text assets/debug.bin
	rm debug.temp

compression_bypass:
	$(AS) -mgekko assembly/compressionBypass.s -o bypass.temp
	$(OBJCOPY) bypass.temp -O binary -j .text assets/compressionBypass.bin
	rm bypass.temp

compression:
	$(EMCC) SK_ASCCompression.c -s EXPORTED_FUNCTIONS=_DecompressSK_ASC,_DecompressText,_malloc,_free -s EXPORTED_RUNTIME_METHODS=ccall,getValue -s ALLOW_MEMORY_GROWTH=1 -s WASM=0 -o skasc.js

clean:
	rm -f ./assets/*.bin ./assets/bpe/*.bin skasc.js skasc.wasm
