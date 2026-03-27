import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => Promise<void>;
  compact?: boolean;
  isLoading?: boolean;
}

export function FileUpload({ onFilesSelected, compact = false, isLoading = false }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ count: number; errors: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (fileArray.length === 0) return;

    setUploadResult(null);
    try {
      await onFilesSelected(fileArray);
      setUploadResult({ count: fileArray.length, errors: 0 });
    } catch {
      setUploadResult({ count: 0, errors: fileArray.length });
    }

    setTimeout(() => setUploadResult(null), 3000);
  }, [onFilesSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  if (compact) {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800 cursor-pointer',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
          )}
          <span className="hidden sm:inline">PDFs</span>
        </button>
        {uploadResult && (
          <div className={cn(
            'absolute top-full mt-2 right-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap',
            uploadResult.errors > 0
              ? 'bg-red-500/10 text-red-400'
              : 'bg-emerald-500/10 text-emerald-400'
          )}>
            {uploadResult.errors > 0 ? (
              <><AlertCircle className="w-3 h-3" /> Erreur de parsing</>
            ) : (
              <><CheckCircle2 className="w-3 h-3" /> {uploadResult.count} PDF(s) importé(s)</>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'upload-zone rounded-2xl p-12 transition-all duration-300 cursor-pointer',
        'flex flex-col items-center justify-center gap-4',
        isDragOver && 'drag-over bg-indigo-500/5'
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <div className={cn(
        'w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300',
        isDragOver
          ? 'bg-indigo-500/20 text-indigo-400'
          : 'bg-zinc-800 text-zinc-400'
      )}>
        {isLoading ? (
          <Loader2 className="w-8 h-8 animate-spin" />
        ) : (
          <Upload className="w-8 h-8" />
        )}
      </div>

      <div className="text-center">
        <p className="text-lg font-medium text-zinc-200">
          {isLoading ? 'Analyse des PDFs...' : 'Glisse tes avis d\'opéré ici'}
        </p>
        <p className="text-sm text-zinc-500 mt-1">
          PDFs BoursoBank (avis d'opéré) &middot; Plusieurs fichiers acceptés
        </p>
      </div>

      <div className="flex items-center gap-6 mt-2">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <FileText className="w-4 h-4" />
          <span>Format PDF</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <CheckCircle2 className="w-4 h-4" />
          <span>Parsing automatique</span>
        </div>
      </div>

      {uploadResult && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
          uploadResult.errors > 0
            ? 'bg-red-500/10 text-red-400'
            : 'bg-emerald-500/10 text-emerald-400'
        )}>
          {uploadResult.errors > 0 ? (
            <><AlertCircle className="w-4 h-4" /> Erreur lors du parsing</>
          ) : (
            <><CheckCircle2 className="w-4 h-4" /> {uploadResult.count} avis d'opéré importé(s)</>
          )}
        </div>
      )}
    </div>
  );
}
