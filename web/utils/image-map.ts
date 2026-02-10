export interface ImageEntry {
  src: string | null; // path in /public, null = use placeholder color
  alt: string;
  color: string; // tailwind bg class used as placeholder
}

export const imageMap: Record<string, ImageEntry> = {
  // — Photos 2019 —
  img_p19_newyear: { src: null, alt: "New Year's party, January 2019", color: "bg-violet-200" },
  img_p19_wedding: { src: null, alt: "Cousin's wedding, March 2019", color: "bg-pink-200" },
  img_p19_marine_drive: { src: null, alt: "Fireworks over Marine Drive", color: "bg-indigo-200" },
  img_p19_iphone: { src: null, alt: "iPhone 8 camera sample", color: "bg-sky-200" },

  // — The Goa Trip —
  img_goa_villa: { src: null, alt: "The villa in Assagao", color: "bg-amber-200" },
  img_goa_pool: { src: null, alt: "Pool at the villa", color: "bg-cyan-200" },
  img_goa_beach: { src: null, alt: "Anjuna Beach afternoon", color: "bg-teal-200" },
  img_goa_group: { src: null, alt: "Group photo at the villa", color: "bg-orange-200" },
  img_goa_panjim: { src: null, alt: "Latin Quarter, Panjim", color: "bg-lime-200" },
  img_goa_snorkel: { src: null, alt: "Snorkeling GoPro still", color: "bg-sky-300" },
  img_goa_sunset: { src: null, alt: "Sunset from the balcony", color: "bg-rose-200" },

  // — WhatsApp Conversations —
  img_wa_college_gang: { src: null, alt: "College Gang group chat screenshot", color: "bg-green-200" },
  img_wa_message_chart: { src: null, alt: "Message frequency chart", color: "bg-emerald-200" },

  // — Financial Records —
  img_fin_spending_chart: { src: null, alt: "2021 monthly spending breakdown", color: "bg-blue-200" },
  img_fin_delivery_apps: { src: null, alt: "Food delivery order collage", color: "bg-orange-100" },

  // — Screenshots Archive —
  img_ss_booking: { src: null, alt: "Flight booking confirmation", color: "bg-sky-100" },
  img_ss_recipe: { src: null, alt: "Dal makhani recipe screenshot", color: "bg-yellow-200" },
  img_ss_apartment: { src: null, alt: "Apartment listing screenshot", color: "bg-stone-200" },
  img_ss_meme: { src: null, alt: "Meme forwarded to College Gang", color: "bg-fuchsia-200" },

  // — Tax Documents —
  img_tax_form16: { src: null, alt: "Form 16 header", color: "bg-slate-200" },

  // — College Years —
  img_col_orientation: { src: null, alt: "Orientation week group photo", color: "bg-amber-100" },
  img_col_room204: { src: null, alt: "Room 204, east wing", color: "bg-yellow-100" },
  img_col_mess: { src: null, alt: "Mess food documentation", color: "bg-orange-100" },
  img_col_fest_stage: { src: null, alt: "Cultural fest performance", color: "bg-pink-100" },
  img_col_robotics: { src: null, alt: "Robotics project, tech fest", color: "bg-cyan-100" },
  img_col_graduation: { src: null, alt: "Last day group photo", color: "bg-violet-100" },

  // — Career Timeline —
  img_career_first_office: { src: null, alt: "First office building", color: "bg-gray-200" },
  img_career_startup: { src: null, alt: "Startup office", color: "bg-indigo-100" },
  img_career_resume_v1: { src: null, alt: "Resume version 1 (2016)", color: "bg-stone-100" },

  // — Location History —
  img_loc_heatmap: { src: null, alt: "Location heatmap, all-time", color: "bg-red-200" },
  img_loc_commute: { src: null, alt: "Daily commute route", color: "bg-blue-100" },
  img_loc_goa_trail: { src: null, alt: "Goa trip GPS trail", color: "bg-emerald-100" },
  img_loc_himachal: { src: null, alt: "Himachal Pradesh data points", color: "bg-green-100" },

  // — Google Takeout —
  img_gt_inbox: { src: null, alt: "Gmail inbox snapshot", color: "bg-red-100" },
  img_gt_calendar: { src: null, alt: "Calendar heatmap", color: "bg-blue-100" },
  img_gt_youtube: { src: null, alt: "YouTube watch history chart", color: "bg-red-200" },

  // — Chat Logs —
  img_chat_bookclub: { src: null, alt: "Book club channel screenshot", color: "bg-teal-100" },
  img_chat_discord: { src: null, alt: "Gaming server screenshot", color: "bg-indigo-200" },

  // — Voice Memos —
  img_vm_waveform: { src: null, alt: "Voice memo waveform", color: "bg-purple-200" },
  img_vm_walking: { src: null, alt: "Walking commute route", color: "bg-lime-100" },
};
