#!/bin/bash
ppc-unknown-linux-gnu-as -mgekko loadingMemory.s -o loadingMemory.temp
ppc-unknown-linux-gnu-objcopy loadingMemory.temp -O binary -j .text loadingMemory.bin
rm loadingMemory.temp

ppc-unknown-linux-gnu-as -mgekko loadingAllocate.s -o loadingAllocate.temp
ppc-unknown-linux-gnu-objcopy loadingAllocate.temp -O binary -j .text loadingAllocate.bin
rm loadingAllocate.temp
