import * as THREE from 'three';
import type { DiskStyle } from './data';

/** Draws a period-correct 3.5" floppy label and returns it as a texture. */
export function floppyLabelTexture(title: string, index: number, style: DiskStyle): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * 0.36) / 0.64);
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;

  ctx.fillStyle = style.label;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(40,44,48,.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  ctx.fillStyle = style.strip;
  ctx.fillRect(28, 30, width - 56, 26);

  ctx.fillStyle = style.ink;
  ctx.font = '700 40px "IBM Plex Mono", monospace';
  ctx.textBaseline = 'top';
  const label = title.length > 17 ? `${title.slice(0, 16)}…` : title;
  ctx.fillText(label, 30, 78);

  ctx.font = '600 24px "IBM Plex Mono", monospace';
  ctx.fillText(`FAZLEY SYSTEMS`, 30, height - 74);
  ctx.font = '700 26px "IBM Plex Mono", monospace';
  ctx.fillText(`DISK ${String(index).padStart(2, '0')} / 04`, 30, height - 44);

  ctx.strokeStyle = 'rgba(40,44,48,.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(width - 92, 96 + i * 16);
    ctx.lineTo(width - 24, 96 + i * 16);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function notebookLabelTexture(title: string, subtitle: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * 0.36) / 0.79);
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;

  ctx.fillStyle = '#e7dfcc';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, 10);

  ctx.fillStyle = '#33413e';
  ctx.font = '700 46px "IBM Plex Mono", monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(title.toUpperCase(), 30, 52);
  ctx.fillStyle = '#5c6b64';
  ctx.font = '500 24px "IBM Plex Mono", monospace';
  ctx.fillText(subtitle, 30, 112);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
