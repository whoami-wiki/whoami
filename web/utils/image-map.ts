export interface ImageEntry {
  src: string | null; // path in /public, null = use placeholder color
  alt: string;
  color: string; // tailwind bg class used as placeholder
}

export const imageMap: Record<string, ImageEntry> = {
  // — Canon PowerShot A2300 —
  img_canon_camera: { src: null, alt: "The Canon PowerShot A2300", color: "bg-slate-200" },
  img_canon_rajasthan: { src: null, alt: "Rajasthan trip, 2008", color: "bg-amber-200" },
  img_canon_family: { src: null, alt: "Family photo, Diwali", color: "bg-orange-200" },

  // — Mumbai Dance Competition —
  img_mumbai_stage: { src: null, alt: "Backstage before the performance", color: "bg-pink-200" },
  img_mumbai_train: { src: null, alt: "Train to Mumbai", color: "bg-sky-200" },
  img_mumbai_marine: { src: null, alt: "Marine Drive, after the competition", color: "bg-indigo-200" },

  // — The Goa Trip —
  img_goa_villa: { src: null, alt: "The villa in Assagao", color: "bg-amber-200" },
  img_goa_pool: { src: null, alt: "The pool (before the light incident)", color: "bg-cyan-200" },
  img_goa_group: { src: null, alt: "All six at the villa", color: "bg-orange-200" },
  img_goa_beach: { src: null, alt: "Anjuna Beach afternoon", color: "bg-teal-200" },
  img_goa_dosa: { src: null, alt: "The dosa cart in Mapusa", color: "bg-yellow-200" },
  img_goa_sunset: { src: null, alt: "Sunset from the balcony", color: "bg-rose-200" },

  // — Astral Projection —
  img_band_show: { src: null, alt: "The one show, hostel common room", color: "bg-violet-200" },
  img_band_practice: { src: null, alt: "Practice session, C-204", color: "bg-purple-100" },
  img_band_group: { src: null, alt: "Astral Projection, all four", color: "bg-pink-100" },

  // — The Croma Heist —
  img_croma_store: { src: null, alt: "Croma, Pune (2014)", color: "bg-blue-100" },
  img_croma_batteries: { src: null, alt: "The batteries", color: "bg-yellow-100" },

  // — The Indiranagar Apartment —
  img_flat_balcony: { src: null, alt: "The balcony, morning", color: "bg-sky-100" },
  img_flat_listing: { src: null, alt: "NoBroker listing screenshot", color: "bg-stone-200" },
  img_flat_moving: { src: null, alt: "Moving day, Aug 2021", color: "bg-amber-100" },

  // — Hot Wheels Collection —
  img_hw_display: { src: null, alt: "Display case, Indiranagar flat", color: "bg-amber-100" },
  img_hw_camaro: { src: null, alt: "'67 Camaro Super Treasure Hunt", color: "bg-red-200" },
  img_hw_spreadsheet: { src: null, alt: "The spreadsheet", color: "bg-green-100" },

  // — prakash-smp —
  img_mc_spawn: { src: null, alt: "Spawn village, prakash-smp", color: "bg-emerald-200" },
  img_mc_mountain: { src: null, alt: "Mountain fortress (Jay's base)", color: "bg-stone-200" },
  img_mc_railway: { src: null, alt: "Sid's railway system", color: "bg-blue-100" },

  // — March 2020 – June 2021 —
  img_lockdown_pune: { src: null, alt: "View from Pune flat, April 2020", color: "bg-gray-200" },
  img_lockdown_desk: { src: null, alt: "WFH setup, version 1", color: "bg-slate-100" },
  img_lockdown_move: { src: null, alt: "Moving day, Bangalore", color: "bg-sky-100" },

  // — Sid —
  img_sid_bits: { src: null, alt: "Sid at BITS orientation", color: "bg-amber-100" },
  img_sid_civic: { src: null, alt: "The birthday Civic (Hot Wheels)", color: "bg-red-100" },
  img_sid_flat: { src: null, alt: "Sid in the Indiranagar flat", color: "bg-blue-100" },

  // — Nandi Hills —
  img_nh_sunrise: { src: null, alt: "Sunrise from Nandi Hills summit", color: "bg-orange-200" },
  img_nh_bikes: { src: null, alt: "Bikes at the summit", color: "bg-sky-200" },
  img_nh_route: { src: null, alt: "Strava route map", color: "bg-lime-200" },
  img_nh_dosa: { src: null, alt: "Summit dosa stall", color: "bg-yellow-100" },

  // — Aai —
  img_aai_school: { src: null, alt: "Aai at school", color: "bg-pink-100" },
  img_aai_call: { src: null, alt: "Sunday call screenshot", color: "bg-green-100" },
  img_aai_diwali: { src: null, alt: "Diwali at home, Pune", color: "bg-orange-100" },
};
