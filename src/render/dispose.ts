/**
 * Three.js リソースの解放ユーティリティ。
 * 文化祭で何十レースも連続で遊ぶため、レース終了時に Geometry / Material / Texture を確実に破棄する。
 */
import * as THREE from 'three';

/** Object3D 以下の Geometry / Material / Texture をすべて解放し、親から外す */
export function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as Partial<THREE.Mesh>;
    if (mesh.geometry instanceof THREE.BufferGeometry) {
      geometries.add(mesh.geometry);
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      for (const m of mat) materials.add(m);
    } else if (mat instanceof THREE.Material) {
      materials.add(mat);
    }
    if (obj instanceof THREE.InstancedMesh) {
      obj.dispose();
    }
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) disposeMaterial(m);
  root.removeFromParent();
}

export function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  }
  material.dispose();
}

/**
 * 生成したリソースを登録しておき、まとめて解放するための入れ物。
 * シーンに追加されない共有ジオメトリ等もここへ登録する。
 */
export class ResourceBag {
  private readonly disposables = new Set<{ dispose(): void }>();

  add<T extends { dispose(): void }>(resource: T): T {
    this.disposables.add(resource);
    return resource;
  }

  dispose(): void {
    for (const d of this.disposables) {
      if (d instanceof THREE.Material) disposeMaterial(d);
      else d.dispose();
    }
    this.disposables.clear();
  }
}
