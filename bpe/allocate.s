lis %r3, 0x100
li  %r4, 1
bl 0x1fea8c
lis %r4, 0x802f
ori %r4, %r4, 0xcce0
stw %r3, 0(%r4)

