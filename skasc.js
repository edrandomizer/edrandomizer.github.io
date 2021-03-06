

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// See https://caniuse.com/mdn-javascript_builtins_object_assign
var objAssign = Object.assign;

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = objAssign({}, Module);

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = (status, toThrow) => {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var read_,
    readAsync,
    readBinary,
    setWindowTitle;

// Normally we don't log exceptions but instead let them bubble out the top
// level where the embedding environment (e.g. the browser) can handle
// them.
// However under v8 and node we sometimes exit the process direcly in which case
// its up to use us to log the exception before exiting.
// If we fix https://github.com/emscripten-core/emscripten/issues/15080
// this may no longer be needed under node.
function logExceptionOnExit(e) {
  if (e instanceof ExitStatus) return;
  let toLog = e;
  if (e && typeof e === 'object' && e.stack) {
    toLog = [e, e.stack];
  }
  err('exiting due to exception: ' + toLog);
}

var fs;
var nodePath;
var requireNodeFS;

if (ENVIRONMENT_IS_NODE) {
  if (!(typeof process === 'object' && typeof require === 'function')) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = require('path').dirname(scriptDirectory) + '/';
  } else {
    scriptDirectory = __dirname + '/';
  }

// include: node_shell_read.js


requireNodeFS = function() {
  // Use nodePath as the indicator for these not being initialized,
  // since in some environments a global fs may have already been
  // created.
  if (!nodePath) {
    fs = require('fs');
    nodePath = require('path');
  }
}

read_ = function shell_read(filename, binary) {
  var ret = tryParseAsDataURI(filename);
  if (ret) {
    return binary ? ret : ret.toString();
  }
  requireNodeFS();
  filename = nodePath['normalize'](filename);
  return fs.readFileSync(filename, binary ? null : 'utf8');
};

readBinary = function readBinary(filename) {
  var ret = read_(filename, true);
  if (!ret.buffer) {
    ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
};

readAsync = function readAsync(filename, onload, onerror) {
  var ret = tryParseAsDataURI(filename);
  if (ret) {
    onload(ret);
  }
  requireNodeFS();
  filename = nodePath['normalize'](filename);
  fs.readFile(filename, function(err, data) {
    if (err) onerror(err);
    else onload(data.buffer);
  });
};

// end include: node_shell_read.js
  if (process['argv'].length > 1) {
    thisProgram = process['argv'][1].replace(/\\/g, '/');
  }

  arguments_ = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  // Without this older versions of node (< v15) will log unhandled rejections
  // but return 0, which is not normally the desired behaviour.  This is
  // not be needed with node v15 and about because it is now the default
  // behaviour:
  // See https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode
  process['on']('unhandledRejection', function(reason) { throw reason; });

  quit_ = (status, toThrow) => {
    if (keepRuntimeAlive()) {
      process['exitCode'] = status;
      throw toThrow;
    }
    logExceptionOnExit(toThrow);
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };

} else
if (ENVIRONMENT_IS_SHELL) {

  if ((typeof process === 'object' && typeof require === 'function') || typeof window === 'object' || typeof importScripts === 'function') throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  if (typeof read != 'undefined') {
    read_ = function shell_read(f) {
      const data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  readBinary = function readBinary(f) {
    let data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  readAsync = function readAsync(f, onload, onerror) {
    setTimeout(() => onload(readBinary(f)), 0);
  };

  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }

  if (typeof quit === 'function') {
    quit_ = (status, toThrow) => {
      logExceptionOnExit(toThrow);
      quit(status);
    };
  }

  if (typeof print !== 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    if (typeof console === 'undefined') console = /** @type{!Console} */({});
    console.log = /** @type{!function(this:Console, ...*): undefined} */ (print);
    console.warn = console.error = /** @type{!function(this:Console, ...*): undefined} */ (typeof printErr !== 'undefined' ? printErr : print);
  }

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (typeof document !== 'undefined' && document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  // If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
  // they are removed because they could contain a slash.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }

  if (!(typeof window === 'object' || typeof importScripts === 'function')) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  // Differentiate the Web Worker from the Node Worker case, as reading must
  // be done differently.
  {
// include: web_or_worker_shell_read.js


  read_ = function(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    } catch (err) {
      var data = tryParseAsDataURI(url);
      if (data) {
        return intArrayToString(data);
      }
      throw err;
    }
  };

  if (ENVIRONMENT_IS_WORKER) {
    readBinary = function(url) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response));
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return data;
        }
        throw err;
      }
    };
  }

  readAsync = function(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      var data = tryParseAsDataURI(url);
      if (data) {
        onload(data.buffer);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

// end include: web_or_worker_shell_read.js
  }

  setWindowTitle = (title) => document.title = title;
} else
{
  throw new Error('environment detection error');
}

var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.warn.bind(console);

// Merge back in the overrides
objAssign(Module, moduleOverrides);
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.

