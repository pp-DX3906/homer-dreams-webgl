const canvas = document.querySelector('#gl');
const gl = canvas.getContext('webgl2', { antialias: false });
if (!gl) throw new Error('WebGL 2 is required');

const vertexSource = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

// Direct local adaptation of the original Shadertoy Image pass.
const fragmentSource = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec3 iResolution;
uniform float iTime;
uniform vec2 uView;
uniform float uZoom;
uniform float uPick;

#define MS 100
#define MT 7.
#define mD .001

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

float add(float a, float b) { return a < b ? a : b; }
mat2 Rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, s, -s, c);
}
vec3 N13(float p) {
  float x = fract(cos(p*94.234)*2943.234);
  float y = fract(cos(p*15.332)*534.254);
  float z = fract(cos(p*42.332)*943.234);
  return vec3(x, y, z);
}
float N31(vec3 p) { return fract(cos(length(p*10.23))*942.344); }

float sdStar5(vec2 p, float r, float rf) {
  const vec2 k1=vec2(.809016994,-.587785252);
  const vec2 k2=vec2(-.809016994,-.587785252);
  p.x=abs(p.x);
  p-=2.*max(dot(k1,p),0.)*k1;
  p-=2.*max(dot(k2,p),0.)*k2;
  p.x=abs(p.x);
  p.y-=r;
  vec2 ba=rf*vec2(-k1.y,k1.x)-vec2(0.,1.);
  float h=clamp(dot(p,ba)/dot(ba,ba),0.,r);
  return length(p-ba*h)*sign(p.y*ba.x-p.x*ba.y);
}

vec3 sunsetPalette(float t) {
  vec3 indigo = vec3(0.055, 0.135, 0.505);
  vec3 violet = vec3(0.315, 0.205, 0.820);
  vec3 sky = vec3(0.245, 0.635, 0.965);
  vec3 pink = vec3(0.965, 0.610, 0.865);
  vec3 cream = vec3(1.000, 0.825, 0.690);
  vec3 coral = vec3(0.990, 0.275, 0.270);

  if(t < .18) return mix(indigo, violet, smoothstep(0., .18, t));
  if(t < .38) return mix(violet, sky, smoothstep(.18, .38, t));
  if(t < .61) return mix(sky, pink, smoothstep(.38, .61, t));
  if(t < .82) return mix(pink, cream, smoothstep(.61, .82, t));
  return mix(cream, coral, smoothstep(.82, 1., t));
}

vec3 donutColor(float seed, vec3 localPos) {
  // Every donut receives three brighter but related colors.
  vec3 blueA = vec3(0.110, 0.270, 0.820);
  vec3 blueB = vec3(0.265, 0.500, 1.000);
  vec3 violetA = vec3(0.475, 0.300, 0.950);
  vec3 violetB = vec3(0.660, 0.420, 1.000);
  vec3 pink = vec3(1.000, 0.570, 0.840);
  vec3 peach = vec3(1.000, 0.665, 0.470);

  vec3 c0 = mix(blueA, blueB, fract(seed*5.31));
  vec3 c1 = mix(violetA, violetB, fract(seed*8.17+.21));
  vec3 c2 = mix(pink, peach, fract(seed*11.73+.47));

  // Three overlapping lobes form a seamless, stationary gradient around the torus.
  float a = atan(localPos.z, localPos.x) + localPos.y*3.2 + seed*6.28318;
  vec3 w = .5 + .5*cos(a - vec3(0., 2.094395, 4.188790));
  w = w*w;
  w /= max(w.x+w.y+w.z, .001);
  return c0*w.x + c1*w.y + c2*w.z;
}

float specialDonut(vec3 id) {
  // At most three cells per time window, always on the left or right of the tunnel.
  float window = 7.;
  float slot = floor(iTime/window);
  float phase = fract(iTime/window);
  float fade = smoothstep(0., .16, phase) * (1.-smoothstep(.78, 1., phase));
  float baseZ = floor(slot*window*.3);
  float sideA = N13(slot+11.).x < .5 ? -1. : 1.;
  float sideB = -sideA;
  float sideC = N13(slot+29.).y < .5 ? -1. : 1.;
  float yA = 0.;
  float yB = 0.;
  float yC = floor(N13(slot+17.).x*3.)-1.;
  float a = 1.-step(.5, length(id-vec3(sideA,yA,baseZ+2.)));
  float b = 1.-step(.5, length(id-vec3(sideB,yB,baseZ+3.)));
  float c = 1.-step(.5, length(id-vec3(sideC,yC,baseZ+4.)));
  c *= step(.40,N13(slot+47.).z);
  return max(a,max(b,c))*fade;
}

