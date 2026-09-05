// Escena WebGL del widget mates3d: manipulativos Base 10 con volumen real
// y explorador de sólidos geométricos. Se carga con React.lazy: el motor 3D
// no entra en el bundle principal.
//
// Rendimiento PDI: frameloop "demand" (solo renderiza ante cambios), DPR
// limitado y sombras de baja resolución.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { BoardElement, Mates3dPiece, Solid3dKind } from "@edumind-board/shared";
import { useBoardStore } from "../lib/store";
import { newId } from "../lib/ids";
import {
  FLOOR_HALF_EXTENT,
  PIECE_DIMENSIONS,
  solidFacts,
  addPiece,
  arrangePieces,
  clampToFloor,
  countByKind,
  exchangeUp,
  piecesValue,
  snapToGrid,
  splitDown,
  type PieceKind
} from "../manipulatives/space3d";
import { pieceMaterials } from "./blockMaterials";

type Mates3dElement = Extract<BoardElement, { type: "mates3d" }>;

type SceneProps = {
  element: Mates3dElement;
  liveControls: boolean;
  /** true solo en el editor: los cambios se escriben en el store/board */
  persist: boolean;
};

type CameraPreset = { position: [number, number, number]; target: [number, number, number] };

const CAMERA_PRESETS: Record<"iso" | "front" | "top", CameraPreset> = {
  iso: { position: [16, 14, 22], target: [0, 0, 0] },
  front: { position: [0, 7, 34], target: [0, 3, 0] },
  top: { position: [0.01, 38, 0.01], target: [0, 0, 0] }
};

// ── Pieza Base 10 arrastrable ────────────────────────────────────────────────

function DraggablePiece({
  piece, editable, onMove, onCommit, controlsRef
}: {
  piece: Mates3dPiece;
  editable: boolean;
  onMove: (id: string, x: number, z: number) => void;
  onCommit: () => void;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const [w, h, d] = PIECE_DIMENSIONS[piece.kind];
  const materials = useMemo(() => pieceMaterials(piece.kind), [piece.kind]);
  const draggingRef = useRef(false);
  const [hovered, setHovered] = useState(false);

  const planePoint = (ray: THREE.Ray) => {
    // Intersección del rayo del puntero con el plano del suelo (y = 0)
    if (Math.abs(ray.direction.y) < 1e-6) return null;
    const t = -ray.origin.y / ray.direction.y;
    if (t < 0) return null;
    return ray.origin.clone().addScaledVector(ray.direction, t);
  };

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!editable) return;
    event.stopPropagation();
    draggingRef.current = true;
    if (controlsRef.current) controlsRef.current.enabled = false;
    (event.target as Element).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return;
    event.stopPropagation();
    const point = planePoint(event.ray);
    if (!point) return;
    onMove(
      piece.id,
      clampToFloor(snapToGrid(point.x), w / 2),
      clampToFloor(snapToGrid(point.z), d / 2)
    );
  };

  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return;
    event.stopPropagation();
    draggingRef.current = false;
    if (controlsRef.current) controlsRef.current.enabled = true;
    onCommit();
  };

  return (
    <mesh
      position={[piece.x, h / 2, piece.z]}
      rotation={[0, piece.rotY, 0]}
      material={materials}
      castShadow
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerOver={(e) => { e.stopPropagation(); if (editable) setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[w, h, d]} />
      {hovered && <Edges color="#c45d3e" lineWidth={1.5} scale={1.002} />}
    </mesh>
  );
}

// ── Sólidos geométricos ──────────────────────────────────────────────────────

function solidGeometry(kind: Solid3dKind, sides: number) {
  const n = Math.max(3, Math.min(12, Math.round(sides)));
  switch (kind) {
    case "cube": return new THREE.BoxGeometry(8, 8, 8);
    case "sphere": return new THREE.SphereGeometry(5, 48, 32);
    case "cylinder": return new THREE.CylinderGeometry(4, 4, 9, 48);
    case "cone": return new THREE.ConeGeometry(4.5, 9, 48);
    // Pirámide = cono con n segmentos; prisma = cilindro con n segmentos
    case "pyramid": return new THREE.ConeGeometry(5.4, 8, n);
    case "prism": return new THREE.CylinderGeometry(5, 5, 8, n);
  }
}

