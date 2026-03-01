import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Layout,
  Maximize2,
  Download,
  Trash2,
  Loader2,
  X,
  Send,
  Split,
  RefreshCw,
  Wand2,
  Pencil,
  Save,
  Check,
  Code2,
  Terminal,
  Video,
  Type as TypeIcon,
  FolderOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Slide, SlideType, ImageStyle } from "./types";
import {
  generatePresentation,
  generateImage,
  splitSlide,
  rewriteSlide,
} from "./services/gemini";
import {
  savePresentation,
  updatePresentation,
  listPresentations,
  loadPresentation,
  deletePresentation,
} from "./services/storage";
import type { SavedPresentationMeta } from "./types";

const IMAGE_STYLES: ImageStyle[] = [
  {
    id: "minimalist",
    name: "Minimalista",
    prompt:
      "estilo minimalista, limpio, fondo neutro, alta calidad, profesional",
  },
  {
    id: "cinematic",
    name: "Cinematográfico",
    prompt:
      "estilo cinematográfico, iluminación dramática, 8k, hiperdetallado, realista",
  },
  {
    id: "illustration",
    name: "Ilustración",
    prompt:
      "estilo ilustración moderna, colores planos, arte digital, limpio, vectorial",
  },
  {
    id: "3d",
    name: "Render 3D",
    prompt:
      "estilo render 3D, suave, iluminación global, estilo Apple, materiales premium",
  },
  {
    id: "abstract",
    name: "Abstracto",
    prompt:
      "estilo abstracto, formas geométricas, conceptual, artístico, colores vibrantes",
  },
  {
    id: "tech-cartoon",
    name: "Tech Stickman",
    prompt:
      "estilo ilustración de personajes tipo stickman con volumen, caras simples con ojos de puntos, líneas negras gruesas y muy limpias, colores planos vibrantes, fondo blanco puro, estética de blog de tecnología moderna, personajes con sudaderas y gafas, estilo vectorial minimalista, sin sombras complejas, muy limpio",
  },
];

