// input.js — keyboard + mouse. Menyimpan state tombol (bukan event sekali
// jalan) dan edge-press sekali pakai untuk aksi (E / 1 / 2 / Space / P / R).
// Klik kiri = click-to-move, kecuali bila noisemaker sedang dipersenjatai.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouse: { x: 0, y: 0, inside: false },
    clicked: null, // {x, y} klik terakhir yang belum dikonsumsi
    pressed: new Set(), // kode tombol yang ditekan sejak consumePressed terakhir
    sneak: false,
    attach() {
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
        if (!e.repeat) this.pressed.add(e.code);
        this.keys.add(e.code);
      });
      window.addEventListener('keyup', (e) => {
        this.keys.delete(e.code);
      });
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
        this.mouse.inside = true;
      });
      canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.mouse.x = x;
        this.mouse.y = y;
        this.clicked = { x, y, button: e.button };
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      window.addEventListener('blur', () => {
        this.keys.clear();
      });
    },
    // Arah gerak dari WASD / panah.
    moveVector() {
      const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
      const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
      const up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
      const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
      return {
        left,
        right,
        up,
        down,
        sneak: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      };
    },
    takeClick() {
      const c = this.clicked;
      this.clicked = null;
      return c;
    },
    wasPressed(code) {
      return this.pressed.has(code);
    },
    endFrame() {
      this.pressed.clear();
    },
  };
  return input;
}
