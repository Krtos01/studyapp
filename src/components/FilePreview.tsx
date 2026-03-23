"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import react-pdf to avoid SSR issues (DOMMatrix not available on server)
const Document = dynamic(
  () => import("react-pdf").then((mod) => {
    mod.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.pdfjs.version}/build/pdf.worker.min.mjs`;
    return mod.Document;
  }),
  { ssr: false }
);
const Page = dynamic(
  () => import("react-pdf").then((mod) => mod.Page),
  { ssr: false }
);

// CSS imports for react-pdf (these are safe for SSR)
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

interface FilePreviewProps {
  courseId: string;
  file: {
    fileId: string;
    fileName: string;
    mimeType: string;
    category: string;
  } | null;
  onClose: () => void;
  onOpenInDrive: (fileId: string) => void;
  onDelete: (fileId: string) => void;
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "Hoca Materyalleri":
      return "var(--accent-blue)";
    case "Kendi Notlarım":
      return "var(--accent-green)";
    case "AI Notları":
      return "var(--accent-purple)";
    default:
      return "var(--text-muted)";
  }
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📽️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  return "📎";
}

export default function FilePreview({
  courseId,
  file,
  onClose,
  onOpenInDrive,
  onDelete,
}: FilePreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pptxContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!file) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      return;
    }

    let active = true;
    setLoading(true);

    fetch(`/api/courses/${courseId}/files/${file.fileId}/download`)
      .then((res) => {
        if (!res.ok) throw new Error("Download failed");
        return res.blob();
      })
      .then(async (blob) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        // If PPTX, render it
        if (
          file.mimeType.includes("presentation") ||
          file.mimeType.includes("powerpoint")
        ) {
          try {
            const pptxgen = await import("pptx-preview");
            setTimeout(() => {
              if (pptxContainerRef.current) {
                // pptx-preview has an init API or default renderPptx
                if ('renderPptx' in pptxgen) {
                  (pptxgen as any).renderPptx(blob, pptxContainerRef.current).catch(console.error);
                } else if ('default' in pptxgen && typeof pptxgen.default === 'function') {
                  (pptxgen.default as any)(blob, pptxContainerRef.current).catch(console.error);
                } else {
                  console.error("pptx-preview: Unknown export structure", pptxgen);
                }
              }
            }, 100);
          } catch (err) {
            console.error("Failed to load pptx-preview:", err);
          }
        }
      })
      .catch((err) => {
        console.error("Preview fetch error:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [file, courseId]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (!file) return null;

  const isImage = file.mimeType.startsWith("image/");
  const isPdf =
    file.mimeType.includes("pdf") ||
    // Google Workspace exports as PDF
    file.mimeType === "application/vnd.google-apps.document" ||
    file.mimeType === "application/vnd.google-apps.spreadsheet";
  const isPptx =
    file.mimeType.includes("presentation") ||
    file.mimeType.includes("powerpoint");

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <h3 className="preview-title">Dosya Detayı</h3>
        <button className="btn-icon" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="preview-content">
        {loading ? (
          <div className="preview-loading">
            <div className="spinner" />
            <span style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--text-muted)" }}>
              İçerik yükleniyor...
            </span>
          </div>
        ) : blobUrl ? (
          <div className="preview-viewer">
            {isImage ? (
              <img src={blobUrl} alt={file.fileName} className="preview-img" />
            ) : isPdf ? (
              <div className="preview-pdf">
                <Document file={blobUrl} loading={<div className="spinner"/>}>
                  <Page pageNumber={1} width={240} renderTextLayer={false} renderAnnotationLayer={false} />
                </Document>
              </div>
            ) : isPptx ? (
              <div
                className="preview-pptx"
                ref={pptxContainerRef}
                style={{ width: "100%", minHeight: 150 }}
              />
            ) : (
              <div className="preview-fallback">
                <div className="preview-icon">{getFileIcon(file.mimeType)}</div>
                <div className="preview-meta">Önizleme desteklenmiyor</div>
              </div>
            )}
          </div>
        ) : (
          <div className="preview-fallback">
            <div className="preview-icon">{getFileIcon(file.mimeType)}</div>
            <div className="preview-meta">Önizleme yüklenemedi</div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div className="preview-name">{file.fileName}</div>
          <div
            className="preview-category"
            style={{ color: getCategoryColor(file.category), marginTop: 4 }}
          >
            {file.category}
          </div>
        </div>
      </div>

      <div className="preview-actions">
        <button
          className="btn btn-primary"
          onClick={() => onOpenInDrive(file.fileId)}
          style={{ width: "100%" }}
        >
          🔗 Google Drive'da Aç
        </button>
        <button
          className="btn btn-danger"
          onClick={() => onDelete(file.fileId)}
          style={{ width: "100%", marginTop: 8 }}
        >
          🗑️ Canvas'tan Kaldır
        </button>
      </div>
    </div>
  );
}
