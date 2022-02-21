
class CPK {
	constructor(buffer){
		if(!buffer){
			this.entries=[];
			return;
		}
		buffer=asBuf(buffer);

		const raw=new DataView(buffer);

		if(raw.getUint32(0, false)!=0x2 || raw.getUint32(4, false)!=0x20){
			throw "Bad magic number in CPK";
		}

		this.magic=raw.getUint32(8, false);
		var count=raw.getUint32(0x10, false);

		var headerOffset=raw.getUint32(0x14, false);

		var entries=[];

		for(var i=0; i<count; i++){

			var offset=raw.getUint32(headerOffset+(i*0x10), false);
			var size=raw.getUint32(headerOffset+0x4+(i*0x10), false);

			var buf=buffer.slice(offset, offset+size);

			entries[i]=[
				raw.getUint16(headerOffset+0x8+(i*0x10) , false),
				buf
			];
		}
		this.entries=entries;
	}

	getSize(){
		var size=0x20;
		size+=this.entries.length*0x10;
		for(var ent of this.entries){
			size+=ent[1].byteLength;
		}
		return size;
	}

	toBuffer(){
		const buf=new ArrayBuffer(this.getSize());
		const arr=new Uint8Array(buf);

		const d=new DataView(buf);

		d.setUint32(0, 2, false);
		d.setUint32(4, 0x20, false);
		d.setUint32(8, this.magic, false);
		d.setUint32(0x10, this.entries.length, false);
		d.setUint32(0x14, 0x20, false);

		var i=0;
		var curOffset=0x20+this.entries.length*0x10;

		for(var anim of this.entries){

			d.setUint32(0x20+(i*0x10), curOffset, false);
			d.setUint32(0x24+(i*0x10), anim[1].byteLength, false);
			d.setUint16(0x28+(i*0x10), anim[0], false);

			arr.set(new Uint8Array(anim[1]), curOffset);

			d.setUint32(curOffset, this.magic, false);

			curOffset+=anim[1].byteLength;

			i++;
		}
		return buf;
	}
}

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

	buildTemplateFromScript(script, offset){
		if(script.parseInstruction(script.instructions[offset])!="GETGLOBAL ed3"){
			throw "Tried to parse a template from a non-ed3 instruction";
		}

		var type=script.parseInstruction(script.instructions[offset+11]);
		if(!(type=/PUSHINT (.*)/.exec(type))){
			throw "Non-standard type set";
		}
		type=type[1];

		var model=script.parseInstruction(script.instructions[offset+2]);
		if(!(model=/PUSHINT (.*)/.exec(model))){
			throw "Non-standard model set";
		}
		model=model[1];

		var animations=script.parseInstruction(script.instructions[offset+1]);
		if(!(animations=/PUSHINT (.*)/.exec(animations))){
			throw "Non-standard animation set";
		}
		animations=animations[1];

		var state=script.parseInstruction(script.instructions[offset+ (type==-1 ? 8 : 4)]);
		if(!(state=/PUSHINT (.*)/.exec(state))){
			throw "Non-standard state set";
		}
		state=state[1];

		return this.buildTemplate(parseInt(model), parseInt(animations), parseInt(state));
	}

	buildTemplateFromEntry(type, id, alignment=0){
		if(type==0){
			return this.buildTemplateFromStatic(this.entries[type][id]);
		}else if(type==2){
			return this.buildTemplateFromItem(this.entries[type][id]);
		}else if(type==3){
			return this.buildTemplateFromDynamic(this.entries[type][id], alignment);
		}
	}


	buildTemplateFromStatic(e){
		var d=new DataView(e);

		return this.buildTemplate(d.getUint16(0x18, false), d.getUint16(0x1a, false), d.getUint16(0x20, false));
	}

	buildTemplateFromDynamic(e, i){
		var d=new DataView(e);

		return this.buildTemplate(d.getUint16(0x18+i*6, false), d.getUint16(0x1a+i*6, false), d.getUint16(0x1c+i*6, false));
	}

	buildTemplateFromItem(e){
		var d=new DataView(e);

		return this.buildTemplate(d.getUint16(0x1c, false), d.getUint16(0x20, false), d.getUint16(0x1e, false));
	}

	applyTemplate(type, id, template){
		if(type==0){
			this.applyTemplateToStatic(this.entries[type][id], template);
		}else if(type==2){
			this.applyTemplateToItem(this.entries[type][id], template);
		}else if(type==3){
			for(var i=0; i<3; i++){
				this.applyTemplateToDynamic(this.entries[type][id], template, i);
			}
		}
	}

	applyTemplateToStatic(entry, template){
		var d=new DataView(entry);

		d.setUint16(0x18, template.model, false);
		d.setUint16(0x1a, template.animations, false);
		d.setUint16(0x20, template.state, false);
	}

	applyTemplateToItem(entry, template){
		var d=new DataView(entry);

		d.setUint16(0x1c, template.model, false);
		d.setUint16(0x20, template.animations, false);
		d.setUint16(0x1e, template.state, false);
	}

	applyTemplateToDynamic(entry, template, alignment){
		var d=new DataView(entry);

		d.setUint16(0x18+alignment*6, template.model, false);
		d.setUint16(0x1a+alignment*6, template.animations, false);
		d.setUint16(0x1c+alignment*6, template.state, false);
	}

	buildTemplate(model, animations, state){
		return {
			"model":model,
			"animations":animations,
			"state":state,
		};
	}

}

