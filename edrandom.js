
class Log {
	constructor(seed){
		this.log=[];
		this.types=[];
		this.seed=seed;
		this.addType("simple", (e)=>{return e;});
		this.addLine("Seed: "+seed.toString(16), "General");
	}

	addType(type, format){
		this.types[type]=format;
	}

	addLine(data, section, type="simple"){
		if(!this.log[section]){
			this.log[section]=[];
		}

		if(!this.types[type]){
			throw "Unrecognised log type "+type;
		}

		this.log[section].push([type, data]);
	}

	toBuffer(){
		var text=this.asText();
		var buf=new ArrayBuffer(text.length);
		var data=new Uint8Array(buf);

		for(var i=0; i<text.length; i++){
			data[i]=text.charCodeAt(i);
		}
		return buf;
	}

	formatLine(line){
		var format=this.types[line[0]];

		return format(line[1]);
	}

	asText(){
		var ret="";
		for(var section in this.log){
			ret+=section+":\n\n";
			for(var line of this.log[section]){
				ret+=this.formatLine(line)+"\n";
			}
			ret+="\n";
		}
		return ret;
	}

	asDOM(){
		var ret=document.createElement("div");
		for(var section in this.log){
			var header=document.createElement("div");
			header.innerText=section;
			header.classList.add("log_header");
			if(section==="General"){
				header.classList.add("selected");
			}

			header.id=section+"_header";
			header.addEventListener('click', (function (sec) { return (function(){
				for(var ele of document.querySelectorAll(".log_section")){
					ele.classList.add("hidden");
				}
				for(var ele of document.querySelectorAll(".log_header")){
					ele.classList.remove("selected");
				}
				document.getElementById("section_"+sec).classList.remove("hidden");
				document.getElementById(sec+"_header").classList.add("selected");
			}); })(section));
			ret.appendChild(header);
		}
		var logDownload=document.createElement("div");
		logDownload.innerText="Download log";
		logDownload.className="log_header";
		logDownload.id="log_download";
		logDownload.addEventListener('click', (function (log) { return (function(){
			download(log, "edlog."+log.seed.toString(16)+".txt");
		});})(this));
		ret.appendChild(logDownload);

		for(var section in this.log){
			var dom=document.createElement("div");

			dom.classList.add("log_section");
			if(section!=="General"){
				dom.classList.add("hidden");
			}
			dom.id="section_"+section;

			var inner="";
			for(var line of this.log[section]){
				inner+=this.formatLine(line)+"<br />";
			}
			dom.innerHTML=inner;
			ret.appendChild(dom);
		}
		return ret;
	}

	writeToPage(){
		var logDom=document.getElementById("log");
		logDom.innerHTML="";
		logDom.appendChild(this.asDOM());
	}
}

function shuffle(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
}

function randomizeEnemies(iso, log, noTrapperList=[], skipList=[]){

	preventEnemyRandomizationSoftlocks(iso);

	log.addLine("Entries marked with * are variable aligment, the alignment given is for a Chattur'gha fate", "Enemies");

	log.addType("enemy_change", (d)=> {
		return `Level: ${d.level} Room: ${d.room} ${d.originalName} ${d.fromStatic ? "" : "*"} -> ${d.newName}`;
	});

	var pious=iso.fst.getFile("Npcs1.npc").asParsed();
	var lindsey=iso.fst.getFile("Npcs6.npc").asParsed();
	var karim=iso.fst.getFile("Npcs4.npc").asParsed();
	var paul=iso.fst.getFile("Npcs7.npc").asParsed();
	var edward=iso.fst.getFile("Npcs9.npc").asParsed();

	var templates=[
		[pious.buildTemplateFromEntry(0, 0), "Mantorok Zombie"],
		[lindsey.buildTemplateFromEntry(0, 0xe), "Xel'lotath Zombie"],
		[lindsey.buildTemplateFromEntry(0, 0x14), "Ulyaoth Zombie"],
		[lindsey.buildTemplateFromEntry(0, 9), "Chattur'gha Zombie"],
		[karim.buildTemplateFromEntry(3, 0, 0), "Xel'lotath Horror"],
		[karim.buildTemplateFromEntry(3, 0, 2), "Ulyaoth Horror"],
		[karim.buildTemplateFromEntry(3, 0, 1), "Chattur'gha Horror"],
		[lindsey.buildTemplateFromEntry(3, 4, 2), "Xel'lotath Gatekeeper"],
		[lindsey.buildTemplateFromEntry(3, 4, 1), "Ulyaoth Gatekeeper"],
		[lindsey.buildTemplateFromEntry(3, 4, 0), "Chattur'gha Gatekeeper"],

		[paul.buildTemplateFromEntry(3, 0, 2), "Xel'lotath Bonethief"],
		[paul.buildTemplateFromEntry(3, 0, 1), "Ulyaoth Bonethief"],
		[paul.buildTemplateFromEntry(3, 0, 0), "Chattur'gha Bonethief"],

		[edward.buildTemplateFromEntry(3, 16, 2), "Xel'lotath Guardian"],
		[edward.buildTemplateFromEntry(3, 16, 1), "Ulyaoth Guardian"],
		[edward.buildTemplateFromEntry(3, 16, 0), "Chattur'gha Guardian"],

		[lindsey.buildTemplateFromEntry(3, 15, 2), "Xel'lotath Trapper"],
		[lindsey.buildTemplateFromEntry(3, 15, 1), "Ulyaoth Trapper"],
		[lindsey.buildTemplateFromEntry(3, 15, 0), "Chattur'gha Trapper"],
	];

	const runeSafe=7;

	var candidates=[];
	for(var temp of templates){
		candidates.push(temp[0].model);
	}

	bigLevel(iso, candidates);
	candidates=candidates.slice(0, 16);//Workaround for trapper based crashes


	var i=0;
	while(i<14){
		if(i==12){
			i++;
			continue;
		}
		var npcs=iso.fst.getFile("Npcs"+i+".npc").asParsed();

		var c=npcs.entries[0].length;

		var j=0;
		while(j<c){
			var d=new DataView(npcs.entries[0][j]);
			var type=d.getUint16(0x18, false);
			var cIndex;
			if((cIndex=candidates.indexOf(type))!==-1 && (!skipList[i] || !skipList[i][0] || skipList[i][0].indexOf(j)===-1) ){


				var maxIndex=templates.length;

				var script=new DataView(npcs.entries[0][j]).getUint16(0x1c, false);

				if(script!=0xFFFF || (noTrapperList[i] && noTrapperList[i][0] && noTrapperList[i][0].indexOf(j)!==-1)){
					maxIndex=runeSafe;
				}
				var rand=Math.floor(Math.random()*maxIndex);

				npcs.applyTemplate(0, j, templates[rand][0]);

				var room=d.getUint16(0x6, false);
				log.addLine(	{"level":i,
								 "room": room,
								 "fromStatic":true,
								 "originalName":templates[cIndex][1],
								 "originalTemplateIndex": cIndex,
								 "newName": templates[rand][1],
								 "newTemplateIndex":rand},
							"Enemies",
							"enemy_change");
			}
			j++;
		}

		c=npcs.entries[3].length;

		j=0;
		while(j<c){
			var d=new DataView(npcs.entries[3][j]);
			var type=d.getUint16(0x18, false);
			var cIndex;
			if((cIndex=candidates.indexOf(type))!==-1 && (!skipList[i] || !skipList[i][3] || skipList[i][3].indexOf(j)===-1) ){

				var maxIndex=templates.length;

				var script=new DataView(npcs.entries[3][j]).getUint16(0x2a, false);

				if(script!=0xFFFF || (noTrapperList[i] && noTrapperList[i][3] && noTrapperList[i][3].indexOf(j)!==-1)){
					maxIndex=runeSafe;
				}

				var rand=Math.floor(Math.random()*maxIndex);

				npcs.applyTemplate(3, j, templates[rand][0]);

				var room=d.getUint16(0x6, false);
				log.addLine(	{"level":i,
								 "room": room,
								 "fromStatic":false,
								 "originalName":templates[cIndex][1],
								 "originalTemplateIndex": cIndex,
								 "newName": templates[rand][1],
								 "newTemplateIndex":rand},
							"Enemies",
							"enemy_change");
			}

			j++;
		}

		//file.replace(npcs.toBuffer());

		i++;
	}

	randomizeScriptEnemies(iso, templates, candidates, runeSafe);

}

