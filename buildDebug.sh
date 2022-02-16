#!/bin/bash
ppc-unknown-linux-gnu-as -mgekko debug.s -o debug.temp
ppc-unknown-linux-gnu-objcopy debug.temp -O binary -j .text debug.bin
rm debug.temp
