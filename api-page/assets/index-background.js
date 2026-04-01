class FuturisticLiquidBackground {
  constructor() {
    this.pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
    this.colors = [
      [0.031, 0.106, 0.255],
      [0.039, 0.278, 0.655],
      [0.0, 0.741, 0.976],
      [0.286, 0.925, 0.988],
      [0.204, 0.306, 0.922],
      [0.027, 0.78, 0.678]
    ];
  }

  init() {
    if (!window.THREE) return;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.domElement.id = 'webGLApp';
    document.body.prepend(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060816);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.clock = new THREE.Clock();

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uColor1: { value: new THREE.Vector3(...this.colors[0]) },
      uColor2: { value: new THREE.Vector3(...this.colors[1]) },
      uColor3: { value: new THREE.Vector3(...this.colors[2]) },
      uColor4: { value: new THREE.Vector3(...this.colors[3]) },
      uColor5: { value: new THREE.Vector3(...this.colors[4]) },
      uColor6: { value: new THREE.Vector3(...this.colors[5]) }
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform float uTime; uniform vec2 uResolution; uniform vec2 uPointer; uniform vec3 uColor1; uniform vec3 uColor2; uniform vec3 uColor3; uniform vec3 uColor4; uniform vec3 uColor5; uniform vec3 uColor6; float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); } float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(hash(i+vec2(0.0,0.0)), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); } float fbm(vec2 p){ float value = 0.0; float amplitude = 0.55; for(int i=0;i<5;i++){ value += amplitude * noise(p); p *= 2.1; amplitude *= 0.52; } return value; } vec3 palette(float t){ vec3 a = mix(uColor1, uColor2, smoothstep(0.0,1.0,t)); vec3 b = mix(uColor3, uColor4, smoothstep(0.0,1.0,1.0-t)); vec3 c = mix(uColor5, uColor6, 0.5 + 0.5*sin(t*6.2831)); return mix(mix(a,b,0.5), c, 0.45); } void main(){ vec2 uv = vUv; vec2 p = uv * 2.0 - 1.0; p.x *= uResolution.x / max(uResolution.y, 1.0); vec2 pointer = (uPointer * 2.0 - 1.0); pointer.x *= uResolution.x / max(uResolution.y, 1.0); float time = uTime * 0.16; vec2 flow = vec2(fbm(p * 1.25 + vec2(time*1.2,-time*0.6)), fbm(p * 1.45 + vec2(-time*0.8,time*1.0))); float pointerDist = length(p - pointer); float swirl = exp(-pointerDist * 2.4); p += (flow - 0.5) * 0.35; p += normalize(p - pointer + 0.001) * swirl * 0.16 * sin(uTime * 0.8 + pointerDist * 8.0); float n1 = fbm(p * 1.15 + vec2(time,-time*0.7)); float n2 = fbm(p * 1.75 - vec2(time*1.1,time*0.5)); float n3 = fbm((p + vec2(n1,n2)) * 1.1); float blend = smoothstep(0.08,0.95,n1*0.55 + n2*0.25 + n3*0.45); vec3 color = palette(blend); color += palette(n2) * 0.28; color = mix(vec3(0.02,0.035,0.11), color, 1.08); float vignette = smoothstep(1.85,0.2,length(p)); color *= vignette; float grid = sin((uv.x + uTime*0.01)*180.0) * sin((uv.y - uTime*0.008)*180.0); color += grid * 0.012; float grain = fract(sin(dot(uv * uResolution.xy + uTime * 12.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5; color += grain * 0.045; gl_FragColor = vec4(clamp(color,0.0,1.0), 1.0); }'
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('mousemove', (event) => this.onPointerMove(event.clientX, event.clientY));
    window.addEventListener('touchmove', (event) => { const touch = event.touches && event.touches[0]; if (touch) this.onPointerMove(touch.clientX, touch.clientY); }, { passive: true });
    this.tick();
  }

  onPointerMove(x, y) {
    this.pointer.targetX = x / window.innerWidth;
    this.pointer.targetY = 1 - y / window.innerHeight;
  }

  onResize() {
    if (!this.renderer || !this.mesh) return;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.mesh.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }

  tick() {
    const delta = this.clock.getDelta();
    const uniforms = this.mesh.material.uniforms;
    uniforms.uTime.value += Math.min(delta, 0.05);
    this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.06;
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.06;
    uniforms.uPointer.value.set(this.pointer.x, this.pointer.y);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.tick());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new FuturisticLiquidBackground();
  app.init();
});
