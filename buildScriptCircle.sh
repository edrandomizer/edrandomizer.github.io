#!/bin/bash
ppc-unknown-linux-gnu-as -mgekko scriptCircle.s -o scriptCircle.temp
ppc-unknown-linux-gnu-objcopy scriptCircle.temp -O binary -j .text scriptCircle.bin
rm scriptCircle.temp
