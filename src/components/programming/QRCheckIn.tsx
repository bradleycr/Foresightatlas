/**
 * QRCheckIn — printable QR code card for physical node offices.
 *
 * Generates a QR code that encodes `/checkin/{nodeSlug}` — the dedicated
 * single-screen tap-to-check-in landing page. When scanned, the visitor lands
 * on a celebratory one-tap flow (sign in if needed, confirm arrival, +1
 * nanowheel). This URL is the unified source of truth for all check-in QR
 * codes so the printed poster and in-app modal never drift apart.
 *
 * Rendered as a full-screen modal overlay with a white card that prints
 * cleanly on paper.
 */

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Printer, QrCode } from "lucide-react";
import type { NodeSlug, NodeColorTheme } from "../../types/events";
import { buildFullPath } from "../../utils/router";
import { cn } from "../ui/utils";
import { Z_INDEX_MODAL_BACKDROP, Z_INDEX_MODAL_CONTENT } from "../../constants/zIndex";

interface QRCheckInProps {
  nodeSlug: NodeSlug;
  nodeName: string;
  theme: NodeColorTheme;
  onClose: () => void;
}

export function QRCheckIn({ nodeSlug, nodeName, theme, onClose }: QRCheckInProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const checkInUrl = `${window.location.origin}${buildFullPath(`/checkin/${nodeSlug}`)}`;

  const handlePrint = () => {
    const card = cardRef.current;
    if (!card) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>QR Check-in – ${nodeName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: white;
    }
    .card {
      text-align: center;
      padding: 3rem 2.5rem;
      max-width: 400px;
    }
    .card h2 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #111; }
    .card p { font-size: 0.875rem; color: #666; margin-bottom: 1.5rem; }
    .card .qr { margin: 0 auto 1.5rem; }
    .card .url { font-size: 0.7rem; color: #999; word-break: break-all; }
    @media print { body { background: white; } }
  </style>
</head>
<body>
  <div class="card">
    <h2>📍 ${nodeName}</h2>
    <p>Scan to check in at the node</p>
    <div class="qr">${card.querySelector("svg")?.outerHTML ?? ""}</div>
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <QrCode className={cn("size-5", theme.avatarActiveText)} />
            <h2 className="text-base font-semibold text-gray-900">QR Check-in</h2>
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

        {/* QR card */}
        <div ref={cardRef} className="p-8 flex flex-col items-center text-center">
          <p className="text-sm text-gray-500 mb-5">
            Print or display this QR code at{" "}
            <span className="font-medium text-gray-700">{nodeName}</span>.
            Anyone scanning it can sign in and check in from their phone.
          </p>
          <div className="p-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 mb-5">
            <QRCodeSVG
              value={checkInUrl}
              size={200}
              level="M"
              includeMargin={false}
              className="mx-auto"
            />
          </div>
          <p className="text-[11px] text-gray-400 break-all leading-relaxed max-w-[260px]">
            {checkInUrl}
          </p>
        </div>

        {/* Actions */}
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
            Print
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