if (Module['arguments']) arguments_ = Module['arguments'];
if (!Object.getOwnPropertyDescriptor(Module, 'arguments')) {
  Object.defineProperty(Module, 'arguments', {
    configurable: true,
    get: function() {
      abort('Module.arguments has been replaced with plain arguments_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (Module['thisProgram']) thisProgram = Module['thisProgram'];
if (!Object.getOwnPropertyDescriptor(Module, 'thisProgram')) {
  Object.defineProperty(Module, 'thisProgram', {
    configurable: true,
    get: function() {
      abort('Module.thisProgram has been replaced with plain thisProgram (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (Module['quit']) quit_ = Module['quit'];
if (!Object.getOwnPropertyDescriptor(Module, 'quit')) {
  Object.defineProperty(Module, 'quit', {
    configurable: true,
    get: function() {
      abort('Module.quit has been replaced with plain quit_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(typeof Module['memoryInitializerPrefixURL'] === 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] === 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] === 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] === 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['read'] === 'undefined', 'Module.read option was removed (modify read_ in JS)');
assert(typeof Module['readAsync'] === 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
assert(typeof Module['readBinary'] === 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
assert(typeof Module['setWindowTitle'] === 'undefined', 'Module.setWindowTitle option was removed (modify setWindowTitle in JS)');
assert(typeof Module['TOTAL_MEMORY'] === 'undefined', 'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY');

if (!Object.getOwnPropertyDescriptor(Module, 'read')) {
  Object.defineProperty(Module, 'read', {
    configurable: true,
    get: function() {
      abort('Module.read has been replaced with plain read_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (!Object.getOwnPropertyDescriptor(Module, 'readAsync')) {
  Object.defineProperty(Module, 'readAsync', {
    configurable: true,
    get: function() {
      abort('Module.readAsync has been replaced with plain readAsync (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (!Object.getOwnPropertyDescriptor(Module, 'readBinary')) {
  Object.defineProperty(Module, 'readBinary', {
    configurable: true,
    get: function() {
      abort('Module.readBinary has been replaced with plain readBinary (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

if (!Object.getOwnPropertyDescriptor(Module, 'setWindowTitle')) {
  Object.defineProperty(Module, 'setWindowTitle', {
    configurable: true,
    get: function() {
      abort('Module.setWindowTitle has been replaced with plain setWindowTitle (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}
var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';
function alignMemory() { abort('`alignMemory` is now a library function and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line'); }

assert(!ENVIRONMENT_IS_SHELL, "shell environment detected but not enabled at build time.  Add 'shell' to `-s ENVIRONMENT` to enable.");




var STACK_ALIGN = 16;
var POINTER_SIZE = 4;

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length - 1] === '*') {
        return POINTER_SIZE;
      } else if (type[0] === 'i') {
        const bits = Number(type.substr(1));
        assert(bits % 8 === 0, 'getNativeTypeSize invalid bits ' + bits + ', type ' + type);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

// include: runtime_functions.js


// Wraps a JS function as a wasm function with a given signature.
function convertJsFunctionToWasm(func, sig) {
  return func;
}

var freeTableIndexes = [];

// Weak map of functions in the table to their indexes, created on first use.
var functionsInTableMap;

function getEmptyTableSlot() {
  // Reuse a free index if there is one, otherwise grow.
  if (freeTableIndexes.length) {
    return freeTableIndexes.pop();
  }
  // Grow the table
  try {
    wasmTable.grow(1);
  } catch (err) {
    if (!(err instanceof RangeError)) {
      throw err;
    }
    throw 'Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.';
  }
  return wasmTable.length - 1;
}

function updateTableMap(offset, count) {
  for (var i = offset; i < offset + count; i++) {
    var item = getWasmTableEntry(i);
    // Ignore null values.
    if (item) {
      functionsInTableMap.set(item, i);
    }
  }
}

// Add a function to the table.
// 'sig' parameter is required if the function being added is a JS function.
function addFunction(func, sig) {
  assert(typeof func !== 'undefined');

  // Check if the function is already in the table, to ensure each function
  // gets a unique index. First, create the map if this is the first use.
  if (!functionsInTableMap) {
    functionsInTableMap = new WeakMap();
    updateTableMap(0, wasmTable.length);
  }
  if (functionsInTableMap.has(func)) {
    return functionsInTableMap.get(func);
  }

  // It's not in the table, add it now.

  var ret = getEmptyTableSlot();

  // Set the new value.
  try {
    // Attempting to call this with JS function will cause of table.set() to fail
    setWasmTableEntry(ret, func);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    assert(typeof sig !== 'undefined', 'Missing signature argument to addFunction: ' + func);
    var wrapped = convertJsFunctionToWasm(func, sig);
    setWasmTableEntry(ret, wrapped);
  }

  functionsInTableMap.set(func, ret);

  return ret;
}

function removeFunction(index) {
  functionsInTableMap.delete(getWasmTableEntry(index));
  freeTableIndexes.push(index);
}

// end include: runtime_functions.js
// include: runtime_debug.js


// end include: runtime_debug.js
var tempRet0 = 0;

var setTempRet0 = function(value) {
  tempRet0 = value;
};

var getTempRet0 = function() {
  return tempRet0;
};



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var wasmBinary;
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
if (!Object.getOwnPropertyDescriptor(Module, 'wasmBinary')) {
  Object.defineProperty(Module, 'wasmBinary', {
    configurable: true,
    get: function() {
      abort('Module.wasmBinary has been replaced with plain wasmBinary (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}
var noExitRuntime = Module['noExitRuntime'] || true;
if (!Object.getOwnPropertyDescriptor(Module, 'noExitRuntime')) {
  Object.defineProperty(Module, 'noExitRuntime', {
    configurable: true,
    get: function() {
      abort('Module.noExitRuntime has been replaced with plain noExitRuntime (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

// include: wasm2js.js


// wasm2js.js - enough of a polyfill for the WebAssembly object so that we can load
// wasm2js code that way.

// Emit "var WebAssembly" if definitely using wasm2js. Otherwise, in MAYBE_WASM2JS
// mode, we can't use a "var" since it would prevent normal wasm from working.
/** @suppress{duplicate, const} */
var
WebAssembly = {
  // Note that we do not use closure quoting (this['buffer'], etc.) on these
  // functions, as they are just meant for internal use. In other words, this is
  // not a fully general polyfill.
  Memory: function(opts) {
    this.buffer = new ArrayBuffer(opts['initial'] * 65536);
  },

  Module: function(binary) {
    // TODO: use the binary and info somehow - right now the wasm2js output is embedded in
    // the main JS
  },

  Instance: function(module, info) {
    // TODO: use the module and info somehow - right now the wasm2js output is embedded in
    // the main JS
    // This will be replaced by the actual wasm2js code.
    this.exports = (
function instantiate(asmLibraryArg) {
function Table(ret) {
  // grow method not included; table is not growable
  ret.set = function(i, func) {
    this[i] = func;
  };
  ret.get = function(i) {
    return this[i];
  };
  return ret;
}

  var bufferView;
  var base64ReverseLookup = new Uint8Array(123/*'z'+1*/);
  for (var i = 25; i >= 0; --i) {
    base64ReverseLookup[48+i] = 52+i; // '0-9'
    base64ReverseLookup[65+i] = i; // 'A-Z'
    base64ReverseLookup[97+i] = 26+i; // 'a-z'
  }
  base64ReverseLookup[43] = 62; // '+'
  base64ReverseLookup[47] = 63; // '/'
  /** @noinline Inlining this function would mean expanding the base64 string 4x times in the source code, which Closure seems to be happy to do. */
  function base64DecodeToExistingUint8Array(uint8Array, offset, b64) {
    var b1, b2, i = 0, j = offset, bLength = b64.length, end = offset + (bLength*3>>2) - (b64[bLength-2] == '=') - (b64[bLength-1] == '=');
    for (; i < bLength; i += 4) {
      b1 = base64ReverseLookup[b64.charCodeAt(i+1)];
      b2 = base64ReverseLookup[b64.charCodeAt(i+2)];
      uint8Array[j++] = base64ReverseLookup[b64.charCodeAt(i)] << 2 | b1 >> 4;
      if (j < end) uint8Array[j++] = b1 << 4 | b2 >> 2;
      if (j < end) uint8Array[j++] = b2 << 6 | base64ReverseLookup[b64.charCodeAt(i+3)];
    }
  }
function initActiveSegments(imports) {
  base64DecodeToExistingUint8Array(bufferView, 1024, "BQAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAMAAAC4BAAAAAQAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAP////8KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAALAKUAA=");
  base64DecodeToExistingUint8Array(bufferView, 1184, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
}
function asmFunc(env) {
 var memory = env.memory;
 var buffer = memory.buffer;
 memory.grow = __wasm_memory_grow;
 var HEAP8 = new Int8Array(buffer);
 var HEAP16 = new Int16Array(buffer);
 var HEAP32 = new Int32Array(buffer);
 var HEAPU8 = new Uint8Array(buffer);
 var HEAPU16 = new Uint16Array(buffer);
 var HEAPU32 = new Uint32Array(buffer);
 var HEAPF32 = new Float32Array(buffer);
 var HEAPF64 = new Float64Array(buffer);
 var Math_imul = Math.imul;
 var Math_fround = Math.fround;
 var Math_abs = Math.abs;
 var Math_clz32 = Math.clz32;
 var Math_min = Math.min;
 var Math_max = Math.max;
 var Math_floor = Math.floor;
 var Math_ceil = Math.ceil;
 var Math_trunc = Math.trunc;
 var Math_sqrt = Math.sqrt;
 var abort = env.abort;
 var nan = NaN;
 var infinity = Infinity;
 var fimport$0 = env.exit;
 var fimport$1 = env.fd_write;
 var fimport$2 = env.emscripten_resize_heap;
 var fimport$3 = env.emscripten_memcpy_big;
 var fimport$4 = env.setTempRet0;
 var global$0 = 5245616;
 var global$1 = 0;
 var global$2 = 0;
 var i64toi32_i32$HIGH_BITS = 0;
 // EMSCRIPTEN_START_FUNCS
;
 function $0() {
  $42();
 }
 
 function $1($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $5_1 = 0;
  $5_1 = global$0 - 16 | 0;
  HEAP32[($5_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 4 | 0) >> 2] = $2_1;
  HEAP32[($5_1 + 8 | 0) >> 2] = (HEAP32[($5_1 + 8 | 0) >> 2] | 0) & 268435455 | 0;
  HEAP8[((HEAP32[($5_1 + 12 | 0) >> 2] | 0) + (HEAP32[($5_1 + 8 | 0) >> 2] | 0) | 0) >> 0] = ((HEAP32[($5_1 + 4 | 0) >> 2] | 0) >>> 24 | 0) & 255 | 0;
  HEAP8[((HEAP32[($5_1 + 12 | 0) >> 2] | 0) + ((HEAP32[($5_1 + 8 | 0) >> 2] | 0) + 1 | 0) | 0) >> 0] = ((HEAP32[($5_1 + 4 | 0) >> 2] | 0) >>> 16 | 0) & 255 | 0;
  HEAP8[((HEAP32[($5_1 + 12 | 0) >> 2] | 0) + ((HEAP32[($5_1 + 8 | 0) >> 2] | 0) + 2 | 0) | 0) >> 0] = ((HEAP32[($5_1 + 4 | 0) >> 2] | 0) >>> 8 | 0) & 255 | 0;
  HEAP8[((HEAP32[($5_1 + 12 | 0) >> 2] | 0) + ((HEAP32[($5_1 + 8 | 0) >> 2] | 0) + 3 | 0) | 0) >> 0] = (HEAP32[($5_1 + 4 | 0) >> 2] | 0) & 255 | 0;
  return;
 }
 
 function $2($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $5_1 = 0;
  $5_1 = global$0 - 16 | 0;
  HEAP32[($5_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 8 | 0) >> 2] = $1_1;
  HEAP16[($5_1 + 6 | 0) >> 1] = $2_1;
  HEAP32[($5_1 + 8 | 0) >> 2] = (HEAP32[($5_1 + 8 | 0) >> 2] | 0) & 268435455 | 0;
  HEAP8[((HEAP32[($5_1 + 12 | 0) >> 2] | 0) + (HEAP32[($5_1 + 8 | 0) >> 2] | 0) | 0) >> 0] = (((HEAPU16[($5_1 + 6 | 0) >> 1] | 0) & 65535 | 0) >> 8 | 0) & 255 | 0;
  HEAP8[((HEAP32[($5_1 + 12 | 0) >> 2] | 0) + ((HEAP32[($5_1 + 8 | 0) >> 2] | 0) + 1 | 0) | 0) >> 0] = ((HEAPU16[($5_1 + 6 | 0) >> 1] | 0) & 65535 | 0) & 255 | 0;
  return;
 }
 
 function $3($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $5_1 = 0;
  $5_1 = global$0 - 16 | 0;
  HEAP32[($5_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 8 | 0) >> 2] = $1_1;
  HEAP16[($5_1 + 6 | 0) >> 1] = $2_1;
  HEAP32[($5_1 + 8 | 0) >> 2] = (HEAP32[($5_1 + 8 | 0) >> 2] | 0) & 268435455 | 0;
  HEAP8[((HEAP32[($5_1 + 12 | 0) >> 2] | 0) + (HEAP32[($5_1 + 8 | 0) >> 2] | 0) | 0) >> 0] = ((HEAPU16[($5_1 + 6 | 0) >> 1] | 0) & 65535 | 0) & 255 | 0;
  return;
 }
 
 function $4($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $4_1 = 0;
  $4_1 = global$0 - 16 | 0;
  HEAP32[($4_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 8 | 0) >> 2] = (HEAP32[($4_1 + 8 | 0) >> 2] | 0) & 268435455 | 0;
  return (((HEAPU8[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 0 | 0) | 0) >> 0] | 0) & 255 | 0) << 8 | 0 | ((HEAPU8[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 1 | 0) | 0) >> 0] | 0) & 255 | 0) | 0) & 65535 | 0 | 0;
 }
 
 function $5($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $4_1 = 0;
  $4_1 = global$0 - 16 | 0;
  HEAP32[($4_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 8 | 0) >> 2] = (HEAP32[($4_1 + 8 | 0) >> 2] | 0) & 268435455 | 0;
  HEAP32[($4_1 + 4 | 0) >> 2] = (HEAPU8[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 0 | 0) | 0) >> 0] | 0) & 255 | 0;
  HEAP32[($4_1 + 4 | 0) >> 2] = (HEAP32[($4_1 + 4 | 0) >> 2] | 0) << 8 | 0 | ((HEAPU8[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 1 | 0) | 0) >> 0] | 0) & 255 | 0) | 0;
  HEAP32[($4_1 + 4 | 0) >> 2] = (HEAP32[($4_1 + 4 | 0) >> 2] | 0) << 8 | 0 | ((HEAPU8[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 2 | 0) | 0) >> 0] | 0) & 255 | 0) | 0;
  HEAP32[($4_1 + 4 | 0) >> 2] = (HEAP32[($4_1 + 4 | 0) >> 2] | 0) << 8 | 0 | ((HEAPU8[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 3 | 0) | 0) >> 0] | 0) & 255 | 0) | 0;
  return HEAP32[($4_1 + 4 | 0) >> 2] | 0 | 0;
 }
 
 function $6($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $4_1 = 0;
  $4_1 = global$0 - 16 | 0;
  HEAP32[($4_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 8 | 0) >> 2] = (HEAP32[($4_1 + 8 | 0) >> 2] | 0) & 268435455 | 0;
  return (HEAPU8[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + (HEAP32[($4_1 + 8 | 0) >> 2] | 0) | 0) >> 0] | 0) & 255 | 0 | 0;
 }
 
 function $7($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $5_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $5_1 = global$0 - 32 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 20 | 0) >> 2] = $2_1;
  $1(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0, 4096 | 0);
  label$1 : {
   if (!(($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8208 | 0 | 0) | 0 | 0) < (4096 | 0) & 1 | 0)) {
    break label$1
   }
   $1(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0, $5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8208 | 0 | 0) | 0 | 0);
  }
  label$2 : {
   if (!($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0)) {
    break label$2
   }
   (wasm2js_i32$0 = $5_1, wasm2js_i32$1 = $5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 10960 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 16 | 0) >> 2] = wasm2js_i32$1;
   label$3 : {
    label$4 : {
     if (!((HEAP32[($5_1 + 16 | 0) >> 2] | 0 | 0) == (-2146054584 | 0) & 1 | 0)) {
      break label$4
     }
     (wasm2js_i32$0 = $5_1, wasm2js_i32$1 = $5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 12 | 0) >> 2] = wasm2js_i32$1;
     (wasm2js_i32$0 = $5_1, wasm2js_i32$1 = (($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8204 | 0 | 0) | 0) + 8 | 0) - ($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8208 | 0 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
     $38((HEAP32[($5_1 + 28 | 0) >> 2] | 0) + ((HEAP32[($5_1 + 20 | 0) >> 2] | 0) & 268435455 | 0) | 0 | 0, (HEAP32[($5_1 + 24 | 0) >> 2] | 0) + (HEAP32[($5_1 + 8 | 0) >> 2] | 0) | 0 | 0, HEAP32[($5_1 + 12 | 0) >> 2] | 0 | 0) | 0;
     break label$3;
    }
    fimport$0(1 | 0);
    abort();
   }
   $1(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8208 | 0 | 0, ($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8208 | 0 | 0) | 0) - ($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) | 0 | 0);
  }
  $1(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8196 | 0 | 0, 0 | 0);
  global$0 = $5_1 + 32 | 0;
  return;
 }
 
 function $8($0_1, $1_1, $2_1, $3_1, $4_1, $5_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  $5_1 = $5_1 | 0;
  var $8_1 = 0, $26_1 = 0, $30_1 = 0, $44_1 = 0, $127 = 0, $135 = 0, $150 = 0, $158 = 0, $173 = 0, $181 = 0, $196 = 0, $204 = 0, $219 = 0, $227 = 0, $242 = 0, $250 = 0, $265 = 0, $273 = 0, $295 = 0, $301 = 0, $330 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $8_1 = global$0 - 64 | 0;
  global$0 = $8_1;
  HEAP32[($8_1 + 60 | 0) >> 2] = $0_1;
  HEAP32[($8_1 + 56 | 0) >> 2] = $1_1;
  HEAP32[($8_1 + 52 | 0) >> 2] = $2_1;
  HEAP32[($8_1 + 48 | 0) >> 2] = $3_1;
  HEAP16[($8_1 + 46 | 0) >> 1] = $4_1;
  HEAP32[($8_1 + 40 | 0) >> 2] = $5_1;
  HEAP32[($8_1 + 40 | 0) >> 2] = (HEAP32[($8_1 + 40 | 0) >> 2] | 0) + (HEAP32[($8_1 + 52 | 0) >> 2] | 0) | 0;
  label$1 : {
   label$2 : while (1) {
    if (!(HEAP32[($8_1 + 40 | 0) >> 2] | 0)) {
     break label$1
    }
    $26_1 = 16;
    $30_1 = 16;
    $2(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 56 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 40 | 0) >> 2] | 0) << 1 | 0) | 0 | 0, (((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 56 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 40 | 0) >> 2] | 0) << 1 | 0) | 0 | 0) | 0) << $26_1 | 0) >> $26_1 | 0) + (((HEAPU16[($8_1 + 46 | 0) >> 1] | 0) << $30_1 | 0) >> $30_1 | 0) | 0) & 65535 | 0 | 0);
    HEAP32[($8_1 + 40 | 0) >> 2] = (HEAP32[($8_1 + 40 | 0) >> 2] | 0) >> 1 | 0;
    continue label$2;
   };
  }
  $44_1 = 16;
  label$3 : {
   label$4 : {
    if (!(((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 56 | 0) >> 2] | 0) + 2 | 0 | 0) | 0) << $44_1 | 0) >> $44_1 | 0 | 0) < (HEAP32[($8_1 + 48 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break label$4
    }
    break label$3;
   }
   HEAP32[($8_1 + 8 | 0) >> 2] = ((HEAP32[($8_1 + 52 | 0) >> 2] | 0) << 1 | 0) + -1 | 0;
   HEAP32[($8_1 + 20 | 0) >> 2] = (HEAP32[($8_1 + 56 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 8 | 0) >> 2] | 0) << 1 | 0) | 0;
   HEAP32[($8_1 + 4 | 0) >> 2] = HEAP32[($8_1 + 52 | 0) >> 2] | 0;
   label$5 : {
    if (!((HEAP32[($8_1 + 52 | 0) >> 2] | 0 | 0) <= (HEAP32[($8_1 + 8 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break label$5
    }
    label$6 : while (1) {
     label$7 : {
      if (!((1 | 0) < (($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 20 | 0) >> 2] | 0 | 0) | 0) & 65535 | 0 | 0) & 1 | 0)) {
       break label$7
      }
      $2(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 20 | 0) >> 2] | 0 | 0, ((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 20 | 0) >> 2] | 0 | 0) | 0) & 65535 | 0) >> 1 | 0) & 65535 | 0 | 0);
     }
     HEAP32[($8_1 + 20 | 0) >> 2] = (HEAP32[($8_1 + 20 | 0) >> 2] | 0) + -2 | 0;
     HEAP32[($8_1 + 4 | 0) >> 2] = (HEAP32[($8_1 + 4 | 0) >> 2] | 0) + -1 | 0;
     if (HEAP32[($8_1 + 4 | 0) >> 2] | 0) {
      continue label$6
     }
     break label$6;
    };
   }
   HEAP32[($8_1 + 24 | 0) >> 2] = (HEAP32[($8_1 + 52 | 0) >> 2] | 0) - 1 | 0;
   HEAP32[($8_1 + 16 | 0) >> 2] = (HEAP32[($8_1 + 56 | 0) >> 2] | 0) + ((((HEAP32[($8_1 + 52 | 0) >> 2] | 0) << 1 | 0) + -2 | 0) << 1 | 0) | 0;
   HEAP32[($8_1 + 12 | 0) >> 2] = (HEAP32[($8_1 + 56 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 24 | 0) >> 2] | 0) << 1 | 0) | 0;
   label$8 : {
    if (!(HEAP32[($8_1 + 24 | 0) >> 2] | 0)) {
     break label$8
    }
    HEAP32[$8_1 >> 2] = (HEAP32[($8_1 + 24 | 0) >> 2] | 0) >>> 3 | 0;
    label$9 : {
     if (!(HEAP32[$8_1 >> 2] | 0)) {
      break label$9
     }
     label$10 : while (1) {
      $127 = 16;
      $135 = 16;
      $2(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 12 | 0) >> 2] | 0 | 0, (((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 16 | 0) >> 2] | 0 | 0) | 0) << $127 | 0) >> $127 | 0) + ((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) + 2 | 0 | 0) | 0) << $135 | 0) >> $135 | 0) | 0) & 65535 | 0 | 0);
      $150 = 16;
      $158 = 16;
      $2(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 12 | 0) >> 2] | 0) - 2 | 0 | 0, (((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) - 4 | 0 | 0) | 0) << $150 | 0) >> $150 | 0) + ((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) - 2 | 0 | 0) | 0) << $158 | 0) >> $158 | 0) | 0) & 65535 | 0 | 0);
      $173 = 16;
      $181 = 16;
      $2(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 12 | 0) >> 2] | 0) - 4 | 0 | 0, (((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) - 8 | 0 | 0) | 0) << $173 | 0) >> $173 | 0) + ((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) - 6 | 0 | 0) | 0) << $181 | 0) >> $181 | 0) | 0) & 65535 | 0 | 0);
      $196 = 16;
      $204 = 16;
      $2(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 12 | 0) >> 2] | 0) - 6 | 0 | 0, (((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) - 12 | 0 | 0) | 0) << $196 | 0) >> $196 | 0) + ((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) - 10 | 0 | 0) | 0) << $204 | 0) >> $204 | 0) | 0) & 65535 | 0 | 0);
      $219 = 16;
      $227 = 16;
      $2(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 12 | 0) >> 2] | 0) - 8 | 0 | 0, (((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) - 16 | 0 | 0) | 0) << $219 | 0) >> $219 | 0) + ((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) - 14 | 0 | 0) | 0) << $227 | 0) >> $227 | 0) | 0) & 65535 | 0 | 0);
      $242 = 16;
      $250 = 16;
      $2(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 12 | 0) >> 2] | 0) - 10 | 0 | 0, (((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) - 20 | 0 | 0) | 0) << $242 | 0) >> $242 | 0) + ((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) - 18 | 0 | 0) | 0) << $250 | 0) >> $250 | 0) | 0) & 65535 | 0 | 0);
      $265 = 16;
      $273 = 16;
      $2(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 12 | 0) >> 2] | 0) - 12 | 0 | 0, (((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) - 24 | 0 | 0) | 0) << $265 | 0) >> $265 | 0) + ((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) - 22 | 0 | 0) | 0) << $273 | 0) >> $273 | 0) | 0) & 65535 | 0 | 0);
      HEAP32[($8_1 + 36 | 0) >> 2] = (HEAP32[($8_1 + 16 | 0) >> 2] | 0) + -28 | 0;
      HEAP32[($8_1 + 32 | 0) >> 2] = (HEAP32[($8_1 + 16 | 0) >> 2] | 0) + -26 | 0;
      HEAP32[($8_1 + 16 | 0) >> 2] = (HEAP32[($8_1 + 16 | 0) >> 2] | 0) + -32 | 0;
      $295 = 16;
      $301 = 16;
      $2(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 12 | 0) >> 2] | 0) - 14 | 0 | 0, (((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 36 | 0) >> 2] | 0 | 0) | 0) << $295 | 0) >> $295 | 0) + ((($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 32 | 0) >> 2] | 0 | 0) | 0) << $301 | 0) >> $301 | 0) | 0) & 65535 | 0 | 0);
      HEAP32[($8_1 + 12 | 0) >> 2] = (HEAP32[($8_1 + 12 | 0) >> 2] | 0) + -16 | 0;
      HEAP32[$8_1 >> 2] = (HEAP32[$8_1 >> 2] | 0) - 1 | 0;
      if (HEAP32[$8_1 >> 2] | 0) {
       continue label$10
      }
      break label$10;
     };
     HEAP32[($8_1 + 24 | 0) >> 2] = (HEAP32[($8_1 + 24 | 0) >> 2] | 0) & 7 | 0;
     label$11 : {
      if (HEAP32[($8_1 + 24 | 0) >> 2] | 0) {
       break label$11
      }
      break label$3;
     }
    }
    label$12 : while (1) {
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 16 | 0) >> 2] | 0 | 0) | 0), HEAP16[(wasm2js_i32$0 + 30 | 0) >> 1] = wasm2js_i32$1;
     HEAP32[($8_1 + 36 | 0) >> 2] = (HEAP32[($8_1 + 16 | 0) >> 2] | 0) + 2 | 0;
     HEAP32[($8_1 + 16 | 0) >> 2] = (HEAP32[($8_1 + 16 | 0) >> 2] | 0) + -4 | 0;
     $330 = 16;
     $2(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 12 | 0) >> 2] | 0 | 0, ((((HEAPU16[($8_1 + 30 | 0) >> 1] | 0) << $330 | 0) >> $330 | 0) + (($4(HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 36 | 0) >> 2] | 0 | 0) | 0) & 65535 | 0) | 0) & 65535 | 0 | 0);
     HEAP32[($8_1 + 12 | 0) >> 2] = (HEAP32[($8_1 + 12 | 0) >> 2] | 0) + -2 | 0;
     HEAP32[($8_1 + 24 | 0) >> 2] = (HEAP32[($8_1 + 24 | 0) >> 2] | 0) - 1 | 0;
     if (HEAP32[($8_1 + 24 | 0) >> 2] | 0) {
      continue label$12
     }
     break label$12;
    };
    break label$3;
   }
  }
  global$0 = $8_1 + 64 | 0;
  return;
 }
 
 function $9($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $6_1 = 0, $38_1 = 0, $140 = 0;
  $6_1 = global$0 - 32 | 0;
  global$0 = $6_1;
  HEAP32[($6_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($6_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($6_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($6_1 + 16 | 0) >> 2] = $3_1;
  HEAP32[($6_1 + 20 | 0) >> 2] = (HEAP32[($6_1 + 20 | 0) >> 2] | 0) & 255 | 0;
  HEAP32[($6_1 + 4 | 0) >> 2] = (HEAP32[($6_1 + 24 | 0) >> 2] | 0) - 1 | 0;
  label$1 : {
   if (!(31 >>> 0 < (HEAP32[($6_1 + 16 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
    break label$1
   }
   HEAP32[($6_1 + 12 | 0) >> 2] = ((HEAP32[($6_1 + 4 | 0) >> 2] | 0) ^ -1 | 0) & 3 | 0;
   label$2 : {
    if (!(HEAP32[($6_1 + 12 | 0) >> 2] | 0)) {
     break label$2
    }
    HEAP32[($6_1 + 16 | 0) >> 2] = (HEAP32[($6_1 + 16 | 0) >> 2] | 0) - (HEAP32[($6_1 + 12 | 0) >> 2] | 0) | 0;
    label$3 : while (1) {
     HEAP32[($6_1 + 12 | 0) >> 2] = (HEAP32[($6_1 + 12 | 0) >> 2] | 0) - 1 | 0;
     HEAP32[($6_1 + 4 | 0) >> 2] = (HEAP32[($6_1 + 4 | 0) >> 2] | 0) + 1 | 0;
     $38_1 = 24;
     $3(HEAP32[($6_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($6_1 + 4 | 0) >> 2] | 0 | 0, (((HEAP32[($6_1 + 20 | 0) >> 2] | 0) << $38_1 | 0) >> $38_1 | 0) & 65535 | 0 | 0);
     if (HEAP32[($6_1 + 12 | 0) >> 2] | 0) {
      continue label$3
     }
     break label$3;
    };
   }
   label$4 : {
    if (!(HEAP32[($6_1 + 20 | 0) >> 2] | 0)) {
     break label$4
    }
    HEAP32[($6_1 + 20 | 0) >> 2] = HEAP32[($6_1 + 20 | 0) >> 2] | 0 | ((HEAP32[($6_1 + 20 | 0) >> 2] | 0) << 8 | 0) | 0 | ((HEAP32[($6_1 + 20 | 0) >> 2] | 0) << 24 | 0) | 0 | ((HEAP32[($6_1 + 20 | 0) >> 2] | 0) << 16 | 0) | 0;
   }
   HEAP32[($6_1 + 8 | 0) >> 2] = (HEAP32[($6_1 + 4 | 0) >> 2] | 0) + -3 | 0;
   HEAP32[($6_1 + 12 | 0) >> 2] = (HEAP32[($6_1 + 16 | 0) >> 2] | 0) >>> 5 | 0;
   label$5 : {
    label$6 : while (1) {
     if (!(HEAP32[($6_1 + 12 | 0) >> 2] | 0)) {
      break label$5
     }
     $1(HEAP32[($6_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 4 | 0 | 0, HEAP32[($6_1 + 20 | 0) >> 2] | 0 | 0);
     $1(HEAP32[($6_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 8 | 0 | 0, HEAP32[($6_1 + 20 | 0) >> 2] | 0 | 0);
     $1(HEAP32[($6_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 12 | 0 | 0, HEAP32[($6_1 + 20 | 0) >> 2] | 0 | 0);
     $1(HEAP32[($6_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 16 | 0 | 0, HEAP32[($6_1 + 20 | 0) >> 2] | 0 | 0);
     $1(HEAP32[($6_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 20 | 0 | 0, HEAP32[($6_1 + 20 | 0) >> 2] | 0 | 0);
     $1(HEAP32[($6_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 24 | 0 | 0, HEAP32[($6_1 + 20 | 0) >> 2] | 0 | 0);
     $1(HEAP32[($6_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 28 | 0 | 0, HEAP32[($6_1 + 20 | 0) >> 2] | 0 | 0);
     HEAP32[($6_1 + 8 | 0) >> 2] = (HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 32 | 0;
     $1(HEAP32[($6_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($6_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($6_1 + 20 | 0) >> 2] | 0 | 0);
     HEAP32[($6_1 + 12 | 0) >> 2] = (HEAP32[($6_1 + 12 | 0) >> 2] | 0) - 1 | 0;
     continue label$6;
    };
   }
   HEAP32[($6_1 + 12 | 0) >> 2] = ((HEAP32[($6_1 + 16 | 0) >> 2] | 0) >>> 2 | 0) & 7 | 0;
   label$7 : {
    label$8 : while (1) {
     if (!(HEAP32[($6_1 + 12 | 0) >> 2] | 0)) {
      break label$7
     }
     HEAP32[($6_1 + 8 | 0) >> 2] = (HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 4 | 0;
     $1(HEAP32[($6_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($6_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($6_1 + 20 | 0) >> 2] | 0 | 0);
     HEAP32[($6_1 + 12 | 0) >> 2] = (HEAP32[($6_1 + 12 | 0) >> 2] | 0) - 1 | 0;
     continue label$8;
    };
   }
   HEAP32[($6_1 + 4 | 0) >> 2] = (HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 3 | 0;
   HEAP32[($6_1 + 16 | 0) >> 2] = (HEAP32[($6_1 + 16 | 0) >> 2] | 0) & 3 | 0;
  }
  label$9 : {
   label$10 : {
    if (!(HEAP32[($6_1 + 16 | 0) >> 2] | 0)) {
     break label$10
    }
    label$11 : while (1) {
     HEAP32[($6_1 + 16 | 0) >> 2] = (HEAP32[($6_1 + 16 | 0) >> 2] | 0) - 1 | 0;
     HEAP32[($6_1 + 4 | 0) >> 2] = (HEAP32[($6_1 + 4 | 0) >> 2] | 0) + 1 | 0;
     $140 = 24;
     $3(HEAP32[($6_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($6_1 + 4 | 0) >> 2] | 0 | 0, (((HEAP32[($6_1 + 20 | 0) >> 2] | 0) << $140 | 0) >> $140 | 0) & 65535 | 0 | 0);
     if (HEAP32[($6_1 + 16 | 0) >> 2] | 0) {
      continue label$11
     }
     break label$11;
    };
    break label$9;
   }
  }
  global$0 = $6_1 + 32 | 0;
  return;
 }
 
 function $10($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $6_1 = 0, $11_1 = 0;
  $6_1 = global$0 - 16 | 0;
  global$0 = $6_1;
  HEAP32[($6_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($6_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[($6_1 + 4 | 0) >> 2] = $2_1;
  HEAP32[$6_1 >> 2] = $3_1;
  $9(HEAP32[($6_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($6_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($6_1 + 4 | 0) >> 2] | 0 | 0, HEAP32[$6_1 >> 2] | 0 | 0);
  $11_1 = HEAP32[($6_1 + 8 | 0) >> 2] | 0;
  global$0 = $6_1 + 16 | 0;
  return $11_1 | 0;
 }
 
 function $11($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $4_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $4_1 = global$0 - 16 | 0;
  global$0 = $4_1;
  HEAP32[($4_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 4 | 0) >> 2] = 0;
  (wasm2js_i32$0 = $4_1, wasm2js_i32$1 = $5(HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 10964 | 0 | 0) | 0), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
  label$1 : {
   label$2 : {
    if (!((HEAP32[$4_1 >> 2] | 0 | 0) == (-2146054148 | 0) & 1 | 0)) {
     break label$2
    }
    break label$1;
   }
   fimport$0(1 | 0);
   abort();
  }
  label$3 : {
   if (!((HEAP32[($4_1 + 4 | 0) >> 2] | 0 | 0) == (1 | 0) & 1 | 0)) {
    break label$3
   }
   $1(HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 8208 | 0 | 0, 0 | 0);
   $10(HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 8232 | 0 | 0, 0 | 0, 2724 | 0) | 0;
  }
  $1(HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 8212 | 0 | 0, ($5(HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 8212 | 0 | 0) | 0) + ($5(HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 8200 | 0 | 0) | 0) | 0 | 0);
  $1(HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 8200 | 0 | 0, 0 | 0);
  global$0 = $4_1 + 16 | 0;
  return;
 }
 
 function $12($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $6_1 = 0;
  $6_1 = global$0 - 16 | 0;
  global$0 = $6_1;
  HEAP32[($6_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($6_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[($6_1 + 4 | 0) >> 2] = $2_1;
  HEAP32[$6_1 >> 2] = $3_1;
  $1(HEAP32[($6_1 + 12 | 0) >> 2] | 0 | 0, (HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 10960 | 0 | 0, HEAP32[($6_1 + 4 | 0) >> 2] | 0 | 0);
  $1(HEAP32[($6_1 + 12 | 0) >> 2] | 0 | 0, (HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 10964 | 0 | 0, HEAP32[$6_1 >> 2] | 0 | 0);
  global$0 = $6_1 + 16 | 0;
  return;
 }
 
 function $13($0_1, $1_1, $2_1, $3_1, $4_1, $5_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  $5_1 = $5_1 | 0;
  var $8_1 = 0;
  $8_1 = global$0 - 32 | 0;
  global$0 = $8_1;
  HEAP32[($8_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($8_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($8_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($8_1 + 16 | 0) >> 2] = $3_1;
  HEAP32[($8_1 + 12 | 0) >> 2] = $4_1;
  HEAP32[($8_1 + 8 | 0) >> 2] = $5_1;
  $10(HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 24 | 0) >> 2] | 0 | 0, 0 | 0, 10968 | 0) | 0;
  $1(HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 24 | 0) >> 2] | 0) + 8208 | 0 | 0, HEAP32[($8_1 + 8 | 0) >> 2] | 0 | 0);
  $1(HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 24 | 0) >> 2] | 0) + 8204 | 0 | 0, HEAP32[($8_1 + 8 | 0) >> 2] | 0 | 0);
  $1(HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 24 | 0) >> 2] | 0) + 8192 | 0 | 0, 0 | 0);
  $1(HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 24 | 0) >> 2] | 0) + 8196 | 0 | 0, 0 | 0);
  $1(HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 24 | 0) >> 2] | 0) + 8200 | 0 | 0, 0 | 0);
  $12(HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 16 | 0) >> 2] | 0 | 0);
  $1(HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 24 | 0) >> 2] | 0) + 10956 | 0 | 0, HEAP32[($8_1 + 12 | 0) >> 2] | 0 | 0);
  global$0 = $8_1 + 32 | 0;
  return;
 }
 
 function $14($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $4_1 = 0, $336 = 0, $344 = 0, $359 = 0, $367 = 0, $382 = 0, $390 = 0, $405 = 0, $413 = 0, $428 = 0, $436 = 0, $451 = 0, $459 = 0, $481 = 0, $487 = 0, $749 = 0, $757 = 0, $772 = 0, $780 = 0, $795 = 0, $803 = 0, $818 = 0, $826 = 0, $841 = 0, $849 = 0, $864 = 0, $872 = 0, $894 = 0, $900 = 0, $1164 = 0, $1172 = 0, $1187 = 0, $1195 = 0, $1210 = 0, $1218 = 0, $1233 = 0, $1241 = 0, $1263 = 0, $1269 = 0, $1533 = 0, $1541 = 0, $1556 = 0, $1564 = 0, $1579 = 0, $1587 = 0, $1602 = 0, $1610 = 0, $1632 = 0, $1638 = 0, $1779 = 0, $1787 = 0, $1802 = 0, $1810 = 0, $1825 = 0, $1833 = 0, $1848 = 0, $1856 = 0, $1878 = 0, $1884 = 0, $1905 = 0;
  $4_1 = global$0 - 48 | 0;
  global$0 = $4_1;
  HEAP32[($4_1 + 44 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 40 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 20 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 128 | 0;
  $1(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2652 | 0 | 0, 1 | 0);
  $1(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2656 | 0 | 0, 8 | 0);
  $1(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2640 | 0 | 0, 0 | 0);
  $1(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2660 | 0 | 0, 0 | 0);
  $1(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2644 | 0 | 0, 1 | 0);
  $1(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2648 | 0 | 0, 1 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2626 | 0 | 0, 40 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2624 | 0 | 0, 40 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2630 | 0 | 0, 40 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2628 | 0 | 0, 40 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2634 | 0 | 0, 40 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2632 | 0 | 0, 40 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2638 | 0 | 0, 40 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 2636 | 0 | 0, 40 & 65535 | 0 | 0);
  HEAP32[($4_1 + 16 | 0) >> 2] = 2;
  label$1 : while (1) {
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 2 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 4 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 6 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 8 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 10 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 12 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 14 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 16 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 18 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 20 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 22 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 24 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 26 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 28 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 30 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 32 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 34 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 36 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 38 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 40 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 42 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 44 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 46 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 48 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 50 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 52 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 54 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 56 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 58 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 60 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 62 | 0 | 0, 0 & 65535 | 0 | 0);
   HEAP32[($4_1 + 20 | 0) >> 2] = (HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 32 | 0;
   HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + -1 | 0;
   if (HEAP32[($4_1 + 16 | 0) >> 2] | 0) {
    continue label$1
   }
   break label$1;
  };
  HEAP32[($4_1 + 28 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 252 | 0;
  HEAP32[($4_1 + 24 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 126 | 0;
  HEAP32[($4_1 + 16 | 0) >> 2] = 9;
  label$2 : while (1) {
   $336 = 16;
   $344 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0) | 0) << $336 | 0) >> $336 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + 2 | 0 | 0) | 0) << $344 | 0) >> $344 | 0) | 0) & 65535 | 0 | 0);
   $359 = 16;
   $367 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 24 | 0) >> 2] | 0) + -2 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + -4 | 0 | 0) | 0) << $359 | 0) >> $359 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + -2 | 0 | 0) | 0) << $367 | 0) >> $367 | 0) | 0) & 65535 | 0 | 0);
   $382 = 16;
   $390 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 24 | 0) >> 2] | 0) + -4 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + -8 | 0 | 0) | 0) << $382 | 0) >> $382 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + -6 | 0 | 0) | 0) << $390 | 0) >> $390 | 0) | 0) & 65535 | 0 | 0);
   $405 = 16;
   $413 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 24 | 0) >> 2] | 0) + -6 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + -12 | 0 | 0) | 0) << $405 | 0) >> $405 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + -10 | 0 | 0) | 0) << $413 | 0) >> $413 | 0) | 0) & 65535 | 0 | 0);
   $428 = 16;
   $436 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 24 | 0) >> 2] | 0) + -8 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + -16 | 0 | 0) | 0) << $428 | 0) >> $428 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + -14 | 0 | 0) | 0) << $436 | 0) >> $436 | 0) | 0) & 65535 | 0 | 0);
   $451 = 16;
   $459 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 24 | 0) >> 2] | 0) + -10 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + -20 | 0 | 0) | 0) << $451 | 0) >> $451 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + -18 | 0 | 0) | 0) << $459 | 0) >> $459 | 0) | 0) & 65535 | 0 | 0);
   HEAP32[($4_1 + 36 | 0) >> 2] = (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + -24 | 0;
   HEAP32[($4_1 + 32 | 0) >> 2] = (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + -22 | 0;
   HEAP32[($4_1 + 28 | 0) >> 2] = (HEAP32[($4_1 + 28 | 0) >> 2] | 0) + -28 | 0;
   $481 = 16;
   $487 = 16;
   $1(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 24 | 0) >> 2] | 0) + -12 | 0 | 0, ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 36 | 0) >> 2] | 0 | 0) | 0) << $481 | 0) >> $481 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 32 | 0) >> 2] | 0 | 0) | 0) << $487 | 0) >> $487 | 0) | 0 | 0);
   HEAP32[($4_1 + 24 | 0) >> 2] = (HEAP32[($4_1 + 24 | 0) >> 2] | 0) + -14 | 0;
   HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + -1 | 0;
   if (HEAP32[($4_1 + 16 | 0) >> 2] | 0) {
    continue label$2
   }
   break label$2;
  };
  HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 128 | 0;
  HEAP32[($4_1 + 12 | 0) >> 2] = 2;
  label$3 : while (1) {
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 256 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 258 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 260 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 262 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 264 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 266 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 268 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 270 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 272 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 274 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 276 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 278 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 280 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 282 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 284 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 286 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 288 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 290 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 292 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 294 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 296 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 298 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 300 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 302 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 304 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 306 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 308 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 310 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 312 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 314 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 316 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 318 | 0 | 0, 1 & 65535 | 0 | 0);
   HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 64 | 0;
   HEAP32[($4_1 + 12 | 0) >> 2] = (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + -1 | 0;
   if (HEAP32[($4_1 + 12 | 0) >> 2] | 0) {
    continue label$3
   }
   break label$3;
  };
  HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 252 | 0;
  HEAP32[($4_1 + 12 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 126 | 0;
  HEAP32[($4_1 + 8 | 0) >> 2] = 9;
  label$4 : while (1) {
   $749 = 16;
   $757 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 256 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 256 | 0 | 0) | 0) << $749 | 0) >> $749 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 258 | 0 | 0) | 0) << $757 | 0) >> $757 | 0) | 0) & 65535 | 0 | 0);
   $772 = 16;
   $780 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 254 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 252 | 0 | 0) | 0) << $772 | 0) >> $772 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 254 | 0 | 0) | 0) << $780 | 0) >> $780 | 0) | 0) & 65535 | 0 | 0);
   $795 = 16;
   $803 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 252 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 248 | 0 | 0) | 0) << $795 | 0) >> $795 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 250 | 0 | 0) | 0) << $803 | 0) >> $803 | 0) | 0) & 65535 | 0 | 0);
   $818 = 16;
   $826 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 250 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 244 | 0 | 0) | 0) << $818 | 0) >> $818 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 246 | 0 | 0) | 0) << $826 | 0) >> $826 | 0) | 0) & 65535 | 0 | 0);
   $841 = 16;
   $849 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 248 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 240 | 0 | 0) | 0) << $841 | 0) >> $841 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 242 | 0 | 0) | 0) << $849 | 0) >> $849 | 0) | 0) & 65535 | 0 | 0);
   $864 = 16;
   $872 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 246 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 236 | 0 | 0) | 0) << $864 | 0) >> $864 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 238 | 0 | 0) | 0) << $872 | 0) >> $872 | 0) | 0) & 65535 | 0 | 0);
   HEAP32[($4_1 + 28 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 232 | 0;
   HEAP32[($4_1 + 24 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 234 | 0;
   HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + -28 | 0;
   $894 = 16;
   $900 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 244 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0) | 0) << $894 | 0) >> $894 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0) | 0) << $900 | 0) >> $900 | 0) | 0) & 65535 | 0 | 0);
   HEAP32[($4_1 + 12 | 0) >> 2] = (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + -14 | 0;
   HEAP32[($4_1 + 8 | 0) >> 2] = (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + -1 | 0;
   if (HEAP32[($4_1 + 8 | 0) >> 2] | 0) {
    continue label$4
   }
   break label$4;
  };
  HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 512 | 0;
  HEAP32[($4_1 + 12 | 0) >> 2] = 8;
  label$5 : while (1) {
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 576 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 578 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 580 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 582 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 584 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 586 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 588 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 590 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 592 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 594 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 596 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 598 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 600 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 602 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 604 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 606 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 608 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 610 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 612 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 614 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 616 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 618 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 620 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 622 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 624 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 626 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 628 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 630 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 632 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 634 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 636 | 0 | 0, 0 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 638 | 0 | 0, 0 & 65535 | 0 | 0);
   HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 64 | 0;
   HEAP32[($4_1 + 12 | 0) >> 2] = (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + -1 | 0;
   if (HEAP32[($4_1 + 12 | 0) >> 2] | 0) {
    continue label$5
   }
   break label$5;
  };
  HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 1020 | 0;
  HEAP32[($4_1 + 12 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 510 | 0;
  HEAP32[($4_1 + 8 | 0) >> 2] = 51;
  label$6 : while (1) {
   $1164 = 16;
   $1172 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 576 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 576 | 0 | 0) | 0) << $1164 | 0) >> $1164 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 578 | 0 | 0) | 0) << $1172 | 0) >> $1172 | 0) | 0) & 65535 | 0 | 0);
   $1187 = 16;
   $1195 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 574 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 572 | 0 | 0) | 0) << $1187 | 0) >> $1187 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 574 | 0 | 0) | 0) << $1195 | 0) >> $1195 | 0) | 0) & 65535 | 0 | 0);
   $1210 = 16;
   $1218 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 572 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 568 | 0 | 0) | 0) << $1210 | 0) >> $1210 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 570 | 0 | 0) | 0) << $1218 | 0) >> $1218 | 0) | 0) & 65535 | 0 | 0);
   $1233 = 16;
   $1241 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 570 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 564 | 0 | 0) | 0) << $1233 | 0) >> $1233 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 566 | 0 | 0) | 0) << $1241 | 0) >> $1241 | 0) | 0) & 65535 | 0 | 0);
   HEAP32[($4_1 + 28 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 560 | 0;
   HEAP32[($4_1 + 24 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 562 | 0;
   HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + -20 | 0;
   $1263 = 16;
   $1269 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 568 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0) | 0) << $1263 | 0) >> $1263 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0) | 0) << $1269 | 0) >> $1269 | 0) | 0) & 65535 | 0 | 0);
   HEAP32[($4_1 + 12 | 0) >> 2] = (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + -10 | 0;
   HEAP32[($4_1 + 8 | 0) >> 2] = (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + -1 | 0;
   if (HEAP32[($4_1 + 8 | 0) >> 2] | 0) {
    continue label$6
   }
   break label$6;
  };
  HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 512 | 0;
  HEAP32[($4_1 + 12 | 0) >> 2] = 8;
  label$7 : while (1) {
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1600 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1602 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1604 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1606 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1608 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1610 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1612 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1614 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1616 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1618 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1620 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1622 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1624 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1626 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1628 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1630 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1632 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1634 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1636 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1638 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1640 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1642 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1644 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1646 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1648 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1650 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1652 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1654 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1656 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1658 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1660 | 0 | 0, 1 & 65535 | 0 | 0);
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1662 | 0 | 0, 1 & 65535 | 0 | 0);
   HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 64 | 0;
   HEAP32[($4_1 + 12 | 0) >> 2] = (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + -1 | 0;
   if (HEAP32[($4_1 + 12 | 0) >> 2] | 0) {
    continue label$7
   }
   break label$7;
  };
  HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 1020 | 0;
  HEAP32[($4_1 + 12 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 510 | 0;
  HEAP32[($4_1 + 8 | 0) >> 2] = 51;
  label$8 : while (1) {
   $1533 = 16;
   $1541 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1600 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1600 | 0 | 0) | 0) << $1533 | 0) >> $1533 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1602 | 0 | 0) | 0) << $1541 | 0) >> $1541 | 0) | 0) & 65535 | 0 | 0);
   $1556 = 16;
   $1564 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1598 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1596 | 0 | 0) | 0) << $1556 | 0) >> $1556 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1598 | 0 | 0) | 0) << $1564 | 0) >> $1564 | 0) | 0) & 65535 | 0 | 0);
   $1579 = 16;
   $1587 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1596 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1592 | 0 | 0) | 0) << $1579 | 0) >> $1579 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1594 | 0 | 0) | 0) << $1587 | 0) >> $1587 | 0) | 0) & 65535 | 0 | 0);
   $1602 = 16;
   $1610 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1594 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1588 | 0 | 0) | 0) << $1602 | 0) >> $1602 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1590 | 0 | 0) | 0) << $1610 | 0) >> $1610 | 0) | 0) & 65535 | 0 | 0);
   HEAP32[($4_1 + 28 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1584 | 0;
   HEAP32[($4_1 + 24 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1586 | 0;
   HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + -20 | 0;
   $1632 = 16;
   $1638 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1592 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0) | 0) << $1632 | 0) >> $1632 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0) | 0) << $1638 | 0) >> $1638 | 0) | 0) & 65535 | 0 | 0);
   HEAP32[($4_1 + 12 | 0) >> 2] = (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + -10 | 0;
   HEAP32[($4_1 + 8 | 0) >> 2] = (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + -1 | 0;
   if (HEAP32[($4_1 + 8 | 0) >> 2] | 0) {
    continue label$8
   }
   break label$8;
  };
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 544 | 0 | 0, 0 & 65535 | 0 | 0);
  HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 60 | 0;
  HEAP32[($4_1 + 12 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 30 | 0;
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 546 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 548 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 550 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 552 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 554 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 556 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 558 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 560 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 562 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 564 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 566 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 568 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 570 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 572 | 0 | 0, 0 & 65535 | 0 | 0);
  $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 574 | 0 | 0, 0 & 65535 | 0 | 0);
  HEAP32[($4_1 + 8 | 0) >> 2] = 3;
  label$9 : while (1) {
   $1779 = 16;
   $1787 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 512 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 512 | 0 | 0) | 0) << $1779 | 0) >> $1779 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 514 | 0 | 0) | 0) << $1787 | 0) >> $1787 | 0) | 0) & 65535 | 0 | 0);
   $1802 = 16;
   $1810 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 510 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 508 | 0 | 0) | 0) << $1802 | 0) >> $1802 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 510 | 0 | 0) | 0) << $1810 | 0) >> $1810 | 0) | 0) & 65535 | 0 | 0);
   $1825 = 16;
   $1833 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 508 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 504 | 0 | 0) | 0) << $1825 | 0) >> $1825 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 506 | 0 | 0) | 0) << $1833 | 0) >> $1833 | 0) | 0) & 65535 | 0 | 0);
   $1848 = 16;
   $1856 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 506 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 500 | 0 | 0) | 0) << $1848 | 0) >> $1848 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 502 | 0 | 0) | 0) << $1856 | 0) >> $1856 | 0) | 0) & 65535 | 0 | 0);
   HEAP32[($4_1 + 28 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 496 | 0;
   HEAP32[($4_1 + 24 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 498 | 0;
   HEAP32[($4_1 + 16 | 0) >> 2] = (HEAP32[($4_1 + 16 | 0) >> 2] | 0) + -20 | 0;
   $1878 = 16;
   $1884 = 16;
   $2(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 504 | 0 | 0, (((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0) | 0) << $1878 | 0) >> $1878 | 0) + ((($4(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0) | 0) << $1884 | 0) >> $1884 | 0) | 0) & 65535 | 0 | 0);
   HEAP32[($4_1 + 12 | 0) >> 2] = (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + -10 | 0;
   HEAP32[($4_1 + 8 | 0) >> 2] = (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + -1 | 0;
   if (HEAP32[($4_1 + 8 | 0) >> 2] | 0) {
    continue label$9
   }
   break label$9;
  };
  $1905 = 16;
  $8(HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 512 | 0 | 0, 16 | 0, 6e3 | 0, (24 << $1905 | 0) >> $1905 | 0 | 0, 0 | 0);
  global$0 = $4_1 + 48 | 0;
  return;
 }
 
 function $15($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $5_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $5_1 = global$0 - 32 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 20 | 0) >> 2] = $2_1;
  $2(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8218 | 0 | 0, 65535 & 65535 | 0 | 0);
  $2(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8220 | 0 | 0, 0 & 65535 | 0 | 0);
  $1(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8224 | 0 | 0, 0 | 0);
  label$1 : {
   label$2 : {
    if (!(($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0 | 0) < (1 | 0) & 1 | 0)) {
     break label$2
    }
    $7(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 20 | 0) >> 2] | 0 | 0);
    label$3 : {
     label$4 : {
      if (!(($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0 | 0) < (1 | 0) & 1 | 0)) {
       break label$4
      }
      HEAP32[($5_1 + 16 | 0) >> 2] = -1;
      break label$3;
     }
     $1(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
     (wasm2js_i32$0 = $5_1, wasm2js_i32$1 = $5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
     $1(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($5_1 + 8 | 0) >> 2] | 0) + 1 | 0 | 0);
     (wasm2js_i32$0 = $5_1, wasm2js_i32$1 = $6(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + (HEAP32[($5_1 + 8 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 16 | 0) >> 2] = wasm2js_i32$1;
    }
    break label$1;
   }
   $1(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
   (wasm2js_i32$0 = $5_1, wasm2js_i32$1 = $5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
   $1(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($5_1 + 8 | 0) >> 2] | 0) + 1 | 0 | 0);
   (wasm2js_i32$0 = $5_1, wasm2js_i32$1 = $6(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + (HEAP32[($5_1 + 8 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 16 | 0) >> 2] = wasm2js_i32$1;
  }
  $2(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8216 | 0 | 0, ((HEAP32[($5_1 + 16 | 0) >> 2] | 0) << 8 | 0) & 65535 | 0 | 0);
  label$5 : {
   label$6 : {
    if (!(($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0 | 0) < (1 | 0) & 1 | 0)) {
     break label$6
    }
    $7(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 20 | 0) >> 2] | 0 | 0);
    label$7 : {
     label$8 : {
      if (!(($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0 | 0) < (1 | 0) & 1 | 0)) {
       break label$8
      }
      HEAP16[($5_1 + 14 | 0) >> 1] = 65535;
      break label$7;
     }
     $1(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
     (wasm2js_i32$0 = $5_1, wasm2js_i32$1 = $5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
     $1(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($5_1 + 8 | 0) >> 2] | 0) + 1 | 0 | 0);
     (wasm2js_i32$0 = $5_1, wasm2js_i32$1 = $6(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + (HEAP32[($5_1 + 8 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP16[(wasm2js_i32$0 + 14 | 0) >> 1] = wasm2js_i32$1;
    }
    break label$5;
   }
   $1(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
   (wasm2js_i32$0 = $5_1, wasm2js_i32$1 = $5(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
   $1(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($5_1 + 8 | 0) >> 2] | 0) + 1 | 0 | 0);
   (wasm2js_i32$0 = $5_1, wasm2js_i32$1 = $6(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + (HEAP32[($5_1 + 8 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP16[(wasm2js_i32$0 + 14 | 0) >> 1] = wasm2js_i32$1;
  }
  $2(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8216 | 0 | 0, (($4(HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0 | (((HEAPU16[($5_1 + 14 | 0) >> 1] | 0) & 65535 | 0) & 255 | 0) | 0) & 65535 | 0 | 0);
  global$0 = $5_1 + 32 | 0;
  return;
 }
 
 function $16($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $5_1 = 0;
  $5_1 = global$0 - 16 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 4 | 0) >> 2] = $2_1;
  $14(HEAP32[($5_1 + 12 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 4 | 0) >> 2] | 0) + 8232 | 0 | 0);
  $15(HEAP32[($5_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 4 | 0) >> 2] | 0 | 0);
  global$0 = $5_1 + 16 | 0;
  return;
 }
 
 function $17($0_1, $1_1, $2_1, $3_1, $4_1, $5_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  $5_1 = $5_1 | 0;
  var $8_1 = 0, $425 = 0, $1700 = 0, $1704 = 0, $1795 = 0, $1812 = 0, $1875 = 0, $1899 = 0, $2792 = 0, $3242 = 0, $4839 = 0, $4843 = 0, $4934 = 0, $4949 = 0, $5074 = 0, $5103 = 0, $12_1 = 0, $1965 = 0, $2339 = 0, $5065 = 0, $5094 = 0, $5564 = 0, $5609 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $8_1 = global$0 - 144 | 0;
  global$0 = $8_1;
  HEAP32[($8_1 + 136 | 0) >> 2] = $0_1;
  HEAP32[($8_1 + 132 | 0) >> 2] = $1_1;
  HEAP32[($8_1 + 128 | 0) >> 2] = $2_1;
  HEAP32[($8_1 + 124 | 0) >> 2] = $3_1;
  HEAP32[($8_1 + 120 | 0) >> 2] = $4_1;
  HEAP32[($8_1 + 116 | 0) >> 2] = $5_1;
  HEAP32[($8_1 + 112 | 0) >> 2] = 0;
  HEAP32[($8_1 + 28 | 0) >> 2] = 4096;
  $12_1 = $29(HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0) | 0;
  HEAP32[(HEAP32[($8_1 + 116 | 0) >> 2] | 0) >> 2] = $12_1;
  HEAP32[($8_1 + 32 | 0) >> 2] = (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8232 | 0;
  $13(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0, -2146054584 | 0, -2146054148 | 0, -2141482688 | 0, HEAP32[($8_1 + 128 | 0) >> 2] | 0 | 0);
  $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10908 | 0 | 0, 31200 | 0);
  $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10952 | 0 | 0, HEAP32[($8_1 + 120 | 0) >> 2] | 0 | 0);
  $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10916 | 0 | 0, 0 | 0);
  $16(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
  (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10872 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 36 | 0) >> 2] = wasm2js_i32$1;
  (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10892 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 48 | 0) >> 2] = wasm2js_i32$1;
  label$1 : while (1) {
   label$2 : {
    label$3 : while (1) {
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[($8_1 + 52 | 0) >> 2] = (HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 48 | 0) >> 2] | 0) << 2 | 0) | 0;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2624 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) + (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2626 | 0 | 0) | 0) & 65535 | 0) | 0), HEAP32[(wasm2js_i32$0 + 60 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[($8_1 + 96 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) + 1 | 0;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0) | 0) & 65535 | 0) - (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0) + 1 | 0), HEAP32[(wasm2js_i32$0 + 72 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[($8_1 + 84 | 0) >> 2] = (Math_imul(HEAP32[($8_1 + 96 | 0) >> 2] | 0, ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) - (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0) + 1 | 0) + -1 | 0 | 0) / (HEAP32[($8_1 + 72 | 0) >> 2] | 0 | 0) | 0;
     label$4 : {
      if (!((HEAP32[($8_1 + 68 | 0) >> 2] | 0 | 0) <= (HEAP32[($8_1 + 84 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break label$4
      }
      break label$2;
     }
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 80 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[($8_1 + 68 | 0) >> 2] = (((Math_imul(HEAP32[($8_1 + 72 | 0) >> 2] | 0, HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0) - 1 | 0;
     HEAP32[($8_1 + 92 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
     label$5 : {
      label$6 : while (1) {
       if ((HEAP32[($8_1 + 92 | 0) >> 2] | 0) & 32768 | 0) {
        break label$5
       }
       HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
       label$7 : {
        if ((HEAP32[($8_1 + 80 | 0) >> 2] | 0) & 254 | 0) {
         break label$7
        }
        label$8 : {
         label$9 : {
          if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0 | 0) < (1 | 0) & 1 | 0)) {
           break label$9
          }
          $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
          label$10 : {
           label$11 : {
            if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
             break label$11
            }
            HEAP32[($8_1 + 80 | 0) >> 2] = -1;
            break label$10;
           }
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 80 | 0) >> 2] = wasm2js_i32$1;
          }
          break label$8;
         }
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 80 | 0) >> 2] = wasm2js_i32$1;
        }
        label$12 : {
         label$13 : {
          if ((HEAP32[($8_1 + 80 | 0) >> 2] | 0) & 256 | 0) {
           break label$13
          }
          HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
          break label$12;
         }
         HEAP32[($8_1 + 80 | 0) >> 2] = 256;
        }
       }
       HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0 | (((HEAP32[($8_1 + 80 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
       HEAP32[($8_1 + 92 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
       continue label$6;
      };
     }
     HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
     HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 16 | 0 | (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
     HEAP32[($8_1 + 68 | 0) >> 2] = HEAP32[($8_1 + 88 | 0) >> 2] | 0;
     label$14 : {
      label$15 : while (1) {
       if (!(((HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 1073758208 | 0 | 0) == (16384 | 0) & 1 | 0)) {
        break label$14
       }
       HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) & -32770 | 0 | -2147418112 | 0;
       label$16 : {
        if ((HEAP32[($8_1 + 80 | 0) >> 2] | 0) & 254 | 0) {
         break label$16
        }
        label$17 : {
         label$18 : {
          if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
           break label$18
          }
          $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
          label$19 : {
           label$20 : {
            if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
             break label$20
            }
            HEAP32[($8_1 + 80 | 0) >> 2] = -1;
            break label$19;
           }
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 80 | 0) >> 2] = wasm2js_i32$1;
          }
          break label$17;
         }
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 80 | 0) >> 2] = wasm2js_i32$1;
        }
        label$21 : {
         label$22 : {
          if ((HEAP32[($8_1 + 80 | 0) >> 2] | 0) & 256 | 0) {
           break label$22
          }
          HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
          break label$21;
         }
         HEAP32[($8_1 + 80 | 0) >> 2] = 256;
        }
       }
       HEAP32[($8_1 + 44 | 0) >> 2] = ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0) ^ 32768 | 0 | (((HEAP32[($8_1 + 80 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
       HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
       continue label$15;
      };
     }
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0, (HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 65535 | 0 | 0);
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0, ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) >>> 16 | 0) & 65535 | 0 | 0);
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0, (HEAPU16[($8_1 + 42 | 0) >> 1] | 0) & 65535 | 0 | 0);
     $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0, HEAP32[($8_1 + 80 | 0) >> 2] | 0 | 0);
     $425 = 16;
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2624 | 0 | 0, (((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2624 | 0 | 0) | 0) << $425 | 0) >> $425 | 0) + 40 | 0) & 65535 | 0 | 0);
     label$23 : {
      if (!(5999 >>> 0 < (HEAP32[($8_1 + 60 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
       break label$23
      }
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2624 | 0 | 0, ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2624 | 0 | 0) | 0) & 65535 | 0) >> 1 | 0) & 65535 | 0 | 0);
      label$24 : {
       if (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2624 | 0 | 0) | 0) & 65535 | 0) {
        break label$24
       }
       $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2624 | 0 | 0, 1 & 65535 | 0 | 0);
      }
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2626 | 0 | 0, ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2626 | 0 | 0) | 0) & 65535 | 0) >> 1 | 0) & 65535 | 0 | 0);
      label$25 : {
       if (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2626 | 0 | 0) | 0) & 65535 | 0) {
        break label$25
       }
       $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2626 | 0 | 0, 1 & 65535 | 0 | 0);
      }
     }
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[($8_1 + 48 | 0) >> 2] = ((HEAP32[($8_1 + 48 | 0) >> 2] | 0) & 1 | 0) << 1 | 0;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8810 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) + ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10884 | 0 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0) | 0) & 65535 | 0) - (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0) + 1 | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[($8_1 + 72 | 0) >> 2] = (Math_imul(HEAP32[($8_1 + 96 | 0) >> 2] | 0, ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) - (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0) + 1 | 0) + -1 | 0 | 0) / (HEAP32[($8_1 + 84 | 0) >> 2] | 0 | 0) | 0;
     label$26 : {
      label$27 : {
       if (!((HEAP32[($8_1 + 72 | 0) >> 2] | 0 | 0) < (HEAP32[($8_1 + 68 | 0) >> 2] | 0 | 0) & 1 | 0)) {
        break label$27
       }
       HEAP32[($8_1 + 84 | 0) >> 2] = 2;
       HEAP32[($8_1 + 52 | 0) >> 2] = 0;
       label$28 : while (1) {
        (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 84 | 0) >> 2] | 0) << 1 | 0) | 0) + 576 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
        label$29 : {
         if (!(((HEAP32[($8_1 + 52 | 0) >> 2] | 0) + (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0 | 0) <= (HEAP32[($8_1 + 72 | 0) >> 2] | 0 | 0) & 1 | 0)) {
          break label$29
         }
         HEAP32[($8_1 + 52 | 0) >> 2] = (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
         HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0;
        }
        label$30 : {
         label$31 : {
          if (!((255 | 0) < (HEAP32[($8_1 + 84 | 0) >> 2] | 0 | 0) & 1 | 0)) {
           break label$31
          }
          break label$30;
         }
         HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 84 | 0) >> 2] | 0) << 1 | 0;
         continue label$28;
        }
        break label$28;
       };
       HEAP32[($8_1 + 92 | 0) >> 2] = (HEAP32[($8_1 + 84 | 0) >> 2] | 0) - 256 | 0;
       (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
       (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
       (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0) | 0) & 65535 | 0) - (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0) + 1 | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
       (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
       (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = (((Math_imul(HEAP32[($8_1 + 84 | 0) >> 2] | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 92 | 0) >> 2] | 0) << 1 | 0) | 0) + 1088 | 0 | 0) | 0) & 65535 | 0) | 0) | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0) - 1 | 0), HEAP32[(wasm2js_i32$0 + 60 | 0) >> 2] = wasm2js_i32$1;
       HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) + ((Math_imul(HEAP32[($8_1 + 84 | 0) >> 2] | 0, HEAP32[($8_1 + 52 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0) | 0;
       HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
       label$32 : {
        label$33 : while (1) {
         if ((HEAP32[($8_1 + 80 | 0) >> 2] | 0) & 32768 | 0) {
          break label$32
         }
         HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
         HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
         HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
         label$34 : {
          if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 254 | 0) {
           break label$34
          }
          label$35 : {
           label$36 : {
            if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
             break label$36
            }
            $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
            label$37 : {
             label$38 : {
              if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
               break label$38
              }
              HEAP32[($8_1 + 88 | 0) >> 2] = -1;
              break label$37;
             }
             $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
             (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
             $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
             (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
            }
            break label$35;
           }
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
          }
          label$39 : {
           label$40 : {
            if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 256 | 0) {
             break label$40
            }
            HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
            break label$39;
           }
           HEAP32[($8_1 + 88 | 0) >> 2] = 256;
          }
         }
         HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0 | (((HEAP32[($8_1 + 88 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
         HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
         continue label$33;
        };
       }
       HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 68 | 0) >> 2] | 0;
       HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 16 | 0 | (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
       HEAP32[($8_1 + 60 | 0) >> 2] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
       label$41 : {
        label$42 : while (1) {
         if (!(((HEAP32[($8_1 + 60 | 0) >> 2] | 0) & 1073758208 | 0 | 0) == (16384 | 0) & 1 | 0)) {
          break label$41
         }
         HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
         HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
         HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) & -32770 | 0 | -2147418112 | 0;
         label$43 : {
          if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 254 | 0) {
           break label$43
          }
          label$44 : {
           label$45 : {
            if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
             break label$45
            }
            $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
            label$46 : {
             label$47 : {
              if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
               break label$47
              }
              HEAP32[($8_1 + 88 | 0) >> 2] = -1;
              break label$46;
             }
             $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
             (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
             $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
             (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
            }
            break label$44;
           }
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
          }
          label$48 : {
           label$49 : {
            if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 256 | 0) {
             break label$49
            }
            HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
            break label$48;
           }
           HEAP32[($8_1 + 88 | 0) >> 2] = 256;
          }
         }
         HEAP32[($8_1 + 68 | 0) >> 2] = ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0) ^ 32768 | 0 | (((HEAP32[($8_1 + 88 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
         HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 68 | 0) >> 2] | 0;
         continue label$42;
        };
       }
       $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0, (HEAP32[($8_1 + 44 | 0) >> 2] | 0) & 65535 | 0 | 0);
       $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0, ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) >>> 16 | 0) & 65535 | 0 | 0);
       $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0, (HEAPU16[($8_1 + 42 | 0) >> 1] | 0) & 65535 | 0 | 0);
       $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0, HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0);
       break label$26;
      }
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 60 | 0) >> 2] = wasm2js_i32$1;
      HEAP32[($8_1 + 80 | 0) >> 2] = (((Math_imul(HEAP32[($8_1 + 84 | 0) >> 2] | 0, HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0) - 1 | 0;
      HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) + ((Math_imul(HEAP32[($8_1 + 84 | 0) >> 2] | 0, HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0) | 0;
      HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
      label$50 : {
       label$51 : while (1) {
        if ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 32768 | 0) {
         break label$50
        }
        HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
        label$52 : {
         if ((HEAP32[($8_1 + 60 | 0) >> 2] | 0) & 254 | 0) {
          break label$52
         }
         label$53 : {
          label$54 : {
           if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
            break label$54
           }
           $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
           label$55 : {
            label$56 : {
             if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
              break label$56
             }
             HEAP32[($8_1 + 68 | 0) >> 2] = -1;
             break label$55;
            }
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
           }
           break label$53;
          }
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
         }
         label$57 : {
          label$58 : {
           if ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 256 | 0) {
            break label$58
           }
           HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
           break label$57;
          }
          HEAP32[($8_1 + 60 | 0) >> 2] = 256;
         }
        }
        HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0 | (((HEAP32[($8_1 + 60 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
        HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
        continue label$51;
       };
      }
      HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
      HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 16 | 0 | (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
      HEAP32[($8_1 + 68 | 0) >> 2] = HEAP32[($8_1 + 88 | 0) >> 2] | 0;
      label$59 : {
       label$60 : while (1) {
        if (!(((HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 1073758208 | 0 | 0) == (16384 | 0) & 1 | 0)) {
         break label$59
        }
        HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) & -32770 | 0 | -2147418112 | 0;
        label$61 : {
         if ((HEAP32[($8_1 + 60 | 0) >> 2] | 0) & 254 | 0) {
          break label$61
         }
         label$62 : {
          label$63 : {
           if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
            break label$63
           }
           $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
           label$64 : {
            label$65 : {
             if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
              break label$65
             }
             HEAP32[($8_1 + 60 | 0) >> 2] = -1;
             break label$64;
            }
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 60 | 0) >> 2] = wasm2js_i32$1;
           }
           break label$62;
          }
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 60 | 0) >> 2] = wasm2js_i32$1;
         }
         label$66 : {
          label$67 : {
           if ((HEAP32[($8_1 + 60 | 0) >> 2] | 0) & 256 | 0) {
            break label$67
           }
           HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
           break label$66;
          }
          HEAP32[($8_1 + 60 | 0) >> 2] = 256;
         }
        }
        HEAP32[($8_1 + 44 | 0) >> 2] = ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0) ^ 32768 | 0 | (((HEAP32[($8_1 + 60 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
        HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
        continue label$60;
       };
      }
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0, (HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 65535 | 0 | 0);
      HEAP32[($8_1 + 96 | 0) >> 2] = 2;
      HEAP32[($8_1 + 84 | 0) >> 2] = 0;
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0, ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) >>> 16 | 0) & 65535 | 0 | 0);
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0, (HEAPU16[($8_1 + 42 | 0) >> 1] | 0) & 65535 | 0 | 0);
      $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0, HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0);
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 9834 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
      label$68 : while (1) {
       (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 96 | 0) >> 2] | 0) << 1 | 0) | 0) + 1600 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
       label$69 : {
        if (!(((HEAP32[($8_1 + 84 | 0) >> 2] | 0) + (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0 | 0) <= ((Math_imul(HEAP32[($8_1 + 88 | 0) >> 2] | 0, ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0) - (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0) | 0) + 1 | 0) + -1 | 0 | 0) / (((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0) | 0) & 65535 | 0) - (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0) | 0) + 1 | 0 | 0) | 0 | 0) & 1 | 0)) {
         break label$69
        }
        HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
        HEAP32[($8_1 + 96 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0;
       }
       label$70 : {
        label$71 : {
         if (!((255 | 0) < (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) & 1 | 0)) {
          break label$71
         }
         break label$70;
        }
        HEAP32[($8_1 + 96 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) << 1 | 0;
        continue label$68;
       }
       break label$68;
      };
      HEAP32[($8_1 + 92 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) - 256 | 0;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 60 | 0) >> 2] = wasm2js_i32$1;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0) | 0) & 65535 | 0) - (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0) + 1 | 0), HEAP32[(wasm2js_i32$0 + 72 | 0) >> 2] = wasm2js_i32$1;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = (((Math_imul(HEAP32[($8_1 + 72 | 0) >> 2] | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 92 | 0) >> 2] | 0) << 1 | 0) | 0) + 2112 | 0 | 0) | 0) & 65535 | 0) | 0) | 0) / (HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0) - 1 | 0), HEAP32[(wasm2js_i32$0 + 80 | 0) >> 2] = wasm2js_i32$1;
      HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) + ((Math_imul(HEAP32[($8_1 + 72 | 0) >> 2] | 0, HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0) | 0) | 0;
      HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0;
      label$72 : {
       label$73 : while (1) {
        if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 32768 | 0) {
         break label$72
        }
        HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
        label$74 : {
         if ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) & 254 | 0) {
          break label$74
         }
         label$75 : {
          label$76 : {
           if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
            break label$76
           }
           $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
           label$77 : {
            label$78 : {
             if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
              break label$78
             }
             HEAP32[($8_1 + 88 | 0) >> 2] = -1;
             break label$77;
            }
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
           }
           break label$75;
          }
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
         }
         label$79 : {
          label$80 : {
           if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 256 | 0) {
            break label$80
           }
           HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
           break label$79;
          }
          HEAP32[($8_1 + 44 | 0) >> 2] = 256;
         }
        }
        HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0 | (((HEAP32[($8_1 + 44 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
        HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0;
        continue label$73;
       };
      }
      HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 60 | 0) >> 2] | 0;
      HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 16 | 0 | (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0;
      HEAP32[($8_1 + 88 | 0) >> 2] = HEAP32[($8_1 + 68 | 0) >> 2] | 0;
      label$81 : {
       label$82 : while (1) {
        if (!(((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 1073758208 | 0 | 0) == (16384 | 0) & 1 | 0)) {
         break label$81
        }
        HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) & -32770 | 0 | -2147418112 | 0;
        label$83 : {
         if ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) & 254 | 0) {
          break label$83
         }
         label$84 : {
          label$85 : {
           if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
            break label$85
           }
           $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
           label$86 : {
            label$87 : {
             if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
              break label$87
             }
             HEAP32[($8_1 + 44 | 0) >> 2] = -1;
             break label$86;
            }
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
           }
           break label$84;
          }
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
         }
         label$88 : {
          label$89 : {
           if ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) & 256 | 0) {
            break label$89
           }
           HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
           break label$88;
          }
          HEAP32[($8_1 + 44 | 0) >> 2] = 256;
         }
        }
        HEAP32[($8_1 + 60 | 0) >> 2] = ((HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0) ^ 32768 | 0 | (((HEAP32[($8_1 + 44 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
        HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 60 | 0) >> 2] | 0;
        continue label$82;
       };
      }
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0, (HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 65535 | 0 | 0);
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0, ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) >>> 16 | 0) & 65535 | 0 | 0);
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0, (HEAPU16[($8_1 + 42 | 0) >> 1] | 0) & 65535 | 0 | 0);
      $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0, HEAP32[($8_1 + 44 | 0) >> 2] | 0 | 0);
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 96 | 0) >> 2] | 0) << 1 | 0) | 0) + 1600 | 0 | 0) | 0), HEAP16[(wasm2js_i32$0 + 102 | 0) >> 1] = wasm2js_i32$1;
      HEAP32[($8_1 + 84 | 0) >> 2] = HEAP32[($8_1 + 96 | 0) >> 2] | 0;
      label$90 : {
       label$91 : while (1) {
        if (!(HEAP32[($8_1 + 84 | 0) >> 2] | 0)) {
         break label$90
        }
        HEAP32[($8_1 + 72 | 0) >> 2] = ((HEAP32[($8_1 + 84 | 0) >> 2] | 0) << 1 | 0) + 1600 | 0;
        $1700 = 16;
        $1704 = 16;
        $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 32 | 0) >> 2] | 0) + (HEAP32[($8_1 + 72 | 0) >> 2] | 0) | 0 | 0, (((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 32 | 0) >> 2] | 0) + (HEAP32[($8_1 + 72 | 0) >> 2] | 0) | 0 | 0) | 0) << $1700 | 0) >> $1700 | 0) - (((HEAPU16[($8_1 + 102 | 0) >> 1] | 0) << $1704 | 0) >> $1704 | 0) | 0) & 65535 | 0 | 0);
        HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 84 | 0) >> 2] | 0) >> 1 | 0;
        continue label$91;
       };
      }
      label$92 : {
       label$93 : {
        if (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 9834 | 0 | 0) | 0) & 65535 | 0) {
         break label$93
        }
        $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10884 | 0 | 0, 0 | 0);
        break label$92;
       }
       $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10884 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10884 | 0 | 0) | 0) + 1 | 0 | 0);
      }
      HEAP32[($8_1 + 88 | 0) >> 2] = ((HEAP32[($8_1 + 96 | 0) >> 2] | 0) - 264 | 0) & ((0 - (((HEAP32[($8_1 + 92 | 0) >> 2] | 0) >>> 0 < 8 >>> 0 & 1 | 0) - ((HEAP32[($8_1 + 92 | 0) >> 2] | 0) >> 31 | 0) | 0) | 0) ^ -1 | 0) | 0;
      HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0) | 0;
      label$94 : while (1) {
       HEAP32[($8_1 + 72 | 0) >> 2] = 255;
       label$95 : {
        if (!(((HEAP32[($8_1 + 96 | 0) >> 2] | 0) + -248 | 0 | 0) < (255 | 0) & 1 | 0)) {
         break label$95
        }
        HEAP32[($8_1 + 72 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + -248 | 0;
       }
       label$96 : {
        label$97 : {
         if (!((HEAP32[($8_1 + 72 | 0) >> 2] | 0 | 0) <= (HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0) & 1 | 0)) {
          break label$97
         }
         break label$96;
        }
        label$98 : {
         if (!(($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 2112 | 0 | 0) | 0) & 65535 | 0)) {
          break label$98
         }
         $1795 = 16;
         $8(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 9832 | 0 | 0, 256 | 0, 1e3 | 0, (1 << $1795 | 0) >> $1795 | 0 | 0, HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0);
        }
        HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 2 | 0;
        HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) + 1 | 0;
        continue label$94;
       }
       break label$94;
      };
     }
     $1812 = 16;
     $8(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8808 | 0 | 0, 256 | 0, 1e3 | 0, (1 << $1812 | 0) >> $1812 | 0 | 0, HEAP32[($8_1 + 92 | 0) >> 2] | 0 | 0);
     label$99 : {
      if (!((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 92 | 0) >> 2] | 0) << 1 | 0) | 0) + 1088 | 0 | 0) | 0) & 65535 | 0 | 0) == (3 | 0) & 1 | 0)) {
       break label$99
      }
      HEAP32[($8_1 + 96 | 0) >> 2] = 1;
      label$100 : {
       if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10884 | 0 | 0) | 0) >>> 0 < 2 >>> 0 & 1 | 0)) {
        break label$100
       }
       (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10884 | 0 | 0) | 0) + -1 | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
      }
      $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10884 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10884 | 0 | 0) | 0) - (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0);
     }
     $1875 = 24;
     $3(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10952 | 0 | 0) | 0) + ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10916 | 0 | 0) | 0) | 0 | 0, (((HEAP32[($8_1 + 92 | 0) >> 2] | 0) << $1875 | 0) >> $1875 | 0) & 65535 | 0 | 0);
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8200 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
     $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8200 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
     $1899 = 24;
     $3(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0) + 4096 | 0 | 0, (((HEAP32[($8_1 + 92 | 0) >> 2] | 0) << $1899 | 0) >> $1899 | 0) & 65535 | 0 | 0);
     label$101 : {
      if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8200 | 0 | 0) | 0 | 0) == (4096 | 0) & 1 | 0)) {
       break label$101
      }
      $11(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
     }
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10916 | 0 | 0) | 0) + 1 | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
     $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10916 | 0 | 0, HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0);
     label$102 : {
      if (!((HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) == ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10908 | 0 | 0) | 0 | 0) & 1 | 0)) {
       break label$102
      }
      $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10916 | 0 | 0, 0 | 0);
      HEAP32[($8_1 + 24 | 0) >> 2] = 0;
      label$103 : {
       if (HEAP32[($8_1 + 112 | 0) >> 2] | 0) {
        break label$103
       }
       HEAP32[($8_1 + 24 | 0) >> 2] = 4;
      }
      label$104 : {
       label$105 : while (1) {
        if (!((((HEAP32[($8_1 + 112 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0) - (HEAP32[($8_1 + 24 | 0) >> 2] | 0) | 0 | 0) >= (HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0) & 1 | 0)) {
         break label$104
        }
        HEAP32[($8_1 + 28 | 0) >> 2] = (HEAP32[($8_1 + 28 | 0) >> 2] | 0) << 1 | 0;
        $1965 = $31(HEAP32[(HEAP32[($8_1 + 116 | 0) >> 2] | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0) | 0;
        HEAP32[(HEAP32[($8_1 + 116 | 0) >> 2] | 0) >> 2] = $1965;
        continue label$105;
       };
      }
      $38((HEAP32[(HEAP32[($8_1 + 116 | 0) >> 2] | 0) >> 2] | 0) + (HEAP32[($8_1 + 112 | 0) >> 2] | 0) | 0 | 0, (HEAP32[($8_1 + 136 | 0) >> 2] | 0) + ((($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10952 | 0 | 0) | 0) & 268435455 | 0) + (HEAP32[($8_1 + 24 | 0) >> 2] | 0) | 0) | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) - (HEAP32[($8_1 + 24 | 0) >> 2] | 0) | 0 | 0) | 0;
      HEAP32[($8_1 + 112 | 0) >> 2] = (HEAP32[($8_1 + 112 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 96 | 0) >> 2] | 0) - (HEAP32[($8_1 + 24 | 0) >> 2] | 0) | 0) | 0;
     }
     label$106 : {
      if (!((HEAP32[($8_1 + 36 | 0) >> 2] | 0 | 0) < (31200 | 0) & 1 | 0)) {
       break label$106
      }
      HEAP32[($8_1 + 36 | 0) >> 2] = (HEAP32[($8_1 + 36 | 0) >> 2] | 0) + 1 | 0;
     }
     continue label$3;
    };
   }
   label$107 : {
    label$108 : {
     if (!((HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0) <= (HEAP32[($8_1 + 84 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break label$108
     }
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 48 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[($8_1 + 68 | 0) >> 2] = (((Math_imul(HEAP32[($8_1 + 72 | 0) >> 2] | 0, HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0) - 1 | 0;
     HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) + ((Math_imul(HEAP32[($8_1 + 72 | 0) >> 2] | 0, HEAP32[($8_1 + 60 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0) | 0;
     HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
     label$109 : {
      label$110 : while (1) {
       if ((HEAP32[($8_1 + 60 | 0) >> 2] | 0) & 32768 | 0) {
        break label$109
       }
       HEAP32[($8_1 + 48 | 0) >> 2] = (HEAP32[($8_1 + 48 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
       label$111 : {
        if ((HEAP32[($8_1 + 48 | 0) >> 2] | 0) & 254 | 0) {
         break label$111
        }
        label$112 : {
         label$113 : {
          if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
           break label$113
          }
          $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
          label$114 : {
           label$115 : {
            if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
             break label$115
            }
            HEAP32[($8_1 + 48 | 0) >> 2] = -1;
            break label$114;
           }
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 36 | 0) >> 2] = wasm2js_i32$1;
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 36 | 0) >> 2] | 0) + 1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 36 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 48 | 0) >> 2] = wasm2js_i32$1;
          }
          break label$112;
         }
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 36 | 0) >> 2] = wasm2js_i32$1;
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 36 | 0) >> 2] | 0) + 1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 36 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 48 | 0) >> 2] = wasm2js_i32$1;
        }
        label$116 : {
         label$117 : {
          if ((HEAP32[($8_1 + 48 | 0) >> 2] | 0) & 256 | 0) {
           break label$117
          }
          HEAP32[($8_1 + 48 | 0) >> 2] = (HEAP32[($8_1 + 48 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
          break label$116;
         }
         HEAP32[($8_1 + 48 | 0) >> 2] = 256;
        }
       }
       HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0 | (((HEAP32[($8_1 + 48 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
       HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
       continue label$110;
      };
     }
     HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
     HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 16 | 0 | (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
     HEAP32[($8_1 + 68 | 0) >> 2] = HEAP32[($8_1 + 88 | 0) >> 2] | 0;
     label$118 : {
      label$119 : while (1) {
       if (!(((HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 1073758208 | 0 | 0) == (16384 | 0) & 1 | 0)) {
        break label$118
       }
       HEAP32[($8_1 + 48 | 0) >> 2] = (HEAP32[($8_1 + 48 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) & -32770 | 0 | -2147418112 | 0;
       label$120 : {
        if ((HEAP32[($8_1 + 48 | 0) >> 2] | 0) & 254 | 0) {
         break label$120
        }
        label$121 : {
         label$122 : {
          if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
           break label$122
          }
          $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
          label$123 : {
           label$124 : {
            if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
             break label$124
            }
            HEAP32[($8_1 + 48 | 0) >> 2] = -1;
            break label$123;
           }
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 36 | 0) >> 2] = wasm2js_i32$1;
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 36 | 0) >> 2] | 0) + 1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 36 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 48 | 0) >> 2] = wasm2js_i32$1;
          }
          break label$121;
         }
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 36 | 0) >> 2] = wasm2js_i32$1;
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 36 | 0) >> 2] | 0) + 1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 36 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 48 | 0) >> 2] = wasm2js_i32$1;
        }
        label$125 : {
         label$126 : {
          if ((HEAP32[($8_1 + 48 | 0) >> 2] | 0) & 256 | 0) {
           break label$126
          }
          HEAP32[($8_1 + 48 | 0) >> 2] = (HEAP32[($8_1 + 48 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
          break label$125;
         }
         HEAP32[($8_1 + 48 | 0) >> 2] = 256;
        }
       }
       HEAP32[($8_1 + 44 | 0) >> 2] = ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0) ^ 32768 | 0 | (((HEAP32[($8_1 + 48 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
       HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
       continue label$119;
      };
     }
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0, (HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 65535 | 0 | 0);
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0, ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) >>> 16 | 0) & 65535 | 0 | 0);
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0, (HEAPU16[($8_1 + 42 | 0) >> 1] | 0) & 65535 | 0 | 0);
     $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0, HEAP32[($8_1 + 48 | 0) >> 2] | 0 | 0);
     $11(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
     HEAP32[($8_1 + 20 | 0) >> 2] = 0;
     label$127 : {
      if (HEAP32[($8_1 + 112 | 0) >> 2] | 0) {
       break label$127
      }
      HEAP32[($8_1 + 20 | 0) >> 2] = 4;
     }
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10916 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 16 | 0) >> 2] = wasm2js_i32$1;
     label$128 : {
      label$129 : while (1) {
       if (!((((HEAP32[($8_1 + 112 | 0) >> 2] | 0) + (HEAP32[($8_1 + 16 | 0) >> 2] | 0) | 0) - (HEAP32[($8_1 + 20 | 0) >> 2] | 0) | 0 | 0) >= (HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0) & 1 | 0)) {
        break label$128
       }
       HEAP32[($8_1 + 28 | 0) >> 2] = (HEAP32[($8_1 + 28 | 0) >> 2] | 0) << 1 | 0;
       $2339 = $31(HEAP32[(HEAP32[($8_1 + 116 | 0) >> 2] | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0) | 0;
       HEAP32[(HEAP32[($8_1 + 116 | 0) >> 2] | 0) >> 2] = $2339;
       continue label$129;
      };
     }
     $38((HEAP32[(HEAP32[($8_1 + 116 | 0) >> 2] | 0) >> 2] | 0) + (HEAP32[($8_1 + 112 | 0) >> 2] | 0) | 0 | 0, (HEAP32[($8_1 + 136 | 0) >> 2] | 0) + ((($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10952 | 0 | 0) | 0) & 268435455 | 0) + (HEAP32[($8_1 + 20 | 0) >> 2] | 0) | 0) | 0 | 0, (HEAP32[($8_1 + 16 | 0) >> 2] | 0) - (HEAP32[($8_1 + 20 | 0) >> 2] | 0) | 0 | 0) | 0;
     HEAP32[($8_1 + 112 | 0) >> 2] = (HEAP32[($8_1 + 112 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 16 | 0) >> 2] | 0) - (HEAP32[($8_1 + 20 | 0) >> 2] | 0) | 0) | 0;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8212 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 140 | 0) >> 2] = wasm2js_i32$1;
     break label$107;
    }
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 80 | 0) >> 2] = wasm2js_i32$1;
    HEAP32[($8_1 + 92 | 0) >> 2] = (((Math_imul(HEAP32[($8_1 + 72 | 0) >> 2] | 0, HEAP32[($8_1 + 60 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0) - 1 | 0;
    HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) + ((Math_imul(HEAP32[($8_1 + 72 | 0) >> 2] | 0, HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0) | 0;
    HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 92 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
    label$130 : {
     label$131 : while (1) {
      if ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 32768 | 0) {
       break label$130
      }
      HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 1 | 0;
      HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
      HEAP32[($8_1 + 92 | 0) >> 2] = (HEAP32[($8_1 + 92 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
      label$132 : {
       if ((HEAP32[($8_1 + 80 | 0) >> 2] | 0) & 254 | 0) {
        break label$132
       }
       label$133 : {
        label$134 : {
         if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
          break label$134
         }
         $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
         label$135 : {
          label$136 : {
           if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
            break label$136
           }
           HEAP32[($8_1 + 68 | 0) >> 2] = -1;
           break label$135;
          }
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
         }
         break label$133;
        }
        $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
        (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
        $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
        (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
       }
       label$137 : {
        label$138 : {
         if ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 256 | 0) {
          break label$138
         }
         HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
         break label$137;
        }
        HEAP32[($8_1 + 80 | 0) >> 2] = 256;
       }
      }
      HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0 | (((HEAP32[($8_1 + 80 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
      HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 92 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
      continue label$131;
     };
    }
    HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
    HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 92 | 0) >> 2] | 0) << 16 | 0 | (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
    HEAP32[($8_1 + 68 | 0) >> 2] = HEAP32[($8_1 + 88 | 0) >> 2] | 0;
    label$139 : {
     label$140 : while (1) {
      if (!(((HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 1073758208 | 0 | 0) == (16384 | 0) & 1 | 0)) {
       break label$139
      }
      HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 1 | 0;
      HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
      HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) & -32770 | 0 | -2147418112 | 0;
      label$141 : {
       if ((HEAP32[($8_1 + 80 | 0) >> 2] | 0) & 254 | 0) {
        break label$141
       }
       label$142 : {
        label$143 : {
         if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
          break label$143
         }
         $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
         label$144 : {
          label$145 : {
           if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
            break label$145
           }
           HEAP32[($8_1 + 80 | 0) >> 2] = -1;
           break label$144;
          }
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 80 | 0) >> 2] = wasm2js_i32$1;
         }
         break label$142;
        }
        $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
        (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
        $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
        (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 80 | 0) >> 2] = wasm2js_i32$1;
       }
       label$146 : {
        label$147 : {
         if ((HEAP32[($8_1 + 80 | 0) >> 2] | 0) & 256 | 0) {
          break label$147
         }
         HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
         break label$146;
        }
        HEAP32[($8_1 + 80 | 0) >> 2] = 256;
       }
      }
      HEAP32[($8_1 + 44 | 0) >> 2] = ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0) ^ 32768 | 0 | (((HEAP32[($8_1 + 80 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
      HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
      continue label$140;
     };
    }
    $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0, (HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 65535 | 0 | 0);
    $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0, ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) >>> 16 | 0) & 65535 | 0 | 0);
    $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0, (HEAPU16[($8_1 + 42 | 0) >> 1] | 0) & 65535 | 0 | 0);
    $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0, HEAP32[($8_1 + 80 | 0) >> 2] | 0 | 0);
    $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2626 | 0 | 0, ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2626 | 0 | 0) | 0) & 65535 | 0) + 40 | 0) & 65535 | 0 | 0);
    label$148 : {
     if (!(5999 >>> 0 < (HEAP32[($8_1 + 60 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
      break label$148
     }
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2624 | 0 | 0, ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2624 | 0 | 0) | 0) & 65535 | 0) >> 1 | 0) & 65535 | 0 | 0);
     label$149 : {
      if (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2624 | 0 | 0) | 0) & 65535 | 0) {
       break label$149
      }
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2624 | 0 | 0, 1 & 65535 | 0 | 0);
     }
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2626 | 0 | 0, ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2626 | 0 | 0) | 0) & 65535 | 0) >> 1 | 0) & 65535 | 0 | 0);
     label$150 : {
      if (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2626 | 0 | 0) | 0) & 65535 | 0) {
       break label$150
      }
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 2626 | 0 | 0, 1 & 65535 | 0 | 0);
     }
    }
    HEAP32[($8_1 + 48 | 0) >> 2] = ((HEAP32[($8_1 + 48 | 0) >> 2] | 0) & 1 | 0) << 1 | 0 | 1 | 0;
    label$151 : {
     label$152 : while (1) {
      if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10876 | 0 | 0) | 0 | 0) < (HEAP32[($8_1 + 36 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break label$151
      }
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10880 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 12 | 0) >> 2] = wasm2js_i32$1;
      $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10880 | 0 | 0, (HEAP32[($8_1 + 12 | 0) >> 2] | 0) + 1 | 0 | 0);
      $2792 = 16;
      $8(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8744 | 0 | 0, 16 | 0, 6e3 | 0, (24 << $2792 | 0) >> $2792 | 0 | 0, HEAP32[($8_1 + 12 | 0) >> 2] | 0 | 0);
      $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10876 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10876 | 0 | 0) | 0) << 1 | 0 | 0);
      continue label$152;
     };
    }
    HEAP32[($8_1 + 96 | 0) >> 2] = 2;
    HEAP32[($8_1 + 84 | 0) >> 2] = 0;
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8746 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
    label$153 : while (1) {
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 96 | 0) >> 2] | 0) << 1 | 0) | 0) + 512 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
     label$154 : {
      if (!(((HEAP32[($8_1 + 84 | 0) >> 2] | 0) + (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0 | 0) <= ((Math_imul(HEAP32[($8_1 + 88 | 0) >> 2] | 0, ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0) - (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0) | 0) + 1 | 0) + -1 | 0 | 0) / (((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0) | 0) & 65535 | 0) - (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0) | 0) + 1 | 0 | 0) | 0 | 0) & 1 | 0)) {
       break label$154
      }
      HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
      HEAP32[($8_1 + 96 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0;
     }
     label$155 : {
      label$156 : {
       if (!((15 | 0) < (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) & 1 | 0)) {
        break label$156
       }
       break label$155;
      }
      HEAP32[($8_1 + 96 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) << 1 | 0;
      continue label$153;
     }
     break label$153;
    };
    HEAP32[($8_1 + 92 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) - 16 | 0;
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 60 | 0) >> 2] = wasm2js_i32$1;
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0) | 0) & 65535 | 0) - (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0) + 1 | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = (((Math_imul(HEAP32[($8_1 + 96 | 0) >> 2] | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 92 | 0) >> 2] | 0) << 1 | 0) | 0) + 544 | 0 | 0) | 0) & 65535 | 0) | 0) | 0) / (HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0) - 1 | 0), HEAP32[(wasm2js_i32$0 + 80 | 0) >> 2] = wasm2js_i32$1;
    HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) + ((Math_imul(HEAP32[($8_1 + 96 | 0) >> 2] | 0, HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0) | 0) | 0;
    HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0;
    label$157 : {
     label$158 : while (1) {
      if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 32768 | 0) {
       break label$157
      }
      HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
      HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0;
      HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
      label$159 : {
       if ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) & 254 | 0) {
        break label$159
       }
       label$160 : {
        label$161 : {
         if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
          break label$161
         }
         $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
         label$162 : {
          label$163 : {
           if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
            break label$163
           }
           HEAP32[($8_1 + 88 | 0) >> 2] = -1;
           break label$162;
          }
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
         }
         break label$160;
        }
        $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
        (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
        $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
        (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
       }
       label$164 : {
        label$165 : {
         if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 256 | 0) {
          break label$165
         }
         HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
         break label$164;
        }
        HEAP32[($8_1 + 44 | 0) >> 2] = 256;
       }
      }
      HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0 | (((HEAP32[($8_1 + 44 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
      HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0;
      continue label$158;
     };
    }
    HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 60 | 0) >> 2] | 0;
    HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 16 | 0 | (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0;
    HEAP32[($8_1 + 88 | 0) >> 2] = HEAP32[($8_1 + 68 | 0) >> 2] | 0;
    label$166 : {
     label$167 : while (1) {
      if (!(((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 1073758208 | 0 | 0) == (16384 | 0) & 1 | 0)) {
       break label$166
      }
      HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
      HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0;
      HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) & -32770 | 0 | -2147418112 | 0;
      label$168 : {
       if ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) & 254 | 0) {
        break label$168
       }
       label$169 : {
        label$170 : {
         if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
          break label$170
         }
         $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
         label$171 : {
          label$172 : {
           if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
            break label$172
           }
           HEAP32[($8_1 + 44 | 0) >> 2] = -1;
           break label$171;
          }
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
         }
         break label$169;
        }
        $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
        (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
        $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
        (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
       }
       label$173 : {
        label$174 : {
         if ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) & 256 | 0) {
          break label$174
         }
         HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
         break label$173;
        }
        HEAP32[($8_1 + 44 | 0) >> 2] = 256;
       }
      }
      HEAP32[($8_1 + 60 | 0) >> 2] = ((HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0) ^ 32768 | 0 | (((HEAP32[($8_1 + 44 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
      HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 60 | 0) >> 2] | 0;
      continue label$167;
     };
    }
    $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0, (HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 65535 | 0 | 0);
    $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0, ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) >>> 16 | 0) & 65535 | 0 | 0);
    $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0, (HEAPU16[($8_1 + 42 | 0) >> 1] | 0) & 65535 | 0 | 0);
    $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0, HEAP32[($8_1 + 44 | 0) >> 2] | 0 | 0);
    $3242 = 16;
    $8(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8744 | 0 | 0, 16 | 0, 6e3 | 0, (24 << $3242 | 0) >> $3242 | 0 | 0, HEAP32[($8_1 + 92 | 0) >> 2] | 0 | 0);
    label$175 : {
     if (!((1 | 0) < (HEAP32[($8_1 + 92 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break label$175
     }
     HEAP32[($8_1 + 96 | 0) >> 2] = 1;
     label$176 : {
      label$177 : {
       if (!(HEAP32[($8_1 + 92 | 0) >> 2] | 0)) {
        break label$177
       }
       HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 92 | 0) >> 2] | 0) >>> 3 | 0;
       label$178 : {
        if (!(HEAP32[($8_1 + 88 | 0) >> 2] | 0)) {
         break label$178
        }
        label$179 : while (1) {
         HEAP32[($8_1 + 96 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) << 8 | 0;
         HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) - 1 | 0;
         if (HEAP32[($8_1 + 88 | 0) >> 2] | 0) {
          continue label$179
         }
         break label$179;
        };
        HEAP32[($8_1 + 92 | 0) >> 2] = (HEAP32[($8_1 + 92 | 0) >> 2] | 0) & 7 | 0;
        label$180 : {
         if (HEAP32[($8_1 + 92 | 0) >> 2] | 0) {
          break label$180
         }
         break label$176;
        }
       }
       label$181 : while (1) {
        HEAP32[($8_1 + 96 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 92 | 0) >> 2] = (HEAP32[($8_1 + 92 | 0) >> 2] | 0) - 1 | 0;
        if (HEAP32[($8_1 + 92 | 0) >> 2] | 0) {
         continue label$181
        }
        break label$181;
       };
      }
     }
     HEAP32[($8_1 + 96 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) >> 1 | 0;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10876 | 0 | 0) | 0) >> 1 | 0), HEAP32[(wasm2js_i32$0 + 72 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[($8_1 + 84 | 0) >> 2] = HEAP32[($8_1 + 96 | 0) >> 2] | 0;
     label$182 : {
      if (!((HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) == (HEAP32[($8_1 + 72 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break label$182
      }
      HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 36 | 0) >> 2] | 0) - (HEAP32[($8_1 + 72 | 0) >> 2] | 0) | 0;
     }
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0) | 0) & 65535 | 0) - (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0) + 1 | 0), HEAP32[(wasm2js_i32$0 + 72 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[($8_1 + 52 | 0) >> 2] = (Math_imul(HEAP32[($8_1 + 84 | 0) >> 2] | 0, ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) - (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0) + 1 | 0) + -1 | 0 | 0) / (HEAP32[($8_1 + 72 | 0) >> 2] | 0 | 0) | 0;
     HEAP32[($8_1 + 60 | 0) >> 2] = (((Math_imul(HEAP32[($8_1 + 72 | 0) >> 2] | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + 1 | 0) | 0) / (HEAP32[($8_1 + 84 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0) - 1 | 0;
     HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) + ((Math_imul(HEAP32[($8_1 + 72 | 0) >> 2] | 0, HEAP32[($8_1 + 52 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 84 | 0) >> 2] | 0 | 0) | 0) | 0;
     HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
     label$183 : {
      label$184 : while (1) {
       if ((HEAP32[($8_1 + 80 | 0) >> 2] | 0) & 32768 | 0) {
        break label$183
       }
       HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
       label$185 : {
        if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 254 | 0) {
         break label$185
        }
        label$186 : {
         label$187 : {
          if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
           break label$187
          }
          $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
          label$188 : {
           label$189 : {
            if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
             break label$189
            }
            HEAP32[($8_1 + 88 | 0) >> 2] = -1;
            break label$188;
           }
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
          }
          break label$186;
         }
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
        }
        label$190 : {
         label$191 : {
          if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 256 | 0) {
           break label$191
          }
          HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
          break label$190;
         }
         HEAP32[($8_1 + 88 | 0) >> 2] = 256;
        }
       }
       HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0 | (((HEAP32[($8_1 + 88 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
       HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
       continue label$184;
      };
     }
     HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 68 | 0) >> 2] | 0;
     HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 16 | 0 | (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
     HEAP32[($8_1 + 60 | 0) >> 2] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
     label$192 : {
      label$193 : while (1) {
       if (!(((HEAP32[($8_1 + 60 | 0) >> 2] | 0) & 1073758208 | 0 | 0) == (16384 | 0) & 1 | 0)) {
        break label$192
       }
       HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) & -32770 | 0 | -2147418112 | 0;
       label$194 : {
        if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 254 | 0) {
         break label$194
        }
        label$195 : {
         label$196 : {
          if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
           break label$196
          }
          $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
          label$197 : {
           label$198 : {
            if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
             break label$198
            }
            HEAP32[($8_1 + 88 | 0) >> 2] = -1;
            break label$197;
           }
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
          }
          break label$195;
         }
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
        }
        label$199 : {
         label$200 : {
          if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 256 | 0) {
           break label$200
          }
          HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
          break label$199;
         }
         HEAP32[($8_1 + 88 | 0) >> 2] = 256;
        }
       }
       HEAP32[($8_1 + 68 | 0) >> 2] = ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0) ^ 32768 | 0 | (((HEAP32[($8_1 + 88 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
       HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 68 | 0) >> 2] | 0;
       continue label$193;
      };
     }
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0, (HEAP32[($8_1 + 44 | 0) >> 2] | 0) & 65535 | 0 | 0);
     HEAP32[($8_1 + 92 | 0) >> 2] = (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0;
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0, ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) >>> 16 | 0) & 65535 | 0 | 0);
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0, (HEAPU16[($8_1 + 42 | 0) >> 1] | 0) & 65535 | 0 | 0);
     $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0, HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0);
    }
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8234 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) + ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10888 | 0 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0) | 0) & 65535 | 0) - (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0) + 1 | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
    HEAP32[($8_1 + 72 | 0) >> 2] = (Math_imul(HEAP32[($8_1 + 96 | 0) >> 2] | 0, ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) - (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0) + 1 | 0) + -1 | 0 | 0) / (HEAP32[($8_1 + 84 | 0) >> 2] | 0 | 0) | 0;
    label$201 : {
     label$202 : {
      if (!((HEAP32[($8_1 + 72 | 0) >> 2] | 0 | 0) < (HEAP32[($8_1 + 68 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break label$202
      }
      HEAP32[($8_1 + 84 | 0) >> 2] = 2;
      HEAP32[($8_1 + 52 | 0) >> 2] = 0;
      label$203 : while (1) {
       (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 84 | 0) >> 2] | 0) << 1 | 0) | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
       label$204 : {
        if (!(((HEAP32[($8_1 + 52 | 0) >> 2] | 0) + (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0 | 0) <= (HEAP32[($8_1 + 72 | 0) >> 2] | 0 | 0) & 1 | 0)) {
         break label$204
        }
        HEAP32[($8_1 + 52 | 0) >> 2] = (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
        HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0;
       }
       label$205 : {
        label$206 : {
         if (!((63 | 0) < (HEAP32[($8_1 + 84 | 0) >> 2] | 0 | 0) & 1 | 0)) {
          break label$206
         }
         break label$205;
        }
        HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 84 | 0) >> 2] | 0) << 1 | 0;
        continue label$203;
       }
       break label$203;
      };
      HEAP32[($8_1 + 56 | 0) >> 2] = (HEAP32[($8_1 + 84 | 0) >> 2] | 0) - 64 | 0;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0) | 0) & 65535 | 0) - (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0) + 1 | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = (((Math_imul(HEAP32[($8_1 + 84 | 0) >> 2] | 0, (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 56 | 0) >> 2] | 0) << 1 | 0) | 0) + 128 | 0 | 0) | 0) & 65535 | 0) | 0) | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0) - 1 | 0), HEAP32[(wasm2js_i32$0 + 60 | 0) >> 2] = wasm2js_i32$1;
      HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) + ((Math_imul(HEAP32[($8_1 + 84 | 0) >> 2] | 0, HEAP32[($8_1 + 52 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0) | 0;
      HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
      label$207 : {
       label$208 : while (1) {
        if ((HEAP32[($8_1 + 80 | 0) >> 2] | 0) & 32768 | 0) {
         break label$207
        }
        HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
        label$209 : {
         if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 254 | 0) {
          break label$209
         }
         label$210 : {
          label$211 : {
           if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
            break label$211
           }
           $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
           label$212 : {
            label$213 : {
             if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
              break label$213
             }
             HEAP32[($8_1 + 88 | 0) >> 2] = -1;
             break label$212;
            }
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
           }
           break label$210;
          }
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
         }
         label$214 : {
          label$215 : {
           if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 256 | 0) {
            break label$215
           }
           HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
           break label$214;
          }
          HEAP32[($8_1 + 88 | 0) >> 2] = 256;
         }
        }
        HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0 | (((HEAP32[($8_1 + 88 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
        HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
        continue label$208;
       };
      }
      HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 68 | 0) >> 2] | 0;
      HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 16 | 0 | (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
      HEAP32[($8_1 + 60 | 0) >> 2] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
      label$216 : {
       label$217 : while (1) {
        if (!(((HEAP32[($8_1 + 60 | 0) >> 2] | 0) & 1073758208 | 0 | 0) == (16384 | 0) & 1 | 0)) {
         break label$216
        }
        HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) & -32770 | 0 | -2147418112 | 0;
        label$218 : {
         if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 254 | 0) {
          break label$218
         }
         label$219 : {
          label$220 : {
           if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
            break label$220
           }
           $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
           label$221 : {
            label$222 : {
             if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
              break label$222
             }
             HEAP32[($8_1 + 88 | 0) >> 2] = -1;
             break label$221;
            }
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
           }
           break label$219;
          }
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
         }
         label$223 : {
          label$224 : {
           if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 256 | 0) {
            break label$224
           }
           HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
           break label$223;
          }
          HEAP32[($8_1 + 88 | 0) >> 2] = 256;
         }
        }
        HEAP32[($8_1 + 68 | 0) >> 2] = ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0) ^ 32768 | 0 | (((HEAP32[($8_1 + 88 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
        HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 68 | 0) >> 2] | 0;
        continue label$217;
       };
      }
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0, (HEAP32[($8_1 + 44 | 0) >> 2] | 0) & 65535 | 0 | 0);
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0, ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) >>> 16 | 0) & 65535 | 0 | 0);
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0, (HEAPU16[($8_1 + 42 | 0) >> 1] | 0) & 65535 | 0 | 0);
      $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0, HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0);
      break label$201;
     }
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 60 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[($8_1 + 80 | 0) >> 2] = (((Math_imul(HEAP32[($8_1 + 84 | 0) >> 2] | 0, HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0) - 1 | 0;
     HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) + ((Math_imul(HEAP32[($8_1 + 84 | 0) >> 2] | 0, HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0) | 0;
     HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
     label$225 : {
      label$226 : while (1) {
       if ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 32768 | 0) {
        break label$225
       }
       HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
       label$227 : {
        if ((HEAP32[($8_1 + 60 | 0) >> 2] | 0) & 254 | 0) {
         break label$227
        }
        label$228 : {
         label$229 : {
          if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
           break label$229
          }
          $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
          label$230 : {
           label$231 : {
            if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
             break label$231
            }
            HEAP32[($8_1 + 68 | 0) >> 2] = -1;
            break label$230;
           }
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
          }
          break label$228;
         }
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
        }
        label$232 : {
         label$233 : {
          if ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 256 | 0) {
           break label$233
          }
          HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
          break label$232;
         }
         HEAP32[($8_1 + 60 | 0) >> 2] = 256;
        }
       }
       HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0 | (((HEAP32[($8_1 + 60 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
       HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
       continue label$226;
      };
     }
     HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
     HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 16 | 0 | (HEAP32[($8_1 + 88 | 0) >> 2] | 0) | 0;
     HEAP32[($8_1 + 68 | 0) >> 2] = HEAP32[($8_1 + 88 | 0) >> 2] | 0;
     label$234 : {
      label$235 : while (1) {
       if (!(((HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 1073758208 | 0 | 0) == (16384 | 0) & 1 | 0)) {
        break label$234
       }
       HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) & -32770 | 0 | -2147418112 | 0;
       label$236 : {
        if ((HEAP32[($8_1 + 60 | 0) >> 2] | 0) & 254 | 0) {
         break label$236
        }
        label$237 : {
         label$238 : {
          if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
           break label$238
          }
          $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
          label$239 : {
           label$240 : {
            if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
             break label$240
            }
            HEAP32[($8_1 + 60 | 0) >> 2] = -1;
            break label$239;
           }
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 60 | 0) >> 2] = wasm2js_i32$1;
          }
          break label$237;
         }
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 60 | 0) >> 2] = wasm2js_i32$1;
        }
        label$241 : {
         label$242 : {
          if ((HEAP32[($8_1 + 60 | 0) >> 2] | 0) & 256 | 0) {
           break label$242
          }
          HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
          break label$241;
         }
         HEAP32[($8_1 + 60 | 0) >> 2] = 256;
        }
       }
       HEAP32[($8_1 + 44 | 0) >> 2] = ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0) ^ 32768 | 0 | (((HEAP32[($8_1 + 60 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
       HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
       continue label$235;
      };
     }
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0, (HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 65535 | 0 | 0);
     HEAP32[($8_1 + 96 | 0) >> 2] = 2;
     HEAP32[($8_1 + 84 | 0) >> 2] = 0;
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0, ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) >>> 16 | 0) & 65535 | 0 | 0);
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0, (HEAPU16[($8_1 + 42 | 0) >> 1] | 0) & 65535 | 0 | 0);
     $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0, HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0);
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8490 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
     label$243 : while (1) {
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 96 | 0) >> 2] | 0) << 1 | 0) | 0) + 256 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
      label$244 : {
       if (!(((HEAP32[($8_1 + 84 | 0) >> 2] | 0) + (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0 | 0) <= ((Math_imul(HEAP32[($8_1 + 88 | 0) >> 2] | 0, ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0) - (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0) | 0) + 1 | 0) + -1 | 0 | 0) / (((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0) | 0) & 65535 | 0) - (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0) | 0) + 1 | 0 | 0) | 0 | 0) & 1 | 0)) {
        break label$244
       }
       HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
       HEAP32[($8_1 + 96 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0;
      }
      label$245 : {
       label$246 : {
        if (!((63 | 0) < (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) & 1 | 0)) {
         break label$246
        }
        break label$245;
       }
       HEAP32[($8_1 + 96 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) << 1 | 0;
       continue label$243;
      }
      break label$243;
     };
     HEAP32[($8_1 + 56 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) - 64 | 0;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 60 | 0) >> 2] = wasm2js_i32$1;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0) | 0) & 65535 | 0) - (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0) + 1 | 0), HEAP32[(wasm2js_i32$0 + 72 | 0) >> 2] = wasm2js_i32$1;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = (((Math_imul(HEAP32[($8_1 + 72 | 0) >> 2] | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 56 | 0) >> 2] | 0) << 1 | 0) | 0) + 384 | 0 | 0) | 0) & 65535 | 0) | 0) | 0) / (HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0) - 1 | 0), HEAP32[(wasm2js_i32$0 + 80 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) + ((Math_imul(HEAP32[($8_1 + 72 | 0) >> 2] | 0, HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0) / (HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0) | 0) | 0;
     HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0;
     label$247 : {
      label$248 : while (1) {
       if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 32768 | 0) {
        break label$247
       }
       HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
       label$249 : {
        if ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) & 254 | 0) {
         break label$249
        }
        label$250 : {
         label$251 : {
          if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
           break label$251
          }
          $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
          label$252 : {
           label$253 : {
            if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
             break label$253
            }
            HEAP32[($8_1 + 88 | 0) >> 2] = -1;
            break label$252;
           }
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
          }
          break label$250;
         }
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
        }
        label$254 : {
         label$255 : {
          if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 256 | 0) {
           break label$255
          }
          HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
          break label$254;
         }
         HEAP32[($8_1 + 44 | 0) >> 2] = 256;
        }
       }
       HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0 | (((HEAP32[($8_1 + 44 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
       HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0;
       continue label$248;
      };
     }
     HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 60 | 0) >> 2] | 0;
     HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 80 | 0) >> 2] | 0) << 16 | 0 | (HEAP32[($8_1 + 68 | 0) >> 2] | 0) | 0;
     HEAP32[($8_1 + 88 | 0) >> 2] = HEAP32[($8_1 + 68 | 0) >> 2] | 0;
     label$256 : {
      label$257 : while (1) {
       if (!(((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 1073758208 | 0 | 0) == (16384 | 0) & 1 | 0)) {
        break label$256
       }
       HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0;
       HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) & -32770 | 0 | -2147418112 | 0;
       label$258 : {
        if ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) & 254 | 0) {
         break label$258
        }
        label$259 : {
         label$260 : {
          if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
           break label$260
          }
          $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
          label$261 : {
           label$262 : {
            if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
             break label$262
            }
            HEAP32[($8_1 + 44 | 0) >> 2] = -1;
            break label$261;
           }
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
           $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0 | 0);
           (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
          }
          break label$259;
         }
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
         $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0 | 0);
         (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
        }
        label$263 : {
         label$264 : {
          if ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) & 256 | 0) {
           break label$264
          }
          HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
          break label$263;
         }
         HEAP32[($8_1 + 44 | 0) >> 2] = 256;
        }
       }
       HEAP32[($8_1 + 60 | 0) >> 2] = ((HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0) ^ 32768 | 0 | (((HEAP32[($8_1 + 44 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
       HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 60 | 0) >> 2] | 0;
       continue label$257;
      };
     }
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0, (HEAP32[($8_1 + 68 | 0) >> 2] | 0) & 65535 | 0 | 0);
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0, ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) >>> 16 | 0) & 65535 | 0 | 0);
     $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0, (HEAPU16[($8_1 + 42 | 0) >> 1] | 0) & 65535 | 0 | 0);
     $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0, HEAP32[($8_1 + 44 | 0) >> 2] | 0 | 0);
     (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 96 | 0) >> 2] | 0) << 1 | 0) | 0) + 256 | 0 | 0) | 0), HEAP16[(wasm2js_i32$0 + 102 | 0) >> 1] = wasm2js_i32$1;
     HEAP32[($8_1 + 84 | 0) >> 2] = HEAP32[($8_1 + 96 | 0) >> 2] | 0;
     label$265 : {
      label$266 : while (1) {
       if (!(HEAP32[($8_1 + 84 | 0) >> 2] | 0)) {
        break label$265
       }
       HEAP32[($8_1 + 72 | 0) >> 2] = ((HEAP32[($8_1 + 84 | 0) >> 2] | 0) << 1 | 0) + 256 | 0;
       $4839 = 16;
       $4843 = 16;
       $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 32 | 0) >> 2] | 0) + (HEAP32[($8_1 + 72 | 0) >> 2] | 0) | 0 | 0, (((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 32 | 0) >> 2] | 0) + (HEAP32[($8_1 + 72 | 0) >> 2] | 0) | 0 | 0) | 0) << $4839 | 0) >> $4839 | 0) - (((HEAPU16[($8_1 + 102 | 0) >> 1] | 0) << $4843 | 0) >> $4843 | 0) | 0) & 65535 | 0 | 0);
       HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 84 | 0) >> 2] | 0) >> 1 | 0;
       continue label$266;
      };
     }
     label$267 : {
      label$268 : {
       if (($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8490 | 0 | 0) | 0) & 65535 | 0) {
        break label$268
       }
       $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10888 | 0 | 0, 0 | 0);
       break label$267;
      }
      $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10888 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10888 | 0 | 0) | 0) + 8 | 0 | 0);
     }
     HEAP32[($8_1 + 88 | 0) >> 2] = ((HEAP32[($8_1 + 96 | 0) >> 2] | 0) - 68 | 0) & ((0 - (((HEAP32[($8_1 + 56 | 0) >> 2] | 0) >>> 0 < 4 >>> 0 & 1 | 0) - ((HEAP32[($8_1 + 56 | 0) >> 2] | 0) >> 31 | 0) | 0) | 0) ^ -1 | 0) | 0;
     HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0) | 0;
     label$269 : while (1) {
      HEAP32[($8_1 + 72 | 0) >> 2] = 63;
      label$270 : {
       if (!(((HEAP32[($8_1 + 96 | 0) >> 2] | 0) + -60 | 0 | 0) < (63 | 0) & 1 | 0)) {
        break label$270
       }
       HEAP32[($8_1 + 72 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + -60 | 0;
      }
      label$271 : {
       label$272 : {
        if (!((HEAP32[($8_1 + 72 | 0) >> 2] | 0 | 0) <= (HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0) & 1 | 0)) {
         break label$272
        }
        break label$271;
       }
       label$273 : {
        if (!(($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 384 | 0 | 0) | 0) & 65535 | 0)) {
         break label$273
        }
        $4934 = 16;
        $8(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8488 | 0 | 0, 64 | 0, 6e3 | 0, (1 << $4934 | 0) >> $4934 | 0 | 0, HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0);
       }
       HEAP32[($8_1 + 84 | 0) >> 2] = (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 2 | 0;
       HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) + 1 | 0;
       continue label$269;
      }
      break label$269;
     };
    }
    $4949 = 16;
    $8(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 32 | 0) >> 2] | 0 | 0, 64 | 0, 6e3 | 0, (8 << $4949 | 0) >> $4949 | 0 | 0, HEAP32[($8_1 + 56 | 0) >> 2] | 0 | 0);
    label$274 : {
     if (!((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 56 | 0) >> 2] | 0) << 1 | 0) | 0) + 128 | 0 | 0) | 0) & 65535 | 0 | 0) == (24 | 0) & 1 | 0)) {
      break label$274
     }
     HEAP32[($8_1 + 96 | 0) >> 2] = 8;
     label$275 : {
      if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10888 | 0 | 0) | 0) >>> 0 < 9 >>> 0 & 1 | 0)) {
       break label$275
      }
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10888 | 0 | 0) | 0) + -1 | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
     }
     $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10888 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10888 | 0 | 0) | 0) - (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0);
    }
    label$276 : {
     label$277 : {
      if (!((HEAP32[($8_1 + 56 | 0) >> 2] | 0 | 0) == (15 | 0) & 1 | 0)) {
       break label$277
      }
      HEAP32[($8_1 + 56 | 0) >> 2] = 783;
      break label$276;
     }
     label$278 : {
      if (!((15 | 0) < (HEAP32[($8_1 + 56 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break label$278
      }
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 68 | 0) >> 2] = wasm2js_i32$1;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0) | 0) & 65535 | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = ((($4(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0) | 0) & 65535 | 0) - (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0) + 1 | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
      HEAP32[($8_1 + 84 | 0) >> 2] = (((((HEAP32[($8_1 + 68 | 0) >> 2] | 0) - (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0) + 1 | 0) << 4 | 0) + -1 | 0 | 0) / (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) | 0;
      HEAP32[($8_1 + 60 | 0) >> 2] = Math_imul(HEAP32[($8_1 + 96 | 0) >> 2] | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + 1 | 0);
      HEAP32[($8_1 + 80 | 0) >> 2] = Math_imul(HEAP32[($8_1 + 96 | 0) >> 2] | 0, HEAP32[($8_1 + 84 | 0) >> 2] | 0);
      $5065 = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) >> 4 | 0;
      $5074 = 0;
      label$279 : {
       if (!((HEAP32[($8_1 + 60 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
        break label$279
       }
       $5074 = ((HEAP32[($8_1 + 60 | 0) >> 2] | 0) & 15 | 0 | 0) != (0 | 0);
      }
      HEAP32[($8_1 + 60 | 0) >> 2] = (($5065 + ($5074 & 1 | 0) | 0) + (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0) - 1 | 0;
      $5094 = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 80 | 0) >> 2] | 0) >> 4 | 0) | 0;
      $5103 = 0;
      label$280 : {
       if (!((HEAP32[($8_1 + 80 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
        break label$280
       }
       $5103 = ((HEAP32[($8_1 + 80 | 0) >> 2] | 0) & 15 | 0 | 0) != (0 | 0);
      }
      HEAP32[($8_1 + 44 | 0) >> 2] = $5094 + ($5103 & 1 | 0) | 0;
      HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
      label$281 : {
       label$282 : while (1) {
        if ((HEAP32[($8_1 + 80 | 0) >> 2] | 0) & 32768 | 0) {
         break label$281
        }
        HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
        label$283 : {
         if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 254 | 0) {
          break label$283
         }
         label$284 : {
          label$285 : {
           if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
            break label$285
           }
           $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
           label$286 : {
            label$287 : {
             if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
              break label$287
             }
             HEAP32[($8_1 + 88 | 0) >> 2] = -1;
             break label$286;
            }
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
           }
           break label$284;
          }
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
         }
         label$288 : {
          label$289 : {
           if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 256 | 0) {
            break label$289
           }
           HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
           break label$288;
          }
          HEAP32[($8_1 + 88 | 0) >> 2] = 256;
         }
        }
        HEAP32[($8_1 + 68 | 0) >> 2] = (HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0 | (((HEAP32[($8_1 + 88 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
        HEAP32[($8_1 + 80 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) ^ (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
        continue label$282;
       };
      }
      HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 68 | 0) >> 2] | 0;
      HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) << 16 | 0 | (HEAP32[($8_1 + 44 | 0) >> 2] | 0) | 0;
      HEAP32[($8_1 + 60 | 0) >> 2] = HEAP32[($8_1 + 44 | 0) >> 2] | 0;
      label$290 : {
       label$291 : while (1) {
        if (!(((HEAP32[($8_1 + 60 | 0) >> 2] | 0) & 1073758208 | 0 | 0) == (16384 | 0) & 1 | 0)) {
         break label$290
        }
        HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 60 | 0) >> 2] = (HEAP32[($8_1 + 44 | 0) >> 2] | 0) << 1 | 0;
        HEAP32[($8_1 + 44 | 0) >> 2] = (HEAP32[($8_1 + 60 | 0) >> 2] | 0) & -32770 | 0 | -2147418112 | 0;
        label$292 : {
         if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 254 | 0) {
          break label$292
         }
         label$293 : {
          label$294 : {
           if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
            break label$294
           }
           $7(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 132 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
           label$295 : {
            label$296 : {
             if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) >>> 0 < 1 >>> 0 & 1 | 0)) {
              break label$296
             }
             HEAP32[($8_1 + 88 | 0) >> 2] = -1;
             break label$295;
            }
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
            $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
            (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
           }
           break label$293;
          }
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0, ($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8192 | 0 | 0) | 0) + -1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
          $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8196 | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0 | 0);
          (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 88 | 0) >> 2] = wasm2js_i32$1;
         }
         label$297 : {
          label$298 : {
           if ((HEAP32[($8_1 + 88 | 0) >> 2] | 0) & 256 | 0) {
            break label$298
           }
           HEAP32[($8_1 + 88 | 0) >> 2] = (HEAP32[($8_1 + 88 | 0) >> 2] | 0) << 1 | 0 | 1 | 0;
           break label$297;
          }
          HEAP32[($8_1 + 88 | 0) >> 2] = 256;
         }
        }
        HEAP32[($8_1 + 68 | 0) >> 2] = ((HEAP32[($8_1 + 68 | 0) >> 2] | 0) << 1 | 0) ^ 32768 | 0 | (((HEAP32[($8_1 + 88 | 0) >> 2] | 0) >>> 8 | 0) & 1 | 0) | 0;
        HEAP16[($8_1 + 42 | 0) >> 1] = HEAP32[($8_1 + 68 | 0) >> 2] | 0;
        continue label$291;
       };
      }
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8220 | 0 | 0, (HEAP32[($8_1 + 44 | 0) >> 2] | 0) & 65535 | 0 | 0);
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8218 | 0 | 0, ((HEAP32[($8_1 + 44 | 0) >> 2] | 0) >>> 16 | 0) & 65535 | 0 | 0);
      HEAP32[($8_1 + 56 | 0) >> 2] = ((((HEAP32[($8_1 + 56 | 0) >> 2] | 0) - 16 | 0) << 4 | 0) + (HEAP32[($8_1 + 84 | 0) >> 2] | 0) | 0) + 15 | 0;
      $2(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8216 | 0 | 0, (HEAPU16[($8_1 + 42 | 0) >> 1] | 0) & 65535 | 0 | 0);
      $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8224 | 0 | 0, HEAP32[($8_1 + 88 | 0) >> 2] | 0 | 0);
     }
    }
    label$299 : {
     if (!((HEAP32[($8_1 + 36 | 0) >> 2] | 0 | 0) < (31200 | 0) & 1 | 0)) {
      break label$299
     }
     HEAP32[($8_1 + 36 | 0) >> 2] = ((HEAP32[($8_1 + 56 | 0) >> 2] | 0) + (HEAP32[($8_1 + 36 | 0) >> 2] | 0) | 0) + 3 | 0;
     if (!((31200 | 0) < (HEAP32[($8_1 + 36 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break label$299
     }
     HEAP32[($8_1 + 36 | 0) >> 2] = 31200;
    }
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10916 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 96 | 0) >> 2] = wasm2js_i32$1;
    HEAP32[($8_1 + 52 | 0) >> 2] = (HEAP32[($8_1 + 56 | 0) >> 2] | 0) + 3 | 0;
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10908 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 72 | 0) >> 2] = wasm2js_i32$1;
    (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10952 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 84 | 0) >> 2] = wasm2js_i32$1;
    label$300 : {
     label$301 : {
      if (!((HEAP32[($8_1 + 92 | 0) >> 2] | 0 | 0) < (HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break label$301
      }
      HEAP32[($8_1 + 64 | 0) >> 2] = ((HEAP32[($8_1 + 96 | 0) >> 2] | 0) + -1 | 0) - (HEAP32[($8_1 + 92 | 0) >> 2] | 0) | 0;
      break label$300;
     }
     HEAP32[($8_1 + 64 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + (((HEAP32[($8_1 + 72 | 0) >> 2] | 0) + -1 | 0) - (HEAP32[($8_1 + 92 | 0) >> 2] | 0) | 0) | 0;
    }
    label$302 : {
     label$303 : while (1) {
      HEAP8[($8_1 + 111 | 0) >> 0] = (HEAP32[($8_1 + 52 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0;
      HEAP32[($8_1 + 52 | 0) >> 2] = (HEAP32[($8_1 + 52 | 0) >> 2] | 0) + -1 | 0;
      if (!(((HEAPU8[($8_1 + 111 | 0) >> 0] | 0) & 255 | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0)) {
       break label$302
      }
      $3(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0 | 0, ($6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + (HEAP32[($8_1 + 64 | 0) >> 2] | 0) | 0 | 0) | 0) & 65535 | 0 | 0);
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8200 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 76 | 0) >> 2] = wasm2js_i32$1;
      (wasm2js_i32$0 = $8_1, wasm2js_i32$1 = $6(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 84 | 0) >> 2] | 0) + (HEAP32[($8_1 + 64 | 0) >> 2] | 0) | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 104 | 0) >> 2] = wasm2js_i32$1;
      $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8200 | 0 | 0, (HEAP32[($8_1 + 76 | 0) >> 2] | 0) + 1 | 0 | 0);
      $3(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, ((HEAP32[($8_1 + 124 | 0) >> 2] | 0) + (HEAP32[($8_1 + 76 | 0) >> 2] | 0) | 0) + 4096 | 0 | 0, (HEAP32[($8_1 + 104 | 0) >> 2] | 0) & 65535 | 0 | 0);
      label$304 : {
       if (!(($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 8200 | 0 | 0) | 0 | 0) == (4096 | 0) & 1 | 0)) {
        break label$304
       }
       $11(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 124 | 0) >> 2] | 0 | 0);
      }
      HEAP32[($8_1 + 96 | 0) >> 2] = (HEAP32[($8_1 + 96 | 0) >> 2] | 0) + 1 | 0;
      label$305 : {
       if (!((HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0) == (HEAP32[($8_1 + 72 | 0) >> 2] | 0 | 0) & 1 | 0)) {
        break label$305
       }
       HEAP32[($8_1 + 8 | 0) >> 2] = 0;
       label$306 : {
        if (HEAP32[($8_1 + 112 | 0) >> 2] | 0) {
         break label$306
        }
        HEAP32[($8_1 + 8 | 0) >> 2] = 4;
       }
       label$307 : {
        label$308 : while (1) {
         if (!((((HEAP32[($8_1 + 112 | 0) >> 2] | 0) + (HEAP32[($8_1 + 96 | 0) >> 2] | 0) | 0) - (HEAP32[($8_1 + 8 | 0) >> 2] | 0) | 0 | 0) >= (HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0) & 1 | 0)) {
          break label$307
         }
         HEAP32[($8_1 + 28 | 0) >> 2] = (HEAP32[($8_1 + 28 | 0) >> 2] | 0) << 1 | 0;
         $5564 = $31(HEAP32[(HEAP32[($8_1 + 116 | 0) >> 2] | 0) >> 2] | 0 | 0, HEAP32[($8_1 + 28 | 0) >> 2] | 0 | 0) | 0;
         HEAP32[(HEAP32[($8_1 + 116 | 0) >> 2] | 0) >> 2] = $5564;
         continue label$308;
        };
       }
       $38((HEAP32[(HEAP32[($8_1 + 116 | 0) >> 2] | 0) >> 2] | 0) + (HEAP32[($8_1 + 112 | 0) >> 2] | 0) | 0 | 0, (HEAP32[($8_1 + 136 | 0) >> 2] | 0) + ((($5(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10952 | 0 | 0) | 0) & 268435455 | 0) + (HEAP32[($8_1 + 8 | 0) >> 2] | 0) | 0) | 0 | 0, (HEAP32[($8_1 + 96 | 0) >> 2] | 0) - (HEAP32[($8_1 + 8 | 0) >> 2] | 0) | 0 | 0) | 0;
       HEAP32[($8_1 + 112 | 0) >> 2] = (HEAP32[($8_1 + 112 | 0) >> 2] | 0) + ((HEAP32[($8_1 + 96 | 0) >> 2] | 0) - (HEAP32[($8_1 + 8 | 0) >> 2] | 0) | 0) | 0;
       HEAP32[($8_1 + 96 | 0) >> 2] = 0;
      }
      HEAP32[($8_1 + 64 | 0) >> 2] = (HEAP32[($8_1 + 64 | 0) >> 2] | 0) + 1 | 0;
      label$309 : {
       if (!((HEAP32[($8_1 + 64 | 0) >> 2] | 0 | 0) == (HEAP32[($8_1 + 72 | 0) >> 2] | 0 | 0) & 1 | 0)) {
        break label$309
       }
       HEAP32[($8_1 + 64 | 0) >> 2] = 0;
      }
      continue label$303;
     };
    }
    $1(HEAP32[($8_1 + 136 | 0) >> 2] | 0 | 0, (HEAP32[($8_1 + 124 | 0) >> 2] | 0) + 10916 | 0 | 0, HEAP32[($8_1 + 96 | 0) >> 2] | 0 | 0);
    if (1 & 1 | 0) {
     continue label$1
    }
   }
   break label$1;
  };
  $5609 = HEAP32[($8_1 + 140 | 0) >> 2] | 0;
  global$0 = $8_1 + 144 | 0;
  return $5609 | 0;
 }
 
 function $18($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $5_1 = 0, $35_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $5_1 = global$0 - 32 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 20 | 0) >> 2] = $2_1;
  (wasm2js_i32$0 = $5_1, wasm2js_i32$1 = $29(25165824 | 0) | 0), HEAP32[(wasm2js_i32$0 + 16 | 0) >> 2] = wasm2js_i32$1;
  HEAP32[($5_1 + 12 | 0) >> 2] = 0;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[($5_1 + 12 | 0) >> 2] | 0 | 0) < (25165824 | 0) & 1 | 0)) {
     break label$1
    }
    HEAP8[((HEAP32[($5_1 + 16 | 0) >> 2] | 0) + (HEAP32[($5_1 + 12 | 0) >> 2] | 0) | 0) >> 0] = 0;
    HEAP32[($5_1 + 12 | 0) >> 2] = (HEAP32[($5_1 + 12 | 0) >> 2] | 0) + 1 | 0;
    continue label$2;
   };
  }
  (wasm2js_i32$0 = $5_1, wasm2js_i32$1 = $17(HEAP32[($5_1 + 16 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0, (HEAP32[($5_1 + 24 | 0) >> 2] | 0) - 8 | 0 | 0, -2141266272 | 0, -2141255296 | 0, HEAP32[($5_1 + 20 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
  $30(HEAP32[($5_1 + 16 | 0) >> 2] | 0 | 0);
  $35_1 = (HEAP32[($5_1 + 8 | 0) >> 2] | 0) - 4 | 0;
  global$0 = $5_1 + 32 | 0;
  return $35_1 | 0;
 }
 
 function $19($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $5_1 = 0, $16_1 = 0;
  $5_1 = global$0 - 624 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 620 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 616 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 612 | 0) >> 2] = $2_1;
  HEAP32[($5_1 + 600 | 0) >> 2] = 0;
  HEAP32[($5_1 + 552 | 0) >> 2] = 0;
  HEAP32[($5_1 + 604 | 0) >> 2] = HEAP32[($5_1 + 612 | 0) >> 2] | 0;
  label$1 : while (1) {
   label$2 : {
    if (!((HEAP32[($5_1 + 616 | 0) >> 2] | 0) >>> 0 <= (HEAP32[($5_1 + 600 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
     break label$2
    }
    $16_1 = HEAP32[($5_1 + 552 | 0) >> 2] | 0;
    global$0 = $5_1 + 624 | 0;
    return $16_1 | 0;
   }
   HEAP8[($5_1 + 610 | 0) >> 0] = HEAPU8[(HEAP32[($5_1 + 620 | 0) >> 2] | 0) >> 0] | 0;
   HEAP32[($5_1 + 560 | 0) >> 2] = $5_1;
   HEAP8[($5_1 + 574 | 0) >> 0] = 0;
   HEAP32[($5_1 + 548 | 0) >> 2] = 16;
   label$3 : while (1) {
    HEAP8[(HEAP32[($5_1 + 560 | 0) >> 2] | 0) >> 0] = HEAPU8[($5_1 + 574 | 0) >> 0] | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 1 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 1 | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 2 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 2 | 0;
    HEAP8[($5_1 + 559 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 9 | 0;
    HEAP8[($5_1 + 558 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 10 | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 3 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 3 | 0;
    HEAP8[($5_1 + 575 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 11 | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 4 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 4 | 0;
    HEAP8[($5_1 + 583 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 12 | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 5 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 5 | 0;
    HEAP8[($5_1 + 591 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 13 | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 6 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 6 | 0;
    HEAP8[($5_1 + 599 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 14 | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 7 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 7 | 0;
    HEAP8[($5_1 + 609 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 15 | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 8 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 8 | 0;
    HEAP8[($5_1 + 574 | 0) >> 0] = ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0) + 16 | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 9 | 0) >> 0] = HEAPU8[($5_1 + 559 | 0) >> 0] | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 10 | 0) >> 0] = HEAPU8[($5_1 + 558 | 0) >> 0] | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 11 | 0) >> 0] = HEAPU8[($5_1 + 575 | 0) >> 0] | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 12 | 0) >> 0] = HEAPU8[($5_1 + 583 | 0) >> 0] | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 13 | 0) >> 0] = HEAPU8[($5_1 + 591 | 0) >> 0] | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 14 | 0) >> 0] = HEAPU8[($5_1 + 599 | 0) >> 0] | 0;
    HEAP8[((HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 15 | 0) >> 0] = HEAPU8[($5_1 + 609 | 0) >> 0] | 0;
    HEAP32[($5_1 + 560 | 0) >> 2] = (HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 16 | 0;
    HEAP32[($5_1 + 548 | 0) >> 2] = (HEAP32[($5_1 + 548 | 0) >> 2] | 0) + -1 | 0;
    if (HEAP32[($5_1 + 548 | 0) >> 2] | 0) {
     continue label$3
    }
    break label$3;
   };
   HEAP32[($5_1 + 576 | 0) >> 2] = 0;
   label$4 : while (1) {
    HEAP32[($5_1 + 564 | 0) >> 2] = (HEAPU8[($5_1 + 610 | 0) >> 0] | 0) & 255 | 0;
    HEAP32[($5_1 + 600 | 0) >> 2] = (HEAP32[($5_1 + 600 | 0) >> 2] | 0) + 1 | 0;
    HEAP32[($5_1 + 620 | 0) >> 2] = (HEAP32[($5_1 + 620 | 0) >> 2] | 0) + 1 | 0;
    label$5 : {
     if (!(127 >>> 0 < (HEAP32[($5_1 + 564 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
      break label$5
     }
     HEAP32[($5_1 + 548 | 0) >> 2] = (HEAP32[($5_1 + 564 | 0) >> 2] | 0) + (HEAP32[($5_1 + 576 | 0) >> 2] | 0) | 0;
     HEAP32[($5_1 + 564 | 0) >> 2] = 0;
     HEAP32[($5_1 + 576 | 0) >> 2] = (HEAP32[($5_1 + 548 | 0) >> 2] | 0) - 127 | 0;
    }
    label$6 : {
     label$7 : {
      if (!((HEAP32[($5_1 + 576 | 0) >> 2] | 0 | 0) == (256 | 0) & 1 | 0)) {
       break label$7
      }
      break label$6;
     }
     HEAP32[($5_1 + 548 | 0) >> 2] = (HEAP32[($5_1 + 564 | 0) >> 2] | 0) + 1 | 0;
     HEAP32[($5_1 + 592 | 0) >> 2] = $5_1 + (HEAP32[($5_1 + 576 | 0) >> 2] | 0) | 0;
     HEAP32[($5_1 + 584 | 0) >> 2] = ($5_1 + 256 | 0) + (HEAP32[($5_1 + 576 | 0) >> 2] | 0) | 0;
     HEAP32[($5_1 + 560 | 0) >> 2] = HEAP32[($5_1 + 620 | 0) >> 2] | 0;
     HEAP32[($5_1 + 564 | 0) >> 2] = HEAP32[($5_1 + 600 | 0) >> 2] | 0;
     label$8 : while (1) {
      HEAP32[($5_1 + 620 | 0) >> 2] = (HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 1 | 0;
      HEAP32[($5_1 + 600 | 0) >> 2] = (HEAP32[($5_1 + 564 | 0) >> 2] | 0) + 1 | 0;
      HEAP8[(HEAP32[($5_1 + 592 | 0) >> 2] | 0) >> 0] = HEAPU8[(HEAP32[($5_1 + 560 | 0) >> 2] | 0) >> 0] | 0;
      label$9 : {
       if (!((HEAP32[($5_1 + 576 | 0) >> 2] | 0 | 0) != ((HEAPU8[(HEAP32[($5_1 + 592 | 0) >> 2] | 0) >> 0] | 0) & 255 | 0 | 0) & 1 | 0)) {
        break label$9
       }
       HEAP8[($5_1 + 610 | 0) >> 0] = HEAPU8[(HEAP32[($5_1 + 620 | 0) >> 2] | 0) >> 0] | 0;
       HEAP32[($5_1 + 600 | 0) >> 2] = (HEAP32[($5_1 + 564 | 0) >> 2] | 0) + 2 | 0;
       HEAP32[($5_1 + 620 | 0) >> 2] = (HEAP32[($5_1 + 560 | 0) >> 2] | 0) + 2 | 0;
       HEAP8[(HEAP32[($5_1 + 584 | 0) >> 2] | 0) >> 0] = HEAPU8[($5_1 + 610 | 0) >> 0] | 0;
      }
      HEAP32[($5_1 + 592 | 0) >> 2] = (HEAP32[($5_1 + 592 | 0) >> 2] | 0) + 1 | 0;
      HEAP32[($5_1 + 584 | 0) >> 2] = (HEAP32[($5_1 + 584 | 0) >> 2] | 0) + 1 | 0;
      HEAP32[($5_1 + 576 | 0) >> 2] = (HEAP32[($5_1 + 576 | 0) >> 2] | 0) + 1 | 0;
      HEAP32[($5_1 + 548 | 0) >> 2] = (HEAP32[($5_1 + 548 | 0) >> 2] | 0) + -1 | 0;
      HEAP32[($5_1 + 560 | 0) >> 2] = HEAP32[($5_1 + 620 | 0) >> 2] | 0;
      HEAP32[($5_1 + 564 | 0) >> 2] = HEAP32[($5_1 + 600 | 0) >> 2] | 0;
      if (HEAP32[($5_1 + 548 | 0) >> 2] | 0) {
       continue label$8
      }
      break label$8;
     };
     label$10 : {
      if (!((HEAP32[($5_1 + 576 | 0) >> 2] | 0 | 0) == (256 | 0) & 1 | 0)) {
       break label$10
      }
      break label$6;
     }
     HEAP8[($5_1 + 610 | 0) >> 0] = HEAPU8[(HEAP32[($5_1 + 620 | 0) >> 2] | 0) >> 0] | 0;
     continue label$4;
    }
    break label$4;
   };
   HEAP8[($5_1 + 610 | 0) >> 0] = HEAPU8[(HEAP32[($5_1 + 620 | 0) >> 2] | 0) >> 0] | 0;
   HEAP32[($5_1 + 548 | 0) >> 2] = 0;
   HEAP32[($5_1 + 560 | 0) >> 2] = (HEAP32[($5_1 + 620 | 0) >> 2] | 0) + 1 | 0;
   HEAP32[($5_1 + 600 | 0) >> 2] = (HEAP32[($5_1 + 600 | 0) >> 2] | 0) + 2 | 0;
   HEAP32[($5_1 + 620 | 0) >> 2] = (HEAP32[($5_1 + 620 | 0) >> 2] | 0) + 2 | 0;
   HEAP32[($5_1 + 568 | 0) >> 2] = (((HEAPU8[($5_1 + 610 | 0) >> 0] | 0) & 255 | 0) << 8 | 0) + ((HEAPU8[(HEAP32[($5_1 + 560 | 0) >> 2] | 0) >> 0] | 0) & 255 | 0) | 0;
   label$11 : while (1) {
    label$12 : {
     label$13 : {
      if (HEAP32[($5_1 + 548 | 0) >> 2] | 0) {
       break label$13
      }
      HEAP8[($5_1 + 611 | 0) >> 0] = (HEAP32[($5_1 + 568 | 0) >> 2] | 0 | 0) == (0 | 0) & 1 | 0;
      HEAP32[($5_1 + 568 | 0) >> 2] = (HEAP32[($5_1 + 568 | 0) >> 2] | 0) + -1 | 0;
      label$14 : {
       if (!(((HEAPU8[($5_1 + 611 | 0) >> 0] | 0) & 255 | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0)) {
        break label$14
       }
       continue label$1;
      }
      HEAP8[($5_1 + 610 | 0) >> 0] = HEAPU8[(HEAP32[($5_1 + 620 | 0) >> 2] | 0) >> 0] | 0;
      HEAP32[($5_1 + 600 | 0) >> 2] = (HEAP32[($5_1 + 600 | 0) >> 2] | 0) + 1 | 0;
      HEAP32[($5_1 + 620 | 0) >> 2] = (HEAP32[($5_1 + 620 | 0) >> 2] | 0) + 1 | 0;
      break label$12;
     }
     HEAP8[($5_1 + 610 | 0) >> 0] = HEAPU8[(($5_1 + 512 | 0) + (HEAP32[($5_1 + 548 | 0) >> 2] | 0) | 0) >> 0] | 0;
     HEAP32[($5_1 + 548 | 0) >> 2] = (HEAP32[($5_1 + 548 | 0) >> 2] | 0) + -1 | 0;
    }
    HEAP32[($5_1 + 576 | 0) >> 2] = (HEAPU8[($5_1 + 610 | 0) >> 0] | 0) & 255 | 0;
    HEAP8[($5_1 + 574 | 0) >> 0] = HEAPU8[($5_1 + (HEAP32[($5_1 + 576 | 0) >> 2] | 0) | 0) >> 0] | 0;
    label$15 : {
     label$16 : {
      if (!((HEAP32[($5_1 + 576 | 0) >> 2] | 0 | 0) == ((HEAPU8[($5_1 + 574 | 0) >> 0] | 0) & 255 | 0 | 0) & 1 | 0)) {
       break label$16
      }
      HEAP8[(HEAP32[($5_1 + 604 | 0) >> 2] | 0) >> 0] = HEAPU8[($5_1 + 610 | 0) >> 0] | 0;
      HEAP32[($5_1 + 604 | 0) >> 2] = (HEAP32[($5_1 + 604 | 0) >> 2] | 0) + 1 | 0;
      HEAP32[($5_1 + 552 | 0) >> 2] = (HEAP32[($5_1 + 552 | 0) >> 2] | 0) + 1 | 0;
      break label$15;
     }
     HEAP8[((($5_1 + 512 | 0) + 1 | 0) + (HEAP32[($5_1 + 548 | 0) >> 2] | 0) | 0) >> 0] = HEAPU8[(($5_1 + 256 | 0) + (HEAP32[($5_1 + 576 | 0) >> 2] | 0) | 0) >> 0] | 0;
     HEAP8[((($5_1 + 512 | 0) + 1 | 0) + ((HEAP32[($5_1 + 548 | 0) >> 2] | 0) + 1 | 0) | 0) >> 0] = HEAPU8[($5_1 + 574 | 0) >> 0] | 0;
     HEAP32[($5_1 + 548 | 0) >> 2] = (HEAP32[($5_1 + 548 | 0) >> 2] | 0) + 2 | 0;
    }
    continue label$11;
   };
  };
 }
 
 function $20() {
  return 1184 | 0;
 }
 
 function $21($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $4_1 = 0, $3_1 = 0, $5_1 = 0, $8_1 = 0, $9_1 = 0, $6_1 = 0, $7_1 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  $4_1 = HEAP32[($0_1 + 28 | 0) >> 2] | 0;
  HEAP32[($3_1 + 16 | 0) >> 2] = $4_1;
  $5_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  $1_1 = $5_1 - $4_1 | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = $1_1;
  $6_1 = $1_1 + $2_1 | 0;
  $7_1 = 2;
  $1_1 = $3_1 + 16 | 0;
  label$1 : {
   label$2 : {
    label$3 : {
     label$4 : {
      if ($28(fimport$1(HEAP32[($0_1 + 60 | 0) >> 2] | 0 | 0, $3_1 + 16 | 0 | 0, 2 | 0, $3_1 + 12 | 0 | 0) | 0 | 0) | 0) {
       break label$4
      }
      label$5 : while (1) {
       $4_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
       if (($6_1 | 0) == ($4_1 | 0)) {
        break label$3
       }
       if (($4_1 | 0) <= (-1 | 0)) {
        break label$2
       }
       $8_1 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
       $5_1 = $4_1 >>> 0 > $8_1 >>> 0;
       $9_1 = $1_1 + ($5_1 << 3 | 0) | 0;
       $8_1 = $4_1 - ($5_1 ? $8_1 : 0) | 0;
       HEAP32[$9_1 >> 2] = (HEAP32[$9_1 >> 2] | 0) + $8_1 | 0;
       $9_1 = $1_1 + ($5_1 ? 12 : 4) | 0;
       HEAP32[$9_1 >> 2] = (HEAP32[$9_1 >> 2] | 0) - $8_1 | 0;
       $6_1 = $6_1 - $4_1 | 0;
       $1_1 = $5_1 ? $1_1 + 8 | 0 : $1_1;
       $7_1 = $7_1 - $5_1 | 0;
       if (!($28(fimport$1(HEAP32[($0_1 + 60 | 0) >> 2] | 0 | 0, $1_1 | 0, $7_1 | 0, $3_1 + 12 | 0 | 0) | 0 | 0) | 0)) {
        continue label$5
       }
       break label$5;
      };
     }
     if (($6_1 | 0) != (-1 | 0)) {
      break label$2
     }
    }
    $1_1 = HEAP32[($0_1 + 44 | 0) >> 2] | 0;
    HEAP32[($0_1 + 28 | 0) >> 2] = $1_1;
    HEAP32[($0_1 + 20 | 0) >> 2] = $1_1;
    HEAP32[($0_1 + 16 | 0) >> 2] = $1_1 + (HEAP32[($0_1 + 48 | 0) >> 2] | 0) | 0;
    $4_1 = $2_1;
    break label$1;
   }
   $4_1 = 0;
   HEAP32[($0_1 + 28 | 0) >> 2] = 0;
   HEAP32[($0_1 + 16 | 0) >> 2] = 0;
   HEAP32[($0_1 + 20 | 0) >> 2] = 0;
   HEAP32[$0_1 >> 2] = HEAP32[$0_1 >> 2] | 0 | 32 | 0;
   if (($7_1 | 0) == (2 | 0)) {
    break label$1
   }
   $4_1 = $2_1 - (HEAP32[($1_1 + 4 | 0) >> 2] | 0) | 0;
  }
  global$0 = $3_1 + 32 | 0;
  return $4_1 | 0;
 }
 
 function $22($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $23($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $24() {
  $22(1192 | 0);
  return 1196 | 0;
 }
 
 function $25() {
  $23(1192 | 0);
 }
 
 function $26($0_1) {
  $0_1 = $0_1 | 0;
  return 0 | 0;
 }
 
 function $27($0_1, $1_1, $1$hi, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  i64toi32_i32$HIGH_BITS = 0;
  return 0 | 0;
 }
 
 function $28($0_1) {
  $0_1 = $0_1 | 0;
  var wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  label$1 : {
   if ($0_1) {
    break label$1
   }
   return 0 | 0;
  }
  (wasm2js_i32$0 = $20() | 0, wasm2js_i32$1 = $0_1), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
  return -1 | 0;
 }
 
 function $29($0_1) {
  $0_1 = $0_1 | 0;
  var $4_1 = 0, $5_1 = 0, $6_1 = 0, $8_1 = 0, $3_1 = 0, $2_1 = 0, $11_1 = 0, $7_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $9_1 = 0, i64toi32_i32$2 = 0, $10_1 = 0, $1_1 = 0, $79 = 0, $92 = 0, $103 = 0, $111 = 0, $119 = 0, $210 = 0, $221 = 0, $229 = 0, $237 = 0, $272 = 0, $339 = 0, $346 = 0, $353 = 0, $444 = 0, $455 = 0, $463 = 0, $471 = 0, $1157 = 0, $1164 = 0, $1171 = 0, $1293 = 0, $1295 = 0, $1356 = 0, $1363 = 0, $1370 = 0, $1606 = 0, $1613 = 0, $1620 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  label$1 : {
   label$2 : {
    label$3 : {
     label$4 : {
      label$5 : {
       label$6 : {
        label$7 : {
         label$8 : {
          label$9 : {
           label$10 : {
            label$11 : {
             label$12 : {
              if ($0_1 >>> 0 > 244 >>> 0) {
               break label$12
              }
              label$13 : {
               $2_1 = HEAP32[(0 + 2232 | 0) >> 2] | 0;
               $3_1 = $0_1 >>> 0 < 11 >>> 0 ? 16 : ($0_1 + 11 | 0) & -8 | 0;
               $4_1 = $3_1 >>> 3 | 0;
               $0_1 = $2_1 >>> $4_1 | 0;
               if (!($0_1 & 3 | 0)) {
                break label$13
               }
               $5_1 = (($0_1 ^ -1 | 0) & 1 | 0) + $4_1 | 0;
               $6_1 = $5_1 << 3 | 0;
               $4_1 = HEAP32[($6_1 + 2280 | 0) >> 2] | 0;
               $0_1 = $4_1 + 8 | 0;
               label$14 : {
                label$15 : {
                 $3_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
                 $6_1 = $6_1 + 2272 | 0;
                 if (($3_1 | 0) != ($6_1 | 0)) {
                  break label$15
                 }
                 (wasm2js_i32$0 = 0, wasm2js_i32$1 = $2_1 & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2232 | 0) >> 2] = wasm2js_i32$1;
                 break label$14;
                }
                HEAP32[($3_1 + 12 | 0) >> 2] = $6_1;
                HEAP32[($6_1 + 8 | 0) >> 2] = $3_1;
               }
               $5_1 = $5_1 << 3 | 0;
               HEAP32[($4_1 + 4 | 0) >> 2] = $5_1 | 3 | 0;
               $4_1 = $4_1 + $5_1 | 0;
               HEAP32[($4_1 + 4 | 0) >> 2] = HEAP32[($4_1 + 4 | 0) >> 2] | 0 | 1 | 0;
               break label$1;
              }
              $7_1 = HEAP32[(0 + 2240 | 0) >> 2] | 0;
              if ($3_1 >>> 0 <= $7_1 >>> 0) {
               break label$11
              }
              label$16 : {
               if (!$0_1) {
                break label$16
               }
               label$17 : {
                label$18 : {
                 $79 = $0_1 << $4_1 | 0;
                 $0_1 = 2 << $4_1 | 0;
                 $0_1 = $79 & ($0_1 | (0 - $0_1 | 0) | 0) | 0;
                 $0_1 = ($0_1 & (0 - $0_1 | 0) | 0) + -1 | 0;
                 $92 = $0_1;
                 $0_1 = ($0_1 >>> 12 | 0) & 16 | 0;
                 $4_1 = $92 >>> $0_1 | 0;
                 $5_1 = ($4_1 >>> 5 | 0) & 8 | 0;
                 $103 = $5_1 | $0_1 | 0;
                 $0_1 = $4_1 >>> $5_1 | 0;
                 $4_1 = ($0_1 >>> 2 | 0) & 4 | 0;
                 $111 = $103 | $4_1 | 0;
                 $0_1 = $0_1 >>> $4_1 | 0;
                 $4_1 = ($0_1 >>> 1 | 0) & 2 | 0;
                 $119 = $111 | $4_1 | 0;
                 $0_1 = $0_1 >>> $4_1 | 0;
                 $4_1 = ($0_1 >>> 1 | 0) & 1 | 0;
                 $5_1 = ($119 | $4_1 | 0) + ($0_1 >>> $4_1 | 0) | 0;
                 $6_1 = $5_1 << 3 | 0;
                 $4_1 = HEAP32[($6_1 + 2280 | 0) >> 2] | 0;
                 $0_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
                 $6_1 = $6_1 + 2272 | 0;
                 if (($0_1 | 0) != ($6_1 | 0)) {
                  break label$18
                 }
                 $2_1 = $2_1 & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0;
                 HEAP32[(0 + 2232 | 0) >> 2] = $2_1;
                 break label$17;
                }
                HEAP32[($0_1 + 12 | 0) >> 2] = $6_1;
                HEAP32[($6_1 + 8 | 0) >> 2] = $0_1;
               }
               $0_1 = $4_1 + 8 | 0;
               HEAP32[($4_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
               $6_1 = $4_1 + $3_1 | 0;
               $8_1 = $5_1 << 3 | 0;
               $5_1 = $8_1 - $3_1 | 0;
               HEAP32[($6_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
               HEAP32[($4_1 + $8_1 | 0) >> 2] = $5_1;
               label$19 : {
                if (!$7_1) {
                 break label$19
                }
                $8_1 = $7_1 >>> 3 | 0;
                $3_1 = ($8_1 << 3 | 0) + 2272 | 0;
                $4_1 = HEAP32[(0 + 2252 | 0) >> 2] | 0;
                label$20 : {
                 label$21 : {
                  $8_1 = 1 << $8_1 | 0;
                  if ($2_1 & $8_1 | 0) {
                   break label$21
                  }
                  HEAP32[(0 + 2232 | 0) >> 2] = $2_1 | $8_1 | 0;
                  $8_1 = $3_1;
                  break label$20;
                 }
                 $8_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
                }
                HEAP32[($3_1 + 8 | 0) >> 2] = $4_1;
                HEAP32[($8_1 + 12 | 0) >> 2] = $4_1;
                HEAP32[($4_1 + 12 | 0) >> 2] = $3_1;
                HEAP32[($4_1 + 8 | 0) >> 2] = $8_1;
               }
               HEAP32[(0 + 2252 | 0) >> 2] = $6_1;
               HEAP32[(0 + 2240 | 0) >> 2] = $5_1;
               break label$1;
              }
              $9_1 = HEAP32[(0 + 2236 | 0) >> 2] | 0;
              if (!$9_1) {
               break label$11
              }
              $0_1 = ($9_1 & (0 - $9_1 | 0) | 0) + -1 | 0;
              $210 = $0_1;
              $0_1 = ($0_1 >>> 12 | 0) & 16 | 0;
              $4_1 = $210 >>> $0_1 | 0;
              $5_1 = ($4_1 >>> 5 | 0) & 8 | 0;
              $221 = $5_1 | $0_1 | 0;
              $0_1 = $4_1 >>> $5_1 | 0;
              $4_1 = ($0_1 >>> 2 | 0) & 4 | 0;
              $229 = $221 | $4_1 | 0;
              $0_1 = $0_1 >>> $4_1 | 0;
              $4_1 = ($0_1 >>> 1 | 0) & 2 | 0;
              $237 = $229 | $4_1 | 0;
              $0_1 = $0_1 >>> $4_1 | 0;
              $4_1 = ($0_1 >>> 1 | 0) & 1 | 0;
              $6_1 = HEAP32[(((($237 | $4_1 | 0) + ($0_1 >>> $4_1 | 0) | 0) << 2 | 0) + 2536 | 0) >> 2] | 0;
              $4_1 = ((HEAP32[($6_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
              $5_1 = $6_1;
              label$22 : {
               label$23 : while (1) {
                label$24 : {
                 $0_1 = HEAP32[($5_1 + 16 | 0) >> 2] | 0;
                 if ($0_1) {
                  break label$24
                 }
                 $0_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
                 if (!$0_1) {
                  break label$22
                 }
                }
                $5_1 = ((HEAP32[($0_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
                $272 = $5_1;
                $5_1 = $5_1 >>> 0 < $4_1 >>> 0;
                $4_1 = $5_1 ? $272 : $4_1;
                $6_1 = $5_1 ? $0_1 : $6_1;
                $5_1 = $0_1;
                continue label$23;
               };
              }
              $10_1 = HEAP32[($6_1 + 24 | 0) >> 2] | 0;
              label$25 : {
               $8_1 = HEAP32[($6_1 + 12 | 0) >> 2] | 0;
               if (($8_1 | 0) == ($6_1 | 0)) {
                break label$25
               }
               $0_1 = HEAP32[($6_1 + 8 | 0) >> 2] | 0;
               HEAP32[(0 + 2248 | 0) >> 2] | 0;
               HEAP32[($0_1 + 12 | 0) >> 2] = $8_1;
               HEAP32[($8_1 + 8 | 0) >> 2] = $0_1;
               break label$2;
              }
              label$26 : {
               $5_1 = $6_1 + 20 | 0;
               $0_1 = HEAP32[$5_1 >> 2] | 0;
               if ($0_1) {
                break label$26
               }
               $0_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
               if (!$0_1) {
                break label$10
               }
               $5_1 = $6_1 + 16 | 0;
              }
              label$27 : while (1) {
               $11_1 = $5_1;
               $8_1 = $0_1;
               $5_1 = $0_1 + 20 | 0;
               $0_1 = HEAP32[$5_1 >> 2] | 0;
               if ($0_1) {
                continue label$27
               }
               $5_1 = $8_1 + 16 | 0;
               $0_1 = HEAP32[($8_1 + 16 | 0) >> 2] | 0;
               if ($0_1) {
                continue label$27
               }
               break label$27;
              };
              HEAP32[$11_1 >> 2] = 0;
              break label$2;
             }
             $3_1 = -1;
             if ($0_1 >>> 0 > -65 >>> 0) {
              break label$11
             }
             $0_1 = $0_1 + 11 | 0;
             $3_1 = $0_1 & -8 | 0;
             $7_1 = HEAP32[(0 + 2236 | 0) >> 2] | 0;
             if (!$7_1) {
              break label$11
             }
             $11_1 = 0;
             label$28 : {
              if ($3_1 >>> 0 < 256 >>> 0) {
               break label$28
              }
              $11_1 = 31;
              if ($3_1 >>> 0 > 16777215 >>> 0) {
               break label$28
              }
              $0_1 = $0_1 >>> 8 | 0;
              $339 = $0_1;
              $0_1 = (($0_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
              $4_1 = $339 << $0_1 | 0;
              $346 = $4_1;
              $4_1 = (($4_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
              $5_1 = $346 << $4_1 | 0;
              $353 = $5_1;
              $5_1 = (($5_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
              $0_1 = (($353 << $5_1 | 0) >>> 15 | 0) - ($0_1 | $4_1 | 0 | $5_1 | 0) | 0;
              $11_1 = ($0_1 << 1 | 0 | (($3_1 >>> ($0_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
             }
             $4_1 = 0 - $3_1 | 0;
             label$29 : {
              label$30 : {
               label$31 : {
                label$32 : {
                 $5_1 = HEAP32[(($11_1 << 2 | 0) + 2536 | 0) >> 2] | 0;
                 if ($5_1) {
                  break label$32
                 }
                 $0_1 = 0;
                 $8_1 = 0;
                 break label$31;
                }
                $0_1 = 0;
                $6_1 = $3_1 << (($11_1 | 0) == (31 | 0) ? 0 : 25 - ($11_1 >>> 1 | 0) | 0) | 0;
                $8_1 = 0;
                label$33 : while (1) {
                 label$34 : {
                  $2_1 = ((HEAP32[($5_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
                  if ($2_1 >>> 0 >= $4_1 >>> 0) {
                   break label$34
                  }
                  $4_1 = $2_1;
                  $8_1 = $5_1;
                  if ($4_1) {
                   break label$34
                  }
                  $4_1 = 0;
                  $8_1 = $5_1;
                  $0_1 = $5_1;
                  break label$30;
                 }
                 $2_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
                 $5_1 = HEAP32[(($5_1 + (($6_1 >>> 29 | 0) & 4 | 0) | 0) + 16 | 0) >> 2] | 0;
                 $0_1 = $2_1 ? (($2_1 | 0) == ($5_1 | 0) ? $0_1 : $2_1) : $0_1;
                 $6_1 = $6_1 << 1 | 0;
                 if ($5_1) {
                  continue label$33
                 }
                 break label$33;
                };
               }
               label$35 : {
                if ($0_1 | $8_1 | 0) {
                 break label$35
                }
                $8_1 = 0;
                $0_1 = 2 << $11_1 | 0;
                $0_1 = ($0_1 | (0 - $0_1 | 0) | 0) & $7_1 | 0;
                if (!$0_1) {
                 break label$11
                }
                $0_1 = ($0_1 & (0 - $0_1 | 0) | 0) + -1 | 0;
                $444 = $0_1;
                $0_1 = ($0_1 >>> 12 | 0) & 16 | 0;
                $5_1 = $444 >>> $0_1 | 0;
                $6_1 = ($5_1 >>> 5 | 0) & 8 | 0;
                $455 = $6_1 | $0_1 | 0;
                $0_1 = $5_1 >>> $6_1 | 0;
                $5_1 = ($0_1 >>> 2 | 0) & 4 | 0;
                $463 = $455 | $5_1 | 0;
                $0_1 = $0_1 >>> $5_1 | 0;
                $5_1 = ($0_1 >>> 1 | 0) & 2 | 0;
                $471 = $463 | $5_1 | 0;
                $0_1 = $0_1 >>> $5_1 | 0;
                $5_1 = ($0_1 >>> 1 | 0) & 1 | 0;
                $0_1 = HEAP32[(((($471 | $5_1 | 0) + ($0_1 >>> $5_1 | 0) | 0) << 2 | 0) + 2536 | 0) >> 2] | 0;
               }
               if (!$0_1) {
                break label$29
               }
              }
              label$36 : while (1) {
               $2_1 = ((HEAP32[($0_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
               $6_1 = $2_1 >>> 0 < $4_1 >>> 0;
               label$37 : {
                $5_1 = HEAP32[($0_1 + 16 | 0) >> 2] | 0;
                if ($5_1) {
                 break label$37
                }
                $5_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
               }
               $4_1 = $6_1 ? $2_1 : $4_1;
               $8_1 = $6_1 ? $0_1 : $8_1;
               $0_1 = $5_1;
               if ($0_1) {
                continue label$36
               }
               break label$36;
              };
             }
             if (!$8_1) {
              break label$11
             }
             if ($4_1 >>> 0 >= ((HEAP32[(0 + 2240 | 0) >> 2] | 0) - $3_1 | 0) >>> 0) {
              break label$11
             }
             $11_1 = HEAP32[($8_1 + 24 | 0) >> 2] | 0;
             label$38 : {
              $6_1 = HEAP32[($8_1 + 12 | 0) >> 2] | 0;
              if (($6_1 | 0) == ($8_1 | 0)) {
               break label$38
              }
              $0_1 = HEAP32[($8_1 + 8 | 0) >> 2] | 0;
              HEAP32[(0 + 2248 | 0) >> 2] | 0;
              HEAP32[($0_1 + 12 | 0) >> 2] = $6_1;
              HEAP32[($6_1 + 8 | 0) >> 2] = $0_1;
              break label$3;
             }
             label$39 : {
              $5_1 = $8_1 + 20 | 0;
              $0_1 = HEAP32[$5_1 >> 2] | 0;
              if ($0_1) {
               break label$39
              }
              $0_1 = HEAP32[($8_1 + 16 | 0) >> 2] | 0;
              if (!$0_1) {
               break label$9
              }
              $5_1 = $8_1 + 16 | 0;
             }
             label$40 : while (1) {
              $2_1 = $5_1;
              $6_1 = $0_1;
              $5_1 = $0_1 + 20 | 0;
              $0_1 = HEAP32[$5_1 >> 2] | 0;
              if ($0_1) {
               continue label$40
              }
              $5_1 = $6_1 + 16 | 0;
              $0_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
              if ($0_1) {
               continue label$40
              }
              break label$40;
             };
             HEAP32[$2_1 >> 2] = 0;
             break label$3;
            }
            label$41 : {
             $0_1 = HEAP32[(0 + 2240 | 0) >> 2] | 0;
             if ($0_1 >>> 0 < $3_1 >>> 0) {
              break label$41
             }
             $4_1 = HEAP32[(0 + 2252 | 0) >> 2] | 0;
             label$42 : {
              label$43 : {
               $5_1 = $0_1 - $3_1 | 0;
               if ($5_1 >>> 0 < 16 >>> 0) {
                break label$43
               }
               HEAP32[(0 + 2240 | 0) >> 2] = $5_1;
               $6_1 = $4_1 + $3_1 | 0;
               HEAP32[(0 + 2252 | 0) >> 2] = $6_1;
               HEAP32[($6_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
               HEAP32[($4_1 + $0_1 | 0) >> 2] = $5_1;
               HEAP32[($4_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
               break label$42;
              }
              HEAP32[(0 + 2252 | 0) >> 2] = 0;
              HEAP32[(0 + 2240 | 0) >> 2] = 0;
              HEAP32[($4_1 + 4 | 0) >> 2] = $0_1 | 3 | 0;
              $0_1 = $4_1 + $0_1 | 0;
              HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
             }
             $0_1 = $4_1 + 8 | 0;
             break label$1;
            }
            label$44 : {
             $6_1 = HEAP32[(0 + 2244 | 0) >> 2] | 0;
             if ($6_1 >>> 0 <= $3_1 >>> 0) {
              break label$44
             }
             $4_1 = $6_1 - $3_1 | 0;
             HEAP32[(0 + 2244 | 0) >> 2] = $4_1;
             $0_1 = HEAP32[(0 + 2256 | 0) >> 2] | 0;
             $5_1 = $0_1 + $3_1 | 0;
             HEAP32[(0 + 2256 | 0) >> 2] = $5_1;
             HEAP32[($5_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
             HEAP32[($0_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
             $0_1 = $0_1 + 8 | 0;
             break label$1;
            }
            label$45 : {
             label$46 : {
              if (!(HEAP32[(0 + 2704 | 0) >> 2] | 0)) {
               break label$46
              }
              $4_1 = HEAP32[(0 + 2712 | 0) >> 2] | 0;
              break label$45;
             }
             i64toi32_i32$1 = 0;
             i64toi32_i32$0 = -1;
             HEAP32[(i64toi32_i32$1 + 2716 | 0) >> 2] = -1;
             HEAP32[(i64toi32_i32$1 + 2720 | 0) >> 2] = i64toi32_i32$0;
             i64toi32_i32$1 = 0;
             i64toi32_i32$0 = 4096;
             HEAP32[(i64toi32_i32$1 + 2708 | 0) >> 2] = 4096;
             HEAP32[(i64toi32_i32$1 + 2712 | 0) >> 2] = i64toi32_i32$0;
             HEAP32[(0 + 2704 | 0) >> 2] = (($1_1 + 12 | 0) & -16 | 0) ^ 1431655768 | 0;
             HEAP32[(0 + 2724 | 0) >> 2] = 0;
             HEAP32[(0 + 2676 | 0) >> 2] = 0;
             $4_1 = 4096;
            }
            $0_1 = 0;
            $7_1 = $3_1 + 47 | 0;
            $2_1 = $4_1 + $7_1 | 0;
            $11_1 = 0 - $4_1 | 0;
            $8_1 = $2_1 & $11_1 | 0;
            if ($8_1 >>> 0 <= $3_1 >>> 0) {
             break label$1
            }
            $0_1 = 0;
            label$47 : {
             $4_1 = HEAP32[(0 + 2672 | 0) >> 2] | 0;
             if (!$4_1) {
              break label$47
             }
             $5_1 = HEAP32[(0 + 2664 | 0) >> 2] | 0;
             $9_1 = $5_1 + $8_1 | 0;
             if ($9_1 >>> 0 <= $5_1 >>> 0) {
              break label$1
             }
             if ($9_1 >>> 0 > $4_1 >>> 0) {
              break label$1
             }
            }
            if ((HEAPU8[(0 + 2676 | 0) >> 0] | 0) & 4 | 0) {
             break label$6
            }
            label$48 : {
             label$49 : {
              label$50 : {
               $4_1 = HEAP32[(0 + 2256 | 0) >> 2] | 0;
               if (!$4_1) {
                break label$50
               }
               $0_1 = 2680;
               label$51 : while (1) {
                label$52 : {
                 $5_1 = HEAP32[$0_1 >> 2] | 0;
                 if ($5_1 >>> 0 > $4_1 >>> 0) {
                  break label$52
                 }
                 if (($5_1 + (HEAP32[($0_1 + 4 | 0) >> 2] | 0) | 0) >>> 0 > $4_1 >>> 0) {
                  break label$49
                 }
                }
                $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
                if ($0_1) {
                 continue label$51
                }
                break label$51;
               };
              }
              $6_1 = $35(0 | 0) | 0;
              if (($6_1 | 0) == (-1 | 0)) {
               break label$7
              }
              $2_1 = $8_1;
              label$53 : {
               $0_1 = HEAP32[(0 + 2708 | 0) >> 2] | 0;
               $4_1 = $0_1 + -1 | 0;
               if (!($4_1 & $6_1 | 0)) {
                break label$53
               }
               $2_1 = ($8_1 - $6_1 | 0) + (($4_1 + $6_1 | 0) & (0 - $0_1 | 0) | 0) | 0;
              }
              if ($2_1 >>> 0 <= $3_1 >>> 0) {
               break label$7
              }
              if ($2_1 >>> 0 > 2147483646 >>> 0) {
               break label$7
              }
              label$54 : {
               $0_1 = HEAP32[(0 + 2672 | 0) >> 2] | 0;
               if (!$0_1) {
                break label$54
               }
               $4_1 = HEAP32[(0 + 2664 | 0) >> 2] | 0;
               $5_1 = $4_1 + $2_1 | 0;
               if ($5_1 >>> 0 <= $4_1 >>> 0) {
                break label$7
               }
               if ($5_1 >>> 0 > $0_1 >>> 0) {
                break label$7
               }
              }
              $0_1 = $35($2_1 | 0) | 0;
              if (($0_1 | 0) != ($6_1 | 0)) {
               break label$48
              }
              break label$5;
             }
             $2_1 = ($2_1 - $6_1 | 0) & $11_1 | 0;
             if ($2_1 >>> 0 > 2147483646 >>> 0) {
              break label$7
             }
             $6_1 = $35($2_1 | 0) | 0;
             if (($6_1 | 0) == ((HEAP32[$0_1 >> 2] | 0) + (HEAP32[($0_1 + 4 | 0) >> 2] | 0) | 0 | 0)) {
              break label$8
             }
             $0_1 = $6_1;
            }
            label$55 : {
             if (($0_1 | 0) == (-1 | 0)) {
              break label$55
             }
             if (($3_1 + 48 | 0) >>> 0 <= $2_1 >>> 0) {
              break label$55
             }
             label$56 : {
              $4_1 = HEAP32[(0 + 2712 | 0) >> 2] | 0;
              $4_1 = (($7_1 - $2_1 | 0) + $4_1 | 0) & (0 - $4_1 | 0) | 0;
              if ($4_1 >>> 0 <= 2147483646 >>> 0) {
               break label$56
              }
              $6_1 = $0_1;
              break label$5;
             }
             label$57 : {
              if (($35($4_1 | 0) | 0 | 0) == (-1 | 0)) {
               break label$57
              }
              $2_1 = $4_1 + $2_1 | 0;
              $6_1 = $0_1;
              break label$5;
             }
             $35(0 - $2_1 | 0 | 0) | 0;
             break label$7;
            }
            $6_1 = $0_1;
            if (($0_1 | 0) != (-1 | 0)) {
             break label$5
            }
            break label$7;
           }
           $8_1 = 0;
           break label$2;
          }
          $6_1 = 0;
          break label$3;
         }
         if (($6_1 | 0) != (-1 | 0)) {
          break label$5
         }
        }
        HEAP32[(0 + 2676 | 0) >> 2] = HEAP32[(0 + 2676 | 0) >> 2] | 0 | 4 | 0;
       }
       if ($8_1 >>> 0 > 2147483646 >>> 0) {
        break label$4
       }
       $6_1 = $35($8_1 | 0) | 0;
       $0_1 = $35(0 | 0) | 0;
       if (($6_1 | 0) == (-1 | 0)) {
        break label$4
       }
       if (($0_1 | 0) == (-1 | 0)) {
        break label$4
       }
       if ($6_1 >>> 0 >= $0_1 >>> 0) {
        break label$4
       }
       $2_1 = $0_1 - $6_1 | 0;
       if ($2_1 >>> 0 <= ($3_1 + 40 | 0) >>> 0) {
        break label$4
       }
      }
      $0_1 = (HEAP32[(0 + 2664 | 0) >> 2] | 0) + $2_1 | 0;
      HEAP32[(0 + 2664 | 0) >> 2] = $0_1;
      label$58 : {
       if ($0_1 >>> 0 <= (HEAP32[(0 + 2668 | 0) >> 2] | 0) >>> 0) {
        break label$58
       }
       HEAP32[(0 + 2668 | 0) >> 2] = $0_1;
      }
      label$59 : {
       label$60 : {
        label$61 : {
         label$62 : {
          $4_1 = HEAP32[(0 + 2256 | 0) >> 2] | 0;
          if (!$4_1) {
           break label$62
          }
          $0_1 = 2680;
          label$63 : while (1) {
           $5_1 = HEAP32[$0_1 >> 2] | 0;
           $8_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
           if (($6_1 | 0) == ($5_1 + $8_1 | 0 | 0)) {
            break label$61
           }
           $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
           if ($0_1) {
            continue label$63
           }
           break label$60;
          };
         }
         label$64 : {
          label$65 : {
           $0_1 = HEAP32[(0 + 2248 | 0) >> 2] | 0;
           if (!$0_1) {
            break label$65
           }
           if ($6_1 >>> 0 >= $0_1 >>> 0) {
            break label$64
           }
          }
          HEAP32[(0 + 2248 | 0) >> 2] = $6_1;
         }
         $0_1 = 0;
         HEAP32[(0 + 2684 | 0) >> 2] = $2_1;
         HEAP32[(0 + 2680 | 0) >> 2] = $6_1;
         HEAP32[(0 + 2264 | 0) >> 2] = -1;
         HEAP32[(0 + 2268 | 0) >> 2] = HEAP32[(0 + 2704 | 0) >> 2] | 0;
         HEAP32[(0 + 2692 | 0) >> 2] = 0;
         label$66 : while (1) {
          $4_1 = $0_1 << 3 | 0;
          $5_1 = $4_1 + 2272 | 0;
          HEAP32[($4_1 + 2280 | 0) >> 2] = $5_1;
          HEAP32[($4_1 + 2284 | 0) >> 2] = $5_1;
          $0_1 = $0_1 + 1 | 0;
          if (($0_1 | 0) != (32 | 0)) {
           continue label$66
          }
          break label$66;
         };
         $0_1 = $2_1 + -40 | 0;
         $4_1 = ($6_1 + 8 | 0) & 7 | 0 ? (-8 - $6_1 | 0) & 7 | 0 : 0;
         $5_1 = $0_1 - $4_1 | 0;
         HEAP32[(0 + 2244 | 0) >> 2] = $5_1;
         $4_1 = $6_1 + $4_1 | 0;
         HEAP32[(0 + 2256 | 0) >> 2] = $4_1;
         HEAP32[($4_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
         HEAP32[(($6_1 + $0_1 | 0) + 4 | 0) >> 2] = 40;
         HEAP32[(0 + 2260 | 0) >> 2] = HEAP32[(0 + 2720 | 0) >> 2] | 0;
         break label$59;
        }
        if ((HEAPU8[($0_1 + 12 | 0) >> 0] | 0) & 8 | 0) {
         break label$60
        }
        if ($5_1 >>> 0 > $4_1 >>> 0) {
         break label$60
        }
        if ($6_1 >>> 0 <= $4_1 >>> 0) {
         break label$60
        }
        HEAP32[($0_1 + 4 | 0) >> 2] = $8_1 + $2_1 | 0;
        $0_1 = ($4_1 + 8 | 0) & 7 | 0 ? (-8 - $4_1 | 0) & 7 | 0 : 0;
        $5_1 = $4_1 + $0_1 | 0;
        HEAP32[(0 + 2256 | 0) >> 2] = $5_1;
        $6_1 = (HEAP32[(0 + 2244 | 0) >> 2] | 0) + $2_1 | 0;
        $0_1 = $6_1 - $0_1 | 0;
        HEAP32[(0 + 2244 | 0) >> 2] = $0_1;
        HEAP32[($5_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
        HEAP32[(($4_1 + $6_1 | 0) + 4 | 0) >> 2] = 40;
        HEAP32[(0 + 2260 | 0) >> 2] = HEAP32[(0 + 2720 | 0) >> 2] | 0;
        break label$59;
       }
       label$67 : {
        $8_1 = HEAP32[(0 + 2248 | 0) >> 2] | 0;
        if ($6_1 >>> 0 >= $8_1 >>> 0) {
         break label$67
        }
        HEAP32[(0 + 2248 | 0) >> 2] = $6_1;
        $8_1 = $6_1;
       }
       $5_1 = $6_1 + $2_1 | 0;
       $0_1 = 2680;
       label$68 : {
        label$69 : {
         label$70 : {
          label$71 : {
           label$72 : {
            label$73 : {
             label$74 : {
              label$75 : while (1) {
               if ((HEAP32[$0_1 >> 2] | 0 | 0) == ($5_1 | 0)) {
                break label$74
               }
               $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
               if ($0_1) {
                continue label$75
               }
               break label$73;
              };
             }
             if (!((HEAPU8[($0_1 + 12 | 0) >> 0] | 0) & 8 | 0)) {
              break label$72
             }
            }
            $0_1 = 2680;
            label$76 : while (1) {
             label$77 : {
              $5_1 = HEAP32[$0_1 >> 2] | 0;
              if ($5_1 >>> 0 > $4_1 >>> 0) {
               break label$77
              }
              $5_1 = $5_1 + (HEAP32[($0_1 + 4 | 0) >> 2] | 0) | 0;
              if ($5_1 >>> 0 > $4_1 >>> 0) {
               break label$71
              }
             }
             $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
             continue label$76;
            };
           }
           HEAP32[$0_1 >> 2] = $6_1;
           HEAP32[($0_1 + 4 | 0) >> 2] = (HEAP32[($0_1 + 4 | 0) >> 2] | 0) + $2_1 | 0;
           $11_1 = $6_1 + (($6_1 + 8 | 0) & 7 | 0 ? (-8 - $6_1 | 0) & 7 | 0 : 0) | 0;
           HEAP32[($11_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
           $2_1 = $5_1 + (($5_1 + 8 | 0) & 7 | 0 ? (-8 - $5_1 | 0) & 7 | 0 : 0) | 0;
           $3_1 = $11_1 + $3_1 | 0;
           $5_1 = $2_1 - $3_1 | 0;
           label$78 : {
            if (($4_1 | 0) != ($2_1 | 0)) {
             break label$78
            }
            HEAP32[(0 + 2256 | 0) >> 2] = $3_1;
            $0_1 = (HEAP32[(0 + 2244 | 0) >> 2] | 0) + $5_1 | 0;
            HEAP32[(0 + 2244 | 0) >> 2] = $0_1;
            HEAP32[($3_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
            break label$69;
           }
           label$79 : {
            if ((HEAP32[(0 + 2252 | 0) >> 2] | 0 | 0) != ($2_1 | 0)) {
             break label$79
            }
            HEAP32[(0 + 2252 | 0) >> 2] = $3_1;
            $0_1 = (HEAP32[(0 + 2240 | 0) >> 2] | 0) + $5_1 | 0;
            HEAP32[(0 + 2240 | 0) >> 2] = $0_1;
            HEAP32[($3_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
            HEAP32[($3_1 + $0_1 | 0) >> 2] = $0_1;
            break label$69;
           }
           label$80 : {
            $0_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
            if (($0_1 & 3 | 0 | 0) != (1 | 0)) {
             break label$80
            }
            $7_1 = $0_1 & -8 | 0;
            label$81 : {
             label$82 : {
              if ($0_1 >>> 0 > 255 >>> 0) {
               break label$82
              }
              $4_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
              $8_1 = $0_1 >>> 3 | 0;
              $6_1 = ($8_1 << 3 | 0) + 2272 | 0;
              label$83 : {
               $0_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
               if (($0_1 | 0) != ($4_1 | 0)) {
                break label$83
               }
               (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 2232 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $8_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2232 | 0) >> 2] = wasm2js_i32$1;
               break label$81;
              }
              HEAP32[($4_1 + 12 | 0) >> 2] = $0_1;
              HEAP32[($0_1 + 8 | 0) >> 2] = $4_1;
              break label$81;
             }
             $9_1 = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
             label$84 : {
              label$85 : {
               $6_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
               if (($6_1 | 0) == ($2_1 | 0)) {
                break label$85
               }
               $0_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
               HEAP32[($0_1 + 12 | 0) >> 2] = $6_1;
               HEAP32[($6_1 + 8 | 0) >> 2] = $0_1;
               break label$84;
              }
              label$86 : {
               $0_1 = $2_1 + 20 | 0;
               $4_1 = HEAP32[$0_1 >> 2] | 0;
               if ($4_1) {
                break label$86
               }
               $0_1 = $2_1 + 16 | 0;
               $4_1 = HEAP32[$0_1 >> 2] | 0;
               if ($4_1) {
                break label$86
               }
               $6_1 = 0;
               break label$84;
              }
              label$87 : while (1) {
               $8_1 = $0_1;
               $6_1 = $4_1;
               $0_1 = $4_1 + 20 | 0;
               $4_1 = HEAP32[$0_1 >> 2] | 0;
               if ($4_1) {
                continue label$87
               }
               $0_1 = $6_1 + 16 | 0;
               $4_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
               if ($4_1) {
                continue label$87
               }
               break label$87;
              };
              HEAP32[$8_1 >> 2] = 0;
             }
             if (!$9_1) {
              break label$81
             }
             label$88 : {
              label$89 : {
               $4_1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
               $0_1 = ($4_1 << 2 | 0) + 2536 | 0;
               if ((HEAP32[$0_1 >> 2] | 0 | 0) != ($2_1 | 0)) {
                break label$89
               }
               HEAP32[$0_1 >> 2] = $6_1;
               if ($6_1) {
                break label$88
               }
               (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 2236 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $4_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2236 | 0) >> 2] = wasm2js_i32$1;
               break label$81;
              }
              HEAP32[($9_1 + ((HEAP32[($9_1 + 16 | 0) >> 2] | 0 | 0) == ($2_1 | 0) ? 16 : 20) | 0) >> 2] = $6_1;
              if (!$6_1) {
               break label$81
              }
             }
             HEAP32[($6_1 + 24 | 0) >> 2] = $9_1;
             label$90 : {
              $0_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
              if (!$0_1) {
               break label$90
              }
              HEAP32[($6_1 + 16 | 0) >> 2] = $0_1;
              HEAP32[($0_1 + 24 | 0) >> 2] = $6_1;
             }
             $0_1 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
             if (!$0_1) {
              break label$81
             }
             HEAP32[($6_1 + 20 | 0) >> 2] = $0_1;
             HEAP32[($0_1 + 24 | 0) >> 2] = $6_1;
            }
            $5_1 = $7_1 + $5_1 | 0;
            $2_1 = $2_1 + $7_1 | 0;
           }
           HEAP32[($2_1 + 4 | 0) >> 2] = (HEAP32[($2_1 + 4 | 0) >> 2] | 0) & -2 | 0;
           HEAP32[($3_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
           HEAP32[($3_1 + $5_1 | 0) >> 2] = $5_1;
           label$91 : {
            if ($5_1 >>> 0 > 255 >>> 0) {
             break label$91
            }
            $4_1 = $5_1 >>> 3 | 0;
            $0_1 = ($4_1 << 3 | 0) + 2272 | 0;
            label$92 : {
             label$93 : {
              $5_1 = HEAP32[(0 + 2232 | 0) >> 2] | 0;
              $4_1 = 1 << $4_1 | 0;
              if ($5_1 & $4_1 | 0) {
               break label$93
              }
              HEAP32[(0 + 2232 | 0) >> 2] = $5_1 | $4_1 | 0;
              $4_1 = $0_1;
              break label$92;
             }
             $4_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
            }
            HEAP32[($0_1 + 8 | 0) >> 2] = $3_1;
            HEAP32[($4_1 + 12 | 0) >> 2] = $3_1;
            HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
            HEAP32[($3_1 + 8 | 0) >> 2] = $4_1;
            break label$69;
           }
           $0_1 = 31;
           label$94 : {
            if ($5_1 >>> 0 > 16777215 >>> 0) {
             break label$94
            }
            $0_1 = $5_1 >>> 8 | 0;
            $1157 = $0_1;
            $0_1 = (($0_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
            $4_1 = $1157 << $0_1 | 0;
            $1164 = $4_1;
            $4_1 = (($4_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
            $6_1 = $1164 << $4_1 | 0;
            $1171 = $6_1;
            $6_1 = (($6_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
            $0_1 = (($1171 << $6_1 | 0) >>> 15 | 0) - ($0_1 | $4_1 | 0 | $6_1 | 0) | 0;
            $0_1 = ($0_1 << 1 | 0 | (($5_1 >>> ($0_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
           }
           HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
           i64toi32_i32$1 = $3_1;
           i64toi32_i32$0 = 0;
           HEAP32[($3_1 + 16 | 0) >> 2] = 0;
           HEAP32[($3_1 + 20 | 0) >> 2] = i64toi32_i32$0;
           $4_1 = ($0_1 << 2 | 0) + 2536 | 0;
           label$95 : {
            label$96 : {
             $6_1 = HEAP32[(0 + 2236 | 0) >> 2] | 0;
             $8_1 = 1 << $0_1 | 0;
             if ($6_1 & $8_1 | 0) {
              break label$96
             }
             HEAP32[(0 + 2236 | 0) >> 2] = $6_1 | $8_1 | 0;
             HEAP32[$4_1 >> 2] = $3_1;
             HEAP32[($3_1 + 24 | 0) >> 2] = $4_1;
             break label$95;
            }
            $0_1 = $5_1 << (($0_1 | 0) == (31 | 0) ? 0 : 25 - ($0_1 >>> 1 | 0) | 0) | 0;
            $6_1 = HEAP32[$4_1 >> 2] | 0;
            label$97 : while (1) {
             $4_1 = $6_1;
             if (((HEAP32[($4_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($5_1 | 0)) {
              break label$70
             }
             $6_1 = $0_1 >>> 29 | 0;
             $0_1 = $0_1 << 1 | 0;
             $8_1 = ($4_1 + ($6_1 & 4 | 0) | 0) + 16 | 0;
             $6_1 = HEAP32[$8_1 >> 2] | 0;
             if ($6_1) {
              continue label$97
             }
             break label$97;
            };
            HEAP32[$8_1 >> 2] = $3_1;
            HEAP32[($3_1 + 24 | 0) >> 2] = $4_1;
           }
           HEAP32[($3_1 + 12 | 0) >> 2] = $3_1;
           HEAP32[($3_1 + 8 | 0) >> 2] = $3_1;
           break label$69;
          }
          $0_1 = $2_1 + -40 | 0;
          $8_1 = ($6_1 + 8 | 0) & 7 | 0 ? (-8 - $6_1 | 0) & 7 | 0 : 0;
          $11_1 = $0_1 - $8_1 | 0;
          HEAP32[(0 + 2244 | 0) >> 2] = $11_1;
          $8_1 = $6_1 + $8_1 | 0;
          HEAP32[(0 + 2256 | 0) >> 2] = $8_1;
          HEAP32[($8_1 + 4 | 0) >> 2] = $11_1 | 1 | 0;
          HEAP32[(($6_1 + $0_1 | 0) + 4 | 0) >> 2] = 40;
          HEAP32[(0 + 2260 | 0) >> 2] = HEAP32[(0 + 2720 | 0) >> 2] | 0;
          $0_1 = ($5_1 + (($5_1 + -39 | 0) & 7 | 0 ? (39 - $5_1 | 0) & 7 | 0 : 0) | 0) + -47 | 0;
          $8_1 = $0_1 >>> 0 < ($4_1 + 16 | 0) >>> 0 ? $4_1 : $0_1;
          HEAP32[($8_1 + 4 | 0) >> 2] = 27;
          i64toi32_i32$2 = 0;
          i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 2688 | 0) >> 2] | 0;
          i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 2692 | 0) >> 2] | 0;
          $1293 = i64toi32_i32$0;
          i64toi32_i32$0 = $8_1 + 16 | 0;
          HEAP32[i64toi32_i32$0 >> 2] = $1293;
          HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
          i64toi32_i32$2 = 0;
          i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 2680 | 0) >> 2] | 0;
          i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 2684 | 0) >> 2] | 0;
          $1295 = i64toi32_i32$1;
          i64toi32_i32$1 = $8_1;
          HEAP32[($8_1 + 8 | 0) >> 2] = $1295;
          HEAP32[($8_1 + 12 | 0) >> 2] = i64toi32_i32$0;
          HEAP32[(0 + 2688 | 0) >> 2] = $8_1 + 8 | 0;
          HEAP32[(0 + 2684 | 0) >> 2] = $2_1;
          HEAP32[(0 + 2680 | 0) >> 2] = $6_1;
          HEAP32[(0 + 2692 | 0) >> 2] = 0;
          $0_1 = $8_1 + 24 | 0;
          label$98 : while (1) {
           HEAP32[($0_1 + 4 | 0) >> 2] = 7;
           $6_1 = $0_1 + 8 | 0;
           $0_1 = $0_1 + 4 | 0;
           if ($5_1 >>> 0 > $6_1 >>> 0) {
            continue label$98
           }
           break label$98;
          };
          if (($8_1 | 0) == ($4_1 | 0)) {
           break label$59
          }
          HEAP32[($8_1 + 4 | 0) >> 2] = (HEAP32[($8_1 + 4 | 0) >> 2] | 0) & -2 | 0;
          $2_1 = $8_1 - $4_1 | 0;
          HEAP32[($4_1 + 4 | 0) >> 2] = $2_1 | 1 | 0;
          HEAP32[$8_1 >> 2] = $2_1;
          label$99 : {
           if ($2_1 >>> 0 > 255 >>> 0) {
            break label$99
           }
           $5_1 = $2_1 >>> 3 | 0;
           $0_1 = ($5_1 << 3 | 0) + 2272 | 0;
           label$100 : {
            label$101 : {
             $6_1 = HEAP32[(0 + 2232 | 0) >> 2] | 0;
             $5_1 = 1 << $5_1 | 0;
             if ($6_1 & $5_1 | 0) {
              break label$101
             }
             HEAP32[(0 + 2232 | 0) >> 2] = $6_1 | $5_1 | 0;
             $5_1 = $0_1;
             break label$100;
            }
            $5_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
           }
           HEAP32[($0_1 + 8 | 0) >> 2] = $4_1;
           HEAP32[($5_1 + 12 | 0) >> 2] = $4_1;
           HEAP32[($4_1 + 12 | 0) >> 2] = $0_1;
           HEAP32[($4_1 + 8 | 0) >> 2] = $5_1;
           break label$59;
          }
          $0_1 = 31;
          label$102 : {
           if ($2_1 >>> 0 > 16777215 >>> 0) {
            break label$102
           }
           $0_1 = $2_1 >>> 8 | 0;
           $1356 = $0_1;
           $0_1 = (($0_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
           $5_1 = $1356 << $0_1 | 0;
           $1363 = $5_1;
           $5_1 = (($5_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
           $6_1 = $1363 << $5_1 | 0;
           $1370 = $6_1;
           $6_1 = (($6_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
           $0_1 = (($1370 << $6_1 | 0) >>> 15 | 0) - ($0_1 | $5_1 | 0 | $6_1 | 0) | 0;
           $0_1 = ($0_1 << 1 | 0 | (($2_1 >>> ($0_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
          }
          i64toi32_i32$1 = $4_1;
          i64toi32_i32$0 = 0;
          HEAP32[($4_1 + 16 | 0) >> 2] = 0;
          HEAP32[($4_1 + 20 | 0) >> 2] = i64toi32_i32$0;
          HEAP32[($4_1 + 28 | 0) >> 2] = $0_1;
          $5_1 = ($0_1 << 2 | 0) + 2536 | 0;
          label$103 : {
           label$104 : {
            $6_1 = HEAP32[(0 + 2236 | 0) >> 2] | 0;
            $8_1 = 1 << $0_1 | 0;
            if ($6_1 & $8_1 | 0) {
             break label$104
            }
            HEAP32[(0 + 2236 | 0) >> 2] = $6_1 | $8_1 | 0;
            HEAP32[$5_1 >> 2] = $4_1;
            HEAP32[($4_1 + 24 | 0) >> 2] = $5_1;
            break label$103;
           }
           $0_1 = $2_1 << (($0_1 | 0) == (31 | 0) ? 0 : 25 - ($0_1 >>> 1 | 0) | 0) | 0;
           $6_1 = HEAP32[$5_1 >> 2] | 0;
           label$105 : while (1) {
            $5_1 = $6_1;
            if (((HEAP32[($6_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($2_1 | 0)) {
             break label$68
            }
            $6_1 = $0_1 >>> 29 | 0;
            $0_1 = $0_1 << 1 | 0;
            $8_1 = ($5_1 + ($6_1 & 4 | 0) | 0) + 16 | 0;
            $6_1 = HEAP32[$8_1 >> 2] | 0;
            if ($6_1) {
             continue label$105
            }
            break label$105;
           };
           HEAP32[$8_1 >> 2] = $4_1;
           HEAP32[($4_1 + 24 | 0) >> 2] = $5_1;
          }
          HEAP32[($4_1 + 12 | 0) >> 2] = $4_1;
          HEAP32[($4_1 + 8 | 0) >> 2] = $4_1;
          break label$59;
         }
         $0_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
         HEAP32[($0_1 + 12 | 0) >> 2] = $3_1;
         HEAP32[($4_1 + 8 | 0) >> 2] = $3_1;
         HEAP32[($3_1 + 24 | 0) >> 2] = 0;
         HEAP32[($3_1 + 12 | 0) >> 2] = $4_1;
         HEAP32[($3_1 + 8 | 0) >> 2] = $0_1;
        }
        $0_1 = $11_1 + 8 | 0;
        break label$1;
       }
       $0_1 = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
       HEAP32[($0_1 + 12 | 0) >> 2] = $4_1;
       HEAP32[($5_1 + 8 | 0) >> 2] = $4_1;
       HEAP32[($4_1 + 24 | 0) >> 2] = 0;
       HEAP32[($4_1 + 12 | 0) >> 2] = $5_1;
       HEAP32[($4_1 + 8 | 0) >> 2] = $0_1;
      }
      $0_1 = HEAP32[(0 + 2244 | 0) >> 2] | 0;
      if ($0_1 >>> 0 <= $3_1 >>> 0) {
       break label$4
      }
      $4_1 = $0_1 - $3_1 | 0;
      HEAP32[(0 + 2244 | 0) >> 2] = $4_1;
      $0_1 = HEAP32[(0 + 2256 | 0) >> 2] | 0;
      $5_1 = $0_1 + $3_1 | 0;
      HEAP32[(0 + 2256 | 0) >> 2] = $5_1;
      HEAP32[($5_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
      HEAP32[($0_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
      $0_1 = $0_1 + 8 | 0;
      break label$1;
     }
     (wasm2js_i32$0 = $20() | 0, wasm2js_i32$1 = 48), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
     $0_1 = 0;
     break label$1;
    }
    label$106 : {
     if (!$11_1) {
      break label$106
     }
     label$107 : {
      label$108 : {
       $5_1 = HEAP32[($8_1 + 28 | 0) >> 2] | 0;
       $0_1 = ($5_1 << 2 | 0) + 2536 | 0;
       if (($8_1 | 0) != (HEAP32[$0_1 >> 2] | 0 | 0)) {
        break label$108
       }
       HEAP32[$0_1 >> 2] = $6_1;
       if ($6_1) {
        break label$107
       }
       $7_1 = $7_1 & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0;
       HEAP32[(0 + 2236 | 0) >> 2] = $7_1;
       break label$106;
      }
      HEAP32[($11_1 + ((HEAP32[($11_1 + 16 | 0) >> 2] | 0 | 0) == ($8_1 | 0) ? 16 : 20) | 0) >> 2] = $6_1;
      if (!$6_1) {
       break label$106
      }
     }
     HEAP32[($6_1 + 24 | 0) >> 2] = $11_1;
     label$109 : {
      $0_1 = HEAP32[($8_1 + 16 | 0) >> 2] | 0;
      if (!$0_1) {
       break label$109
      }
      HEAP32[($6_1 + 16 | 0) >> 2] = $0_1;
      HEAP32[($0_1 + 24 | 0) >> 2] = $6_1;
     }
     $0_1 = HEAP32[($8_1 + 20 | 0) >> 2] | 0;
     if (!$0_1) {
      break label$106
     }
     HEAP32[($6_1 + 20 | 0) >> 2] = $0_1;
     HEAP32[($0_1 + 24 | 0) >> 2] = $6_1;
    }
    label$110 : {
     label$111 : {
      if ($4_1 >>> 0 > 15 >>> 0) {
       break label$111
      }
      $0_1 = $4_1 + $3_1 | 0;
      HEAP32[($8_1 + 4 | 0) >> 2] = $0_1 | 3 | 0;
      $0_1 = $8_1 + $0_1 | 0;
      HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
      break label$110;
     }
     HEAP32[($8_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
     $6_1 = $8_1 + $3_1 | 0;
     HEAP32[($6_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
     HEAP32[($6_1 + $4_1 | 0) >> 2] = $4_1;
     label$112 : {
      if ($4_1 >>> 0 > 255 >>> 0) {
       break label$112
      }
      $4_1 = $4_1 >>> 3 | 0;
      $0_1 = ($4_1 << 3 | 0) + 2272 | 0;
      label$113 : {
       label$114 : {
        $5_1 = HEAP32[(0 + 2232 | 0) >> 2] | 0;
        $4_1 = 1 << $4_1 | 0;
        if ($5_1 & $4_1 | 0) {
         break label$114
        }
        HEAP32[(0 + 2232 | 0) >> 2] = $5_1 | $4_1 | 0;
        $4_1 = $0_1;
        break label$113;
       }
       $4_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
      }
      HEAP32[($0_1 + 8 | 0) >> 2] = $6_1;
      HEAP32[($4_1 + 12 | 0) >> 2] = $6_1;
      HEAP32[($6_1 + 12 | 0) >> 2] = $0_1;
      HEAP32[($6_1 + 8 | 0) >> 2] = $4_1;
      break label$110;
     }
     $0_1 = 31;
     label$115 : {
      if ($4_1 >>> 0 > 16777215 >>> 0) {
       break label$115
      }
      $0_1 = $4_1 >>> 8 | 0;
      $1606 = $0_1;
      $0_1 = (($0_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
      $5_1 = $1606 << $0_1 | 0;
      $1613 = $5_1;
      $5_1 = (($5_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
      $3_1 = $1613 << $5_1 | 0;
      $1620 = $3_1;
      $3_1 = (($3_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
      $0_1 = (($1620 << $3_1 | 0) >>> 15 | 0) - ($0_1 | $5_1 | 0 | $3_1 | 0) | 0;
      $0_1 = ($0_1 << 1 | 0 | (($4_1 >>> ($0_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
     }
     HEAP32[($6_1 + 28 | 0) >> 2] = $0_1;
     i64toi32_i32$1 = $6_1;
     i64toi32_i32$0 = 0;
     HEAP32[($6_1 + 16 | 0) >> 2] = 0;
     HEAP32[($6_1 + 20 | 0) >> 2] = i64toi32_i32$0;
     $5_1 = ($0_1 << 2 | 0) + 2536 | 0;
     label$116 : {
      label$117 : {
       label$118 : {
        $3_1 = 1 << $0_1 | 0;
        if ($7_1 & $3_1 | 0) {
         break label$118
        }
        HEAP32[(0 + 2236 | 0) >> 2] = $7_1 | $3_1 | 0;
        HEAP32[$5_1 >> 2] = $6_1;
        HEAP32[($6_1 + 24 | 0) >> 2] = $5_1;
        break label$117;
       }
       $0_1 = $4_1 << (($0_1 | 0) == (31 | 0) ? 0 : 25 - ($0_1 >>> 1 | 0) | 0) | 0;
       $3_1 = HEAP32[$5_1 >> 2] | 0;
       label$119 : while (1) {
        $5_1 = $3_1;
        if (((HEAP32[($5_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($4_1 | 0)) {
         break label$116
        }
        $3_1 = $0_1 >>> 29 | 0;
        $0_1 = $0_1 << 1 | 0;
        $2_1 = ($5_1 + ($3_1 & 4 | 0) | 0) + 16 | 0;
        $3_1 = HEAP32[$2_1 >> 2] | 0;
        if ($3_1) {
         continue label$119
        }
        break label$119;
       };
       HEAP32[$2_1 >> 2] = $6_1;
       HEAP32[($6_1 + 24 | 0) >> 2] = $5_1;
      }
      HEAP32[($6_1 + 12 | 0) >> 2] = $6_1;
      HEAP32[($6_1 + 8 | 0) >> 2] = $6_1;
      break label$110;
     }
     $0_1 = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
     HEAP32[($0_1 + 12 | 0) >> 2] = $6_1;
     HEAP32[($5_1 + 8 | 0) >> 2] = $6_1;
     HEAP32[($6_1 + 24 | 0) >> 2] = 0;
     HEAP32[($6_1 + 12 | 0) >> 2] = $5_1;
     HEAP32[($6_1 + 8 | 0) >> 2] = $0_1;
    }
    $0_1 = $8_1 + 8 | 0;
    break label$1;
   }
   label$120 : {
    if (!$10_1) {
     break label$120
    }
    label$121 : {
     label$122 : {
      $5_1 = HEAP32[($6_1 + 28 | 0) >> 2] | 0;
      $0_1 = ($5_1 << 2 | 0) + 2536 | 0;
      if (($6_1 | 0) != (HEAP32[$0_1 >> 2] | 0 | 0)) {
       break label$122
      }
      HEAP32[$0_1 >> 2] = $8_1;
      if ($8_1) {
       break label$121
      }
      (wasm2js_i32$0 = 0, wasm2js_i32$1 = $9_1 & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2236 | 0) >> 2] = wasm2js_i32$1;
      break label$120;
     }
     HEAP32[($10_1 + ((HEAP32[($10_1 + 16 | 0) >> 2] | 0 | 0) == ($6_1 | 0) ? 16 : 20) | 0) >> 2] = $8_1;
     if (!$8_1) {
      break label$120
     }
    }
    HEAP32[($8_1 + 24 | 0) >> 2] = $10_1;
    label$123 : {
     $0_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
     if (!$0_1) {
      break label$123
     }
     HEAP32[($8_1 + 16 | 0) >> 2] = $0_1;
     HEAP32[($0_1 + 24 | 0) >> 2] = $8_1;
    }
    $0_1 = HEAP32[($6_1 + 20 | 0) >> 2] | 0;
    if (!$0_1) {
     break label$120
    }
    HEAP32[($8_1 + 20 | 0) >> 2] = $0_1;
    HEAP32[($0_1 + 24 | 0) >> 2] = $8_1;
   }
   label$124 : {
    label$125 : {
     if ($4_1 >>> 0 > 15 >>> 0) {
      break label$125
     }
     $0_1 = $4_1 + $3_1 | 0;
     HEAP32[($6_1 + 4 | 0) >> 2] = $0_1 | 3 | 0;
     $0_1 = $6_1 + $0_1 | 0;
     HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
     break label$124;
    }
    HEAP32[($6_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
    $5_1 = $6_1 + $3_1 | 0;
    HEAP32[($5_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
    HEAP32[($5_1 + $4_1 | 0) >> 2] = $4_1;
    label$126 : {
     if (!$7_1) {
      break label$126
     }
     $8_1 = $7_1 >>> 3 | 0;
     $3_1 = ($8_1 << 3 | 0) + 2272 | 0;
     $0_1 = HEAP32[(0 + 2252 | 0) >> 2] | 0;
     label$127 : {
      label$128 : {
       $8_1 = 1 << $8_1 | 0;
       if ($8_1 & $2_1 | 0) {
        break label$128
       }
       HEAP32[(0 + 2232 | 0) >> 2] = $8_1 | $2_1 | 0;
       $8_1 = $3_1;
       break label$127;
      }
      $8_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
     }
     HEAP32[($3_1 + 8 | 0) >> 2] = $0_1;
     HEAP32[($8_1 + 12 | 0) >> 2] = $0_1;
     HEAP32[($0_1 + 12 | 0) >> 2] = $3_1;
     HEAP32[($0_1 + 8 | 0) >> 2] = $8_1;
    }
    HEAP32[(0 + 2252 | 0) >> 2] = $5_1;
    HEAP32[(0 + 2240 | 0) >> 2] = $4_1;
   }
   $0_1 = $6_1 + 8 | 0;
  }
  global$0 = $1_1 + 16 | 0;
  return $0_1 | 0;
 }
 
 function $30($0_1) {
  $0_1 = $0_1 | 0;
  var $2_1 = 0, $6_1 = 0, $1_1 = 0, $4_1 = 0, $3_1 = 0, $5_1 = 0, $7_1 = 0, $379 = 0, $386 = 0, $393 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  label$1 : {
   if (!$0_1) {
    break label$1
   }
   $1_1 = $0_1 + -8 | 0;
   $2_1 = HEAP32[($0_1 + -4 | 0) >> 2] | 0;
   $0_1 = $2_1 & -8 | 0;
   $3_1 = $1_1 + $0_1 | 0;
   label$2 : {
    if ($2_1 & 1 | 0) {
     break label$2
    }
    if (!($2_1 & 3 | 0)) {
     break label$1
    }
    $2_1 = HEAP32[$1_1 >> 2] | 0;
    $1_1 = $1_1 - $2_1 | 0;
    $4_1 = HEAP32[(0 + 2248 | 0) >> 2] | 0;
    if ($1_1 >>> 0 < $4_1 >>> 0) {
     break label$1
    }
    $0_1 = $2_1 + $0_1 | 0;
    label$3 : {
     if ((HEAP32[(0 + 2252 | 0) >> 2] | 0 | 0) == ($1_1 | 0)) {
      break label$3
     }
     label$4 : {
      if ($2_1 >>> 0 > 255 >>> 0) {
       break label$4
      }
      $4_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
      $5_1 = $2_1 >>> 3 | 0;
      $6_1 = ($5_1 << 3 | 0) + 2272 | 0;
      label$5 : {
       $2_1 = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
       if (($2_1 | 0) != ($4_1 | 0)) {
        break label$5
       }
       (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 2232 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2232 | 0) >> 2] = wasm2js_i32$1;
       break label$2;
      }
      HEAP32[($4_1 + 12 | 0) >> 2] = $2_1;
      HEAP32[($2_1 + 8 | 0) >> 2] = $4_1;
      break label$2;
     }
     $7_1 = HEAP32[($1_1 + 24 | 0) >> 2] | 0;
     label$6 : {
      label$7 : {
       $6_1 = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
       if (($6_1 | 0) == ($1_1 | 0)) {
        break label$7
       }
       $2_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
       HEAP32[($2_1 + 12 | 0) >> 2] = $6_1;
       HEAP32[($6_1 + 8 | 0) >> 2] = $2_1;
       break label$6;
      }
      label$8 : {
       $2_1 = $1_1 + 20 | 0;
       $4_1 = HEAP32[$2_1 >> 2] | 0;
       if ($4_1) {
        break label$8
       }
       $2_1 = $1_1 + 16 | 0;
       $4_1 = HEAP32[$2_1 >> 2] | 0;
       if ($4_1) {
        break label$8
       }
       $6_1 = 0;
       break label$6;
      }
      label$9 : while (1) {
       $5_1 = $2_1;
       $6_1 = $4_1;
       $2_1 = $6_1 + 20 | 0;
       $4_1 = HEAP32[$2_1 >> 2] | 0;
       if ($4_1) {
        continue label$9
       }
       $2_1 = $6_1 + 16 | 0;
       $4_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
       if ($4_1) {
        continue label$9
       }
       break label$9;
      };
      HEAP32[$5_1 >> 2] = 0;
     }
     if (!$7_1) {
      break label$2
     }
     label$10 : {
      label$11 : {
       $4_1 = HEAP32[($1_1 + 28 | 0) >> 2] | 0;
       $2_1 = ($4_1 << 2 | 0) + 2536 | 0;
       if ((HEAP32[$2_1 >> 2] | 0 | 0) != ($1_1 | 0)) {
        break label$11
       }
       HEAP32[$2_1 >> 2] = $6_1;
       if ($6_1) {
        break label$10
       }
       (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 2236 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $4_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2236 | 0) >> 2] = wasm2js_i32$1;
       break label$2;
      }
      HEAP32[($7_1 + ((HEAP32[($7_1 + 16 | 0) >> 2] | 0 | 0) == ($1_1 | 0) ? 16 : 20) | 0) >> 2] = $6_1;
      if (!$6_1) {
       break label$2
      }
     }
     HEAP32[($6_1 + 24 | 0) >> 2] = $7_1;
     label$12 : {
      $2_1 = HEAP32[($1_1 + 16 | 0) >> 2] | 0;
      if (!$2_1) {
       break label$12
      }
      HEAP32[($6_1 + 16 | 0) >> 2] = $2_1;
      HEAP32[($2_1 + 24 | 0) >> 2] = $6_1;
     }
     $2_1 = HEAP32[($1_1 + 20 | 0) >> 2] | 0;
     if (!$2_1) {
      break label$2
     }
     HEAP32[($6_1 + 20 | 0) >> 2] = $2_1;
     HEAP32[($2_1 + 24 | 0) >> 2] = $6_1;
     break label$2;
    }
    $2_1 = HEAP32[($3_1 + 4 | 0) >> 2] | 0;
    if (($2_1 & 3 | 0 | 0) != (3 | 0)) {
     break label$2
    }
    HEAP32[(0 + 2240 | 0) >> 2] = $0_1;
    HEAP32[($3_1 + 4 | 0) >> 2] = $2_1 & -2 | 0;
    HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
    HEAP32[($1_1 + $0_1 | 0) >> 2] = $0_1;
    return;
   }
   if ($3_1 >>> 0 <= $1_1 >>> 0) {
    break label$1
   }
   $2_1 = HEAP32[($3_1 + 4 | 0) >> 2] | 0;
   if (!($2_1 & 1 | 0)) {
    break label$1
   }
   label$13 : {
    label$14 : {
     if ($2_1 & 2 | 0) {
      break label$14
     }
     label$15 : {
      if ((HEAP32[(0 + 2256 | 0) >> 2] | 0 | 0) != ($3_1 | 0)) {
       break label$15
      }
      HEAP32[(0 + 2256 | 0) >> 2] = $1_1;
      $0_1 = (HEAP32[(0 + 2244 | 0) >> 2] | 0) + $0_1 | 0;
      HEAP32[(0 + 2244 | 0) >> 2] = $0_1;
      HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
      if (($1_1 | 0) != (HEAP32[(0 + 2252 | 0) >> 2] | 0 | 0)) {
       break label$1
      }
      HEAP32[(0 + 2240 | 0) >> 2] = 0;
      HEAP32[(0 + 2252 | 0) >> 2] = 0;
      return;
     }
     label$16 : {
      if ((HEAP32[(0 + 2252 | 0) >> 2] | 0 | 0) != ($3_1 | 0)) {
       break label$16
      }
      HEAP32[(0 + 2252 | 0) >> 2] = $1_1;
      $0_1 = (HEAP32[(0 + 2240 | 0) >> 2] | 0) + $0_1 | 0;
      HEAP32[(0 + 2240 | 0) >> 2] = $0_1;
      HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
      HEAP32[($1_1 + $0_1 | 0) >> 2] = $0_1;
      return;
     }
     $0_1 = ($2_1 & -8 | 0) + $0_1 | 0;
     label$17 : {
      label$18 : {
       if ($2_1 >>> 0 > 255 >>> 0) {
        break label$18
       }
       $4_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
       $5_1 = $2_1 >>> 3 | 0;
       $6_1 = ($5_1 << 3 | 0) + 2272 | 0;
       label$19 : {
        $2_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
        if (($2_1 | 0) != ($4_1 | 0)) {
         break label$19
        }
        (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 2232 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2232 | 0) >> 2] = wasm2js_i32$1;
        break label$17;
       }
       HEAP32[($4_1 + 12 | 0) >> 2] = $2_1;
       HEAP32[($2_1 + 8 | 0) >> 2] = $4_1;
       break label$17;
      }
      $7_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
      label$20 : {
       label$21 : {
        $6_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
        if (($6_1 | 0) == ($3_1 | 0)) {
         break label$21
        }
        $2_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
        HEAP32[(0 + 2248 | 0) >> 2] | 0;
        HEAP32[($2_1 + 12 | 0) >> 2] = $6_1;
        HEAP32[($6_1 + 8 | 0) >> 2] = $2_1;
        break label$20;
       }
       label$22 : {
        $2_1 = $3_1 + 20 | 0;
        $4_1 = HEAP32[$2_1 >> 2] | 0;
        if ($4_1) {
         break label$22
        }
        $2_1 = $3_1 + 16 | 0;
        $4_1 = HEAP32[$2_1 >> 2] | 0;
        if ($4_1) {
         break label$22
        }
        $6_1 = 0;
        break label$20;
       }
       label$23 : while (1) {
        $5_1 = $2_1;
        $6_1 = $4_1;
        $2_1 = $6_1 + 20 | 0;
        $4_1 = HEAP32[$2_1 >> 2] | 0;
        if ($4_1) {
         continue label$23
        }
        $2_1 = $6_1 + 16 | 0;
        $4_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
        if ($4_1) {
         continue label$23
        }
        break label$23;
       };
       HEAP32[$5_1 >> 2] = 0;
      }
      if (!$7_1) {
       break label$17
      }
      label$24 : {
       label$25 : {
        $4_1 = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
        $2_1 = ($4_1 << 2 | 0) + 2536 | 0;
        if ((HEAP32[$2_1 >> 2] | 0 | 0) != ($3_1 | 0)) {
         break label$25
        }
        HEAP32[$2_1 >> 2] = $6_1;
        if ($6_1) {
         break label$24
        }
        (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 2236 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $4_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2236 | 0) >> 2] = wasm2js_i32$1;
        break label$17;
       }
       HEAP32[($7_1 + ((HEAP32[($7_1 + 16 | 0) >> 2] | 0 | 0) == ($3_1 | 0) ? 16 : 20) | 0) >> 2] = $6_1;
       if (!$6_1) {
        break label$17
       }
      }
      HEAP32[($6_1 + 24 | 0) >> 2] = $7_1;
      label$26 : {
       $2_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
       if (!$2_1) {
        break label$26
       }
       HEAP32[($6_1 + 16 | 0) >> 2] = $2_1;
       HEAP32[($2_1 + 24 | 0) >> 2] = $6_1;
      }
      $2_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
      if (!$2_1) {
       break label$17
      }
      HEAP32[($6_1 + 20 | 0) >> 2] = $2_1;
      HEAP32[($2_1 + 24 | 0) >> 2] = $6_1;
     }
     HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
     HEAP32[($1_1 + $0_1 | 0) >> 2] = $0_1;
     if (($1_1 | 0) != (HEAP32[(0 + 2252 | 0) >> 2] | 0 | 0)) {
      break label$13
     }
     HEAP32[(0 + 2240 | 0) >> 2] = $0_1;
     return;
    }
    HEAP32[($3_1 + 4 | 0) >> 2] = $2_1 & -2 | 0;
    HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
    HEAP32[($1_1 + $0_1 | 0) >> 2] = $0_1;
   }
   label$27 : {
    if ($0_1 >>> 0 > 255 >>> 0) {
     break label$27
    }
    $2_1 = $0_1 >>> 3 | 0;
    $0_1 = ($2_1 << 3 | 0) + 2272 | 0;
    label$28 : {
     label$29 : {
      $4_1 = HEAP32[(0 + 2232 | 0) >> 2] | 0;
      $2_1 = 1 << $2_1 | 0;
      if ($4_1 & $2_1 | 0) {
       break label$29
      }
      HEAP32[(0 + 2232 | 0) >> 2] = $4_1 | $2_1 | 0;
      $2_1 = $0_1;
      break label$28;
     }
     $2_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
    }
    HEAP32[($0_1 + 8 | 0) >> 2] = $1_1;
    HEAP32[($2_1 + 12 | 0) >> 2] = $1_1;
    HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
    HEAP32[($1_1 + 8 | 0) >> 2] = $2_1;
    return;
   }
   $2_1 = 31;
   label$30 : {
    if ($0_1 >>> 0 > 16777215 >>> 0) {
     break label$30
    }
    $2_1 = $0_1 >>> 8 | 0;
    $379 = $2_1;
    $2_1 = (($2_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
    $4_1 = $379 << $2_1 | 0;
    $386 = $4_1;
    $4_1 = (($4_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
    $6_1 = $386 << $4_1 | 0;
    $393 = $6_1;
    $6_1 = (($6_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
    $2_1 = (($393 << $6_1 | 0) >>> 15 | 0) - ($2_1 | $4_1 | 0 | $6_1 | 0) | 0;
    $2_1 = ($2_1 << 1 | 0 | (($0_1 >>> ($2_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
   }
   HEAP32[($1_1 + 16 | 0) >> 2] = 0;
   HEAP32[($1_1 + 20 | 0) >> 2] = 0;
   HEAP32[($1_1 + 28 | 0) >> 2] = $2_1;
   $4_1 = ($2_1 << 2 | 0) + 2536 | 0;
   label$31 : {
    label$32 : {
     label$33 : {
      label$34 : {
       $6_1 = HEAP32[(0 + 2236 | 0) >> 2] | 0;
       $3_1 = 1 << $2_1 | 0;
       if ($6_1 & $3_1 | 0) {
        break label$34
       }
       HEAP32[(0 + 2236 | 0) >> 2] = $6_1 | $3_1 | 0;
       HEAP32[$4_1 >> 2] = $1_1;
       HEAP32[($1_1 + 24 | 0) >> 2] = $4_1;
       break label$33;
      }
      $2_1 = $0_1 << (($2_1 | 0) == (31 | 0) ? 0 : 25 - ($2_1 >>> 1 | 0) | 0) | 0;
      $6_1 = HEAP32[$4_1 >> 2] | 0;
      label$35 : while (1) {
       $4_1 = $6_1;
       if (((HEAP32[($6_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($0_1 | 0)) {
        break label$32
       }
       $6_1 = $2_1 >>> 29 | 0;
       $2_1 = $2_1 << 1 | 0;
       $3_1 = ($4_1 + ($6_1 & 4 | 0) | 0) + 16 | 0;
       $6_1 = HEAP32[$3_1 >> 2] | 0;
       if ($6_1) {
        continue label$35
       }
       break label$35;
      };
      HEAP32[$3_1 >> 2] = $1_1;
      HEAP32[($1_1 + 24 | 0) >> 2] = $4_1;
     }
     HEAP32[($1_1 + 12 | 0) >> 2] = $1_1;
     HEAP32[($1_1 + 8 | 0) >> 2] = $1_1;
     break label$31;
    }
    $0_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
    HEAP32[($0_1 + 12 | 0) >> 2] = $1_1;
    HEAP32[($4_1 + 8 | 0) >> 2] = $1_1;
    HEAP32[($1_1 + 24 | 0) >> 2] = 0;
    HEAP32[($1_1 + 12 | 0) >> 2] = $4_1;
    HEAP32[($1_1 + 8 | 0) >> 2] = $0_1;
   }
   $1_1 = (HEAP32[(0 + 2264 | 0) >> 2] | 0) + -1 | 0;
   HEAP32[(0 + 2264 | 0) >> 2] = $1_1 ? $1_1 : -1;
  }
 }
 
 function $31($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $3_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  label$1 : {
   if ($0_1) {
    break label$1
   }
   return $29($1_1 | 0) | 0 | 0;
  }
  label$2 : {
   if ($1_1 >>> 0 < -64 >>> 0) {
    break label$2
   }
   (wasm2js_i32$0 = $20() | 0, wasm2js_i32$1 = 48), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
   return 0 | 0;
  }
  label$3 : {
   $2_1 = $32($0_1 + -8 | 0 | 0, ($1_1 >>> 0 < 11 >>> 0 ? 16 : ($1_1 + 11 | 0) & -8 | 0) | 0) | 0;
   if (!$2_1) {
    break label$3
   }
   return $2_1 + 8 | 0 | 0;
  }
  label$4 : {
   $2_1 = $29($1_1 | 0) | 0;
   if ($2_1) {
    break label$4
   }
   return 0 | 0;
  }
  $3_1 = HEAP32[($0_1 + -4 | 0) >> 2] | 0;
  $3_1 = ($3_1 & 3 | 0 ? -4 : -8) + ($3_1 & -8 | 0) | 0;
  $38($2_1 | 0, $0_1 | 0, ($3_1 >>> 0 < $1_1 >>> 0 ? $3_1 : $1_1) | 0) | 0;
  $30($0_1 | 0);
  return $2_1 | 0;
 }
 
 function $32($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $3_1 = 0, $4_1 = 0, $6_1 = 0, $5_1 = 0, $2_1 = 0, $7_1 = 0, $9_1 = 0, $10_1 = 0, $8_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $2_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
  $3_1 = $2_1 & -8 | 0;
  label$1 : {
   label$2 : {
    if ($2_1 & 3 | 0) {
     break label$2
    }
    label$3 : {
     if ($1_1 >>> 0 >= 256 >>> 0) {
      break label$3
     }
     return 0 | 0;
    }
    label$4 : {
     if ($3_1 >>> 0 < ($1_1 + 4 | 0) >>> 0) {
      break label$4
     }
     $4_1 = $0_1;
     if (($3_1 - $1_1 | 0) >>> 0 <= ((HEAP32[(0 + 2712 | 0) >> 2] | 0) << 1 | 0) >>> 0) {
      break label$1
     }
    }
    return 0 | 0;
   }
   $5_1 = $0_1 + $3_1 | 0;
   label$5 : {
    label$6 : {
     if ($3_1 >>> 0 < $1_1 >>> 0) {
      break label$6
     }
     $3_1 = $3_1 - $1_1 | 0;
     if ($3_1 >>> 0 < 16 >>> 0) {
      break label$5
     }
     HEAP32[($0_1 + 4 | 0) >> 2] = $2_1 & 1 | 0 | $1_1 | 0 | 2 | 0;
     $1_1 = $0_1 + $1_1 | 0;
     HEAP32[($1_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
     HEAP32[($5_1 + 4 | 0) >> 2] = HEAP32[($5_1 + 4 | 0) >> 2] | 0 | 1 | 0;
     $33($1_1 | 0, $3_1 | 0);
     break label$5;
    }
    $4_1 = 0;
    label$7 : {
     if ((HEAP32[(0 + 2256 | 0) >> 2] | 0 | 0) != ($5_1 | 0)) {
      break label$7
     }
     $3_1 = (HEAP32[(0 + 2244 | 0) >> 2] | 0) + $3_1 | 0;
     if ($3_1 >>> 0 <= $1_1 >>> 0) {
      break label$1
     }
     HEAP32[($0_1 + 4 | 0) >> 2] = $2_1 & 1 | 0 | $1_1 | 0 | 2 | 0;
     $2_1 = $0_1 + $1_1 | 0;
     $1_1 = $3_1 - $1_1 | 0;
     HEAP32[($2_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
     HEAP32[(0 + 2244 | 0) >> 2] = $1_1;
     HEAP32[(0 + 2256 | 0) >> 2] = $2_1;
     break label$5;
    }
    label$8 : {
     if ((HEAP32[(0 + 2252 | 0) >> 2] | 0 | 0) != ($5_1 | 0)) {
      break label$8
     }
     $4_1 = 0;
     $3_1 = (HEAP32[(0 + 2240 | 0) >> 2] | 0) + $3_1 | 0;
     if ($3_1 >>> 0 < $1_1 >>> 0) {
      break label$1
     }
     label$9 : {
      label$10 : {
       $4_1 = $3_1 - $1_1 | 0;
       if ($4_1 >>> 0 < 16 >>> 0) {
        break label$10
       }
       HEAP32[($0_1 + 4 | 0) >> 2] = $2_1 & 1 | 0 | $1_1 | 0 | 2 | 0;
       $1_1 = $0_1 + $1_1 | 0;
       HEAP32[($1_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
       $3_1 = $0_1 + $3_1 | 0;
       HEAP32[$3_1 >> 2] = $4_1;
       HEAP32[($3_1 + 4 | 0) >> 2] = (HEAP32[($3_1 + 4 | 0) >> 2] | 0) & -2 | 0;
       break label$9;
      }
      HEAP32[($0_1 + 4 | 0) >> 2] = $2_1 & 1 | 0 | $3_1 | 0 | 2 | 0;
      $1_1 = $0_1 + $3_1 | 0;
      HEAP32[($1_1 + 4 | 0) >> 2] = HEAP32[($1_1 + 4 | 0) >> 2] | 0 | 1 | 0;
      $4_1 = 0;
      $1_1 = 0;
     }
     HEAP32[(0 + 2252 | 0) >> 2] = $1_1;
     HEAP32[(0 + 2240 | 0) >> 2] = $4_1;
     break label$5;
    }
    $4_1 = 0;
    $6_1 = HEAP32[($5_1 + 4 | 0) >> 2] | 0;
    if ($6_1 & 2 | 0) {
     break label$1
    }
    $7_1 = ($6_1 & -8 | 0) + $3_1 | 0;
    if ($7_1 >>> 0 < $1_1 >>> 0) {
     break label$1
    }
    $8_1 = $7_1 - $1_1 | 0;
    label$11 : {
     label$12 : {
      if ($6_1 >>> 0 > 255 >>> 0) {
       break label$12
      }
      $3_1 = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
      $9_1 = $6_1 >>> 3 | 0;
      $6_1 = ($9_1 << 3 | 0) + 2272 | 0;
      label$13 : {
       $4_1 = HEAP32[($5_1 + 12 | 0) >> 2] | 0;
       if (($4_1 | 0) != ($3_1 | 0)) {
        break label$13
       }
       (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 2232 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $9_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2232 | 0) >> 2] = wasm2js_i32$1;
       break label$11;
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = $4_1;
      HEAP32[($4_1 + 8 | 0) >> 2] = $3_1;
      break label$11;
     }
     $10_1 = HEAP32[($5_1 + 24 | 0) >> 2] | 0;
     label$14 : {
      label$15 : {
       $6_1 = HEAP32[($5_1 + 12 | 0) >> 2] | 0;
       if (($6_1 | 0) == ($5_1 | 0)) {
        break label$15
       }
       $3_1 = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
       HEAP32[(0 + 2248 | 0) >> 2] | 0;
       HEAP32[($3_1 + 12 | 0) >> 2] = $6_1;
       HEAP32[($6_1 + 8 | 0) >> 2] = $3_1;
       break label$14;
      }
      label$16 : {
       $3_1 = $5_1 + 20 | 0;
       $4_1 = HEAP32[$3_1 >> 2] | 0;
       if ($4_1) {
        break label$16
       }
       $3_1 = $5_1 + 16 | 0;
       $4_1 = HEAP32[$3_1 >> 2] | 0;
       if ($4_1) {
        break label$16
       }
       $6_1 = 0;
       break label$14;
      }
      label$17 : while (1) {
       $9_1 = $3_1;
       $6_1 = $4_1;
       $3_1 = $6_1 + 20 | 0;
       $4_1 = HEAP32[$3_1 >> 2] | 0;
       if ($4_1) {
        continue label$17
       }
       $3_1 = $6_1 + 16 | 0;
       $4_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
       if ($4_1) {
        continue label$17
       }
       break label$17;
      };
      HEAP32[$9_1 >> 2] = 0;
     }
     if (!$10_1) {
      break label$11
     }
     label$18 : {
      label$19 : {
       $4_1 = HEAP32[($5_1 + 28 | 0) >> 2] | 0;
       $3_1 = ($4_1 << 2 | 0) + 2536 | 0;
       if ((HEAP32[$3_1 >> 2] | 0 | 0) != ($5_1 | 0)) {
        break label$19
       }
       HEAP32[$3_1 >> 2] = $6_1;
       if ($6_1) {
        break label$18
       }
       (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 2236 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $4_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2236 | 0) >> 2] = wasm2js_i32$1;
       break label$11;
      }
      HEAP32[($10_1 + ((HEAP32[($10_1 + 16 | 0) >> 2] | 0 | 0) == ($5_1 | 0) ? 16 : 20) | 0) >> 2] = $6_1;
      if (!$6_1) {
       break label$11
      }
     }
     HEAP32[($6_1 + 24 | 0) >> 2] = $10_1;
     label$20 : {
      $3_1 = HEAP32[($5_1 + 16 | 0) >> 2] | 0;
      if (!$3_1) {
       break label$20
      }
      HEAP32[($6_1 + 16 | 0) >> 2] = $3_1;
      HEAP32[($3_1 + 24 | 0) >> 2] = $6_1;
     }
     $3_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
     if (!$3_1) {
      break label$11
     }
     HEAP32[($6_1 + 20 | 0) >> 2] = $3_1;
     HEAP32[($3_1 + 24 | 0) >> 2] = $6_1;
    }
    label$21 : {
     if ($8_1 >>> 0 > 15 >>> 0) {
      break label$21
     }
     HEAP32[($0_1 + 4 | 0) >> 2] = $2_1 & 1 | 0 | $7_1 | 0 | 2 | 0;
     $1_1 = $0_1 + $7_1 | 0;
     HEAP32[($1_1 + 4 | 0) >> 2] = HEAP32[($1_1 + 4 | 0) >> 2] | 0 | 1 | 0;
     break label$5;
    }
    HEAP32[($0_1 + 4 | 0) >> 2] = $2_1 & 1 | 0 | $1_1 | 0 | 2 | 0;
    $1_1 = $0_1 + $1_1 | 0;
    HEAP32[($1_1 + 4 | 0) >> 2] = $8_1 | 3 | 0;
    $3_1 = $0_1 + $7_1 | 0;
    HEAP32[($3_1 + 4 | 0) >> 2] = HEAP32[($3_1 + 4 | 0) >> 2] | 0 | 1 | 0;
    $33($1_1 | 0, $8_1 | 0);
   }
   $4_1 = $0_1;
  }
  return $4_1 | 0;
 }
 
 function $33($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $3_1 = 0, $6_1 = 0, $4_1 = 0, $2_1 = 0, $5_1 = 0, $7_1 = 0, $360 = 0, $367 = 0, $374 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  label$1 : {
   label$2 : {
    $3_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
    if ($3_1 & 1 | 0) {
     break label$2
    }
    if (!($3_1 & 3 | 0)) {
     break label$1
    }
    $3_1 = HEAP32[$0_1 >> 2] | 0;
    $1_1 = $3_1 + $1_1 | 0;
    label$3 : {
     label$4 : {
      $0_1 = $0_1 - $3_1 | 0;
      if ((HEAP32[(0 + 2252 | 0) >> 2] | 0 | 0) == ($0_1 | 0)) {
       break label$4
      }
      label$5 : {
       if ($3_1 >>> 0 > 255 >>> 0) {
        break label$5
       }
       $4_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
       $5_1 = $3_1 >>> 3 | 0;
       $6_1 = ($5_1 << 3 | 0) + 2272 | 0;
       $3_1 = HEAP32[($0_1 + 12 | 0) >> 2] | 0;
       if (($3_1 | 0) != ($4_1 | 0)) {
        break label$3
       }
       (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 2232 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2232 | 0) >> 2] = wasm2js_i32$1;
       break label$2;
      }
      $7_1 = HEAP32[($0_1 + 24 | 0) >> 2] | 0;
      label$6 : {
       label$7 : {
        $6_1 = HEAP32[($0_1 + 12 | 0) >> 2] | 0;
        if (($6_1 | 0) == ($0_1 | 0)) {
         break label$7
        }
        $3_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
        HEAP32[(0 + 2248 | 0) >> 2] | 0;
        HEAP32[($3_1 + 12 | 0) >> 2] = $6_1;
        HEAP32[($6_1 + 8 | 0) >> 2] = $3_1;
        break label$6;
       }
       label$8 : {
        $3_1 = $0_1 + 20 | 0;
        $4_1 = HEAP32[$3_1 >> 2] | 0;
        if ($4_1) {
         break label$8
        }
        $3_1 = $0_1 + 16 | 0;
        $4_1 = HEAP32[$3_1 >> 2] | 0;
        if ($4_1) {
         break label$8
        }
        $6_1 = 0;
        break label$6;
       }
       label$9 : while (1) {
        $5_1 = $3_1;
        $6_1 = $4_1;
        $3_1 = $6_1 + 20 | 0;
        $4_1 = HEAP32[$3_1 >> 2] | 0;
        if ($4_1) {
         continue label$9
        }
        $3_1 = $6_1 + 16 | 0;
        $4_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
        if ($4_1) {
         continue label$9
        }
        break label$9;
       };
       HEAP32[$5_1 >> 2] = 0;
      }
      if (!$7_1) {
       break label$2
      }
      label$10 : {
       label$11 : {
        $4_1 = HEAP32[($0_1 + 28 | 0) >> 2] | 0;
        $3_1 = ($4_1 << 2 | 0) + 2536 | 0;
        if ((HEAP32[$3_1 >> 2] | 0 | 0) != ($0_1 | 0)) {
         break label$11
        }
        HEAP32[$3_1 >> 2] = $6_1;
        if ($6_1) {
         break label$10
        }
        (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 2236 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $4_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2236 | 0) >> 2] = wasm2js_i32$1;
        break label$2;
       }
       HEAP32[($7_1 + ((HEAP32[($7_1 + 16 | 0) >> 2] | 0 | 0) == ($0_1 | 0) ? 16 : 20) | 0) >> 2] = $6_1;
       if (!$6_1) {
        break label$2
       }
      }
      HEAP32[($6_1 + 24 | 0) >> 2] = $7_1;
      label$12 : {
       $3_1 = HEAP32[($0_1 + 16 | 0) >> 2] | 0;
       if (!$3_1) {
        break label$12
       }
       HEAP32[($6_1 + 16 | 0) >> 2] = $3_1;
       HEAP32[($3_1 + 24 | 0) >> 2] = $6_1;
      }
      $3_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
      if (!$3_1) {
       break label$2
      }
      HEAP32[($6_1 + 20 | 0) >> 2] = $3_1;
      HEAP32[($3_1 + 24 | 0) >> 2] = $6_1;
      break label$2;
     }
     $3_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
     if (($3_1 & 3 | 0 | 0) != (3 | 0)) {
      break label$2
     }
     HEAP32[(0 + 2240 | 0) >> 2] = $1_1;
     HEAP32[($2_1 + 4 | 0) >> 2] = $3_1 & -2 | 0;
     HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
     HEAP32[$2_1 >> 2] = $1_1;
     return;
    }
    HEAP32[($4_1 + 12 | 0) >> 2] = $3_1;
    HEAP32[($3_1 + 8 | 0) >> 2] = $4_1;
   }
   label$13 : {
    label$14 : {
     $3_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
     if ($3_1 & 2 | 0) {
      break label$14
     }
     label$15 : {
      if ((HEAP32[(0 + 2256 | 0) >> 2] | 0 | 0) != ($2_1 | 0)) {
       break label$15
      }
      HEAP32[(0 + 2256 | 0) >> 2] = $0_1;
      $1_1 = (HEAP32[(0 + 2244 | 0) >> 2] | 0) + $1_1 | 0;
      HEAP32[(0 + 2244 | 0) >> 2] = $1_1;
      HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
      if (($0_1 | 0) != (HEAP32[(0 + 2252 | 0) >> 2] | 0 | 0)) {
       break label$1
      }
      HEAP32[(0 + 2240 | 0) >> 2] = 0;
      HEAP32[(0 + 2252 | 0) >> 2] = 0;
      return;
     }
     label$16 : {
      if ((HEAP32[(0 + 2252 | 0) >> 2] | 0 | 0) != ($2_1 | 0)) {
       break label$16
      }
      HEAP32[(0 + 2252 | 0) >> 2] = $0_1;
      $1_1 = (HEAP32[(0 + 2240 | 0) >> 2] | 0) + $1_1 | 0;
      HEAP32[(0 + 2240 | 0) >> 2] = $1_1;
      HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
      HEAP32[($0_1 + $1_1 | 0) >> 2] = $1_1;
      return;
     }
     $1_1 = ($3_1 & -8 | 0) + $1_1 | 0;
     label$17 : {
      label$18 : {
       if ($3_1 >>> 0 > 255 >>> 0) {
        break label$18
       }
       $4_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
       $5_1 = $3_1 >>> 3 | 0;
       $6_1 = ($5_1 << 3 | 0) + 2272 | 0;
       label$19 : {
        $3_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
        if (($3_1 | 0) != ($4_1 | 0)) {
         break label$19
        }
        (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 2232 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2232 | 0) >> 2] = wasm2js_i32$1;
        break label$17;
       }
       HEAP32[($4_1 + 12 | 0) >> 2] = $3_1;
       HEAP32[($3_1 + 8 | 0) >> 2] = $4_1;
       break label$17;
      }
      $7_1 = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
      label$20 : {
       label$21 : {
        $6_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
        if (($6_1 | 0) == ($2_1 | 0)) {
         break label$21
        }
        $3_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
        HEAP32[(0 + 2248 | 0) >> 2] | 0;
        HEAP32[($3_1 + 12 | 0) >> 2] = $6_1;
        HEAP32[($6_1 + 8 | 0) >> 2] = $3_1;
        break label$20;
       }
       label$22 : {
        $4_1 = $2_1 + 20 | 0;
        $3_1 = HEAP32[$4_1 >> 2] | 0;
        if ($3_1) {
         break label$22
        }
        $4_1 = $2_1 + 16 | 0;
        $3_1 = HEAP32[$4_1 >> 2] | 0;
        if ($3_1) {
         break label$22
        }
        $6_1 = 0;
        break label$20;
       }
       label$23 : while (1) {
        $5_1 = $4_1;
        $6_1 = $3_1;
        $4_1 = $3_1 + 20 | 0;
        $3_1 = HEAP32[$4_1 >> 2] | 0;
        if ($3_1) {
         continue label$23
        }
        $4_1 = $6_1 + 16 | 0;
        $3_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
        if ($3_1) {
         continue label$23
        }
        break label$23;
       };
       HEAP32[$5_1 >> 2] = 0;
      }
      if (!$7_1) {
       break label$17
      }
      label$24 : {
       label$25 : {
        $4_1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
        $3_1 = ($4_1 << 2 | 0) + 2536 | 0;
        if ((HEAP32[$3_1 >> 2] | 0 | 0) != ($2_1 | 0)) {
         break label$25
        }
        HEAP32[$3_1 >> 2] = $6_1;
        if ($6_1) {
         break label$24
        }
        (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 2236 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $4_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 2236 | 0) >> 2] = wasm2js_i32$1;
        break label$17;
       }
       HEAP32[($7_1 + ((HEAP32[($7_1 + 16 | 0) >> 2] | 0 | 0) == ($2_1 | 0) ? 16 : 20) | 0) >> 2] = $6_1;
       if (!$6_1) {
        break label$17
       }
      }
      HEAP32[($6_1 + 24 | 0) >> 2] = $7_1;
      label$26 : {
       $3_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
       if (!$3_1) {
        break label$26
       }
       HEAP32[($6_1 + 16 | 0) >> 2] = $3_1;
       HEAP32[($3_1 + 24 | 0) >> 2] = $6_1;
      }
      $3_1 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
      if (!$3_1) {
       break label$17
      }
      HEAP32[($6_1 + 20 | 0) >> 2] = $3_1;
      HEAP32[($3_1 + 24 | 0) >> 2] = $6_1;
     }
     HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
     HEAP32[($0_1 + $1_1 | 0) >> 2] = $1_1;
     if (($0_1 | 0) != (HEAP32[(0 + 2252 | 0) >> 2] | 0 | 0)) {
      break label$13
     }
     HEAP32[(0 + 2240 | 0) >> 2] = $1_1;
     return;
    }
    HEAP32[($2_1 + 4 | 0) >> 2] = $3_1 & -2 | 0;
    HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
    HEAP32[($0_1 + $1_1 | 0) >> 2] = $1_1;
   }
   label$27 : {
    if ($1_1 >>> 0 > 255 >>> 0) {
     break label$27
    }
    $3_1 = $1_1 >>> 3 | 0;
    $1_1 = ($3_1 << 3 | 0) + 2272 | 0;
    label$28 : {
     label$29 : {
      $4_1 = HEAP32[(0 + 2232 | 0) >> 2] | 0;
      $3_1 = 1 << $3_1 | 0;
      if ($4_1 & $3_1 | 0) {
       break label$29
      }
      HEAP32[(0 + 2232 | 0) >> 2] = $4_1 | $3_1 | 0;
      $3_1 = $1_1;
      break label$28;
     }
     $3_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
    }
    HEAP32[($1_1 + 8 | 0) >> 2] = $0_1;
    HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
    HEAP32[($0_1 + 12 | 0) >> 2] = $1_1;
    HEAP32[($0_1 + 8 | 0) >> 2] = $3_1;
    return;
   }
   $3_1 = 31;
   label$30 : {
    if ($1_1 >>> 0 > 16777215 >>> 0) {
     break label$30
    }
    $3_1 = $1_1 >>> 8 | 0;
    $360 = $3_1;
    $3_1 = (($3_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
    $4_1 = $360 << $3_1 | 0;
    $367 = $4_1;
    $4_1 = (($4_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
    $6_1 = $367 << $4_1 | 0;
    $374 = $6_1;
    $6_1 = (($6_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
    $3_1 = (($374 << $6_1 | 0) >>> 15 | 0) - ($3_1 | $4_1 | 0 | $6_1 | 0) | 0;
    $3_1 = ($3_1 << 1 | 0 | (($1_1 >>> ($3_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
   }
   HEAP32[($0_1 + 16 | 0) >> 2] = 0;
   HEAP32[($0_1 + 20 | 0) >> 2] = 0;
   HEAP32[($0_1 + 28 | 0) >> 2] = $3_1;
   $4_1 = ($3_1 << 2 | 0) + 2536 | 0;
   label$31 : {
    label$32 : {
     label$33 : {
      $6_1 = HEAP32[(0 + 2236 | 0) >> 2] | 0;
      $2_1 = 1 << $3_1 | 0;
      if ($6_1 & $2_1 | 0) {
       break label$33
      }
      HEAP32[(0 + 2236 | 0) >> 2] = $6_1 | $2_1 | 0;
      HEAP32[$4_1 >> 2] = $0_1;
      HEAP32[($0_1 + 24 | 0) >> 2] = $4_1;
      break label$32;
     }
     $3_1 = $1_1 << (($3_1 | 0) == (31 | 0) ? 0 : 25 - ($3_1 >>> 1 | 0) | 0) | 0;
     $6_1 = HEAP32[$4_1 >> 2] | 0;
     label$34 : while (1) {
      $4_1 = $6_1;
      if (((HEAP32[($6_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($1_1 | 0)) {
       break label$31
      }
      $6_1 = $3_1 >>> 29 | 0;
      $3_1 = $3_1 << 1 | 0;
      $2_1 = ($4_1 + ($6_1 & 4 | 0) | 0) + 16 | 0;
      $6_1 = HEAP32[$2_1 >> 2] | 0;
      if ($6_1) {
       continue label$34
      }
      break label$34;
     };
     HEAP32[$2_1 >> 2] = $0_1;
     HEAP32[($0_1 + 24 | 0) >> 2] = $4_1;
    }
    HEAP32[($0_1 + 12 | 0) >> 2] = $0_1;
    HEAP32[($0_1 + 8 | 0) >> 2] = $0_1;
    return;
   }
   $1_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
   HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
   HEAP32[($4_1 + 8 | 0) >> 2] = $0_1;
   HEAP32[($0_1 + 24 | 0) >> 2] = 0;
   HEAP32[($0_1 + 12 | 0) >> 2] = $4_1;
   HEAP32[($0_1 + 8 | 0) >> 2] = $1_1;
  }
 }
 
 function $34() {
  return __wasm_memory_size() << 16 | 0 | 0;
 }
 
 function $35($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $1_1 = HEAP32[(0 + 1172 | 0) >> 2] | 0;
  $2_1 = ($0_1 + 3 | 0) & -4 | 0;
  $0_1 = $1_1 + $2_1 | 0;
  label$1 : {
   label$2 : {
    if (!$2_1) {
     break label$2
    }
    if ($0_1 >>> 0 <= $1_1 >>> 0) {
     break label$1
    }
   }
   label$3 : {
    if ($0_1 >>> 0 <= ($34() | 0) >>> 0) {
     break label$3
    }
    if (!(fimport$2($0_1 | 0) | 0)) {
     break label$1
    }
   }
   HEAP32[(0 + 1172 | 0) >> 2] = $0_1;
   return $1_1 | 0;
  }
  (wasm2js_i32$0 = $20() | 0, wasm2js_i32$1 = 48), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
  return -1 | 0;
 }
 
 function $36($0_1) {
  $0_1 = $0_1 | 0;
  return 1 | 0;
 }
 
 function $37($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $38($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $4_1 = 0, $3_1 = 0, $5_1 = 0;
  label$1 : {
   if ($2_1 >>> 0 < 512 >>> 0) {
    break label$1
   }
   fimport$3($0_1 | 0, $1_1 | 0, $2_1 | 0) | 0;
   return $0_1 | 0;
  }
  $3_1 = $0_1 + $2_1 | 0;
  label$2 : {
   label$3 : {
    if (($1_1 ^ $0_1 | 0) & 3 | 0) {
     break label$3
    }
    label$4 : {
     label$5 : {
      if ($0_1 & 3 | 0) {
       break label$5
      }
      $2_1 = $0_1;
      break label$4;
     }
     label$6 : {
      if ($2_1) {
       break label$6
      }
      $2_1 = $0_1;
      break label$4;
     }
     $2_1 = $0_1;
     label$7 : while (1) {
      HEAP8[$2_1 >> 0] = HEAPU8[$1_1 >> 0] | 0;
      $1_1 = $1_1 + 1 | 0;
      $2_1 = $2_1 + 1 | 0;
      if (!($2_1 & 3 | 0)) {
       break label$4
      }
      if ($2_1 >>> 0 < $3_1 >>> 0) {
       continue label$7
      }
      break label$7;
     };
    }
    label$8 : {
     $4_1 = $3_1 & -4 | 0;
     if ($4_1 >>> 0 < 64 >>> 0) {
      break label$8
     }
     $5_1 = $4_1 + -64 | 0;
     if ($2_1 >>> 0 > $5_1 >>> 0) {
      break label$8
     }
     label$9 : while (1) {
      HEAP32[$2_1 >> 2] = HEAP32[$1_1 >> 2] | 0;
      HEAP32[($2_1 + 4 | 0) >> 2] = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
      HEAP32[($2_1 + 8 | 0) >> 2] = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
      HEAP32[($2_1 + 12 | 0) >> 2] = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
      HEAP32[($2_1 + 16 | 0) >> 2] = HEAP32[($1_1 + 16 | 0) >> 2] | 0;
      HEAP32[($2_1 + 20 | 0) >> 2] = HEAP32[($1_1 + 20 | 0) >> 2] | 0;
      HEAP32[($2_1 + 24 | 0) >> 2] = HEAP32[($1_1 + 24 | 0) >> 2] | 0;
      HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($1_1 + 28 | 0) >> 2] | 0;
      HEAP32[($2_1 + 32 | 0) >> 2] = HEAP32[($1_1 + 32 | 0) >> 2] | 0;
      HEAP32[($2_1 + 36 | 0) >> 2] = HEAP32[($1_1 + 36 | 0) >> 2] | 0;
      HEAP32[($2_1 + 40 | 0) >> 2] = HEAP32[($1_1 + 40 | 0) >> 2] | 0;
      HEAP32[($2_1 + 44 | 0) >> 2] = HEAP32[($1_1 + 44 | 0) >> 2] | 0;
      HEAP32[($2_1 + 48 | 0) >> 2] = HEAP32[($1_1 + 48 | 0) >> 2] | 0;
      HEAP32[($2_1 + 52 | 0) >> 2] = HEAP32[($1_1 + 52 | 0) >> 2] | 0;
      HEAP32[($2_1 + 56 | 0) >> 2] = HEAP32[($1_1 + 56 | 0) >> 2] | 0;
      HEAP32[($2_1 + 60 | 0) >> 2] = HEAP32[($1_1 + 60 | 0) >> 2] | 0;
      $1_1 = $1_1 + 64 | 0;
      $2_1 = $2_1 + 64 | 0;
      if ($2_1 >>> 0 <= $5_1 >>> 0) {
       continue label$9
      }
      break label$9;
     };
    }
    if ($2_1 >>> 0 >= $4_1 >>> 0) {
     break label$2
    }
    label$10 : while (1) {
     HEAP32[$2_1 >> 2] = HEAP32[$1_1 >> 2] | 0;
     $1_1 = $1_1 + 4 | 0;
     $2_1 = $2_1 + 4 | 0;
     if ($2_1 >>> 0 < $4_1 >>> 0) {
      continue label$10
     }
     break label$2;
    };
   }
   label$11 : {
    if ($3_1 >>> 0 >= 4 >>> 0) {
     break label$11
    }
    $2_1 = $0_1;
    break label$2;
   }
   label$12 : {
    $4_1 = $3_1 + -4 | 0;
    if ($4_1 >>> 0 >= $0_1 >>> 0) {
     break label$12
    }
    $2_1 = $0_1;
    break label$2;
   }
   $2_1 = $0_1;
   label$13 : while (1) {
    HEAP8[$2_1 >> 0] = HEAPU8[$1_1 >> 0] | 0;
    HEAP8[($2_1 + 1 | 0) >> 0] = HEAPU8[($1_1 + 1 | 0) >> 0] | 0;
    HEAP8[($2_1 + 2 | 0) >> 0] = HEAPU8[($1_1 + 2 | 0) >> 0] | 0;
    HEAP8[($2_1 + 3 | 0) >> 0] = HEAPU8[($1_1 + 3 | 0) >> 0] | 0;
    $1_1 = $1_1 + 4 | 0;
    $2_1 = $2_1 + 4 | 0;
    if ($2_1 >>> 0 <= $4_1 >>> 0) {
     continue label$13
    }
    break label$13;
   };
  }
  label$14 : {
   if ($2_1 >>> 0 >= $3_1 >>> 0) {
    break label$14
   }
   label$15 : while (1) {
    HEAP8[$2_1 >> 0] = HEAPU8[$1_1 >> 0] | 0;
    $1_1 = $1_1 + 1 | 0;
    $2_1 = $2_1 + 1 | 0;
    if (($2_1 | 0) != ($3_1 | 0)) {
     continue label$15
    }
    break label$15;
   };
  }
  return $0_1 | 0;
 }
 
 function $39() {
  return global$0 | 0;
 }
 
 function $40($0_1) {
  $0_1 = $0_1 | 0;
  global$0 = $0_1;
 }
 
 function $41($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = (global$0 - $0_1 | 0) & -16 | 0;
  global$0 = $1_1;
  return $1_1 | 0;
 }
 
 function $42() {
  global$2 = 5245616;
  global$1 = (2728 + 15 | 0) & -16 | 0;
 }
 
 function $43() {
  return global$0 - global$1 | 0 | 0;
 }
 
 function $44() {
  return global$1 | 0;
 }
 
 function $45($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, i64toi32_i32$1 = 0, $2_1 = 0, i64toi32_i32$0 = 0, $3_1 = 0;
  label$1 : {
   if ($0_1) {
    break label$1
   }
   $1_1 = 0;
   label$2 : {
    if (!(HEAP32[(0 + 1168 | 0) >> 2] | 0)) {
     break label$2
    }
    $1_1 = $45(HEAP32[(0 + 1168 | 0) >> 2] | 0 | 0) | 0;
   }
   label$3 : {
    if (!(HEAP32[(0 + 1188 | 0) >> 2] | 0)) {
     break label$3
    }
    $1_1 = $45(HEAP32[(0 + 1188 | 0) >> 2] | 0 | 0) | 0 | $1_1 | 0;
   }
   label$4 : {
    $0_1 = HEAP32[($24() | 0) >> 2] | 0;
    if (!$0_1) {
     break label$4
    }
    label$5 : while (1) {
     $2_1 = 0;
     label$6 : {
      if ((HEAP32[($0_1 + 76 | 0) >> 2] | 0 | 0) < (0 | 0)) {
       break label$6
      }
      $2_1 = $36($0_1 | 0) | 0;
     }
     label$7 : {
      if ((HEAP32[($0_1 + 20 | 0) >> 2] | 0 | 0) == (HEAP32[($0_1 + 28 | 0) >> 2] | 0 | 0)) {
       break label$7
      }
      $1_1 = $45($0_1 | 0) | 0 | $1_1 | 0;
     }
     label$8 : {
      if (!$2_1) {
       break label$8
      }
      $37($0_1 | 0);
     }
     $0_1 = HEAP32[($0_1 + 56 | 0) >> 2] | 0;
     if ($0_1) {
      continue label$5
     }
     break label$5;
    };
   }
   $25();
   return $1_1 | 0;
  }
  $2_1 = 0;
  label$9 : {
   if ((HEAP32[($0_1 + 76 | 0) >> 2] | 0 | 0) < (0 | 0)) {
    break label$9
   }
   $2_1 = $36($0_1 | 0) | 0;
  }
  label$10 : {
   label$11 : {
    label$12 : {
     if ((HEAP32[($0_1 + 20 | 0) >> 2] | 0 | 0) == (HEAP32[($0_1 + 28 | 0) >> 2] | 0 | 0)) {
      break label$12
     }
     FUNCTION_TABLE[HEAP32[($0_1 + 36 | 0) >> 2] | 0 | 0]($0_1, 0, 0) | 0;
     if (HEAP32[($0_1 + 20 | 0) >> 2] | 0) {
      break label$12
     }
     $1_1 = -1;
     if ($2_1) {
      break label$11
     }
     break label$10;
    }
    label$13 : {
     $1_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
     $3_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
     if (($1_1 | 0) == ($3_1 | 0)) {
      break label$13
     }
     i64toi32_i32$1 = $1_1 - $3_1 | 0;
     i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
     i64toi32_i32$0 = FUNCTION_TABLE[HEAP32[($0_1 + 40 | 0) >> 2] | 0 | 0]($0_1, i64toi32_i32$1, i64toi32_i32$0, 1) | 0;
     i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    }
    $1_1 = 0;
    HEAP32[($0_1 + 28 | 0) >> 2] = 0;
    i64toi32_i32$0 = $0_1;
    i64toi32_i32$1 = 0;
    HEAP32[($0_1 + 16 | 0) >> 2] = 0;
    HEAP32[($0_1 + 20 | 0) >> 2] = i64toi32_i32$1;
    i64toi32_i32$0 = $0_1;
    i64toi32_i32$1 = 0;
    HEAP32[($0_1 + 4 | 0) >> 2] = 0;
    HEAP32[($0_1 + 8 | 0) >> 2] = i64toi32_i32$1;
    if (!$2_1) {
     break label$10
    }
   }
   $37($0_1 | 0);
  }
  return $1_1 | 0;
 }
 
 function $46($0_1, $1_1, $2_1, $2$hi, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = $2$hi;
  i64toi32_i32$0 = FUNCTION_TABLE[$0_1 | 0]($1_1, $2_1, i64toi32_i32$0, $3_1) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $47($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $17_1 = 0, $18_1 = 0, $6_1 = 0, $7_1 = 0, $9_1 = 0, $9$hi = 0, $12$hi = 0, $5_1 = 0, $5$hi = 0;
  $6_1 = $0_1;
  $7_1 = $1_1;
  i64toi32_i32$0 = 0;
  $9_1 = $2_1;
  $9$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$2 = $3_1;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   $17_1 = 0;
  } else {
   i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
   $17_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
  }
  $12$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $9$hi;
  i64toi32_i32$0 = $9_1;
  i64toi32_i32$2 = $12$hi;
  i64toi32_i32$3 = $17_1;
  i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
  i64toi32_i32$2 = $46($6_1 | 0, $7_1 | 0, i64toi32_i32$0 | i64toi32_i32$3 | 0 | 0, i64toi32_i32$2 | 0, $4_1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  $5_1 = i64toi32_i32$2;
  $5$hi = i64toi32_i32$0;
  i64toi32_i32$1 = i64toi32_i32$2;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = 0;
   $18_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   $18_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
  }
  fimport$4($18_1 | 0);
  i64toi32_i32$2 = $5$hi;
  return $5_1 | 0;
 }
 
 function __wasm_rotl_i32(var$0, var$1) {
  var$0 = var$0 | 0;
  var$1 = var$1 | 0;
  var var$2 = 0;
  var$2 = var$1 & 31 | 0;
  var$1 = (0 - var$1 | 0) & 31 | 0;
  return ((-1 >>> var$2 | 0) & var$0 | 0) << var$2 | 0 | (((-1 << var$1 | 0) & var$0 | 0) >>> var$1 | 0) | 0 | 0;
 }
 
 // EMSCRIPTEN_END_FUNCS
;
 bufferView = HEAPU8;
 initActiveSegments(env);
 var FUNCTION_TABLE = Table([null, $26, $21, $27]);
 function __wasm_memory_size() {
  return buffer.byteLength / 65536 | 0;
 }
 
 function __wasm_memory_grow(pagesToAdd) {
  pagesToAdd = pagesToAdd | 0;
  var oldPages = __wasm_memory_size() | 0;
  var newPages = oldPages + pagesToAdd | 0;
  if ((oldPages < newPages) && (newPages < 65536)) {
   var newBuffer = new ArrayBuffer(Math_imul(newPages, 65536));
   var newHEAP8 = new Int8Array(newBuffer);
   newHEAP8.set(HEAP8);
   HEAP8 = new Int8Array(newBuffer);
   HEAP16 = new Int16Array(newBuffer);
   HEAP32 = new Int32Array(newBuffer);
   HEAPU8 = new Uint8Array(newBuffer);
   HEAPU16 = new Uint16Array(newBuffer);
   HEAPU32 = new Uint32Array(newBuffer);
   HEAPF32 = new Float32Array(newBuffer);
   HEAPF64 = new Float64Array(newBuffer);
   buffer = newBuffer;
   memory.buffer = buffer;
   bufferView = HEAPU8;
  }
  return oldPages;
 }
 
 return {
  "__wasm_call_ctors": $0, 
  "malloc": $29, 
  "DecompressSK_ASC": $18, 
  "free": $30, 
  "DecompressText": $19, 
  "__errno_location": $20, 
  "fflush": $45, 
  "__indirect_function_table": FUNCTION_TABLE, 
  "emscripten_stack_init": $42, 
  "emscripten_stack_get_free": $43, 
  "emscripten_stack_get_end": $44, 
  "stackSave": $39, 
  "stackRestore": $40, 
  "stackAlloc": $41, 
  "dynCall_jiji": $47
 };
}

  return asmFunc(asmLibraryArg);
}

)(asmLibraryArg);
  },

  instantiate: /** @suppress{checkTypes} */ function(binary, info) {
    return {
      then: function(ok) {
        var module = new WebAssembly.Module(binary);
        ok({
          'instance': new WebAssembly.Instance(module)
        });
        // Emulate a simple WebAssembly.instantiate(..).then(()=>{}).catch(()=>{}) syntax.
        return { catch: function() {} };
      }
    };
  },

  RuntimeError: Error
};

// We don't need to actually download a wasm binary, mark it as present but empty.
wasmBinary = [];

// end include: wasm2js.js
if (typeof WebAssembly !== 'object') {
  abort('no native wasm support detected');
}

// include: runtime_safe_heap.js


// In MINIMAL_RUNTIME, setValue() and getValue() are only available when building with safe heap enabled, for heap safety checking.
// In traditional runtime, setValue() and getValue() are always available (although their use is highly discouraged due to perf penalties)

/** @param {number} ptr
    @param {number} value
    @param {string} type
    @param {number|boolean=} noSafe */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32';
    switch (type) {
      case 'i1': HEAP8[((ptr)>>0)] = value; break;
      case 'i8': HEAP8[((ptr)>>0)] = value; break;
      case 'i16': HEAP16[((ptr)>>1)] = value; break;
      case 'i32': HEAP32[((ptr)>>2)] = value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)] = tempI64[0],HEAP32[(((ptr)+(4))>>2)] = tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)] = value; break;
      case 'double': HEAPF64[((ptr)>>3)] = value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @param {number} ptr
    @param {string} type
    @param {number|boolean=} noSafe */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32';
    switch (type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return Number(HEAPF64[((ptr)>>3)]);
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

// end include: runtime_safe_heap.js
// Wasm globals

var wasmMemory;

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed' + (text ? ': ' + text : ''));
  }
}

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

// C calling interface.
/** @param {string|null=} returnType
    @param {Array=} argTypes
    @param {Arguments|Array=} args
    @param {Object=} opts */
function ccall(ident, returnType, argTypes, args, opts) {
  // For fast lookup of conversion functions
  var toC = {
    'string': function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    'array': function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };

  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  function onDone(ret) {
    if (stack !== 0) stackRestore(stack);
    return convertReturnValue(ret);
  }

  ret = onDone(ret);
  return ret;
}

/** @param {string=} returnType
    @param {Array=} argTypes
    @param {Object=} opts */
function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((Uint8Array|Array<number>), number)} */
function allocate(slab, allocator) {
  var ret;
  assert(typeof allocator === 'number', 'allocate no longer takes a type argument')
  assert(typeof slab !== 'number', 'allocate no longer takes a number as arg0')

  if (allocator == ALLOC_STACK) {
    ret = stackAlloc(slab.length);
  } else {
    ret = _malloc(slab.length);
  }

  if (slab.subarray || slab.slice) {
    HEAPU8.set(/** @type {!Uint8Array} */(slab), ret);
  } else {
    HEAPU8.set(new Uint8Array(slab), ret);
  }
  return ret;
}

// include: runtime_strings.js


// runtime_strings.js: Strings related runtime functions that are part of both MINIMAL_RUNTIME and regular runtime.

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

/**
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ArrayToString(heap, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
  while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;

  if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(heap.subarray(idx, endPtr));
  } else {
    var str = '';
    // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
    while (idx < endPtr) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = heap[idx++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = heap[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = heap[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte 0x' + u0.toString(16) + ' encountered when deserializing a UTF-8 string in wasm memory to a JS string!');
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
  return str;
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
// copy of that string as a Javascript String object.
// maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
//                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
//                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
//                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
//                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
//                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
//                 throw JS JIT optimizations off, so it is worth to consider consistently using one
//                 style or the other.
/**
 * @param {number} ptr
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ToString(ptr, maxBytesToRead) {
  ;
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   heap: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 0xC0 | (u >> 6);
      heap[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 0xE0 | (u >> 12);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u > 0x10FFFF) warnOnce('Invalid Unicode code point 0x' + u.toString(16) + ' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).');
      heap[outIdx++] = 0xF0 | (u >> 18);
      heap[outIdx++] = 0x80 | ((u >> 12) & 63);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) ++len;
    else if (u <= 0x7FF) len += 2;
    else if (u <= 0xFFFF) len += 3;
    else len += 4;
  }
  return len;
}

// end include: runtime_strings.js
// include: runtime_strings_extra.js


// runtime_strings_extra.js: Strings related runtime functions that are available only in regular runtime.

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAPU8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;

function UTF16ToString(ptr, maxBytesToRead) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  var maxIdx = idx + maxBytesToRead / 2;
  // If maxBytesToRead is not passed explicitly, it will be undefined, and this
  // will always evaluate to true. This saves on code size.
  while (!(idx >= maxIdx) && HEAPU16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var str = '';

    // If maxBytesToRead is not passed explicitly, it will be undefined, and the for-loop's condition
    // will always evaluate to true. The loop is then terminated on the first null char.
    for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) break;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }

    return str;
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)] = codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr, maxBytesToRead) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  // If maxBytesToRead is not passed explicitly, it will be undefined, and this
  // will always evaluate to true. This saves on code size.
  while (!(i >= maxBytesToRead / 4)) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0) break;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
  return str;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)] = codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated
    @param {boolean=} dontAddNull */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

/** @param {boolean=} dontAddNull */
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === (str.charCodeAt(i) & 0xff));
    HEAP8[((buffer++)>>0)] = str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)] = 0;
}

// end include: runtime_strings_extra.js
// Memory management

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBufferAndViews(buf) {
  buffer = buf;
  Module['HEAP8'] = HEAP8 = new Int8Array(buf);
  Module['HEAP16'] = HEAP16 = new Int16Array(buf);
  Module['HEAP32'] = HEAP32 = new Int32Array(buf);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
}

var TOTAL_STACK = 5242880;
if (Module['TOTAL_STACK']) assert(TOTAL_STACK === Module['TOTAL_STACK'], 'the stack size can no longer be determined at runtime')

var INITIAL_MEMORY = Module['INITIAL_MEMORY'] || 16777216;
if (!Object.getOwnPropertyDescriptor(Module, 'INITIAL_MEMORY')) {
  Object.defineProperty(Module, 'INITIAL_MEMORY', {
    configurable: true,
    get: function() {
      abort('Module.INITIAL_MEMORY has been replaced with plain INITIAL_MEMORY (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)')
    }
  });
}

assert(INITIAL_MEMORY >= TOTAL_STACK, 'INITIAL_MEMORY should be larger than TOTAL_STACK, was ' + INITIAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');

// In non-standalone/normal mode, we create the memory here.
// include: runtime_init_memory.js


// Create the wasm memory. (Note: this only applies if IMPORTED_MEMORY is defined)

  if (Module['wasmMemory']) {
    wasmMemory = Module['wasmMemory'];
  } else
  {
    wasmMemory = new WebAssembly.Memory({
      'initial': INITIAL_MEMORY / 65536,
      // In theory we should not need to emit the maximum if we want "unlimited"
      // or 4GB of memory, but VMs error on that atm, see
      // https://github.com/emscripten-core/emscripten/issues/14130
      // And in the pthreads case we definitely need to emit a maximum. So
      // always emit one.
      'maximum': 2147483648 / 65536
    });
  }

if (wasmMemory) {
  buffer = wasmMemory.buffer;
}

// If the user provides an incorrect length, just use that length instead rather than providing the user to
// specifically provide the memory length with Module['INITIAL_MEMORY'].
INITIAL_MEMORY = buffer.byteLength;
assert(INITIAL_MEMORY % 65536 === 0);
updateGlobalBufferAndViews(buffer);

// end include: runtime_init_memory.js

// include: runtime_init_table.js
// In regular non-RELOCATABLE mode the table is exported
// from the wasm module and this will be assigned once
// the exports are available.
var wasmTable;

// end include: runtime_init_table.js
// include: runtime_stack_check.js


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // The stack grows downwards
  HEAP32[((max + 4)>>2)] = 0x2135467;
  HEAP32[((max + 8)>>2)] = 0x89BACDFE;
  // Also test the global address 0 for integrity.
  HEAP32[0] = 0x63736d65; /* 'emsc' */
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  var cookie1 = HEAPU32[((max + 4)>>2)];
  var cookie2 = HEAPU32[((max + 8)>>2)];
  if (cookie1 != 0x2135467 || cookie2 != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x2135467, but received 0x' + cookie2.toString(16) + ' 0x' + cookie1.toString(16));
  }
  // Also test the global address 0 for integrity.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
}

// end include: runtime_stack_check.js
// include: runtime_assertions.js


// Endianness check
(function() {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) throw 'Runtime error: expected the system to be little-endian! (Run with -s SUPPORT_BIG_ENDIAN=1 to bypass)';
})();

// end include: runtime_assertions.js
var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;
var runtimeKeepaliveCounter = 0;

function keepRuntimeAlive() {
  return noExitRuntime || runtimeKeepaliveCounter > 0;
}

function preRun() {

  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  checkStackCookie();
  assert(!runtimeInitialized);
  runtimeInitialized = true;

  
  callRuntimeCallbacks(__ATINIT__);
}

function exitRuntime() {
  checkStackCookie();
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc

assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');

// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
}

function addRunDependency(id) {
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data

/** @param {string|number=} what */
function abort(what) {
  {
    if (Module['onAbort']) {
      Module['onAbort'](what);
    }
  }

  what = 'Aborted(' + what + ')';
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  var e = new WebAssembly.RuntimeError(what);

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// {{MEM_INITIALIZER}}

// include: memoryprofiler.js


// end include: memoryprofiler.js
// show errors on likely calls to FS when it was not included
var FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;

// include: URIUtils.js


// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  // Prefix of data URIs emitted by SINGLE_FILE and related options.
  return filename.startsWith(dataURIPrefix);
}

// Indicates whether filename is delivered via file protocol (as opposed to http/https)
function isFileURI(filename) {
  return filename.startsWith('file://');
}

// end include: URIUtils.js
function createExportWrapper(name, fixedasm) {
  return function() {
    var displayName = name;
    var asm = fixedasm;
    if (!fixedasm) {
      asm = Module['asm'];
    }
    assert(runtimeInitialized, 'native function `' + displayName + '` called before runtime initialization');
    assert(!runtimeExited, 'native function `' + displayName + '` called after runtime exit (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
    if (!asm[name]) {
      assert(asm[name], 'exported native function `' + displayName + '` not found');
    }
    return asm[name].apply(null, arguments);
  };
}

var wasmBinaryFile;
  wasmBinaryFile = 'skasc.wasm';
  if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile);
  }

function getBinary(file) {
  try {
    if (file == wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }
    var binary = tryParseAsDataURI(file);
    if (binary) {
      return binary;
    }
    if (readBinary) {
      return readBinary(file);
    } else {
      throw "both async and sync fetching of the wasm failed";
    }
  }
  catch (err) {
    abort(err);
  }
}

function getBinaryPromise() {
  // If we don't have the binary yet, try to to load it asynchronously.
  // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
  // See https://github.com/github/fetch/pull/92#issuecomment-140665932
  // Cordova or Electron apps are typically loaded from a file:// url.
  // So use fetch if it is available and the url is not a file, otherwise fall back to XHR.
  if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
    if (typeof fetch === 'function'
      && !isFileURI(wasmBinaryFile)
    ) {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(function () {
          return getBinary(wasmBinaryFile);
      });
    }
    else {
      if (readAsync) {
        // fetch is not available or url is file => try XHR (readAsync uses XHR internally)
        return new Promise(function(resolve, reject) {
          readAsync(wasmBinaryFile, function(response) { resolve(new Uint8Array(/** @type{!ArrayBuffer} */(response))) }, reject)
        });
      }
    }
  }

  // Otherwise, getBinary should be able to get it synchronously
  return Promise.resolve().then(function() { return getBinary(wasmBinaryFile); });
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm() {
  // prepare imports
  var info = {
    'env': asmLibraryArg,
    'wasi_snapshot_preview1': asmLibraryArg,
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    var exports = instance.exports;

    Module['asm'] = exports;

    wasmTable = Module['asm']['__indirect_function_table'];
    assert(wasmTable, "table not found in wasm exports");

    addOnInit(Module['asm']['__wasm_call_ctors']);

    removeRunDependency('wasm-instantiate');
  }
  // we can't run yet (except in a pthread, where we have a custom sync instantiator)
  addRunDependency('wasm-instantiate');

  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above USE_PTHREADS-enabled path.
    receiveInstance(result['instance']);
  }

  function instantiateArrayBuffer(receiver) {
    return getBinaryPromise().then(function(binary) {
      return WebAssembly.instantiate(binary, info);
    }).then(function (instance) {
      return instance;
    }).then(receiver, function(reason) {
      err('failed to asynchronously prepare wasm: ' + reason);

      // Warn on some common problems.
      if (isFileURI(wasmBinaryFile)) {
        err('warning: Loading from a file URI (' + wasmBinaryFile + ') is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing');
      }
      abort(reason);
    });
  }

  function instantiateAsync() {
    if (!wasmBinary &&
        typeof WebAssembly.instantiateStreaming === 'function' &&
        !isDataURI(wasmBinaryFile) &&
        // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
        !isFileURI(wasmBinaryFile) &&
        typeof fetch === 'function') {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function (response) {
        var result = WebAssembly.instantiateStreaming(response, info);

        return result.then(
          receiveInstantiationResult,
          function(reason) {
            // We expect the most common failure cause to be a bad MIME type for the binary,
            // in which case falling back to ArrayBuffer instantiation should work.
            err('wasm streaming compile failed: ' + reason);
            err('falling back to ArrayBuffer instantiation');
            return instantiateArrayBuffer(receiveInstantiationResult);
          });
      });
    } else {
      return instantiateArrayBuffer(receiveInstantiationResult);
    }
  }

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
  // to any other async startup actions they are performing.
  if (Module['instantiateWasm']) {
    try {
      var exports = Module['instantiateWasm'](info, receiveInstance);
      return exports;
    } catch(e) {
      err('Module.instantiateWasm callback failed with error: ' + e);
      return false;
    }
  }

  instantiateAsync();
  return {}; // no exports yet; we'll fill them in later
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;
var tempI64;

// === Body ===

var ASM_CONSTS = {
  
};






  function callRuntimeCallbacks(callbacks) {
      while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == 'function') {
          callback(Module); // Pass the module as the first argument.
          continue;
        }
        var func = callback.func;
        if (typeof func === 'number') {
          if (callback.arg === undefined) {
            getWasmTableEntry(func)();
          } else {
            getWasmTableEntry(func)(callback.arg);
          }
        } else {
          func(callback.arg === undefined ? null : callback.arg);
        }
      }
    }

  function withStackSave(f) {
      var stack = stackSave();
      var ret = f();
      stackRestore(stack);
      return ret;
    }
  function demangle(func) {
      warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
      return func;
    }

  function demangleAll(text) {
      var regex =
        /\b_Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    }

  var wasmTableMirror = [];
  function getWasmTableEntry(funcPtr) {
      var func = wasmTableMirror[funcPtr];
      if (!func) {
        if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
        wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
      }
      assert(wasmTable.get(funcPtr) == func, "JavaScript-side Wasm function table mirror is out of date!");
      return func;
    }

  function handleException(e) {
      // Certain exception types we do not treat as errors since they are used for
      // internal control flow.
      // 1. ExitStatus, which is thrown by exit()
      // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
      //    that wish to return to JS event loop.
      if (e instanceof ExitStatus || e == 'unwind') {
        return EXITSTATUS;
      }
      quit_(1, e);
    }

  function jsStackTrace() {
      var error = new Error();
      if (!error.stack) {
        // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
        // so try that as a special-case.
        try {
          throw new Error();
        } catch(e) {
          error = e;
        }
        if (!error.stack) {
          return '(no stack trace available)';
        }
      }
      return error.stack.toString();
    }

  function setWasmTableEntry(idx, func) {
      wasmTable.set(idx, func);
      wasmTableMirror[idx] = func;
    }

  function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
      return demangleAll(js);
    }

  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.copyWithin(dest, src, src + num);
    }

  function emscripten_realloc_buffer(size) {
      try {
        // round size grow request up to wasm page size (fixed 64KB per spec)
        wasmMemory.grow((size - buffer.byteLength + 65535) >>> 16); // .grow() takes a delta compared to the previous size
        updateGlobalBufferAndViews(wasmMemory.buffer);
        return 1 /*success*/;
      } catch(e) {
        err('emscripten_realloc_buffer: Attempted to grow heap from ' + buffer.byteLength  + ' bytes to ' + size + ' bytes, but got error: ' + e);
      }
      // implicit 0 return to save code size (caller will cast "undefined" into 0
      // anyhow)
    }
  function _emscripten_resize_heap(requestedSize) {
      var oldSize = HEAPU8.length;
      requestedSize = requestedSize >>> 0;
      // With pthreads, races can happen (another thread might increase the size in between), so return a failure, and let the caller retry.
      assert(requestedSize > oldSize);
  
      // Memory resize rules:
      // 1. Always increase heap size to at least the requested size, rounded up to next page multiple.
      // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap geometrically: increase the heap size according to
      //                                         MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%),
      //                                         At most overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
      // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap linearly: increase the heap size by at least MEMORY_GROWTH_LINEAR_STEP bytes.
      // 3. Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
      // 4. If we were unable to allocate as much memory, it may be due to over-eager decision to excessively reserve due to (3) above.
      //    Hence if an allocation fails, cut down on the amount of excess growth, in an attempt to succeed to perform a smaller allocation.
  
      // A limit is set for how much we can grow. We should not exceed that
      // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
      // In CAN_ADDRESS_2GB mode, stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate full 4GB Wasm memories, the size will wrap
      // back to 0 bytes in Wasm side for any code that deals with heap sizes, which would require special casing all heap size related code to treat
      // 0 specially.
      var maxHeapSize = 2147483648;
      if (requestedSize > maxHeapSize) {
        err('Cannot enlarge memory, asked to go up to ' + requestedSize + ' bytes, but the limit is ' + maxHeapSize + ' bytes!');
        return false;
      }
  
      // Loop through potential heap size increases. If we attempt a too eager reservation that fails, cut down on the
      // attempted size and reserve a smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown); // ensure geometric growth
        // but limit overreserving (default to capping at +96MB overgrowth at most)
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296 );
  
        var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
  
        var replacement = emscripten_realloc_buffer(newSize);
        if (replacement) {
          err('Warning: Enlarging memory arrays, this is not fast! ' + [oldSize, newSize]);
  
          return true;
        }
      }
      err('Failed to grow the heap from ' + oldSize + ' bytes to ' + newSize + ' bytes, not enough memory!');
      return false;
    }

  function _exit(status) {
      // void _exit(int status);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/exit.html
      exit(status);
    }

  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      if (typeof _fflush !== 'undefined') _fflush(0);
      var buffers = SYSCALLS.buffers;
      if (buffers[1].length) SYSCALLS.printChar(1, 10);
      if (buffers[2].length) SYSCALLS.printChar(2, 10);
    }
  
  var SYSCALLS = {mappings:{},buffers:[null,[],[]],printChar:function(stream, curr) {
        var buffer = SYSCALLS.buffers[stream];
        assert(buffer);
        if (curr === 0 || curr === 10) {
          (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
          buffer.length = 0;
        } else {
          buffer.push(curr);
        }
      },varargs:undefined,get:function() {
        assert(SYSCALLS.varargs != undefined);
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },get64:function(low, high) {
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      }};
  function _fd_write(fd, iov, iovcnt, pnum) {
      ;
      // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
      var num = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[((iov)>>2)];
        var len = HEAP32[(((iov)+(4))>>2)];
        iov += 8;
        for (var j = 0; j < len; j++) {
          SYSCALLS.printChar(fd, HEAPU8[ptr+j]);
        }
        num += len;
      }
      HEAP32[((pnum)>>2)] = num;
      return 0;
    }

  function _setTempRet0(val) {
      setTempRet0(val);
    }
var ASSERTIONS = true;



/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {string} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf = Buffer.from(s, 'base64');
    return new Uint8Array(buf['buffer'], buf['byteOffset'], buf['byteLength']);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}


var asmLibraryArg = {
  "emscripten_memcpy_big": _emscripten_memcpy_big,
  "emscripten_resize_heap": _emscripten_resize_heap,
  "exit": _exit,
  "fd_write": _fd_write,
  "getTempRet0": getTempRet0,
  "memory": wasmMemory,
  "setTempRet0": setTempRet0
};
var asm = createWasm();
/** @type {function(...*):?} */
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = createExportWrapper("__wasm_call_ctors");

/** @type {function(...*):?} */
var _malloc = Module["_malloc"] = createExportWrapper("malloc");

/** @type {function(...*):?} */
var _DecompressSK_ASC = Module["_DecompressSK_ASC"] = createExportWrapper("DecompressSK_ASC");

/** @type {function(...*):?} */
var _free = Module["_free"] = createExportWrapper("free");

/** @type {function(...*):?} */
var _DecompressText = Module["_DecompressText"] = createExportWrapper("DecompressText");

/** @type {function(...*):?} */
var ___errno_location = Module["___errno_location"] = createExportWrapper("__errno_location");

/** @type {function(...*):?} */
var _fflush = Module["_fflush"] = createExportWrapper("fflush");

/** @type {function(...*):?} */
var _emscripten_stack_init = Module["_emscripten_stack_init"] = function() {
  return (_emscripten_stack_init = Module["_emscripten_stack_init"] = Module["asm"]["emscripten_stack_init"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_free = Module["_emscripten_stack_get_free"] = function() {
  return (_emscripten_stack_get_free = Module["_emscripten_stack_get_free"] = Module["asm"]["emscripten_stack_get_free"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = function() {
  return (_emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = Module["asm"]["emscripten_stack_get_end"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var stackSave = Module["stackSave"] = createExportWrapper("stackSave");

/** @type {function(...*):?} */
var stackRestore = Module["stackRestore"] = createExportWrapper("stackRestore");

/** @type {function(...*):?} */
var stackAlloc = Module["stackAlloc"] = createExportWrapper("stackAlloc");

/** @type {function(...*):?} */
var dynCall_jiji = Module["dynCall_jiji"] = createExportWrapper("dynCall_jiji");





// === Auto-generated postamble setup entry stuff ===

if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromString")) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "intArrayToString")) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["ccall"] = ccall;
if (!Object.getOwnPropertyDescriptor(Module, "cwrap")) Module["cwrap"] = function() { abort("'cwrap' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setValue")) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["getValue"] = getValue;
if (!Object.getOwnPropertyDescriptor(Module, "allocate")) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ArrayToString")) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ToString")) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8Array")) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8")) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF8")) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreRun")) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnInit")) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreMain")) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnExit")) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPostRun")) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeStringToMemory")) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeArrayToMemory")) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeAsciiToMemory")) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addRunDependency")) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "removeRunDependency")) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createFolder")) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPath")) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDataFile")) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPreloadedFile")) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLazyFile")) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLink")) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDevice")) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_unlink")) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "getLEB")) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFunctionTables")) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "alignFunctionTables")) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFunctions")) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addFunction")) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "removeFunction")) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "prettyPrint")) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getCompilerSetting")) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "print")) Module["print"] = function() { abort("'print' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "printErr")) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getTempRet0")) Module["getTempRet0"] = function() { abort("'getTempRet0' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setTempRet0")) Module["setTempRet0"] = function() { abort("'setTempRet0' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callMain")) Module["callMain"] = function() { abort("'callMain' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "abort")) Module["abort"] = function() { abort("'abort' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "keepRuntimeAlive")) Module["keepRuntimeAlive"] = function() { abort("'keepRuntimeAlive' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "zeroMemory")) Module["zeroMemory"] = function() { abort("'zeroMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToNewUTF8")) Module["stringToNewUTF8"] = function() { abort("'stringToNewUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setFileTime")) Module["setFileTime"] = function() { abort("'setFileTime' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscripten_realloc_buffer")) Module["emscripten_realloc_buffer"] = function() { abort("'emscripten_realloc_buffer' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ENV")) Module["ENV"] = function() { abort("'ENV' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "withStackSave")) Module["withStackSave"] = function() { abort("'withStackSave' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ERRNO_CODES")) Module["ERRNO_CODES"] = function() { abort("'ERRNO_CODES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ERRNO_MESSAGES")) Module["ERRNO_MESSAGES"] = function() { abort("'ERRNO_MESSAGES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setErrNo")) Module["setErrNo"] = function() { abort("'setErrNo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetPton4")) Module["inetPton4"] = function() { abort("'inetPton4' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetNtop4")) Module["inetNtop4"] = function() { abort("'inetNtop4' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetPton6")) Module["inetPton6"] = function() { abort("'inetPton6' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "inetNtop6")) Module["inetNtop6"] = function() { abort("'inetNtop6' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readSockaddr")) Module["readSockaddr"] = function() { abort("'readSockaddr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeSockaddr")) Module["writeSockaddr"] = function() { abort("'writeSockaddr' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "DNS")) Module["DNS"] = function() { abort("'DNS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getHostByName")) Module["getHostByName"] = function() { abort("'getHostByName' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GAI_ERRNO_MESSAGES")) Module["GAI_ERRNO_MESSAGES"] = function() { abort("'GAI_ERRNO_MESSAGES' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Protocols")) Module["Protocols"] = function() { abort("'Protocols' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Sockets")) Module["Sockets"] = function() { abort("'Sockets' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getRandomDevice")) Module["getRandomDevice"] = function() { abort("'getRandomDevice' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "traverseStack")) Module["traverseStack"] = function() { abort("'traverseStack' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertFrameToPC")) Module["convertFrameToPC"] = function() { abort("'convertFrameToPC' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UNWIND_CACHE")) Module["UNWIND_CACHE"] = function() { abort("'UNWIND_CACHE' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "saveInUnwindCache")) Module["saveInUnwindCache"] = function() { abort("'saveInUnwindCache' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertPCtoSourceLocation")) Module["convertPCtoSourceLocation"] = function() { abort("'convertPCtoSourceLocation' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readAsmConstArgsArray")) Module["readAsmConstArgsArray"] = function() { abort("'readAsmConstArgsArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readAsmConstArgs")) Module["readAsmConstArgs"] = function() { abort("'readAsmConstArgs' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "mainThreadEM_ASM")) Module["mainThreadEM_ASM"] = function() { abort("'mainThreadEM_ASM' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jstoi_q")) Module["jstoi_q"] = function() { abort("'jstoi_q' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jstoi_s")) Module["jstoi_s"] = function() { abort("'jstoi_s' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getExecutableName")) Module["getExecutableName"] = function() { abort("'getExecutableName' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "listenOnce")) Module["listenOnce"] = function() { abort("'listenOnce' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "autoResumeAudioContext")) Module["autoResumeAudioContext"] = function() { abort("'autoResumeAudioContext' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCallLegacy")) Module["dynCallLegacy"] = function() { abort("'dynCallLegacy' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getDynCaller")) Module["getDynCaller"] = function() { abort("'getDynCaller' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callRuntimeCallbacks")) Module["callRuntimeCallbacks"] = function() { abort("'callRuntimeCallbacks' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "wasmTableMirror")) Module["wasmTableMirror"] = function() { abort("'wasmTableMirror' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setWasmTableEntry")) Module["setWasmTableEntry"] = function() { abort("'setWasmTableEntry' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getWasmTableEntry")) Module["getWasmTableEntry"] = function() { abort("'getWasmTableEntry' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "handleException")) Module["handleException"] = function() { abort("'handleException' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "runtimeKeepalivePush")) Module["runtimeKeepalivePush"] = function() { abort("'runtimeKeepalivePush' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "runtimeKeepalivePop")) Module["runtimeKeepalivePop"] = function() { abort("'runtimeKeepalivePop' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callUserCallback")) Module["callUserCallback"] = function() { abort("'callUserCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "maybeExit")) Module["maybeExit"] = function() { abort("'maybeExit' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "safeSetTimeout")) Module["safeSetTimeout"] = function() { abort("'safeSetTimeout' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "asmjsMangle")) Module["asmjsMangle"] = function() { abort("'asmjsMangle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "asyncLoad")) Module["asyncLoad"] = function() { abort("'asyncLoad' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "alignMemory")) Module["alignMemory"] = function() { abort("'alignMemory' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "mmapAlloc")) Module["mmapAlloc"] = function() { abort("'mmapAlloc' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "reallyNegative")) Module["reallyNegative"] = function() { abort("'reallyNegative' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "unSign")) Module["unSign"] = function() { abort("'unSign' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "reSign")) Module["reSign"] = function() { abort("'reSign' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "formatString")) Module["formatString"] = function() { abort("'formatString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PATH")) Module["PATH"] = function() { abort("'PATH' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PATH_FS")) Module["PATH_FS"] = function() { abort("'PATH_FS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SYSCALLS")) Module["SYSCALLS"] = function() { abort("'SYSCALLS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "syscallMmap2")) Module["syscallMmap2"] = function() { abort("'syscallMmap2' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "syscallMunmap")) Module["syscallMunmap"] = function() { abort("'syscallMunmap' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getSocketFromFD")) Module["getSocketFromFD"] = function() { abort("'getSocketFromFD' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getSocketAddress")) Module["getSocketAddress"] = function() { abort("'getSocketAddress' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "JSEvents")) Module["JSEvents"] = function() { abort("'JSEvents' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerKeyEventCallback")) Module["registerKeyEventCallback"] = function() { abort("'registerKeyEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "specialHTMLTargets")) Module["specialHTMLTargets"] = function() { abort("'specialHTMLTargets' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "maybeCStringToJsString")) Module["maybeCStringToJsString"] = function() { abort("'maybeCStringToJsString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "findEventTarget")) Module["findEventTarget"] = function() { abort("'findEventTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "findCanvasEventTarget")) Module["findCanvasEventTarget"] = function() { abort("'findCanvasEventTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getBoundingClientRect")) Module["getBoundingClientRect"] = function() { abort("'getBoundingClientRect' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillMouseEventData")) Module["fillMouseEventData"] = function() { abort("'fillMouseEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerMouseEventCallback")) Module["registerMouseEventCallback"] = function() { abort("'registerMouseEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerWheelEventCallback")) Module["registerWheelEventCallback"] = function() { abort("'registerWheelEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerUiEventCallback")) Module["registerUiEventCallback"] = function() { abort("'registerUiEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFocusEventCallback")) Module["registerFocusEventCallback"] = function() { abort("'registerFocusEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillDeviceOrientationEventData")) Module["fillDeviceOrientationEventData"] = function() { abort("'fillDeviceOrientationEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerDeviceOrientationEventCallback")) Module["registerDeviceOrientationEventCallback"] = function() { abort("'registerDeviceOrientationEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillDeviceMotionEventData")) Module["fillDeviceMotionEventData"] = function() { abort("'fillDeviceMotionEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerDeviceMotionEventCallback")) Module["registerDeviceMotionEventCallback"] = function() { abort("'registerDeviceMotionEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "screenOrientation")) Module["screenOrientation"] = function() { abort("'screenOrientation' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillOrientationChangeEventData")) Module["fillOrientationChangeEventData"] = function() { abort("'fillOrientationChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerOrientationChangeEventCallback")) Module["registerOrientationChangeEventCallback"] = function() { abort("'registerOrientationChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillFullscreenChangeEventData")) Module["fillFullscreenChangeEventData"] = function() { abort("'fillFullscreenChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFullscreenChangeEventCallback")) Module["registerFullscreenChangeEventCallback"] = function() { abort("'registerFullscreenChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerRestoreOldStyle")) Module["registerRestoreOldStyle"] = function() { abort("'registerRestoreOldStyle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "hideEverythingExceptGivenElement")) Module["hideEverythingExceptGivenElement"] = function() { abort("'hideEverythingExceptGivenElement' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "restoreHiddenElements")) Module["restoreHiddenElements"] = function() { abort("'restoreHiddenElements' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setLetterbox")) Module["setLetterbox"] = function() { abort("'setLetterbox' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "currentFullscreenStrategy")) Module["currentFullscreenStrategy"] = function() { abort("'currentFullscreenStrategy' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "restoreOldWindowedStyle")) Module["restoreOldWindowedStyle"] = function() { abort("'restoreOldWindowedStyle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "softFullscreenResizeWebGLRenderTarget")) Module["softFullscreenResizeWebGLRenderTarget"] = function() { abort("'softFullscreenResizeWebGLRenderTarget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "doRequestFullscreen")) Module["doRequestFullscreen"] = function() { abort("'doRequestFullscreen' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillPointerlockChangeEventData")) Module["fillPointerlockChangeEventData"] = function() { abort("'fillPointerlockChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerPointerlockChangeEventCallback")) Module["registerPointerlockChangeEventCallback"] = function() { abort("'registerPointerlockChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerPointerlockErrorEventCallback")) Module["registerPointerlockErrorEventCallback"] = function() { abort("'registerPointerlockErrorEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "requestPointerLock")) Module["requestPointerLock"] = function() { abort("'requestPointerLock' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillVisibilityChangeEventData")) Module["fillVisibilityChangeEventData"] = function() { abort("'fillVisibilityChangeEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerVisibilityChangeEventCallback")) Module["registerVisibilityChangeEventCallback"] = function() { abort("'registerVisibilityChangeEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerTouchEventCallback")) Module["registerTouchEventCallback"] = function() { abort("'registerTouchEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillGamepadEventData")) Module["fillGamepadEventData"] = function() { abort("'fillGamepadEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerGamepadEventCallback")) Module["registerGamepadEventCallback"] = function() { abort("'registerGamepadEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerBeforeUnloadEventCallback")) Module["registerBeforeUnloadEventCallback"] = function() { abort("'registerBeforeUnloadEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillBatteryEventData")) Module["fillBatteryEventData"] = function() { abort("'fillBatteryEventData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "battery")) Module["battery"] = function() { abort("'battery' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerBatteryEventCallback")) Module["registerBatteryEventCallback"] = function() { abort("'registerBatteryEventCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setCanvasElementSize")) Module["setCanvasElementSize"] = function() { abort("'setCanvasElementSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getCanvasElementSize")) Module["getCanvasElementSize"] = function() { abort("'getCanvasElementSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "demangle")) Module["demangle"] = function() { abort("'demangle' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "demangleAll")) Module["demangleAll"] = function() { abort("'demangleAll' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jsStackTrace")) Module["jsStackTrace"] = function() { abort("'jsStackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getEnvStrings")) Module["getEnvStrings"] = function() { abort("'getEnvStrings' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "checkWasiClock")) Module["checkWasiClock"] = function() { abort("'checkWasiClock' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "flush_NO_FILESYSTEM")) Module["flush_NO_FILESYSTEM"] = function() { abort("'flush_NO_FILESYSTEM' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64")) Module["writeI53ToI64"] = function() { abort("'writeI53ToI64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64Clamped")) Module["writeI53ToI64Clamped"] = function() { abort("'writeI53ToI64Clamped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64Signaling")) Module["writeI53ToI64Signaling"] = function() { abort("'writeI53ToI64Signaling' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToU64Clamped")) Module["writeI53ToU64Clamped"] = function() { abort("'writeI53ToU64Clamped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToU64Signaling")) Module["writeI53ToU64Signaling"] = function() { abort("'writeI53ToU64Signaling' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readI53FromI64")) Module["readI53FromI64"] = function() { abort("'readI53FromI64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readI53FromU64")) Module["readI53FromU64"] = function() { abort("'readI53FromU64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertI32PairToI53")) Module["convertI32PairToI53"] = function() { abort("'convertI32PairToI53' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertU32PairToI53")) Module["convertU32PairToI53"] = function() { abort("'convertU32PairToI53' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setImmediateWrapped")) Module["setImmediateWrapped"] = function() { abort("'setImmediateWrapped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "clearImmediateWrapped")) Module["clearImmediateWrapped"] = function() { abort("'clearImmediateWrapped' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "polyfillSetImmediate")) Module["polyfillSetImmediate"] = function() { abort("'polyfillSetImmediate' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "uncaughtExceptionCount")) Module["uncaughtExceptionCount"] = function() { abort("'uncaughtExceptionCount' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exceptionLast")) Module["exceptionLast"] = function() { abort("'exceptionLast' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exceptionCaught")) Module["exceptionCaught"] = function() { abort("'exceptionCaught' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ExceptionInfo")) Module["ExceptionInfo"] = function() { abort("'ExceptionInfo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "CatchInfo")) Module["CatchInfo"] = function() { abort("'CatchInfo' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exception_addRef")) Module["exception_addRef"] = function() { abort("'exception_addRef' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exception_decRef")) Module["exception_decRef"] = function() { abort("'exception_decRef' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Browser")) Module["Browser"] = function() { abort("'Browser' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "funcWrappers")) Module["funcWrappers"] = function() { abort("'funcWrappers' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setMainLoop")) Module["setMainLoop"] = function() { abort("'setMainLoop' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "wget")) Module["wget"] = function() { abort("'wget' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS")) Module["FS"] = function() { abort("'FS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "MEMFS")) Module["MEMFS"] = function() { abort("'MEMFS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "TTY")) Module["TTY"] = function() { abort("'TTY' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PIPEFS")) Module["PIPEFS"] = function() { abort("'PIPEFS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SOCKFS")) Module["SOCKFS"] = function() { abort("'SOCKFS' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "_setNetworkCallback")) Module["_setNetworkCallback"] = function() { abort("'_setNetworkCallback' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "tempFixedLengthArray")) Module["tempFixedLengthArray"] = function() { abort("'tempFixedLengthArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "miniTempWebGLFloatBuffers")) Module["miniTempWebGLFloatBuffers"] = function() { abort("'miniTempWebGLFloatBuffers' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "heapObjectForWebGLType")) Module["heapObjectForWebGLType"] = function() { abort("'heapObjectForWebGLType' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "heapAccessShiftForWebGLHeap")) Module["heapAccessShiftForWebGLHeap"] = function() { abort("'heapAccessShiftForWebGLHeap' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GL")) Module["GL"] = function() { abort("'GL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGet")) Module["emscriptenWebGLGet"] = function() { abort("'emscriptenWebGLGet' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "computeUnpackAlignedImageSize")) Module["computeUnpackAlignedImageSize"] = function() { abort("'computeUnpackAlignedImageSize' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetTexPixelData")) Module["emscriptenWebGLGetTexPixelData"] = function() { abort("'emscriptenWebGLGetTexPixelData' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetUniform")) Module["emscriptenWebGLGetUniform"] = function() { abort("'emscriptenWebGLGetUniform' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "webglGetUniformLocation")) Module["webglGetUniformLocation"] = function() { abort("'webglGetUniformLocation' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "webglPrepareUniformLocationsBeforeFirstUse")) Module["webglPrepareUniformLocationsBeforeFirstUse"] = function() { abort("'webglPrepareUniformLocationsBeforeFirstUse' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "webglGetLeftBracePos")) Module["webglGetLeftBracePos"] = function() { abort("'webglGetLeftBracePos' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetVertexAttrib")) Module["emscriptenWebGLGetVertexAttrib"] = function() { abort("'emscriptenWebGLGetVertexAttrib' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeGLArray")) Module["writeGLArray"] = function() { abort("'writeGLArray' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "AL")) Module["AL"] = function() { abort("'AL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_unicode")) Module["SDL_unicode"] = function() { abort("'SDL_unicode' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_ttfContext")) Module["SDL_ttfContext"] = function() { abort("'SDL_ttfContext' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_audio")) Module["SDL_audio"] = function() { abort("'SDL_audio' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL")) Module["SDL"] = function() { abort("'SDL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_gfx")) Module["SDL_gfx"] = function() { abort("'SDL_gfx' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLUT")) Module["GLUT"] = function() { abort("'GLUT' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "EGL")) Module["EGL"] = function() { abort("'EGL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLFW_Window")) Module["GLFW_Window"] = function() { abort("'GLFW_Window' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLFW")) Module["GLFW"] = function() { abort("'GLFW' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLEW")) Module["GLEW"] = function() { abort("'GLEW' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "IDBStore")) Module["IDBStore"] = function() { abort("'IDBStore' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "runAndAbortIfError")) Module["runAndAbortIfError"] = function() { abort("'runAndAbortIfError' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "warnOnce")) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackSave")) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackRestore")) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackAlloc")) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "AsciiToString")) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToAscii")) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF16ToString")) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF16")) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF16")) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF32ToString")) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF32")) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF32")) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8")) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8OnStack")) Module["allocateUTF8OnStack"] = function() { abort("'allocateUTF8OnStack' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["writeStackCookie"] = writeStackCookie;
Module["checkStackCookie"] = checkStackCookie;
if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromBase64")) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "tryParseAsDataURI")) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_NORMAL")) Object.defineProperty(Module, "ALLOC_NORMAL", { configurable: true, get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_STACK")) Object.defineProperty(Module, "ALLOC_STACK", { configurable: true, get: function() { abort("'ALLOC_STACK' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)") } });

var calledRun;

/**
 * @constructor
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}

var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  _emscripten_stack_init();
  writeStackCookie();
}

/** @type {function(Array=)} */
function run(args) {
  args = args || arguments_;

  if (runDependencies > 0) {
    return;
  }

  stackCheckInit();

  preRun();

  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    return;
  }

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush();
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.');
    warnOnce('(this may also be due to not including full filesystem support - try building with -s FORCE_FILESYSTEM=1)');
  }
}

/** @param {boolean|number=} implicit */
function exit(status, implicit) {
  EXITSTATUS = status;

  checkUnflushedContent();

  if (keepRuntimeAlive()) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      var msg = 'program exited (with status: ' + status + '), but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)';
      err(msg);
    }
  } else {
    exitRuntime();
  }

  procExit(status);
}

function procExit(code) {
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    if (Module['onExit']) Module['onExit'](code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

run();





