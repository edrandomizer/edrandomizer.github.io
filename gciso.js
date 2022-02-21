
function writeString(buffer, s, offset){
	var data=new Uint8Array(buffer);
	var i=0;
	while(i<s.length){
		data[offset+i]=s.charCodeAt(i);
		i++;
	}
	data[offset+i]=0;
}

function writeBuffer(src, dest, offset){
	var ds=new Uint8Array(src);
	var dd=new Uint8Array(dest);

	dd.set(ds, offset);

}

function asBuf(buf){
	if(!buf){
		return null;
	}
	if(buf.toBuffer){
		return buf.toBuffer();
	}
	if(buf.buffer){
		return buf.buffer;
	}
	return buf;
}

class DOLSection {
	constructor(buffer, addr, type){
		this.buffer=asBuf(buffer);
		this.addr=addr;
		this.type=type;

		this.data=new DataView(buffer);
	}

	append(buffer){
		var oldBuf=this.buffer;
		this.buffer=new ArrayBuffer(oldBuf.byteLength+buffer.byteLength);

		var ia=new Uint8Array(this.buffer);
		ia.set(new Uint8Array(oldBuf), 0);
		ia.set(new Uint8Array(buffer), oldBuf.byteLength);

		this.data=new DataView(this.buffer);
	}

	getSize(){
		return this.buffer.byteLength;
	}

	replace(buffer){
		this.buffer=buffer;
	}

	inBounds(addr, width=1){
		return (addr>=this.addr && addr+width<=this.addr+this.getSize());
	}

	dataSlice(addr, width){
		return this.buffer.slice(addr-this.addr, (addr-this.addr)+width);
	}

	read4(addr){
		return this.data.getUint32(addr-this.addr, false);
	}

	read2(addr){
		return this.data.getUint16(addr-this.addr, false);
	}

	read(addr){
		return this.data.getUint8(addr-this.addr, false);
	}

	write4(addr, value){
		if(value<0){
			this.data.setInt32(addr-this.addr, value, false);
		}else{
			this.data.setUint32(addr-this.addr, value, false);
		}
	}

	write2(addr, value){
		if(value<0){
			this.data.setInt16(addr-this.addr, value, false);
		}else{
			this.data.setUint16(addr-this.addr, value, false);
		}
	}

	write(addr, value){
		if(value<0){
			this.data.setInt8(addr-this.addr, value, false);
		}else{
			this.data.setUint8(addr-this.addr, value, false);
		}
	}

}

class DOL {

	constructor(buffer){
		buffer=asBuf(buffer);
		const raw=new DataView(buffer);

		this.textCount=7;
		this.dataCount=11;

		var offset=0;

		var textPositions=[];

		for(var i=0; i<this.textCount; i++){
			textPositions.push(raw.getUint32((offset++)*4, false));
		}

		var dataPositions=[];

		for(var i=0; i<this.dataCount; i++){
			dataPositions.push(raw.getUint32((offset++)*4, false));
		}

		var textMem=[];

		for(var i=0; i<this.textCount; i++){
			textMem.push(raw.getUint32((offset++)*4, false));
		}

		var dataMem=[];

		for(var i=0; i<this.dataCount; i++){
			dataMem.push(raw.getUint32((offset++)*4, false));
		}

		var textSize=[];

		for(var i=0; i<this.textCount; i++){
			textSize.push(raw.getUint32((offset++)*4, false));
		}

		var dataSize=[];

		for(var i=0; i<this.dataCount; i++){
			dataSize.push(raw.getUint32((offset++)*4, false));
		}

		this.stackAddr=raw.getUint32((offset++)*4, false);
		this.stackSize=raw.getUint32((offset++)*4, false);
		this.entryPoint=raw.getUint32((offset++)*4, false);

		this.sections=[];

		for(var i=0; i<this.textCount; i++){
			if(textPositions[i]!=0 || textMem[i]!=0 || textSize[i]!=0){
				this.sections.push(new DOLSection(buffer.slice(textPositions[i], textPositions[i]+textSize[i]), textMem[i], "text"));
			}
		}

		for(var i=0; i<this.dataCount; i++){
			if(dataPositions[i]!=0 || dataMem[i]!=0 || dataSize[i]!=0){
				this.sections.push(new DOLSection(buffer.slice(dataPositions[i], dataPositions[i]+dataSize[i]), dataMem[i], "data"));
			}
		}

	}

