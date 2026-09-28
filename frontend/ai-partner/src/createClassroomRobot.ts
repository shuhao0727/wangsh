import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type ClassroomRobotOptions = { castShadow?: boolean; receiveShadow?: boolean };

const shell = new THREE.MeshPhysicalMaterial({ color: '#f2eee5', roughness: 0.48, clearcoat: 0.18, clearcoatRoughness: 0.38 });
const shellDark = new THREE.MeshPhysicalMaterial({ color: '#d8d5cf', roughness: 0.62 });
const navy = new THREE.MeshPhysicalMaterial({ color: '#1b2c46', roughness: 0.42, clearcoat: 0.16 });
const navyDark = new THREE.MeshPhysicalMaterial({ color: '#0f1b2c', roughness: 0.5 });
const joint = new THREE.MeshPhysicalMaterial({ color: '#2d4361', roughness: 0.32, metalness: 0.08 });
const cyan = new THREE.MeshPhysicalMaterial({ color: '#63e9f1', emissive: '#2dd8e5', emissiveIntensity: 2.6, roughness: 0.2 });
const cyanDim = new THREE.MeshPhysicalMaterial({ color: '#1b8c9c', emissive: '#0d6475', emissiveIntensity: 1.2, roughness: 0.3 });
const rubber = new THREE.MeshPhysicalMaterial({ color: '#101b2c', roughness: 0.72 });

function rounded(size: [number, number, number], radius = 0.14): THREE.Mesh {
  return new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 5, radius), shell);
}
function box(size: [number, number, number], material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 4, Math.min(size[0], size[1], size[2]) * 0.18), material);
}
function sphere(radius: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), material);
}
function capsule(radius: number, length: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new RoundedBoxGeometry(radius * 2.1, length + radius * 1.3, radius * 1.8, 4, radius * 0.7), material);
}
function cylinder(radius: number, height: number, material: THREE.Material, radial = 32): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, radial), material);
}
function torus(radius: number, tube: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 16, 48), material);
}

/**
 * Create a semantic pivot and place its geometry below that pivot.
 * `position` is always local to `parent`; this keeps the hierarchy usable for
 * explode, focus, visibility, and future animation interactions.
 */
function part(parent: THREE.Group, id: string, name: string, position: [number, number, number], mesh: THREE.Object3D): THREE.Group {
  const node = new THREE.Group();
  node.name = `${name}__pivot`;
  node.position.set(...position);
  node.userData.sculptComponent = { id, name, role: id, level: 'macro' };
  node.userData.actionProfile = {
    animationRole: id,
    pivot: { mode: 'semantic-root', axis: [0, 1, 0] },
  };
  parent.add(node);
  node.add(mesh);
  return node;
}

function finish(node: THREE.Object3D, options: ClassroomRobotOptions) {
  node.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = options.castShadow ?? true;
      child.receiveShadow = options.receiveShadow ?? true;
      // Give each visible mesh its own material instance so classroom highlighting
      // affects only the selected component, not every part sharing a palette entry.
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => material.clone())
        : child.material.clone();
      child.geometry.computeVertexNormals();
    }
  });
}

