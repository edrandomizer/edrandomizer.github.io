mfspr  %r8, %lr
stw    %r3, -0x598c(%r13)
lis    %r4, -0x7fa5
lwz	   %r4, -0x186c(%r4)
stw    %r4, -0x5990(%r13)
rlwinm %r3, %r3, 0x2, 0, 0x1d
add    %r3, %r3, %r4
stw    %r3, -0x5994(%r13)
or     %r3, %r4, %r4
li     %r4, 0
lis    %r5, 0x2
bl     0x518c
mtspr  %lr, %r8
blr