	prepareInjectionSection(addr){//TODO automatic injection address

		if(addr%4!=0){
			throw("Section must be 4 byte aligned");
		}

		this.injectionSection=this.getSection(addr);
		this.injectionBase=addr;

		//Adding a new section breaks everything
		//this.injectionSection=new DOLSection(new ArrayBuffer(0), addr, "text");
		//this.sections.push(this.injectionSection);
	}

	calculateRelocation(current, base){
		var addr=current&0x3FFFFFF;
		var bAddr=base&0x3FFFFFF;

		return (current&0xFC000000)|((current-base)&0x3FFFFFF);
	}

	inject(addr, code, relocations=[], replace=false){
		if(!this.injectionSection){
			throw("Must prepare injection section before injection");
		}

		if(addr % 4!=0){
			throw("Must inject at a 4 byte alignment");
		}

		code=asBuf(code);

		const branchOpcode=0x48000000;

		var section=this.getSection(addr, 4);

		var oldInstruction=section.read4(addr);

		var branchOffset=(this.injectionBase-addr);
		var branchInstruction=branchOpcode|(branchOffset&0x03FFFFFF);

		var returnOffset=-(branchOffset+code.byteLength) + (replace ? 4 : 0) ;
		var branchReturn=branchOpcode|(returnOffset&0x03FFFFFF);

		var newBuf=new ArrayBuffer(code.byteLength+4+ (replace ? 0 : 4));
		new Uint8Array(newBuf).set(new Uint8Array(code), 0);
		var nd=new DataView(newBuf);

		if(replace){
			nd.setUint32(code.byteLength, branchReturn, false);
		}else{
			nd.setUint32(code.byteLength, oldInstruction, false);
			nd.setUint32(code.byteLength+4, branchReturn, false);
		}

		for(var reloc of relocations){
			var current=nd.getUint32(reloc, false);
			var inst=this.calculateRelocation(current, this.injectionBase+reloc);
			nd.setUint32(reloc, inst, false);
		}

		new Uint8Array(this.injectionSection.buffer).set(new Uint8Array(newBuf), this.injectionBase-this.injectionSection.addr);

		this.injectionBase+=newBuf.byteLength;

		section.write4(addr, branchInstruction);

	}

	overwrite(addr, code, relocations=[]){
		code=asBuf(code);

		var nd=new DataView(code);

		var section=this.getSection(addr, code.byteLength);

		for(var reloc of relocations){
			var current=nd.getUint32(reloc, false);
			var inst=this.calculateRelocation(current, addr+reloc);
			nd.setUint32(reloc, inst, false);
		}

		new Uint8Array(section.buffer).set(new Uint8Array(code), addr-section.addr);
	}

	getSize(){
		var size=0x100;
		for(var section of this.sections){
			size+=section.getSize();
		}
		return size;
	}

	getSection(addr, width){
		for(var section of this.sections){
			if(section.inBounds(addr, width)){
				return section;
			}
		}
		throw("address out of bounds at "+addr.toString(16));
	}

	dataSlice(addr, width){
		return this.getSection(addr, width).dataSlice(addr, width);
	}

	read4(addr){
		return this.getSection(addr, 4).read4(addr, 4);
	}

	read2(addr){
		return this.getSection(addr, 2).read2(addr);
	}

	read(addr){
		return this.getSection(addr, 1).read(addr);
	}

	write4(addr, value){
		return this.getSection(addr, 1).write4(addr, value);
	}

	write2(addr, value){
		return this.getSection(addr, 1).write2(addr, value);
	}

	write(addr, value){
		return this.getSection(addr, 1).write(addr, value);
	}

	writeToBuffer(buffer, offset){
		var data=new DataView(buffer);
		var ints=new Uint8Array(buffer);
		var tCount=0;
		var dCount=0;
		var pos=0x100;

		for(var section of this.sections){

			var eOffset=(section.type == "text" ? tCount++ : dCount++)*4;

			var tOffset=(section.type=="text" ? 0 : this.textCount*4);


			data.setUint32(offset+tOffset+eOffset, pos, false);
			data.setUint32(offset+tOffset+eOffset+0x48, section.addr, false);
			var size=section.getSize();

			data.setUint32(offset+tOffset+eOffset+0x90, size, false);

			ints.set(new Uint8Array(section.buffer), offset+pos);

			pos+=size;
		}

		data.setUint32(offset+0xD8, this.stackAddr, false);
		data.setUint32(offset+0xDC, this.stackSize, false);
		data.setUint32(offset+0xE0, this.entryPoint, false);
		return offset+pos;
	}

}

class File{
	constructor(buffer){
		this.buffer=asBuf(buffer);
		this.data=new DataView(this.buffer);
	}

	read4(offset){
		return this.data.getUint32(offset, false);
	}

