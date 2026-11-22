// render.js — semua gambar di canvas 2D: lantai art-deco, rug bayangan,
// cover, loot berkilau, pintu vault, cone guard/kamera, lapisan kegelapan
// dengan lubang cahaya, HUD alarm, dan panel title/pause/caught/win.
// Tidak ada aset eksternal: semua digambar dari kode.
import {
  TILE,
  COLS,
  ROWS,
  VIEW_W,
  VIEW_H,
  PALETTE,
  GAME_NAME,
  THIEF_NAME,
  TARGET_NAME,
  OWNER_NAME,
  ALARM_MAX,
  ALARM_SUSPICIOUS_AT,
  GUARD_CONE_RANGE,
} from './config.js';
import { tileCenter, coverKind, SCONCES } from './level.js';
import { guardConePolygon } from './guards.js';
import { cameraConePolygon, cameraIsOffline } from './cameras.js';
import { detectionLabel } from './world.js';

let lightCanvas = null;

function hashShade(col, row) {
  return ((col * 31 + row * 17) % 5) - 2; // -2..2 variasi lantai
}

function drawFloor(ctx, level) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * TILE;
      const y = row * TILE;
      const ch = level.solid[row * COLS + col] === 1 ? '#' : '.';
      if (ch === '#') continue;
      const shade = hashShade(col, row);
      ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(x, y, TILE, TILE);
      if (shade !== 0) {
        ctx.fillStyle = shade > 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(x, y, TILE, TILE);
      }
      ctx.strokeStyle = PALETTE.floorLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
  }
}

function drawRugs(ctx, level) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (level.shadow[row * COLS + col] !== 1) continue;
      const x = col * TILE;
      const y = row * TILE;
      ctx.fillStyle = PALETTE.rug;
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = PALETTE.rugTrim;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 5.5, y + 5.5, TILE - 11, TILE - 11);
      ctx.fillStyle = 'rgba(232,185,60,0.25)';
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawWallsAndCover(ctx, level) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * TILE;
      const y = row * TILE;
      const i = row * COLS + col;
      if (level.solid[i] !== 1) continue;
      const isBorder = col === 0 || row === 0 || col === COLS - 1 || row === ROWS - 1;
      if (isBorder) {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(x, y, TILE, TILE);
        // Trim emas di tepi dalam dinding.
        ctx.fillStyle = PALETTE.wallTrim;
        if (row === 0) ctx.fillRect(x, y + TILE - 3, TILE, 3);
        if (row === ROWS - 1) ctx.fillRect(x, y, TILE, 3);
        if (col === 0) ctx.fillRect(x + TILE - 3, y, 3, TILE);
        if (col === COLS - 1) ctx.fillRect(x, y, 3, TILE);
      } else {
        drawCover(ctx, x, y, coverKind(col, row));
      }
    }
  }
}

function drawCover(ctx, x, y, kind) {
  if (kind === 0) {
    // Display case kaca berbingkai emas.
    ctx.fillStyle = PALETTE.coverBase;
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = PALETTE.coverGlass;
    ctx.fillRect(x + 7, y + 7, TILE - 14, TILE - 14);
    ctx.strokeStyle = PALETTE.coverFrame;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 7.5, y + 7.5, TILE - 15, TILE - 15);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 28);
    ctx.lineTo(x + 22, y + 12);
    ctx.stroke();
  } else if (kind === 1) {
    // Statue di atas pedestal.
    ctx.fillStyle = PALETTE.coverBase;
    ctx.fillRect(x + 8, y + 22, TILE - 16, TILE - 24);
    ctx.fillStyle = PALETTE.statue;
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + 14, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + TILE / 2 - 4, y + 18, 8, 10);
  } else {
    // Safe baja dengan dial emas.
    ctx.fillStyle = PALETTE.safe;
    ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
    ctx.strokeStyle = '#5a6d77';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 4.5, y + 4.5, TILE - 9, TILE - 9);
    ctx.fillStyle = PALETTE.safeDial;
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20262b';
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLoot(ctx, world, time) {
  const sparkle = 0.6 + 0.4 * Math.sin(time * 4);
  for (const [key, item] of Object.entries(world.level.loot)) {
    if (item.taken) continue;
    const c = tileCenter(item.col, item.row);
    if (key === 'sunstar') {
      // Pedestal + Sunstar Diamond berkilau.
      ctx.fillStyle = '#5a4a1e';
      ctx.fillRect(c.x - 10, c.y - 2, 20, 22);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(c.x - 13, c.y - 6, 26, 6);
      ctx.save();
      ctx.translate(c.x, c.y - 14);
      ctx.rotate(Math.PI / 4);
      const s = 9 + sparkle * 2;
      ctx.fillStyle = `rgba(255, 217, 77, ${0.75 + sparkle * 0.25})`;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = '#fff6c8';
      ctx.lineWidth = 1;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.fillStyle = `rgba(255, 217, 77, ${0.25 * sparkle})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y - 14, 18 + sparkle * 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (key === 'gold') {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(c.x - 11, c.y - 3, 10, 7);
      ctx.fillRect(c.x - 1, c.y - 3, 10, 7);
      ctx.fillRect(c.x - 6, c.y - 10, 10, 7);
      ctx.fillStyle = PALETTE.goldBright;
      ctx.fillRect(c.x - 6, c.y - 10, 10, 2);
    } else {
      ctx.fillStyle = PALETTE.emerald;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(Math.PI / 4 + Math.sin(time * 2) * 0.1);
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
      ctx.fillStyle = `rgba(55, 201, 120, ${0.25 * sparkle})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 16 + sparkle * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawExit(ctx, world, time) {
  const c = tileCenter(world.level.exit.col, world.level.exit.row);
  const open = world.sunstarTaken;
  const pulse = open ? 0.7 + 0.3 * Math.sin(time * 5) : 0.4;
  ctx.fillStyle = '#20262b';
  ctx.fillRect(c.x - 19, c.y - 19, 38, 38);
  ctx.strokeStyle = open ? `rgba(55, 201, 120, ${pulse})` : '#5a6d77';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#8a97a0';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + (open ? time * 0.8 : 0);
    ctx.beginPath();
    ctx.moveTo(c.x + Math.cos(a) * 4, c.y + Math.sin(a) * 4);
    ctx.lineTo(c.x + Math.cos(a) * 14, c.y + Math.sin(a) * 14);
    ctx.stroke();
  }
  ctx.fillStyle = open ? '#37c978' : '#e8e0c8';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', c.x, c.y - 24);
}

function drawCones(ctx, world) {
  for (const guard of world.guards) {
    const poly = guardConePolygon(guard, world.level);
    ctx.fillStyle = guard.state === 'alert' ? PALETTE.coneGuardAlert : PALETTE.coneGuard;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();
  }
  for (const cam of world.cameras) {
    if (cameraIsOffline(cam, world.time)) continue;
    const poly = cameraConePolygon(cam, world.level);
    ctx.fillStyle = PALETTE.coneCamera;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCameras(ctx, world) {
  for (const cam of world.cameras) {
    const offline = cameraIsOffline(cam, world.time);
    ctx.fillStyle = offline ? '#4a4a4a' : '#20262b';
    ctx.beginPath();
    ctx.arc(cam.mountX, cam.mountY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = offline ? '#777' : '#c9a227';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Lensa mengarah sesuai sudut sapuan.
    const lx = cam.mountX + Math.cos(cam.angle) * 12;
    const ly = cam.mountY + Math.sin(cam.angle) * 12;
    ctx.strokeStyle = offline ? '#666' : '#e5484d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cam.mountX, cam.mountY);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    if (!offline && cam.blink) {
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(cam.mountX, cam.mountY - 11, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Label nama: di bawah mount (di luar HUD & di luar glow pedestal),
    // kecuali kamera dinding kanan yang labelnya di kiri mount.
    ctx.fillStyle = '#e8e0c8';
    ctx.font = 'bold 9px monospace';
    if (cam.mountX > VIEW_W - 40) {
      ctx.textAlign = 'right';
      ctx.fillText(offline ? 'OFFLINE' : cam.name, cam.mountX - 14, cam.mountY + 3);
    } else {
      ctx.textAlign = 'center';
      ctx.fillText(offline ? 'OFFLINE' : cam.name, cam.mountX, cam.mountY + 22);
    }
  }
}

function drawGuards(ctx, world) {
  for (const guard of world.guards) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(guard.x, guard.y + 12, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Badan + topi.
    ctx.fillStyle = PALETTE.guardUniform;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guardCap;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y - 3, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(guard.x - 8, guard.y - 4, 16, 3);
    // Arah pandang: garis kecil ke depan.
    ctx.strokeStyle = '#d7e6f2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * 16, guard.y + Math.sin(guard.facing) * 16);
    ctx.stroke();
    // Tanda ? / ! di atas kepala.
    if (guard.mark) {
      ctx.fillStyle = guard.mark === '!' ? '#ff4d4d' : '#ffd94d';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(guard.mark, guard.x, guard.y - 20);
    }
    ctx.fillStyle = '#e8e0c8';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(guard.name.toUpperCase(), guard.x, guard.y + 26);
  }
}

function drawPlayer(ctx, world, time) {
  const p = world.player;
  const bob = p.moving ? Math.sin(p.stepPhase * Math.PI * 2) * 1.5 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 12, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  if (p.sneaking) ctx.scale(1, 0.85); // jongkok saat sneak
  ctx.fillStyle = PALETTE.playerCoat;
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();
  // Syal burgundy + topi fedora — siluet pencuri yang khas.
  ctx.fillStyle = PALETTE.playerScarf;
  ctx.beginPath();
  ctx.arc(0, 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a2027';
  ctx.beginPath();
  ctx.arc(0, -3, 8, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-9, -4, 18, 3);
  // Arah hadap.
  ctx.strokeStyle = '#e8e0c8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(p.facing) * 15, Math.sin(p.facing) * 15);
  ctx.stroke();
  ctx.restore();
  // Target click-to-move: cincin kecil di titik tujuan.
  if (p.clickTarget) {
    ctx.strokeStyle = 'rgba(232,224,200,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.clickTarget.x, p.clickTarget.y, 6 + Math.sin(time * 6) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Noisemaker dipersenjatai: kursor lempar.
  if (p.pendingNoise) {
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LEMPAR: klik titik lantai', p.x, p.y - 24);
  }
}

function drawDarkness(ctx, world) {
  if (!lightCanvas) {
    lightCanvas = document.createElement('canvas');
    lightCanvas.width = VIEW_W;
    lightCanvas.height = VIEW_H;
  }
  const lctx = lightCanvas.getContext('2d');
  lctx.clearRect(0, 0, VIEW_W, VIEW_H);
  lctx.globalCompositeOperation = 'source-over';
  lctx.fillStyle = PALETTE.darkness;
  lctx.fillRect(0, 0, VIEW_W, VIEW_H);
  lctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r) => {
    const g = lctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.beginPath();
    lctx.arc(x, y, r, 0, Math.PI * 2);
    lctx.fill();
  };
  hole(world.player.x, world.player.y, 205);
  const sun = tileCenter(world.level.loot.sunstar.col, world.level.loot.sunstar.row);
  hole(sun.x, sun.y, 100);
  const exit = tileCenter(world.level.exit.col, world.level.exit.row);
  hole(exit.x, exit.y, 95);
  for (const guard of world.guards) hole(guard.x, guard.y, 60);
  for (const [c, r] of SCONCES) {
    const s = tileCenter(c, r);
    hole(s.x, s.y, 75);
  }
  ctx.drawImage(lightCanvas, 0, 0);
}

function alarmColor(alarm) {
  if (alarm >= ALARM_SUSPICIOUS_AT) return PALETTE.alarmHigh;
  if (alarm > 0) return PALETTE.alarmMid;
  return PALETTE.alarmLow;
}

function formatTime(sec) {
  const s = Math.floor(sec + 0.001);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function drawHud(ctx, world) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEW_W, 34);
  ctx.fillStyle = PALETTE.wallTrim;
  ctx.fillRect(0, 34, VIEW_W, 2);
  // Alarm meter.
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', 12, 22);
  ctx.fillStyle = '#10181d';
  ctx.fillRect(72, 10, 220, 14);
  ctx.fillStyle = alarmColor(world.alarm);
  ctx.fillRect(72, 10, (220 * world.alarm) / ALARM_MAX, 14);
  ctx.strokeStyle = '#5a6d77';
  ctx.lineWidth = 1;
  ctx.strokeRect(72.5, 10.5, 220, 14);
  // Tanda 50: ambang suspicious.
  ctx.fillStyle = '#e8e0c8';
  ctx.fillRect(72 + 110 - 1, 8, 2, 18);
  ctx.fillStyle = world.lockdown > 0 ? '#ff4d4d' : PALETTE.hudText;
  ctx.font = 'bold 13px monospace';
  ctx.fillText(world.lockdown > 0 ? 'LOCKDOWN!' : detectionLabel(world), 302, 22);
  // Kanan: loot, waktu, nerves, tools, objective — dihitung dari kanan
  // agar tidak pernah bertabrakan.
  ctx.fillStyle = PALETTE.goldBright;
  ctx.textAlign = 'right';
  ctx.fillText(`LOOT $${world.lootValue.toLocaleString('en-US')}`, 640, 22);
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(formatTime(world.time), 730, 22);
  let nerves = '';
  for (let i = 0; i < 3; i++) nerves += i < world.nerves ? '◆' : '◇';
  ctx.fillStyle = '#ff8fa3';
  ctx.fillText(nerves, 800, 22);
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(`EMP ${world.player.empCharges}  COIN ${world.player.noiseCharges}`, 950, 22);
  const objective = world.sunstarTaken ? '→ Kabur ke EXIT' : '→ Curi Sunstar [E]';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText(objective, 1268, 22);
}

function panel(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(4, 8, 14, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const w = 620;
  const h = 120 + lines.length * 30;
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  ctx.fillStyle = '#0d151c';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent || PALETTE.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = accent || PALETTE.goldBright;
  ctx.font = 'bold 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, y + 58);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '15px monospace';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2, y + 100 + i * 30);
  });
}

export function renderWorld(ctx, world, time) {
  drawFloor(ctx, world.level);
  drawRugs(ctx, world.level);
  drawWallsAndCover(ctx, world.level);
  drawExit(ctx, world, time);
  drawLoot(ctx, world, time);
  drawCones(ctx, world);
  drawGuards(ctx, world);
  drawPlayer(ctx, world, time);
  if (world.phase === 'playing' || world.phase === 'paused' || world.phase === 'caught') {
    drawDarkness(ctx, world);
  }
  drawHud(ctx, world);
  drawCameras(ctx, world); // di atas HUD: mount di dinding atas tetap terlihat
  if (world.phase === 'title') {
    panel(ctx, GAME_NAME, [
      `${THIEF_NAME} menyelinap ke vault house ${OWNER_NAME}.`,
      `Curi ${TARGET_NAME}, lalu kabur lewat pintu vault.`,
      'WASD / klik: gerak   Shift: sneak   E: ambil loot',
      '1: EMP (matikan CCTV, +alarm)   2 lalu klik: noisemaker',
      'Cone kuning = guard, cone merah = CCTV. Alarm 100 = lockdown.',
      'Tekan SPACE untuk mulai',
    ]);
  } else if (world.phase === 'paused') {
    panel(ctx, 'PAUSED', ['Tekan P untuk lanjut.', 'R: mulai dari awal.']);
  } else if (world.phase === 'caught') {
    panel(ctx, 'CAUGHT!', [
      'Guard menangkapmu saat lockdown.',
      `Nerves tersisa: ${world.nerves} — kamu kembali ke pintu masuk.`,
      'Alarm direset. Rencanakan lagi.',
    ], '#e5484d');
  } else if (world.phase === 'win') {
    panel(ctx, world.winRating || 'CLEAN GETAWAY', [
      `${TARGET_NAME} berhasil dicuri!`,
      `Waktu: ${formatTime(world.winTime)}   Loot: $${world.lootValue.toLocaleString('en-US')}`,
      `Nerves tersisa: ${world.nerves}   Tertangkap: ${world.caughtCount}x   Alarm puncak: ${Math.round(world.alarmPeak)}`,
      'Tekan R untuk main lagi.',
    ], '#37c978');
  } else if (world.phase === 'gameover') {
    panel(ctx, 'GAME OVER', [
      'Nerves habis — Marlow ditahan penjaga vault.',
      `Loot terkumpul: $${world.lootValue.toLocaleString('en-US')}`,
      'Tekan R untuk coba lagi.',
    ], '#e5484d');
  }
}

export { formatTime };
