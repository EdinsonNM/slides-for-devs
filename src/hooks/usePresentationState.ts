import { useState, useEffect } from "react";
import type { Slide, ImageStyle, SavedPresentationMeta } from "../types";
import { formatMarkdown } from "../utils/markdown";
import {
  generatePresentation,
  generateImage,
  generateImagePromptAlternatives,
  generateCodeForSlide as generateCodeForSlideApi,
  splitSlide,
  rewriteSlide,
  generatePresenterNotes as generatePresenterNotesApi,
  generateSpeechForSlide as generateSpeechForSlideApi,
  generateSpeechForAll as generateSpeechForAllApi,
  refinePresenterNotes as refinePresenterNotesApi,
} from "../services/gemini";
import { generateImageOpenAI } from "../services/openai";
import {
  savePresentation,
  updatePresentation,
  listPresentations,
  loadPresentation,
  deletePresentation,
  migrateJsonPresentations,
} from "../services/storage";
import { IMAGE_STYLES } from "../constants/imageStyles";

const DEFAULT_IMAGE_WIDTH_PERCENT = 40;

export type HomeTab = "recent" | "mine" | "templates";

export function usePresentationState() {
  const [topic, setTopic] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPromptAlternatives, setIsGeneratingPromptAlternatives] =
    useState(false);
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
  const [imageProvider, setImageProvider] = useState<"gemini" | "openai">(
    "gemini"
  );
  const [includeBackground, setIncludeBackground] = useState(true);
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
  const [homeTab, setHomeTab] = useState<HomeTab>("recent");
  const [showSpeechModal, setShowSpeechModal] = useState(false);
  const [speechGeneralPrompt, setSpeechGeneralPrompt] = useState("");
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNotesPanelOpen, setIsNotesPanelOpen] = useState(false);
  const [showCodeGenModal, setShowCodeGenModal] = useState(false);
  const [codeGenPrompt, setCodeGenPrompt] = useState("");
  const [codeGenLanguage, setCodeGenLanguage] = useState("javascript");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const currentSlide = slides[currentIndex];
  const imageWidthPercent =
    currentSlide?.imageWidthPercent ?? DEFAULT_IMAGE_WIDTH_PERCENT;

  // Migrar presentaciones en JSON (formato antiguo) a SQLite una vez al cargar
  useEffect(() => {
    migrateJsonPresentations().catch(() => {});
  }, []);

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

    const handleMouseUp = () => setIsResizing(false);

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
  }, [currentIndex, currentSlide?.id]);

  // Al cambiar de diapositiva con el modal de imagen abierto, resetear el prompt al del slide actual
  useEffect(() => {
    if (showImageModal && currentSlide) {
      setImagePrompt(currentSlide.imagePrompt || "");
    }
  }, [showImageModal, currentIndex, currentSlide?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        isEditing
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        if (currentIndex < slides.length - 1) setCurrentIndex(currentIndex + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
      } else if (e.key === "Escape" && isPreviewMode) {
        setIsPreviewMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, slides.length, isEditing, isPreviewMode]);

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
    if (!currentSlide) return;
    let newType: "image" | "code" | "video" = "code";
    if (currentSlide.contentType === "code") newType = "video";
    else if (currentSlide.contentType === "video") newType = "image";
    else newType = "code";

    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, contentType: newType };
      return updated;
    });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
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

  const handleImageGenerate = async () => {
    if (!imagePrompt.trim() || !currentSlide) return;
    setIsGeneratingImage(true);
    const slideContext = `Título: ${currentSlide.title}. Contenido: ${currentSlide.content}`;
    const generate =
      imageProvider === "openai" ? generateImageOpenAI : generateImage;
    try {
      const imageUrl = await generate(
        slideContext,
        imagePrompt,
        selectedStyle.prompt,
        includeBackground
      );
      if (imageUrl) {
        const promptUsed = imagePrompt.trim();
        setSlides((prev) => {
          const updated = [...prev];
          updated[currentIndex] = {
            ...currentSlide,
            imageUrl,
            imagePrompt: promptUsed,
          };
          return updated;
        });
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

  const handleGeneratePromptAlternatives = async () => {
    if (!currentSlide) return;
    setIsGeneratingPromptAlternatives(true);
    const slideContext = `Título: ${currentSlide.title}. Contenido: ${currentSlide.content}`;
    try {
      const alternative = await generateImagePromptAlternatives(
        slideContext,
        imagePrompt,
        selectedStyle.name,
        selectedStyle.prompt
      );
      if (alternative) setImagePrompt(alternative);
    } catch (error) {
      console.error("Error generating prompt alternatives:", error);
      alert("No se pudo generar una alternativa de prompt.");
    } finally {
      setIsGeneratingPromptAlternatives(false);
    }
  };

  const handleSplitSlide = async () => {
    if (!splitPrompt.trim() || !currentSlide) return;
    setIsProcessing(true);
    try {
      const newSlides = await splitSlide(currentSlide, splitPrompt);
      if (newSlides.length > 0) {
        const cleanedNewSlides = newSlides.map((slide) => ({
          ...slide,
          content: formatMarkdown(slide.content),
        }));
        setSlides((prev) => {
          const updated = [...prev];
          updated.splice(currentIndex, 1, ...cleanedNewSlides);
          return updated;
        });
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
    if (!rewritePrompt.trim() || !currentSlide) return;
    setIsProcessing(true);
    try {
      const result = await rewriteSlide(currentSlide, rewritePrompt);
      setSlides((prev) => {
        const updated = [...prev];
        updated[currentIndex] = {
          ...currentSlide,
          title: result.title,
          content: formatMarkdown(result.content),
        };
        return updated;
      });
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
    if (!videoUrlInput.trim() || !currentSlide) return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...currentSlide,
        videoUrl: videoUrlInput.trim(),
        contentType: "video",
      };
      return updated;
    });
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

  const goHome = () => {
    setSlides([]);
    setTopic("");
    setCurrentSavedId(null);
  };

  const nextSlide = () => {
    if (currentIndex < slides.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const prevSlide = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const openImageModal = () => {
    setImagePrompt(currentSlide?.imagePrompt || "");
    setShowImageModal(true);
  };

  const openCodeGenModal = () => {
    setCodeGenLanguage(currentSlide?.language || "javascript");
    setCodeGenPrompt("");
    setShowCodeGenModal(true);
  };

  const handleGenerateCode = async () => {
    if (!currentSlide) return;
    setIsGeneratingCode(true);
    try {
      const { code } = await generateCodeForSlideApi(
        currentSlide,
        codeGenLanguage,
        codeGenPrompt.trim() || undefined
      );
      setSlides((prev) => {
        const updated = [...prev];
        updated[currentIndex] = {
          ...currentSlide,
          code,
          language: codeGenLanguage,
          contentType: "code",
        };
        return updated;
      });
      setEditCode(code);
      setEditLanguage(codeGenLanguage);
      setShowCodeGenModal(false);
      setCodeGenPrompt("");
    } catch (error) {
      console.error("Error generating code:", error);
      alert("Error al generar el código. Intenta de nuevo.");
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const setPresenterNotesForCurrentSlide = (notes: string) => {
    if (!currentSlide) return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        presenterNotes: notes,
      };
      return updated;
    });
  };

  const handleGeneratePresenterNotes = async () => {
    if (!currentSlide) return;
    setIsProcessing(true);
    try {
      const notes = await generatePresenterNotesApi(currentSlide);
      setPresenterNotesForCurrentSlide(notes);
    } catch (e) {
      console.error(e);
      alert("Error al generar las notas del presentador.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateSpeechForCurrentSlide = async (prompt?: string) => {
    if (!currentSlide) return;
    setIsGeneratingSpeech(true);
    try {
      const text = await generateSpeechForSlideApi(currentSlide, prompt);
      setPresenterNotesForCurrentSlide(text);
    } catch (e) {
      console.error(e);
      alert("Error al generar el contenido.");
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const handleRefinePresenterNotes = async () => {
    if (!currentSlide) return;
    const current = (currentSlide.presenterNotes ?? "").trim();
    if (!current) {
      alert("Escribe o genera primero el contenido para refinar.");
      return;
    }
    setIsGeneratingSpeech(true);
    try {
      const refined = await refinePresenterNotesApi(currentSlide, current);
      setPresenterNotesForCurrentSlide(refined);
    } catch (e) {
      console.error(e);
      alert("Error al refinar las notas.");
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const handleGenerateSpeechForAll = async () => {
    if (slides.length === 0 || !speechGeneralPrompt.trim()) return;
    setIsGeneratingSpeech(true);
    try {
      const results = await generateSpeechForAllApi(
        slides,
        speechGeneralPrompt
      );
      setSlides((prev) =>
        prev.map((s, i) => ({
          ...s,
          presenterNotes: results[i] ?? s.presenterNotes ?? "",
        }))
      );
      setShowSpeechModal(false);
      setSpeechGeneralPrompt("");
    } catch (e) {
      console.error(e);
      alert("Error al generar para todas las diapositivas.");
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  return {
    topic,
    setTopic,
    slides,
    setSlides,
    currentIndex,
    setCurrentIndex,
    currentSlide,
    imageWidthPercent,
    DEFAULT_IMAGE_WIDTH_PERCENT,
    isLoading,
    isGeneratingImage,
    isGeneratingPromptAlternatives,
    isProcessing,
    showImageModal,
    setShowImageModal,
    showSplitModal,
    setShowSplitModal,
    showRewriteModal,
    setShowRewriteModal,
    showVideoModal,
    setShowVideoModal,
    imagePrompt,
    setImagePrompt,
    splitPrompt,
    setSplitPrompt,
    rewritePrompt,
    setRewritePrompt,
    videoUrlInput,
    setVideoUrlInput,
    selectedStyle,
    setSelectedStyle,
    imageProvider,
    setImageProvider,
    includeBackground,
    setIncludeBackground,
    isPreviewMode,
    setIsPreviewMode,
    isEditing,
    setIsEditing,
    editTitle,
    setEditTitle,
    editContent,
    setEditContent,
    editCode,
    setEditCode,
    editLanguage,
    setEditLanguage,
    editFontSize,
    setEditFontSize,
    isResizing,
    setIsResizing,
    currentSavedId,
    showSavedListModal,
    setShowSavedListModal,
    savedList,
    isSaving,
    saveMessage,
    homeTab,
    setHomeTab,
    formatMarkdown,
    handleSaveManualEdit,
    toggleContentType,
    handleGenerate,
    handleImageGenerate,
    handleGeneratePromptAlternatives,
    handleSplitSlide,
    handleRewriteSlide,
    handleSaveVideoUrl,
    handleSave,
    openSavedListModal,
    handleOpenSaved,
    handleDeleteSaved,
    goHome,
    nextSlide,
    prevSlide,
    openImageModal,
    showCodeGenModal,
    setShowCodeGenModal,
    codeGenPrompt,
    setCodeGenPrompt,
    codeGenLanguage,
    setCodeGenLanguage,
    isGeneratingCode,
    openCodeGenModal,
    handleGenerateCode,
    setPresenterNotesForCurrentSlide,
    handleGeneratePresenterNotes,
    handleGenerateSpeechForCurrentSlide,
    handleRefinePresenterNotes,
    handleGenerateSpeechForAll,
    showSpeechModal,
    setShowSpeechModal,
    speechGeneralPrompt,
    setSpeechGeneralPrompt,
    isGeneratingSpeech,
    isSidebarOpen,
    setIsSidebarOpen,
    isNotesPanelOpen,
    setIsNotesPanelOpen,
  };
}

export type PresentationState = ReturnType<typeof usePresentationState>;
