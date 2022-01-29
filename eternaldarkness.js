

class NPC{
	constructor(buffer){

		if(!buffer){
			this.entries=[[],[],[],[],[]];
			return;
		}
		buffer=asBuf(buffer);
		const typeSizes=this.getTypeSizes();

		const raw=new DataView(buffer);

		if(raw.getUint32(0, false)!=0x2c){
			throw "Incorrect magic number in NPC file";
		}

		this.entries=[];

		var hOffset=4;
		var dOffset=0x2c;

		for(var type=0; type<5; type++){
			var count=raw.getUint32(hOffset, false);
			hOffset+=8;
			this.entries[type]=[];

			for(var i=0; i<count; i++){
				this.entries[type].push(buffer.slice(dOffset, dOffset+typeSizes[type]));

				dOffset+=typeSizes[type];
			}

		}
	}

	getTypeSizes(){
		return [0x28, 0x68, 0x2c, 0x34, 0x3c];
	}

	getSize(){
		var size=0x2c;
		const typeSizes=this.getTypeSizes();
		for(var i in this.entries){
			size+=typeSizes[i]*this.entries[i].length;
		}
		return size;
	}

	toBuffer(){
		const buf=new ArrayBuffer(this.getSize());

		const data=new DataView(buf);
		const arr=new Uint8Array(buf);

		const typeSizes=this.getTypeSizes();

		data.setUint32(0, 0x2c);

		var dOffset=0x2c;

		for(var i in this.entries){
			data.setUint32(4+i*8, this.entries[i].length, false);
			data.setUint32(8+i*8, this.entries[i].length*typeSizes[i], false);

			for(var ent of this.entries[i]){
				arr.set(new Uint8Array(asBuf(ent)), dOffset);
				dOffset+=typeSizes[i];
			}
		}

		return buf;
	}
}

class GPK{
	constructor(buffer){

		if(!buffer){
			this.entries=[];
			return;
		}
		
		buffer=asBuf(buffer);
		const raw=new DataView(buffer);

		if(raw.getUint32(4, false)!=0x6b5){
			throw "Incorrect magic number in gpk";
		}

		var entryCount=raw.getUint32(0, false);

		this.entries=[];

		var i=0;
		while(i<entryCount){
			var offset=raw.getUint32(8+i*8, false);
			var size=raw.getUint32(12+i*8, false);

			if(offset!=0 && size!=0){
				if(raw.getUint32(offset+4, false)==0xfb90){
					var sCount=raw.getUint32(offset, false);
					var j=0;
					var strings=[];
					while(j<sCount){
						var sOffset=raw.getUint32(offset+8+j*8, false);
						var sSize=raw.getUint32(offset+12+j*8, false);

						if(sSize!=0 && sOffset!=0){
							strings[j]=buffer.slice(offset+sOffset, offset+sOffset+sSize);
						}

						j++;
					}
					this.entries[i]=strings;
				}else{
					this.entries[i]=buffer.slice(offset, offset+size);
				}
			}
			i++;
		}
	}

	getSize(){
		var size=8+8*this.entries.length;
		for(var ent of this.entries){
			if(Array.isArray(ent)){
				size+=8+ent.length*8;
				for(var s of ent){
					if(s){
						size+=s.byteLength;
					}
				}
			}else if(ent){
				size+=ent.byteLength;
			}
		}
		return size;
	}

