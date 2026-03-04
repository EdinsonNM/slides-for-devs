import { useState } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  Loader2,
  FolderOpen,
  Layout,
  ChevronRight,
  History,
  Settings,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";

const TOPIC_SUGGESTIONS = [
  "Historia del Arte",
  "Futuro de la IA",
  "Cocina Mediterránea",
  "Exploración Espacial",
];

const HOME_TABS = [
  { id: "recent" as const, label: "Vistos recientemente" },
  { id: "mine" as const, label: "Mis presentaciones" },
];

interface HomeScreenProps {
  onOpenConfig?: () => void;
}

export function HomeScreen(props: HomeScreenProps) {
  const { onOpenConfig } = props;
  const {
    topic,
    setTopic,
    isLoading,
    handleGenerate,
    homeTab,
    setHomeTab,
    openSavedListModal,
    savedList,
    handleOpenSaved,
    presentationModelId,
    setPresentationModelId,
    presentationModels,
  } = usePresentation();

  const [showHistory, setShowHistory] = useState(false);
  const displayList = savedList;

  return (
    <div className="min-h-screen bg-[#F6F6F6] flex flex-col font-sans relative">
      {onOpenConfig && (
        <button
          type="button"
          onClick={onOpenConfig}
          className="absolute top-4 right-4 p-2 rounded-lg text-stone-500 hover:bg-stone-200/60 hover:text-stone-700 transition-colors z-10"
          title="Configuración (API keys)"
        >
          <Settings size={20} />
        </button>
      )}
      <div className="min-h-[55vh] flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full text-center space-y-8"
        >
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-64 h-64 rounded-3xl overflow-hidden mb-4 bg-transparent">
              <video
                src="./video-logo 2.mp4"
                autoPlay
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
              Transforma tus ideas en presentaciones profesionales con el poder
              de la Inteligencia Artificial.
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
          <div className="flex items-center justify-center gap-1 -mt-5">
            <span className="text-xs text-stone-500">Modelo:</span>
            <select
              value={presentationModelId}
              onChange={(e) => setPresentationModelId(e.target.value)}
              disabled={isLoading}
              className="text-xs text-stone-600 bg-[#F6F6F6] border-0 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer min-w-[180px]"
              aria-label="Modelo para generar la presentación"
            >
              {presentationModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            {TOPIC_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setTopic(suggestion)}
                className="px-4 py-2 bg-white border border-stone-200 rounded-full text-sm text-stone-600 hover:border-emerald-500 hover:text-emerald-600 transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-emerald-600 transition-colors"
          >
            <History size={18} />
            {showHistory ? "Ocultar historial" : "Ver historial"}
          </button>
        </motion.div>
      </div>

      {showHistory && (
        <div className="flex-1 min-h-[280px] px-6 pb-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="h-full max-w-6xl mx-auto bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 flex-shrink-0">
              <div className="flex gap-1">
                {HOME_TABS.map((tab) => (
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

            <div className="flex-1 overflow-x-auto overflow-y-hidden p-5">
              {displayList.length === 0 ? (
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
      )}
    </div>
  );
}
