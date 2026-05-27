import imageCompression from 'browser-image-compression'
import { apiClient } from '@/lib/api/client'

const COMPRESSION_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
}

/**
 * Compress + upload รูปไป R2
 * @returns URL ของรูปที่ upload สำเร็จ
 */
export async function compressAndUpload(
  file: File,
  folder: string,
): Promise<string> {
  // Compress ก่อน upload
  let compressed: File = file
  if (file.size > 500 * 1024) { // compress เฉพาะ > 500KB
    compressed = await imageCompression(file, COMPRESSION_OPTIONS)
  }

  const fd = new FormData()
  fd.append('file', compressed)
  const res = await apiClient.post(`/uploads?folder=${folder}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data?.data?.url || ''
}

/**
 * Upload หลายรูปพร้อม progress callback
 * ถ้า fail กลางทาง → return URLs ที่สำเร็จ + error
 */
export async function uploadMultipleImages(
  files: File[],
  folder: string,
  onProgress?: (current: number, total: number, status: string) => void,
): Promise<{ urls: string[]; failedIndex: number | null; error: string | null }> {
  const urls: string[] = []

  for (let i = 0; i < files.length; i++) {
    try {
      onProgress?.(i + 1, files.length, `กำลังบีบอัดและอัปโหลดรูปที่ ${i + 1}/${files.length}...`)
      const url = await compressAndUpload(files[i], folder)
      urls.push(url)
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'อัปโหลดไม่สำเร็จ'
      return { urls, failedIndex: i, error: `รูปที่ ${i + 1}: ${msg}` }
    }
  }

  return { urls, failedIndex: null, error: null }
}