	toBuffer(){

		var entryCount=this.entries.length;

		var out=new ArrayBuffer(this.getSize());
		var d=new DataView(out);
		var u=new Uint8Array(out);

		d.setUint32(0, entryCount, false);
		d.setUint32(4, 0x6b5, false);

		var curOff=8+entryCount*8;

		var i=0;
		while(i<entryCount){
			var ent=this.entries[i];
			if(!ent){
				d.setUint32(8+i*8, 0, false);
				d.setUint32(12+i*8, 0, false);
			}else if(Array.isArray(ent)){
				d.setUint32(8+i*8, curOff, false);
				d.setUint32(12+i*8, 8, false);

				var tBase=curOff;
				curOff+=8+ent.length*8;

				d.setUint32(tBase, ent.length, false);
				d.setUint32(tBase+4, 0xfb90, false);

				var j=0;
				while(j<ent.length){
					if(ent[j]){
						var el=asBuf(ent[j]);
						d.setUint32(tBase+8+j*8, curOff-tBase, false);
						d.setUint32(tBase+12+j*8, el.byteLength, false);

						u.set(new Uint8Array(el), curOff);
						curOff+=el.byteLength;

					}else{
						d.setUint32(tBase+8+j*8, 0, false);
						d.setUint32(tBase+12+j*8, 0, false);
					}
					j++;
				}
			}else{
				ent=asBuf(ent);
				d.setUint32(8+i*8, curOff, false);
				d.setUint32(12+i*8, ent.byteLength, false);

				u.set(new Uint8Array(ent), curOff);
				curOff+=ent.byteLength;
			}
			i++;
		}
		return out;
	}

}

class LUA{
	constructor(buffer){
		if(!buffer){
			this.instructions=[];
			this.strings=[];
			this.numbers=[];
			this.maxStack=32;
			return;
		}

		buffer=asBuf(buffer);

		const data=new DataView(buffer);

		if(data.getUint32(0, true)!=0x61754c1b){
			throw "Not a lua file";
		}

		if(data.getUint8(4, true)!=0x40){
			throw "Must be lua version 4";
		}

		if(data.getUint8(5, true)!=1 || data.getUint8(6, true)!=4 || data.getUint8(7, true)!=4
		   || data.getUint8(8, true)!=4 || data.getUint8(9, true)!=32 || data.getUint8(10, true)!=6
		   || data.getUint8(11, true)!=9 || data.getUint8(12, true)!=8){

			throw "Bad lua type";
		}

		if(data.getFloat64(13, true)!=3.14159265358979323846E8){
			throw "Mismatched floats";
		}

		this.maxStack=data.getUint32(35, true);

		const sCount=data.getUint32(47, true);

		var offset=51;
		this.strings=[];
		for(var i=0; i<sCount; i++){
			var size=data.getUint32(offset, true);
			offset+=4;
			var s=new Uint8Array(buffer.slice(offset, offset+size-1));
			s=String.fromCharCode.apply(String, s);
			this.strings.push(s);
			offset+=size;
		}


		const nCount=data.getUint32(offset, true);
		offset+=4;
		this.numbers=[];
		for(var i=0; i<nCount; i++){
			this.numbers.push(data.getFloat64(offset, true));
			offset+=8;
		}

		offset+=4;

		const iCount=data.getUint32(offset, true);

		offset+=4;
		this.instructions=[];
		for(var i=0; i<iCount; i++){
			this.instructions.push(data.getUint32(offset, true));
			offset+=4;
		}
	}

	buildInstruction(op, a, b){
		const opcodes=this.getOpcodes();

		var menemonics=opcodes.map((e)=>{return e[0]});

		var code=menemonics.indexOf(op.toUpperCase());

		if(code===-1){
			throw "Menemonic not recognised";
		}

		if(opcodes[code][1]=="NONE"){
			return code;
		}
		if(opcodes[code][1]=="U" || opcodes[1]=="L"){
			return code | (a<<6);
		}
		if(opcodes[code][1]=="S" || opcodes[1]=="J"){
			return code | ((a+0x01FFFFFF)<<6);
		}
		if(opcodes[code][1]=="AB"){
			return code | (a<<15) | (( b &0x1FF) << 6);
		}
		if(opcodes[code][1]=="K"){
			var s=this.strings.indexOf(a);
			if(s===-1){
				s=this.strings.length;
				this.strings.push(a);
			}
			return code | (s<<6);
		}
		if(opcodes[code][1]=="N"){
			var n=this.numbers.indexOf(a);
			if(n===-1){
				s=this.numbers.length;
				this.numbers.push(a);
			}
			return code | (n<<6);
		}
	}

