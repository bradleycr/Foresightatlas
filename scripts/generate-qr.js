#!/usr/bin/env node
/**
 * Generate printable QR-code SVGs for the tap-to-check-in landing pages.
 *
 * Output:
 *   public/qr-berlin.svg
 *   public/qr-sf.svg
 *   public/qr-global.svg
 *
 * The SVGs are vector, so they scale crisply at any print size (A4 poster,
 * business-card insert, laptop sticker). Each file is self-contained — no
 * external fonts or scripts — so node operators can just print and tape.
 *
 * Usage:
 *   pnpm qr                # default base URL (FORESIGHT_PUBLIC_URL or https://foresightmap.vercel.app)
 *   BASE_URL=https://... node scripts/generate-qr.js
 */

"use strict";

const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const DEFAULT_BASE = "https://foresightmap.vercel.app";

const baseUrl = (
  process.env.BASE_URL ||
  process.env.FORESIGHT_PUBLIC_URL ||
  DEFAULT_BASE
).replace(/\/+$/, "");

const TARGETS = [
  { slug: "berlin", label: "Berlin Node" },
  { slug: "sf", label: "SF Node" },
  { slug: "global", label: "Foresight" },
];

/**
 * Build a single SVG asset: QR code + label + URL + Foresight monogram.
 *
 * The output is a plain SVG string so you can drop it anywhere (docs, web,
 * print). Colours use the same indigo/sky pairing as the app so QR posters
 * visually match the node signage.
 */
async function buildSvg(targetUrl, label) {
  const qrSvg = await QRCode.toString(targetUrl, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 1,
    width: 480,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  // Extract just the inner <g>...</g> and path markup from the QRCode SVG so
  // we can embed it inside our own viewBox with additional framing.
  const innerMatch = qrSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  const innerMarkup = innerMatch ? innerMatch[1] : qrSvg;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 760" role="img" aria-labelledby="title desc">
  <title id="title">Check in at the ${label}</title>
  <desc id="desc">Scan with your phone to check in at ${targetUrl}</desc>
  <defs>
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#eef2ff"/>
      <stop offset="100%" stop-color="#e0f2fe"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="640" height="760" rx="40" ry="40" fill="url(#frame)" />
  <g transform="translate(80 60)">
    <text x="0" y="30" fill="#0369a1" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="600" letter-spacing="4">FORESIGHT</text>
    <text x="0" y="70" fill="#0f172a" font-family="Inter, system-ui, sans-serif" font-size="34" font-weight="700">Check in at the ${label}</text>
    <text x="0" y="100" fill="#475569" font-family="Inter, system-ui, sans-serif" font-size="16">Tap or scan to mark yourself here today. +1 nanowheel.</text>
  </g>
  <g transform="translate(80 160)">
    <rect x="-16" y="-16" width="512" height="512" rx="24" ry="24" fill="#ffffff" stroke="#c7d2fe" stroke-width="2" />
    <g transform="scale(1)">${innerMarkup}</g>
  </g>
  <g transform="translate(80 710)">
    <text x="0" y="0" fill="#0f172a" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="18">${escapeXml(targetUrl)}</text>
  </g>
</svg>
`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  const outDir = path.resolve(__dirname, "..", "public");
  if (!fs.existsSync(outDir)) {
    throw new Error(`Output directory does not exist: ${outDir}`);
  }

  const results = [];
  for (const target of TARGETS) {
    const url = `${baseUrl}/checkin/${target.slug}`;
    const svg = await buildSvg(url, target.label);
    const file = path.join(outDir, `qr-${target.slug}.svg`);
    fs.writeFileSync(file, svg, "utf8");
    results.push({ slug: target.slug, url, file });
  }

  console.log("[qr] Generated QR codes:");
  for (const r of results) {
    console.log(`  ${path.relative(process.cwd(), r.file).padEnd(28)} → ${r.url}`);
  }
  console.log(
    "\nTip: open the SVG in a browser or Figma to confirm the scan target, then print at any size.",
  );
}

main().catch((err) => {
  console.error("[qr] Generation failed:", err);
  process.exit(1);
});
