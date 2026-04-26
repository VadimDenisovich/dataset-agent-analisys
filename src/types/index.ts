// ============================================================
// TypeScript Types
// ============================================================

export interface UploadedFile {
  fileId: string;
  fileName: string;
  fileSize: number;
  preview: string[][]; // First 5 rows as 2D array
  columns: string[];
}

export interface AgentStep {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  label: string;
  icon: string;
  detail?: string;
  timestamp: number;
}

export interface ChartData {
  id: string;
  base64: string; // base64-encoded PNG
  alt?: string;
}

export interface RateLimitState {
  active: boolean;
  retryAfter: number;
  message: string;
}

export interface AnalysisState {
  status: 'idle' | 'uploading' | 'analyzing' | 'done' | 'error';
  file: UploadedFile | null;
  steps: AgentStep[];
  error: string | null;
  rateLimit: RateLimitState | null;
}