	read2(offset){
		return this.data.getUint16(offset, false);
	}

	read(offset){
		return this.data.getUint8(offset, false);
	}

	write4(offset, value){
		if(value<0){
			this.data.setInt32(offset, value, false);
		}else{
			this.data.setUint32(offset, value, false);
		}
	}

	write2(offset, value){
		if(value<0){
			this.data.setInt16(offset, value, false);
		}else{
			this.data.setUint16(offset, value, false);
		}
	}

	write(offset, value){
		if(value<0){
			this.data.setInt8(offset, value, false);
		}else{
			this.data.setUint8(offset, value, false);
		}
	}

	replace(buffer){
		this.buffer=asBuf(buffer);
		this.data=new DataView(this.buffer);
	}

	toBuffer(){
		return this.buffer;
	}

}

class FST{
	constructor(buffer, offset, size){
		buffer=asBuf(buffer);
		const raw=new DataView(buffer);

		var eOffset=0;

		var entries=[];

		var loadEntry={name:"loading", type:"dir", entries:[], parent:null, next:1};

		var curDir=loadEntry;

		while(eOffset<size){
			while(curDir && entries.length>=curDir.next){
				curDir=curDir.parent;
			}

			if(curDir==null){
				break;
			}

			var first=raw.getUint32(offset+eOffset, false);
			var type=(first &0xFF000000)>>24;
			var str=first&0xFFFFFF;

			var offsetOrParent=raw.getUint32(offset+eOffset+4, false);
			var fileLength=raw.getUint32(offset+eOffset+8, false);

			if(type==0){
				var entry={name: str, type: "file", offset: offsetOrParent, len: fileLength, file: null};
				curDir.entries.push(entry);
				entries.push(entry)
			}else if(type==1){
				var entry={name: str, type: "dir", entries:[], parent: entries.length==0 ? null : entries[offsetOrParent], next:fileLength};

				curDir.entries.push(entry);
				entries.push(entry);
				curDir=entry;
			}else{
				throw("Unexpected file type in FST");
			}

			eOffset+=12;
		}

		if(eOffset>=size){
			throw("Unexected FST end");
		}

		for(var ent in entries){
			var index=entries[ent].name;
			var str="";
			var cur=0;
			while((cur=raw.getUint8(offset+eOffset+index, false))!=0){
				str+=String.fromCharCode(cur);
				index++;
			}
			entries[ent].name=str;

			if(entries[ent].type=="file"){
				entries[ent].file=new File(buffer.slice(entries[ent].offset, entries[ent].offset+entries[ent].len));

				entries[ent].align=32*1024;

				while(entries[ent].offset % entries[ent].align!=0){
					entries[ent].align/=2;
				}
			}
		}

		this.root=loadEntry.entries[0];
		this.root.name="";
	}

	getFrom(name, entry){
		if(typeof(name)=="string"){
			name=name.split("/");
		}
		for(var ent of entry.entries){
			if(ent.name==name[0]){
				if(name.length==1){
					return ent;
				}else if(ent.type=="dir"){
					return this.getFrom(name.slice(1), ent);
				}else{
					throw("Tried to traverse into file "+ name[0]);
				}
			}
		}
		throw("Could not find file");
	}

	getEntry(name){
		if(typeof(name)=="string" && name[0]=="/"){
			name=name.substr(1);
		}
		return this.getFrom(name, this.root);
	}

	getFile(name){
		var e=this.getEntry(name);
		if(e.type=="dir"){
			throw("Tried to getFile for directory"+name);
		}
		return e.file;
	}

	countNestedEntries(entry){
		if(entry.type == "file"){
			return 1;
		}
		var count=1;

		for(var ent of entry.entries){
			count+=this.countNestedEntries(ent);
		}
		return count;
	}

	getNestedStringLength(entry){
		var count=entry.name.length+1;
		if(entry.type=="file"){
			return count;
		}
		for(var ent of entry.entries){
			count+=this.getNestedStringLength(ent);
		}
		return count;
	}

	getSize(){
		var size=this.countNestedEntries(this.root)*12;
		var stringSize=this.getNestedStringLength(this.root);

		return size+stringSize;
	}

