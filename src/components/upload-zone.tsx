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
      <Card className="border-[#30363d] bg-[#161b22] py-0">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2ea04366] bg-[#2386361f]">
              <CheckCircle2 className="h-4 w-4 text-[#3fb950]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#e6edf3]">
                {uploadedFile.fileName}
              </p>
              <p className="text-xs text-[#8b949e]">
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
            className="h-8 w-8 text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>

        {/* Preview table */}
        {uploadedFile.columns.length > 0 && (
          <div className="border-t border-[#30363d] px-4 pb-4">
            <p className="mb-2 mt-3 text-xs font-medium text-[#8b949e]">
              Превью данных
            </p>
            <div className="overflow-x-auto rounded-md border border-[#30363d]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#30363d] bg-[#0d1117]">
                    {uploadedFile.columns.map((col, i) => (
                      <th
                        key={i}
                        className="whitespace-nowrap border-r border-[#30363d] px-3 py-2 text-left font-medium text-[#e6edf3] last:border-r-0"
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
                      className="border-b border-[#30363d] last:border-0"
                    >
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="whitespace-nowrap border-r border-[#30363d] px-3 py-1.5 text-[#8b949e] last:border-r-0"
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
      <Card className="border-[#30363d] bg-[#161b22] py-0">
        <CardContent className="flex flex-col items-center justify-center gap-3 p-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#2f81f7]" />
          <p className="text-sm text-[#8b949e]">Загрузка файла...</p>
        </CardContent>
      </Card>
    );
  }

  // Dropzone state
  return (
    <div
      {...getRootProps()}
      className={`group relative cursor-pointer rounded-md border border-dashed transition-colors ${
        isDragActive
          ? 'border-[#2f81f7] bg-[#1f6feb1f]'
          : 'border-[#30363d] bg-[#161b22] hover:border-[#8b949e] hover:bg-[#21262d]'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-3 p-8 sm:p-10">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-md border transition-colors ${
            isDragActive
              ? 'border-[#2f81f7] bg-[#0d1117]'
              : 'border-[#30363d] bg-[#0d1117] group-hover:border-[#8b949e]'
          }`}
        >
          {isDragActive ? (
            <FileSpreadsheet className="h-6 w-6 text-[#2f81f7]" />
          ) : (
            <Upload className="h-6 w-6 text-[#8b949e] transition-colors group-hover:text-[#e6edf3]" />
          )}
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-[#e6edf3]">
            {isDragActive
              ? dragMessage || 'Отпустите файл'
              : 'Перетащите датасет сюда'}
          </p>
          <p className="mt-1 text-xs text-[#8b949e]">
            CSV, XLSX или XLS · до 50MB
          </p>
        </div>
      </div>
    </div>
  );
}
