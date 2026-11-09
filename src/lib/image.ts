import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { convex } from './convex'

/** Downscales a photo so bag images stay small in storage. */
export async function compressImage(file: Blob, maxSize = 1280, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality),
  )
}

/** Uploads an already compressed photo to Convex file storage by a fresh upload URL. */
export async function uploadPhoto(photo: Blob): Promise<Id<'_storage'>> {
  const url = await convex.mutation(api.files.generateUploadUrl, {})
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': photo.type || 'image/jpeg' }, body: photo })
  if (!res.ok) throw new Error(`Photo upload failed: ${res.status}`)
  const { storageId } = (await res.json()) as { storageId: Id<'_storage'> }
  return storageId
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
