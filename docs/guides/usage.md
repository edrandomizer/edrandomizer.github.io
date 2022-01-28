# Usage
## Manual Mode

Open the randomizer and before loading an image press f12 to open the debug tools. Go to the console tab and type `manualMode=true`. Then load your image and wait until it says ready.  Your image will be accessible in the console under the name "iso". No randomization or other changes will be applied. 

## Download

The download function allows you to export things to your hard drive. When you're done modifying your image you should use `download(iso, 'myedmod.iso')` to export a copy. Most things (files,  scripts, archive entries etc) can be downloaded but be aware that this function often takes some time to run. 

## Files

Files can be accessed via `iso.getFile('ai/ed_chars.dat')`. They support read/2/4 and write/2/4 methods for manual editing but usually you'll want to use one of the provided file formats. 
If you use one of the file formats and make changes to it you must use the replace method on the file for your changes to take effect.

For instance to open Pious's npcs and overwrite the first 4 bytes with F's:
```javascript
piousNPC=iso.getFile("Npcs1.npc");
piousNPC.write4(0, 0xFFFFFFFF);
```
Opening Pious's scripts as a GPK file, deleting script 1234 and saving the changes:
```javascript
piousScripts=new GPK(iso.getFile("ScrLvl01.gpk"));
piousScripts.entries[1234]=null;
iso.getFile("ScrLvl01.gpk").replace(piousScripts);
```

## Compression

Many files are compressed using SK_ASC compression. They can be decompressed with the decompressSKASC function. If you wish to make changes to a compressed file you must replace it with a decompressed version and bypass the compression as shown below. Note that this process may fail if the randomizer is being accessed locally.

```javascript
alex=new GPK(decompressSKASC(iso.getFile("Level00.bin"))); // Decompress and read alex's level as a GPK file

iso.getFile("Level00.bin").replace(alex); //Replace the level with the decompressed version, this will crash the loading screen if you don't use the lines below

prepare(iso); //Prepare the iso for code injection, must be done before bypassing the compression
bypassCompression(iso);

```

## Further Reading

[GPK files](gpk.md)
[Scripts](scripts.md)
