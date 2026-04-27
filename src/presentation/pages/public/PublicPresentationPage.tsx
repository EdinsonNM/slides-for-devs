import { PreviewOverlay } from "../../../components/preview/PreviewOverlay";
import { PublicPresentationViewer } from "../../../components/public/PublicPresentationViewer";
import { PublicPreviewDeckProvider } from "@/presentation/contexts/PublicPreviewDeckContext";

export default function PublicPresentationPage() {
  return (
    <PublicPreviewDeckProvider>
      <PublicPresentationViewer />
      <PreviewOverlay />
    </PublicPreviewDeckProvider>
  );
}