vec3 specialColor(vec3 id, vec3 localPos) {
  float seed = N13(dot(id,vec3(1.,31.,117.))).x;
  vec3 a, b, c;
  if(seed < .34) {
    a=vec3(.635,.996,.839); // mint
    b=vec3(.478,.996,.945); // aqua
    c=vec3(.655,.769,1.); // periwinkle
  } else if(seed < .68) {
    a=vec3(.596,.529,.706); // mauve
    b=vec3(.573,.722,.635); // sage
    c=vec3(.980,.502,.627); // pink
  } else {
    a=vec3(.937,.827,.816); // blush
    b=vec3(1.,.545,.408); // peach
    c=vec3(.984,.698,.259); // amber
  }
  float angle = atan(localPos.z,localPos.x)+localPos.y*3.2+seed*6.28318;
  vec3 w=.5+.5*cos(angle-vec3(0.,2.094395,4.188790));
  w=w*w;
  w/=max(w.x+w.y+w.z,.001);
  return a*w.x+b*w.y+c*w.z;
}

vec4 GetDist(vec3 p) {
  vec3 pT = fract(p-(cos(p*10.+iTime)*.04)*(cos(p*20.+iTime)*.6))-.5;
  vec3 idpT = floor(p);
  float rP = N31(idpT);
  float stop = 1.;
  if(idpT.x == 0.) stop = 0.;
  pT.yz *= Rot(iTime*rP*stop+30.);
  float torus = sdTorus(pT, vec2(.15, .08));
  // One stable weighted-random gradient per spatial cell/donut.
  vec3 color = donutColor(rP, pT);

  return vec4(torus,color);
}

vec4 Ray(vec3 ro, vec3 rd) {
  float dist = 0.;
  vec3 col;
  for(int i = 0; i < MS; i++) {
    vec3 p = ro + rd * dist;
    float d = GetDist(p).x;
    dist += d;
    if(dist > MT) { col = vec3(-1); break; }
    if(d < mD) { col = GetDist(p).yzw; break; }
  }
  return vec4(dist, col);
}

vec3 Normals(vec3 p) {
  vec2 d = vec2(mD, 0);
  float x = (GetDist(p+d.xyy)-GetDist(p-d.xyy)).x;
  float y = (GetDist(p+d.yxy)-GetDist(p-d.yxy)).x;
  float z = (GetDist(p+d.yyx)-GetDist(p-d.yyx)).x;
  return normalize(vec3(x,y,z));
}
float GetLight(vec3 p, vec3 light) {
  vec3 n = Normals(p);
  vec3 l = normalize(light-p);
  return clamp(dot(n, l)*.5+.7, 0., 1.);
}
vec3 GetRayDir(vec2 uv, vec3 ro, vec3 l, float z) {
  vec3 f = normalize(l-ro);
  vec3 r = normalize(cross(vec3(0,1,0), f));
  vec3 u = cross(f, r);
  vec3 c = ro + f*z;
  vec3 i = c + uv.x*r + uv.y*u;
  return normalize(i-ro);
}

float hash21(vec2 p) {
  p = fract(p*vec2(123.34, 456.21));
  p += dot(p, p+45.32);
  return fract(p.x*p.y);
}

float noise2(vec2 p) {
  vec2 i=floor(p), f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),
             mix(hash21(i+vec2(0,1)),hash21(i+vec2(1)),f.x),f.y);
}

float cloudNoise(vec2 p) {
  float n=0., a=.55;
  for(int i=0;i<4;i++) { n+=noise2(p)*a; p=mat2(1.6,-1.2,1.2,1.6)*p+1.7; a*=.5; }
  return n;
}

vec3 starLayer(vec2 uv, float scale, float threshold) {
  vec2 gv=fract(uv*scale)-.5;
  vec2 id=floor(uv*scale);
  float rnd=hash21(id);
  vec2 offset=vec2(hash21(id+17.3),hash21(id+41.7))-.5;
  vec2 p=gv-offset*.72;
  float d=length(p);
  float size=mix(.026,.105,pow(hash21(id+9.2),5.));
  float core=smoothstep(size,0.,d);
  float sparkle=(smoothstep(.022,0.,abs(p.x))*smoothstep(.18,0.,abs(p.y))+
                 smoothstep(.022,0.,abs(p.y))*smoothstep(.18,0.,abs(p.x)))*.33;
  float visible=step(threshold,rnd);
  float warm=hash21(id+3.1);
  vec3 tint=warm>.82?vec3(1.,.64,.34):(warm<.16?vec3(.38,.72,1.):vec3(1.,.90,.78));
  float twinkle=.82+.18*sin(iTime*(1.2+rnd*2.)+rnd*30.);
  return tint*(core+sparkle*step(.965,rnd))*visible*twinkle;
}

