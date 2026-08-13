"use client";

import { useState } from "react";

export default function BookThumbnailImg({
  bookId,
  cover,
  title,
  className,
}: {
  bookId: string;
  cover?: string | null;
  title: string;
  className?: string;
}) {
  const [imgSrc, setImgSrc] = useState(cover || `/api/books/${bookId}/thumb`);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-brand-600 to-indigo-700 p-1.5 text-center font-bold text-white shadow-inner ${className ?? ""}`}>
        <span className="line-clamp-2 text-[10px] leading-tight sm:text-xs">
          {title}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc}
      alt={title}
      loading="lazy"
      onError={() => {
        if (imgSrc !== `/api/public/books/${bookId}/thumb`) {
          setImgSrc(`/api/public/books/${bookId}/thumb`);
        } else {
          setFailed(true);
        }
      }}
      className={`bg-slate-800 object-cover ${className ?? ""}`}
    />
  );
}
