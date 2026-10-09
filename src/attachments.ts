import type { ImageAttachment } from "./types";

export const MAX_IMAGE_ATTACHMENTS = 3;
export const MAX_IMAGE_BYTES = 1_000_000;
export const MAX_IMAGE_DATA_URL_LENGTH = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 256;

function createAttachmentId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function readImageFile(file: File): Promise<ImageAttachment> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("只能添加图片文件。"));
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Promise.reject(new Error("单张图片不能超过 1 MB。"));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败，请重试。"));
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result.startsWith("data:image/")) {
        reject(new Error("图片格式无法读取。"));
        return;
      }
      resolve({
        id: createAttachmentId(),
        name: file.name || "未命名图片",
        type: file.type,
        size: file.size,
        dataUrl: reader.result,
      });
    };
    reader.readAsDataURL(file);
  });
}

export async function readImageFiles(files: FileList | File[], remaining: number) {
  const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
  if (imageFiles.length === 0) {
    throw new Error("请选择图片文件，或直接粘贴截图。 ");
  }
  if (remaining <= 0) {
    throw new Error(`每条内容最多添加 ${MAX_IMAGE_ATTACHMENTS} 张图片。`);
  }

  const selected = imageFiles.slice(0, remaining);
  return {
    attachments: await Promise.all(selected.map(readImageFile)),
    skipped: imageFiles.length - selected.length,
  };
}
