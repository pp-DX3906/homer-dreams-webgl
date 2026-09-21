const canvas = document.querySelector('#model');
canvas.dataset.status = 'module-started';
let THREE;
let GLTFLoader;
try {
  THREE = await import('./vendor/three.module.js');
  ({ GLTFLoader } = await import('./vendor/GLTFLoader.js'));
  canvas.dataset.status = 'imports-loaded';
} catch (error) {
  canvas.dataset.status = `import-error:${error?.message || 'unknown'}`;
  throw error;
}
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
// A wider lens placed nearer the bed makes its front and back visibly differ in size.
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, .42, 5.55);
camera.lookAt(0, -.08, 1.15);

scene.add(new THREE.HemisphereLight(0xdce8ff, 0x4c315f, 2.6));
const key = new THREE.DirectionalLight(0xffe5d8, 4.2);
key.position.set(-4, 6, 5);
scene.add(key);
const fill = new THREE.DirectionalLight(0x829cff, 2.2);
fill.position.set(5, 1, 2);
scene.add(fill);

const holder = new THREE.Group();
holder.position.set(0, -.10, 1.15);
holder.rotation.y = -.06;
scene.add(holder);
const floatingPillows = [];

new GLTFLoader().load(
  './assets/bed_comic.glb',
  gltf => {
    const bed = gltf.scene;
    // Convert the Z-up asset to Y-up so the bed lies horizontally in depth.
    bed.rotation.x = -Math.PI/2;
    bed.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(bed);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.z);
    const scale = .88 / Math.max(longest, 0.001);
    canvas.dataset.status = `model-loaded:size=${size.x.toFixed(2)},${size.y.toFixed(2)},${size.z.toFixed(2)}:scale=${scale.toFixed(3)}`;
    bed.scale.setScalar(scale);
    bed.position.set(-center.x*scale, -center.y*scale-.10, -center.z*scale);
    bed.traverse(node => {
      if (node.isMesh) {
        node.visible = true;
        node.frustumCulled = false;
        node.material.side = THREE.DoubleSide;
      }
    });
    // The comic GLB keeps each pillow, its outline, and its two seams as separate meshes.
    const parts = [...bed.children];
    [[10,18,31,32], [11,19,33,34], [12,20,35,36], [13,21,37,38]].forEach((indices, index) => {
      const pillow = parts[indices[0]];
      pillow.geometry.computeBoundingBox();
      const center = pillow.geometry.boundingBox.getCenter(new THREE.Vector3());
      const pivot = new THREE.Group();
      pivot.position.copy(center);
      bed.add(pivot);
      for (const partIndex of indices) {
        const part = parts[partIndex];
        part.position.sub(center);
        pivot.add(part);
      }
      floatingPillows.push({ pivot, center, phase: index*1.73 + .4, index });
    });
    holder.add(bed);
  },
  undefined,
  error => {
    canvas.dataset.status = `load-error:${error?.message || 'unknown'}`;
    console.error('Unable to load bed model', error);
  }
);

function resize() {
  const ratio = Math.min(devicePixelRatio, 1.5);
  const width = Math.round(innerWidth*ratio);
  const height = Math.round(innerHeight*ratio);
  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.setPixelRatio(ratio);
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
  }
}

function render() {
  resize();
  const syncedTime = globalThis.shaderTime ?? 0;
  const view = globalThis.viewAngles ?? { yaw: 0, pitch: 0, zoom: 1 };
  const cameraDistance = 4.4 / (view.zoom || 1);
  camera.position.set(-cameraDistance*Math.sin(view.yaw)*Math.cos(view.pitch),
                      -.08 + .5*Math.cos(view.pitch) - cameraDistance*Math.sin(view.pitch),
                      1.15 + cameraDistance*Math.cos(view.yaw)*Math.cos(view.pitch));
  camera.lookAt(0, -.08, 1.15);
  // Blend several non-matching rhythms so the bed drifts like it is nudged by passing air.
  const breeze = .68 + .32 * sinSafe(syncedTime*.31 + .8)**2;
  holder.position.z = 1.15 + sinSafe(syncedTime*.30)*.42;
  holder.position.y = -.10 + .022*sinSafe(syncedTime*.82 + .5);
  holder.rotation.y = -.06 + syncedTime*.30;
  const sideView = Math.sin(holder.rotation.y + view.yaw)**2;
  holder.scale.setScalar(1.12 - .16*sideView);
  holder.rotation.x = breeze * (.032*sinSafe(syncedTime*.86 + 1.1) + .014*sinSafe(syncedTime*1.73 + 2.9));
  holder.rotation.z = breeze * (.044*sinSafe(syncedTime*.67 + .4) + .017*sinSafe(syncedTime*1.49 + 2.2));
  for (const { pivot, center, phase, index } of floatingPillows) {
    const lift = .20 + index*.06
      + .09*sinSafe(syncedTime*(.68 + index*.07) + phase)
      + .035*sinSafe(syncedTime*(1.31 + index*.09) + phase*2.3);
    pivot.position.set(
      center.x + .055*sinSafe(syncedTime*.47 + phase),
      center.y + .045*sinSafe(syncedTime*.56 + phase*1.6),
      center.z + lift
    );
    pivot.rotation.set(
      .055*sinSafe(syncedTime*.63 + phase),
      .075*sinSafe(syncedTime*.49 + phase*1.4),
      .065*sinSafe(syncedTime*.72 + phase*1.9)
    );
  }
  if (!canvas.dataset.status.includes('loaded')) canvas.dataset.status += ':rendering';
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

function sinSafe(value) {
  return Math.sin(value);
}
render();
