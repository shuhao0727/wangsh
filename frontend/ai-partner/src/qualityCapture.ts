import * as THREE from 'three';

// Audit-only adapter. Reads the actual classroom model; never substitutes geometry.
export function createQualityCapture(robot: THREE.Object3D) {
  const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const neutral = new THREE.MeshStandardMaterial({ color: '#808080', roughness: 1, metalness: 0 });
  return {
    setNeutral(enabled: boolean) {
      robot.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        if (enabled) {
          if (!originalMaterials.has(node)) originalMaterials.set(node, node.material);
          node.material = neutral;
        } else if (originalMaterials.has(node)) {
          node.material = originalMaterials.get(node)!;
        }
      });
      if (!enabled) originalMaterials.clear();
    },
    exportAudit() {
      robot.updateMatrixWorld(true);
      const parts: any[] = [], meshes: any[] = [];
      const positions: Record<string, number[]> = {};
      let unownedMeshes = 0, anonymousMeshes = 0, mappedTextures = 0;
      const owners = new Map<string, any>();
      robot.traverse(node => {
        const id = node.userData.sculptComponent?.id;
        if (!id) return;
        const parentId = node.parent?.userData.sculptComponent?.id ?? null;
        const record = { name: id, displayName: node.name, kind: 'part', parent: parentId,
          triangles: 0, meshes: [] as string[], pivot: node.position.toArray(),
          actionProfile: node.userData.actionProfile ?? null };
        owners.set(id, record);
        positions[id] = node.getWorldPosition(new THREE.Vector3()).toArray();
        parts.push(record);
      });
      robot.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        let owner: THREE.Object3D | null = node;
        while (owner && !owner.userData.sculptComponent?.id) owner = owner.parent;
        const id = owner?.userData.sculptComponent?.id ?? null;
        if (!id) unownedMeshes++;
        if (!node.name) anonymousMeshes++;
        const g = node.geometry, p = g.getAttribute('position'), n = g.getAttribute('normal');
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(node.matrixWorld);
        const vertices = [], normals = [];
        for (let i = 0; i < p.count; i++) {
          vertices.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(node.matrixWorld).toArray());
          if (n) normals.push(new THREE.Vector3().fromBufferAttribute(n, i).applyNormalMatrix(normalMatrix).toArray());
        }
        const indices = g.index ? Array.from(g.index.array) : Array.from({ length: p.count }, (_, i) => i);
        const label = node.name || `${id ?? 'unowned'}:mesh-${meshes.length}`;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) mappedTextures++;
        }
        meshes.push({ name: label, runtimeName: node.name, componentId: id, vertices, indices, normals,
          geometryType: g.type });
        if (id) { owners.get(id).triangles += indices.length / 3; owners.get(id).meshes.push(label); }
      });
      return { manifest: { model: robot.name, source: 'src/createClassroomRobot.ts', parts,
          unnamedMeshes: unownedMeshes, anonymousMeshNames: anonymousMeshes, integralMeshes: meshes.length },
        meshes, positions, runtime: {
          hasSculptRuntime: !!robot.userData.sculptRuntime,
          sculptRuntimeKeys: Object.keys(robot.userData.sculptRuntime ?? {}),
          actionReadiness: robot.userData.actionReadiness ?? null,
          neutralActive: originalMaterials.size > 0, mappedTextures,
        } };
    },
  };
}
