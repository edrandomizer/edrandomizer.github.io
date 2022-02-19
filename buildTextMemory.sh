#!/bin/bash
ppc-unknown-linux-gnu-as -mgekko textMemory.s -o textMemory.temp
ppc-unknown-linux-gnu-objcopy textMemory.temp -O binary -j .text textMemory.bin
rm textMemory.temp