function preventEnemyRandomizationSoftlocks(iso){
	modifyScript(iso, 1920, (s)=>{s.addFlagSet([[0x80725E70, 2]]);});
	modifyScript(iso, 2206, (s)=>{ s.instructions[0x129]=s.buildInstruction("POP", 3); s.instructions[0x13f]=s.buildInstruction("POP", 3); });

}

function randomizeScriptEnemies(iso, templates, candidates, runeSafe){

	var regexString='(';

	for(var candidate of candidates){
		regexString+=candidate+"|";
	}
	regexString=regexString.slice(0, -1);

	regexString+=')$';

	var search=["GETGLOBAL ed3", /PUSHINT .*/, new RegExp('PUSHINT '+regexString)];

	for(var i=0; i<8; i++){
		search.push(/.*/);
	}
	search.push(/PUSHINT -?1/);

	var scripts=searchScripts(iso, search);

	for(var script of scripts){
		modifyScript(iso, script[0], function(lua){

			var maxRoll=templates.length;

			for(var check of lua.instructions){
				if(lua.parseInstruction(check)=="GETGLOBAL ed98"){
					maxRoll=templates.length-3;
					break;
				}
			}

			if(lua.parseInstruction(lua.instructions[script[1]+7])!="PUSHINT -1"){
				maxRoll=runeSafe;
			}


			var rand=Math.floor(Math.random()*maxRoll);
			var geom=templates[rand][0].model;
			var ai=templates[rand][0].animations;
			var state=templates[rand][0].state;

			lua.instructions[script[1]+1]=lua.buildInstruction("PUSHINT", ai);
			lua.instructions[script[1]+2]=lua.buildInstruction("PUSHINT", geom);
			lua.instructions[script[1]+8]=lua.buildInstruction("PUSHINT", state);
		});
	}

	search=["GETGLOBAL ed291"];

	scripts=searchScripts(iso, search);

	var alignments=["ED_ALIGNMENT_XEL", "ED_ALIGNMENT_CHAT", "ED_ALIGNMENT_ULY", "ED_ALIGNMENT_MANT"];

	var spawnMax=5;
	var spawnRuneSafe=2;

	for(var script of scripts){
		modifyScript(iso, script[0], function(lua){

			var cr=spawnMax;

			if(lua.parseInstruction(lua.instructions[script[1]+5])!="PUSHINT 0"){
				cr=spawnRuneSafe
			}

			var randType=Math.floor(Math.random()*cr)+3;
			var randAlign=Math.floor(Math.random()* (randType==3 ? 4 : 3) );

			lua.instructions[script[1]+1]=lua.buildInstruction("PUSHINT", randType);
			lua.instructions[script[1]+2]=lua.buildInstruction("GETGLOBAL", alignments[randAlign]);
		});
	}

}

