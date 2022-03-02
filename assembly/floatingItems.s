lwz %r3, 0x28(%r31)
cmpwi %r3, 0
beq end
bl 0x201814
cmpwi %r3, 0
bne end
li %r3, 0x578
or %r4, %r29, %r29
li %r5, 0
stw %r5, 0x28(%r31)
bl 0x16b400
end:
