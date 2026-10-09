import type { ImageAttachment } from "../types";
import { useEffect, useState } from "react";

export function ImageAttachments({
  attachments,
  onChange,
  notice,
}: {
  attachments?: ImageAttachment[];
  onChange?: (attachments: ImageAttachment[]) => void;
  notice?: string;
}) {
  const items = attachments ?? [];
  const [selectedAttachment, setSelectedAttachment] = useState<ImageAttachment | null>(null);

  useEffect(() => {
    if (!selectedAttachment) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedAttachment(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAttachment]);

  if (items.length === 0 && !notice) return null;

  return (
    <div className="image-attachments">
      {notice && <p className="image-attachment-notice" role="status">{notice}</p>}
      {items.length > 0 && (
        <div className="image-attachment-grid" aria-label="图片附件">
          {items.map((attachment) => (
            <figure className="image-attachment" key={attachment.id}>
              <button
                type="button"
                className="image-attachment-preview"
                onClick={() => setSelectedAttachment(attachment)}
                aria-label={`放大图片 ${attachment.name}`}
              >
                <img src={attachment.dataUrl} alt={attachment.name} />
              </button>
              {onChange ? (
                <button
                  type="button"
                  className="image-attachment-remove"
                  onClick={() => onChange(items.filter((item) => item.id !== attachment.id))}
                  aria-label={`移除图片 ${attachment.name}`}
                >
                  移除
                </button>
              ) : (
                <figcaption>{attachment.name}</figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
      {selectedAttachment && (
        <div
          className="image-lightbox-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedAttachment(null);
          }}
        >
          <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={`图片预览：${selectedAttachment.name}`}>
            <div className="image-lightbox-heading">
              <span>{selectedAttachment.name}</span>
              <button
                type="button"
                className="image-lightbox-close"
                onClick={() => setSelectedAttachment(null)}
                aria-label="关闭图片预览"
              >
                ×
              </button>
            </div>
            <img className="image-lightbox-image" src={selectedAttachment.dataUrl} alt={selectedAttachment.name} />
          </div>
        </div>
      )}
    </div>
  );
}
