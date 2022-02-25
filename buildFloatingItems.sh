#!/bin/bash
ppc-unknown-linux-gnu-as -mgekko floatingItems.s -o floatingItems.temp
ppc-unknown-linux-gnu-objcopy floatingItems.temp -O binary -j .text floatingItems.bin
rm floatingItems.temp
