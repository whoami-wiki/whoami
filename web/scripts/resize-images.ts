import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, "../public/images");
const OUT_DIR = path.join(__dirname, "../public/images/cropped");

// Display sizes (CSS px) — we generate at 2x for retina
const SIZES = {
  // Infobox: w-48 (192px) × h-28 (112px) → 2x = 384×224
  infobox: { w: 384, h: 224 },
  // Thumb: w-36 (144px) × h-24 (96px) → 2x = 288×192
  thumb: { w: 288, h: 192 },
  // Gallery: ~250px × h-28 (112px) → 2x = 500×224
  gallery: { w: 500, h: 224 },
  // Photo grid: ~80px square cells → 2x = 160×160
  grid: { w: 160, h: 160 },
};

// Map each image to its display context
// Infobox images are only used in infoboxes
// Section images with 1 image per section → thumb
// Section images with 2+ per section → gallery
const imageContext: Record<string, keyof typeof SIZES> = {
  // Infobox images
  img_ib_canon: "infobox",
  img_ib_mumbai: "infobox",
  img_ib_goa: "infobox",
  img_ib_band: "infobox",
  img_ib_croma: "infobox",
  img_ib_flat: "infobox",
  img_ib_hw: "infobox",
  img_ib_mc: "infobox",
  img_ib_lockdown: "infobox",
  img_ib_sid: "infobox",
  img_ib_nandi: "infobox",
  img_ib_aai: "infobox",
  img_ib_priya: "infobox",
  img_ib_appa: "infobox",
  img_ib_kavya: "infobox",
  img_ib_gang: "infobox",

  // Canon PowerShot A2300
  img_canon_camera: "thumb",
  img_canon_rajasthan: "thumb",
  img_canon_family: "thumb",

  // Mumbai Dance Competition
  img_mumbai_stage: "thumb",
  img_mumbai_train: "thumb",
  img_mumbai_marine: "thumb",

  // The Goa Trip — some sections have 2 images (gallery)
  img_goa_villa: "thumb",
  img_goa_pool: "thumb",
  img_goa_dosa: "thumb",
  img_goa_group: "thumb",
  img_goa_beach: "gallery", // Daily life has beach + sunset
  img_goa_sunset: "gallery",

  // Astral Projection
  img_band_show: "thumb",
  img_band_practice: "thumb",
  img_band_group: "thumb",

  // Croma Heist
  img_croma_store: "thumb",
  img_croma_batteries: "thumb",

  // Indiranagar Apartment
  img_flat_balcony: "thumb",
  img_flat_listing: "thumb",
  img_flat_moving: "thumb",

  // Hot Wheels
  img_hw_display: "thumb",
  img_hw_camaro: "thumb",
  img_hw_spreadsheet: "thumb",

  // prakash-smp
  img_mc_spawn: "thumb",
  img_mc_mountain: "thumb",
  img_mc_railway: "thumb",

  // Lockdown
  img_lockdown_pune: "thumb",
  img_lockdown_desk: "thumb",
  img_lockdown_move: "thumb",

  // Sid
  img_sid_bits: "thumb",
  img_sid_civic: "thumb",
  img_sid_flat: "thumb",

  // Nandi Hills
  img_nh_sunrise: "thumb",
  img_nh_bikes: "thumb",
  img_nh_route: "thumb",
  img_nh_dosa: "thumb",

  // Aai
  img_aai_school: "thumb",
  img_aai_call: "thumb",
  img_aai_diwali: "thumb",

  // Gallery pair images
  img_mumbai_night: "gallery",
  img_mc_nether: "gallery",

  // Photos app — Rajasthan camera roll
  img_roll_raj_1: "grid",
  img_roll_raj_2: "grid",
  img_roll_raj_3: "grid",
  img_roll_raj_4: "grid",
  img_roll_raj_5: "grid",
  img_roll_raj_6: "grid",
  img_roll_raj_7: "grid",
  img_roll_raj_8: "grid",
  img_roll_raj_9: "grid",
};

function cropAndResize(src: string, dst: string, w: number, h: number) {
  // Read source dimensions
  const info = execSync(`sips -g pixelWidth -g pixelHeight "${src}" 2>/dev/null`).toString();
  const srcW = parseInt(info.match(/pixelWidth:\s*(\d+)/)?.[1] ?? "0");
  const srcH = parseInt(info.match(/pixelHeight:\s*(\d+)/)?.[1] ?? "0");

  if (srcW === 0 || srcH === 0) {
    console.log(`  ⚠️  Could not read ${path.basename(src)}, copying as-is`);
    execSync(`cp "${src}" "${dst}"`);
    return;
  }

  // Scale so the smaller dimension fills the target (cover)
  const scale = Math.max(w / srcW, h / srcH);
  const resizedW = Math.round(srcW * scale);
  const resizedH = Math.round(srcH * scale);

  // Step 1: Resize by the dominant dimension (sips maintains aspect ratio)
  if (resizedW >= resizedH) {
    execSync(`sips --resampleWidth ${resizedW} "${src}" --out "${dst}" 2>/dev/null`);
  } else {
    execSync(`sips --resampleHeight ${resizedH} "${src}" --out "${dst}" 2>/dev/null`);
  }

  // Step 2: Center-crop to exact target dimensions
  if (resizedW > w || resizedH > h) {
    const cropX = Math.round((resizedW - w) / 2);
    const cropY = Math.round((resizedH - h) / 2);
    execSync(`sips --cropOffset ${cropY} ${cropX} --cropToHeightWidth ${h} ${w} "${dst}" --out "${dst}" 2>/dev/null`);
  }
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const ids = Object.keys(imageContext);
  console.log(`Resizing ${ids.length} images...\n`);

  let done = 0;
  for (const id of ids) {
    const src = path.join(SRC_DIR, `${id}.png`);
    const dst = path.join(OUT_DIR, `${id}.png`);

    if (!fs.existsSync(src)) {
      console.log(`  ⏭ ${id} — source not found, skipping`);
      continue;
    }

    const ctx = imageContext[id];
    const { w, h } = SIZES[ctx];
    cropAndResize(src, dst, w, h);
    done++;
    console.log(`  ✅ ${id} — ${w}×${h} (${ctx})`);
  }

  console.log(`\nDone! ${done} images resized.`);
}

main();
