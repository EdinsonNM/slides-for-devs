import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Upload } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";

export function ImageUploadModal() {
  const {
    showImageUploadModal,
    setShowImageUploadModal,
    handleImageUpload,
  } = usePresentation();

  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showImageUploadModal) {
      setUploadPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setSelectedFile(null);
    }
  }, [showImageUploadModal]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploadPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setSelectedFile(file);
  };

  const handleUseUploadedImage = () => {
    if (selectedFile) {
      handleImageUpload(selectedFile);
      setSelectedFile(null);
      setUploadPreview(null);
      fileInputRef.current?.form?.reset();
    }
  };

  return (
    <AnimatePresence>
      {showImageUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={() => setShowImageUploadModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-stone-900">Cargar imagen</h3>
                  <p className="text-xs text-stone-500">
                    Sube una imagen desde tu dispositivo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImageUploadModal(false)}
                className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Selecciona una imagen
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="block w-full text-sm text-stone-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 file:cursor-pointer cursor-pointer"
                />
                {uploadPreview && (
                  <div className="mt-3 rounded-xl border border-stone-200 overflow-hidden bg-stone-50">
                    <img
                      src={uploadPreview}
                      alt="Vista previa"
                      className="w-full max-h-48 object-contain"
                    />
                    <p className="p-2 text-xs text-stone-500 truncate">
                      {selectedFile?.name}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={handleUseUploadedImage}
                disabled={!selectedFile}
                className={cn(
                  "w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                  selectedFile
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-stone-100 text-stone-400 cursor-not-allowed"
                )}
              >
                <Upload size={20} />
                Usar esta imagen
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