function randomizeMeleeWeapons(iso, log){

	//Make pious vulnerable to all weapons
	iso.dol.write4(0x800a9194, 0x60000000);
	iso.dol.write4(0x800ab1c4, 0x60000000);

	log.addType("item_change", (d) => {
		return `${d.originalName} -> ${d.newName}`;
	});

	var pool=[
		[1, [0, 1200, 6], "Pious Gladius"],
		[[0, 13], [1, 6], "Alex Gladius"],
		[[0, 13], [[0, 2412, 0xad], [0, 2412, 0xbf], [0, 2412, 0xd1]], "Enchanted Gladius"],
		[2, [[0, 1201, 0x9], [2, 0x801d1e7a, 0x801d1e7e, 0x801d1e82]], "Short Sword"],
		[3, [0, 1939, 0x5a], "Scramasax"],
		[3, [0, 1810, 0x36], "Anthony Double Edged Sword"],
		[4, [0, 1203, 0x9], "Tulwar"],
		//[4, [1, 8], "Karim Torch"],
		//[6, [0, 1205, 0x30], "Lindsey Torch"],
		//[7, [1, 13], "Paul Torch"],
		//[10, [1, 3], "Peter Torch"],
		[10, [1, 13], "Peter Double Edged Sword"],
		[4, [1, 2], "Ram Dao"],
		[5, [1, 11], "Max Sabre"],
		[9, [1, 22], "Edward Sabre"],
		[6, [0, 1205, 0x23], "Kukri"],
		[7, [1, 3], "Mace"],
		[8, [1, 4], "Saif"],
		[11, [0, 1210, 0x9], "Fire Axe"],
	];

	var invu=new GPK(iso.getFile("InvU.bin").toBuffer());
	var newInvu=iso.getFile("InvU.bin").asParsed();

	var npcs=[];

	for(var i=0; i<14; i++){
		if(i==12){
			continue;
		}

		npcs[i]=iso.getFile("Npcs"+i+".npc").asParsed();
	}

	for(var i in pool){
		if(!Array.isArray(pool[i][0])){
			pool[i][0]=[pool[i][0]];
		}
		if(!Array.isArray(pool[i][1][0])){
			pool[i][1]=[pool[i][1]];
		}

		var source=pool[i][1][0];

		if(source[0]==0){

			var script=findScript(iso, source[1]);

			pool[i][3]=npcs[0].buildTemplateFromScript(script, source[2]);
		}else if(source[0]==1){

			pool[i][3]=npcs[pool[i][0][0]].buildTemplateFromEntry(2, source[1]);
		}else{
			var anim=iso.dol.read2(source[1]);
			var model=iso.dol.read2(source[2]);
			var state=iso.dol.read2(source[3]);

			pool[i][3]=npcs[0].buildTemplate(anim, model, state);
		}
	}

	var rand=[];
	for(var i=0; i<pool.length; i++){
		rand.push(i);
	}

	shuffle(rand);

	for(var i in pool){

		var source=pool[rand[i]];
		var dest=pool[i];

		log.addLine({"originalName": dest[2], "newName": source[2]}, "Items", "item_change");
		for(var level of dest[0]){
			copyItem(iso, source[0][0], level, source[3].model);

			var data=new DataView(invu.entries[dest[3].state][0])

			var animation=data.getUint16(0x36, false);
			var entry=new DataView(newInvu.entries[source[3].state][0]);

			entry.setUint16(0x36, data.getUint16(0x36, false));
			entry.setUint16(0x38, data.getUint16(0x38, false));
			entry.setUint16(0x3a, data.getUint16(0x3a, false));
			entry.setUint16(0x3c, data.getUint16(0x3c, false));
			entry.setUint16(0x3e, data.getUint16(0x3e, false));
			entry.setUint16(0x40, data.getUint16(0x40, false));

			entry.setUint16(0x24, data.getUint16(0x24, false));
		}

		for(var loc of dest[1]){
			if(loc[0]==0){
				modifyScript(iso, loc[1], (lua)=>{
					lua.instructions[loc[2]+1]=lua.buildInstruction("PUSHINT", source[3].animations);
					lua.instructions[loc[2]+2]=lua.buildInstruction("PUSHINT", source[3].model);
					lua.instructions[loc[2]+4]=lua.buildInstruction("PUSHINT", source[3].state);
				});
			}else if(loc[0]==1){
				npcs[dest[0][0]].applyTemplate(2, loc[1], source[3]);
			}else if(loc[0]==2){
				if(loc[1]){
					iso.dol.write2(loc[1], source[3].animations);
				}
				if(loc[2]){
					iso.dol.write2(loc[2], source[3].model);
				}
				if(loc[3]){
					iso.dol.write2(loc[3], source[3].state);
				}
			}
		}

	}

}

function roomTextShuffle(iso, log){

	log.addType("text_change", (d)=> {
		return `${d.originalFi}:${d.originalSi} -> ${d.newFi} ${d.newSi}`;
	});

	var gpks=[];
	var newGpks=[];
	var entries=[];
	var pools=[];
	var cmps=[];

	var i=0;
	while(i<14){
		var filename="RmTxt"+("00"+i).slice(-2)+".cmp";

		var cmp=iso.fst.getFile(filename);
		cmp.replace(decompressSKASC(cmp.buffer));

		cmps[i]=cmp;

		gpks[i]=new GPK(cmp);
		newGpks[i]=new GPK();

		for(var fi in gpks[i].entries){
			if(gpks[i].entries[fi]){
				for(var si in gpks[i].entries[fi]){
					if(gpks[i].entries[fi][si]){
						var d=new DataView(gpks[i].entries[fi][si]);
						var special=d.getUint32(0, false);
						if(!pools[special]){
							pools[special]=[];
						}
						if(!entries[fi]){
							entries[fi]=[];
						}
						if(!entries[fi][si]){
							entries[fi][si]=[];
						}
						pools[special].push([fi, si]);
						entries[fi][si].push(i);
					}
				}
			}
		}
		i++;
	}
	

	for(var special in pools){
		var pc=pools[special].slice(0);

		shuffle(pc);

		for(var rIndex in pools[special]){
			var source=pc[rIndex];
			var dest=pools[special][rIndex];

			var sourceFi=source[0];
			var sourceSi=source[1];

			var destFi=dest[0];
			var destSi=dest[1];

			var data=gpks[entries[sourceFi][sourceSi][0]].entries[sourceFi][sourceSi];

			for(var de of entries[destFi][destSi]){
				if(!newGpks[de].entries[destFi]){
					newGpks[de].entries[destFi]=[];
				}
				newGpks[de].entries[destFi][destSi]=data;
			}
			log.addLine({"originalFi": sourceFi, "originalSi": sourceSi, "newFi": destFi, "newSi": destSi}, "Text", "text_change");
		}
	}

	for(var file in cmps){
		cmps[file].replace(newGpks[file].toBuffer());
	}

}

