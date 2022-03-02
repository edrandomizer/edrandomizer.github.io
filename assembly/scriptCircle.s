li     %r4, 1
bl     0x16a694
fctiwz %f0,%f1
stfd   %f0,0x4(%r1)
lwz    %r4,0x8(%r1)
lis    %r5,0x8033
lwz	   %r5,0x174a(%r5)
and    %r4,%r4,%r5
xoris  %r4,%r4,0x8000
stw    %r4,0x8(%r1)
lfd    %f1,-0x55d8(%r2)
lis    %r0,0x4330
stw    %r0,0x4(%r1)
lfd	   %f0,0x4(%r1)
fsub   %f1,%f0,%f1
or     %r3,%r31,%r31
bl     0x16a830
li	   %r3, 1
lwz    %r0,0x24(%r1)
lwz    %r31,0x1c(%r1)
mtspr  %LR,%r0
addi   %r1,%r1,0x20
blr
