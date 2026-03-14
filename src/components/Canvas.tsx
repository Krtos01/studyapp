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

interface CanvasProps {
  courseId: string;
  nodes: CanvasNodeData[];
  links: CanvasLinkData[];
  viewport: { x: number; y: number; zoom: number };
  onNodesChange: (nodes: CanvasNodeData[]) => void;
  onLinksChange: (links: CanvasLinkData[]) => void;
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

// Subcomponent for node to manage its own thumbnail state
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

    // Fetch the thumbnail using the download route
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


export default function Canvas({
  courseId,
  nodes,
  links,
  viewport,
  onNodesChange,
  onLinksChange,
  onViewportChange,
  onNodeSelect,
  selectedNodeId,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [linking, setLinking] = useState<{
    fromId: string;
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);

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

      if (linking) {
        const pos = screenToCanvas(e.clientX, e.clientY);
        setLinking({ ...linking, mouseX: pos.x, mouseY: pos.y });
      }
    },
    [
      isPanning,
      panStart,
      viewport,
      draggingNode,
      dragOffset,
      nodes,
      linking,
      onViewportChange,
      onNodesChange,
      screenToCanvas,
    ]
  );

  const handleMouseUp = useCallback(
    (e: ReactMouseEvent) => {
      if (isPanning) setIsPanning(false);

      if (draggingNode) {
        setDraggingNode(null);
      }

      if (linking) {
        // Check if dropped on a node (with increased threshold)
        const pos = screenToCanvas(e.clientX, e.clientY);
        const PADDING = 20 / viewport.zoom; // 20px extra drop zone margin

        const targetNode = nodes.find(
          (n) =>
            n.fileId !== linking.fromId &&
            pos.x >= n.x - PADDING &&
            pos.x <= n.x + (NODE_WIDTH / viewport.zoom) + PADDING &&
            pos.y >= n.y - PADDING &&
            pos.y <= n.y + (NODE_HEIGHT / viewport.zoom) + PADDING
        );

        if (targetNode) {
          // Check no duplicate link
          const exists = links.some(
            (l) =>
              (l.from === linking.fromId && l.to === targetNode.fileId) ||
              (l.from === targetNode.fileId && l.to === linking.fromId)
          );
          if (!exists) {
            onLinksChange([
              ...links,
              {
                id: `${linking.fromId}-${targetNode.fileId}`,
                from: linking.fromId,
                to: targetNode.fileId,
              },
            ]);
          }
        }
        setLinking(null);
      }
    },
    [isPanning, draggingNode, linking, nodes, links, viewport.zoom, screenToCanvas, onLinksChange]
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

  // Node drag start
  const handleNodeMouseDown = (e: ReactMouseEvent, nodeId: string) => {
    e.stopPropagation();
    setContextMenu(null);
    const node = nodes.find((n) => n.fileId === nodeId);
    if (!node) return;

    const pos = screenToCanvas(e.clientX, e.clientY);
    setDragOffset({ x: pos.x - node.x, y: pos.y - node.y });
    setDraggingNode(nodeId);
    onNodeSelect(node);
  };

  // Start linking
  const handleStartLink = (e: ReactMouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.fileId === nodeId);
    if (!node) return;
    setLinking({
      fromId: nodeId,
      mouseX: node.x + NODE_WIDTH / viewport.zoom / 2,
      mouseY: node.y + NODE_HEIGHT / viewport.zoom / 2,
    });
  };

  // Context menu
  const handleNodeContextMenu = (e: ReactMouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    onNodesChange(nodes.filter((n) => n.fileId !== nodeId));
    onLinksChange(links.filter((l) => l.from !== nodeId && l.to !== nodeId));
    if (selectedNodeId === nodeId) onNodeSelect(null);
    setContextMenu(null);
  };

  // Delete link
  const handleDeleteLink = (linkId: string) => {
    onLinksChange(links.filter((l) => l.id !== linkId));
  };

  // Render bezier link
  const renderLink = (link: CanvasLinkData) => {
    const fromNode = nodes.find((n) => n.fileId === link.from);
    const toNode = nodes.find((n) => n.fileId === link.to);
    if (!fromNode || !toNode) return null;

    const fromScreen = canvasToScreen(
      fromNode.x + NODE_WIDTH / viewport.zoom / 2,
      fromNode.y + NODE_HEIGHT / viewport.zoom / 2
    );
    const toScreen = canvasToScreen(
      toNode.x + NODE_WIDTH / viewport.zoom / 2,
      toNode.y + NODE_HEIGHT / viewport.zoom / 2
    );

    const dx = toScreen.x - fromScreen.x;
    const cpOffset = Math.min(Math.abs(dx) * 0.5, 100);

    const path = `M ${fromScreen.x} ${fromScreen.y} C ${fromScreen.x + cpOffset} ${fromScreen.y}, ${toScreen.x - cpOffset} ${toScreen.y}, ${toScreen.x} ${toScreen.y}`;

    return (
      <g key={link.id}>
        {/* Invisible wider path for easier click targeting */}
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
        {/* Midpoint dot */}
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

  // Render temporary link while dragging
  const renderTempLink = () => {
    if (!linking) return null;
    const fromNode = nodes.find((n) => n.fileId === linking.fromId);
    if (!fromNode) return null;

    const fromScreen = canvasToScreen(
      fromNode.x + NODE_WIDTH / viewport.zoom / 2,
      fromNode.y + NODE_HEIGHT / viewport.zoom / 2
    );
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

      {/* Nodes */}
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
                  contextMenu.nodeId
                );
                setContextMenu(null);
              }}
            >
              🔗 Bağlantı Oluştur
            </button>
            <button
              className="canvas-context-item danger"
              onClick={() => handleDeleteNode(contextMenu.nodeId)}
            >
              🗑️ Canvas'tan Kaldır
            </button>
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
