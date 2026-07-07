/**
 * QRCheckIn — printable QR code poster for physical node offices.
 *
 * Generates a QR code that encodes `/checkin/{nodeSlug}` — the dedicated
 * single-screen tap-to-check-in landing page. The on-screen preview matches
 * the print layout so what you see is what you post on the wall.
 */

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Printer, QrCode } from "lucide-react";
import type { NodeSlug, NodeColorTheme } from "../../types/events";
import { getCheckInUrl } from "../../utils/checkInUrls";
import { cn } from "../ui/utils";
import { Z_INDEX_MODAL_BACKDROP, Z_INDEX_MODAL_CONTENT } from "../../constants/zIndex";

interface QRCheckInProps {
  nodeSlug: NodeSlug;
  nodeName: string;
  theme: NodeColorTheme;
  onClose: () => void;
}

const POSTER_TITLE = "The Foresight Atlas";
const POSTER_SUBTITLE = "Check in at the node today";

function PosterCopy({ nodeName, className }: { nodeName: string; className?: string }) {
  return (
    <div className={cn("text-center", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gray-500 sm:text-[11px]">
        {POSTER_TITLE}
      </p>
      <h2 className="mt-3 font-heading text-xl font-bold uppercase tracking-wide text-gray-900 sm:text-2xl">
        {POSTER_SUBTITLE}
      </h2>
      <p className="mt-2 text-sm font-medium text-gray-600 sm:text-base">{nodeName}</p>
      <p className="mt-4 text-xs text-gray-500">Scan with your phone to sign in and check in</p>
    </div>
  );
}

export function QRCheckIn({ nodeSlug, nodeName, theme, onClose }: QRCheckInProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const checkInUrl = getCheckInUrl(nodeSlug);

  const handlePrint = () => {
    const card = cardRef.current;
    if (!card) return;

    const qrSvg = card.querySelector("[data-qr-poster] svg")?.outerHTML ?? "";
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${POSTER_TITLE} — ${nodeName} check-in</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4 portrait; margin: 18mm; }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: white;
      color: #111827;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .poster {
      text-align: center;
      width: 100%;
      max-width: 420px;
      padding: 2.5rem 2rem 2rem;
      border: 2px solid #e5e7eb;
      border-radius: 1.25rem;
    }
    .eyebrow {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: #6b7280;
    }
    .headline {
      margin-top: 1rem;
      font-size: 1.75rem;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #111827;
    }
    .node {
      margin-top: 0.75rem;
      font-size: 1.05rem;
      font-weight: 600;
      color: #374151;
    }
    .hint {
      margin-top: 1.25rem;
      font-size: 0.9rem;
      line-height: 1.45;
      color: #6b7280;
    }
    .qr-wrap {
      margin: 1.75rem auto 1.25rem;
      padding: 1rem;
      display: inline-block;
      border: 2px dashed #d1d5db;
      border-radius: 1rem;
      background: #fafafa;
    }
    .qr-wrap svg { display: block; width: 240px; height: 240px; }
    .url {
      font-size: 10px;
      line-height: 1.4;
      color: #9ca3af;
      word-break: break-all;
    }
    @media print {
      body { min-height: auto; }
      .poster { border: none; border-radius: 0; max-width: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="poster">
    <p class="eyebrow">${POSTER_TITLE}</p>
    <h1 class="headline">${POSTER_SUBTITLE}</h1>
    <p class="node">${nodeName}</p>
    <p class="hint">Scan with your phone to sign in and check in</p>
    <div class="qr-wrap">${qrSvg}</div>
    <p class="url">${checkInUrl}</p>
  </div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: Z_INDEX_MODAL_BACKDROP,
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden"
        style={{ zIndex: Z_INDEX_MODAL_CONTENT }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <QrCode className={cn("size-5", theme.avatarActiveText)} />
            <h2 className="text-base font-semibold text-gray-900">Print node check-in poster</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-500 mb-4 text-center">
            Print this poster and post it at <span className="font-medium text-gray-700">{nodeName}</span>.
          </p>

          <div
            ref={cardRef}
            className="rounded-2xl border-2 border-gray-200 bg-white px-6 py-8 shadow-sm"
          >
            <PosterCopy nodeName={nodeName} />
            <div
              data-qr-poster
              className="mx-auto mt-6 w-fit rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/80 p-4"
            >
              <QRCodeSVG
                value={checkInUrl}
                size={220}
                level="M"
                includeMargin={false}
                className="mx-auto block"
              />
            </div>
            <p className="mt-4 text-center text-[10px] text-gray-400 break-all leading-relaxed">
              {checkInUrl}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border transition-colors",
              theme.ctaBg,
              theme.ctaText,
              theme.ctaBorder,
              theme.ctaHover,
            )}
          >
            <Printer className="size-4" />
            Print poster
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
