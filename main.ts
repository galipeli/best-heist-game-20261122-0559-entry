// main.ts — program penyerahan THE GILDED VAULT (best-heist-game-20261122-0559).
// Menyalin game/ dan screenshots/ dari repositori ke direktori output lalu
// menulis dossier.json dengan buildDossier dari vendor/makefun-game.ts.
// Dijalankan dua kali oleh grader; kedua run harus menulis byte yang sama.
// Di luar grader, MAKEFUN_OUTPUT_DIR menggantikan /output.
// Node 22, standard library saja; tanpa network, tanpa dependensi.
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

const MAX_SCREENSHOT_BYTES = 256 * 1024;

function fail(message: string): never {
  throw new Error(`main.ts: ${message}`);
}

// Salin pohon direktori secara rekursif. Symlink ditolak (gate menuntut
// plain files saja); hanya file biasa dan direktori yang disalin.
function copyTree(srcDir: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  for (const name of readdirSync(srcDir).sort()) {
    const src = join(srcDir, name);
    const dest = join(destDir, name);
    const st = lstatSync(src);
    if (st.isSymbolicLink()) fail(`menolak symlink ${src}`);
    if (st.isDirectory()) {
      copyTree(src, dest);
    } else if (st.isFile()) {
      cpSync(src, dest);
    } else {
      fail(`menolak ${src} (bukan file/direktori biasa)`);
    }
  }
}

function checkScreenshots(shotsDir: string): string[] {
  const names = readdirSync(shotsDir)
    .filter((n) => !n.startsWith('.'))
    .sort();
  if (names.length < 3 || names.length > 4) {
    fail(`screenshots harus 3-4 file, dapat ${names.length}`);
  }
  for (const name of names) {
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith('-')) {
      fail(`nama screenshot tidak valid: ${name}`);
    }
    const st = lstatSync(join(shotsDir, name));
    if (!st.isFile() || st.isSymbolicLink()) fail(`screenshot bukan file biasa: ${name}`);
    if (st.size > MAX_SCREENSHOT_BYTES) {
      fail(`screenshot ${name} ${st.size} bytes > 256 KiB`);
    }
  }
  return names;
}

function main(): void {
  const gameDir = join(REPO_ROOT, 'game');
  const shotsDir = join(REPO_ROOT, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) {
    fail('game/index.html tidak ditemukan');
  }
  const shotNames = checkScreenshots(shotsDir);

  // Bersihkan output lama agar tidak ada file basi dari run sebelumnya.
  // Direktori output itu sendiri tidak pernah dihapus — di sandbox grader
  // ia adalah mount volume, jadi hapus tiap isinya satu per satu.
  // Menghapus OUTPUT_DIR sendiri membuat run gagal (exit 1) karena mount point tidak bisa di-rmdir.
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const name of readdirSync(OUTPUT_DIR)) {
    rmSync(join(OUTPUT_DIR, name), { recursive: true, force: true });
  }
  copyTree(gameDir, join(OUTPUT_DIR, 'game'));
  copyTree(shotsDir, join(OUTPUT_DIR, 'screenshots'));

  const dossier = buildDossier(OUTPUT_DIR, DOSSIER_CAPS);
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);

  // Verifikasi: dossier yang tertulis sama persis dengan buildDossier
  // independen kedua — bila tidak, run ini gagal daripada mengirim yang salah.
  const written = readFileSync(join(OUTPUT_DIR, 'dossier.json'));
  const rebuilt = Buffer.from(buildDossier(OUTPUT_DIR, DOSSIER_CAPS));
  const expected = Buffer.from(dossier);
  if (written.length !== expected.length || !written.equals(expected) || !rebuilt.equals(expected)) {
    fail('dossier.json tidak cocok dengan buildDossier');
  }
  console.log(
    `main.ts: wrote ${OUTPUT_DIR} (game/ + ${shotNames.length} screenshots + dossier.json ${dossier.length} bytes)`,
  );
}

main();
