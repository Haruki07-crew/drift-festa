/**
 * キー割り当て (DriveBindings) を車両操作 (VehicleControls) に変換する。
 */
import type { DriveBindings } from '../config/controls';
import type { VehicleControls } from '../vehicles/VehicleControls';
import type { InputManager } from './InputManager';

export class PlayerController {
  /** ポーズ中に設定画面でキー設定を変えた時は差し替える */
  bindings: DriveBindings;
  private readonly input: InputManager;

  constructor(input: InputManager, bindings: DriveBindings) {
    this.input = input;
    this.bindings = bindings;
  }

  read(out: VehicleControls): void {
    const i = this.input;
    const b = this.bindings;
    out.throttle = i.anyDown(b.forward) ? 1 : 0;
    out.brake = i.anyDown(b.reverse) ? 1 : 0;
    const right = i.anyDown(b.right) ? 1 : 0;
    const left = i.anyDown(b.left) ? 1 : 0;
    out.steer = right - left;
    out.drift = i.anyDown(b.drift);
  }
}