function randomizeRunes(iso, log){
	log.addType("magic_pickup_change", (d)=>{ return `${d.originalName} -> ${d.newName}`;});

	var pool=[
		{"name":"Chattur'gha", "model":18, "pickuptype":"rune", "type": "script", "script": 1429, "offset": 0x86, "level":[3, 4, 5], "item":47, "pickupScript":[1360, 4, 0, 0], "pickupIndex": 0 },
		{"name":"Ulyaoth", "model": 20, "pickuptype":"rune", "type": "script", "script": 1429, "offset": 0x95, "level":[3, 4, 5], "item":56, "pickupScript": [1361, 4, 0, 1], "pickupIndex": 1},
		{"name":"Xel'lotath", "model": 19, "pickuptype":"rune", "type":"script", "script": 1429, "offset": 0x74, "level":[3, 4, 5], "item":57, "pickupScript": [1362, 4, 0, 2], "pickupIndex": 2 },
		{"name":"Mantorok", "model": 21, "pickuptype":"rune", "type":"npc", "npc": 6, "offset":13, "level":6, "item":49, "pickupScript":[1363, 24, 5, 3], "pickupIndex": 3 },
		{"name":"Bankorok", "model": 17, "pickuptype":"rune", "type":"script", "script": 2496, "offset": 48, "level": 5, "item":46, "pickupScript": [1364, 0, 0, 4], "pickupIndex": 4},
		{"name":"Tier", "model": 16, "pickuptype":"rune", "type":"script", "script": 2490, "offset": 46, "level":6, "item":55, "pickupScript": [1365, 0, 0, 5], "pickupIndex": 5 },
		{"name":"Narokath", "model": 15, "pickuptype":"rune", "type":"script", "script": 2709, "offset": 6, "level":4, "item":50, "pickupScript": [1366, 0, 0, 6], "pickupIndex": 6},
		{"name":"Nethlek", "model": 14, "pickuptype":"rune", "type":"script", "script": 1830, "offset": 46, "level":6, "item":51, "pickupScript": [1367, 0, 0, 7], "pickupIndex": 7 },
		{"name":"Antorbok", "model": 13, "pickuptype":"rune", "type":"script", "script": 1826, "offset": 46, "level":3, "item":44, "pickupScript": [1368, 0, 0, 8], "pickupIndex": 8},
		{"name":"Magormor", "model": 22, "pickuptype":"rune", "type":"script", "script": 1824, "offset": 46, "level":3, "item":48, "pickupScript": [1369, 0, 0, 9], "pickupIndex": 9},
		{"name":"Redgormor", "model": 23, "pickuptype":"rune", "type":"script", "script": 1599, "offset": 553, "level":5, "item":53, "pickupScript": [1370, 0, 0, 10], "pickupIndex": 10},
		{"name":"Aretak", "model": 24, "pickuptype":"rune", "type":"script", "script": 2498, "offset": 46, "level":6, "item":45, "pickupScript": [1371, 0, 0, 11], "pickupIndex": 11},
		{"name":"Santak", "model": 25, "pickuptype":"rune", "type":"script", "script": 1868, "offset": 46, "level":4, "item":54, "pickupScript": [1372, 0, 0, 12], "pickupIndex": 12},
		{"name":"Pargon", "model": 12, "pickuptype":"rune", "type":"script", "script": 1374, "offset": 37, "level":7, "item":52, "pickupScript": [1373, 0, 0, 13], "pickupIndex": 13},
		{"name":"3 Circle", "model": 27, "pickuptype":"rune", "type":"npc", "npc": 3, "offset": 1, "level":3, "item":43, "pickupScript": [2129, 0xe3, 5, 16], "pickupIndex": 16},
		{"name":"5 Circle", "model": 28, "pickuptype":"rune", "type":"npc", "npc": 7, "offset": 12, "level":7, "item":42, "pickupScript":  [1375, 0, 0, 17], "pickupIndex": 17},
		{"name":"7 Circle", "model": 29, "pickuptype":"rune", "type":"npc", "npc": 10, "offset": 6, "level":10, "item":41, "pickupScript": [[1376, 0, 0, 18], [2692, 0xb8, 1, 18]], "pickupIndex": 18},
		{"name":"Antorbok Codex", "model": 242, "pickuptype":"codex", "type":"npc", "npc": 3, "offset": 9, "level":3, "item":225},
		{"name":"Aretak Codex", "model": 243, "pickuptype":"codex", "type":"npc", "npc": 6, "offset": 2, "level":6, "item":225},
		{"name":"Bankorok Codex", "model": 244, "pickuptype":"codex", "type":"npc", "npc": 5, "offset": 16, "level":5, "item":225},
		{"name":"Chattur'gha Codex", "destName": "Karim's aligned codex", "model": 245, "pickuptype":"codex", "type":"alignednpc", "npc": 4, "offset": 0, "level":[3, 4, 5], "item":225},
		{"name":"Magormor Codex", "model": 246, "pickuptype":"codex", "type":"npc", "npc": 3, "offset": 2, "level":3, "item":225},
		{"name":"Mantorok Codex", "model": 247, "pickuptype":"codex", "type":"npc", "npc": 6, "offset": 0, "level":6, "item":225},
		{"name":"Narokath Codex", "model": 248, "pickuptype":"codex", "type":"npc", "npc": 4, "offset": 0, "level":4, "item":225},
		{"name":"Nethlek Codex", "model": 249, "pickuptype":"codex", "type":"npc", "npc": 6, "offset": 8, "level":6, "item":225},
		{"name":"Pargon Codex", "model": 250, "pickuptype":"codex", "type":"npc", "npc": 7, "offset": 8, "level":7, "item":225},
		{"name":"Redgormor Codex", "model": 251, "pickuptype":"codex", "type":"npc", "npc": 5, "offset": 8, "level":5, "item":225},
		{"name":"Santak Codex", "model": 252, "pickuptype":"codex", "type":"npc", "npc": 4, "offset": 4, "level":4, "item":225},
		{"name":"Tier Codex", "model": 253, "pickuptype":"codex", "type":"npc", "npc": 6, "offset": 10, "level":6, "item":225},
		{"name":"Ulyaoth Codex", "destName":"Max's aligned codex", "model": 254, "pickuptype":"codex", "type":"alignednpc", "npc": 5, "offset": 0, "level":[3, 4, 5], "item":225},
		{"name":"Xel'lotath Codex", "destName":"Anthony's aligned codex", "model": 255, "pickuptype":"codex", "type":"alignednpc", "npc": 3, "offset": 0, "level":[3, 4, 5], "item":225},
		{"name":"Enchant Item", "model": 0x20, "pickuptype":"scroll", "type":"npc", "npc": 3, "offset": 8, "level":3, "item":71},
		{"name":"Recover", "model": 0x21, "pickuptype":"scroll", "type":"npc", "npc": 4, "offset": 5, "level":4, "item":71},
		{"name":"Damage Field", "model": 0x22, "pickuptype":"scroll", "type":"npc", "npc": 5, "offset": 14, "level":5, "item":71},
		{"name":"Bind", "model": 0x23, "pickuptype":"scroll", "type":"npc", "npc": 11, "offset": 11, "level":11, "item":71},
		{"name":"Shield", "model": 0x24, "pickuptype":"scroll", "type":"npc", "npc": 7, "offset": 10, "level":7, "item":71},
		{"name":"Dispel Magic", "model": 0x25, "pickuptype":"scroll", "type":"npc", "npc": 6, "offset": 11, "level":6, "item":71},
		{"name":"Magickal Attack", "model": 0x27, "pickuptype":"scroll", "type":"npc", "npc": 10, "offset": 24, "level":10, "item":71},
		{"name":"Summon Trapper", "model": 0x28, "pickuptype":"scroll", "type":"npc", "npc": 6, "offset": 3, "level":6, "item":71},
		{"name":"Summon Horror", "model": 0x29, "pickuptype":"scroll", "type":"npc", "npc": 9, "offset": 11, "level":9, "item":71},
		{"name":"Summon Zombie", "model": 0x2a, "pickuptype":"scroll", "type":"npc", "npc": 8, "offset": 6, "level":8, "item":71},
		{"name":"Reveal Invisible", "model": 0x2b, "pickuptype":"scroll", "type":"npc", "npc": 5, "offset": 12, "level":5, "item":71},
		{"name":"Magick Pool", "model": 0x2c, "pickuptype":"scroll", "type":"npc", "npc": 9, "offset": 7, "level":9, "item":71},
	];

	var rand=pool.slice(0);
	shuffle(rand);

	const addRollCode=(code, roll)=>{
		code.push(["GETLOCAL", 1]);
		code.push(["PUSHINT", roll["model"]]);
		code.push(["JMPNE", roll["pickuptype"]=="scroll" ? 5 : 4]);

		if(roll["pickuptype"]==="rune"){
			code.push(["GETGLOBAL", "ed10"]);
			code.push(["PUSHINT", 1<<roll["pickupIndex"]]);
			code.push(["CALL", 2, 0]);
			code.push("REJOIN");
		}else if(roll["pickuptype"]==="scroll"){
			code.push(["GETGLOBAL", "ed73"]);
			code.push(["PUSHINT", roll["model"]]);
			code.push(["PUSHINT", 65536]);
			code.push(["CALL", 2, 0]);
			code.push("REJOIN");
		}else if(roll["pickuptype"]==="codex"){
			code.push(["GETGLOBAL", "ed72"]);
			code.push(["PUSHINT", roll["model"]]);
			code.push(["CALL", 2, 0]);
			code.push("REJOIN");
		}else{
			throw "Bad reward type";
		}
	};

	var code=[];

	for(var i in pool){
		var roll=rand[i];
		var dest=pool[i];

		if(dest["pickuptype"]=="rune"){
			var scripts=dest["pickupScript"];
			if(!Array.isArray(scripts[0])){
				scripts=[scripts];
			}
	
			for(var script of scripts){

				if(roll["pickuptype"]==="rune"){
					modifyScript(iso, script[0], (s)=> {
						s.instructions[script[1]+1]=s.buildInstruction("PUSHINT", 1<<roll["pickupIndex"]);
					});
				}else if(roll["pickuptype"]==="scroll"){
					modifyScript(iso, script[0], (s)=>{
						s.addJmpPatch(script[1], script[1]+3, [
							["GETGLOBAL", "ed73"],
							["PUSHINT", roll["model"]],
							["PUSHINT", 65536],
							["CALL", script[2], 0]
						]);
					});
				}else if(roll["pickuptype"]==="codex"){
					modifyScript(iso, script[0], (s)=>{
						s.instructions[script[1]]=s.buildInstruction("GETGLOBAL", "ed72");
						s.instructions[script[1]+1]=s.buildInstruction("PUSHINT", roll["model"]);
					});
				}else{
					throw "Bad reward type";
				}
			}
		}else{
			addRollCode(code, roll);
		}
		
		if(dest["type"]==="npc"){
			var npc=iso.getFile("Npcs"+dest["npc"]+".npc").asParsed();
			
			var d=new DataView(npc.entries[2][dest["offset"]]);
			d.setUint16(28, roll["model"], false);
		}else if(dest["type"]==="alignednpc"){
			var npc=iso.getFile("Npcs"+dest["npc"]+".npc").asParsed();
			
			var d=new DataView(npc.entries[4][dest["offset"]]);
			d.setUint16(32, roll["model"], false);
			d.setUint16(40, roll["model"], false);
			d.setUint16(48, roll["model"], false);
		}else if(dest["type"]==="script"){
			modifyScript(iso, dest["script"], (lua)=>{
				lua.instructions[dest["offset"]+2]=lua.buildInstruction("PUSHINT", roll["model"]);
			});
		}else{
			throw "Bad type";
		}


		log.addLine({"originalName": dest["destName"] ? dest["destName"] : dest["name"], "newName": roll["name"], "original": dest, "new":roll}, "Runes", "magic_pickup_change");
		
		var sourceLevel=roll["level"];
		
		if(Array.isArray(sourceLevel)){
			sourceLevel=sourceLevel[0];
		}
		
		var destLevels=dest["level"];
		
		if(!Array.isArray(destLevels)){
			destLevels=[destLevels];
		}
		for(var destLevel of destLevels){
			copyItem(iso, sourceLevel, destLevel, roll["model"]);
		}
	}

	modifyScript(iso, 1985, (s)=>{
		s.addJmpPatch(6, 9, code);
	});

	modifyScript(iso, 2022, (s)=>{
		s.addJmpPatch(6, 10, code);
	});

	modifyScript(iso, 402, (s)=>{
		s.addJmpPatch(6, 10, code);
	});
	modifyScript(iso, 451, (s)=>{
		s.addJmpPatch(6, 10, code);
	});
}