vec3 glitterLayer(vec2 uv, float scale, float threshold) {
  vec2 gv=fract(uv*scale)-.5;
  vec2 id=floor(uv*scale);
  float rnd=hash21(id+73.1);
  vec2 offset=vec2(hash21(id+8.4),hash21(id+24.9))-.5;
  vec2 p=gv-offset*.62;
  float angle=rnd*6.28318+iTime*(.08+.16*hash21(id+51.));
  p=Rot(angle)*p;
  float size=mix(.105,.205,pow(hash21(id+19.6),1.6));
  float d=sdStar5(p,size,.44);
  float fill=smoothstep(.014,-.008,d);
  float glow=exp(-max(d,0.)*32.)*smoothstep(.19,.02,max(d,0.));
  float visible=step(threshold,rnd);
  float flicker=.76+.24*sin(iTime*(1.4+rnd*2.5)+rnd*38.);
  float tone=hash21(id+3.7);
  vec3 tint=tone<.22?vec3(.58,.90,1.):
            tone<.45?vec3(1.,.68,.86):
            tone<.68?vec3(.73,.64,1.):vec3(1.,.91,.62);
  return tint*(fill*1.18+glow*.55)*visible*flicker;
}

float shootingStar(vec2 uv, vec2 origin, float angle) {
  uv-=origin;
  uv=Rot(angle)*uv;
  float line=smoothstep(.010,0.,abs(uv.y))*smoothstep(.34,0.,uv.x)*smoothstep(-.03,.04,uv.x);
  float head=smoothstep(.032,0.,length(uv));
  return line*.48+head;
}

