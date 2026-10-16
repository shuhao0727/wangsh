import 'virtual:wangsh-theme-tokens.css';
import * as THREE from 'three';
import {
  createAIClassmateEducationalRobotInspectControls,
  createAIClassmateEducationalRobotLookDevLights,
  frameAIClassmateEducationalRobotCamera,
  configureAIClassmateEducationalRobotRenderer,
} from './createObjectModel';
import { createClassroomRobot } from './createClassroomRobot';
import './style.css';
import { createQualityCapture } from './qualityCapture';
import { mountSelection } from './selection';

type ModuleKey = 'compute' | 'memory' | 'power' | 'perception' | 'cognition' | 'output' | 'action';
type ModuleInfo = { key: ModuleKey; label: string; short: string; description: string; evidence: string; parts: string[]; color: string };

const modules: ModuleInfo[] = [
  { key: 'compute', label: '算力', short: '处理器', description: '决定 AI 同学能多快地处理信息、运行模型。', evidence: '胸腔深蓝核心：用来表示处理器与计算单元。', parts: ['chest-core', 'chest-ring'], color: '#16d7c4' },
  { key: 'memory', label: '存储', short: '记忆', description: '保存资料、模型参数与学习过程中的信息。', evidence: '腹部舱体：用来表示长期存储与工作空间。', parts: ['abdomen'], color: '#8b9cff' },
  { key: 'power', label: '电力与安全', short: '能量', description: '为所有模块供电，也要控制温度、风险与边界。', evidence: '双脚底座与关节：用来表示稳定、供能和安全约束。', parts: ['left-foot', 'right-foot', 'left-foot-trim', 'right-foot-trim', 'left-hip', 'right-hip'], color: '#ffbd69' },
  { key: 'perception', label: '感知', short: '输入', description: '通过视觉、听觉等传感器获得外部信息。', evidence: '面部显示窗与双眼：用来表示接收和识别输入。', parts: ['head', 'visor', 'eye-lights', 'left-antenna', 'right-antenna', 'left-antenna-tip', 'right-antenna-tip', 'neck'], color: '#69b7ff' },
  { key: 'cognition', label: '认知', short: '理解', description: '把输入转化为理解、判断、规划和生成。', evidence: '头部与胸部的组合：认知不是单一零件，而是系统协作。', parts: ['head', 'chest-core', 'chest-ring'], color: '#d59aff' },
  { key: 'output', label: '表达', short: '输出', description: '把结果通过文字、语音、图像等方式表达出来。', evidence: '显示窗与眼部灯光：象征可见的输出界面。', parts: ['visor', 'eye-lights', 'chest-ring'], color: '#68e0ef' },
  { key: 'action', label: '行动', short: '执行', description: '把决定转化为动作，与环境发生真实交互。', evidence: '双臂、夹爪与双腿：象征从“会回答”到“能行动”。', parts: ['left-shoulder', 'right-shoulder', 'left-upper-arm', 'right-upper-arm', 'left-elbow', 'right-elbow', 'left-forearm', 'right-forearm', 'left-hand', 'right-hand', 'left-hip', 'right-hip', 'left-shin', 'right-shin'], color: '#ff7f9e' },
];

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">AI</div><div><strong>召唤一名“AI同学”</strong></div></div>
      <div class="top-actions"><button class="ghost-btn" id="reset-view">重置视角</button></div>
    </header>
    <nav class="journey-bar" aria-label="课堂流程">
      <div data-journey-step="1" data-journey-target="mission-block" tabindex="0" role="button"><span>01</span><strong>确定任务</strong></div>
      <i>→</i>
      <div data-journey-step="2" data-journey-target="configuration" tabindex="0" role="button"><span>02</span><strong>选择部件</strong></div>
      <i>→</i>
      <div data-journey-step="3" data-journey-target="test-bench" tabindex="0" role="button"><span>03</span><strong>测试方案</strong></div>
      <i>→</i>
      <div data-journey-step="4" data-journey-target="selection-reason-block" tabindex="0" role="button"><span>04</span><strong>说明取舍</strong></div>
      <p id="journey-summary">先从一个核心任务开始。</p>
    </nav>
    <main class="workspace">
      <aside class="left-panel">
        <div class="panel-kicker">DESIGN DECK</div>
        <h1>拼装一名<br><em>AI同学</em></h1>
        <p class="intro">点击模块，观察它在“AI人类”中的作用，再思考：少了它会怎样？</p>
        <div class="module-list" id="module-list"></div>
        <div class="legend"><span class="legend-swatch"></span><span>蓝绿色 = 当前选中模块</span></div>
      </aside>
      <section class="stage-panel">
        <div class="stage-head"><div><h2 id="stage-title">完整结构</h2></div><div class="stage-tools"><button class="tool-btn" id="explode-btn">拆分结构</button><button class="tool-btn" id="wire-btn">线框观察</button></div></div>
        <div class="canvas-wrap" id="canvas-wrap"><div class="canvas-hint"><span class="drag-icon">↻</span><span>拖动旋转 · 滚轮缩放 · 点击部件</span></div><div id="canvas"></div><div class="axis-label"><span>Y</span><i></i><span>X</span></div></div>
        <div class="stage-footer"><div><span class="mini-label">CURRENT BUILD</span><strong id="build-status">7 / 7 模块在线</strong></div><div class="progress"><i id="progress-bar"></i></div><div class="footer-note" id="footer-note">每个部件都在回答一个问题：它让 AI 更像“人类同学”了吗？</div></div>
      </section>
      <aside class="right-panel">
        <div class="inspector-head"><span class="eyebrow">INSPECTOR</span><span class="live-badge">LIVE</span></div>
        <div class="selected-card" id="selected-card"><div class="selected-icon" id="selected-icon">AI</div><div><h3 id="selected-title">完整的 AI 同学</h3><p id="selected-subtitle">选择左侧模块开始探究</p></div></div>
        <div class="info-block"><span class="block-label">它负责什么？</span><p id="selected-description">一名“AI同学”不是一个单独的模型，而是由多个模块协同完成任务。</p></div>
        <div class="info-block"><span class="block-label">在机器人上怎么看？</span><p id="selected-evidence">先观察外形，再追问：这个部件提供了什么能力？它的限制又是什么？</p></div>
        <div class="inspector-actions"><button class="primary-btn" id="focus-btn">聚焦模块</button><button class="secondary-btn" id="hide-btn">隐藏模块</button></div>
        <div class="challenge"><div class="challenge-title"><span>✦</span> 课堂挑战</div><p id="challenge-text">如果只能保留三个模块，你会保留哪三个？为什么？</p><button class="text-btn" id="next-question">换一个问题 →</button></div>
        <div class="note"><span class="note-dot"></span><span>模型说明：本模型是课堂教学用程序化三维示意，不代表真实机器人内部结构。</span></div>
      </aside>
    </main>
  </div>`;

const moduleList = document.querySelector<HTMLDivElement>('#module-list')!;
let selected: ModuleKey | null = null;
let exploded = false;
let wireframe = false;
const hiddenModules = new Set<ModuleKey>();
const challengeQuestions = ['如果只能保留三个模块，你会保留哪三个？为什么？','算力越强，AI就一定越聪明吗？','没有存储的 AI 同学，能持续学习吗？','感知、认知、行动之间，哪一步最容易出错？','如果 AI 会行动，谁来为它的行为负责？'];
let questionIndex = 0;

for (const module of modules) {
  const item = document.createElement('button');
  item.className = 'module-item';
  item.dataset.key = module.key;
  item.innerHTML = `<span class="module-index">${String(modules.indexOf(module) + 1).padStart(2, '0')}</span><span class="module-copy"><strong>${module.label}</strong><small>${module.short}</small></span><span class="module-arrow">↗</span>`;
  item.addEventListener('click', () => selectModule(module.key));
  moduleList.appendChild(item);
}

const wrap = document.querySelector<HTMLDivElement>('#canvas-wrap')!;
const canvasHost = document.querySelector<HTMLDivElement>('#canvas')!;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f2f5f4');
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
configureAIClassmateEducationalRobotRenderer(renderer);
canvasHost.appendChild(renderer.domElement);
const controls = createAIClassmateEducationalRobotInspectControls(camera, renderer.domElement);
controls.maxDistance = 40;
controls.target.set(0, 2.8, 0);
const world = new THREE.Group();
scene.add(world);
const robot = createClassroomRobot({ castShadow: true, receiveShadow: true });
robot.position.y = 0.0;
world.add(robot);
const lights = createAIClassmateEducationalRobotLookDevLights();
scene.add(lights);
const floor = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64), new THREE.MeshStandardMaterial({ color: '#dfe9e6', roughness: 0.92 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.25;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(7, 14, '#c8d6d2', '#e0e9e7');
grid.position.y = -1.24;
scene.add(grid);

const nodes = new Map<string, THREE.Object3D>();
robot.traverse((node) => {
  const component = node.userData?.sculptComponent;
  if (component?.id) nodes.set(component.id, node);
  node.traverse((child) => { if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; } });
});
const original = new Map<string, { position: THREE.Vector3; rotation: THREE.Euler; visible: boolean }>();
for (const [id, node] of nodes) original.set(id, { position: node.position.clone(), rotation: node.rotation.clone(), visible: node.visible });

function size() { const rect = wrap.getBoundingClientRect(); renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); frameAIClassmateEducationalRobotCamera(camera, robot, { margin: 1.22, azimuthDeg: 0, elevationDeg: 2 }); const frameBox = new THREE.Box3().setFromObject(robot); controls.target.copy(frameBox.getCenter(new THREE.Vector3())); controls.update(); }
function setEmissive() { robot.traverse((node) => { if (!(node instanceof THREE.Mesh)) return; const material = node.material as THREE.MeshPhysicalMaterial; if (material?.color?.getHexString() === '57e8fa' || material?.color?.getHexString() === '20b3d3') { material.emissive = new THREE.Color('#39e6ee'); material.emissiveIntensity = 2.2; } }); }
setEmissive();

function moduleByKey(key: ModuleKey | null) { return modules.find((m) => m.key === key); }
function updateHideButton() { (document.querySelector('#hide-btn') as HTMLButtonElement).textContent = selected && hiddenModules.has(selected) ? '显示模块' : '隐藏模块'; }
function updateButtons() { document.querySelectorAll<HTMLButtonElement>('.module-item').forEach((item) => item.classList.toggle('active', item.dataset.key === selected)); }
function clearHighlight() { robot.traverse((node) => { const mesh = node as THREE.Mesh; if (!mesh.isMesh) return; const mat = mesh.material as THREE.MeshPhysicalMaterial; if (mat.userData.__baseEmissive) { mat.emissive.copy(mat.userData.__baseEmissive); mat.emissiveIntensity = mat.userData.__baseEmissiveIntensity; } mesh.userData.__highlighted = false; }); }
function highlight(parts: string[]) {
  clearHighlight();
  for (const id of parts) {
    const node = nodes.get(id);
    if (!node) continue;
    node.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      // Composite modules can include both a parent and its child. Keep the
      // first saved material state so repeated traversal never saves a
      // previous highlight as the new baseline.
      if (!mat.userData.__baseEmissive) {
        mat.userData.__baseEmissive = (mat.emissive ?? new THREE.Color('#000000')).clone();
        mat.userData.__baseEmissiveIntensity = mat.emissiveIntensity ?? 0;
      }
      mat.emissive = new THREE.Color('#12d9c4');
      mat.emissiveIntensity = 0.7;
      mesh.userData.__highlighted = true;
    });
  }
}
function selectModule(key: ModuleKey | null) { selected = key; const info = moduleByKey(key); updateButtons(); updateHideButton(); if (!info) { clearHighlight(); document.querySelector('#stage-title')!.textContent = '完整结构'; document.querySelector('#selected-title')!.textContent = '完整的 AI 同学'; document.querySelector('#selected-subtitle')!.textContent = '选择左侧模块开始探究'; document.querySelector('#selected-description')!.textContent = '一名“AI同学”不是一个单独的模型，而是由多个模块协同完成任务。'; document.querySelector('#selected-evidence')!.textContent = '先观察外形，再追问：这个部件提供了什么能力？它的限制又是什么？'; (document.querySelector('#selected-icon') as HTMLElement).style.background = 'linear-gradient(135deg,#16d7c4,#103943)'; document.querySelector('#selected-icon')!.textContent = 'AI'; return; } highlight(info.parts); document.querySelector('#stage-title')!.textContent = info.label; document.querySelector('#selected-title')!.textContent = info.label; document.querySelector('#selected-subtitle')!.textContent = info.short; document.querySelector('#selected-description')!.textContent = info.description; document.querySelector('#selected-evidence')!.textContent = info.evidence; (document.querySelector('#selected-icon') as HTMLElement).style.background = `linear-gradient(135deg, ${info.color}, #122c3c)`; document.querySelector('#selected-icon')!.textContent = info.label.slice(0, 1); }
function restore() {
  for (const [id, node] of nodes) {
    const base = original.get(id)!;
    node.position.copy(base.position);
    node.rotation.copy(base.rotation);
    const hiddenByModule = [...hiddenModules].some((key) => moduleByKey(key)?.parts.includes(id));
    node.visible = base.visible && !hiddenByModule;
  }
}

function setExploded(next: boolean) {
  exploded = next;
  restore();
  if (next) {
    const offsets: Record<string, THREE.Vector3> = {
      head: new THREE.Vector3(0, 0.28, 0.22),
      abdomen: new THREE.Vector3(0, -0.16, 0.18),
      'left-shoulder': new THREE.Vector3(-0.2, 0, 0.12),
      'right-shoulder': new THREE.Vector3(0.2, 0, 0.12),
      'left-hip': new THREE.Vector3(-0.14, -0.14, 0.1),
      'right-hip': new THREE.Vector3(0.14, -0.14, 0.1),
    };
    for (const [id, offset] of Object.entries(offsets)) {
      const node = nodes.get(id);
      const base = original.get(id);
      if (node && base) node.position.copy(base.position).add(offset);
    }
  }
  (document.querySelector('#explode-btn') as HTMLButtonElement).textContent = next ? '收拢结构' : '拆分结构';
}
function focusSelected() {
  const info = moduleByKey(selected);
  if (!info) { size(); return; }
  const target = new THREE.Box3();
  for (const id of info.parts) {
    const node = nodes.get(id);
    if (node) target.expandByObject(node);
  }
  if (target.isEmpty()) return;
  const center = target.getCenter(new THREE.Vector3());
  const boxSize = target.getSize(new THREE.Vector3());
  // Fit both the vertical and horizontal extent so a focused module remains
  // fully visible on the classroom canvas instead of being cropped at the sides.
  const halfFovY = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const halfFovX = Math.atan(Math.tan(halfFovY) * Math.max(camera.aspect, 0.1));
  const distanceY = (boxSize.y * 0.5) / Math.tan(halfFovY);
  const distanceX = (boxSize.x * 0.5) / Math.tan(halfFovX);
  const depthAllowance = boxSize.z * 0.75;
  const distance = Math.max(4.8, distanceY, distanceX, depthAllowance) * 1.28;
  camera.position.copy(center).add(new THREE.Vector3(0, 0.08, distance));
  camera.near = Math.max(0.01, distance - Math.max(boxSize.z * 2.5, 1.5));
  camera.far = distance + Math.max(boxSize.x, boxSize.y, boxSize.z) * 6;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  controls.minDistance = Math.max(0.4, distance * 0.35);
  controls.maxDistance = Math.max(40, distance * 8);
  controls.target.copy(center);
  controls.update();
}
function setHidden() {
  if (!selected) return;
  const shouldHide = !hiddenModules.has(selected);
  if (shouldHide) hiddenModules.add(selected);
  else hiddenModules.delete(selected);
  restore();
  (document.querySelector('#hide-btn') as HTMLButtonElement).textContent = shouldHide ? '显示模块' : '隐藏模块';
  updateStatus();
}
function updateStatus() { const visible = modules.filter((m) => m.parts.some((id) => { const n = nodes.get(id); return n?.visible; })).length; document.querySelector('#build-status')!.textContent = `${visible} / 7 模块在线`; (document.querySelector('#progress-bar') as HTMLElement).style.width = `${Math.max(12, visible / 7 * 100)}%`; }
function toggleWire() { wireframe = !wireframe; robot.traverse((node) => { if (node instanceof THREE.Mesh) { const mat = node.material as THREE.MeshPhysicalMaterial; mat.wireframe = wireframe; } }); (document.querySelector('#wire-btn') as HTMLButtonElement).textContent = wireframe ? '关闭线框' : '线框观察'; }

renderer.domElement.addEventListener('pointerdown', (event) => { const rect = renderer.domElement.getBoundingClientRect(); const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(pointer, camera); const hits = raycaster.intersectObject(robot, true); const hit = hits.find((item) => item.object.userData?.sculptComponent || item.object.parent?.userData?.sculptComponent); if (!hit) return; let node: THREE.Object3D | null = hit.object; while (node && !node.userData?.sculptComponent) node = node.parent; const id = node?.userData?.sculptComponent?.id as string | undefined; if (!id) return; const mapping = modules.find((m) => m.parts.includes(id)); if (mapping) selectModule(mapping.key); });

document.querySelector('#explode-btn')!.addEventListener('click', () => setExploded(!exploded));
document.querySelector('#wire-btn')!.addEventListener('click', toggleWire);
document.querySelector('#reset-view')!.addEventListener('click', () => {
  selected = null;
  hiddenModules.clear();
  exploded = false;
  restore();
  selectModule(null);
  size();
  (document.querySelector('#explode-btn') as HTMLButtonElement).textContent = '拆分结构';
  (document.querySelector('#hide-btn') as HTMLButtonElement).textContent = '隐藏模块';
  if (wireframe) toggleWire();
  updateStatus();
});
document.querySelector('#focus-btn')!.addEventListener('click', focusSelected);
document.querySelector('#hide-btn')!.addEventListener('click', setHidden);
document.querySelector('#next-question')!.addEventListener('click', () => { questionIndex = (questionIndex + 1) % challengeQuestions.length; document.querySelector('#challenge-text')!.textContent = challengeQuestions[questionIndex]; });
mountSelection(selectModule);
// Panel expansion and selection feedback can resize the viewport without a
// window resize. Keep the current orbit instead of reframing the model.
new ResizeObserver(() => {
  const rect = wrap.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}).observe(wrap);
window.addEventListener('resize', size); size(); updateStatus();

// img2threejs render-bridge contract: the quality pipeline drives the same
// classroom model that students see, rather than a replacement scene.
type CaptureCameraSpec = { azimuthDeg?: number; elevationDeg?: number; distance?: number; target?: [number, number, number] };
const qualityCapture = createQualityCapture(robot);
type CaptureApi = ReturnType<typeof createQualityCapture> & { setCamera: (spec: CaptureCameraSpec) => Promise<void>; setCaptureMode: (enabled: boolean) => void };
(window as typeof window & { __IMG2THREEJS_READY__?: boolean; __IMG2THREEJS_CAPTURE__?: CaptureApi }).__IMG2THREEJS_CAPTURE__ = {
  ...qualityCapture,
  setCaptureMode(enabled) {
    floor.visible = !enabled;
    grid.visible = !enabled;
    document.querySelector<HTMLElement>('.canvas-hint')?.style.setProperty('display', enabled ? 'none' : 'flex');
    document.querySelector<HTMLElement>('.axis-label')?.style.setProperty('display', enabled ? 'none' : 'flex');
  },
  async setCamera(spec) {
    const box = new THREE.Box3().setFromObject(robot);
    const defaultTarget = box.getCenter(new THREE.Vector3());
    const target = new THREE.Vector3(...(spec.target ?? [defaultTarget.x, defaultTarget.y, defaultTarget.z]));
    const distance = Math.max(4.8, spec.distance ?? 9.2);
    const azimuth = THREE.MathUtils.degToRad(spec.azimuthDeg ?? 0);
    const elevation = THREE.MathUtils.degToRad(spec.elevationDeg ?? 2);
    const horizontal = Math.cos(elevation) * distance;
    camera.position.set(
      target.x + Math.sin(azimuth) * horizontal,
      target.y + Math.sin(elevation) * distance,
      target.z + Math.cos(azimuth) * horizontal,
    );
    camera.near = 0.01;
    camera.far = 100;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    controls.target.copy(target);
    controls.update();
  },
};
(window as typeof window & { __IMG2THREEJS_READY__?: boolean }).__IMG2THREEJS_READY__ = true;
function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
animate();
