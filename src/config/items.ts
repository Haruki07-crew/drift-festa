/**
 * アイテム設定 (BATTLE DUEL)。
 */

export type ItemKind = 'recovery' | 'boost' | 'gun';

export interface ItemDef {
  kind: ItemKind;
  name: string;
  description: string;
  /** HUD 表示用の短いラベル / アイコン文字 */
  icon: string;
  color: string;
}

export const ITEM_DEFS: Record<ItemKind, ItemDef> = {
  recovery: {
    kind: 'recovery',
    name: 'Recovery',
    description: 'タイヤHPを100まで完全回復',
    icon: '✚',
    color: '#3ddc84',
  },
  boost: {
    kind: 'boost',
    name: 'Boost',
    description: '8秒間 最高速度+20% / 弾速+40%',
    icon: '⚡',
    color: '#ffb300',
  },
  gun: {
    kind: 'gun',
    name: 'Gun',
    description: '銃 + 弾丸10発',
    icon: '🔫',
    color: '#ff4d6d',
  },
};

export const itemsConfig = {
  /** 最大所持数 (仕様: 3) */
  maxInventory: 3,

  /** 抽選の重み (同じ値 = 同確率。仕様: 各 1/3) */
  dropWeights: {
    recovery: 1,
    boost: 1,
    gun: 1,
  } satisfies Record<ItemKind, number>,

  /** BATTLE DUEL 開始時の所持アイテム (仕様: Recovery を1つ) */
  startingItems: ['recovery'] as ItemKind[],

  boost: {
    /** 効果時間 [s] (再使用で残り時間をこの値へ戻す。重ね掛けなし) */
    durationSeconds: 8,
    maxSpeedMultiplier: 1.2,
    bulletSpeedMultiplier: 1.4,
    /** 加速の倍率 (仕様では最高速度のみ。1.0 = 変更なし) */
    accelMultiplier: 1.0,
  },

  gun: {
    /** Gun アイテム1つあたりの弾数 (仕様: 10発) */
    ammoPerPickup: 10,
    /** 弾切れの Gun スロットを自動で消してインベントリを空ける */
    removeWhenEmpty: true,
  },

  itemBox: {
    /** 取得後の再出現時間 [s] (仕様: 8秒) */
    respawnSeconds: 8,
    /** 取得判定の半径 [m] */
    pickupRadius: 2.4,
    /** 見た目のサイズ [m] */
    size: 1.5,
    /** 回転速度 [rad/s] */
    spinSpeed: 1.6,
  },
};
