lis %r0, 0x8000
cmplw %r26, %r0
blt end
or %r3, %r29, %r29
or %r4, %r26, %r26
addi %r5, %r21, 0x1f
rlwinm %r5, %r5, 0x0, 0x0, 0x1a
lwz %r6, 0x118(%r23)
lwz %r0, 0(%r28)
add %r6, %r6, %r0
li %r7, 2
bl 0x2137f4
b 0x139bd8
end:
