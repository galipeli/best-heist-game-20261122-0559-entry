// main.js — bootstrap THE GILDED VAULT: canvas 1280x720, loop requestAnimationFrame,
// ?shot=cover|nearmiss|win|start&seed=1 untuk screenshot deterministik,
// window.__gameState() / __shot / __pilot() untuk driver CDP dan playtest.
import { VIEW_W, VIEW_H } from './config.js';
import { validateLevel } from './level.js';
import { createWorld, updateWorld, gameStateSnapshot } from './world.js';
import { renderWorld } from './render.js';
import { createInput } from './input.js';
import { applyShotState, runPilot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

const world = createWorld();
const levelProblems = validateLevel(world.level);
if (levelProblems.length) {
  console.error('LEVEL INVALID: ' + levelProblems.join('; '));
}
const input = createInput(canvas);
input.attach();

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  applyShotState(world, shotName);
  window.__shot = shotName;
} else {
  window.__shot = null;
}

window.__gameState = () => gameStateSnapshot(world);
window.__levelProblems = () => levelProblems;
window.__pilot = (route) => runPilot(route || 'main');
window.__version = 'gilded-vault-1.0.0';

let lastT = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.0001, (now - lastT) / 1000));
  lastT = now;
  if (!world.frozen) {
    if (world.phase === 'title' && (input.wasPressed('Space') || input.wasPressed('Enter'))) {
      world.startGame();
    } else if (world.phase === 'paused' && input.wasPressed('KeyP')) {
      world.phase = 'playing';
    } else if ((world.phase === 'win' || world.phase === 'gameover') && input.wasPressed('KeyR')) {
      world.startGame();
    } else if (world.phase === 'paused' && input.wasPressed('KeyR')) {
      world.startGame();
    } else if (world.phase === 'playing' || world.phase === 'caught') {
      updateWorld(world, input, dt);
    }
    // Klik di title juga memulai permainan (mouse).
    if (world.phase === 'title' && input.takeClick()) {
      world.startGame();
    }
  }
  renderWorld(ctx, world, world.time);
  input.endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
