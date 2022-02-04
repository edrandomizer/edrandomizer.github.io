

function shuffle(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
}

function randomizeEnemies(iso, noTrapperList=[], skipList=[]){

	preventEnemyRandomizationSoftlocks(iso);

	var pious=new NPC(iso.fst.getFile("Npcs1.npc"));
	var lindsey=new NPC(iso.fst.getFile("Npcs6.npc"));
	var karim=new NPC(iso.fst.getFile("Npcs4.npc"));

	const buildTemplateFromStatic = (e)=> {
		return [new Uint8Array(e.slice(0x18, 0x18+0x4)), new Uint8Array(e.slice(0x20, 0x20+0x2))];
	};

	const buildTemplateFromDynamic = (e, i)=> {
		return [new Uint8Array(e.slice(0x18+i*6, 0x18+i*6+4)), new Uint8Array(e.slice(0x1c+i*6, 0x1c+i*6+2))];
	};

	var templates=[
		buildTemplateFromStatic(pious.entries[0][0]),//m zombie,
		buildTemplateFromStatic(lindsey.entries[0][0xe]), //x zombie
		buildTemplateFromStatic(lindsey.entries[0][0x13]),//u zombie
		buildTemplateFromStatic(lindsey.entries[0][9]),//c zombie
		buildTemplateFromDynamic(karim.entries[3][0], 0),//x horror
		buildTemplateFromDynamic(karim.entries[3][0], 2),//u horror
		buildTemplateFromDynamic(karim.entries[3][0], 1),//c horror
		buildTemplateFromDynamic(lindsey.entries[3][15], 2),//x trapper
		buildTemplateFromDynamic(lindsey.entries[3][15], 1),//u trapper
		buildTemplateFromDynamic(lindsey.entries[3][15], 0),//c trapper
	];

	const runeSafe=7;

	var candidates=[];
	for(var temp of templates){
		candidates.push(new DataView(temp[0].buffer).getUint16(0, false));
	}

	candidates=candidates.slice(0, 7);//Workaround for trapper based crashes

	var i=0;
	while(i<14){
		if(i==12){
			i++;
			continue;
		}
		var file=iso.fst.getFile("Npcs"+i+".npc");

		var npcs=new NPC(file);

		var c=npcs.entries[0].length;

		var j=0;
		while(j<c){
			var type=new DataView(npcs.entries[0][j]).getUint16(0x18, false);

			if(candidates.indexOf(type)!==-1 && (!skipList[i] || !skipList[i][0] || skipList[i][0].indexOf(j)===-1) ){
				var b=new Uint8Array(npcs.entries[0][j]);
				var maxIndex=templates.length;

				var script=new DataView(npcs.entries[0][j]).getUint16(0x1c, false);

				if(script!=0xFFFF || (noTrapperList[i] && noTrapperList[i][0] && noTrapperList[i][0].indexOf(j)!==-1)){
					maxIndex=runeSafe;
				}
				var rand=Math.floor(Math.random()*maxIndex);
				b.set(templates[rand][0], 0x18);
				b.set(templates[rand][1], 0x20);
			}
			j++;
		}

		c=npcs.entries[3].length;

		j=0;
		while(j<c){

			var type=new DataView(npcs.entries[3][j]).getUint16(0x18, false);
			if(candidates.indexOf(type)!==-1 && (!skipList[i] || !skipList[i][3] || skipList[i][3].indexOf(j)===-1) ){
				var b=new Uint8Array(npcs.entries[3][j]);
				var maxIndex=templates.length;

				var script=new DataView(npcs.entries[3][j]).getUint16(0x2a, false);

				if(script!=0xFFFF || (noTrapperList[i] && noTrapperList[i][3] && noTrapperList[i][3].indexOf(j)!==-1)){
					maxIndex=runeSafe;
				}

				var rand=Math.floor(Math.random()*maxIndex);
				b.set(templates[rand][0], 0x18);
				b.set(templates[rand][1], 0x1c);
				rand=Math.floor(Math.random()*maxIndex);
				b.set(templates[rand][0], 0x1e);
				b.set(templates[rand][1], 0x22);
				rand=Math.floor(Math.random()*maxIndex);
				b.set(templates[rand][0], 0x24);
				b.set(templates[rand][1], 0x28);
			}

			j++;
		}

		file.replace(npcs.toBuffer());

		i++;
	}
}

function preventEnemyRandomizationSoftlocks(iso){
	modifyScript(iso, 1920, (s)=>{s.addFlagSet([[0x80725E70, 2]]);});
}

function roomTextShuffle(iso){

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

		}
	}
	for(var file in cmps){
		cmps[file].replace(newGpks[file].toBuffer());
	}

}

