"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type MouseEvent as ReactMouseEvent,
} from "react";

export interface CanvasNodeData {
  fileId: string;
  fileName: string;
  mimeType: string;
  category: string;
  x: number;
  y: number;
}

export interface CanvasLinkData {
  id: string;
  from: string;
  to: string;
}

export interface StickyNoteData {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: "yellow" | "green" | "blue" | "purple";
}

interface CanvasProps {
  courseId: string;
  nodes: CanvasNodeData[];
  links: CanvasLinkData[];
  stickyNotes: StickyNoteData[];
  viewport: { x: number; y: number; zoom: number };
  onNodesChange: (nodes: CanvasNodeData[]) => void;
  onLinksChange: (links: CanvasLinkData[]) => void;
  onStickyNotesChange: (notes: StickyNoteData[]) => void;
  onViewportChange: (viewport: { x: number; y: number; zoom: number }) => void;
  onNodeSelect: (node: CanvasNodeData | null) => void;
  selectedNodeId: string | null;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return "📽️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  return "📎";
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "Hoca Materyalleri":
      return "#4f8fff";
    case "Kendi Notlarım":
      return "#34d399";
    case "AI Notları":
      return "#8b5cf6";
    default:
      return "#8888a0";
  }
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 72;
const STICKY_MIN_W = 120;
const STICKY_MIN_H = 80;
const STICKY_COLORS: StickyNoteData["color"][] = ["yellow", "green", "blue", "purple"];

// ─── File Node Card ──────────────────────────────────────────
function CanvasNodeCard({
  node,
  zoom,
  screenPos,
  isSelected,
  isDragging,
  courseId,
  onMouseDown,
  onContextMenu,
  onDoubleClick,
  onStartLink,
}: {
  node: CanvasNodeData;
  zoom: number;
  screenPos: { x: number; y: number };
  isSelected: boolean;
  isDragging: boolean;
  courseId: string;
  onMouseDown: (e: ReactMouseEvent) => void;
  onContextMenu: (e: ReactMouseEvent) => void;
  onDoubleClick: (e: ReactMouseEvent) => void;
  onStartLink: (e: ReactMouseEvent) => void;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const color = getCategoryColor(node.category);
  const isImage = node.mimeType.startsWith("image/");

  useEffect(() => {
    if (!isImage) return;
    let active = true;

    fetch(`/api/courses/${courseId}/files/${node.fileId}/download`)
      .then((res) => {
        if (!res.ok) throw new Error("Thumbnail fetch failed");
        return res.blob();
      })
      .then((blob) => {
        if (active) {
          setThumbnailUrl(URL.createObjectURL(blob));
        }
      })
      .catch(console.error);

    return () => {
      active = false;
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.fileId, isImage, courseId]);

  return (
    <div
      className={`canvas-node ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""} ${thumbnailUrl ? "has-thumbnail" : ""}`}
      style={{
        left: screenPos.x,
        top: screenPos.y,
        transform: `scale(${zoom})`,
        transformOrigin: "top left",
        borderColor: isSelected ? color : undefined,
        boxShadow: isSelected ? `0 0 16px ${color}40` : undefined,
        backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : undefined,
      }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
    >
      <div className="canvas-node-overlay" />
      <div className="canvas-node-accent" style={{ background: color }} />
      <div className="canvas-node-content">
        <span className="canvas-node-icon">
          {getFileIcon(node.mimeType)}
        </span>
        <div className="canvas-node-info">
          <div className="canvas-node-name">{node.fileName}</div>
          <div className="canvas-node-category" style={{ color }}>
            {node.category}
          </div>
        </div>
      </div>

      {/* Link handle */}
      <div
        className="canvas-node-handle"
        onMouseDown={onStartLink}
        title="Bağlantı oluştur"
      />
    </div>
  );
}

// ─── Sticky Note Card ────────────────────────────────────────
function StickyNoteCard({
  note,
  zoom,
  screenPos,
  isSelected,
  isDragging,
  onMouseDown,
  onTextChange,
  onColorChange,
  onResizeStart,
  onStartLink,
  onContextMenu,
}: {
  note: StickyNoteData;
  zoom: number;
  screenPos: { x: number; y: number };
  isSelected: boolean;
  isDragging: boolean;
  onMouseDown: (e: ReactMouseEvent) => void;
  onTextChange: (text: string) => void;
  onColorChange: (color: StickyNoteData["color"]) => void;
  onResizeStart: (e: ReactMouseEvent, dir: "right" | "bottom" | "corner") => void;
  onStartLink: (e: ReactMouseEvent) => void;
  onContextMenu: (e: ReactMouseEvent) => void;
}) {
  return (
    <div
      className={`sticky-note color-${note.color} ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""}`}
      style={{
        left: screenPos.x,
        top: screenPos.y,
        width: note.width * zoom,
        height: note.height * zoom,
        transformOrigin: "top left",
      }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    >
      {/* Drag bar at top */}
      <div className="sticky-note-dragbar" onMouseDown={onMouseDown}>
        {/* Color picker dots inside drag bar */}
        <div className="sticky-note-colors">
          {STICKY_COLORS.map((c) => (
            <div
              key={c}
              className={`sticky-note-color-dot dot-${c} ${note.color === c ? "active" : ""}`}
              onMouseDown={(e) => {
                e.stopPropagation();
                onColorChange(c);
              }}
            />
          ))}
        </div>
      </div>

      {/* Textarea */}
      <textarea
        className="sticky-note-textarea"
        value={note.text}
        placeholder="Not yaz..."
        onChange={(e) => onTextChange(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ fontSize: `${0.82 * zoom}rem` }}
      />

      {/* Resize handles */}
      <div
        className="sticky-note-resize resize-right"
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, "right"); }}
      />
      <div
        className="sticky-note-resize resize-bottom"
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, "bottom"); }}
      />
      <div
        className="sticky-note-resize resize-corner"
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, "corner"); }}
      />

      {/* Link handle */}
      <div
        className="sticky-note-handle"
        onMouseDown={onStartLink}
        title="Bağlantı oluştur"
      />
    </div>
  );
}


