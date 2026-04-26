import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  pullPresentationFromCloud,
  type PulledPresentation,
} from "../../services/presentationCloud";
import { PublicViewShell } from "./PublicViewShell";

export function PublicPresentationViewer() {
  const navigate = useNavigate();
  const { ownerUid = "", cloudId = "" } = useParams<{
    ownerUid: string;
    cloudId: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deck, setDeck] = useState<PulledPresentation | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!ownerUid || !cloudId) {
      setError("Referencia de presentación inválida.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void pullPresentationFromCloud(ownerUid, cloudId)
      .then((res) => {
        if (cancelled) return;
        setDeck(res.presentation);
      })
      .catch((e) => {
        console.error(e);
        if (cancelled) return;
        setError("No se pudo abrir esta presentación pública.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerUid, cloudId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-100 text-foreground dark:bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-stone-500" />
      </div>
    );
  }

  if (error || !deck || deck.slides.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-stone-100 px-4 text-foreground dark:bg-background">
        <p className="text-sm text-destructive">{error ?? "Presentación no disponible."}</p>
        <button
          type="button"
          onClick={() => {
            void navigate("/home");
          }}
          className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground hover:bg-stone-100 dark:hover:bg-white/10"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  return <PublicViewShell deck={deck} />;
}