class GPK{
	constructor(buffer, aligned=false){

		if(!buffer){
			this.entries=[];
			this.minCount=0;
			this.alignment=1;
			return;
		}

		buffer=asBuf(buffer);
		const raw=new DataView(buffer);

		if(raw.getUint32(4, false)!=0x6b5){
			throw "Incorrect magic number in gpk";
		}

		var entryCount=raw.getUint32(0, false);

		this.minCount=entryCount;

		this.entries=[];

		var seen=[];

		var alignment=1;

		if(aligned){
			alignment=0x100000;
		}

		var limit=0;

		var i=0;
		while(i<entryCount){
			var offset=raw.getUint32(8+i*8, false);
			var size=raw.getUint32(12+i*8, false);

			if(offset!=0 && size!=0){

				if(raw.getUint32(offset+4, false)==0xfb90){
					if(aligned){
						throw "Aligned two layer GPKs are not supported";
					}
					var sCount=raw.getUint32(offset, false);
					var j=0;
					var strings=[];
					while(j<sCount){
						var sOffset=raw.getUint32(offset+8+j*8, false);
						var sSize=raw.getUint32(offset+12+j*8, false);

						if(sSize!=0 && sOffset!=0){
							strings[j]=buffer.slice(offset+sOffset, offset+sOffset+sSize);
							if(limit<offset+sOffset+size){
								limit=offset+sOffset+size;
							}
						}

						j++;
					}
					this.entries[i]=strings;
					while(offset % alignment!=0){
						alignment/=2;
					}
				}else{
					var found=false;
					for(var s of seen){
						if(s[0]==offset && s[1]==size){
							this.entries[i]=s[2];
							found=true;
							console.log("Overlap detected");
							break;
						}
					}
					if(!found){
						this.entries[i]=buffer.slice(offset, offset+size);
						seen.push([offset, size, this.entries[i]]);
						if(limit<offset+size){
							limit=offset+size;
						}
						while(offset % alignment!=0){
							alignment/=2;
						}
					}
				}
			}
			i++;
		}

		this.alignment=alignment;

		if(limit!=buffer.byteLength){
			console.log("Warning! GPK files data exceeds its bounds. Data may be missing.");
		}
	}

	getSize(){
		var entryCount=this.entries.length;

		if(entryCount<this.minCount){
			entryCount=this.minCount;
		}

		var size=8+8*entryCount;

		size=(size+this.alignment-1)&~(this.alignment-1);

		for(var ent of this.entries){
			if(Array.isArray(ent)){
				size+=8+ent.length*8;
				for(var s of ent){
					if(s){
						size+=asBuf(s).byteLength;
					}
				}
			}else if(ent){
				var size=(size+this.alignment-1)&~(this.alignment-1);

				size+=asBuf(ent).byteLength;
			}
		}
		return size;
	}

