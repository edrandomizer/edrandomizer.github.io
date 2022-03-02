or		%r3, %r31, %r31
or		%r4, %r28, %r28
or		%r5, %r29, %r29
or		%r6, %r30, %r30
subi	%r7, %r27, 0x8
bl		0x145e6c
li		%r3, 0x79e0
stw		%r3, 0x2a9c(%r31)
addi    %r3,%r31,0x2ae0
stw		%r3, 0x2ac8(%r31)
li		%r3, 0
stw		%r3, 0x2aa4(%r31)
or 		%r3, %r31, %r31
bl		0x145fcc
or		%r28, %r27, %r27
lwz		%r29, 0x8(%r1)
lwz		%r30, 0xc(%r1)
addi	%r27, %r27, 4

loop:
addi	%r3, %r31, 0x1000
stw		%r28, 0x0(%r3)
stw		%r29, 0x4(%r3)
stw		%r30, 0x8(%r3)
addi	%r3, %r3, 0xc
or		%r4, %r31, %r31
li		%r5, 0x1000-12
bl		0x5278

li		%r3, 0
stw		%r3, 0x2000(%r31)
li		%r3, 0x1000
stw		%r3, 0x2004(%r31)

lwz		%r28, 0xff4(%r31)
lwz		%r29, 0xff8(%r31)
lwz		%r30, 0xffc(%r31)
or		%r3, %r27, %r27
cmpwi	%r3, 0x1000
ble     skip
li		%r3, 0x1000
skip:
stw		%r3, 0x2008(%r31)

or		%r3, %r31, %r31
bl 		0x145f54

subi	%r27, %r27,0x1000
cmpwi	%r27, 0
ble		end
or 		%r3, %r31, %r31
bl		0x145edc
b loop
end:







