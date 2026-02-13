import { generateText, gateway } from "ai";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env") });

const OUT_DIR = path.join(__dirname, "../public/images");
const IMAGE_MAP_PATH = path.join(__dirname, "../utils/image-map.ts");

// Richer prompts keyed by image ID — the alt text alone isn't descriptive
// enough to get good generations. These describe the scene for the model.
const prompts: Record<string, string> = {
  // Canon PowerShot A2300
  img_canon_camera:
    "A silver Canon PowerShot A2300 compact digital camera sitting on a wooden shelf in a blue fabric pouch, warm indoor lighting, personal photo style",
  img_canon_rajasthan:
    "A candid photo of an Indian family on vacation in Rajasthan — the father holding a compact camera, mother in a sari shielding her eyes from the sun, two kids running ahead on a dusty path, Mehrangarh Fort looming in the background, harsh midday sun, 2008 compact camera quality with slight overexposure",
  img_canon_family:
    "An Indian family celebrating Diwali at home in Pune — diyas lit on a balcony railing, rangoli on the floor, warm golden lighting, candid family photo from a compact camera",

  // Mumbai Dance Competition
  img_mumbai_stage:
    "A group of six Indian college students backstage at a dance competition in Mumbai, nervous energy, one person stretching, fluorescent lighting, candid photo",
  img_mumbai_train:
    "Interior of an Indian sleeper train compartment at night, six college students cramped together, one charging a phone, overhead berth lights, candid travel photo",
  img_mumbai_marine:
    "Six young Indian friends sitting on the Marine Drive sea wall in Mumbai at night, city lights reflecting on water, silhouettes against the skyline, candid photo",

  // The Goa Trip
  img_goa_villa:
    "A charming Portuguese-style villa in Assagao, Goa — white walls, terracotta roof, small pool in the courtyard, tropical plants, golden hour lighting",
  img_goa_pool:
    "A small villa pool at night in Goa, one underwater pool light tilted at an angle casting asymmetric blue light, someone's legs visible at the pool edge",
  img_goa_group:
    "Six Indian friends in their early twenties posing on villa steps in Goa, casual vacation clothes, big smiles, self-timer photo with slightly off framing",
  img_goa_beach:
    "Anjuna Beach in Goa on a sunny afternoon — waves, a few beach shacks, scattered tourists, colorful umbrellas, taken from the sand looking toward the water",
  img_goa_dosa:
    "A street-side dosa cart in Mapusa market, Goa — a man making masala dosa on a large tava, steam rising, morning light, busy market background",
  img_goa_sunset:
    "Golden sunset seen from a villa balcony in Goa, palm tree silhouettes, orange and pink sky, a railing with two coffee cups on it",

  // Astral Projection (band)
  img_band_show:
    "Four Indian college students performing at an open mic in a hostel common room — one on guitar, one on a practice drum pad on a chair, one singing into a mic, one on bass, about 40 people watching, fluorescent and fairy lights",
  img_band_practice:
    "Two Indian college students in a hostel room practicing music — one holding an Ibanez electric guitar, the other tapping a rubber practice drum pad, textbooks on the desk behind them",
  img_band_group:
    "Four Indian college students posing with their instruments in a hostel corridor — guitar, bass, practice pad, and one with no instrument (the singer), casual clothes, slightly awkward group photo",

  // The Croma Heist
  img_croma_store:
    "Exterior of a Croma electronics store in an Indian city, 2014 — the blue Croma signage, glass doors, a few customers entering, daytime, slightly dated photo quality",
  img_croma_batteries:
    "A pack of AA batteries (Duracell or Eveready style) sitting on a chai stall counter next to a glass of chai, humorous still life, warm lighting",

  // The Indiranagar Apartment
  img_flat_balcony:
    "A small apartment balcony in Bangalore in the morning — monstera plant, snake plants, herbs in pots, one plastic chair with a coffee mug on the armrest, soft morning light, metro station visible in the distance",
  img_flat_listing:
    "A screenshot of an Indian apartment listing app (NoBroker style) showing a 2BHK in Indiranagar Bangalore — photos of rooms, rent price in rupees, map, clean UI",
  img_flat_moving:
    "Two Indian men in their twenties unloading boxes from a small Tata Ace truck into an apartment building in Bangalore, moving day, casual clothes, slightly chaotic",

  // Hot Wheels Collection
  img_hw_display:
    "Three small acrylic display cases mounted on a bedroom wall, filled with rows of Hot Wheels miniature cars, warm lamp lighting, a guitar visible in the corner",
  img_hw_camaro:
    "Close-up of a Hot Wheels '67 Camaro Super Treasure Hunt miniature car, metallic blue-green paint with flame details, sitting on a white surface, macro photography",
  img_hw_spreadsheet:
    "A laptop screen showing a Google Sheets spreadsheet tracking Hot Wheels cars — columns for model, year, series, condition, notes — some cells have funny comments, cozy desk setup",

  // prakash-smp
  img_mc_spawn:
    "A cozy village in a blocky voxel video game — small wooden houses along cobblestone paths, wheat farms, lanterns, a storage building, peaceful daytime scene, warm lighting, no people",
  img_mc_mountain:
    "A Minecraft screenshot of a large mountain fortress base — carved into a mountainside, multiple levels, bridges, a display room visible inside with item frames, dramatic in-game lighting",
  img_mc_railway:
    "A Minecraft screenshot of a long minecart railway system stretching across a plains biome, powered rails, covered sections, organized infrastructure, in-game daytime",

  // March 2020 – June 2021
  img_lockdown_pune:
    "View from an apartment window in Pune, India during lockdown — empty street below, a few parked cars, residential buildings, hazy afternoon light, April 2020 atmosphere",
  img_lockdown_desk:
    "A makeshift work-from-home desk setup in a childhood bedroom — laptop on a small desk, a water bottle, headphones, a bookshelf with old textbooks behind, warm indoor lighting",
  img_lockdown_move:
    "Two Indian men loading suitcases and boxes into auto-rickshaws outside a Pune apartment building, early morning, masks on, moving to a new city during COVID times",

  // Sid
  img_sid_bits:
    "An Indian college student at a campus orientation event — BITS Pilani campus in the background (desert landscape), wearing a college t-shirt, slightly shy smile, candid photo",
  img_sid_civic:
    "Close-up of a hand-painted Hot Wheels Honda Civic miniature car — dark green with gold accent stripes, slightly uneven paint job (charming/handmade), sitting in a display case",
  img_sid_flat:
    "A young Indian man sitting on a couch in a Bangalore apartment, laptop open, plants on the balcony visible behind him, casual and comfortable, afternoon light",

  // Nandi Hills
  img_nh_sunrise:
    "Sunrise seen from Nandi Hills summit near Bangalore — golden light breaking over the plateau, misty valleys below, a few cyclists at the viewpoint, dramatic sky",
  img_nh_bikes:
    "Two road bicycles (a Btwin Riverside 500 and a Triban RC520) leaning against a stone wall at the Nandi Hills summit, sunrise light, water bottles attached",
  img_nh_route:
    "A simple map showing a cycling route from Bangalore to Nandi Hills — a thin red/orange trail line on a satellite or terrain map, winding north through green countryside, the route ending at a hilltop, clean cartographic style like Google Maps or Strava",
  img_nh_dosa:
    "A small dosa stall at the top of Nandi Hills at sunrise — a man making masala dosa on a tava, two cyclists sitting on a bench eating, misty background, early morning light",

  // Aai
  img_aai_school:
    "Candid photo of an Indian woman in her fifties mid-lesson in a school classroom — standing to the side writing on a blackboard, wearing a sari, students' heads partially visible in foreground, natural classroom lighting, shot from the back of the room",
  img_aai_call:
    "A phone screen showing an incoming WhatsApp video call from 'Aai' with a profile photo of an Indian woman, Sunday morning, phone lying on a bedside table, 11:00 AM visible",
  img_aai_diwali:
    "An Indian family celebrating Diwali at home in Pune — mother and father on a sofa, diyas and rangoli around, warm golden light, festive decorations, cozy living room",

  // Infobox images — one per wiki page, small portrait/icon style
  img_ib_canon:
    "A silver Canon PowerShot A2300 compact camera on a white background, slightly angled, product photo style, clean and minimal, soft shadow",
  img_ib_mumbai:
    "Six Indian college students on a stage under stage lights, mid-dance, motion blur, dramatic lighting, wide shot from the audience, competition banner in background",
  img_ib_goa:
    "Aerial view of a white Portuguese-style villa with a small blue pool surrounded by palm trees in Goa, golden hour, warm tones, travel photography",
  img_ib_band:
    "A hand-drawn band logo on notebook paper — 'Astral Projection' in messy handwriting with doodles of stars and a guitar, college notebook aesthetic, slightly crumpled",
  img_ib_croma:
    "Four Indian teenagers standing outside an electronics store looking suspicious and nervous, daytime, slightly comedic framing, one holding a small shopping bag",
  img_ib_flat:
    "The exterior of a modern Indian apartment building in Bangalore, balconies with plants visible, warm evening light, urban residential neighborhood, street-level view",
  img_ib_hw:
    "A top-down view of a wooden shelf with rows of colorful Hot Wheels miniature cars arranged neatly, warm lighting, collector display, shallow depth of field",
  img_ib_mc:
    "A Minecraft screenshot of a wooden signpost at a server spawn reading 'prakash-smp', green plains behind it, blue sky, friendly survival server aesthetic",
  img_ib_lockdown:
    "An empty Indian city street during lockdown — no cars, closed shops, a single stray dog, harsh midday sunlight, eerie stillness, 2020 atmosphere",
  img_ib_sid:
    "A young Indian man in his mid-twenties sitting by a window with plants, soft natural light, looking slightly away from camera, quiet and thoughtful expression, casual clothes",
  img_ib_nandi:
    "A winding road going up Nandi Hills at dawn, two cyclists in the distance, mist in the valley below, dramatic orange sky, shot from behind",
  img_ib_aai:
    "An Indian woman in her fifties in a colorful sari, standing at a doorway with warm indoor light behind her, gentle smile, portrait style, slightly candid",
  img_ib_priya:
    "A young Indian woman in cycling gear standing next to a road bike, helmet in hand, confident smile, early morning light, road and hills in background",
  img_ib_appa:
    "An Indian man in his late fifties in a white shirt, sitting in an armchair reading a newspaper, reading glasses, warm living room lighting, quiet dignity",
  img_ib_kavya:
    "A young Indian woman in her early twenties on a college campus, backpack, walking between buildings, BITS Pilani desert campus visible, candid shot, golden hour",
  img_ib_gang:
    "Six Indian friends in their mid-twenties crowded into a selfie, big grins, someone's arm stretched out holding the phone, casual clothes, slightly blurry and chaotic, genuine joy",

  // Photos app — Rajasthan 2008 camera roll (Canon PowerShot A2300, family trip)
  img_roll_raj_1:
    "A family of four standing at the entrance gate of Mehrangarh Fort in Jodhpur, Indian father in polo shirt, mother in salwar kameez, boy around 9 and girl around 3, harsh midday sun, 2008 compact camera quality, slightly washed out colors, tourist photo",
  img_roll_raj_2:
    "An Indian father crouching next to his young son (around 9) and small daughter (around 3) at a fort viewpoint, blue-painted houses of Jodhpur visible below, the kids leaning on a stone railing, harsh midday sun, overexposed sky, low resolution 2008 Canon compact camera photo with slight noise and warm color cast",
  img_roll_raj_3:
    "A young Indian boy around 9 sitting on a camel in the Thar Desert, looking nervous but excited, a camel handler in a turban standing beside, flat desert stretching behind, late afternoon golden light, 2008 compact camera photo",
  img_roll_raj_4:
    "An Indian family of four eating dinner at a roadside dhaba at night — father, mother in salwar kameez, a boy around 9, a toddler girl in mother's lap, steel thalis with dal baati on a plastic table, camera flash illuminating their faces with dark background behind, harsh flash shadows, slightly red eyes, grainy low resolution 2008 Canon compact camera nighttime flash photo",
  img_roll_raj_5:
    "A photo taken in a hurry through a half-open car window from the passenger seat — a Rajasthani street scene outside with colorful shops and textiles, the car window frame visible at the top cutting into the shot, slight motion blur from a moving car, part of the side mirror visible, 2008 Canon compact camera, rushed and imperfect framing",
  img_roll_raj_6:
    "The exterior of Hawa Mahal in Jaipur, the pink sandstone honeycomb facade, taken from across the busy street with auto-rickshaws and motorcycles in the foreground, bright afternoon, tourist photo, 2008 compact camera",
  img_roll_raj_7:
    "An Indian mother and young daughter posing in front of the Amber Fort in Jaipur, the fort on the hill behind them, mother's hand on daughter's shoulder, squinting in the sun, classic tourist pose, 2008 compact camera",
  img_roll_raj_8:
    "Two Indian kids — a boy around 9 and a toddler girl around 3 — sitting on a blue vinyl Indian Railways sleeper train berth, the boy looking out the barred window, the girl leaning against him, snack wrappers and a water bottle on the berth, taken by the father from the opposite berth, dim train compartment lighting, slightly grainy 2008 Canon compact camera photo",
  // Gallery pair images
  img_mumbai_night:
    "Six Indian college friends sitting on a stone ledge at Marine Drive in Mumbai at night, city lights reflecting on the dark water, one person lying back looking at the sky, another checking their phone, relaxed and tired after a long day, dim streetlight illumination, grainy nighttime 2018 phone photo",
  img_mc_nether:
    "A Minecraft screenshot of an organized Nether hub — a large room made of stone bricks with multiple portals labeled with signs, glowstone lighting, a central pathway with item frames on the walls, lava visible through windows, dark red Nether atmosphere, in-game screenshot",

  img_roll_raj_9:
    "An Indian family packed into the back seat of a white Tata Indica, seen through the car window — father driving, mother in front, two kids in back with snacks, long empty Rajasthan highway visible through windshield, golden hour, road trip photo, 2008 compact camera",
};

const STYLE =
  "Authentic personal photograph, like a real photo from someone's phone or compact digital camera. Natural, candid, unposed — people caught mid-moment, not looking at camera or arranged symmetrically. Imperfect framing, slightly off-center compositions, natural lighting with real shadows. Depth and dimension — not flat or planar. The scene should feel lived-in and spontaneous, like a photo you'd actually find in someone's Google Photos library. Indian characters should look consistent: Jay is a slim Indian man in his mid-twenties with short black hair; Sid is slightly taller with glasses; Priya has shoulder-length hair and an athletic build.";

async function generateImage(id: string, prompt: string): Promise<string> {
  const filename = `${id}.png`;
  const outPath = path.join(OUT_DIR, filename);

  if (fs.existsSync(outPath)) {
    console.log(`  ⏭ ${id} — already exists, skipping`);
    return `/images/${filename}`;
  }

  console.log(`  ⏳ ${id} — generating...`);

  const result = await generateText({
    model: gateway("google/gemini-2.5-flash-image"),
    providerOptions: {
      google: { responseModalities: ["TEXT", "IMAGE"] },
    },
    prompt: `${STYLE}\n\n${prompt}`,
  });

  for (const file of result.files) {
    if (file.mediaType.startsWith("image/")) {
      fs.writeFileSync(outPath, Buffer.from(file.uint8Array));
      console.log(`  ✅ ${id} — saved`);
      return `/images/${filename}`;
    }
  }

  throw new Error(`No image returned for ${id}`);
}

async function updateImageMap(generated: Record<string, string>) {
  let content = fs.readFileSync(IMAGE_MAP_PATH, "utf-8");
  for (const [id, src] of Object.entries(generated)) {
    // Replace src: null with src: "/images/id.png" for each generated image
    const pattern = new RegExp(`(${id}:\\s*\\{[^}]*?)src:\\s*null`, "s");
    content = content.replace(pattern, `$1src: "${src}"`);
  }
  fs.writeFileSync(IMAGE_MAP_PATH, content);
  console.log(
    `\n✅ Updated image-map.ts with ${Object.keys(generated).length} entries`,
  );
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const ids = Object.keys(prompts);
  console.log(`Generating ${ids.length} images...\n`);

  const generated: Record<string, string> = {};
  const concurrency = 3;

  // Process in batches to avoid rate limits
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        const src = await generateImage(id, prompts[id]);
        return { id, src };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        generated[result.value.id] = result.value.src;
      } else {
        console.error(`  ❌ Failed:`, result.reason);
      }
    }
  }

  await updateImageMap(generated);
  console.log(
    `\nDone! ${Object.keys(generated).length}/${ids.length} images generated.`,
  );
}

main().catch(console.error);
