"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import Canvas, {
  type CanvasNodeData,
  type CanvasLinkData,
} from "@/components/Canvas";
import CategoryDropdown from "@/components/CategoryDropdown";
import FilePreview from "@/components/FilePreview";

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  webViewLink: string;
}

const CATEGORIES = [
  { name: "Hoca Materyalleri", icon: "👨‍🏫", color: "cat-blue" },
  { name: "Kendi Notlarım", icon: "📝", color: "cat-green" },
  { name: "AI Notları", icon: "🤖", color: "cat-purple" },
] as const;

export default function CourseDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;

  const [courseName, setCourseName] = useState("");
  const [nodes, setNodes] = useState<CanvasNodeData[]>([]);
  const [links, setLinks] = useState<CanvasLinkData[]>([]);
  const [viewport, setViewport] = useState({ x: 60, y: 60, zoom: 1 });
  const [selectedNode, setSelectedNode] = useState<CanvasNodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasMainRef = useRef<HTMLDivElement>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef({ nodes, links, viewport });

  useEffect(() => {
    stateRef.current = { nodes, links, viewport };
  }, [nodes, links, viewport]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Fetch course name
  useEffect(() => {
    if (!session?.accessToken || !courseId) return;
    fetch(`/api/courses/${courseId}/name`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.name) setCourseName(data.name);
      })
      .catch(console.error);
  }, [session?.accessToken, courseId]);

  // Load canvas state
  useEffect(() => {
    if (!session?.accessToken || !courseId) return;
    setLoading(true);
    fetch(`/api/courses/${courseId}/canvas`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setNodes(data.nodes || []);
          setLinks(data.links || []);
          setViewport(data.viewport || { x: 60, y: 60, zoom: 1 });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session?.accessToken, courseId]);

  // Auto-save canvas state (debounced)
  const triggerSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      const { nodes, links, viewport } = stateRef.current;
      fetch(`/api/courses/${courseId}/canvas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, links, viewport }),
      }).catch(console.error);
    }, 2000);
  }, [courseId]);

  // Save on changes
  useEffect(() => {
    if (!loading) triggerSave();
  }, [nodes, links, viewport, loading, triggerSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Add file to canvas
  const handleAddToCanvas = (file: FileItem, category: string) => {
    // Check if already on canvas
    if (nodes.some((n) => n.fileId === file.id)) return;

    const newNode: CanvasNodeData = {
      fileId: file.id,
      fileName: file.name,
      mimeType: file.mimeType,
      category,
      x: (200 + Math.random() * 300 - viewport.x) / viewport.zoom,
      y: (200 + Math.random() * 200 - viewport.y) / viewport.zoom,
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const handleNodeSelect = (node: CanvasNodeData | null) => {
    setSelectedNode(node);
  };

  const handleOpenInDrive = (fileId: string) => {
    // Get canvas-main area dimensions for popup sizing
    const rect = canvasMainRef.current?.getBoundingClientRect();
    const areaW = rect?.width ?? window.innerWidth;
    const areaH = rect?.height ?? window.innerHeight;
    const areaLeft = rect?.left ?? 0;
    const areaTop = rect?.top ?? 0;

    const popupW = Math.round(areaW * 0.8);
    const popupH = Math.round(areaH * 0.8);
    const popupLeft = Math.round(window.screenX + areaLeft + (areaW - popupW) / 2);
    const popupTop = Math.round(window.screenY + areaTop + (areaH - popupH) / 2);

    window.open(
      `https://drive.google.com/file/d/${fileId}/preview`,
      "_blank",
      `popup=yes,width=${popupW},height=${popupH},left=${popupLeft},top=${popupTop}`
    );
  };

  const handleRemoveFromCanvas = (fileId: string) => {
    setNodes((prev) => prev.filter((n) => n.fileId !== fileId));
    setLinks((prev) =>
      prev.filter((l) => l.from !== fileId && l.to !== fileId)
    );
    setSelectedNode(null);
  };

  if (status === "loading" || !session) {
    return (
      <div className="loading-container" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
        <span>Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="canvas-page">
      {/* Top toolbar */}
      <div className="canvas-toolbar">
        <div className="canvas-toolbar-left">
          <a href="/dashboard" className="btn btn-ghost">
            ← Dashboard
          </a>
          <div className="canvas-toolbar-title">
            <span className="canvas-toolbar-icon">📖</span>
            <span>{courseName || "..."}</span>
          </div>
        </div>

        <div className="canvas-toolbar-dropdowns">
          {CATEGORIES.map((cat) => (
            <CategoryDropdown
              key={cat.name}
              label={cat.name}
              icon={cat.icon}
              categoryName={cat.name}
              courseId={courseId}
              colorClass={cat.color}
              onAddToCanvas={(file) => handleAddToCanvas(file, cat.name)}
            />
          ))}
        </div>

        <div className="canvas-toolbar-right">
          {session.user?.image && (
            <img
              src={session.user.image}
              alt=""
              className="navbar-avatar"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="canvas-main" ref={canvasMainRef}>
        {loading ? (
          <div className="loading-container" style={{ flex: 1 }}>
            <div className="spinner" />
            <span>Canvas yükleniyor...</span>
          </div>
        ) : (
          <Canvas
            courseId={courseId}
            nodes={nodes}
            links={links}
            viewport={viewport}
            onNodesChange={setNodes}
            onLinksChange={setLinks}
            onViewportChange={setViewport}
            onNodeSelect={handleNodeSelect}
            selectedNodeId={selectedNode?.fileId ?? null}
          />
        )}

        <FilePreview
          courseId={courseId}
          file={selectedNode}
          onClose={() => setSelectedNode(null)}
          onOpenInDrive={handleOpenInDrive}
          onDelete={handleRemoveFromCanvas}
        />
      </div>
    </div>
  );
}
