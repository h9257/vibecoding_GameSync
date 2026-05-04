/**
 * Generate a simple 256x256 PNG icon for GameSync
 * Uses raw PNG encoding (no external dependencies)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 256, H = 256;
const data = Buffer.alloc(H * (1 + W * 4)); // filter byte + RGBA per row

// Draw gradient background + simple controller shape
for (let y = 0; y < H; y++) {
  const rowOff = y * (1 + W * 4);
  data[rowOff] = 0; // no filter
  for (let x = 0; x < W; x++) {
    const off = rowOff + 1 + x * 4;
    const cx = x - W/2, cy = y - H/2;
    const dist = Math.sqrt(cx*cx + cy*cy);
    
    // Rounded rectangle mask
    const rx = Math.abs(cx), ry = Math.abs(cy);
    const cornerR = 40;
    const halfW = 120, halfH = 120;
    let inside = true;
    if (rx > halfW - cornerR && ry > halfH - cornerR) {
      const dx = rx - (halfW - cornerR), dy = ry - (halfH - cornerR);
      if (dx*dx + dy*dy > cornerR*cornerR) inside = false;
    } else if (rx > halfW || ry > halfH) {
      inside = false;
    }
    
    if (!inside) {
      data[off] = data[off+1] = data[off+2] = 0; data[off+3] = 0;
      continue;
    }
    
    // Gradient: purple (#7c3aed) to blue (#2563eb)
    const t = (x + y) / (W + H);
    const r = Math.round(124 + (37 - 124) * t);
    const g = Math.round(58 + (99 - 58) * t);
    const b = Math.round(237 + (235 - 237) * t);
    
    // Controller body - draw a gamepad shape
    const gamepadBody = (
      // Main body ellipse
      (Math.pow(cx / 60, 2) + Math.pow(cy / 35, 2) < 1) ||
      // Left grip
      (Math.pow((cx + 45) / 25, 2) + Math.pow((cy - 15) / 40, 2) < 1) ||
      // Right grip
      (Math.pow((cx - 45) / 25, 2) + Math.pow((cy - 15) / 40, 2) < 1)
    );
    
    // D-pad (left side)
    const dpadH = (Math.abs(cx + 30) < 8 && Math.abs(cy + 5) < 3);
    const dpadV = (Math.abs(cx + 30) < 3 && Math.abs(cy + 5) < 8);
    
    // Buttons (right side) - 4 small circles
    const btn1 = ((cx-25)*(cx-25) + (cy+10)*(cy+10)) < 16;
    const btn2 = ((cx-35)*(cx-35) + (cy+0)*(cy+0)) < 16;
    const btn3 = ((cx-25)*(cx-25) + (cy-10)*(cy-10)) < 16;
    const btn4 = ((cx-15)*(cx-15) + (cy+0)*(cy+0)) < 16;
    
    // Sync arrows (circular) - two arc segments
    const syncR = 85, syncW = 6;
    const syncDist = Math.abs(dist - syncR);
    const angle = Math.atan2(cy, cx);
    const isArc1 = syncDist < syncW && angle > -2.5 && angle < 0.5;
    const isArc2 = syncDist < syncW && angle > 0.6 && angle < 3.14;
    
    // Arrow heads
    const ah1x = syncR * Math.cos(0.5), ah1y = syncR * Math.sin(0.5);
    const arrowHead1 = Math.abs(cx - ah1x) + Math.abs(cy - ah1y) < 14 && cy < ah1y + 5;
    const ah2x = syncR * Math.cos(0.6), ah2y = syncR * Math.sin(0.6);
    const arrowHead2 = Math.abs(cx - ah2x) + Math.abs(cy - ah2y) < 14 && cy > ah2y - 5;
    
    const isWhite = gamepadBody || dpadH || dpadV || btn1 || btn2 || btn3 || btn4 || isArc1 || isArc2 || arrowHead1 || arrowHead2;
    
    if (isWhite) {
      const alpha = gamepadBody ? 240 : 220;
      data[off] = 255; data[off+1] = 255; data[off+2] = 255; data[off+3] = alpha;
    } else {
      data[off] = r; data[off+1] = g; data[off+2] = b; data[off+3] = 255;
    }
  }
}

// Encode PNG
function crc32(buf) {
  let c = 0xFFFFFFFF;
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = (v & 1) ? (0xEDB88320 ^ (v >>> 1)) : (v >>> 1);
    table[n] = v;
  }
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

const deflated = zlib.deflateSync(data, { level: 9 });
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflated), chunk('IEND', Buffer.alloc(0))]);

const outPath = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'icon.png');
fs.writeFileSync(outPath, png);
console.log(`PNG icon written: ${outPath} (${png.length} bytes)`);
