// world.js — mesin permainan: state title/playing/paused/caught/win/gameover,
// alarm meter, lockdown, tangkapan yang adil (respawn, bukan insta-lose),
// ambil loot, dan kemenangan. Satu-satunya file yang menggabungkan player,
// guard, kamera, dan audio menjadi satu update(dt).
import {
  ALARM_MAX,
  ALARM_SUSPICIOUS_AT,
  ALARM_RISE_LIGHT,
  ALARM_RISE_SHADOW,
  ALARM_RISE_CAMERA_LIGHT,
  ALARM_RISE_CAMERA_SHADOW,
  ALARM_SNEAK_FACTOR,
  ALARM_CAMERA_SNEAK_FACTOR,
  ALARM_FALL,
  ALARM_AFTER_CAUGHT,
  ALARM_AFTER_LOCKDOWN,
  LOCKDOWN_SECONDS,
  NERVES_START,
  GUARD_CATCH_RANGE,
  EXIT_RADIUS,
  NOISE_LURE_RADIUS,
  NOISE_INVESTIGATE_SECONDS,
  LOOT_SUNSTAR_VALUE,
} from './config.js';
import { parseLevel, tileCenter, isShadowTile, GUARD_PATROLS, CAMERA_DEFS } from './level.js';
import { createPlayer, resetPlayerToStart, stepPlayer, grabLoot, useEmp, throwNoisemaker } from './player.js';
import { createGuards, stepGuard, guardSeesPlayer, resetGuards } from './guards.js';
import { createCameras, stepCamera, cameraSeesPlayer, cameraIsOffline, disableCamera } from './cameras.js';
import { createAudioEngine } from './audio.js';

export function createWorld() {
  const level = parseLevel();
  const world = {
    level,
    player: createPlayer(level),
    guards: createGuards(level, GUARD_PATROLS),
    cameras: createCameras(CAMERA_DEFS),
    audio: createAudioEngine(),
    phase: 'title', // title | playing | paused | caught | win | gameover
    time: 0, // detik sejak permainan dimulai (tidak jalan di title)
    alarm: 0, // 0..100
    alarmPeak: 0,
    lockdown: 0, // detik tersisa lockdown; 0 = tidak lockdown
    nerves: NERVES_START,
    caughtCount: 0,
    lootValue: 0,
    sunstarTaken: false,
    winTime: 0,
    winRating: '',
    caughtTimer: 0, // jeda panel CAUGHT sebelum respawn
    panelTimer: 0,
    guardStepAcc: 0,
    lastGuardStepAt: 0,
    startedAt: 0,
    onGuardSuspicious(guard) {
      this.audio.suspiciousBlip();
    },
    startGame() {
      this.phase = 'playing';
      this.time = 0;
      this.alarm = 0;
      this.alarmPeak = 0;
      this.lockdown = 0;
      this.nerves = NERVES_START;
      this.caughtCount = 0;
      this.lootValue = 0;
      this.sunstarTaken = false;
      this.winTime = 0;
      this.winRating = '';
      for (const item of Object.values(this.level.loot)) item.taken = false;
      resetPlayerToStart(this.player, this.level);
      resetGuards(this.guards, this.level, GUARD_PATROLS);
      this.cameras = createCameras(CAMERA_DEFS);
      this.audio.ensure();
      this.audio.startDrone();
    },
    raiseAlarm(amount) {
      this.alarm = Math.min(ALARM_MAX, this.alarm + amount);
      if (this.alarm > this.alarmPeak) this.alarmPeak = this.alarm;
    },
    disableAllCameras() {
      for (const cam of this.cameras) disableCamera(cam, this.time);
      this.audio.empZap();
    },
    lureGuardsTo(x, y) {
      for (const guard of this.guards) {
        const d = Math.hypot(guard.x - x, guard.y - y);
        if (d < NOISE_LURE_RADIUS && guard.state !== 'alert') {
          guard.state = 'investigate';
          guard.stateTime = 0;
          guard.investigateTarget = { x, y };
          guard.mark = '?';
        }
      }
      this.audio.noiseToss();
    },
  };
  return world;
}

