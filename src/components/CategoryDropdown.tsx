"use client";

import { useState, useRef, useEffect } from "react";

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  webViewLink: string;
}

interface CategoryDropdownProps {
  label: string;
  icon: string;
  categoryName: string;
  courseId: string;
  colorClass: string;
  onAddToCanvas: (file: FileItem) => void;
}

export default function CategoryDropdown({
  label,
  icon,
  categoryName,
  courseId,
  colorClass,
  onAddToCanvas,
}: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/files?category=${encodeURIComponent(categoryName)}&t=${Date.now()}`
      );
      if (res.ok) {
        setFiles(await res.json());
        setHasFetched(true);
      } else {
        alert("Dosyalar alınırken bir hata oluştu.");
      }
    } catch (err) {
      console.error("Failed to fetch files:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!open && !hasFetched) fetchFiles();
    setOpen(!open);
  };

  const handleUpload = async (fileList: FileList) => {
    if (!fileList.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", categoryName);
        const res = await fetch(`/api/courses/${courseId}/files`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          alert(`Hata: ${file.name} yüklenemedi. ${errorData.error || ""}`);
        }
      }
      await fetchFiles();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Ağ hatası nedeniyle dosya yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`dropdown ${colorClass}`} ref={dropdownRef}>
      <button className="dropdown-trigger" onClick={handleToggle}>
        <span className="dropdown-icon">{icon}</span>
        <span className="dropdown-label">{label}</span>
        <span className={`dropdown-arrow ${open ? "open" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="dropdown-menu">
          <div className="dropdown-header">
            <span>{label}</span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                className="btn btn-sm btn-ghost"
                style={{ padding: "0 0.5rem", fontSize: "1rem" }}
                onClick={(e) => {
                  e.stopPropagation();
                  fetchFiles();
                }}
                disabled={loading}
                title="Yenile"
              >
                🔄
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "⏳" : "📤"} Yükle
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files) handleUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <div className="dropdown-items">
            {loading ? (
              <div className="dropdown-loading">
                <div className="spinner" />
              </div>
            ) : files.length === 0 ? (
              <div className="dropdown-empty">Dosya yok</div>
            ) : (
              files.map((file) => (
                <button
                  key={file.id}
                  className="dropdown-item"
                  onClick={() => {
                    onAddToCanvas(file);
                    setOpen(false);
                  }}
                  title="Canvas'a ekle"
                >
                  <span className="dropdown-item-icon">
                    {getFileIcon(file.mimeType)}
                  </span>
                  <span className="dropdown-item-name">{file.name}</span>
                  <span className="dropdown-item-add">+</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
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
