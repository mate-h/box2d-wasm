# box2d-wasm

# Demo
https://box2d.vercel.app/
- Space + Click and drag to pan, or mac trackpad two fingers), zoom with scroll or pinch
- Drag objects around to see how the physics engine behaves
- Clone the repo and customize the level easily by editing a JSON

# Description
A WebAssembly build of the Box2D physics engine in Svelte.
Box2D is one of the most well-known physics engine implementations out there. I decided to demonstrate its performance by browsing around GitHub and reviewing repositories that have ported it to web. I have successfully discovered a WebAssembly port of the original Box2D implementation at [github.com/kripken/box2d.js](https://github.com/kripken/box2d.js/), but the code was largely unstructured and not using modern ES6 features such as modules. I ended up building Box2D using `emscripten` myself, but from the modified source I found in this repository.

I moved some of the Box2D debug renderer code into a new architecture, by wrapping it in a `Game` class to contain the app's settings, state, and main event loop. The scene is loaded from a json file which is typically produced using the RUBE Box2D Editor. Then I added support for retina screens and touchpad controls for the ultimate macbook experience.

Read more and comment on my site [mateh.dev](https://mateh.dev/Physics-Engine-b8c734c7f038462e939a11518adb8464)
