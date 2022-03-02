lis %r8, 0x802f
ori %r8, %r8, 0xcce4
lwz %r9, 0(%r8)
or %r7, %r9, %r9
add %r9, %r9, %r3
stw %r9, 0(%r8)