/** Vértices matemáticos exactos de cada poliedro (misma fórmula que three). */
function solidVertices(kind: Solid3dKind, sides: number): Array<[number, number, number]> {
  const n = Math.max(3, Math.min(12, Math.round(sides)));
  // three orienta el primer vértice del cono/cilindro con un desfase de media
  // arista; lo replicamos para que las esferas caigan justo sobre los vértices.
  const ring = (radius: number, y: number, count: number, offset: number) =>
    Array.from({ length: count }, (_, i): [number, number, number] => {
      const theta = (i / count) * Math.PI * 2 + offset;
      return [radius * Math.cos(theta), y, radius * Math.sin(theta)];
    });

  switch (kind) {
    case "cube": {
      const s = 4;
      const out: Array<[number, number, number]> = [];
      for (const x of [-s, s]) for (const y of [-s, s]) for (const z of [-s, s]) out.push([x, y, z]);
      return out;
    }
    case "pyramid": return [...ring(5.4, -4, n, Math.PI / 2), [0, 4, 0]];
    case "prism": return [...ring(5, 4, n, Math.PI / 2), ...ring(5, -4, n, Math.PI / 2)];
    case "cone": return [[0, 4.5, 0]];
    default: return [];
  }
}

function SolidExplorer({ element }: { element: Mates3dElement }) {
  const { solid, solidSides, solidColor, solidTransparent, showEdges, showVertices } = element.data;
  const geometry = useMemo(() => solidGeometry(solid, solidSides), [solid, solidSides]);
  const vertices = useMemo(() => solidVertices(solid, solidSides), [solid, solidSides]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group position={[0, 4.6, 0]}>
      <mesh geometry={geometry} castShadow={!solidTransparent}>
        <meshStandardMaterial
          color={solidColor}
          roughness={0.45}
          metalness={0.05}
          transparent={solidTransparent}
          opacity={solidTransparent ? 0.32 : 1}
          depthWrite={!solidTransparent}
          side={solidTransparent ? THREE.DoubleSide : THREE.FrontSide}
        />
        {showEdges && <Edges color="#172b34" lineWidth={1.8} threshold={14} />}
      </mesh>
      {showVertices && vertices.map((position, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[0.34, 16, 12]} />
          <meshStandardMaterial color="#c45d3e" roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

// ── Cámara persistida ────────────────────────────────────────────────────────

function CameraRig({
  controlsRef, onPersist, autoRotate
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  onPersist: (position: [number, number, number], target: [number, number, number]) => void;
  autoRotate: boolean;
}) {
  const camera = useThree((state) => state.camera);

  const persist = useCallback(() => {
    const target = controlsRef.current?.target ?? new THREE.Vector3();
    const round = (value: number) => Math.round(value * 100) / 100;
    onPersist(
      [round(camera.position.x), round(camera.position.y), round(camera.position.z)],
      [round(target.x), round(target.y), round(target.z)]
    );
  }, [camera, controlsRef, onPersist]);

  return (
    <OrbitControls
      ref={controlsRef as React.Ref<OrbitControlsImpl>}
      makeDefault
      enableDamping={false}
      autoRotate={autoRotate}
      autoRotateSpeed={1.2}
      maxPolarAngle={Math.PI / 2 - 0.04}
      minDistance={6}
      maxDistance={90}
      onEnd={persist}
    />
  );
}

// ── Escena principal ─────────────────────────────────────────────────────────

export default function Mates3DScene({ element, liveControls, persist }: SceneProps) {
  const updateElementData = useBoardStore((s) => s.updateElementData);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [autoRotate, setAutoRotate] = useState(false);

  // Estado local: los alumnos (sin persistencia) también pueden manipular
  const [pieces, setPieces] = useState<Mates3dPiece[]>(element.data.pieces);
  const [mode, setMode] = useState(element.data.mode);
  useEffect(() => { setPieces(element.data.pieces); }, [element.data.pieces]);
  useEffect(() => { setMode(element.data.mode); }, [element.data.mode]);

  const commitPieces = useCallback((next: Mates3dPiece[]) => {
    setPieces(next);
    if (persist) updateElementData(element.id, { pieces: next });
  }, [persist, updateElementData, element.id]);

  const commitMode = (nextMode: "base10" | "solids") => {
    setMode(nextMode);
    if (persist) updateElementData(element.id, { mode: nextMode });
  };

  const movePiece = useCallback((id: string, x: number, z: number) => {
    setPieces((prev) => prev.map((piece) => (piece.id === id ? { ...piece, x, z } : piece)));
  }, []);

  const commitCurrent = useCallback(() => {
    setPieces((prev) => {
      if (persist) updateElementData(element.id, { pieces: prev });
      return prev;
    });
  }, [persist, updateElementData, element.id]);

  const persistCamera = useCallback((position: [number, number, number], target: [number, number, number]) => {
    if (persist) updateElementData(element.id, { cameraPosition: position, cameraTarget: target });
  }, [persist, updateElementData, element.id]);

  const applyPreset = (preset: keyof typeof CAMERA_PRESETS) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const { position, target } = CAMERA_PRESETS[preset];
    controls.object.position.set(...position);
    controls.target.set(...target);
    controls.update();
    persistCamera([...position] as [number, number, number], [...target] as [number, number, number]);
  };

  const counts = countByKind(pieces);
  const value = piecesValue(pieces);
  const facts = solidFacts(element.data.solid, element.data.solidSides);
  const editable = liveControls;

  const kindButtons: Array<{ kind: PieceKind; label: string }> = [
    { kind: "unit", label: "+U" },
    { kind: "rod", label: "+D" },
    { kind: "flat", label: "+C" },
    { kind: "cube", label: "+M" }
  ];

  return (
    <div className="mates3d-scene" data-overlay-frame>
      <Canvas
        shadows
        frameloop={autoRotate ? "always" : "demand"}
        dpr={[1, 1.75]}
        camera={{ position: element.data.cameraPosition, fov: 42, near: 0.5, far: 300 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
      >
        <color attach="background" args={["#0d1b2b"]} />
        <hemisphereLight args={["#e8f1ff", "#2a3644", 0.85]} />
        <directionalLight
          position={[18, 30, 14]}
          intensity={1.35}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={45}
          shadow-camera-bottom={-45}
        />

        {/* Suelo: sombra suave + rejilla unitaria */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[FLOOR_HALF_EXTENT * 2.4, FLOOR_HALF_EXTENT * 2.4]} />
          <shadowMaterial opacity={0.28} />
        </mesh>
        <gridHelper
          args={[FLOOR_HALF_EXTENT * 2, FLOOR_HALF_EXTENT * 2, "#3d5a73", "#22384c"]}
          position={[0, 0.01, 0]}
        />

        {mode === "base10" && pieces.map((piece) => (
          <DraggablePiece key={piece.id} piece={piece} editable={editable}
            onMove={movePiece} onCommit={commitCurrent} controlsRef={controlsRef} />
        ))}
        {mode === "solids" && <SolidExplorer element={element} />}

        <CameraRig controlsRef={controlsRef} onPersist={persistCamera} autoRotate={autoRotate} />
      </Canvas>

      {/* HUD HTML sobre el canvas */}
      <div className="mates3d-hud-top">
        <div className="mates3d-mode" role="tablist" aria-label="Modo del manipulativo 3D">
          <button type="button" role="tab" aria-selected={mode === "base10"}
            className={mode === "base10" ? "is-active" : ""}
            onClick={() => editable && commitMode("base10")}>Bloques</button>
          <button type="button" role="tab" aria-selected={mode === "solids"}
            className={mode === "solids" ? "is-active" : ""}
            onClick={() => editable && commitMode("solids")}>Cuerpos</button>
        </div>

        {mode === "base10" && element.data.showValue && (
          <div className="mates3d-value" aria-live="polite">
            <strong>{value.toLocaleString("es")}</strong>
            <span>{counts.cube}M · {counts.flat}C · {counts.rod}D · {counts.unit}U</span>
          </div>
        )}

        {mode === "solids" && (
          <div className="mates3d-facts">
            <strong>{facts.label}</strong>
            {facts.curved ? (
              <span>Cuerpo redondo · {facts.faces} {facts.faces === 1 ? "cara" : "caras"}</span>
            ) : (
              <span>
                C {facts.faces} · A {facts.edges} · V {facts.vertices}
                {element.data.showCounts && ` · Euler: ${facts.faces}+${facts.vertices}−${facts.edges}=2 ✓`}
              </span>
            )}
          </div>
        )}

        <div className="mates3d-cam" role="group" aria-label="Vistas de cámara">
          <button type="button" title="Vista isométrica" onClick={() => applyPreset("iso")}>Iso</button>
          <button type="button" title="Vista frontal" onClick={() => applyPreset("front")}>Frente</button>
          <button type="button" title="Vista de planta" onClick={() => applyPreset("top")}>Planta</button>
          <button type="button" title="Rotación automática" aria-pressed={autoRotate}
            className={autoRotate ? "is-active" : ""}
            onClick={() => setAutoRotate((v) => !v)}>⟳</button>
        </div>
      </div>

      {editable && mode === "base10" && (
        <div className="mates3d-hud-bottom">
          <div className="mates3d-btn-row" role="group" aria-label="Añadir piezas">
            {kindButtons.map(({ kind, label }) => (
              <button key={kind} type="button" title={`Añadir ${label.slice(1) === "U" ? "unidad" : label.slice(1) === "D" ? "decena" : label.slice(1) === "C" ? "centena" : "millar"}`}
                onClick={() => commitPieces(addPiece(pieces, kind, newId))}>
                {label}
              </button>
            ))}
          </div>
          <div className="mates3d-btn-row" role="group" aria-label="Canjes">
            <button type="button" disabled={counts.unit < 10} onClick={() => commitPieces(exchangeUp(pieces, "unit", newId))}>10U→1D</button>
            <button type="button" disabled={counts.rod < 10} onClick={() => commitPieces(exchangeUp(pieces, "rod", newId))}>10D→1C</button>
            <button type="button" disabled={counts.flat < 10} onClick={() => commitPieces(exchangeUp(pieces, "flat", newId))}>10C→1M</button>
          </div>
          <div className="mates3d-btn-row" role="group" aria-label="Descomposiciones y orden">
            <button type="button" disabled={counts.rod < 1} onClick={() => commitPieces(splitDown(pieces, "rod", newId))}>1D→10U</button>
            <button type="button" disabled={counts.flat < 1} onClick={() => commitPieces(splitDown(pieces, "flat", newId))}>1C→10D</button>
            <button type="button" disabled={counts.cube < 1} onClick={() => commitPieces(splitDown(pieces, "cube", newId))}>1M→10C</button>
            <button type="button" disabled={pieces.length === 0} onClick={() => commitPieces(arrangePieces(pieces))}>Ordenar</button>
            <button type="button" className="danger" disabled={pieces.length === 0} onClick={() => commitPieces([])}>Vaciar</button>
          </div>
        </div>
      )}

      {/* Editor: nº de lados de la base para prisma y pirámide */}
      {persist && mode === "solids" && (element.data.solid === "prism" || element.data.solid === "pyramid") && (
        <div className="mates3d-hud-bottom">
          <div className="mates3d-btn-row" role="group" aria-label="Lados de la base">
            <button type="button" title="Menos lados" disabled={element.data.solidSides <= 3}
              onClick={() => updateElementData(element.id, { solidSides: Math.max(3, element.data.solidSides - 1) })}>−</button>
            <span style={{ padding: "0 8px", alignSelf: "center", color: "#e8f1ff", fontSize: 12 }}>
              {element.data.solidSides} lados
            </span>
            <button type="button" title="Más lados" disabled={element.data.solidSides >= 12}
              onClick={() => updateElementData(element.id, { solidSides: Math.min(12, element.data.solidSides + 1) })}>+</button>
          </div>
        </div>
      )}
    </div>
  );
}
