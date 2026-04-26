'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
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
      <Card className="border-[#2a2a2a] bg-[#101010] py-0">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#3ecf8e66] bg-[#3ecf8e1a]">
              <CheckCircle2 className="h-4 w-4 text-[#3ecf8e]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#f8fafc]">
                {uploadedFile.fileName}
              </p>
              <p className="text-xs text-[#8f8f8f]">
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
            className="h-8 w-8 text-[#8f8f8f] hover:bg-[#1a1a1a] hover:text-[#f8fafc]"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>

        {/* Preview table */}
        {uploadedFile.columns.length > 0 && (
          <div className="border-t border-[#2a2a2a] px-4 pb-4">
            <p className="mb-2 mt-3 text-xs font-medium text-[#8f8f8f]">
              Превью данных
            </p>
            <div className="overflow-x-auto rounded-md border border-[#2a2a2a]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] bg-[#050505]">
                    {uploadedFile.columns.map((col, i) => (
                      <th
                        key={i}
                        className="whitespace-nowrap border-r border-[#2a2a2a] px-3 py-2 text-left font-medium text-[#f8fafc] last:border-r-0"
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
                      className="border-b border-[#2a2a2a] last:border-0"
                    >
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="whitespace-nowrap border-r border-[#2a2a2a] px-3 py-1.5 text-[#8f8f8f] last:border-r-0"
                        >
                          {cell || '-'}
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
      <Card className="border-[#2a2a2a] bg-[#101010] py-0">
        <CardContent className="flex flex-col items-center justify-center gap-3 p-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#3ecf8e]" />
          <p className="text-sm text-[#8f8f8f]">Загрузка файла...</p>
        </CardContent>
      </Card>
    );
  }

  // Dropzone state
  return (
    <div
      {...getRootProps()}
      className={`group relative cursor-pointer rounded-md border transition-colors ${
        isDragActive
          ? 'border-[#3ecf8e] bg-[#3ecf8e1a]'
          : 'border-[#2a2a2a] bg-[#101010] hover:border-[#3ecf8e66] hover:bg-[#151515]'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex items-center justify-center gap-2 p-8 sm:p-10">
        <Upload className="h-4 w-4 text-[#3ecf8e]" />
        <p className="text-sm font-medium text-[#f8fafc]">
          {isDragActive
            ? dragMessage || 'Отпустите файл'
            : 'Перетащите датасет сюда'}
        </p>
      </div>
    </div>
  );
}