function fixRuneSpireCrashes(iso, log){

	//Skip the puzzle controls for en'gha runes
	var edRunes=findScript(iso, 2082);
	edRunes.instructions[0x32]=edRunes.buildInstruction("GETGLOBAL", "fn73");
	edRunes.instructions[0x33]=edRunes.buildInstruction("PUSHINT", 2204);
	edRunes.instructions[0x34]=edRunes.buildInstruction("CALL", 0, 0);
	edRunes.instructions[0x35]=edRunes.buildInstruction("GETGLOBAL", "fn1");
	edRunes.instructions[0x36]=edRunes.buildInstruction("PUSHINT", 0);
	edRunes.instructions[0x37]=edRunes.buildInstruction("CALL", 0, 0);
	edRunes.instructions[0x38]=edRunes.buildInstruction("END");
	replaceScript(iso, 2082, edRunes);

	//Replace the check for all the runes being active with a check that the portals are activated
	var runeCheck=findScript(iso, 2204);
	var cur=runeCheck.instructions.length;

	//jmp patch
	runeCheck.instructions[0x11c]=runeCheck.buildInstruction("JMP", cur-0x11c-1);

	//Check which level we're on
	runeCheck.instructions[cur++]=runeCheck.buildInstruction("GETGLOBAL", "ed143");
	runeCheck.instructions[cur++]=runeCheck.buildInstruction("CALL", 3, 1);
	runeCheck.instructions[cur++]=runeCheck.buildInstruction("PUSHINT", 9);

	var alexJmp=cur++;

	//Check edwards's pillars
	var edFlag=45;
	for(var i=0; i<9; i++){
		runeCheck.instructions[cur++]=runeCheck.buildInstruction("GETGLOBAL", "fn30");
		runeCheck.instructions[cur++]=runeCheck.buildInstruction("PUSHINT", edFlag+i);
		runeCheck.instructions[cur++]=runeCheck.buildInstruction("CALL", 3, 1);
		runeCheck.instructions[cur++]=runeCheck.buildInstruction("PUSHINT", 1);
		runeCheck.instructions[cur]=runeCheck.buildInstruction("JMPNE", 0x14b-cur-1);
		cur++;
	}

	runeCheck.instructions[cur]=runeCheck.buildInstruction("JMP", 0x140-cur-1);
	cur++;

	runeCheck.instructions[alexJmp]=runeCheck.buildInstruction("JMPNE", cur-alexJmp-1);

	//Check alex's pillars
	var alexFlag=24;
	for(var i=0; i<9;i++){
		runeCheck.instructions[cur++]=runeCheck.buildInstruction("GETGLOBAL", "fn30");
		runeCheck.instructions[cur++]=runeCheck.buildInstruction("PUSHINT", alexFlag+i);
		runeCheck.instructions[cur++]=runeCheck.buildInstruction("CALL", 3, 1);
		runeCheck.instructions[cur++]=runeCheck.buildInstruction("PUSHINT", 1);
		runeCheck.instructions[cur]=runeCheck.buildInstruction("JMPNE", 0x14b-cur-1);
		cur++;
	}

	runeCheck.instructions[cur]=runeCheck.buildInstruction("JMP", 0x140-cur-1);
	cur++;
	runeCheck.instructions[cur++]=runeCheck.buildInstruction("END");

	replaceScript(iso, 2204, runeCheck);

	//Accept any runes as a solution to the puzzle
	var runeSolution=findScript(iso, 2216);
	for(var addr of [0x39, 0x5b, 0xb9, 0xe7, 0x115, 0x162, 0x174, 0x186, 0x1d4, 0x1f6]){
		runeSolution.instructions[addr]=runeSolution.buildInstruction("POP", 2);
	}
	replaceScript(iso, 2216, runeSolution);
}

