// config.js — semua konstanta tuning THE GILDED VAULT di satu tempat.
// Ubah angka di sini saja bila menyeimbangkan permainan; tidak ada angka
// ajaib yang tersebar di file lain.
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const VIEW_W = COLS * TILE; // 1280
export const VIEW_H = ROWS * TILE; // 720

export const PLAYER_RADIUS = 13; // radius gambar
export const PLAYER_COLLISION_RADIUS = 11; // radius tabrakan: lebih kecil dari
// gambar agar pemain bisa meluncur melewati sudut cover, bukan terjepit.
export const WALK_SPEED = 205; // px/detik
export const SNEAK_SPEED = 118; // px/detik (Shift)
export const GRAB_RANGE = 52; // px dari pedestal/loot
export const EXIT_RADIUS = 30; // px dari pusat pintu vault

export const GUARD_COUNT = 3;
export const GUARD_SPEED_PATROL = 62;
export const GUARD_SPEED_SUSPICIOUS = 96;
export const GUARD_SPEED_ALERT = 190;
export const GUARD_CONE_RANGE = 265;
export const GUARD_CONE_FOV = (72 * Math.PI) / 180;
export const GUARD_CONE_RAYS = 26;
export const GUARD_CATCH_RANGE = 30; // px: guard menyentuh pemain saat lockdown

export const CAMERA_COUNT = 2;
export const CAMERA_CONE_RANGE = 305;
export const CAMERA_CONE_FOV = (56 * Math.PI) / 180;
export const CAMERA_CONE_RAYS = 22;
export const EMP_DISABLE_SECONDS = 10;

export const ALARM_MAX = 100;
export const ALARM_SUSPICIOUS_AT = 50; // guard mulai menyelidiki
export const ALARM_RISE_LIGHT = 62; // per detik terlihat di terang
export const ALARM_RISE_SHADOW = 22; // per detik terlihat di atas rug
export const ALARM_RISE_CAMERA_LIGHT = 72;
export const ALARM_RISE_CAMERA_SHADOW = 30;
export const ALARM_SNEAK_FACTOR = 0.55;
export const ALARM_CAMERA_SNEAK_FACTOR = 0.6;
export const ALARM_FALL = 32; // per detik saat tersembunyi
export const ALARM_AFTER_CAUGHT = 30; // alarm direset ke sini setelah tertangkap
export const ALARM_AFTER_LOCKDOWN = 45; // alarm turun ke sini bila lockdown berakhir tanpa tangkapan
export const LOCKDOWN_SECONDS = 5;

export const NERVES_START = 3;

export const TOOL_EMP_CHARGES = 2;
export const TOOL_NOISE_CHARGES = 3;
export const TOOL_EMP_ALARM_COST = 12; // EMP memicu sensor: alarm naik
export const TOOL_NOISE_ALARM_COST = 6; // noisemaker terdengar di panel alarm
export const NOISE_LURE_RADIUS = 330; // guard dalam radius ini menyelidiki
export const NOISE_INVESTIGATE_SECONDS = 4;
export const NOISE_THROW_RANGE = 430; // sejauh ini lemparan bisa diarahkan

export const LOOT_SUNSTAR_VALUE = 50000;
export const LOOT_GOLD_VALUE = 8000;
export const LOOT_EMERALD_VALUE = 12000;

// Palet art-deco: emas di atas malam teal. Safe = teal/emas, bahaya = merah,
// loot = emas berkilau. Kode warna ini konsisten di seluruh render.
export const PALETTE = {
  floorA: '#16242b',
  floorB: '#122028',
  floorLine: '#0d181d',
  rug: '#3d1620',
  rugTrim: '#8a6a2f',
  wall: '#0a1216',
  wallTrim: '#8a6a2f',
  coverGlass: '#2b4a55',
  coverFrame: '#c9a227',
  coverBase: '#1c2f38',
  statue: '#7d8a94',
  safe: '#3a4a52',
  safeDial: '#c9a227',
  gold: '#e8b93c',
  goldBright: '#ffd94d',
  emerald: '#37c978',
  alarmLow: '#37c978',
  alarmMid: '#e8b93c',
  alarmHigh: '#e5484d',
  coneGuard: 'rgba(232, 185, 60, 0.20)',
  coneGuardAlert: 'rgba(229, 72, 77, 0.30)',
  coneCamera: 'rgba(229, 72, 77, 0.22)',
  darkness: 'rgba(3, 6, 12, 0.42)',
  hudBg: 'rgba(6, 10, 16, 0.85)',
  hudText: '#e8e0c8',
  hudDim: '#9aa78f',
  playerCoat: '#232a38',
  playerScarf: '#a83240',
  guardUniform: '#2c4a6b',
  guardCap: '#1d3247',
};

export const GAME_NAME = 'THE GILDED VAULT';
export const THIEF_NAME = 'Marlow Quinn';
export const TARGET_NAME = 'Sunstar Diamond';
export const OWNER_NAME = 'Aldous Vane';