function randomizeRunes(iso){

	var runeScripts=[[1367, 0, 0], //128
					 [1363, 24, 5], //8
					 [1360, 4, 0], //1
					 [1361, 4, 0], //2
					 [1362, 4, 0], //4
					 [1366, 0, 0], //64
					 [1372, 0, 0], //4096
					 [1371, 0, 0], //2048
					 [1364, 0, 0], //16
					 [1369, 0, 0], //512
					 [1373, 0, 0], //8192
					 [1365, 0, 0], //32
					 [1370, 0, 0], //1024
					 [1368, 0, 0],//256
					 [2129, 0xe3, 5],//65536
					 [1375, 0, 0], //131072
					 [[1376, 0, 0], [2692, 0xb8, 1]], //262144, I think the first is unsed but it's here for completeness
					 ];



	var rand=[];

	//runes
	for(var i=0; i<14; i++){
		rand.push([0, 1<<i]);
	}
	for(var i=16; i<20; i++){
		rand.push([0, 1<<i]);
	}

	var scrollModels=[];

	//scrolls
	for(var i=32; i<45; i++){
		if(i==38){
			continue;
		}

		rand.push([1, i]);
		scrollModels.push(i);
	}

	var codexModels=[];

	//codices
	for(var i=242; i<256; i++){
		rand.push([2, i]);
		codexModels.push(i);
	}

	shuffle(rand);

	var i=0;
	for(var scripts of runeScripts){
		var roll=rand[i++];
		if(!Array.isArray(scripts[0])){
			scripts=[scripts];
		}

		for(var script of scripts){

			if(roll[0]===0){
				modifyScript(iso, script[0], (s)=> {
					s.instructions[script[1]+1]=s.buildInstruction("PUSHINT", roll[1]);
				});
			}else if(roll[0]===1){
				modifyScript(iso, script[0], (s)=>{
					s.addJmpPatch(script[1], [script[1]+3], [
						["GETGLOBAL", "ed73"],
						["PUSHINT", roll[1]],
						["PUSHINT", 65536],
						["CALL", script[2], 0]
					]);
				});
			}else if(roll[0]===2){
				modifyScript(iso, script[0], (s)=>{
					s.instructions[script[1]]=s.buildInstruction("GETGLOBAL", "ed72");
					s.instructions[script[1]+1]=s.buildInstruction("PUSHINT", roll[1]);
				});
			}else{
				throw "Bad reward type";
			}
		}
	}
	var code=[];

	const addRollCode=(code, model, roll)=>{
		code.push(["GETLOCAL", 1]);
		code.push(["PUSHINT", model]);
		code.push(["JMPNE", roll[0]==1 ? 5 : 4]);

		if(roll[0]===0){
			code.push(["GETGLOBAL", "ed10"]);
			code.push(["PUSHINT", roll[1]]);
			code.push(["CALL", 2, 0]);
			code.push("REJOIN");
		}else if(roll[0]===1){
			code.push(["GETGLOBAL", "ed73"]);
			code.push(["PUSHINT", roll[1]]);
			code.push(["PUSHINT", 65536]);
			code.push(["CALL", 2, 0]);
			code.push("REJOIN");
		}else if(roll[0]===2){
			code.push(["GETGLOBAL", "ed72"]);
			code.push(["PUSHINT", roll[1]]);
			code.push(["CALL", 2, 0]);
			code.push("REJOIN");
		}else{
			throw "Bad reward type";
		}
	};

	for(var model of codexModels){
		addRollCode(code, model, rand[i++]);
	}

	modifyScript(iso, 1985, (s)=>{
		s.addJmpPatch(6, 9, code);
	});

	code=[];

	for(var model of scrollModels){
		addRollCode(code, model, rand[i++]);
	}

	modifyScript(iso, 2022, (s)=>{
		s.addJmpPatch(6, 10, code);
	});
}

function fixRuneSpireCrashes(iso){

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


function removeSpellGates(iso){

	//Unset a flag right before lindsey's damage field creation, prevents the field from being created
	modifyScript(iso, 1621, (s)=> {s.prepend([["GETGLOBAL", "fn29"], ["PUSHINT", bitAddressToFlag(0x80725E63, 5)], ["PUSHINT", 0], ["CALL", 0, 0]]);});

	modifyScript(iso, 788, (s)=>{s.prepend([["GETGLOBAL", "fn73"], ["PUSHINT", 1098], ["CALL", 0, 0]]);});//run the window dispel script at the top of the paul page examine script

	var randomAlignment=Math.floor(Math.random()*3)+1;

	modifyScript(iso, 1920, (s)=> {s.prepend([["GETGLOBAL", "ed15"], ["PUSHINT", 1], ["PUSHINT", randomAlignment], ["CALL", 0, 0]]);});//Randomly assign an alignment at the beginning of the game

	claimArtifact=findScript(iso, 655);
	claimArtifact.instructions[0x8d]=claimArtifact.buildInstruction("PUSHINT", randomAlignment);
	replaceScript(iso, 655, claimArtifact);

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

	//Disable michael bind barrier when entering the room
	modifyScript(iso, 526, (s)=> {s.prepend([["GETGLOBAL", "fn29"], ["PUSHINT", bitAddressToFlag(0x80725E71, 7)], ["PUSHINT", 0], ["CALL", 0, 0]]);});

	fixRuneSpireCrashes(iso);

	modifyScript(iso, 1920, (s)=> {s.addFlagSet([[0x80725E79, 6], //Pious Health Tutorial -> it might make health visible during pause menu on other chapters
												[0x80725E7E, 5], //Ellia Sanity Tutorial -> it might make Sanity visible during pause menu on other chapters
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
												//[0x80725E2C, 6], //smasher ladder b-prompt (to avoid summon zombie)
												//[0x80725E8E, 2], //removes invisible wall in order to get the key

												//Peter
												[0x80725E50, 1], //Unlocks Coal room, despite the dead body still being there (to avoid Summon trapper)
												[0x80725E6F, 4], //Secret door revealed
												[0x80725E2C, 7], //is related to defeating Black Guardian. No idea what to do about BG, I don't think there's a flag for the stained glass collision, and that would still softlock in chattur'gha because of the stronger force field
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
												[0x80725E48, 0], //"beating Roberto", allows to survey the picture on the tome room
												[0x80725E4E, 7], //Unlocks basement door
												[0x80725E68, 3], //Bathroom lights on
												[0x80725E48, 1], //"beating Edward", allows grabbing the pickaxe
												[0x80725EA1, 1], //Allows grabbing the stethoscope even with an active damage field
												[0x80725E8E, 6], //Gives Enchanted Gladius on the Parcel
												]);});
}