function addPeterRuneGate(iso, log){
	var threeCircle=false;
	var otherCircle=false;
	var pargon=false;
	var alignment=false;
	var antorbok=false;
	var redgormor=false;
	var found=false;//TODO put in a proper options check

	for(var line of log.log["Runes"]){
		if(line[0]!="magic_pickup_change"){
			continue;
		}
		if(line[1].originalName==="7 Circle" || line[1].originalName==="Magickal Attack"){
			found=true;

			if(line[1].newName==="3 Circle"){
				threeCircle=true;
			}

			if(line[1].newName==="5 Circle" || line[1].newName==="7 Circle"){
				otherCircle=true;
			}

			if(line[1].newName==="Pargon"){
				pargon=true;
			}

			if(line[1].newName==="Antorbok"){
				antorbok=true;
			}

			if(line[1].newName==="Redgormor"){
				redgormor=true;
			}

			if(line[1].newName==="Mantorok" || line[1].newName==="Chatthur'gha" || line[1].newName==="Ulyaoth" || line[1].newName==="Xel'lotath"){
				alignment=true;
			}
		}
	}
	if(!found){
		return;//Runes probably aren't being randomised, no need to do anything
	}

	var code=[];

	if(!threeCircle){
		if(otherCircle){
			if(pargon){
				//all good
			}else{
				//check for 3 circle or pargon
				code.push(["GETGLOBAL", "BKDoesPlayerHaveRune"]);
				code.push(["PUSHINT", (1 << 13)]);//pargon
				code.push(["CALL", 0, 1]);
				code.push(["JMPT", 5]);
				code.push(["GETGLOBAL", "fn214"]);
				code.push(["PUSHINT", 1]);
				code.push(["CALL", 0, 1]);
				code.push(["PUSHINT", 0]);
				code.push(["JMPEQ", ":FAILURE"]);
			}
		}else{
			if(pargon){
				//check for any circle
				code.push(["GETGLOBAL", "fn214"]);
				code.push(["PUSHINT", (1 <<0) | (1 << 1) | (1 << 2)]);//all circles
				code.push(["CALL", 0, 1]);
				code.push(["PUSHINT", 0]);
				code.push(["JMPEQ", ":FAILURE"]);
			}else{
				//check for 3 circle or other circle+pargon
				code.push(["GETGLOBAL", "fn214"]);
				code.push(["PUSHINT", (1 << 0)]);//3 circle
				code.push(["CALL", 0, 1]);
				code.push(["PUSHINT", 0]);
				code.push(["JMPNE", 9]);
				code.push(["GETGLOBAL", "BKDoesPlayerHaveRune"]);
				code.push(["PUSHINT", (1 << 13)]);//pargon
				code.push(["CALL", 0, 1]);
				code.push(["JMPF", ":FAILURE"]);
				code.push(["GETGLOBAL", "fn214"]);
				code.push(["PUSHINT", (1 << 1) | (1<<2)]);//5&7 circle
				code.push(["CALL", 0, 1]);
				code.push(["PUSHINT", 0]);
				code.push(["JMPEQ", ":FAILURE"]);
			}
		}
	}

	if(!alignment){
		code.push(["GETGLOBAL", "BKDoesPlayerHaveRune"]);
		code.push(["PUSHINT", (1 <<0) | (1 <<1) | (1 <<2) | (1 <<3)]);
		code.push(["CALL", 0, 1]);
		code.push(["JMPF", ":FAILURE"]);
	}

	if(!antorbok){
		//check for antorbok
		code.push(["GETGLOBAL", "BKDoesPlayerHaveRune"]);
		code.push(["PUSHINT", (1 <<8)]);
		code.push(["CALL", 0, 1]);
		code.push(["JMPF", ":FAILURE"]);
	}

	if(!redgormor){
		//check for redgormor
		code.push(["GETGLOBAL", "BKDoesPlayerHaveRune"]);
		code.push(["PUSHINT", (1 <<10)]);
		code.push(["CALL", 0, 1]);
		code.push(["JMPF", ":FAILURE"]);
	}

	code.push(["GETGLOBAL", "fn29"]);
	code.push(["PUSHINT", bitAddressToFlag(0x80725E48, 0)]);
	code.push(["PUSHINT", 1]);
	code.push(["CALL", 0, 0]);

	var failure=code.length;

	for(var index in code){
		if(code[index][1]===":FAILURE"){
			code[index][1]=failure-index-1;
		}
	}

	modifyScript(iso, 1892, (s)=>{
		s.prepend(code);
	});

	//Don't give the flag when you complete roberto
	modifyScript(iso, 1578, (s)=>{
		s.instructions[0x33]=s.buildInstruction("POP", 3);
	});
}

