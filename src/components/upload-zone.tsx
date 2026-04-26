'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { UploadedFile } from '@/types';

interface UploadZoneProps {
  onFileUploaded: (file: File) => Promise<UploadedFile | null>;
  uploadedFile: UploadedFile | null;
  isUploading: boolean;
  onReset: () => void;
  disabled?: boolean;
}

export function UploadZone({
  onFileUploaded,
  uploadedFile,
  isUploading,
  onReset,
  disabled,
}: UploadZoneProps) {
  const [dragMessage, setDragMessage] = useState('');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setDragMessage('');
      await onFileUploaded(file);
    },
    [onFileUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    disabled: disabled || isUploading,
    onDragEnter: () => setDragMessage('Отпустите для загрузки'),
    onDragLeave: () => setDragMessage(''),
  });

  // File uploaded state
  if (uploadedFile) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {uploadedFile.fileName}
              </p>
              <p className="text-xs text-white/50">
                {(uploadedFile.fileSize / 1024).toFixed(1)} KB
                {uploadedFile.columns.length > 0 &&
                  ` · ${uploadedFile.columns.length} столбцов`}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onReset}
            className="h-8 w-8 text-white/50 hover:text-white"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>

        {/* Preview table */}
        {uploadedFile.columns.length > 0 && (
          <div className="border-t border-emerald-500/10 px-4 pb-4">
            <p className="mb-2 mt-3 text-xs font-medium text-white/40">
              Превью данных
            </p>
            <div className="overflow-x-auto rounded-lg border border-white/5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    {uploadedFile.columns.map((col, i) => (
                      <th
                        key={i}
                        className="whitespace-nowrap px-3 py-2 text-left font-medium text-white/60"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uploadedFile.preview.map((row, ri) => (
                    <tr
                      key={ri}
                      className="border-b border-white/[0.03] last:border-0"
                    >
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="whitespace-nowrap px-3 py-1.5 text-white/40"
                        >
                          {cell || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    );
  }

  // Uploading state
  if (isUploading) {
    return (
      <Card className="border-violet-500/20 bg-violet-500/5">
        <CardContent className="flex flex-col items-center justify-center gap-3 p-8">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          <p className="text-sm text-white/60">Загрузка файла...</p>
        </CardContent>
      </Card>
    );
  }

  // Dropzone state
  return (
    <div
      {...getRootProps()}
      className={`group relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 ${
        isDragActive
          ? 'border-violet-400 bg-violet-500/10 shadow-lg shadow-violet-500/10'
          : 'border-white/10 bg-white/[0.02] hover:border-violet-500/30 hover:bg-violet-500/5'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-4 p-10">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 ${
            isDragActive
              ? 'bg-violet-500/20 scale-110'
              : 'bg-white/[0.05] group-hover:bg-violet-500/10 group-hover:scale-105'
          }`}
        >
          {isDragActive ? (
            <FileSpreadsheet className="h-8 w-8 text-violet-400" />
          ) : (
            <Upload className="h-8 w-8 text-white/30 group-hover:text-violet-400 transition-colors" />
          )}
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-white/70">
            {isDragActive
              ? dragMessage || 'Отпустите файл'
              : 'Перетащите датасет сюда'}
          </p>
          <p className="mt-1 text-xs text-white/30">
            CSV, XLSX или XLS · до 50MB
          </p>
        </div>
      </div>
    </div>
  );
}
