#!/bin/bash
ppc-unknown-linux-gnu-as -mgekko allocate.s -o bpe.temp
ppc-unknown-linux-gnu-objcopy bpe.temp -O binary -j .text allocate.bin
rm bpe.temp

ppc-unknown-linux-gnu-as -mgekko free.s -o bpe.temp
ppc-unknown-linux-gnu-objcopy bpe.temp -O binary -j .text free.bin
rm bpe.temp

ppc-unknown-linux-gnu-as -mgekko read.s -o bpe.temp
ppc-unknown-linux-gnu-objcopy bpe.temp -O binary -j .text read.bin
rm bpe.temp

ppc-unknown-linux-gnu-as -mgekko suballocate.s -o bpe.temp
ppc-unknown-linux-gnu-objcopy bpe.temp -O binary -j .text suballocate.bin
rm bpe.temp