	toBuffer(){

		var entryCount=this.entries.length;

		if(entryCount<this.minCount){
			entryCount=this.minCount;
		}

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
				curOff=(curOff+this.alignment-1)&~(this.alignment-1);

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
		if(opcodes[code][1]=="U" || opcodes[code][1]=="L"){
			return (code | (a<<6))>>>0;
		}
		if(opcodes[code][1]=="S" || opcodes[code][1]=="J"){
			return (code | ((a+0x01FFFFFF)<<6))>>>0;
		}
		if(opcodes[code][1]=="AB"){
			return (code | (a<<15) | (( b &0x1FF) << 6))>>>0;
		}
		if(opcodes[code][1]=="K"){
			var s=this.strings.indexOf(a);
			if(s===-1){
				s=this.strings.length;
				this.strings.push(a);
			}
			return (code | (s<<6))>>>0;
		}
		if(opcodes[code][1]=="N"){
			var n=this.numbers.indexOf(a);
			if(n===-1){
				n=this.numbers.length;
				this.numbers.push(a);
			}
			return (code | (n<<6))>>>0;
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
			var b=(op>>>6)&0x1FF;
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

	addJmpPatch(location, rejoin, code){
		var cur=this.instructions.length;

		this.instructions[location]=this.buildInstruction("JMP", cur-location-1);

		for(var inst of code){
			if(inst==="REJOIN"){
				this.instructions[cur]=this.buildInstruction("JMP", rejoin-cur-1);
				cur++;
			}else{
				this.instructions[cur++]=this.buildInstruction(...inst);
			}
		}

		this.instructions[cur]=this.buildInstruction("JMP", rejoin-cur-1);
		this.instructions[cur+1]=this.buildInstruction("END");
	}

	prepend(code){
		var ni=[];
		for(var inst of code){
			ni.push(this.buildInstruction(...inst));
		}

		this.instructions=ni.concat(this.instructions);
	}

	addFlagSet(flags){
		var newInstructions=[];
		for(var flag of flags){
			var edFlag=bitAddressToFlag(flag[0], flag[1]);

			newInstructions.push(["GETGLOBAL", "fn29"]);
			newInstructions.push(["PUSHINT", edFlag]);
			newInstructions.push(["PUSHINT", 1]);
			newInstructions.push(["CALL", 0, 0]);

		}
		this.prepend(newInstructions);
	}

}

function modifyScript(iso, script, cb){
	var lua=findScript(iso, script);
	cb(lua);
	replaceScript(iso, script, lua);
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
				if(typeof code[j]=="string"){
					if(script.parseInstruction(script.instructions[i+j])!=code[j]){
						found=0;
						break;
					}
				}else if(typeof code[j]=="function"){
					if(!code[j](script.parseInstruction(script.instructions[i+j]))){
						found=0;
						break;
					}
				}else{
					if(!code[j].test(script.parseInstruction(script.instructions[i+j]))){
						found=0;
						break;
					}
				}
			}
			if(found){
				results.push([scriptId, i]);
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

function deleteUnused(iso){
	iso.getFile("EKioskMenu.cmp").replace(new ArrayBuffer(0));
	iso.getFile("EE3Menu.cmp").replace(new ArrayBuffer(0));
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
	iso.dol.prepareInjectionSection(0x802fd178);
}


function bypassCompression(iso, continuation){

	loadAsset("./compressionBypass.bin", function(code){
		iso.dol.inject(0x80147e4c, code, [0x14, 0x34, 0x64, 0x9c, 0xb0]);
		if(continuation){
			continuation();
		}
	});

}

function extendBPE(iso, continuation){
	loadAsset("./bpe/allocate.bin", function(code){
		iso.dol.inject(0x80024b5c, code, [0x8]);
		loadAsset("./bpe/free.bin", function(code){
			iso.dol.inject(0x8015e7a8, code, []);
			loadAsset("./bpe/read.bin", function(code){
				iso.dol.inject(0x80139bbc, code, [0x2c, 0x30]);
				loadAsset("./bpe/suballocate.bin", function(code){
					iso.dol.inject(0x8015e7fc, code, [], true);
					if(continuation){
						continuation();
					}
				});
			});
		});
	});
}

function bigLevel(iso, models=null){
	var common=new GPK(decompressSKASC(iso.getFile("NPCCom.gpk")), true);

	var levels=[];

	for(var i=0; i<14; i++){
		if(i==12){
			continue;
		}
		var lGpk=new GPK(decompressSKASC(iso.getFile("Level"+("00"+i).slice(-2)+".bin")), true);
		levels.push([new GPK(lGpk.entries[0], true), lGpk, i ]);
	}

	if(models===null){
		models=[];
		for(var i=0; i<160; i++){
			models.push(i);
		}
	}

	for(var i of models){
		for(var lvl of levels){
			if(lvl[0].entries[i]){
				if(!common.entries[i]){
					common.entries[i]=lvl[0].entries[i];
				}
				lvl[0].entries[i]=null;
			}
		}
	}

	for(var lvl of levels){
		lvl[1].entries[0]=lvl[0];
		iso.getFile("Level"+("00"+lvl[2]).slice(-2)+".bin").replace(lvl[1]);
	}


	//npccom.gpk
	var newSize=common.getSize()+64;

	iso.dol.write2(0x80042b9e, newSize&0xffff);
	iso.dol.write2(0x80042b92, (newSize>>>16)&0xffff);
	iso.dol.write2(0x80042b9c, 0x60a5);

	iso.dol.write2(0x80042b6e, newSize&0xffff);
	iso.dol.write2(0x80042b62, (newSize>>>16)&0xffff);
	iso.dol.write2(0x80042b6c, 0x60c3);

	iso.getFile("NPCCom.gpk").replace(common);

}

function extendMemorySizes(iso, continuation){

	//main arena
	iso.dol.write2(0x801380ee, 0x100);
	iso.dol.write2(0x80138cf6, 0x100);
	iso.dol.write2(0x80138be2, 0x100);
	iso.dol.write2(0x80138bf6, 0x100);
	iso.dol.write2(0x80138c1a, 0x100);
	iso.dol.write2(0x80138ace, 0x100);

	//
	//iso.dol.write2(0x80139c2a, 0x3710);

	//iso.dol.write2(0x8015885e, 0x50);
	//iso.dol.write2(0x801f2fba, 0x50);
	//iso.dol.write2(0x801f3042, 0x50);

	//iso.dol.write2(0x80138e5a, 0x50);
	//iso.dol.write2(0x801398fa, 0x50);

	//iso.dol.write2(0x8015aa16, 0x50);
	//iso.dol.write2(0x8015a5fa, 0x50);

	//reset
	iso.dol.write2(0x800248fe, 0x5770);
	iso.dol.write2(0x8002493a, 0x5770);

	//ai
	iso.dol.write2(0x80024ae2, 0x40);
	iso.dol.write2(0x80024a76, 0x40);

	loadAsset("./loadingMemory.bin", (code)=>{
		iso.dol.overwrite(0x80139c1c, code, [0x2c]);
		loadAsset("./loadingAllocate.bin", (code)=>{
			iso.dol.inject(0x80024b18, code, [0x4]);
			if(continuation){
				continuation();
			}
		});
	});
}

function addMemoryDebugging(iso, continuation){
	loadAsset("./debug.bin", function(code){
		iso.dol.inject(0x8017ce54, code);
		if(continuation){
			continuation();
		}
	});
}

function mergeScriptArchives(iso){
	var archives=[];
	for(var i=-1; i<17; i++){
		if(i==14 || i==15){
			continue;
		}

		archives.push(new GPK(iso.getFile("ScrLvl"+("00"+i).slice(-2)+".gpk")));
	}

	var main=archives[0];

	for(var arch of archives){
		if(arch===main){
			continue;
		}
		for(var scriptnum in arch.entries){
			if(!main.entries[scriptnum]){
				main.entries[scriptnum]=arch.entries[scriptnum];
			}
		}
	}

	var buf=asBuf(main);
	for(var i=-1; i<17; i++){
		if(i==14 || i==15){
			continue;
		}

		iso.getFile("ScrLvl"+("00"+i).slice(-2)+".gpk").replace(buf);
	}

	//disable async loading of scripts
	iso.dol.write4(0x8004292c, 0x48000034);
	iso.dol.write4(0x80043edc, 0x60000000);

}

function mergeRoomText(iso, continuation=false){
	var archives=[];
	for(var i=-1; i<17; i++){
		if(i==14 || i==15){
			continue;
		}

		archives.push(new GPK(decompressSKASC(iso.getFile("RmTxt"+("00"+i).slice(-2)+".cmp"))));
	}

	var merged=mergeGPK(archives);

	for(var i=-1; i<17; i++){
		if(i==14 || i==15){
			continue;
		}

		iso.getFile("RmTxt"+("00"+i).slice(-2)+".cmp").replace(merged);
	}

	iso.dol.write2(0x80043806, 0x2);
	iso.dol.write4(0x80043808, 0x808d9b80);

	loadAsset("./textMemory.bin", (code)=>{
		iso.dol.inject(0x80024b20, code, [0x8]);
		if(continuation){
			continuation();
		}
	});
}

function mergeGPK(gpks){
	var merged=gpks[0];
	gpks=gpks.slice(1);

	for(var g of gpks){
		for(var i in g.entries){
			if(Array.isArray(g.entries[i])){
				for(var j in g.entries[i]){
					if(!merged.entries[i][j]){
						merged.entries[i][j]=g.entries[i][j];
					}
				}
			}else{
				if(!merged.entries[i]){
					merged.entries[i]=g.entries[i];
				}
			}
		}
	}
	return merged;
}

function copyNPC(iso, source, dest){
	var sNpc=new NPC(iso.getFile("Npcs"+source[0]+".npc"));
	var dNpc=new NPC(iso.getFile("Npcs"+dest[0]+".npc"));

	var template;

	if(source[1]==0){
		template=buildTemplateFromStatic(sNpc.entries[0][source[2]]);
	}else if(source[1]==3){
		template=buildTemplateFromDynamic(sNpc.entries[3][source[2]], source[3]);
	}else{
		throw "Can only copy enemies";
	}

	if(dest[1]==0){
		var dView=new Uint8Array(dNpc.entries[0][dest[2]]);
		dView.set(template[0], 0x18);
		dView.set(template[1], 0x20);
	}else{
		throw "Can only copy over statics atm";
	}

	iso.getFile("Npcs"+dest[0]+".npc").replace(dNpc);
}

function copyItem(iso, sourceLevel, destLevel, id){
	var sourcel=new GPK(decompressSKASC(iso.getFile("Level"+("00"+sourceLevel).slice(-2)+".bin"), true));
	var destl=new GPK(decompressSKASC(iso.getFile("Level"+("00"+destLevel).slice(-2)+".bin")), true);

	var s1=new GPK(sourcel.entries[1], true);
	var s2=new GPK(sourcel.entries[2], true);

	var d1=new GPK(destl.entries[1], true);
	var d2=new GPK(destl.entries[2], true);

	d1.entries[id]=s1.entries[id];
	d2.entries[id]=s2.entries[id];

	destl.entries[1]=d1;
	destl.entries[2]=d2;

	iso.getFile("Level"+("00"+destLevel).slice(-2)+".bin").replace(destl);
}

function changeWeaponAnimations(iso, weapon, animation){
	var invu=new GPK(iso.getFile("InvU.bin"));

	var entry=new DataView(invu.entries[weapon][0]);

	entry.setUint16(0x36, animation);
	entry.setUint16(0x38, animation+1);
	entry.setUint16(0x3a, animation+2);
	entry.setUint16(0x3c, animation+3);
	entry.setUint16(0x3e, animation+4);
	entry.setUint16(0x40, animation+5);

	iso.getFile("InvU.bin").replace(invu);
}

function copyCharacter(iso, sourceLevel, destLevel, id){
	var sourcel=new GPK(decompressSKASC(iso.getFile("Level"+("00"+sourceLevel).slice(-2)+".bin"), true));
	var destl=new GPK(decompressSKASC(iso.getFile("Level"+("00"+destLevel).slice(-2)+".bin")), true);

	var s0=new GPK(sourcel.entries[0], true);

	var d0=new GPK(destl.entries[0], true);

	d0.entries[id]=s0.entries[id];

	destl.entries[0]=d0;

	iso.getFile("Level"+("00"+destLevel).slice(-2)+".bin").replace(destl);
}

function getMainModelForLevel(level){
	var levelModels=[9, 0, 70, 85, 150, 18, 73, 74, 76, 69, 75, 81, null, 9];

	return levelModels[level];
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
	if(compressed[0]!=0x2a || compressed[1]!=0x53 || compressed[2]!=0x4b || compressed[3]!=0x5f || compressed[4]!=0x41 || compressed[5]!=0x53 || compressed[6]!=0x43 || compressed[7]!=0x2a){
		return compressed.buffer;
	}

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

function dumpBootText(iso){
	var boot=new GPK(decompressSKASC(iso.getFile("EBootPak.bin")));
	var s="";
	for(var i in boot.entries){
		if(i==10){
			continue;
		}
		try{
			var bc=new GPK(boot.entries[i]);

			for(var j in bc.entries){
				for(var k in bc.entries[j]){
					s+="Index "+i+":"+j+":"+k+"\n\n"+decompressText(bc.entries[j][k].slice(4))+"\n\n";
				}
			}
		}catch(e){
		}
	}
	return s;
}

function dumpInvU(iso){
	var invu=new GPK(iso.getFile("InvU.bin"));
	var boot=new GPK(decompressSKASC(iso.getFile("EBootPak.bin")));

	var itemText=new GPK(boot.entries[4]);

	var res=[];

	for(var i in invu.entries){
		var entry=new DataView(invu.entries[i][0]);

		var textIndex=entry.getUint8(0x4c);
		var pickup=entry.getUint8(0x4d);
		var desc=entry.getUint8(0x4e);
		var name=entry.getUint8(0x4f);


		res[i]=[decompressText(itemText.entries[textIndex][name].slice(4)),
		        decompressText(itemText.entries[textIndex][desc].slice(4)),
		        decompressText(itemText.entries[textIndex][pickup].slice(4)),
		        entry];

	}
	return res;
}

function decompressText(compressed, decompressedLength=0){
	compressed=new Uint8Array(asBuf(compressed));
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