function buildRuneGate(runes){

	if(runes==0){
		return [];
	}

	var code=[];

	if(runes & 0x70000){
		code.push(["GETGLOBAL", "fn214"]);
		code.push(["PUSHINT", (runes & 0x70000)>>16]);
		code.push(["CALL", 0, 1]);
		code.push(["PUSHINT", (runes & 0x70000)>>16]);
		code.push(["JMPNE", ":FAILURE"]);
	}

	if(runes & 0x3FFF){
		code.push(["GETGLOBAL", "BKDoesPlayerHaveRune"]);
		code.push(["PUSHINT", runes & 0x3fff]);
		code.push(["CALL", 0, 1]);
		code.push(["PUSHINT", runes & 0x3fff]);
		code.push(["JMPNE", ":FAILURE"]);
	}

	code.push(["JMP", 1]);
	code.push(["END"]);

	for(var i in code){
		if(code[i][1]===":FAILURE"){
			code[i][1]=code.length-i-2;
		}
	}

	return code;
}

function examineCirclesFromScripts(iso, continuation=false){
	//fn214
	loadAsset("./assets/scriptCircle.bin", (code)=>{
		iso.dol.overwrite(0x80176eac, code, [0x4, 0x40]);

		if(continuation){
			continuation();
		}
	});
}

function addChapterEndRuneGates(iso, log){


	var align=-1;

	for(var line of log.log["General"]){
		if(line[0]!="forced_alignment"){
			continue;
		}
		align=line[1].alignment-1;
		break;
	}

	if(align===-1){
		throw "Cannot add rune gates without forcing alignment";
	}

	var required=[
		"Chattur'gha",
		"Ulyaoth",
		"Xel'lotath",
		"Mantorok",
		"Bankorok",
		"Tier",
		"Narokath",
		"Nethlek",
		"Antorbok",
		"Magormor",
		"Redgormor",
		"Aretak",
		"Santak",
		"Pargon",
		"EMPTY",
		"EMPTY",
		"3 Circle",
		"5 Circle",
		"7 Circle"
	];

	var gateScripts=[
		null,
		null,
		null,
		1147,//anothony
		1381,//karim
		1155,//max
		906,//lindsey
		1234,//paul
		244,//roberto
		1045,//edward
		1235,//peter
		1183,//michael
	];


	var mappings=[
	];


	for(var line of log.log["Runes"]){
		if(line[0]!="magic_pickup_change"){
			continue;
		}

		if(required.indexOf(line[1].newName)!==-1){
			mappings.push([line[1].originalName, line[1].newName]);
		}
	}

	var pickups=getMagicPickups();

	for(var chapter in pickups){
		if(!pickups[chapter] || pickups[chapter].length==0){
			continue;
		}

		var requirement=0;

		for(var pickup of pickups[chapter]){

			if(Array.isArray(pickup)){
				pickup=pickup[align];
			}

			for(var check of mappings){
				if(check[0]==pickup){
					requirement=requirement | getRuneNumber(check[1]);
				}
			}
		}

		if(requirement==0){
			continue;
		}

		var gate=buildRuneGate(requirement);

		if(!gateScripts[chapter]){
			continue;
		}

		modifyScript(iso, gateScripts[chapter], (s)=>{
			s.prepend(gate);
		});
	}
}

function copyAlexItemsToPiousFight(iso){
	var alex=iso.getFile("Level00.bin").asParsed();
	var pious=iso.getFile("Level13.bin").asParsed();

	for(var i in alex.entries[1].entries){
		if(!alex.entries[1].entries[i] || (pious.entries[1].entries[i] && pious.entries[2].entries[i])){
			continue;
		}
		
		if(alex.entries[2].entries[i]){
			pious.entries[2].entries[i]=alex.entries[2].entries[i];
		}
		pious.entries[1].entries[i]=alex.entries[1].entries[i];
	}

	//iso.getFile("Level13.bin").replace(pious);
}

