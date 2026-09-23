/**
 * 車両への操作入力。人間プレイヤー (キーボード) も NPC も同じ形式で車を操作する。
 */
export interface VehicleControls {
  /** アクセル 0..1 */
  throttle: number;
  /** ブレーキ / 後退 0..1 */
  brake: number;
  /** ステアリング -1 (左) .. 1 (右) */
  steer: number;
  /** ドリフトキー */
  drift: boolean;
}

export function createControls(): VehicleControls {
  return { throttle: 0, brake: 0, steer: 0, drift: false };
}

export function resetControls(c: VehicleControls): void {
  c.throttle = 0;
  c.brake = 0;
  c.steer = 0;
  c.drift = false;
}
