const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(width, height, pixels) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    rows.push(Buffer.from([0]));
    rows.push(pixels.subarray(y * width * 4, (y + 1) * width * 4));
  }
  return Buffer.concat([
    header,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function insideRoundedRect(x, y, size, radius) {
  const min = 0;
  const max = size;
  if (x >= radius && x < max - radius) return y >= min && y < max;
  if (y >= radius && y < max - radius) return x >= min && x < max;
  const cx = x < radius ? radius : max - radius;
  const cy = y < radius ? radius : max - radius;
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function insidePolygon(x, y, points) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const [xi, yi] = points[index];
    const [xj, yj] = points[previous];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function drawIcon() {
  const scale = 2;
  const size = 512;
  const canvasSize = size * scale;
  const pixels = Buffer.alloc(canvasSize * canvasSize * 4);
  const bg = [29, 36, 36, 255];
  const bg2 = [77, 57, 72, 255];
  const cream = [244, 231, 210, 255];
  const line = [70, 57, 47, 210];
  const orange = [240, 141, 104, 255];
  const leftPage = [[112, 146], [248, 174], [248, 394], [148, 370], [112, 356]];
  const rightPage = [[264, 174], [400, 146], [400, 356], [364, 370], [264, 394]];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!insideRoundedRect(x, y, size, 116)) continue;
      const mix = (x + y) / (size * 2);
      const color = bg.map((value, index) => Math.round(value + (bg2[index] - value) * mix));
      const inBook = insidePolygon(x, y, leftPage) || insidePolygon(x, y, rightPage);
      const inOrange = (x - 390) ** 2 + (y - 112) ** 2 <= 38 ** 2;
      const inSpine = x >= 254 && x <= 258 && y >= 164 && y <= 400;
      let finalColor = inBook ? cream : color;
      if (inSpine) finalColor = [146, 118, 97, 170];
      if (inOrange) finalColor = orange;
      const lineRows = [206, 250, 294];
      const onLine =
        lineRows.some((row) => y >= row && y <= row + 11) &&
        ((x >= 154 && x <= 224) || (x >= 288 && x <= 358));
      if (inBook && onLine) finalColor = line;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const offset = (((y * scale) + dy) * canvasSize + (x * scale + dx)) * 4;
          pixels[offset] = finalColor[0];
          pixels[offset + 1] = finalColor[1];
          pixels[offset + 2] = finalColor[2];
          pixels[offset + 3] = finalColor[3];
        }
      }
    }
  }

  const downsampled = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sums = [0, 0, 0, 0];
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const offset = (((y * scale + dy) * canvasSize) + x * scale + dx) * 4;
          for (let channel = 0; channel < 4; channel += 1) sums[channel] += pixels[offset + channel];
        }
      }
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        downsampled[offset + channel] = Math.round(sums[channel] / (scale * scale));
      }
    }
  }
  return { size, pixels: downsampled };
}

function resize(source, sourceSize, targetSize) {
  const output = Buffer.alloc(targetSize * targetSize * 4);
  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const sx = Math.min(sourceSize - 1, Math.floor((x / targetSize) * sourceSize));
      const sy = Math.min(sourceSize - 1, Math.floor((y / targetSize) * sourceSize));
      const sourceOffset = (sy * sourceSize + sx) * 4;
      const targetOffset = (y * targetSize + x) * 4;
      source.copy(output, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return output;
}

const icon = drawIcon();
const outputDir = path.join(__dirname, "..", "public");
fs.writeFileSync(path.join(outputDir, "icon-512.png"), encodePng(512, 512, icon.pixels));
const icon192 = encodePng(192, 192, resize(icon.pixels, 512, 192));
fs.writeFileSync(path.join(outputDir, "icon-192.png"), icon192);

const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);
icoHeader[6] = 192;
icoHeader[7] = 192;
icoHeader[8] = 0;
icoHeader[9] = 0;
icoHeader.writeUInt16LE(1, 10);
icoHeader.writeUInt16LE(32, 12);
icoHeader.writeUInt32LE(icon192.length, 14);
icoHeader.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(outputDir, "icon.ico"), Buffer.concat([icoHeader, icon192]));

console.log("Generated icon-512.png, icon-192.png and icon.ico");