vec3 starrySky(vec2 uv) {
  float y=uv.y+.12;
  vec3 sky=mix(vec3(.018,.035,.105),vec3(.055,.125,.245),smoothstep(-.85,.85,y));
  float nebula=cloudNoise(uv*2.15+vec2(4.2,1.7));
  float band=exp(-pow((uv.y+.43-nebula*.18)*3.0,2.));
  sky+=mix(vec3(.045,.105,.18),vec3(.16,.20,.30),nebula)*band*.52;
  sky+=starLayer(uv+vec2(.17,.08),22.,.66)*1.15;
  sky+=starLayer(uv+vec2(.41,.36),40.,.82)*.88;
  sky+=starLayer(uv+vec2(.63,.19),68.,.94)*.62;
  sky+=glitterLayer(uv+vec2(.13,.27),12.,.56);
  sky+=glitterLayer(uv+vec2(.49,.08),17.,.70)*.82;
  float streak=shootingStar(uv,vec2(.48,.35),-.62)+shootingStar(uv,vec2(-.56,-.08),-.62);
  sky+=vec3(.72,.84,1.)*streak;

  // Watercolor-like cloud sea gathers around the frame while leaving the center open.
  float edge=smoothstep(.22,.78,length(uv*vec2(.72,1.08)));
  float farCloud=edge*smoothstep(.34,.72,cloudNoise(uv*2.05+vec2(6.7,-1.8)));
  float midCloud=edge*smoothstep(.43,.76,cloudNoise(uv*3.35+vec2(-2.4,5.1)));
  float nearCloud=edge*smoothstep(.52,.80,cloudNoise(uv*5.15+vec2(9.3,3.6)));
  float wisps=edge*smoothstep(.57,.84,cloudNoise(uv*7.4+vec2(-7.2,-4.8)));

  sky=mix(sky,vec3(.105,.205,.405),farCloud*.46);
  sky=mix(sky,vec3(.275,.365,.610),midCloud*.52);
  sky=mix(sky,vec3(.515,.525,.755),nearCloud*.48);
  sky+=vec3(.34,.39,.62)*wisps*.22;
  sky+=vec3(.24,.29,.50)*nearCloud*(1.-midCloud)*.12;
  return sky;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord-.5*iResolution.xy)/iResolution.y;
  vec2 sceneUv = uv/uZoom;
  vec3 bg = starrySky(sceneUv + uView*.8);
  vec3 col = bg;
  vec3 ro = vec3(.5, .5, iTime*.3);
  vec3 rd = normalize(vec3(sceneUv, 1));
  rd.yz = Rot(-uView.y)*rd.yz;
  rd.xz = Rot(-uView.x)*rd.xz;
  vec3 light = vec3(0., 6, 0.);
  vec4 r = Ray(ro, rd);
  vec3 p = ro+rd*r.x;
  vec3 id = floor(p);
  float special = r.y == -1. ? 0. : specialDonut(id);
  if(uPick > .5) {
    fragColor = vec4(vec3(step(.45,special)),1.);
    return;
  }
  if(r.y != -1.) {
    vec3 n = Normals(p);
    vec3 ld = normalize(light-p);
    float l = clamp(dot(n,ld)*.36+.82, 0., 1.08);
    float rim = pow(1.-max(dot(n,-rd),0.), 2.2);
    vec3 localPos = fract(p-(cos(p*10.+iTime)*.04)*(cos(p*20.+iTime)*.6))-.5;
    float spin = id.x == 0. ? 0. : 1.;
    localPos.yz *= Rot(iTime*N31(id)*spin+30.);
    vec3 surfaceColor = mix(r.yzw,specialColor(id,localPos),special);
    col = surfaceColor*l*1.10;
    col += mix(vec3(.20,.28,.72),vec3(.90,.50,.72),r.z)*rim*.16;
    // Blend silhouettes into the surrounding color for a soft, hazy contour.
    col = mix(col, bg, rim*.24);
  }
  fragColor = vec4(col,1.0);
}
void main() { mainImage(outColor, gl_FragCoord.xy); }`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}
const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program);

gl.bindVertexArray(gl.createVertexArray());
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
const position = gl.getAttribLocation(program, 'position');
gl.enableVertexAttribArray(position);
gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
const resolution = gl.getUniformLocation(program, 'iResolution');
const time = gl.getUniformLocation(program, 'iTime');
const viewUniform = gl.getUniformLocation(program, 'uView');
const zoomUniform = gl.getUniformLocation(program, 'uZoom');
const pickUniform = gl.getUniformLocation(program, 'uPick');

let paused = false, elapsed = 0, previous = performance.now();
let speed = 1;
const view = { yaw: 0, pitch: 0, zoom: 1 };
globalThis.viewAngles = view;
let drag = null;

canvas.addEventListener('wheel', event => {
  event.preventDefault();
  view.zoom = Math.max(1, Math.min(1.75, view.zoom*Math.exp(event.deltaY*.0012)));
}, { passive: false });

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY,
           lastX: event.clientX, lastY: event.clientY, moved: false };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  if (Math.hypot(event.clientX-drag.startX, event.clientY-drag.startY) > 6) drag.moved = true;
  if (drag.moved) {
    const sensitivity = .003;
    view.yaw = Math.max(-.65, Math.min(.65, view.yaw + (event.clientX-drag.lastX)*sensitivity));
    view.pitch = Math.max(-.30, Math.min(.30, view.pitch - (event.clientY-drag.lastY)*sensitivity));
  }
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
});
canvas.addEventListener('pointerup', event => {
  if (!drag || event.pointerId !== drag.id) return;
  if (!drag.moved && speed < 10 && pickSpecialDonut(event.clientX,event.clientY)) {
    speed += 1;
    document.querySelector('#speed').textContent = `${speed}×`;
  }
  drag = null;
});
canvas.addEventListener('pointercancel', () => { drag = null; });
function pickSpecialDonut(clientX,clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((clientX-rect.left)*canvas.width/rect.width);
  const y = Math.floor((rect.bottom-clientY)*canvas.height/rect.height);
  if(x<0 || y<0 || x>=canvas.width || y>=canvas.height) return false;
  gl.uniform1f(pickUniform,1);
  gl.drawArrays(gl.TRIANGLES,0,3);
  const pixel = new Uint8Array(4);
  gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
  gl.uniform1f(pickUniform,0);
  gl.drawArrays(gl.TRIANGLES,0,3);
  return pixel[0] > 127;
}
function resize() {
  const ratio = Math.min(devicePixelRatio, 1.5);
  const width = Math.round(innerWidth*ratio), height = Math.round(innerHeight*ratio);
  if(canvas.width!==width || canvas.height!==height) {
    canvas.width=width; canvas.height=height; gl.viewport(0,0,width,height);
  }
}
function render(now) {
  resize();
  if(!paused) elapsed += (now-previous)/1000 * speed;
  previous=now;
  globalThis.shaderTime=elapsed;
  gl.uniform3f(resolution,canvas.width,canvas.height,1);
  gl.uniform1f(time,elapsed);
  gl.uniform2f(viewUniform,view.yaw,view.pitch);
  gl.uniform1f(zoomUniform,view.zoom);
  gl.drawArrays(gl.TRIANGLES,0,3);
  requestAnimationFrame(render);
}
function togglePause() {
  paused=!paused;
  document.querySelector('#pause').textContent=paused?'▶':'Ⅱ';
}
document.querySelector('#pause').addEventListener('click',togglePause);
addEventListener('keydown',event=>{ if(event.code==='Space'){ event.preventDefault(); togglePause(); } });
requestAnimationFrame(render);