// ─── Main Canvas Component ───────────────────────────────────
export default function Canvas({
  courseId,
  nodes,
  links,
  stickyNotes,
  viewport,
  onNodesChange,
  onLinksChange,
  onStickyNotesChange,
  onViewportChange,
  onNodeSelect,
  selectedNodeId,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [draggingNote, setDraggingNote] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [linking, setLinking] = useState<{
    fromId: string;
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId?: string;
    noteId?: string;
  } | null>(null);

  // Resize state
  const [resizing, setResizing] = useState<{
    noteId: string;
    dir: "right" | "bottom" | "corner";
    startMouseX: number;
    startMouseY: number;
    startW: number;
    startH: number;
  } | null>(null);

  // Selected sticky note (separate from file node)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Screen to canvas coords
  const screenToCanvas = useCallback(
    (sx: number, sy: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (sx - rect.left - viewport.x) / viewport.zoom,
        y: (sy - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  // Canvas to screen coords
  const canvasToScreen = useCallback(
    (cx: number, cy: number) => ({
      x: cx * viewport.zoom + viewport.x,
      y: cy * viewport.zoom + viewport.y,
    }),
    [viewport]
  );

  // Pan handling
  const handleMouseDown = (e: ReactMouseEvent) => {
    if (e.target !== containerRef.current && !(e.target as HTMLElement).classList.contains("canvas-grid")) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
    onNodeSelect(null);
    setSelectedNoteId(null);
    setContextMenu(null);
  };

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      if (isPanning) {
        onViewportChange({
          ...viewport,
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      }

      if (draggingNode) {
        const pos = screenToCanvas(e.clientX, e.clientY);
        const updated = nodes.map((n) =>
          n.fileId === draggingNode
            ? { ...n, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y }
            : n
        );
        onNodesChange(updated);
      }

      if (draggingNote) {
        const pos = screenToCanvas(e.clientX, e.clientY);
        const updated = stickyNotes.map((n) =>
          n.id === draggingNote
            ? { ...n, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y }
            : n
        );
        onStickyNotesChange(updated);
      }

      if (resizing) {
        const dx = (e.clientX - resizing.startMouseX) / viewport.zoom;
        const dy = (e.clientY - resizing.startMouseY) / viewport.zoom;
        const updated = stickyNotes.map((n) => {
          if (n.id !== resizing.noteId) return n;
          let newW = n.width;
          let newH = n.height;
          if (resizing.dir === "right" || resizing.dir === "corner") {
            newW = Math.max(STICKY_MIN_W, resizing.startW + dx);
          }
          if (resizing.dir === "bottom" || resizing.dir === "corner") {
            newH = Math.max(STICKY_MIN_H, resizing.startH + dy);
          }
          return { ...n, width: newW, height: newH };
        });
        onStickyNotesChange(updated);
      }

      if (linking) {
        const pos = screenToCanvas(e.clientX, e.clientY);
        setLinking({ ...linking, mouseX: pos.x, mouseY: pos.y });
      }
    },
    [
      isPanning, panStart, viewport,
      draggingNode, draggingNote, dragOffset,
      nodes, stickyNotes, linking, resizing,
      onViewportChange, onNodesChange, onStickyNotesChange, screenToCanvas,
    ]
  );

  const handleMouseUp = useCallback(
    (e: ReactMouseEvent) => {
      if (isPanning) setIsPanning(false);
      if (draggingNode) setDraggingNode(null);
      if (draggingNote) setDraggingNote(null);
      if (resizing) setResizing(null);

      if (linking) {
        const pos = screenToCanvas(e.clientX, e.clientY);
        const PADDING = 20;

        // Check file nodes
        const targetNode = nodes.find(
          (n) =>
            n.fileId !== linking.fromId &&
            pos.x >= n.x - PADDING &&
            pos.x <= n.x + NODE_WIDTH + PADDING &&
            pos.y >= n.y - PADDING &&
            pos.y <= n.y + NODE_HEIGHT + PADDING
        );

        // Check sticky notes
        const targetNote = stickyNotes.find(
          (n) =>
            n.id !== linking.fromId &&
            pos.x >= n.x - PADDING &&
            pos.x <= n.x + n.width + PADDING &&
            pos.y >= n.y - PADDING &&
            pos.y <= n.y + n.height + PADDING
        );

        const targetId = targetNode?.fileId ?? targetNote?.id;

        if (targetId) {
          const exists = links.some(
            (l) =>
              (l.from === linking.fromId && l.to === targetId) ||
              (l.from === targetId && l.to === linking.fromId)
          );
          if (!exists) {
            onLinksChange([
              ...links,
              {
                id: `${linking.fromId}-${targetId}`,
                from: linking.fromId,
                to: targetId,
              },
            ]);
          }
        }
        setLinking(null);
      }
    },
    [isPanning, draggingNode, draggingNote, resizing, linking, nodes, stickyNotes, links, screenToCanvas, onLinksChange]
  );

  // Zoom handling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(viewport.zoom * delta, 0.2), 3);

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      onViewportChange({
        x: mouseX - ((mouseX - viewport.x) / viewport.zoom) * newZoom,
        y: mouseY - ((mouseY - viewport.y) / viewport.zoom) * newZoom,
        zoom: newZoom,
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [viewport, onViewportChange]);

  // ─── File Node handlers ──────────────────────────────────
  const handleNodeMouseDown = (e: ReactMouseEvent, nodeId: string) => {
    e.stopPropagation();
    setContextMenu(null);
    const node = nodes.find((n) => n.fileId === nodeId);
    if (!node) return;

    const pos = screenToCanvas(e.clientX, e.clientY);
    setDragOffset({ x: pos.x - node.x, y: pos.y - node.y });
    setDraggingNode(nodeId);
    onNodeSelect(node);
    setSelectedNoteId(null);
  };

  const handleStartLink = (e: ReactMouseEvent, fromId: string) => {
    e.stopPropagation();
    // Works for both file nodes and sticky notes
    const node = nodes.find((n) => n.fileId === fromId);
    const note = stickyNotes.find((n) => n.id === fromId);
    const cx = node ? node.x + NODE_WIDTH / 2 : note ? note.x + note.width / 2 : 0;
    const cy = node ? node.y + NODE_HEIGHT / 2 : note ? note.y + note.height / 2 : 0;
    setLinking({ fromId, mouseX: cx, mouseY: cy });
  };

  // ─── Sticky Note handlers ───────────────────────────────
  const handleNoteMouseDown = (e: ReactMouseEvent, noteId: string) => {
    e.stopPropagation();
    setContextMenu(null);
    const note = stickyNotes.find((n) => n.id === noteId);
    if (!note) return;

    const pos = screenToCanvas(e.clientX, e.clientY);
    setDragOffset({ x: pos.x - note.x, y: pos.y - note.y });
    setDraggingNote(noteId);
    setSelectedNoteId(noteId);
    onNodeSelect(null);
  };

  const handleNoteTextChange = (noteId: string, text: string) => {
    onStickyNotesChange(
      stickyNotes.map((n) => (n.id === noteId ? { ...n, text } : n))
    );
  };

  const handleNoteColorChange = (noteId: string, color: StickyNoteData["color"]) => {
    onStickyNotesChange(
      stickyNotes.map((n) => (n.id === noteId ? { ...n, color } : n))
    );
  };

  const handleResizeStart = (e: ReactMouseEvent, noteId: string, dir: "right" | "bottom" | "corner") => {
    const note = stickyNotes.find((n) => n.id === noteId);
    if (!note) return;
    setResizing({
      noteId,
      dir,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startW: note.width,
      startH: note.height,
    });
  };

  // ─── Context menu ────────────────────────────────────────
  const handleNodeContextMenu = (e: ReactMouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  };

  const handleNoteContextMenu = (e: ReactMouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, noteId });
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    onNodesChange(nodes.filter((n) => n.fileId !== nodeId));
    onLinksChange(links.filter((l) => l.from !== nodeId && l.to !== nodeId));
    if (selectedNodeId === nodeId) onNodeSelect(null);
    setContextMenu(null);
  };

  // Delete sticky note
  const handleDeleteNote = (noteId: string) => {
    onStickyNotesChange(stickyNotes.filter((n) => n.id !== noteId));
    onLinksChange(links.filter((l) => l.from !== noteId && l.to !== noteId));
    if (selectedNoteId === noteId) setSelectedNoteId(null);
    setContextMenu(null);
  };

  // Delete link
  const handleDeleteLink = (linkId: string) => {
    onLinksChange(links.filter((l) => l.id !== linkId));
  };

  // ─── Link rendering helpers ──────────────────────────────
  const getEntityCenter = (id: string): { x: number; y: number } | null => {
    const node = nodes.find((n) => n.fileId === id);
    if (node) return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 };
    const note = stickyNotes.find((n) => n.id === id);
    if (note) return { x: note.x + note.width / 2, y: note.y + note.height / 2 };
    return null;
  };

  const renderLink = (link: CanvasLinkData) => {
    const fromCenter = getEntityCenter(link.from);
    const toCenter = getEntityCenter(link.to);
    if (!fromCenter || !toCenter) return null;

    const fromScreen = canvasToScreen(fromCenter.x, fromCenter.y);
    const toScreen = canvasToScreen(toCenter.x, toCenter.y);

    const dx = toScreen.x - fromScreen.x;
    const cpOffset = Math.min(Math.abs(dx) * 0.5, 100);

    const path = `M ${fromScreen.x} ${fromScreen.y} C ${fromScreen.x + cpOffset} ${fromScreen.y}, ${toScreen.x - cpOffset} ${toScreen.y}, ${toScreen.x} ${toScreen.y}`;

    return (
      <g key={link.id}>
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={12}
          style={{ cursor: "pointer" }}
          onClick={() => handleDeleteLink(link.id)}
        />
        <path
          d={path}
          fill="none"
          stroke="var(--accent-blue)"
          strokeWidth={2}
          strokeDasharray="6 3"
          opacity={0.6}
          style={{ cursor: "pointer", pointerEvents: "none" }}
        />
        <circle
          cx={(fromScreen.x + toScreen.x) / 2}
          cy={(fromScreen.y + toScreen.y) / 2}
          r={4}
          fill="var(--accent-blue)"
          opacity={0.8}
        />
      </g>
    );
  };

  const renderTempLink = () => {
    if (!linking) return null;
    const fromCenter = getEntityCenter(linking.fromId);
    if (!fromCenter) return null;

    const fromScreen = canvasToScreen(fromCenter.x, fromCenter.y);
    const toScreen = canvasToScreen(linking.mouseX, linking.mouseY);

    const dx = toScreen.x - fromScreen.x;
    const cpOffset = Math.min(Math.abs(dx) * 0.5, 100);

    const path = `M ${fromScreen.x} ${fromScreen.y} C ${fromScreen.x + cpOffset} ${fromScreen.y}, ${toScreen.x - cpOffset} ${toScreen.y}, ${toScreen.x} ${toScreen.y}`;

    return (
      <path
        d={path}
        fill="none"
        stroke="var(--accent-purple)"
        strokeWidth={2}
        strokeDasharray="4 4"
        opacity={0.8}
      />
    );
  };

  // Grid pattern background size
  const gridSize = 30 * viewport.zoom;

  return (
    <div
      ref={containerRef}
      className={`canvas-container ${isPanning ? "panning" : ""} ${linking ? "linking" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid background */}
      <div
        className="canvas-grid"
        style={{
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      />

      {/* SVG overlay for links */}
      <svg className="canvas-svg">
        {links.map(renderLink)}
        {renderTempLink()}
      </svg>

      {/* File Nodes */}
      {nodes.map((node) => {
        const screen = canvasToScreen(node.x, node.y);
        const isSelected = selectedNodeId === node.fileId;
        const isDragging = draggingNode === node.fileId;

        return (
          <CanvasNodeCard
            key={node.fileId}
            node={node}
            zoom={viewport.zoom}
            screenPos={screen}
            isSelected={isSelected}
            isDragging={isDragging}
            courseId={courseId}
            onMouseDown={(e) => handleNodeMouseDown(e, node.fileId)}
            onContextMenu={(e) => handleNodeContextMenu(e, node.fileId)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onNodeSelect(node);
            }}
            onStartLink={(e) => handleStartLink(e, node.fileId)}
          />
        );
      })}

      {/* Sticky Notes */}
      {stickyNotes.map((note) => {
        const screen = canvasToScreen(note.x, note.y);
        const isSelected = selectedNoteId === note.id;
        const isDragging = draggingNote === note.id;

        return (
          <StickyNoteCard
            key={note.id}
            note={note}
            zoom={viewport.zoom}
            screenPos={screen}
            isSelected={isSelected}
            isDragging={isDragging}
            onMouseDown={(e) => handleNoteMouseDown(e, note.id)}
            onTextChange={(text) => handleNoteTextChange(note.id, text)}
            onColorChange={(color) => handleNoteColorChange(note.id, color)}
            onResizeStart={(e, dir) => handleResizeStart(e, note.id, dir)}
            onStartLink={(e) => handleStartLink(e, note.id)}
            onContextMenu={(e) => handleNoteContextMenu(e, note.id)}
          />
        );
      })}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="canvas-context-overlay"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="canvas-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.nodeId && (
              <>
                <button
                  className="canvas-context-item"
                  onClick={() => {
                    const node = nodes.find(
                      (n) => n.fileId === contextMenu.nodeId
                    );
                    if (node) onNodeSelect(node);
                    setContextMenu(null);
                  }}
                >
                  👁️ Önizleme
                </button>
                <button
                  className="canvas-context-item"
                  onClick={() => {
                    handleStartLink(
                      { stopPropagation: () => {} } as ReactMouseEvent,
                      contextMenu.nodeId!
                    );
                    setContextMenu(null);
                  }}
                >
                  🔗 Bağlantı Oluştur
                </button>
                <button
                  className="canvas-context-item danger"
                  onClick={() => handleDeleteNode(contextMenu.nodeId!)}
                >
                  🗑️ Canvas&apos;tan Kaldır
                </button>
              </>
            )}
            {contextMenu.noteId && (
              <>
                <button
                  className="canvas-context-item"
                  onClick={() => {
                    handleStartLink(
                      { stopPropagation: () => {} } as ReactMouseEvent,
                      contextMenu.noteId!
                    );
                    setContextMenu(null);
                  }}
                >
                  🔗 Bağlantı Oluştur
                </button>
                <button
                  className="canvas-context-item danger"
                  onClick={() => handleDeleteNote(contextMenu.noteId!)}
                >
                  🗑️ Notu Sil
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Zoom indicator */}
      <div className="canvas-zoom-indicator">
        {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  );
}
