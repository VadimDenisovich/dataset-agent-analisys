// ============================================================
// API Route: /api/upload — File Upload Handler
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Файл не предоставлен' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Размер файла превышает 50MB' },
        { status: 400 }
      );
    }

    // Validate file extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          error: `Неподдерживаемый формат файла. Допустимые: ${ALLOWED_EXTENSIONS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Create uploads directory if not exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique file ID
    const fileId = randomUUID();
    const safeFileName = `${fileId}${ext}`;
    const filePath = join(UPLOAD_DIR, safeFileName);

    // Save file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Generate preview (first 5 rows) for CSV files
    let preview: string[][] = [];
    let columns: string[] = [];

    if (ext === '.csv') {
      const text = buffer.toString('utf-8');
      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      const headerLine = lines[0];
      if (headerLine) {
        columns = headerLine.split(',').map((c) => c.trim().replace(/"/g, ''));
        preview = lines.slice(1, 6).map((line) =>
          line.split(',').map((c) => c.trim().replace(/"/g, ''))
        );
      }
    }

    return NextResponse.json({
      fileId,
      fileName: file.name,
      fileSize: file.size,
      preview,
      columns,
    });
  } catch (error) {
    console.error('[Upload Error]', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке файла' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
