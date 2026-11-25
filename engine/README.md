# Stockfish engine

The analysis board runs **Stockfish 19** in the browser, using the "lite, single-threaded" WebAssembly build from [stockfish.js](https://github.com/nmrugg/stockfish.js) by Nathan Rugg (npm package `stockfish`, version 19.0.1).

- `stockfish-19-lite-single.js` and `stockfish-19-lite-single.wasm`: the engine with 1 thread (the default), unchanged from the npm package.
- `stockfish-19-lite.js` and `stockfish-19-lite.wasm`: the multi-threaded engine, used when Settings → Threads is above 1. It needs a cross-origin isolated page, which `sw.js` provides.
- `Copying.txt`: the engine's license, the GNU General Public License v3.

Source code: the Stockfish engine is at https://github.com/official-stockfish/Stockfish and the WebAssembly build is at https://github.com/nmrugg/stockfish.js (tag v19.0.1).

The app talks to the engine only through text messages (the UCI protocol) in a Web Worker.