export function createClassroomRobot(options: ClassroomRobotOptions = {}): THREE.Group {
  // The outer group is the renderer-facing container. The inner root pivot is
  // the actual assembly root so every visible component belongs to one tree.
  const root = new THREE.Group();
  root.name = 'AI同学·课堂三维示意模型';
  root.userData.actionReadiness = { note: '课堂教学用程序化三维示意，不代表真实机器人内部结构。' };

  const assemblyRoot = part(root, 'root', 'AI同学整体', [0, 0, 0], new THREE.Group());

  // Body: all positions below are local to the torso pivot.
  const torso = part(assemblyRoot, 'torso', '胸腔·系统主板', [0, 3.05, 0], box([1.75, 1.75, 1.02], navy));
  part(torso, 'chest-core', '胸部核心·处理器', [0, 0.13, 0.55], cylinder(0.28, 0.13, navyDark)).rotation.x = Math.PI / 2;
  part(torso, 'chest-ring', '胸部状态环', [0, 0.13, 0.64], torus(0.38, 0.07, cyan));
  part(torso, 'abdomen', '腹部舱体·存储', [0, -1.03, 0], new THREE.Mesh(new THREE.SphereGeometry(0.82, 36, 24), navy)).scale.set(1.02, 0.72, 0.82);

  // Neck → head → face/sensors: each child uses a local offset from its parent.
  const neck = part(torso, 'neck', '颈部连接', [0, 1.07, 0], cylinder(0.28, 0.34, navyDark));
  const head = part(neck, 'head', '头部·感知与认知', [0, 0.76, 0], rounded([2.15, 1.35, 1.06], 0.22));
  part(head, 'visor', '面部显示窗·表达', [0, 0, 0.55], box([1.44, 0.68, 0.08], navyDark));

  // Keep one semantic eye-lights node and place both eye meshes under it.
  const eyeLights = part(head, 'eye-lights', '双眼发光模块', [0, 0.02, 0.61], new THREE.Group());
  for (const x of [-0.32, 0.32]) {
    const eye = box([0.16, 0.3, 0.035], cyan);
    eye.position.set(x, 0, 0);
    eyeLights.add(eye);
  }

  for (const side of [-1, 1]) {
    const s = side < 0 ? 'left' : 'right';
    const x = side * 0.6;
    const antenna = part(head, `${s}-antenna`, '天线·感知', [x, 0.84, 0], cylinder(0.055, 0.45, navyDark, 16));
    part(antenna, `${s}-antenna-tip`, '天线端头', [0, 0.26, 0], sphere(0.15, cyanDim));
  }

  // Arms: shoulder → upper arm → elbow → forearm → hand.
  for (const side of [-1, 1]) {
    const s = side < 0 ? 'left' : 'right';
    const x = side * 1.16;
    const shoulder = part(torso, `${s}-shoulder`, `${s === 'left' ? '左' : '右'}肩·关节`, [x, 0.49, 0], sphere(0.3, shell));
    const upper = part(shoulder, `${s}-upper-arm`, `${s === 'left' ? '左' : '右'}上臂`, [side * 0.0812, -0.49, 0], rounded([0.48, 0.76, 0.54], 0.12));
    const elbow = part(upper, `${s}-elbow`, `${s === 'left' ? '左' : '右'}肘·关节`, [side * 0.0348, -0.5, 0], sphere(0.22, joint));
    const fore = part(elbow, `${s}-forearm`, `${s === 'left' ? '左' : '右'}前臂`, [0, -0.49, 0], rounded([0.46, 0.74, 0.5], 0.12));
    const hand = part(fore, `${s}-hand`, `${s === 'left' ? '左' : '右'}夹爪·行动`, [0, -0.58, 0], new THREE.Group());
    hand.add(sphere(0.2, joint));
    for (const dx of [-0.12, 0.12]) {
      const claw = capsule(0.075, 0.28, shellDark);
      claw.rotation.z = side * 0.34;
      claw.position.set(dx, -0.14, 0.08);
      hand.add(claw);
    }
    shoulder.userData.mount = 'arm';
    upper.userData.mount = 'arm';
    elbow.userData.mount = 'arm';
    fore.userData.mount = 'arm';

    // Legs: hip → shin → foot → foot trim.
    const hip = part(torso, `${s}-hip`, `${s === 'left' ? '左' : '右'}髋·关节`, [side * 0.48, -1.7, 0], sphere(0.27, joint));
    const shin = part(hip, `${s}-shin`, `${s === 'left' ? '左' : '右'}小腿·行动`, [0, -0.57, 0], rounded([0.58, 0.9, 0.68], 0.13));
    const foot = part(shin, `${s}-foot`, `${s === 'left' ? '左' : '右'}脚·稳定`, [0, -0.62, 0.13], rounded([0.82, 0.34, 1.16], 0.12));
    part(foot, `${s}-foot-trim`, `${s === 'left' ? '左' : '右'}脚底安全边`, [0, -0.14, 0.03], box([0.85, 0.12, 1.12], rubber));
  }

  // Back-facing status indicator, now attached to the torso so it follows the body.
  const status = new THREE.Mesh(new THREE.CircleGeometry(0.08, 20), cyanDim);
  status.position.set(0, 0.5, -0.53);
  status.rotation.y = Math.PI;
  torso.add(status);

  finish(root, options);
  return root;
}
