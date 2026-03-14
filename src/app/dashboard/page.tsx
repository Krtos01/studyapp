"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface Course {
  id: string;
  name: string;
  createdTime: string;
}

type SpaceType = "School" | "Work";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [space, setSpace] = useState<SpaceType>("School");
  const [showModal, setShowModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  const fetchCourses = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/courses?space=${space}`);
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
      }
    } catch (error) {
      console.error("Failed to fetch courses:", error);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, space]);

  useEffect(() => {
    if (session?.accessToken) {
      fetchCourses();
    }
  }, [session?.accessToken, space, fetchCourses]);

  const handleCreateCourse = async () => {
    if (!newCourseName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCourseName.trim(), space }),
      });
      if (res.ok) {
        setNewCourseName("");
        setShowModal(false);
        await fetchCourses();
      }
    } catch (error) {
      console.error("Failed to create course:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleRenameCourse = async (courseId: string) => {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditName("");
        await fetchCourses();
      }
    } catch (error) {
      console.error("Failed to rename course:", error);
    }
  };

  const handleDeleteCourse = async (courseId: string, courseName: string) => {
    if (!confirm(`"${courseName}" silinsin mi?`)) return;
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchCourses();
      }
    } catch (error) {
      console.error("Failed to delete course:", error);
    }
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
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="navbar-brand-icon">📚</span>
          <span>StudyApp</span>
        </div>
        <div className="navbar-user">
          {session.user?.image && (
            <img
              src={session.user.image}
              alt=""
              className="navbar-avatar"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="navbar-username">{session.user?.name}</span>
          <button
            className="btn btn-signout"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Çıkış
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">
              {space === "School" ? "Derslerini" : "İşlerini"} düzenle ve yönet
            </p>
          </div>
        </div>

        {/* School / Work Tabs */}
        <div className="space-tabs">
          <button
            className={`space-tab school ${space === "School" ? "active" : ""}`}
            onClick={() => setSpace("School")}
          >
            🎓 School
          </button>
          <button
            className={`space-tab work ${space === "Work" ? "active" : ""}`}
            onClick={() => setSpace("Work")}
          >
            💼 Work
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <span>
              {space === "School" ? "Dersler" : "İşler"} yükleniyor...
            </span>
          </div>
        ) : (
          <div className="card-grid">
            {courses.map((course) => (
              <div key={course.id} className="course-card">
                {editingId === course.id ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <input
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameCourse(course.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleRenameCourse(course.id)}
                      >
                        Kaydet
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingId(null)}
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <a
                    href={`/dashboard/${course.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div className="course-card-icon">
                      {space === "School" ? "📖" : "📂"}
                    </div>
                    <div className="course-card-name">{course.name}</div>
                    <div className="course-card-date">
                      {new Date(course.createdTime).toLocaleDateString("tr-TR")}
                    </div>
                  </a>
                )}

                <div className="course-card-actions">
                  <button
                    className="btn-icon"
                    title="Yeniden Adlandır"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingId(course.id);
                      setEditName(course.name);
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-icon"
                    title="Sil"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteCourse(course.id, course.name);
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}

            {/* New Course Card */}
            <button
              className="new-course-card"
              onClick={() => setShowModal(true)}
            >
              <div className="new-course-icon">+</div>
              <span>
                {space === "School" ? "Yeni Ders Ekle" : "Yeni İş Ekle"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Create Course Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">
              {space === "School" ? "Yeni Ders" : "Yeni İş"}
            </h2>
            <input
              className="input"
              placeholder={space === "School" ? "Ders adı..." : "İş adı..."}
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateCourse();
              }}
            />
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                İptal
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateCourse}
                disabled={creating || !newCourseName.trim()}
              >
                {creating ? (
                  <>
                    <div className="spinner" /> Oluşturuluyor...
                  </>
                ) : (
                  "Oluştur"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
