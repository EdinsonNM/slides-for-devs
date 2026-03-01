import { usePresentation } from "./context/PresentationContext";
import { Header } from "./components/layout/Header";
import { SlideSidebar } from "./components/layout/SlideSidebar";
import { HomeScreen } from "./components/home/HomeScreen";
import { SlideEditor } from "./components/editor/SlideEditor";
import { SavedListModal } from "./components/modals/SavedListModal";
import { ImageGenerationModal } from "./components/modals/ImageGenerationModal";
import { VideoUrlModal } from "./components/modals/VideoUrlModal";
import { SplitSlideModal } from "./components/modals/SplitSlideModal";
import { RewriteSlideModal } from "./components/modals/RewriteSlideModal";
import { PreviewOverlay } from "./components/preview/PreviewOverlay";

export default function App() {
  const { slides } = usePresentation();

  if (slides.length === 0) {
    return <HomeScreen />;
  }

  return (
    <div className="h-screen bg-[#E4E3E0] flex flex-col font-sans overflow-hidden">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        <SlideSidebar />
        <SlideEditor />
      </main>
      <SavedListModal />
      <ImageGenerationModal />
      <VideoUrlModal />
      <SplitSlideModal />
      <RewriteSlideModal />
      <PreviewOverlay />
    </div>
  );
}