	parseInstruction(op){

		const opcode=this.getOpcodes()[op&0x3f];

		if(opcode[1]=="NONE"){
			return opcode[0];
		}
		if(opcode[1]=="U" || opcode[1]=="L"){
			var u=op>>>6;
			return opcode[0]+" "+u;
		}
		if(opcode[1]=="S" || opcode[1]=="J"){
			var s=(op>>>6)-0x01FFFFFF;
			return opcode[0]+" "+s;
		}
		if(opcode[1]=="AB"){
			var a=op>>>15;
			var b=(op>>>6)&&0x1FF;
			return opcode[0]+" "+a+" "+b;
		}
		if(opcode[1]=="K"){
			var k=this.strings[op>>>6];
			return opcode[0]+" "+k;
		}
		if(opcode[1]=="N"){
			var n=this.numbers[op>>>6];
			return opcode[0]+" "+n;
		}
		return opcode[0];
	}

	getOpcodes(){
		return [
			["END", "NONE"],
			["RETURN", "U"],
			["CALL", "AB"],
			["TAILCALL", "AB"],
			["PUSHNIL", "U"],
			["POP", "U"],
			["PUSHINT", "S"],
			["PUSHSTRING", "K"],
			["PUSHNUM", "N"],
			["PUSHNEGNUM", "N"],
			["PUSHUPVALUE", "U"],
			["GETLOCAL", "L"],
			["GETGLOBAL", "K"],
			["GETTABLE", "NONE"],
			["GETDOTTED", "K"],
			["GETINDEXED", "L"],
			["PUSHSELF", "K"],
			["CREATETABLE", "U"],
			["SETLOCAL", "L"],
			["SETGLOBAL", "K"],
			["SETTABLE", "AB"],
			["SETLIST", "AB"],
			["SETMAP", "U"],
			["ADD", "NONE"],
			["ADDI", "S"],
			["SUB", "NONE"],
			["MULT", "NONE"],
			["DIV", "NONE"],
			["POW", "NONE"],
			["CONCAT", "U"],
			["MINUS", "NONE"],
			["NOT", "NONE"],
			["JMPNE", "J"],
			["JMPEQ", "J"],
			["JMPLT", "J"],
			["JMPLE", "J"],
			["JMPGT", "J"],
			["JMPGE", "J"],
			["JMPT", "J"],
			["JMPF", "J"],
			["JMPONT", "J"],
			["JMPONF", "J"],
			["JMP", "J"],
			["PUSHNILJMP", "NONE"],
			["FORPREP", "J"],
			["FORLOOP", "J"],
			["LFORPREP", "J"],
			["LFORLOOP", "J"],
			["CLOSURE", "AB"],
		];
	}

	getSize(){
		var size=63;

		size+=this.instructions.length*4;
		size+=this.numbers.length*8;
		size+=this.strings.length*4;

		for(var s of this.strings){
			size+=s.length+1;
		}

		return size;
	}

	toBuffer(){
		const b=new ArrayBuffer(this.getSize());
		const data=new DataView(b);

		data.setUint32(0, 0x61754c1b, true);

		data.setUint8(4, 0x40, true);
		data.setUint8(5, 1, true);
		data.setUint8(6, 4, true);
		data.setUint8(7, 4, true);
		data.setUint8(8, 4, true);
		data.setUint8(9, 32, true);
		data.setUint8(10, 6, true);
		data.setUint8(11, 9, true);
		data.setUint8(12, 8, true);

		data.setFloat64(13, 3.14159265358979323846E8, true);


		data.setUint32(21, 1, true);
		data.setUint8(25, 0, true);

		data.setUint32(26, 0, true);
		data.setUint32(30, 0, true);
		data.setUint8(34, 0, true);
		data.setUint32(35, this.maxStack, true);

		data.setUint32(39, 0, true);

		data.setUint32(43, 0, true);

		data.setUint32(47, this.strings.length, true);

		var offset=51;

		for(var s of this.strings){
			data.setUint32(offset, s.length+1, true);
			offset+=4;
			for(var i=0; i<s.length; i++){
				data.setUint8(offset++, s.charCodeAt(i), true);
			}
			data.setUint8(offset++, 0, true);
		}

		data.setUint32(offset, this.numbers.length, true);
		offset+=4;

		for(var n of this.numbers){
			data.setFloat64(offset, n, true);
			offset+=8;
		}

		data.setUint32(offset, 0, true);
		offset+=4;

		data.setUint32(offset, this.instructions.length, true);
		offset+=4;

		for(var ins of this.instructions){
			data.setUint32(offset, ins, true);
			offset+=4;
		}
		return b;
	}

}

