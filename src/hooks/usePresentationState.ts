import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { Slide, SlideType, ImageStyle, SavedCharacter, SavedPresentationMeta } from "../types";
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
import {
  generateImageOpenAI,
  generatePresentationOpenAI,
} from "../services/openai";
import {
  getGeminiApiKey,
  getOpenAIApiKey,
} from "../services/apiConfig";
import {
  savePresentation,
  updatePresentation,
  listPresentations,
  loadPresentation,
  deletePresentation,
  migrateJsonPresentations,
  listCharacters,
  saveCharacter as saveCharacterStorage,
  deleteCharacter as deleteCharacterStorage,
} from "../services/storage";
import { IMAGE_STYLES } from "../constants/imageStyles";
import {
  PRESENTATION_MODELS,
  DEFAULT_PRESENTATION_MODEL_ID,
} from "../constants/presentationModels";
import {
  GEMINI_IMAGE_MODELS,
  DEFAULT_GEMINI_IMAGE_MODEL_ID,
} from "../constants/geminiImageModels";

const DEFAULT_IMAGE_WIDTH_PERCENT = 40;
const DEFAULT_PANEL_HEIGHT_PERCENT = 85;

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
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
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
  const [geminiImageModelId, setGeminiImageModelId] = useState(
    DEFAULT_GEMINI_IMAGE_MODEL_ID
  );
  const [includeBackground, setIncludeBackground] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editLanguage, setEditLanguage] = useState("javascript");
  const [editFontSize, setEditFontSize] = useState(14);
  const [editEditorHeight, setEditEditorHeight] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingPanelHeight, setIsResizingPanelHeight] = useState(false);
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
  const [generatingCoverId, setGeneratingCoverId] = useState<string | null>(null);
  const [coverImageCache, setCoverImageCache] = useState<Record<string, string>>({});
  /** Ref que SlideContentDiagram rellena con una función que vacía el diagrama pendiente y devuelve los datos (para guardar/vista previa). */
  const diagramFlushRef = useRef<(() => string | null) | null>(null);
  const [presentationModelId, setPresentationModelId] = useState(
    DEFAULT_PRESENTATION_MODEL_ID
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>([]);
  const [showCharacterCreatorModal, setShowCharacterCreatorModal] = useState(false);
  const [showCharactersPanel, setShowCharactersPanel] = useState(false);
  const [showSlideStylePanel, setShowSlideStylePanel] = useState(false);
  const [isGeneratingCharacterPreview, setIsGeneratingCharacterPreview] = useState(false);
  /** Cuando está setado, la presentación se está generando en segundo plano; se muestra modal y al terminar se guarda. */
  const [pendingGeneration, setPendingGeneration] = useState<{
    topic: string;
    modelId: string;
  } | null>(null);

  const hasGemini = !!getGeminiApiKey();
  const hasOpenAI = !!getOpenAIApiKey();
  const presentationModels = useMemo(
    () =>
      PRESENTATION_MODELS.filter(
        (m) =>
          (m.provider === "gemini" && hasGemini) ||
          (m.provider === "openai" && hasOpenAI)
      ),
    [hasGemini, hasOpenAI]
  );

  const presentationModelOption = PRESENTATION_MODELS.find(
    (m) => m.id === presentationModelId
  );
  const effectiveGeminiModel =
    presentationModelOption?.provider === "gemini"
      ? presentationModelId
      : "gemini-2.5-flash";

  const currentSlide = slides[currentIndex];
  const imageWidthPercent =
    currentSlide?.imageWidthPercent ?? DEFAULT_IMAGE_WIDTH_PERCENT;
  const panelHeightPercent =
    currentSlide?.contentLayout === "panel-full"
      ? (currentSlide?.panelHeightPercent ?? DEFAULT_PANEL_HEIGHT_PERCENT)
      : DEFAULT_PANEL_HEIGHT_PERCENT;

  // Ajustar modelo seleccionado si no está entre los permitidos (solo APIs configuradas)
  useEffect(() => {
    const allowedIds = presentationModels.map((m) => m.id);
    if (
      presentationModels.length > 0 &&
      !allowedIds.includes(presentationModelId)
    ) {
      setPresentationModelId(presentationModels[0].id);
    }
  }, [presentationModels, presentationModelId]);

  // Sincronizar proveedor de imagen con API keys disponibles (no mostrar opción sin key)
  useEffect(() => {
    if (imageProvider === "openai" && !hasOpenAI) setImageProvider("gemini");
    if (imageProvider === "gemini" && !hasGemini) setImageProvider("openai");
  }, [hasGemini, hasOpenAI]);

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
    listCharacters().then(setSavedCharacters).catch(() => setSavedCharacters([]));
  }, []);

  // Generación en segundo plano: al tener pendingGeneration, llamar API, actualizar slides y guardar.
  useEffect(() => {
    const pending = pendingGeneration;
    if (!pending) return;

    let cancelled = false;
    const run = async () => {
      try {
        const option = PRESENTATION_MODELS.find((m) => m.id === pending.modelId);
        const generatedSlides =
          option?.provider === "openai"
            ? await generatePresentationOpenAI(pending.topic, pending.modelId)
            : await generatePresentation(pending.topic, pending.modelId);
        if (cancelled) return;
        const cleanedSlides = generatedSlides.map((slide) => ({
          ...slide,
          id: crypto.randomUUID(),
          content: formatMarkdown(slide.content),
        }));
        setSlides(cleanedSlides);
        setCurrentIndex(0);
        const presentation = {
          topic: pending.topic,
          slides: cleanedSlides,
          characterId: selectedCharacterId ?? undefined,
        };
        const id = await savePresentation(presentation);
        if (cancelled) return;
        setCurrentSavedId(id);
        setPendingGeneration(null);
      } catch (error) {
        if (cancelled) return;
        console.error("Error generating presentation:", error);
        alert(
          "Hubo un error al generar la presentación. Por favor intenta de nuevo."
        );
        setPendingGeneration(null);
        setSlides([]);
        setTopic("");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [pendingGeneration]);

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

  // Resize panel height (layout panel-full): arrastrar el borde entre título y panel
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingPanelHeight) return;
      const container = document.getElementById("slide-container");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percent = Math.min(
        Math.max(25, 100 - (y / rect.height) * 100),
        95
      );
      setSlides((prev) => {
        const idx = currentIndex;
        if (idx < 0 || idx >= prev.length) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], panelHeightPercent: percent };
        return updated;
      });
    };
    const handleMouseUp = () => setIsResizingPanelHeight(false);

    if (isResizingPanelHeight) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "row-resize";
    } else {
      document.body.style.cursor = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingPanelHeight, currentIndex]);

  useEffect(() => {
    if (currentSlide) {
      setEditTitle(currentSlide.title);
      setEditSubtitle(currentSlide.subtitle ?? "");
      setEditContent(formatMarkdown(currentSlide.content));
      setEditCode(currentSlide.code || "");
      setEditLanguage(currentSlide.language || "javascript");
      setEditFontSize(currentSlide.fontSize || 14);
      setEditEditorHeight(currentSlide.editorHeight ?? 280);
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
        subtitle: editSubtitle.trim() || undefined,
        content: editContent,
        code: editCode,
        language: editLanguage,
        fontSize: editFontSize,
        editorHeight: editEditorHeight,
      };
      return updated;
    });
    setIsEditing(false);
  };

  const setEditorHeightForCurrentSlide = (height: number) => {
    const clamped = Math.min(560, Math.max(120, height));
    setEditEditorHeight(clamped);
    if (currentSlide == null) return;
    setSlides((prev) => {
      const updated = [...prev];
      if (currentIndex >= 0 && currentIndex < updated.length) {
        updated[currentIndex] = {
          ...updated[currentIndex],
          editorHeight: clamped,
        };
      }
      return updated;
    });
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

  /** Cambia el tipo de la diapositiva actual: capítulo, contenido o diagrama. */
  const setCurrentSlideType = (type: SlideType) => {
    if (!currentSlide || currentSlide.type === type) return;
    setSlides((prev) => {
      const updated = [...prev];
      const next = { ...currentSlide, type };
      if (type === "chapter" || type === "diagram") {
        delete (next as Slide).contentType;
        delete (next as Slide).contentLayout;
        if (type === "diagram" && !next.excalidrawData) next.excalidrawData = "{}";
      } else {
        if (!next.contentType) next.contentType = "image";
        if (!next.contentLayout) next.contentLayout = "split";
      }
      updated[currentIndex] = next;
      return updated;
    });
  };

  /** Actualiza los datos del diagrama Excalidraw de la diapositiva actual. Solo para type "diagram". */
  const setCurrentSlideExcalidrawData = (data: string) => {
    if (!currentSlide || currentSlide.type !== "diagram") return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, excalidrawData: data };
      return updated;
    });
  };

  /** Cambia la distribución del contenido: split = con panel derecho; full = solo texto; panel-full = título + subtítulo arriba y panel a ancho completo. Solo para type "content". */
  const setCurrentSlideContentLayout = (contentLayout: "split" | "full" | "panel-full") => {
    if (!currentSlide || currentSlide.type !== "content") return;
    if (currentSlide.contentLayout === contentLayout) return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, contentLayout };
      return updated;
    });
  };

  /** Cambia el tipo de contenido del panel derecho (solo para diapositivas de contenido con layout split). */
  const setCurrentSlideContentType = (contentType: "image" | "code" | "video") => {
    if (!currentSlide || currentSlide.type !== "content") return;
    if (currentSlide.contentType === contentType) return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, contentType };
      return updated;
    });
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) return;
    const placeholderSlide: Slide = {
      id: crypto.randomUUID(),
      type: "content",
      title: "Generando…",
      content: "Preparando tu presentación.",
    };
    setTopic(trimmedTopic);
    setSlides([placeholderSlide]);
    setCurrentIndex(0);
    setPendingGeneration({ topic: trimmedTopic, modelId: presentationModelId });
  };

  const handleImageGenerate = async () => {
    if (!imagePrompt.trim() || !currentSlide) return;
    setIsGeneratingImage(true);
    const slideContext = `Título: ${currentSlide.title}. Contenido: ${currentSlide.content}`;
    const character = selectedCharacterId
      ? savedCharacters.find((c) => c.id === selectedCharacterId)
      : undefined;
    const characterPrompt = character?.description;
    const characterReferenceImageDataUrl =
      imageProvider === "gemini" ? character?.referenceImageDataUrl : undefined;
    try {
      const imageUrl =
        imageProvider === "openai"
          ? await generateImageOpenAI(
              slideContext,
              imagePrompt,
              selectedStyle.prompt,
              includeBackground,
              characterPrompt
            )
          : await generateImage(
              slideContext,
              imagePrompt,
              selectedStyle.prompt,
              includeBackground,
              geminiImageModelId,
              characterPrompt,
              characterReferenceImageDataUrl
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
    const characterPrompt = selectedCharacterId
      ? savedCharacters.find((c) => c.id === selectedCharacterId)?.description
      : undefined;
    try {
      const alternative = await generateImagePromptAlternatives(
        slideContext,
        imagePrompt,
        selectedStyle.name,
        selectedStyle.prompt,
        effectiveGeminiModel,
        characterPrompt
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
      const newSlides = await splitSlide(
        currentSlide,
        splitPrompt,
        effectiveGeminiModel
      );
      if (newSlides.length > 0) {
        const cleanedNewSlides = newSlides.map((slide) => ({
          ...slide,
          id: crypto.randomUUID(),
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
      const result = await rewriteSlide(
        currentSlide,
        rewritePrompt,
        effectiveGeminiModel
      );
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

  const flushDiagramPending = useCallback((): string | null => {
    return diagramFlushRef.current?.() ?? null;
  }, []);

  /** Guarda una presentación con el payload dado; si no hay currentSavedId, crea uno y lo asigna. */
  const savePresentationNow = useCallback(
    async (presentation: { topic: string; slides: Slide[]; characterId?: string }) => {
      if (presentation.slides.length === 0) return;
      try {
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
      }
    },
    [currentSavedId]
  );

  const handleSave = async () => {
    if (slides.length === 0) return;
    const pendingDiagram = flushDiagramPending();
    const slidesToSave =
      pendingDiagram != null && currentSlide?.type === "diagram"
        ? slides.map((s, i) =>
            i === currentIndex ? { ...s, excalidrawData: pendingDiagram } : s
          )
        : slides;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await savePresentationNow({
        topic: topic || "Sin título",
        slides: slidesToSave,
        characterId: selectedCharacterId ?? undefined,
      });
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
      setSlides(
        saved.slides.map((s) => ({
          ...s,
          id: crypto.randomUUID(),
          content: formatMarkdown(s.content ?? ""),
        }))
      );
      setCurrentIndex(0);
      setCurrentSavedId(saved.id);
      setSelectedCharacterId(saved.characterId ?? null);
      setShowSavedListModal(false);
      const firstImage = saved.slides[0]?.imageUrl;
      if (firstImage) {
        setCoverImageCache((prev) => ({ ...prev, [saved.id]: firstImage }));
      }
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
      setCoverImageCache((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      console.error(e);
      alert("Error al eliminar.");
    }
  };

  const handleGenerateCoverForPresentation = async (id: string) => {
    setGeneratingCoverId(id);
    try {
      const saved = await loadPresentation(id);
      if (!saved.slides.length) {
        alert("Esta presentación no tiene diapositivas.");
        return;
      }
      const firstSlide = saved.slides[0];
      const slideContext = `Título: ${firstSlide.title}. Contenido: ${firstSlide.content}. Presentación sobre: ${saved.topic}`;
      const coverPrompt = "Portada profesional y moderna para esta presentación, estilo minimalista y atractivo, sin texto.";
      const coverCharacter = saved.characterId
        ? savedCharacters.find((c) => c.id === saved.characterId)
        : undefined;
      const characterPrompt = coverCharacter?.description;
      const characterReferenceImageDataUrl =
        imageProvider === "gemini" ? coverCharacter?.referenceImageDataUrl : undefined;
      const imageUrl =
        imageProvider === "openai"
          ? await generateImageOpenAI(
              slideContext,
              coverPrompt,
              selectedStyle.prompt,
              includeBackground,
              characterPrompt
            )
          : await generateImage(
              slideContext,
              coverPrompt,
              selectedStyle.prompt,
              includeBackground,
              geminiImageModelId,
              characterPrompt,
              characterReferenceImageDataUrl
            );
      if (imageUrl) {
        const updatedSlides = [...saved.slides];
        updatedSlides[0] = {
          ...firstSlide,
          imageUrl,
          imagePrompt: coverPrompt,
        };
        await updatePresentation(id, {
          topic: saved.topic,
          slides: updatedSlides,
          characterId: saved.characterId,
        });
        setCoverImageCache((prev) => ({ ...prev, [id]: imageUrl }));
      } else {
        alert("No se pudo generar la imagen. Comprueba tu API key de Gemini o OpenAI.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al generar la portada. Comprueba la consola y tu configuración de API.");
    } finally {
      setGeneratingCoverId(null);
    }
  };

  const goHome = () => {
    setSlides([]);
    setTopic("");
    setCurrentSavedId(null);
    setSelectedCharacterId(null);
  };

  const refreshSavedCharacters = () => {
    listCharacters().then(setSavedCharacters).catch(() => setSavedCharacters([]));
  };

  const handleSaveCharacter = async (character: SavedCharacter) => {
    await saveCharacterStorage(character);
    refreshSavedCharacters();
  };

  const handleDeleteCharacter = async (id: string) => {
    await deleteCharacterStorage(id);
    if (selectedCharacterId === id) setSelectedCharacterId(null);
    refreshSavedCharacters();
  };

  /** Genera una vista previa del personaje (solo la imagen, sin asignar a slide). Contexto fijo para personaje aislado. */
  const generateCharacterPreview = async (
    characterDescription: string
  ): Promise<string | undefined> => {
    if (!characterDescription.trim()) return undefined;
    setIsGeneratingCharacterPreview(true);
    try {
      const context =
        "Personaje aislado para usar en presentaciones. Debe ser el mismo personaje en todas las escenas. Fondo limpio.";
      return imageProvider === "openai"
        ? await generateImageOpenAI(
            context,
            characterDescription.trim(),
            selectedStyle.prompt,
            true,
            undefined
          )
        : await generateImage(
            context,
            characterDescription.trim(),
            selectedStyle.prompt,
            true,
            geminiImageModelId,
            undefined
          );
    } finally {
      setIsGeneratingCharacterPreview(false);
    }
  };

  const deleteSlideAt = (index: number) => {
    if (index < 0 || index >= slides.length || slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== index));
    setCurrentIndex((prev) => {
      if (prev === index) return Math.max(0, index - 1);
      if (prev > index) return prev - 1;
      return prev;
    });
  };

  const insertSlideAfter = (index: number) => {
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      type: "content",
      title: "Nueva diapositiva",
      content: "",
    };
    const next = [
      ...slides.slice(0, index + 1),
      newSlide,
      ...slides.slice(index + 1),
    ];
    setSlides(next);
    setCurrentIndex(index + 1);
    savePresentationNow({
      topic: topic || "Sin título",
      slides: next,
      characterId: selectedCharacterId ?? undefined,
    });
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

  const openImageUploadModal = () => {
    setShowImageUploadModal(true);
  };

  const handleImageUpload = (file: File) => {
    if (!currentSlide) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSlides((prev) => {
        const updated = [...prev];
        updated[currentIndex] = {
          ...currentSlide,
          imageUrl: dataUrl,
        };
        return updated;
      });
      setShowImageUploadModal(false);
    };
    reader.readAsDataURL(file);
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
        codeGenPrompt.trim() || undefined,
        effectiveGeminiModel
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
      const notes = await generatePresenterNotesApi(
        currentSlide,
        effectiveGeminiModel
      );
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
      const text = await generateSpeechForSlideApi(
        currentSlide,
        prompt,
        effectiveGeminiModel
      );
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
      const refined = await refinePresenterNotesApi(
        currentSlide,
        current,
        effectiveGeminiModel
      );
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
        speechGeneralPrompt,
        effectiveGeminiModel
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
    presentationModelId,
    setPresentationModelId,
    presentationModels,
    effectiveGeminiModel,
    slides,
    setSlides,
    currentIndex,
    setCurrentIndex,
    currentSlide,
    imageWidthPercent,
    DEFAULT_IMAGE_WIDTH_PERCENT,
    panelHeightPercent,
    isResizingPanelHeight,
    setIsResizingPanelHeight,
    isLoading,
    isGeneratingImage,
    isGeneratingPromptAlternatives,
    isProcessing,
    showImageModal,
    setShowImageModal,
    showImageUploadModal,
    setShowImageUploadModal,
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
    geminiImageModelId,
    setGeminiImageModelId,
    geminiImageModels: GEMINI_IMAGE_MODELS,
    includeBackground,
    setIncludeBackground,
    selectedCharacterId,
    setSelectedCharacterId,
    savedCharacters,
    refreshSavedCharacters,
    saveCharacter: handleSaveCharacter,
    deleteCharacter: handleDeleteCharacter,
    showCharacterCreatorModal,
    setShowCharacterCreatorModal,
    showCharactersPanel,
    setShowCharactersPanel,
    showSlideStylePanel,
    setShowSlideStylePanel,
    isGeneratingCharacterPreview,
    generateCharacterPreview,
    isPreviewMode,
    setIsPreviewMode,
    diagramFlushRef,
    flushDiagramPending,
    isEditing,
    setIsEditing,
    editTitle,
    setEditTitle,
    editSubtitle,
    setEditSubtitle,
    editContent,
    setEditContent,
    editCode,
    setEditCode,
    editLanguage,
    setEditLanguage,
    editFontSize,
    setEditFontSize,
    editEditorHeight,
    setEditEditorHeight,
    setEditorHeightForCurrentSlide,
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
    setCurrentSlideType,
    setCurrentSlideExcalidrawData,
    setCurrentSlideContentLayout,
    setCurrentSlideContentType,
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
    generatingCoverId,
    handleGenerateCoverForPresentation,
    coverImageCache,
    goHome,
    deleteSlideAt,
    insertSlideAfter,
    nextSlide,
    prevSlide,
    openImageModal,
    openImageUploadModal,
    handleImageUpload,
    hasGemini,
    hasOpenAI,
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
    pendingGeneration,
  };
}

export type PresentationState = ReturnType<typeof usePresentationState>;