	writeEntryToBuffer(buffer, offset, entryOffset, stringsBase, stringsOffset, fileOffset, parentOffset, entry, filesWritten){
		var initial=entryOffset;
		var data=new DataView(buffer);

		var first=stringsOffset+((entry.type=="dir" ? 1 : 0)<<24);
		data.setUint32(offset+(entryOffset*12), first, false);
		writeString(buffer, entry.name, offset+stringsBase+stringsOffset);
		stringsOffset+=entry.name.length+1;

		if(entry.type=="file"){

			var existing=null;

			for(var check of filesWritten){
				if(check[0]===entry.file.buffer){
					existing=check;
					break;
				}
			}

			if(existing){
				data.setUint32(offset+(entryOffset*12)+4, existing[1], false);
				data.setUint32(offset+(entryOffset*12)+8, existing[2], false);
			}else{

				if(fileOffset % entry.align!=0){
					fileOffset=fileOffset+entry.align - (fileOffset % entry.align);
				}

				data.setUint32(offset+(entryOffset*12)+4, fileOffset, false);
				data.setUint32(offset+(entryOffset*12)+8, entry.file.buffer.byteLength, false);

				writeBuffer(entry.file.buffer, buffer, fileOffset);

				filesWritten.push([entry.file.buffer, fileOffset, entry.file.buffer.byteLength]);

				fileOffset+=entry.file.buffer.byteLength;
			}

			entryOffset++;
		}else{
			data.setUint32(offset+(entryOffset*12)+4, parentOffset, false);

			entryOffset++;
			for(var ent of entry.entries){
				var n=this.writeEntryToBuffer(buffer, offset, entryOffset, stringsBase, stringsOffset, fileOffset, initial, ent, filesWritten);
				entryOffset=n[0];
				stringsOffset=n[1];
				fileOffset=n[2];
			}

			data.setUint32(offset+(initial*12)+8, entryOffset, false);
		}
		return [entryOffset, stringsOffset, fileOffset];
	}

	writeToBuffer(buffer, offset){
		var n=this.writeEntryToBuffer(buffer, offset, 0, this.countNestedEntries(this.root)*12, 0, offset+this.getSize(), 0, this.root, []);
		return n[2];
	}

}

class Header{
	constructor(buffer){
		buffer=asBuf(buffer);
		var raw=new DataView(buffer);

		if(raw.getUint32(0x1c, false)!=0xc2339f3d){
			throw("Bad magic number");
		}

		this.apploaderSize=raw.getUint32(0x2440+0x14, false);

		this.buffer=buffer.slice(0, 0x2440+this.apploaderSize);
		this.data=new DataView(this.buffer);
		this.dolOffset=this.data.getUint32(0x420, false);
		this.fstOffset=this.data.getUint32(0x424, false);
		this.fstSize=this.data.getUint32(0x428, false);
	}

	rebuild(iso){

		this.dolOffset=this.buffer.byteLength;
		this.data.setUint32(0x420, this.dolOffset, false);

		this.fstOffset=this.dolOffset+iso.dol.getSize();
		this.data.setUint32(0x424, this.fstOffset, false);

		this.fstSize=iso.fst.getSize();
		this.data.setUint32(0x428, this.fstSize, false);
		this.data.setUint32(0x42C, this.fstSize, false);
	}

	writeToBuffer(buffer, offset){
		writeBuffer(this.buffer, buffer, offset);
		return offset+this.dolOffset;
	}
}

class GCISO {

	constructor(buffer){

		this.imageSize=1459978240;

		if(buffer.byteLength!=this.imageSize){
			console.log("Bad file size, are you sure this is a gamecube iso?");
		}
		buffer=asBuf(buffer);
		this.header=new Header(buffer);

		this.dol=new DOL(buffer.slice(this.header.dolOffset));

		this.fst=new FST(buffer, this.header.fstOffset, this.header.fstSize);

	}

	getFile(name){
		return this.fst.getFile(name);
	}

	toBuffer(){

		var ret=new ArrayBuffer(this.imageSize);
		this.header.rebuild(this);
		var c=this.header.writeToBuffer(ret, 0);
		c=this.dol.writeToBuffer(ret, c);

		c=this.fst.writeToBuffer(ret, c);
		console.log("Free space: "+(this.imageSize-c));
		return ret;
	}
}

function loadAsset(url, onLoad){
	var xhr = new XMLHttpRequest();

	xhr.addEventListener('load', function(){
		if (xhr.status == 200){
			var fileReader = new FileReader();
			fileReader.onload = function(event) {
			    arrayBuffer = event.target.result;

				onLoad(event.target.result);
			};
			fileReader.readAsArrayBuffer(xhr.response);
		}else{
			console.log("Could not load "+url);
		}
	});
	xhr.addEventListener('error', function(e){
		console.log("Error when loading "+url);
		console.log(e);
	});
	xhr.open('GET', url);
	xhr.responseType = 'blob';
	xhr.send(null);
}