function addFlagSetToScript(iso, script, flags){
	var instructions=[];
	for(var flag of flags){
		var edFlag=bitAddressToFlag(flag[0], flag[1]);

		instructions.push(["GETGLOBAL", "fn29"]);
		instructions.push(["PUSHINT", edFlag]);
		instructions.push(["PUSHINT", 1]);
		instructions.push(["CALL", 0, 0]);

	}

	prependToScript(iso, script, instructions);
}

function prependToScript(iso, script, instructions){

	for(var i=0; i<14; i++){
		if(i==12){
			continue;
		}

		var g=new GPK(iso.fst.getFile("ScrLvl"+("00"+i).slice(-2)+".gpk"));

		if(!g.entries[script]){
			continue;
		}

		var l=new LUA(g.entries[script]);

		var ni=[];
		for(var inst of instructions){
			ni.push(l.buildInstruction(...inst));
		}

		l.instructions=ni.concat(l.instructions);

		replaceScript(iso, script, l.toBuffer());

	}
}

function getAllScripts(iso){
	var scripts=[];
	for(var i=0; i<14; i++){
		if(i==12){
			continue;
		}

		var g=new GPK(iso.fst.getFile("ScrLvl"+("00"+i).slice(-2)+".gpk"));
		for(var index in g.entries){
			if(!g.entries[index] || scripts[index]){
				continue;
			}
			scripts[index]=new LUA(g.entries[index]);
		}
	}
	return scripts;
}

function searchScripts(iso, code){
	var scripts=getAllScripts(iso);

	var results=[];
	
	for(var scriptId in scripts){
		var script=scripts[scriptId];
		for(var i=0; i<script.instructions.length-(code.length-1); i++){
			var found=1;
			for(var j=0; j<code.length; j++){
				if(script.parseInstruction(script.instructions[i+j])!=code[j]){
					found=0;
					break;
				}
			}
			if(found){
				results.push(scriptId);
				break;
			}
		}
	}
	return results;
}

function textLookup(file, i1, i2){
	if(file.read4(4)!=0x6b5){
		throw "Doesn't look like an archive file, did you forget to decompress?";
	}

	if(file.read4(0)<=i1){
		throw "First index out of bounds";
	}

	var iOffset=file.read4(8+i1*8);
	if(iOffset==0){
		throw "First index empty";
	}

	if(file.read4(iOffset+4)!=0xfb90){
		throw "Not a text archive";
	}

	if(file.read4(iOffset)<=i2){
		throw "Second index out of bounds";
	}

	var eOffset=file.read4(iOffset+8+i2*8);
	var size=file.read4(iOffset+12+i2*8);
	if(eOffset==0 || size==0){
		throw "Entry empty";
	}

	var buf=file.buffer.slice(iOffset+eOffset+4, iOffset+eOffset+size+4);

	return decompressText(new Uint8Array(buf), size-4);
}

