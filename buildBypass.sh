#!/bin/bash
ppc-unknown-linux-gnu-as -mgekko compressionBypass.s -o bypass.temp
ppc-unknown-linux-gnu-objcopy bypass.temp -O binary -j .text compressionBypass.bin
rm bypass.temp
