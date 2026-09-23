/**
 * 頂点カラー付きのフラットシェーディング用ジオメトリを組み立てる小さなヘルパー。
 * ローポリ表現のため、面ごとに頂点を持たせ (非インデックス)、面法線を使う。
 */
import * as THREE from 'three';

const tmpColor = new THREE.Color();

export class GeometryBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  /** 三角形 (反時計回りが表) */
  tri(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    color: number | THREE.Color,
  ): void {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    const c = typeof color === 'number' ? tmpColor.setHex(color) : color;
    this.positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    for (let i = 0; i < 3; i++) {
      this.normals.push(nx, ny, nz);
      this.colors.push(c.r, c.g, c.b);
    }
  }

  /** 四角形 a-b-c-d (反時計回りが表) */
  quad(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    color: number | THREE.Color,
  ): void {
    this.tri(ax, ay, az, bx, by, bz, cx, cy, cz, color);
    this.tri(ax, ay, az, cx, cy, cz, dx, dy, dz, color);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** 色を明るく/暗くした hex を返す (factor > 1 で明るく) */
export function shade(hex: number, factor: number): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(factor);
}
