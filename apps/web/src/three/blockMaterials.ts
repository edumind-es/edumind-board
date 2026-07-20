// Materiales de los bloques multibase: cada cara lleva una textura de rejilla
// con las graduaciones unitarias reales (una decena muestra 10 divisiones,
// una centena 10x10, etc.). Texturas generadas una vez y compartidas.
import * as THREE from "three";
import { PIECE_COLORS, PIECE_DIMENSIONS, type PieceKind } from "../manipulatives/space3d";

const textureCache = new Map<string, THREE.CanvasTexture>();
const materialCache = new Map<PieceKind, THREE.MeshStandardMaterial[]>();

function gridTexture(cols: number, rows: number, hexColor: string) {
  const key = `${cols}x${rows}-${hexColor}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const cell = Math.max(24, Math.min(96, Math.floor(512 / Math.max(cols, rows))));
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext("2d")!;

  // Base con leve degradado para dar volumen
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, hexColor);
  gradient.addColorStop(1, shade(hexColor, -14));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Graduaciones unitarias
  ctx.strokeStyle = "rgba(23, 37, 52, 0.5)";
  ctx.lineWidth = Math.max(1.5, cell * 0.045);
  for (let i = 1; i < cols; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, canvas.height);
    ctx.stroke();
  }
  for (let j = 1; j < rows; j++) {
    ctx.beginPath();
    ctx.moveTo(0, j * cell);
    ctx.lineTo(canvas.width, j * cell);
    ctx.stroke();
  }

  // Borde exterior más marcado
  ctx.lineWidth = Math.max(2.5, cell * 0.09);
  ctx.strokeStyle = "rgba(23, 37, 52, 0.8)";
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}

function shade(hex: string, amount: number) {
  const value = hex.replace("#", "");
  const channel = (index: number) =>
    Math.max(0, Math.min(255, parseInt(value.slice(index, index + 2), 16) + amount));
  return `rgb(${channel(0)}, ${channel(2)}, ${channel(4)})`;
}

/**
 * Devuelve los 6 materiales de una pieza (orden BoxGeometry: +x −x +y −y +z −z).
 * Cada cara recibe la rejilla que corresponde a sus dimensiones reales.
 */
export function pieceMaterials(kind: PieceKind): THREE.MeshStandardMaterial[] {
  const cached = materialCache.get(kind);
  if (cached) return cached;

  const [w, h, d] = PIECE_DIMENSIONS[kind];
  const color = PIECE_COLORS[kind];
  // [cols, rows] por cara según ejes de la BoxGeometry
  const faces: Array<[number, number]> = [
    [d, h], [d, h], // ±X
    [w, d], [w, d], // ±Y
    [w, h], [w, h]  // ±Z
  ];

  const materials = faces.map(([cols, rows]) =>
    new THREE.MeshStandardMaterial({
      map: gridTexture(cols, rows, color),
      roughness: 0.72,
      metalness: 0.04
    })
  );
  materialCache.set(kind, materials);
  return materials;
}