function stripFMV(iso){
	const changeTo=0;

	const sourceA=iso.fst.getFile("fmv/fmv"+(("0000" + changeTo).slice(-4))+".aud");
	const sourceH=iso.fst.getFile("fmv/fmv"+(("0000" + changeTo).slice(-4))+".h4m");

	var i=1;

	while(i<64){
		try{
			var fileA=iso.fst.getFile("fmv/fmv"+(("0000" + i).slice(-4))+".aud");
			fileA.replace(sourceA.buffer);
		}catch(err){}//TODO proper fs errors

		try{
			var fileH=iso.fst.getFile("fmv/fmv"+(("0000" + i).slice(-4))+".h4m");
			fileH.replace(sourceH.buffer);
		}catch(err){}
		i++;
	}
}

function bitAddressToFlag(address, bit){
	const base=0x80725E24;

	const diff=address-base;

	const block=Math.floor(diff/4)*32;

	const single=(3-(diff%4))*8;

	return block+single+bit;
}

function flagToBitAddress(flag){
	const base=0x80725E24;

	const bit=flag%8;

	flag=Math.floor(flag/8);

	const block=4*Math.floor(flag/4);

	const off=3-(flag%4);

	return [base+block+off, bit];
}

function findScript(iso, script){
	var i=0;
	while(i<14){
		if(i==12){
			i++;
			continue;
		}

		var f=iso.fst.getFile("ScrLvl"+("00"+i).slice(-2)+".gpk");
		var g=new GPK(f);

		if(g.entries[script]){
			return new LUA(g.entries[script]);
		}

		i++;
	}
	throw "Could not find script";
}


function replaceScript(iso, script, lua){
	lua=asBuf(lua);
	var i=0;
	while(i<14){
		if(i==12){
			i++;
			continue;
		}

		var f=iso.fst.getFile("ScrLvl"+("00"+i).slice(-2)+".gpk");
		var g=new GPK(f);

		if(g.entries[script]){
			g.entries[script]=lua;
		}

		f.replace(g.toBuffer());
		i++;
	}
}


function prepare(iso){
	iso.dol.prepareInjectionSection(0x802fd8e0);
}


function bypassCompression(iso, continuation){

	loadAsset("./compressionBypass.bin", function(code){
		iso.dol.inject(0x80147e4c, code, [0x14, 0x34, 0x64, 0x9c, 0xb0]);
		if(continuation){
			continuation();
		}
	});

}


function decompressAll(dir){
	for(var entry of dir.entries){
		if(entry.type=="dir"){
			decompressAll(entry);
		}else if(entry.type=="file"){
			var file=entry.file;
			if(file.read4(0)==0x2a534b5f && file.read4(4)==0x4153432a){//*SK_ASC*
				console.log("Decompressing "+entry.name);
				file.replace(decompressSKASC(file));
			}
		}
	}
}


function decompressSKASC(compressed){
	compressed=new Uint8Array(asBuf(compressed));
	var compLength=compressed.length*compressed.BYTES_PER_ELEMENT;
	var buf = Module._malloc(compLength+8);
	Module.HEAPU8.set(compressed, buf+8);

	var outLength=Module.ccall('DecompressSK_ASC', 'number', ['number', 'number', 'number'], [buf+8, compLength, buf]);

	var outp=Module.getValue(buf, 'i32');
	Module._free(buf);

	var view=Module.HEAPU8.slice(outp, outp+outLength);
	Module._free(outp);
	return view.buffer;
}

function decompressText(compressed, decompressedLength=0){
	compressed=Uint8Array(asBuf(compressed));
	if(decompressedLength==0){
		decompressedLength=compressed.length*compressed.BYTES_PER_ELEMENT;
	}
	var buf = Module._malloc(compressed.length*compressed.BYTES_PER_ELEMENT);
	Module.HEAPU8.set(compressed, buf);
	var out = Module._malloc(decompressedLength*2);

	var r=Module.ccall('DecompressText', 'number', ['number', 'number', 'number'], [buf, decompressedLength, out]);
	var view=Module.HEAPU8.slice(out+0x1a, out+decompressedLength*2+0x1a);
	Module._free(buf);
	Module._free(out);
	var od=new Uint8Array(view);
	view=view.slice(0, od.indexOf(0));
	return String.fromCharCode.apply(String, view);
}
