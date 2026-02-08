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
interface LoadedImage {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  dispose: () => void;
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const MAX_TRANSFORM_DIMENSION = 1600;

function encodeCrockford(value: number, length: number): string {
  let remaining = value;
  let output = '';

  for (let i = 0; i < length; i += 1) {
    output = CROCKFORD[remaining % 32] + output;
    remaining = Math.floor(remaining / 32);
  }

  return output;
}

function encodeRandomCrockford(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let output = '';
  for (let i = 0; i < length; i += 1) {
    output += CROCKFORD[bytes[i] % 32];
  }
  return output;
}

function generateUlid(): string {
  return `${encodeCrockford(Date.now(), 10)}${encodeRandomCrockford(16)}`;
}

async function loadImageSource(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, width, height) => {
        ctx.drawImage(bitmap, 0, 0, width, height);
      },
      dispose: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Could not read image.'));
    element.src = objectUrl;
  });

  return {
    width: image.width,
    height: image.height,
    draw: (ctx, width, height) => {
      ctx.drawImage(image, 0, 0, width, height);
    },
    dispose: () => {
      URL.revokeObjectURL(objectUrl);
    },
  };
}

async function transcodeImageToWebp(file: File): Promise<File> {
  const image = await loadImageSource(file);
  try {
    const maxDim = Math.max(image.width, image.height);
    const scale = maxDim > MAX_TRANSFORM_DIMENSION ? MAX_TRANSFORM_DIMENSION / maxDim : 1;
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not process image.');
    }

    image.draw(ctx, width, height);

    const webpBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }
          reject(new Error('Could not encode image.'));
        },
        'image/webp',
        0.86,
      );
    });

    if (webpBlob.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Each image must be ${Math.floor(MAX_IMAGE_SIZE_BYTES / (1024 * 1024))}MB or smaller.`);
    }

    const stem = file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'image';
    return new File([webpBlob], `${stem}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } finally {
    image.dispose();
  }
}

export function validateImageFiles(files: File[]): string | null {
  if (files.length > MAX_IMAGES_PER_POST) {
    return `You can upload up to ${MAX_IMAGES_PER_POST} images.`;
  }

  for (const file of files) {
    if (!isAllowedImageMimeType(file.type)) {
      return `Unsupported image type. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`;
    }
  }

  return null;
}

export async function uploadPostImages(kind: UploadKind, files: File[]): Promise<string[]> {
  if (!files.length) return [];

  const validationError = validateImageFiles(files);
  if (validationError) throw new Error(validationError);

  const normalizedFiles: File[] = [];
  for (const file of files) {
    normalizedFiles.push(await transcodeImageToWebp(file));
  }

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
    for (const file of normalizedFiles) {
      const path = `${kind}/${generateUlid()}.webp`;
      const { error } = await client.storage.from(QNA_IMAGE_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/webp',
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
