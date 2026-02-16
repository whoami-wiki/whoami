export interface ImageEntry {
  src: string | null; // path in /public, null = use placeholder color
  alt: string;
  color: string; // tailwind bg class used as placeholder
}

export const imageMap: Record<string, ImageEntry> = {
  // — Canon PowerShot A2300 —
  img_canon_rajasthan: {
    src: "/images/img_canon_rajasthan.png",
    alt: "Rajasthan trip, 2008",
    color: "bg-amber-200",
  },
  img_canon_family: {
    src: "/images/img_canon_family.png",
    alt: "Family photo, Diwali",
    color: "bg-orange-200",
  },

  // — Mumbai Dance Competition —
  img_mumbai_stage: {
    src: "/images/img_mumbai_stage.png",
    alt: "Backstage before the performance",
    color: "bg-pink-200",
  },
  img_mumbai_train: {
    src: "/images/img_mumbai_train.png",
    alt: "Train to Mumbai",
    color: "bg-sky-200",
  },
  img_mumbai_marine: {
    src: "/images/img_mumbai_marine.png",
    alt: "Marine Drive, after the competition",
    color: "bg-indigo-200",
  },

  // — The Goa Trip —
  img_goa_villa: {
    src: "/images/img_goa_villa.png",
    alt: "The villa in Assagao",
    color: "bg-amber-200",
  },
  img_goa_pool: {
    src: "/images/img_goa_pool.png",
    alt: "The pool (before the light incident)",
    color: "bg-cyan-200",
  },
  img_goa_group: {
    src: "/images/img_goa_group.png",
    alt: "All six at the villa",
    color: "bg-orange-200",
  },
  img_goa_beach: {
    src: "/images/img_goa_beach.png",
    alt: "Anjuna Beach afternoon",
    color: "bg-teal-200",
  },
  img_goa_dosa: {
    src: "/images/img_goa_dosa.png",
    alt: "The dosa cart in Mapusa",
    color: "bg-yellow-200",
  },
  img_goa_sunset: {
    src: "/images/img_goa_sunset.png",
    alt: "Sunset from the balcony",
    color: "bg-rose-200",
  },

  // — Astral Projection —
  img_band_show: {
    src: "/images/img_band_show.png",
    alt: "The one show, hostel common room",
    color: "bg-violet-200",
  },
  img_band_practice: {
    src: "/images/img_band_practice.png",
    alt: "Practice session, C-204",
    color: "bg-purple-100",
  },
  img_band_group: {
    src: "/images/img_band_group.png",
    alt: "Astral Projection, all four",
    color: "bg-pink-100",
  },

  // — The Croma Heist —
  img_croma_store: {
    src: "/images/img_croma_store.png",
    alt: "Croma, Pune (2014)",
    color: "bg-blue-100",
  },
  img_croma_batteries: {
    src: "/images/img_croma_batteries.png",
    alt: "The batteries",
    color: "bg-yellow-100",
  },

  // — The Indiranagar Apartment —
  img_flat_balcony: {
    src: "/images/img_flat_balcony.png",
    alt: "The balcony, morning",
    color: "bg-sky-100",
  },
  img_flat_moving: {
    src: "/images/img_flat_moving.png",
    alt: "Moving day, Aug 2021",
    color: "bg-amber-100",
  },

  // — Hot Wheels Collection —
  img_hw_display: {
    src: "/images/img_hw_display.png",
    alt: "Display case, Indiranagar flat",
    color: "bg-amber-100",
  },
  img_hw_camaro: {
    src: "/images/img_hw_camaro.png",
    alt: "'67 Camaro Super Treasure Hunt",
    color: "bg-red-200",
  },
  img_hw_spreadsheet: {
    src: "/images/img_hw_spreadsheet.png",
    alt: "The spreadsheet",
    color: "bg-green-100",
  },

  // — March 2020 – June 2021 —
  img_lockdown_pune: {
    src: "/images/img_lockdown_pune.png",
    alt: "View from Pune flat, April 2020",
    color: "bg-gray-200",
  },
  img_lockdown_desk: {
    src: "/images/img_lockdown_desk.png",
    alt: "WFH setup, version 1",
    color: "bg-slate-100",
  },
  img_lockdown_move: {
    src: "/images/img_lockdown_move.png",
    alt: "Moving day, Bangalore",
    color: "bg-sky-100",
  },

  // — Sid —
  img_sid_bits: {
    src: "/images/img_sid_bits.png",
    alt: "Sid at BITS orientation",
    color: "bg-amber-100",
  },
  img_sid_civic: {
    src: "/images/img_sid_civic.png",
    alt: "The birthday Civic (Hot Wheels)",
    color: "bg-red-100",
  },
  img_sid_flat: {
    src: "/images/img_sid_flat.png",
    alt: "Sid in the Indiranagar flat",
    color: "bg-blue-100",
  },

  // — Nandi Hills —
  img_nh_sunrise: {
    src: "/images/img_nh_sunrise.png",
    alt: "Sunrise from Nandi Hills summit",
    color: "bg-orange-200",
  },
  img_nh_roads: {
    src: "/images/img_nh_roads.png",
    alt: "Winding roads at the summit",
    color: "bg-sky-200",
  },
  img_nh_route: {
    src: "/images/img_nh_route.png",
    alt: "Cycling route map",
    color: "bg-lime-200",
  },
  img_nh_dosa: {
    src: "/images/img_nh_dosa.png",
    alt: "Summit dosa stall",
    color: "bg-yellow-100",
  },

  // — Aai —
  img_aai_school: {
    src: "/images/img_aai_school.png",
    alt: "Aai at school",
    color: "bg-pink-100",
  },
  img_aai_diwali: {
    src: "/images/img_aai_diwali.png",
    alt: "Diwali at home, Pune",
    color: "bg-orange-100",
  },

  // — Infobox images —
  img_ib_canon: {
    src: "/images/img_ib_canon.png",
    alt: "Canon PowerShot A2300",
    color: "bg-slate-100",
  },
  img_ib_mumbai: {
    src: "/images/img_ib_mumbai.png",
    alt: "Mumbai Dance Competition",
    color: "bg-pink-100",
  },
  img_ib_goa: {
    src: "/images/img_ib_goa.png",
    alt: "The Goa Trip",
    color: "bg-amber-100",
  },
  img_ib_band: {
    src: "/images/img_ib_band.png",
    alt: "Astral Projection",
    color: "bg-violet-100",
  },
  img_ib_croma: {
    src: "/images/img_ib_croma.png",
    alt: "The Croma Heist",
    color: "bg-blue-50",
  },
  img_ib_flat: {
    src: "/images/img_ib_flat.png",
    alt: "The Indiranagar Apartment",
    color: "bg-sky-50",
  },
  img_ib_hw: {
    src: "/images/img_ib_hw.png",
    alt: "Hot Wheels Collection",
    color: "bg-amber-50",
  },
  img_ib_lockdown: {
    src: "/images/img_ib_lockdown.png",
    alt: "March 2020 – June 2021",
    color: "bg-gray-100",
  },
  img_ib_sid: {
    src: "/images/img_ib_sid.png",
    alt: "Sid",
    color: "bg-amber-50",
  },
  img_ib_nandi: {
    src: "/images/img_ib_nandi.png",
    alt: "Nandi Hills",
    color: "bg-orange-100",
  },
  img_ib_aai: {
    src: "/images/img_ib_aai.png",
    alt: "Aai",
    color: "bg-pink-50",
  },
  img_ib_priya: {
    src: "/images/img_ib_priya.png",
    alt: "Priya",
    color: "bg-sky-50",
  },
  img_ib_appa: {
    src: "/images/img_ib_appa.png",
    alt: "Appa",
    color: "bg-stone-100",
  },
  img_ib_kavya: {
    src: "/images/img_ib_kavya.png",
    alt: "Kavya",
    color: "bg-rose-50",
  },
  img_ib_gang: {
    src: "/images/img_ib_gang.png",
    alt: "College Gang",
    color: "bg-orange-50",
  },

  // — Gallery pair images —
  img_mumbai_night: {
    src: "/images/img_mumbai_night.png",
    alt: "Marine Drive at night",
    color: "bg-indigo-200",
  },

  // — Photos app: Rajasthan 2008 camera roll —
  img_roll_raj_1: {
    src: "/images/img_roll_raj_1.png",
    alt: "Mehrangarh Fort entrance",
    color: "bg-amber-200",
  },
  img_roll_raj_2: {
    src: "/images/img_roll_raj_2.png",
    alt: "Blue city from the fort",
    color: "bg-sky-200",
  },
  img_roll_raj_3: {
    src: "/images/img_roll_raj_3.png",
    alt: "Camel ride, Thar Desert",
    color: "bg-yellow-200",
  },
  img_roll_raj_4: {
    src: "/images/img_roll_raj_4.png",
    alt: "Dinner at a dhaba",
    color: "bg-orange-200",
  },
  img_roll_raj_5: {
    src: "/images/img_roll_raj_5.png",
    alt: "Jaipur bazaar",
    color: "bg-pink-200",
  },
  img_roll_raj_6: {
    src: "/images/img_roll_raj_6.png",
    alt: "Hawa Mahal",
    color: "bg-rose-200",
  },
  img_roll_raj_7: {
    src: "/images/img_roll_raj_7.png",
    alt: "Amber Fort",
    color: "bg-amber-100",
  },
  img_roll_raj_8: {
    src: "/images/img_roll_raj_8.png",
    alt: "Hotel room",
    color: "bg-stone-200",
  },
  img_roll_raj_9: {
    src: "/images/img_roll_raj_9.png",
    alt: "Road trip home",
    color: "bg-yellow-100",
  },
};
