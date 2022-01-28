#GPK files

GPK files are an archive format using integer keys. They come in two types, single and double layer, with 1 and 2 keys respectively. Scripts are stored as single layer, text as double layer.

## Creating

```javascript
new GPK(iso.getFile("ScrLvl01.gpk"));//Create a GPK from a file
new GPK(); //Create an empty GPK
```

## Accessing entries

```javascript
download(gpk.entries[0], "first.entry"); //download the first entry of a single layer GPK
download(gpk.entries[0][0], "first.entry"); //download the first entry of a double layer GPK

gpk.entries[0]=gpk.entries[16]; //Copy entry 16 into entry 0
gpk.entries[0]=null; //Delete entry 0

```
