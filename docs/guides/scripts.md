# Scripts

Scripts are stored as single layer [GPK files](gpk.md) so you may wish to read that first. Each level has it's own script archive and often the same script will appear in multiple levels. To save the trouble of having to find the right level and replace it in every archive it appears in, the findScript and replaceScript functions are provided.

```javascript
credits=findScript(iso, 2527); //get the credits script
replaceScript(iso, 1920, credits);//replace the opening script with the credits script

replaceScript(iso, 2527, null); //delete the credits script
```

## LUA objects

findScript returns a LUA object. LUA objects contain a list of instructions, which are just 32bit integers of compiled lua instructions. The parseInstruction and buildInstruction methods are provided to work with them. You must use the methods of the lua object you are working with or strings and floating point numbers will break.

```javascript
credits=findScript(iso, 2527);

credits.parseInstruction(credits.instruction[0]); //output the first instruction in the credits script
credits.instruction[0]=credits.buildInstruction("PUSHINT", 16); //Replace the first instruction with PUSHINT 16
```

## Flags

The numbering system used by flags goes left to right in 4 byte chunks and right to left within those chunks. The bitAddressToFlag method is provided to convert from DME addresses. Note that the second argument runs from 0-7 rather than 1-8 like DME does. The addFlagSetToScript method is provided to easily add a block of flag sets to the start of scripts.

```javascript
flag=bitAddressToFlag(0x80725E6C, 1); //The flag to activate mix in the inventory

addFlagSetToScript(iso, 1920, [[0x80725E6C, 1], [0x80725E46, 0]]); //Activate mix and place anthony's blue urn right after the rats cutscene
```

## Modding scripts

Scripts can be modded by simply manually altering their instructions. You can use the prependToScript function to add a block of instructions to the beginning of a script.

```javascript
chatRune=findScript(iso, 1360); //script which grants the chatturga rune

chatRune.parseInstruction(chatRune.instructions[5]); //Gives "PUSHINT 1", the instruction that controls which rune you get
chatRune.instructions[5]=chatRune.buildInstruction("PUSHINT", 8); //Gives the mantarok rune instead

replaceScript(iso, 1360, chatRune); //Save the changes

prependToScript(iso, 1920, [["GETGLOBAL", "ed10"], ["PUSHINT", 8], ["CALL", 0, 0]]); //Give the mantarok rune at the start of the rats script
```

## Searching scripts

You can get a list of all the scripts via getAllScripts(iso) suitable for searching, or you can use searchScripts to search for a series of instructions.

```javascript
getAllScripts(iso); //get a list of every script

searchScripts(iso, ["GETGLOBAL ed10", "PUSHINT 8"]); //the script numbers of all scripts which award the mantarok rune
searchScripts(iso, ["GETGLOBAL fn30", "PUSHINT "+bitAddressToFlag(0x80725E46, 0)]); //Scripts which check anthony's blue urn flag
searchScripts(iso, ["GETGLOBAL fn29", "PUSHINT "+bitAddressToFlag(0x80725E46, 0)]); //Scripts which set anthony's blue urn flag
```