export function detectionLabel(world) {
  if (world.lockdown > 0) return 'LOCKDOWN';
  if (world.alarm >= ALARM_SUSPICIOUS_AT) return 'SUSPICIOUS';
  if (world.alarm > 0) return 'UNSEEN';
  return 'UNSEEN';
}

function playerOnShadow(world) {
  const col = Math.floor(world.player.x / 40);
  const row = Math.floor(world.player.y / 40);
  return isShadowTile(world.level, col, row);
}

function computeVisibility(world) {
  let guardSeen = false;
  let cameraSeen = false;
  for (const guard of world.guards) {
    if (guardSeesPlayer(guard, world)) {
      guardSeen = true;
      break;
    }
  }
  for (const cam of world.cameras) {
    if (cameraSeesPlayer(cam, world)) {
      cameraSeen = true;
      break;
    }
  }
  return { guardSeen, cameraSeen };
}

function applyAlarm(world, dt, seen) {
  const shadow = playerOnShadow(world);
  const sneak = world.player.sneaking;
  let rise = 0;
  if (seen.guardSeen) rise += shadow ? ALARM_RISE_SHADOW : ALARM_RISE_LIGHT;
  if (seen.cameraSeen) rise += shadow ? ALARM_RISE_CAMERA_SHADOW : ALARM_RISE_CAMERA_LIGHT;
  if (rise > 0) {
    const factor = seen.cameraSeen && !seen.guardSeen
      ? (sneak ? ALARM_CAMERA_SNEAK_FACTOR : 1)
      : (sneak ? ALARM_SNEAK_FACTOR : 1);
    world.raiseAlarm(rise * factor * dt);
  } else {
    world.alarm = Math.max(0, world.alarm - ALARM_FALL * dt);
  }
}

function checkCaught(world) {
  if (world.lockdown <= 0) return false;
  for (const guard of world.guards) {
    const d = Math.hypot(guard.x - world.player.x, guard.y - world.player.y);
    if (d < GUARD_CATCH_RANGE) return true;
  }
  return false;
}

function doCaught(world) {
  world.caughtCount += 1;
  world.nerves -= 1;
  world.audio.caughtSting();
  world.lockdown = 0;
  if (world.nerves <= 0) {
    world.phase = 'gameover';
    world.audio.loseDrone();
    return;
  }
  world.phase = 'caught';
  world.caughtTimer = 1.8;
}

function doWin(world) {
  world.winTime = world.time;
  world.phase = 'win';
  world.audio.winArpeggio();
  if (world.alarmPeak < ALARM_SUSPICIOUS_AT && world.nerves === NERVES_START) {
    world.winRating = 'GHOST — tak pernah terlihat';
  } else if (world.nerves === NERVES_START) {
    world.winRating = 'CLEAN GETAWAY';
  } else {
    world.winRating = 'LOUD GETAWAY';
  }
}