const LANGUAGES = [
  { id: "javascript", name: "JavaScript" },
  { id: "typescript", name: "TypeScript" },
  { id: "python", name: "Python" },
  { id: "php", name: "PHP" },
  { id: "java", name: "Java" },
  { id: "csharp", name: "C#" },
  { id: "cpp", name: "C++" },
  { id: "go", name: "Go" },
  { id: "ruby", name: "Ruby" },
  { id: "rust", name: "Rust" },
  { id: "bash", name: "Bash" },
  { id: "sql", name: "SQL" },
  { id: "html", name: "HTML" },
  { id: "css", name: "CSS" },
  { id: "json", name: "JSON" },
  { id: "yaml", name: "YAML" },
  { id: "markdown", name: "Markdown" },
];

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [topic, setTopic] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showRewriteModal, setShowRewriteModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [splitPrompt, setSplitPrompt] = useState("");
  const [rewritePrompt, setRewritePrompt] = useState("");
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>(
    IMAGE_STYLES[0]
  );
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editLanguage, setEditLanguage] = useState("javascript");
  const [editFontSize, setEditFontSize] = useState(14);
  const [isResizing, setIsResizing] = useState(false);
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [showSavedListModal, setShowSavedListModal] = useState(false);
  const [savedList, setSavedList] = useState<SavedPresentationMeta[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [homeTab, setHomeTab] = useState<"recent" | "mine" | "templates">(
    "recent"
  );
  const videoLogoRef = useRef<HTMLVideoElement>(null);

  const currentSlide = slides[currentIndex];
  const DEFAULT_IMAGE_WIDTH_PERCENT = 40;
  const imageWidthPercent =
    currentSlide?.imageWidthPercent ?? DEFAULT_IMAGE_WIDTH_PERCENT;

  useEffect(() => {
    if (slides.length === 0) {
      listPresentations()
        .then(setSavedList)
        .catch(() => setSavedList([]));
    }
  }, [slides.length]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const container = document.getElementById("slide-container");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.min(Math.max(15, 100 - (x / rect.width) * 100), 85);
      setSlides((prev) => {
        const idx = currentIndex;
        if (idx < 0 || idx >= prev.length) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], imageWidthPercent: percent };
        return updated;
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
    } else {
      document.body.style.cursor = "default";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, currentIndex]);

  useEffect(() => {
    if (currentSlide) {
      setEditTitle(currentSlide.title);
      setEditContent(formatMarkdown(currentSlide.content));
      setEditCode(currentSlide.code || "");
      setEditLanguage(currentSlide.language || "javascript");
      setEditFontSize(currentSlide.fontSize || 14);
      setIsEditing(false);
    }
  }, [currentIndex]);

  const handleSaveManualEdit = () => {
    if (!currentSlide) return;

    setSlides((prevSlides) => {
      const updated = [...prevSlides];
      updated[currentIndex] = {
        ...updated[currentIndex],
        title: editTitle,
        content: editContent,
        code: editCode,
        language: editLanguage,
        fontSize: editFontSize,
      };
      return updated;
    });
    setIsEditing(false);
  };

  const toggleContentType = () => {
    const updatedSlides = [...slides];
    let newType: "image" | "code" | "video" = "code";
    if (currentSlide.contentType === "code") newType = "video";
    else if (currentSlide.contentType === "video") newType = "image";
    else newType = "code";

    updatedSlides[currentIndex] = {
      ...currentSlide,
      contentType: newType,
    };
    setSlides(updatedSlides);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    videoLogoRef.current?.play();
    setIsLoading(true);
    try {
      const generatedSlides = await generatePresentation(topic);
      const cleanedSlides = generatedSlides.map((slide) => ({
        ...slide,
        content: formatMarkdown(slide.content),
      }));
      setSlides(cleanedSlides);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Error generating presentation:", error);
      alert(
        "Hubo un error al generar la presentación. Por favor intenta de nuevo."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatMarkdown = (content: string) => {
    if (!content) return "";
    // Reemplaza \n literal por saltos de línea reales
    return content.replace(/\\n/g, "\n");
  };

  const handleImageGenerate = async () => {
    if (!imagePrompt.trim()) return;

    setIsGeneratingImage(true);
    const currentSlide = slides[currentIndex];
    const slideContext = `Título: ${currentSlide.title}. Contenido: ${currentSlide.content}`;

    try {
      const imageUrl = await generateImage(
        slideContext,
        imagePrompt,
        selectedStyle.prompt
      );
      if (imageUrl) {
        const updatedSlides = [...slides];
        updatedSlides[currentIndex] = { ...currentSlide, imageUrl };
        setSlides(updatedSlides);
        setShowImageModal(false);
        setImagePrompt("");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      alert("Error al generar la imagen.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSplitSlide = async () => {
    if (!splitPrompt.trim()) return;
    setIsProcessing(true);
    try {
      const newSlides = await splitSlide(slides[currentIndex], splitPrompt);
      if (newSlides.length > 0) {
        const cleanedNewSlides = newSlides.map((slide) => ({
          ...slide,
          content: formatMarkdown(slide.content),
        }));
        const updatedSlides = [...slides];
        updatedSlides.splice(currentIndex, 1, ...cleanedNewSlides);
        setSlides(updatedSlides);
        setShowSplitModal(false);
        setSplitPrompt("");
      }
    } catch (error) {
      console.error("Error splitting slide:", error);
      alert("Error al dividir la diapositiva.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRewriteSlide = async () => {
    if (!rewritePrompt.trim()) return;
    setIsProcessing(true);
    try {
      const result = await rewriteSlide(slides[currentIndex], rewritePrompt);
      const updatedSlides = [...slides];
      updatedSlides[currentIndex] = {
        ...slides[currentIndex],
        title: result.title,
        content: formatMarkdown(result.content),
      };
      setSlides(updatedSlides);
      setShowRewriteModal(false);
      setRewritePrompt("");
    } catch (error) {
      console.error("Error rewriting slide:", error);
      alert("Error al replantear la diapositiva.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveVideoUrl = () => {
    if (!videoUrlInput.trim()) return;
    const updatedSlides = [...slides];
    updatedSlides[currentIndex] = {
      ...currentSlide,
      videoUrl: videoUrlInput.trim(),
      contentType: "video",
    };
    setSlides(updatedSlides);
    setShowVideoModal(false);
    setVideoUrlInput("");
  };

  const handleSave = async () => {
    if (slides.length === 0) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const presentation = { topic: topic || "Sin título", slides };
      if (currentSavedId) {
        await updatePresentation(currentSavedId, presentation);
        setSaveMessage("Guardado");
      } else {
        const id = await savePresentation(presentation);
        setCurrentSavedId(id);
        setSaveMessage("Guardado");
      }
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (e) {
      console.error(e);
      setSaveMessage("Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const openSavedListModal = async () => {
    setShowSavedListModal(true);
    try {
      const list = await listPresentations();
      setSavedList(list);
    } catch (e) {
      console.error(e);
      setSavedList([]);
    }
  };

  const handleOpenSaved = async (id: string) => {
    try {
      const saved = await loadPresentation(id);
      setTopic(saved.topic);
      setSlides(saved.slides);
      setCurrentIndex(0);
      setCurrentSavedId(saved.id);
      setShowSavedListModal(false);
    } catch (e) {
      console.error(e);
      alert("No se pudo abrir la presentación.");
    }
  };

  const handleDeleteSaved = async (id: string) => {
    if (!confirm("¿Eliminar esta presentación guardada?")) return;
    try {
      await deletePresentation(id);
      if (currentSavedId === id) {
        setCurrentSavedId(null);
        setTopic("");
        setSlides([]);
      }
      setSavedList((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error(e);
      alert("Error al eliminar.");
    }
  };

  const nextSlide = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        isEditing
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        prevSlide();
      } else if (e.key === "Escape" && isPreviewMode) {
        setIsPreviewMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, slides.length, isEditing, isPreviewMode]);

  if (slides.length === 0) {
    const displayList = homeTab === "templates" ? [] : savedList;
    return (
      <div className="min-h-screen bg-[#F6F6F6] flex flex-col font-sans">
        {/* Chat / Entrada principal (centrado como al inicio) */}
        <div className="min-h-[55vh] flex flex-col items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl w-full text-center space-y-8"
          >
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-64 h-64 rounded-3xl overflow-hidden mb-4 bg-transparent">
                <video
                  ref={videoLogoRef}
                  src="./video-logo 2.mp4"
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                  aria-hidden
                />
              </div>
              <h1 className="text-5xl font-medium tracking-tight text-stone-900 font-serif italic">
                Sl<span className="text-emerald-600">ai</span>m
              </h1>
              <p className="text-stone-600 text-lg max-w-md mx-auto">
                Transforma tus ideas en presentaciones profesionales con el
                poder de la Inteligencia Artificial.
              </p>
            </div>
            <form onSubmit={handleGenerate} className="relative group">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="¿Sobre qué quieres hablar hoy?"
                className="w-full px-8 py-6 bg-white rounded-2xl shadow-sm border border-stone-200 text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all pr-32"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !topic.trim()}
                className="absolute right-3 top-3 bottom-3 px-6 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Sparkles size={20} />
                )}
                {isLoading ? "Generando..." : "Crear"}
              </button>
            </form>
            <div className="flex flex-wrap justify-center gap-2 pt-4">
              {[
                "Historia del Arte",
                "Futuro de la IA",
                "Cocina Mediterránea",
                "Exploración Espacial",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setTopic(suggestion)}
                  className="px-4 py-2 bg-white border border-stone-200 rounded-full text-sm text-stone-600 hover:border-emerald-500 hover:text-emerald-600 transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Panel de diapositivas creadas */}
        <div className="flex-1 min-h-[280px] px-6 pb-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="h-full max-w-6xl mx-auto bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col overflow-hidden"
          >
            {/* Pestañas y Explorar todo */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 flex-shrink-0">
              <div className="flex gap-1">
                {[
                  { id: "recent" as const, label: "Vistos recientemente" },
                  { id: "mine" as const, label: "Mis presentaciones" },
                  { id: "templates" as const, label: "Plantillas" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setHomeTab(tab.id)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      homeTab === tab.id
                        ? "bg-stone-100 text-stone-900"
                        : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={openSavedListModal}
                className="text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Explorar todo →
              </button>
            </div>

            {/* Carrusel de tarjetas */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-5">
              {homeTab === "templates" ? (
                <div className="h-full flex items-center justify-center text-stone-500">
                  Próximamente: plantillas reutilizables
                </div>
              ) : displayList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-500 gap-2">
                  <FolderOpen size={48} className="opacity-50" />
                  <p>No hay presentaciones guardadas.</p>
                  <p className="text-sm">
                    Crea una arriba y guárdala para verla aquí.
                  </p>
                </div>
              ) : (
                <div className="flex gap-5 pb-2 h-full">
                  {displayList.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleOpenSaved(p.id)}
                      className="flex-shrink-0 w-72 rounded-xl bg-stone-50 border border-stone-200 overflow-hidden hover:border-emerald-500/50 hover:shadow-md transition-all text-left group"
                    >
                      <div className="aspect-video bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center p-4 relative">
                        <Layout
                          className="text-stone-400 group-hover:text-emerald-500 transition-colors"
                          size={48}
                        />
                        <span className="absolute bottom-2 right-2 text-xs font-medium text-stone-400">
                          {p.slideCount} slides
                        </span>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-stone-900 truncate">
                          {p.topic}
                        </h3>
                        <p className="text-xs text-stone-500 mt-1">
                          {p.slideCount} diapositivas ·{" "}
                          {new Date(p.savedAt).toLocaleDateString()}
                        </p>
                        <span className="inline-flex items-center gap-1.5 mt-3 text-sm text-emerald-600 group-hover:text-emerald-700">
                          Abrir
                          <ChevronRight size={16} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const openImageModal = () => {
    setImagePrompt(currentSlide.imagePrompt || "");
    setShowImageModal(true);
  };

  return (
    <div className="h-screen bg-[#E4E3E0] flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-white border-b border-stone-300 px-6 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setSlides([]);
              setTopic("");
              setCurrentSavedId(null);
            }}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-600"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="font-serif italic text-xl text-stone-900">
            SlideAI: {topic || "Nueva presentación"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openSavedListModal}
            className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg flex items-center gap-2 hover:bg-stone-200 transition-colors"
          >
            <FolderOpen size={18} />
            Mis presentaciones
          </button>
          {slides.length > 0 && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-70 transition-colors"
            >
              {isSaving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {saveMessage || (currentSavedId ? "Guardar cambios" : "Guardar")}
            </button>
          )}
          <button
            onClick={() => setIsPreviewMode(true)}
            className="px-4 py-2 bg-stone-900 text-white rounded-lg flex items-center gap-2 hover:bg-stone-800 transition-colors"
          >
            <Maximize2 size={18} />
            Vista Previa
          </button>
        </div>
      </header>

      {/* Modal: Mis presentaciones */}
      {showSavedListModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowSavedListModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-semibold text-stone-900">
                Mis presentaciones
              </h3>
              <button
                onClick={() => setShowSavedListModal(false)}
                className="p-2 hover:bg-stone-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {savedList.length === 0 ? (
                <p className="text-stone-500 text-center py-8">
                  No hay presentaciones guardadas.
                </p>
              ) : (
                <ul className="space-y-2">
                  {savedList.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-lg bg-stone-50 border border-stone-200"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-stone-900 truncate">
                          {p.topic}
                        </p>
                        <p className="text-xs text-stone-500">
                          {p.slideCount} diapositivas ·{" "}
                          {new Date(p.savedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenSaved(p.id)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                        >
                          Abrir
                        </button>
                        <button
                          onClick={() => handleDeleteSaved(p.id)}
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar - Thumbnails */}
        <aside className="w-64 bg-stone-100 border-r border-stone-300 overflow-y-auto p-4 space-y-4 hidden md:block shrink-0">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "w-full aspect-video rounded-lg border-2 transition-all overflow-hidden relative group shrink-0",
                currentIndex === index
                  ? "border-emerald-600 ring-2 ring-emerald-500/20"
                  : "border-stone-300 hover:border-stone-400"
              )}
            >
              <div className="absolute inset-0 bg-white p-2 flex flex-col">
                <span className="text-[8px] uppercase tracking-widest text-stone-400 mb-1">
                  Slide {index + 1}
                </span>
                <span className="text-[10px] font-medium text-stone-900 line-clamp-2 text-left leading-tight">
                  {slide.title}
                </span>
                <div className="mt-auto flex gap-1">
                  <div className="h-1 w-8 bg-stone-200 rounded-full" />
                  <div className="h-1 w-4 bg-stone-200 rounded-full" />
                </div>
              </div>
              {slide.imageUrl && (
                <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
              )}
            </button>
          ))}
        </aside>

        {/* Editor Area */}
        <section className="flex-1 flex flex-col p-8 relative overflow-hidden items-center justify-center bg-stone-200/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              id="slide-container"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className={cn(
                "w-full max-w-5xl aspect-video bg-white shadow-2xl rounded-xl overflow-hidden flex relative border border-stone-200",
                currentSlide.type === "chapter"
                  ? "justify-center items-center"
                  : ""
              )}
            >
              {currentSlide.type === "chapter" ? (
                <div className="text-center p-12 space-y-6 overflow-y-auto max-h-full w-full">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: 60 }}
                    className="h-1 bg-emerald-600 mx-auto rounded-full"
                  />
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-6xl font-serif italic text-stone-900 leading-tight text-center bg-transparent border-b border-stone-200 focus:outline-none focus:border-emerald-500 w-full"
                    />
                  ) : (
                    <h1 className="text-6xl font-serif italic text-stone-900 leading-tight">
                      {currentSlide.title}
                    </h1>
                  )}
                  {currentSlide.subtitle && (
                    <p className="text-2xl text-stone-500 font-light tracking-wide uppercase">
                      {currentSlide.subtitle}
                    </p>
                  )}
                  {isEditing && (
                    <button
                      onClick={handleSaveManualEdit}
                      className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                    >
                      Guardar Diapositiva
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex-1 p-12 flex flex-col overflow-hidden">
                    <div className="mb-8 shrink-0 flex items-start justify-between">
                      <div className="flex-1 mr-4">
                        <span className="text-xs uppercase tracking-[0.2em] text-emerald-600 font-bold mb-2 block">
                          Sección {currentIndex + 1}
                        </span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="text-4xl font-serif italic text-stone-900 leading-tight bg-transparent border-b border-stone-200 focus:outline-none focus:border-emerald-500 w-full"
                          />
                        ) : (
                          <h2 className="text-4xl font-serif italic text-stone-900 leading-tight">
                            {currentSlide.title}
                          </h2>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (isEditing) {
                              handleSaveManualEdit();
                            } else {
                              setIsEditing(true);
                            }
                          }}
                          className={cn(
                            "p-2 rounded-lg transition-all shadow-sm group relative",
                            isEditing
                              ? "bg-emerald-600 text-white"
                              : "bg-stone-100 text-stone-600 hover:bg-emerald-100 hover:text-emerald-600"
                          )}
                          title={
                            isEditing ? "Guardar cambios" : "Editar manualmente"
                          }
                        >
                          {isEditing ? (
                            <Check size={18} />
                          ) : (
                            <Pencil size={18} />
                          )}
                          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-stone-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {isEditing ? "Guardar" : "Editar"}
                          </span>
                        </button>
                        <button
                          onClick={() => setShowRewriteModal(true)}
                          className="p-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-emerald-100 hover:text-emerald-600 transition-all shadow-sm group relative"
                          title="Replantear contenido"
                        >
                          <RefreshCw size={18} />
                          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-stone-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            Replantear
                          </span>
                        </button>
                        <button
                          onClick={() => setShowSplitModal(true)}
                          className="p-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-emerald-100 hover:text-emerald-600 transition-all shadow-sm group relative"
                          title="Dividir diapositiva"
                        >
                          <Split size={18} />
                          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-stone-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            Dividir
                          </span>
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 prose prose-stone max-w-none prose-p:text-stone-600 prose-li:text-stone-600 overflow-y-auto pr-4 custom-scrollbar">
                      {isEditing ? (
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full h-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none font-sans text-lg"
                        />
                      ) : (
                        <ReactMarkdown>
                          {formatMarkdown(currentSlide.content)}
                        </ReactMarkdown>
                      )}
                    </div>
                    {isEditing && (
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={handleSaveManualEdit}
                          className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                        >
                          <Save size={18} />
                          Guardar Cambios
                        </button>
                      </div>
                    )}
                  </div>
                  <div
                    className="bg-white border-l border-stone-200 flex flex-col relative group"
                    style={{ width: `${imageWidthPercent}%` }}
                  >
                    {/* Resize Handle */}
                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizing(true);
                      }}
                      className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/30 transition-colors z-30 flex items-center justify-center group/handle"
                    >
                      <div className="w-0.5 h-8 bg-stone-300 group-hover/handle:bg-emerald-500 rounded-full" />
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleContentType();
                      }}
                      className="absolute top-4 right-4 z-20 p-2 bg-white/80 backdrop-blur-sm border border-stone-200 rounded-lg text-stone-600 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm opacity-0 group-hover:opacity-100 flex items-center gap-2"
                      title="Cambiar tipo de contenido"
                    >
                      {currentSlide.contentType === "code" ? (
                        <>
                          <Video size={18} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            Video
                          </span>
                        </>
                      ) : currentSlide.contentType === "video" ? (
                        <>
                          <ImageIcon size={18} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            Imagen
                          </span>
                        </>
                      ) : (
                        <>
                          <Code2 size={18} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            Código
                          </span>
                        </>
                      )}
                    </button>

                    {currentSlide.contentType === "code" ? (
                      <div
                        className="flex-1 p-6 flex items-center justify-center overflow-hidden cursor-text"
                        onClick={() => !isEditing && setIsEditing(true)}
                      >
                        <div className="w-full max-w-md bg-[#1e1e1e] rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col h-[80%] relative group/window">
                          {/* Mac Window Header */}
                          <div className="h-9 bg-[#2d2d2d] px-4 flex items-center justify-between shrink-0">
                            <div className="flex gap-2">
                              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                            </div>
                            <div className="text-[10px] text-stone-400 font-mono uppercase tracking-wider flex items-center gap-3">
                              {isEditing ? (
                                <>
                                  <div className="flex items-center gap-1 border-r border-stone-700 pr-2 mr-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditFontSize((prev) =>
                                          Math.max(8, prev - 2)
                                        );
                                      }}
                                      className="w-7 h-7 flex items-center justify-center hover:bg-stone-700 rounded text-stone-300 transition-colors border border-stone-700"
                                      title="Disminuir fuente"
                                    >
                                      <span className="text-[10px] font-bold">
                                        -
                                      </span>
                                    </button>
                                    <span className="w-10 text-center text-[11px] font-bold text-emerald-500">
                                      {editFontSize}px
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditFontSize((prev) =>
                                          Math.min(64, prev + 2)
                                        );
                                      }}
                                      className="w-7 h-7 flex items-center justify-center hover:bg-stone-700 rounded text-stone-300 transition-colors border border-stone-700"
                                      title="Aumentar fuente"
                                    >
                                      <span className="text-[10px] font-bold">
                                        +
                                      </span>
                                    </button>
                                  </div>
                                  <select
                                    value={editLanguage}
                                    onChange={(e) =>
                                      setEditLanguage(e.target.value)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-stone-800 border border-stone-700 focus:outline-none text-center w-32 text-emerald-500 rounded px-2 py-1 cursor-pointer text-[10px] font-bold appearance-none"
                                  >
                                    {LANGUAGES.map((lang) => (
                                      <option key={lang.id} value={lang.id}>
                                        {lang.name}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex items-center gap-1 ml-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveManualEdit();
                                      }}
                                      className="p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white transition-colors shadow-lg"
                                      title="Guardar (Enter)"
                                    >
                                      <Check size={14} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsEditing(false);
                                      }}
                                      className="p-1.5 bg-stone-700 hover:bg-stone-600 rounded text-stone-300 transition-colors"
                                      title="Cancelar (Esc)"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="text-[9px] opacity-50 bg-stone-800 px-1.5 py-0.5 rounded">
                                    {currentSlide.fontSize || 14}px
                                  </span>
                                  <span className="bg-stone-800 px-1.5 py-0.5 rounded">
                                    {LANGUAGES.find(
                                      (l) => l.id === currentSlide.language
                                    )?.name ||
                                      currentSlide.language ||
                                      "JavaScript"}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="w-12" />
                          </div>
                          {/* Code Content */}
                          <div className="flex-1 p-0 font-mono overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
                            {isEditing ? (
                              <textarea
                                value={editCode}
                                onChange={(e) => setEditCode(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "Enter" &&
                                    (e.ctrlKey || e.metaKey)
                                  ) {
                                    handleSaveManualEdit();
                                  }
                                  if (e.key === "Escape") {
                                    setIsEditing(false);
                                  }
                                }}
                                className="w-full h-full bg-transparent text-stone-300 p-4 border-none focus:outline-none resize-none leading-relaxed"
                                style={{ fontSize: `${editFontSize}px` }}
                                placeholder="// Escribe tu código aquí... (Ctrl+Enter para guardar)"
                              />
                            ) : (
                              <div className="h-full">
                                {currentSlide.code ? (
                                  <SyntaxHighlighter
                                    language={
                                      currentSlide.language || "javascript"
                                    }
                                    style={vscDarkPlus}
                                    codeTagProps={{
                                      style: {
                                        fontSize: "inherit",
                                        lineHeight: "inherit",
                                        fontFamily: "inherit",
                                      },
                                    }}
                                    customStyle={{
                                      margin: 0,
                                      padding: "1.5rem",
                                      background: "transparent",
                                      fontSize: `${
                                        currentSlide.fontSize || 14
                                      }px`,
                                      lineHeight: "1.5",
                                    }}
                                  >
                                    {currentSlide.code}
                                  </SyntaxHighlighter>
                                ) : (
                                  <div className="p-6 text-stone-500 italic">
                                    // Haz clic para escribir código...
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Quick Edit Overlay */}
                          {!isEditing && (
                            <div className="absolute inset-0 bg-emerald-600/0 group-hover/window:bg-emerald-600/5 transition-colors flex items-center justify-center opacity-0 group-hover/window:opacity-100 pointer-events-none">
                              <div className="px-3 py-1.5 bg-white rounded-full shadow-lg text-emerald-600 text-xs font-medium flex items-center gap-2">
                                <Pencil size={12} />
                                Editar Código
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : currentSlide.contentType === "video" ? (
                      <div className="flex-1 p-8 flex items-center justify-center">
                        {currentSlide.videoUrl ? (
                          <div className="w-full aspect-video bg-stone-900 rounded-2xl overflow-hidden border border-white/10 relative group/video">
                            <iframe
                              src={
                                currentSlide.videoUrl.includes("youtube.com") ||
                                currentSlide.videoUrl.includes("youtu.be")
                                  ? `https://www.youtube.com/embed/${
                                      currentSlide.videoUrl
                                        .split("v=")[1]
                                        ?.split("&")[0] ||
                                      currentSlide.videoUrl.split("/").pop()
                                    }`
                                  : currentSlide.videoUrl
                              }
                              className="w-full h-full"
                              allowFullScreen
                            />
                            <button
                              onClick={() => {
                                setVideoUrlInput(currentSlide.videoUrl || "");
                                setShowVideoModal(true);
                              }}
                              className="absolute bottom-4 right-4 p-2 bg-white/80 backdrop-blur-sm border border-stone-200 rounded-lg text-stone-600 hover:text-emerald-600 transition-all shadow-lg opacity-0 group-hover/video:opacity-100"
                            >
                              <Pencil size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowVideoModal(true)}
                            className="w-full max-w-md aspect-video border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center gap-4 text-stone-400 hover:border-emerald-300 hover:text-emerald-500 hover:bg-emerald-50/50 transition-all group"
                          >
                            <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                              <Video size={32} />
                            </div>
                            <div className="text-center">
                              <p className="font-medium">Agregar Video</p>
                              <p className="text-xs">
                                YouTube, Vimeo o URL directa
                              </p>
                            </div>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div
                        className="flex-1 flex items-center justify-center relative cursor-pointer h-full"
                        onClick={openImageModal}
                      >
                        {currentSlide.imageUrl ? (
                          <img
                            src={currentSlide.imageUrl}
                            alt={currentSlide.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="text-center space-y-3 p-6">
                            <div className="w-16 h-16 rounded-full bg-stone-200 flex items-center justify-center mx-auto text-stone-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                              <ImageIcon size={32} />
                            </div>
                            <p className="text-sm text-stone-400 group-hover:text-emerald-600 font-medium transition-colors">
                              Click para generar imagen con IA
                            </p>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-emerald-600/0 group-hover:bg-emerald-600/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="px-4 py-2 bg-white rounded-full shadow-lg text-emerald-600 font-medium flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                            <Sparkles size={16} />
                            {currentSlide.imageUrl
                              ? "Cambiar Imagen"
                              : "Generar Imagen"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Controls */}
          <div className="mt-8 flex items-center gap-6">
            <button
              onClick={prevSlide}
              disabled={currentIndex === 0}
              className="w-12 h-12 rounded-full bg-white border border-stone-300 flex items-center justify-center hover:bg-stone-50 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="px-4 py-2 bg-white border border-stone-300 rounded-full text-sm font-medium text-stone-600 shadow-sm">
              {currentIndex + 1} / {slides.length}
            </div>
            <button
              onClick={nextSlide}
              disabled={currentIndex === slides.length - 1}
              className="w-12 h-12 rounded-full bg-white border border-stone-300 flex items-center justify-center hover:bg-stone-50 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </section>
      </main>

      {/* Image Generation Modal */}
      <AnimatePresence>
        {showImageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
              onClick={() => !isGeneratingImage && setShowImageModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-medium text-stone-900">
                      Generar Imagen con IA
                    </h3>
                    <p className="text-xs text-stone-500">
                      Describe lo que quieres ver en este slide
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowImageModal(false)}
                  className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
                  disabled={isGeneratingImage}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Estilo de Imagen
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {IMAGE_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedStyle(style)}
                        className={cn(
                          "px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                          selectedStyle.id === style.id
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-md"
                            : "bg-white border-stone-200 text-stone-600 hover:border-emerald-500"
                        )}
                      >
                        {style.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Contexto del Slide
                  </label>
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-sm text-stone-600 italic">
                    "{currentSlide.title}"
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Tu Prompt
                  </label>
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Ej: Un astronauta plantando una bandera en Marte..."
                    className="w-full h-24 p-4 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-sm"
                    disabled={isGeneratingImage}
                  />
                </div>
                <button
                  onClick={handleImageGenerate}
                  disabled={isGeneratingImage || !imagePrompt.trim()}
                  className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isGeneratingImage ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Generando Obra Maestra...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      Generar Imagen
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video URL Modal */}
      <AnimatePresence>
        {showVideoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
              onClick={() => setShowVideoModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Video size={20} />
                  </div>
                  <div>
                    <h3 className="font-medium text-stone-900">
                      Agregar Video
                    </h3>
                    <p className="text-xs text-stone-500">
                      YouTube, Vimeo o URL directa
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVideoModal(false)}
                  className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    URL del Video
                  </label>
                  <input
                    type="text"
                    value={videoUrlInput}
                    onChange={(e) => setVideoUrlInput(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full p-4 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleSaveVideoUrl()}
                  />
                  <p className="text-[10px] text-stone-400">
                    Pega el link de YouTube, Vimeo o una URL directa a un
                    archivo de video.
                  </p>
                </div>
                <button
                  onClick={handleSaveVideoUrl}
                  disabled={!videoUrlInput.trim()}
                  className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  Guardar Video
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Split Slide Modal */}
      <AnimatePresence>
        {showSplitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
              onClick={() => !isProcessing && setShowSplitModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Split size={20} />
                  </div>
                  <div>
                    <h3 className="font-medium text-stone-900">
                      Dividir Diapositiva
                    </h3>
                    <p className="text-xs text-stone-500">
                      Profundiza en este tema dividiéndolo
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSplitModal(false)}
                  className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
                  disabled={isProcessing}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Instrucciones para dividir
                  </label>
                  <textarea
                    value={splitPrompt}
                    onChange={(e) => setSplitPrompt(e.target.value)}
                    placeholder="Ej: Divide esto en 3 diapositivas detallando los beneficios técnicos, económicos y sociales..."
                    className="w-full h-32 p-4 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none text-sm"
                    disabled={isProcessing}
                  />
                </div>
                <button
                  onClick={handleSplitSlide}
                  disabled={isProcessing || !splitPrompt.trim()}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Wand2 size={20} />
                      Dividir y Profundizar
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rewrite Slide Modal */}
      <AnimatePresence>
        {showRewriteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
              onClick={() => !isProcessing && setShowRewriteModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <h3 className="font-medium text-stone-900">
                      Replantear Contenido
                    </h3>
                    <p className="text-xs text-stone-500">
                      Cambia el tono o enfoque del texto
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRewriteModal(false)}
                  className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
                  disabled={isProcessing}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Instrucciones para replantear
                  </label>
                  <textarea
                    value={rewritePrompt}
                    onChange={(e) => setRewritePrompt(e.target.value)}
                    placeholder="Ej: Haz que el tono sea más profesional y enfocado a ejecutivos..."
                    className="w-full h-32 p-4 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none text-sm"
                    disabled={isProcessing}
                  />
                </div>
                <button
                  onClick={handleRewriteSlide}
                  disabled={isProcessing || !rewritePrompt.trim()}
                  className="w-full py-4 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Reescribiendo...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={20} />
                      Actualizar Contenido
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Mode Overlay */}
      <AnimatePresence>
        {isPreviewMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col"
          >
            <div className="absolute top-6 right-6 z-[110] flex items-center gap-3">
              <span className="px-3 py-1 bg-stone-100 rounded-full text-xs font-medium text-stone-500">
                {currentIndex + 1} / {slides.length}
              </span>
              <button
                onClick={() => setIsPreviewMode(false)}
                className="p-3 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors shadow-lg"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center p-12">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={cn(
                  "w-full max-w-7xl aspect-video bg-white flex relative",
                  currentSlide.type === "chapter"
                    ? "justify-center items-center"
                    : ""
                )}
              >
                {currentSlide.type === "chapter" ? (
                  <div className="text-center space-y-8">
                    <div className="h-2 w-24 bg-emerald-600 mx-auto rounded-full" />
                    <h1 className="text-8xl font-serif italic text-stone-900 leading-tight">
                      {currentSlide.title}
                    </h1>
                    {currentSlide.subtitle && (
                      <p className="text-4xl text-stone-400 font-light tracking-widest uppercase">
                        {currentSlide.subtitle}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex-1 p-12 flex flex-col overflow-hidden">
                      <div className="mb-8 shrink-0">
                        <h2 className="text-5xl font-serif italic text-stone-900 leading-tight mb-4">
                          {currentSlide.title}
                        </h2>
                        <div className="h-1.5 w-20 bg-emerald-600 rounded-full" />
                      </div>
                      <div className="flex-1 prose prose-xl prose-stone max-w-none prose-p:text-stone-600 prose-li:text-stone-600 overflow-y-auto pr-4 custom-scrollbar">
                        <ReactMarkdown>
                          {formatMarkdown(currentSlide.content)}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <div
                      className="flex flex-col relative"
                      style={{ width: `${imageWidthPercent}%` }}
                    >
                      <div className="w-full h-full p-8 flex items-center justify-center">
                        {currentSlide.contentType === "code" ? (
                          <div className="w-full h-full bg-[#1e1e1e] rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col">
                            <div className="h-12 bg-[#2d2d2d] px-6 flex items-center gap-2 shrink-0">
                              <div className="w-3.5 h-3.5 rounded-full bg-[#ff5f56]" />
                              <div className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e]" />
                              <div className="w-3.5 h-3.5 rounded-full bg-[#27c93f]" />
                              <div className="ml-auto text-xs text-stone-400 font-mono uppercase tracking-widest flex items-center gap-4">
                                <span className="text-[10px] opacity-50">
                                  {currentSlide.fontSize || 14}px
                                </span>
                                <span>
                                  {LANGUAGES.find(
                                    (l) => l.id === currentSlide.language
                                  )?.name ||
                                    currentSlide.language ||
                                    "JavaScript"}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1 p-0 font-mono overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
                              {currentSlide.code ? (
                                <SyntaxHighlighter
                                  language={
                                    currentSlide.language || "javascript"
                                  }
                                  style={vscDarkPlus}
                                  codeTagProps={{
                                    style: {
                                      fontSize: "inherit",
                                      lineHeight: "inherit",
                                      fontFamily: "inherit",
                                    },
                                  }}
                                  customStyle={{
                                    margin: 0,
                                    padding: "2rem",
                                    background: "transparent",
                                    fontSize: `${
                                      (currentSlide.fontSize || 14) * 1.5
                                    }px`,
                                    lineHeight: "1.6",
                                  }}
                                >
                                  {currentSlide.code}
                                </SyntaxHighlighter>
                              ) : (
                                <div className="p-8 text-stone-500 italic">
                                  // Sin código
                                </div>
                              )}
                            </div>
                          </div>
                        ) : currentSlide.contentType === "video" ? (
                          <div className="w-full h-full bg-stone-900 rounded-2xl overflow-hidden border border-white/10">
                            {currentSlide.videoUrl ? (
                              <iframe
                                src={
                                  currentSlide.videoUrl.includes(
                                    "youtube.com"
                                  ) ||
                                  currentSlide.videoUrl.includes("youtu.be")
                                    ? `https://www.youtube.com/embed/${
                                        currentSlide.videoUrl
                                          .split("v=")[1]
                                          ?.split("&")[0] ||
                                        currentSlide.videoUrl.split("/").pop()
                                      }`
                                    : currentSlide.videoUrl
                                }
                                className="w-full h-full"
                                allowFullScreen
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-500 italic">
                                // Sin video
                              </div>
                            )}
                          </div>
                        ) : currentSlide.imageUrl ? (
                          <img
                            src={currentSlide.imageUrl}
                            alt={currentSlide.title}
                            className="w-full h-full object-cover rounded-2xl"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300">
                            <ImageIcon size={120} strokeWidth={1} />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            </div>

            {/* Navigation Hotspots */}
            <div
              className="absolute inset-y-0 left-0 w-32 cursor-pointer group flex items-center justify-center"
              onClick={prevSlide}
            >
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-stone-900 shadow-xl">
                <ChevronLeft size={32} />
              </div>
            </div>
            <div
              className="absolute inset-y-0 right-0 w-32 cursor-pointer group flex items-center justify-center"
              onClick={nextSlide}
            >
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-stone-900 shadow-xl">
                <ChevronRight size={32} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
