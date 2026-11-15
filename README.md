# Particle Morphology Journey

An immersive WebGL visual narrative built with Three.js and custom GLSL shaders. Explore fluid particle transitions across mythical forms (Fox, Knight, Jellyfish, Phoenix, and Fairy) synchronized with scroll-driven storytelling.

## Tech Stack

- **Renderer:** Three.js + GLSL Shaders (Vite GLSL plugin)
- **Animation & Scroll:** GSAP, Locomotive Scroll, Lenis
- **Build Tool:** Vite

## Project Structure

```text
particle-morphology-journey/
├── src/
│   ├── Experience/
│   │   ├── Camera.js              # Camera manager & controls
│   │   ├── Experience.js          # Core singleton orchestrator
│   │   ├── Renderer.js            # WebGL renderer setup & post-processing
│   │   ├── sources.js             # Asset definitions (3D models)
│   │   ├── Shaders/               # GLSL vertex & fragment shaders
│   │   │   ├── Particles/         # Particle simulation & morphing shaders
│   │   │   ├── Fox/               # Fox animation & holographic shaders
│   │   │   └── Stars/             # Atmospheric star field shaders
│   │   ├── Utils/                 # Sizes, Time, FBO, Sound, Debug tools
│   │   └── World/                 # World, Environment, and Page layout
│   ├── index.html                 # HTML entry with narrative sections
│   ├── script.js                  # Application entry point
│   └── style.css                  # Typography and layout styles
├── static/
│   └── models/                    # 3D GLTF/GLB models for morphing targets
├── package.json
└── vite.config.js
```

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Controls

- **Scroll:** Drive forward / backward through the narrative and particle morphing stages
- **Mouse Drag:** Rotate 3D perspective

## License

MIT