function removeSpellGates(iso, log){

	var randomAlignment=Math.floor(Math.random()*3)+1;

	var alignmentNames=[null, "Chattur'gha", "Ulyaoth", "Xel'lotath"];

	log.addType("forced_alignment", (d)=>{ return `Forced Alignment: ${d.name}`;});

	log.addLine({"name":alignmentNames[randomAlignment], alignment: randomAlignment}, "General", "forced_alignment");

	modifyScript(iso, 1920, (s)=> {s.prepend([["GETGLOBAL", "ed15"], ["PUSHINT", 1], ["PUSHINT", randomAlignment], ["CALL", 0, 0]]);});//Randomly assign an alignment at the beginning of the game

	claimArtifact=findScript(iso, 655);
	claimArtifact.instructions[0x8d]=claimArtifact.buildInstruction("PUSHINT", randomAlignment);
	replaceScript(iso, 655, claimArtifact);


	//remove sanity drain on chapter end
	modifyScript(iso, 1892, (s)=>{
		s.instructions[0x2f]=s.buildInstruction("PUSHINT", 125);
	});

	addPeterRuneGate(iso, log);

	//enable casting for ellia and pious
	iso.dol.write2(0x8011192e, 0x1);
	iso.dol.write2(0x80111936, 0x1);
	iso.dol.write2(0x80006a86, 0xfe);
	iso.dol.write2(0x80006a8e, 0xfe);

	//Unset a flag right before lindsey's damage field creation, prevents the field from being created
	modifyScript(iso, 1621, (s)=> {s.prepend([["GETGLOBAL", "fn29"], ["PUSHINT", bitAddressToFlag(0x80725E63, 5)], ["PUSHINT", 0], ["CALL", 0, 0]]);});

	//Same for mantorok barrier
	modifyScript(iso, 2029, (s)=> {s.prepend([["GETGLOBAL", "fn29"], ["PUSHINT", bitAddressToFlag(0x80725E5F, 2)], ["PUSHINT", 0], ["CALL", 0, 0]]);});

	//Open lindsey's door when examining the cracked wall
	var mantorokDoor=findScript(iso, 1635);
	replaceScript(iso, 2541, mantorokDoor);
	//remove lindsey mantorok door
	//var lindseyNpcs=new NPC(iso.getFile("Npcs5.npc"));
	//lindseyNpcs.entries[1].splice(65, 1);//Delete mantorok npc
	//iso.getFile("Npcs5.npc").replace(lindseyNpcs);

	modifyScript(iso, 788, (s)=>{s.prepend([["GETGLOBAL", "fn73"], ["PUSHINT", 1098], ["CALL", 0, 0]]);});//run the window dispel script at the top of the paul page examine script

	clockExamine=findScript(iso, 1551);
	replaceScript(iso, 2440, clockExamine);//Replace the clock door script with the clock examine script

	//When the examine prompt for roberto's key shows, disable the wall
	modifyScript(iso, 2453, (s)=> {s.prepend([["GETGLOBAL", "fn29"], ["PUSHINT", bitAddressToFlag(0x80725E8E, 2)], ["PUSHINT", 0], ["CALL", 0, 0]]);});

	//The smasher cutscene no longer disables the ladder
	robertoSmash=findScript(iso, 1385);
	robertoSmash.instructions[0x14d]=robertoSmash.buildInstruction("PUSHINT", 0);
	replaceScript(iso, 1385, robertoSmash);

	//remove michael trapper block
	var michaelNpcs=new NPC(iso.getFile("Npcs11.npc"));
	michaelNpcs.entries[1].splice(33, 1);//Delete obelisk npc
	iso.getFile("Npcs11.npc").replace(michaelNpcs);

	//Remove the enchantment requirement on michael's bomb
	var michaelBomb=findScript(iso, 1883);
	michaelBomb.instructions[0xc]=michaelBomb.buildInstruction("POP", 2);
	michaelBomb.instructions[0x3d]=michaelBomb.buildInstruction("POP", 2);
	replaceScript(iso, 1883, michaelBomb);

	//remove the weapon lock for alex
	var alexNpc=new NPC(iso.getFile("Npcs0.npc"));
	alexNpc.entries[1].splice(30, 4);
	iso.getFile("Npcs0.npc").replace(alexNpc);

	//remove the weapon lock for karim
	var karimNpc=new NPC(iso.getFile("Npcs4.npc"));
	karimNpc.entries[1].splice(28, 3);
	iso.getFile("Npcs4.npc").replace(karimNpc);

	//Disable michael bind barrier when entering the room
	modifyScript(iso, 526, (s)=> {s.prepend([["GETGLOBAL", "fn29"], ["PUSHINT", bitAddressToFlag(0x80725E71, 7)], ["PUSHINT", 0], ["CALL", 0, 0]]);});

	fixRuneSpireCrashes(iso);

	addChapterEndRuneGates(iso, log);

	copyAlexItemsToPiousFight(iso);

	modifyScript(iso, 1920, (s)=> {s.addFlagSet([[0x80725E79, 6], //Pious Health Tutorial
												[0x80725E7E, 5], //Ellia Sanity Tutorial
												[0x80725E7E, 4], //Always show sanity bar
												[0x80725E46, 0], [0x80725E47, 7], //Anthony urns
												[0x80725E28, 3], //Prevent spell tutorial softlock
												[0x80725E6D, 7], //Always show magic meter
												[0x80725E6C, 1], //Activates Mix on the inventory
												[0x80725E6C, 2], //Activates Mix tutorial
												//Karim:
												//[0x80725E31, 0], //Unlocks Santak barrier
												//[0x80725E33, 0], //Activates ladder b-promt of the santak barrier
												//[0x80725E47, 4], //Unlocks Narokath barrier and gives ladder b-prompt
												[0x80725E4C, 3], //Enchanted Ram Dao door examine
												//Max:
												[0x80725E6F, 3], //Basement door revealed
												//[0x80725E9B, 3], //Unlock Bankorok barrier

												//Lindsey:
											//	[0x80725E52, 7], //Unlocks Aretak barrier (bit [7] might be important too)
											//	[0x80725E51, 0], //Unlocks Tier barrier (bit [4] might be important too)
												//[0x80725E45, 0], //
												//[0x80725E46, 7], //these control the silver statue examine, I assume if you activate the necklace one then you'll only need the silver bracelet to open the gate. This might be important because idk if there is a flag for the necklace damage field
												[0x80725E53, 7], //Mantorok Rune examine (might work even with the wall collision)
												[0x80725E2A, 1], //
												[0x80725E2A, 2], //
												[0x80725E28, 6], //I think these control the 3 mantorok barriers, no idea if there's a collision flag for the Trapper wall tho

												//Paul:
												[0x80725E41, 2], //"Heresy Revealed" seen, it activates agustine opening the door cutscene
												//[0x80725E46 , 5], //Unlocks binding hall door

												//Roberto:
												[0x80725E5C, 0],//Skips gatekeeper cutscene due to crashes
												[0x80725E3D, 3],//Skips smasher cutscene
												//[0x80725E2C, 6], //smasher ladder b-prompt (to avoid summon zombie)
												//[0x80725E8E, 2], //removes invisible wall in order to get the key

												//Peter
												[0x80725E50, 1], //Unlocks Coal room, despite the dead body still being there (to avoid Summon trapper)
												[0x80725E6F, 4], //Secret door revealed
												//[0x80725E2C, 7], //is related to defeating Black Guardian. No idea what to do about BG, I don't think there's a flag for the stained glass collision, and that would still softlock in chattur'gha because of the stronger force field
												//We could either restrict Peter with logic to always be after having magick attack, or just set the BG to be dead since the start of the chapter (I think it's ID is 145 at the start)
												//Edward:
												[0x80725E4C, 4], //Unlocks basement door. I think this doesn't break anything, you still need to defeat all Vampire phases in order to enter Ehn'gha

												//Michael:
												[0x80725E51, 1], //Reveals Forgotten Corridor Door
												[0x80725E50, 2], //Activates the b-prompt of the ladder behind the obelisk, but the collision is still there so is inaccessible anyways.
												[0x80725EA0, 5], //Skip bind intro
												[0x80725E25, 0], //Skip bind destroy
												//[0x80725E61, 7], //Activates escape sequence. This could be set to avoid logic for Summon Trapper (obelisk collision), with this flag set you'll enter the escape sequence when coming back from the worm bridge room

												//Alex:
												[0x80725E49, 3], //"beating Anthony", it unlocks the spell page for Alex
												[0x80725E60, 6], //Unlocks 2nd floor room, avoids enchant
												[0x80725E51, 2], //Unlocks the kitchen gladius lock, avoids enchant
												[0x80725E68, 7], //Reveals the dresser
												//[0x80725E7B, 3], //Changes the stained glass examine, but I think Paul page examine is still somehow tied to the dispel cutscene because the b-prompt is still not there and this is the only flag that changes during this
												[0x80725E49, 7], //"beating Paul", allows to play the piano
												//[0x80725E48, 0], //"beating Roberto", allows to survey the picture on the tome room
												[0x80725E4E, 7], //Unlocks basement door
												[0x80725E68, 3], //Bathroom lights on
												[0x80725E48, 1], //"beating Edward", allows grabbing the pickaxe
												[0x80725EA1, 1], //Allows grabbing the stethoscope even with an active damage field
												[0x80725E8E, 6], //Gives Enchanted Gladius on the Parcel
												]);});

	//unlocks extra jump to game options
	iso.dol.write2(0x8001f016, 0x18);

	mergeScriptArchives(iso);
}