export function updateWorld(world, input, dt) {
  // Panel CAUGHT: hitung mundur lalu respawn di pintu masuk.
  if (world.phase === 'caught') {
    world.caughtTimer -= dt;
    if (world.caughtTimer <= 0) {
      world.alarm = ALARM_AFTER_CAUGHT;
      resetPlayerToStart(world.player, world.level);
      resetGuards(world.guards, world.level, GUARD_PATROLS);
      world.phase = 'playing';
    }
    return;
  }
  if (world.phase !== 'playing') return;
  world.time += dt;

  // Aksi sekali tekan.
  if (input.wasPressed('KeyE')) {
    const item = grabLoot(world.player, world.level.loot);
    if (item) {
      world.lootValue += item.value;
      if (item.value === LOOT_SUNSTAR_VALUE) world.sunstarTaken = true;
      world.audio.pickupChime(item.value);
    }
  }
  if (input.wasPressed('Digit1')) useEmp(world.player, world);
  if (input.wasPressed('Digit2')) world.player.pendingNoise = true;
  if (input.wasPressed('KeyP')) {
    world.phase = 'paused';
    return;
  }
  const click = input.takeClick();
  if (click) {
    if (world.player.pendingNoise) {
      world.player.pendingNoise = false;
      throwNoisemaker(world.player, world, click.x, click.y);
    } else {
      world.player.clickTarget = { x: click.x, y: click.y };
    }
  }

  // Gerak + suara langkah.
  const stepped = stepPlayer(world.player, world.level, input.moveVector(), dt);
  if (stepped) world.audio.step(world.player.sneaking);

  // Guard: langkah terdengar dari yang terdekat (radar telinga).
  world.guardStepAcc += dt;
  if (world.guardStepAcc > 0.55) {
    world.guardStepAcc = 0;
    let nearest = Infinity;
    for (const g of world.guards) {
      nearest = Math.min(nearest, Math.hypot(g.x - world.player.x, g.y - world.player.y));
    }
    if (nearest < 320) world.audio.guardStep(nearest);
  }

  for (const guard of world.guards) stepGuard(guard, dt, world);
  for (const cam of world.cameras) stepCamera(cam, world.time);

  // Alarm: naik saat terlihat, turun saat tersembunyi.
  const seen = computeVisibility(world);
  applyAlarm(world, dt, seen);

  // Lockdown saat alarm penuh.
  if (world.alarm >= ALARM_MAX && world.lockdown <= 0) {
    world.lockdown = LOCKDOWN_SECONDS;
    world.audio.alarmSting();
    for (const guard of world.guards) {
      guard.state = 'alert';
      guard.stateTime = 0;
      guard.mark = '!';
    }
  }
  if (world.lockdown > 0) {
    world.lockdown -= dt;
    if (world.lockdown <= 0) {
      world.alarm = Math.min(world.alarm, ALARM_AFTER_LOCKDOWN);
    }
  }

  // Tertangkap: guard menyentuh pemain selama lockdown.
  if (checkCaught(world)) {
    doCaught(world);
    return;
  }

  // Menang: Sunstar di tangan + sampai di pintu vault.
  if (world.sunstarTaken) {
    const exit = tileCenter(world.level.exit.col, world.level.exit.row);
    const d = Math.hypot(exit.x - world.player.x, exit.y - world.player.y);
    if (d < EXIT_RADIUS) doWin(world);
  }
}

// Ringkasan state untuk screenshot driver + playtest (bukan rahasia).
export function gameStateSnapshot(world) {
  const seen = world.phase === 'playing' ? computeVisibility(world) : { guardSeen: false, cameraSeen: false };
  return {
    phase: world.phase,
    alarm: Math.round(world.alarm),
    alarmPeak: Math.round(world.alarmPeak),
    detection: detectionLabel(world),
    lockdown: Math.max(0, world.lockdown).toFixed(1),
    seenByGuard: seen.guardSeen,
    seenByCamera: seen.cameraSeen,
    lootValue: world.lootValue,
    sunstarTaken: world.sunstarTaken,
    time: world.time.toFixed(1),
    nerves: world.nerves,
    caught: world.caughtCount,
    player: { x: Math.round(world.player.x), y: Math.round(world.player.y) },
    empCharges: world.player.empCharges,
    noiseCharges: world.player.noiseCharges,
    camerasOffline: world.cameras.filter((c) => cameraIsOffline(c, world.time)).length,
    guards: world.guards.map((g) => ({
      name: g.name,
      x: Math.round(g.x),
      y: Math.round(g.y),
      facing: Math.round((g.facing * 180) / Math.PI),
      state: g.state,
    })),
    cameras: world.cameras.map((c) => ({
      name: c.name,
      angle: Math.round((c.angle * 180) / Math.PI),
      offline: cameraIsOffline(c, world.time),
    })),
  };
}
