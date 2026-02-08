'use client';

import { getBrowserSupabaseClient } from '../supabase/browser';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGES_PER_POST,
  QNA_IMAGE_BUCKET,
  isAllowedImageMimeType,
} from './images';

type UploadKind = 'question' | 'answer';

function extensionFromFile(file: File): string {
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';

  const dot = file.name.lastIndexOf('.');
  if (dot < 0) return 'bin';
  return file.name.slice(dot + 1).toLowerCase();
}

export function validateImageFiles(files: File[]): string | null {
  if (files.length > MAX_IMAGES_PER_POST) {
    return `You can upload up to ${MAX_IMAGES_PER_POST} images.`;
  }

  for (const file of files) {
    if (!isAllowedImageMimeType(file.type)) {
      return `Unsupported image type. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return `Each image must be ${Math.floor(MAX_IMAGE_SIZE_BYTES / (1024 * 1024))}MB or smaller.`;
    }
  }

  return null;
}

export async function uploadPostImages(kind: UploadKind, files: File[]): Promise<string[]> {
  if (!files.length) return [];

  const validationError = validateImageFiles(files);
  if (validationError) throw new Error(validationError);

  const client = getBrowserSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    throw new Error('Authentication required for upload.');
  }

  const uploadedPaths: string[] = [];

  try {
    for (const file of files) {
      const path = `${user.id}/${kind}/${Date.now()}-${crypto.randomUUID()}.${extensionFromFile(file)}`;
      const { error } = await client.storage.from(QNA_IMAGE_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

      if (error) {
        throw new Error(error.message);
      }

      uploadedPaths.push(path);
    }
  } catch (error) {
    if (uploadedPaths.length) {
      await client.storage.from(QNA_IMAGE_BUCKET).remove(uploadedPaths);
    }
    throw error;
  }

  return uploadedPaths;
}

export async function deleteUploadedImages(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const client = getBrowserSupabaseClient();
  await client.storage.from(QNA_IMAGE_BUCKET).remove(paths);
}

