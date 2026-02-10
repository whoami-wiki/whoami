"use client";

import { useRef, useState, useCallback } from "react";
import { useScrollProgress } from "@/hooks/use-scroll-progress";
import { AppWindow, AppType } from "@/components/app-window";
import { File, FileType } from "@/components/file";
import { WikiWindow } from "@/components/wiki-window";

export interface TocEntry {
  label: string;
  children?: TocEntry[];
}

export interface ContentSection {
  heading: string;
  body: string; // supports [[Wiki Link]] syntax
  images?: string[]; // image IDs from image-map
}

export interface WikiPage {
  title: string;
  toc: TocEntry[];
  infoboxImage?: string; // image ID for infobox header
  infobox: { label: string; value: string }[];
  intro: string;
  sections: ContentSection[];
  scrollTop?: number; // px offset to simulate mid-read state
}

interface WindowItem {
  hideAt: number;
  page: WikiPage;
}

interface WindowGroup {
  app: AppType;
  title: string;
  top: string;
  left: string;
  width: string;
  height: string;
  zIndex: number;
  items: WindowItem[];
}

const windows: WindowGroup[] = [
  {
    app: "photos",
    title: "Photos",
    top: "5%",
    left: "2%",
    width: "40%",
    height: "55%",
    zIndex: 2,
    items: [
      {
        hideAt: 0.12,
        page: {
          title: "Photos 2019",
          toc: [
            { label: "Overview" },
            { label: "By month", children: [{ label: "January–June" }, { label: "July–December" }] },
            { label: "Cameras used" },
            { label: "Notable events", children: [{ label: "New Year's party" }, { label: "Wedding season" }] },
          ],
          infoboxImage: "img_p19_marine_drive",
          infobox: [{ label: "Total photos", value: "2,341" }, { label: "Period", value: "Jan–Dec 2019" }, { label: "Devices", value: "3 phones, 1 camera" }, { label: "Peak month", value: "December" }],
          intro: "A collection of 2,341 photos taken throughout 2019, spanning three phones and a [[Canon PowerShot A2300]]. The year's visual record begins with a New Year's house party in January and ends with fireworks over Marine Drive.",
          scrollTop: 0,
          sections: [
            { heading: "Overview", body: "2019 was the most photographed year to date, driven largely by two events: a cousin's wedding in March and [[The Goa Trip]] in December. The majority of photos were taken on an iPhone 8, with the compact camera reserved for travel." },
            { heading: "By month", body: "January through June averaged 120 photos per month, with a spike in March for the [[Wedding Season (2019)]]. July and August were quieter — mostly food photos and screenshots. September picked up with a weekend in [[Pondicherry]]. October and November were uneventful. December exploded to 680 photos, almost entirely from Goa.", images: ["img_p19_newyear", "img_p19_wedding"] },
            { heading: "Cameras used", body: "Three phones contributed to the collection: an iPhone 8 (primary), a borrowed Pixel 3 during the wedding, and an old Moto G4 that was briefly resurrected when the iPhone screen cracked. The [[Canon PowerShot A2300]] was used exclusively during the Goa trip.", images: ["img_p19_iphone"] },
            { heading: "Notable events", body: "The New Year's party produced 94 photos in a single evening, mostly blurry. The wedding weekend generated 340 photos across three devices. [[The Goa Trip]] accounts for over a third of the year's total — 847 photos in seven days.", images: ["img_p19_newyear", "img_p19_wedding", "img_p19_marine_drive"] },
          ],
        },
      },
      {
        hideAt: 0.20,
        page: {
          title: "The Goa Trip",
          toc: [
            { label: "Planning", children: [{ label: "Group chat logistics" }, { label: "Booking the villa" }] },
            { label: "The villa" },
            { label: "Daily routines", children: [{ label: "Mornings" }, { label: "Beach afternoons" }] },
            { label: "Photos" },
            { label: "Aftermath" },
          ],
          infoboxImage: "img_goa_group",
          infobox: [{ label: "Date", value: "Dec 2019" }, { label: "Location", value: "Assagao, Goa" }, { label: "People", value: "6" }, { label: "Photos", value: "847" }, { label: "Duration", value: "7 days" }],
          intro: "In December 2019, a week-long trip to Goa with [[College Years|college friends]] became one of those trips that everyone still references. The group rented a villa in Assagao, split between six people who hadn't all been in the same place since graduation.",
          scrollTop: 120,
          sections: [
            { heading: "Planning", body: "The trip was planned almost entirely in the [[WhatsApp Conversations|College Gang WhatsApp group]] over six weeks. Logistics were chaotic — three different spreadsheets were created and abandoned before someone just booked the villa unilaterally. Flights were booked separately, resulting in arrivals spread across 14 hours." },
            { heading: "The villa", body: "A three-bedroom villa in Assagao with a small pool and a kitchen nobody used for the first three days. The owner left a handwritten note with restaurant recommendations, most of which turned out to be excellent. The WiFi password was taped to the fridge.", images: ["img_goa_villa", "img_goa_pool"] },
            { heading: "Daily routines", body: "Mornings started slow — someone would eventually make pour-over coffee on the balcony, and plans for the day would materialize around noon. Most afternoons were spent at Anjuna Beach or exploring the Latin Quarter in Panjim. Evenings revolved around finding the right restaurant, a process that took longer each night.", images: ["img_goa_beach", "img_goa_panjim", "img_goa_sunset"] },
            { heading: "Photos", body: "The trip produced 847 photos across three phones, a GoPro, and one disposable camera from [[Photos 2019]] that took two months to develop. The GoPro footage alone runs to 4 hours, mostly underwater clips from a snorkeling trip that was everyone's highlight.", images: ["img_goa_snorkel", "img_goa_group"] },
            { heading: "Aftermath", body: "The [[WhatsApp Conversations|WhatsApp group]] from the trip is still active. A shared Google Photos album was created but never properly organized. Two people got matching sunburns that became a running joke. Plans for a reunion trip have been floated every December since." },
          ],
        },
      },
      {
        hideAt: 0.38,
        page: {
          title: "College Years",
          toc: [
            { label: "Freshman year" },
            { label: "Hostel life", children: [{ label: "Room 204" }, { label: "Mess food" }] },
            { label: "Fests", children: [{ label: "Cultural fest" }, { label: "Tech fest" }] },
            { label: "Final semester" },
          ],
          infoboxImage: "img_col_graduation",
          infobox: [{ label: "Period", value: "2012–2016" }, { label: "Institution", value: "University" }, { label: "Cameras", value: "Android phones" }, { label: "Highlight", value: "Fest rehearsals" }],
          intro: "Photos from 2012–2016 at university, largely taken on a series of increasingly cracked Android phones. These years laid the foundation for the [[WhatsApp Conversations|College Gang]] group that persists to this day.",
          scrollTop: 90,
          sections: [
            { heading: "Freshman year", body: "The earliest photos are from orientation week — awkward group shots with people who would become inseparable. The Moto G was the primary camera. Photo quality is poor but the enthusiasm is unmistakable. A handful of photos from the first semester survive; most were lost in a phone-to-phone transfer gone wrong.", images: ["img_col_orientation"] },
            { heading: "Hostel life", body: "Room 204 in the east wing became the default gathering spot from second year onward. Photos document an evolving wall of posters, a perpetually messy desk, and the view from the window that everyone agreed was the best in the building. Mess food was photographed with surprising regularity — partly as complaint evidence, partly as genuine documentation.", images: ["img_col_room204", "img_col_mess"] },
            { heading: "Fests", body: "The cultural fest produced the most photos per event — rehearsals, performances, backstage chaos, and the inevitable afterparty. The tech fest photos are fewer but include the only surviving images of a robotics project that placed third. Several fest photos later appeared in the [[WhatsApp Conversations|College Gang group]] during nostalgia nights.", images: ["img_col_fest_stage", "img_col_robotics"] },
            { heading: "Final semester", body: "The final semester photos have a different quality — everyone knew it was ending. Group shots became more deliberate. Someone started a tradition of photographing every \"last\" — last mess meal, last library session, last hostel night. These photos are the most-shared in the [[WhatsApp Conversations|group chat]], especially around graduation anniversaries. Many of the people in these photos would later reunite for [[The Goa Trip]].", images: ["img_col_graduation"] },
          ],
        },
      },
    ],
  },
  {
    app: "finder",
    title: "Downloads",
    top: "8%",
    left: "55%",
    width: "38%",
    height: "48%",
    zIndex: 3,
    items: [
      {
        hideAt: 0.25,
        page: {
          title: "Screenshots Archive",
          toc: [
            { label: "Booking confirmations", children: [{ label: "Flights" }, { label: "Hotels" }] },
            { label: "Recipes" },
            { label: "Apartment hunt" },
            { label: "Miscellaneous" },
          ],
          infoboxImage: "img_ss_booking",
          infobox: [{ label: "Total", value: "1,200+" }, { label: "Period", value: "2018–2023" }, { label: "Top type", value: "Booking confirmations" }, { label: "Devices", value: "4 phones" }],
          intro: "A folder of 1,200+ screenshots accumulated between 2018 and 2023. Mostly booking confirmations, memes sent to the wrong chat, recipes that were never cooked, and apartment listings. A surprisingly detailed record of daily digital life.",
          scrollTop: 180,
          sections: [
            { heading: "Booking confirmations", body: "Flight confirmations make up the largest subcategory, with every trip from 2018 onward documented — including both legs of the [[The Goa Trip|Goa trip]]. Hotel bookings, train tickets, and the occasional Uber receipt for airport rides round out the travel screenshots. Several confirmations correspond to entries in the [[Financial Records (2021)|financial records]].", images: ["img_ss_booking"] },
            { heading: "Recipes", body: "47 recipe screenshots saved from Instagram and YouTube, of which exactly three were ever attempted. The bread-baking phase of 2021 (see [[Financial Records (2021)|lockdown spending]]) is well-documented. One screenshot is a recipe for dal makhani sent by a grandmother — the only one that was actually cooked regularly.", images: ["img_ss_recipe"] },
            { heading: "Apartment hunt", body: "Three distinct apartment-hunting phases are visible: 2019 (post-[[College Years|graduation]]), mid-2020 (pandemic relocation), and 2022 (upgrading). Each phase generated 40–60 screenshots of listings, floor plans, and Google Maps distances to the office. The 2022 search also produced a spreadsheet screenshot that cross-references [[Location History|commute times]].", images: ["img_ss_apartment"] },
            { heading: "Miscellaneous", body: "The remaining screenshots include memes (forwarded to the [[WhatsApp Conversations|College Gang group]]), error messages from debugging sessions, Wi-Fi passwords from cafes, and a surprising number of score updates from cricket matches. One screenshot from 2019 captures a [[Career Timeline|job offer]] notification.", images: ["img_ss_meme"] },
          ],
        },
      },
      {
        hideAt: 0.30,
        page: {
          title: "Google Takeout",
          toc: [
            { label: "Gmail" },
            { label: "Drive" },
            { label: "Calendar", children: [{ label: "Busy weeks" }, { label: "Unscheduled stretches" }] },
            { label: "YouTube history" },
            { label: "Chrome bookmarks" },
          ],
          infoboxImage: "img_gt_inbox",
          infobox: [{ label: "Export size", value: "12 GB" }, { label: "Services", value: "6" }, { label: "YouTube entries", value: "15,000" }, { label: "Longest free stretch", value: "11 days" }],
          intro: "A full Google Takeout export: 12 GB covering Gmail, Drive, Calendar, Maps, YouTube history, and Chrome bookmarks. The [[Location History]] data was extracted from this export.",
          scrollTop: 280,
          sections: [
            { heading: "Gmail", body: "The Gmail archive contains 24,000 emails dating back to 2011. The earliest messages are college admission confirmations. Automated emails (delivery notifications, OTPs, newsletters) account for roughly 70%. The remaining 30% include job-related correspondence that mirrors the [[Career Timeline]], travel confirmations that match the [[Screenshots Archive]], and a handful of long personal emails that read like diary entries.", images: ["img_gt_inbox"] },
            { heading: "Drive", body: "Google Drive contains 1,200 files, the oldest being [[College Years|college assignments]] from 2013. Notable items include 14 versions of the resume (see [[Career Timeline]]), a shared spreadsheet from [[The Goa Trip]] planning, and a folder of scanned documents that overlaps with the [[Tax Documents]] archive. Several files were shared with the [[WhatsApp Conversations|College Gang]] group." },
            { heading: "Calendar", body: "Calendar data reveals that \"busy\" weeks averaged 14 events while the longest unscheduled stretch was an 11-day vacation in 2019 — the [[The Goa Trip]]. Work meetings dominate from 2020 onward, reflecting the shift to remote work. Personal events cluster around weekends and correlate with [[Location History|location data]] spikes outside the usual patterns.", images: ["img_gt_calendar"] },
            { heading: "YouTube history", body: "The watch history runs to 15,000 entries. Patterns emerge: a cooking video binge in early 2021 (the bread-baking phase from [[Financial Records (2021)]]), a deep dive into productivity systems every January, and a consistent stream of cricket highlights. The most-watched category is music, followed by tech reviews and travel vlogs that often preceded actual trips.", images: ["img_gt_youtube"] },
            { heading: "Chrome bookmarks", body: "The bookmarks folder structure is an archaeology of abandoned interests: a \"Learn Piano\" folder with 12 links (never pursued), a \"Startup Ideas\" folder that overlaps with [[Voice Memos]], and a \"Recipes\" folder that duplicates the [[Screenshots Archive|screenshot collection]] almost exactly. The most-bookmarked domain is Stack Overflow." },
          ],
        },
      },
      {
        hideAt: 0.42,
        page: {
          title: "Career Timeline",
          toc: [
            { label: "First job" },
            { label: "The startup" },
            { label: "Current role" },
            { label: "Resume evolution", children: [{ label: "Two-page era" }, { label: "One-page era" }, { label: "Redesigns" }] },
          ],
          infoboxImage: "img_career_resume_v1",
          infobox: [{ label: "Versions", value: "14" }, { label: "Period", value: "2016–2023" }, { label: "Redesigns", value: "2" }, { label: "Format", value: "1 page (current)" }],
          intro: "Fourteen versions of a resume spanning 2016 to 2023. Each revision marks either a job change, a rejected application, or a Sunday evening of existential career reflection.",
          scrollTop: 200,
          sections: [
            { heading: "First job", body: "Joined a mid-size IT services company straight out of [[College Years|university]] in 2016. The role was comfortable but plateaued quickly. The [[Tax Documents]] from this period show steady but unremarkable growth. Left after two years when a former classmate from the [[WhatsApp Conversations|College Gang]] mentioned an opening at a startup.", images: ["img_career_first_office"] },
            { heading: "The startup", body: "The startup phase lasted 18 months — intense, educational, and ultimately unsuccessful. The company ran out of funding in early 2020, just as the pandemic hit. The [[Voice Memos]] from this period include three recordings of the same startup idea that never materialized into a pivot. The experience is reflected in resume versions 7 through 9, each more concise than the last.", images: ["img_career_startup"] },
            { heading: "Current role", body: "Started at the current company in mid-2020, initially remote. The [[Location History]] data shows the gradual return to office starting in late 2021. The role has evolved significantly — the [[Tax Documents|Form 16s]] reflect two promotions. This is the longest tenure so far." },
            { heading: "Resume evolution", body: "The earliest version is a two-page document with a \"Career Objective\" section and three listed hobbies (reading, cricket, travel). By version six, it's one page. By version ten, the format has been completely redesigned twice. A [[Screenshots Archive|screenshot]] from 2019 captures the notification for the job offer that led to the startup. The current version lists no hobbies.", images: ["img_career_resume_v1"] },
          ],
        },
      },
    ],
  },
  {
    app: "messages",
    title: "WhatsApp",
    top: "15%",
    left: "30%",
    width: "30%",
    height: "52%",
    zIndex: 5,
    items: [
      {
        hideAt: 0.22,
        page: {
          title: "WhatsApp Conversations",
          toc: [
            { label: "Group chats", children: [{ label: "College Gang" }, { label: "Family" }] },
            { label: "Message patterns" },
            { label: "Media shared", children: [{ label: "Photos" }, { label: "Links" }] },
            { label: "Key threads" },
          ],
          infoboxImage: "img_wa_college_gang",
          infobox: [{ label: "Chats exported", value: "47" }, { label: "Period", value: "2016–2023" }, { label: "Longest thread", value: "College Gang" }, { label: "Messages", value: "94,000+" }],
          intro: "Exported chat logs spanning 2016–2023 across 47 individual and group conversations. The longest-running thread — \"College Gang\" — contains 94,000 messages over seven years.",
          scrollTop: 240,
          sections: [
            { heading: "Group chats", body: "The College Gang group has been active since 2016, surviving two platform migrations and one incident where someone accidentally left. The Family group is quieter but more consistent — mostly forwarded articles and festival greetings. A short-lived [[The Goa Trip|Goa planning group]] generated 2,000 messages in six weeks before going silent.", images: ["img_wa_college_gang"] },
            { heading: "Message patterns", body: "Message frequency peaks reliably around birthdays, cricket matches (especially IPL finals), and long weekends when trip planning begins. The quietest month on record is July 2020. The busiest single day was December 31, 2019, during [[The Goa Trip]].", images: ["img_wa_message_chart"] },
            { heading: "Media shared", body: "Photos account for 60% of all media shared, followed by YouTube links and [[Screenshots Archive|screenshots]]. The College Gang group alone contains 12,000 images. A surprising number are photos of food from the [[College Years|university mess hall]]." },
            { heading: "Key threads", body: "The longest unbroken conversation thread lasted 14 hours — a debate about whether to book [[The Goa Trip]] villa or an Airbnb. Other notable threads include a 3 AM discussion about [[Career Timeline|career changes]] and a week-long argument about the best biryani in the city." },
          ],
        },
      },
      {
        hideAt: 0.48,
        page: {
          title: "Chat Logs",
          toc: [
            { label: "Telegram", children: [{ label: "Book club channel" }, { label: "Personal chats" }] },
            { label: "Discord", children: [{ label: "Gaming server" }, { label: "Rise and fall" }] },
          ],
          infoboxImage: "img_chat_bookclub",
          infobox: [{ label: "Platforms", value: "Telegram, Discord" }, { label: "Book club", value: "3 years" }, { label: "Gaming server", value: "8 months" }, { label: "Status", value: "Mostly inactive" }],
          intro: "Telegram and Discord exports alongside the [[WhatsApp Conversations|WhatsApp data]]. These platforms captured conversations and communities that didn't fit the WhatsApp model.",
          scrollTop: 40,
          sections: [
            { heading: "Telegram", body: "The Telegram archive spans 2019–2023 across 8 channels and 15 personal chats. The book club channel ran for three years — recommendations were enthusiastic and follow-through was rare. Of 94 books recommended, reading records suggest only 23 were actually finished by any member. Personal chats include conversations with two [[College Years|college friends]] who refused to use WhatsApp, and a long-running thread with a cousin that serves as an informal [[Voice Memos|voice note]] exchange.", images: ["img_chat_bookclub"] },
            { heading: "Discord", body: "The Discord logs are dominated by a gaming server created in March 2020, at the start of the first lockdown. The server peaked at 12 active members and hosted nightly sessions for three months. Activity tapered through the summer and the last message was sent in November 2020. The server still exists but nobody has posted since. Several members are also in the [[WhatsApp Conversations|College Gang]] group — the gaming era is occasionally referenced with nostalgia.", images: ["img_chat_discord"] },
          ],
        },
      },
    ],
  },
  {
    app: "numbers",
    title: "Receipts 2021.csv",
    top: "40%",
    left: "5%",
    width: "42%",
    height: "40%",
    zIndex: 1,
    items: [
      {
        hideAt: 0.32,
        page: {
          title: "Financial Records (2021)",
          toc: [
            { label: "Monthly breakdown" },
            { label: "Top categories", children: [{ label: "Food delivery" }, { label: "Rent" }, { label: "Transport" }] },
            { label: "Lockdown spending" },
            { label: "Travel expenses" },
          ],
          infoboxImage: "img_fin_spending_chart",
          infobox: [{ label: "Year", value: "2021" }, { label: "Top category", value: "Food delivery" }, { label: "Largest expense", value: "Flight (May)" }, { label: "Tracking started", value: "Jan 2021" }],
          intro: "Digital receipts and transaction records from 2021, the first full year of tracking spending. The data reveals patterns that the [[Google Takeout|calendar data]] corroborates independently.",
          scrollTop: 60,
          sections: [
            { heading: "Monthly breakdown", body: "January and February were the cheapest months — still adjusting to tracking every expense. March saw a spike from a new laptop purchase. April through June were dominated by food delivery. The second half of the year stabilized around a consistent monthly spend, broken only by the December trip fund.", images: ["img_fin_spending_chart"] },
            { heading: "Top categories", body: "Food delivery led all categories, accounting for 28% of discretionary spending. Rent and utilities were excluded from tracking. Transport costs dropped 70% compared to pre-pandemic estimates from [[Location History]], reflecting the shift to remote work. Subscriptions quietly accumulated to ₹3,200/month across 11 services." },
            { heading: "Lockdown spending", body: "The April–June lockdown tripled food delivery spending compared to Q1. Grocery spending also rose as cooking ambitions fluctuated — a bread-baking phase in April gave way to full delivery dependence by June. The [[Screenshots Archive]] contains 34 Swiggy order confirmations from this period alone.", images: ["img_fin_delivery_apps"] },
            { heading: "Travel expenses", body: "The single largest expense was a flight home in May, booked last-minute when travel restrictions briefly lifted. A weekend trip to Pondicherry in September was the only leisure travel. The December contribution to the annual trip fund (which would eventually fund a 2022 reunion) closed out the year." },
          ],
        },
      },
      {
        hideAt: 0.52,
        page: {
          title: "Tax Documents",
          toc: [
            { label: "Filing history" },
            { label: "Employers", children: [{ label: "First job" }, { label: "The startup" }, { label: "Current role" }] },
            { label: "Freelance income" },
            { label: "Deductions" },
          ],
          infoboxImage: "img_tax_form16",
          infobox: [{ label: "Period", value: "2018–present" }, { label: "Employers", value: "3" }, { label: "First freelance", value: "2020" }, { label: "Filing type", value: "ITR-1 / ITR-2" }],
          intro: "Tax filings and supporting documents from 2018 onward. Form 16s from three different employers trace a [[Career Timeline|career arc]] from first job to the startup that didn't work out to the current role.",
          scrollTop: 300,
          sections: [
            { heading: "Filing history", body: "ITR-1 filings from 2018 and 2019 were straightforward single-employer returns. The 2020 filing required ITR-2 due to freelance income and capital gains from a brief experiment with stock trading. From 2021 onward, the filings reflect the complexity of the current role's compensation structure." },
            { heading: "Employers", body: "The first Form 16 is from a mid-size IT services company — the [[Career Timeline|first job]] after college. The second is from a startup that lasted 18 months before running out of funding. The third and current employer has issued Form 16s since 2020. Each transition is visible in the gap between filing dates." },
            { heading: "Freelance income", body: "The 2020 filing includes the first freelance income — a weekend project building a dashboard for a friend's business. It earned ₹45,000 over three months. The [[Career Timeline|resume]] from this period lists it as \"independent consulting.\" The project is also referenced in several [[Voice Memos]] from the same period." },
            { heading: "Deductions", body: "Section 80C investments appear consistently from 2019 onward, mostly ELSS mutual funds. The 2021 filing includes a home office deduction from the lockdown period. Rent receipts from all three apartments (tracked via [[Screenshots Archive|apartment hunt screenshots]]) support HRA claims across the full timeline." },
          ],
        },
      },
    ],
  },
  {
    app: "voicememos",
    title: "Voice Memos",
    top: "35%",
    left: "58%",
    width: "35%",
    height: "35%",
    zIndex: 4,
    items: [
      {
        hideAt: 0.56,
        page: {
          title: "Voice Memos",
          toc: [
            { label: "Walking ideas" },
            { label: "Late-night recordings", children: [{ label: "The 22-minute recording" }] },
            { label: "The startup idea" },
            { label: "Unacted reminders" },
          ],
          infoboxImage: "img_vm_waveform",
          infobox: [{ label: "Total memos", value: "83" }, { label: "Period", value: "2019–2023" }, { label: "Longest", value: "22 min" }, { label: "Recurring idea", value: "Startup pitch (×3)" }],
          intro: "A folder of 83 voice memos recorded between 2019 and 2023. Most are under a minute — ideas captured while walking, reminders that were never acted on, and one 22-minute recording that nobody remembers making.",
          scrollTop: 160,
          sections: [
            { heading: "Walking ideas", body: "The largest category: 34 memos recorded while walking, usually on the commute home (the [[Location History]] data confirms the timestamps match the walk from the train station). Topics range from app ideas to grocery lists to half-formed thoughts about relationships. Most trail off mid-sentence. A few reference conversations from the [[WhatsApp Conversations|College Gang group]] that were still being mentally processed.", images: ["img_vm_walking"] },
            { heading: "Late-night recordings", body: "Twelve memos were recorded between midnight and 4 AM. The longest — 22 minutes — captures a rambling late-night conversation between two people, neither of whom remembers recording it. The audio quality suggests it was recorded on a table during [[The Goa Trip]], based on background sounds that match the villa's location. Three other late-night memos are post-party reflections.", images: ["img_vm_waveform"] },
            { heading: "The startup idea", body: "Three memos, recorded in February 2020, June 2020, and January 2021, contain essentially the same startup idea — a tool for organizing personal digital archives. Each recording approaches the concept from a slightly different angle, and each one ends with \"I should write this down properly.\" None of them were ever written down. The idea also appears in a [[Google Takeout|Chrome bookmarks]] folder labeled \"Startup Ideas\" and in a [[Chat Logs|Telegram message]] to a friend." },
            { heading: "Unacted reminders", body: "Twenty-six memos are reminders to do things that were never done: call the dentist, cancel a subscription (the same one appears in the [[Financial Records (2021)|financial records]] for another six months), reply to an email, and return a book to a [[College Years|college friend]]. The book was eventually returned 14 months late, according to a [[WhatsApp Conversations|WhatsApp message]]." },
          ],
        },
      },
    ],
  },
  {
    app: "maps",
    title: "Location History",
    top: "55%",
    left: "25%",
    width: "38%",
    height: "38%",
    zIndex: 0,
    items: [
      {
        hideAt: 0.60,
        page: {
          title: "Location History",
          toc: [
            { label: "Daily patterns", children: [{ label: "Commute" }, { label: "Weekends" }] },
            { label: "Travel" },
            { label: "Outliers", children: [{ label: "3 AM airport" }, { label: "Himachal village" }] },
            { label: "Heatmap analysis" },
          ],
          infoboxImage: "img_loc_heatmap",
          infobox: [{ label: "Source", value: "Google Maps Timeline" }, { label: "Since", value: "Aug 2016" }, { label: "Top locations", value: "Home, Office" }, { label: "Notable outlier", value: "Himachal village" }],
          intro: "GPS data exported from [[Google Takeout|Google Maps Timeline]], August 2016 to present. The heatmap is predictable — home, office, and the route between them account for 80% of all data points. But the outliers tell the real story.",
          scrollTop: 150,
          sections: [
            { heading: "Daily patterns", body: "The commute between home and office accounts for the densest cluster of data points. Before 2020, the route was consistent — the same train line every weekday. Post-pandemic, the pattern fragmented as remote work days introduced variability. Weekend patterns center on three neighborhoods: home, a cafe near the park, and the gym. The [[Financial Records (2021)|transport spending data]] corroborates the reduced commuting.", images: ["img_loc_commute"] },
            { heading: "Travel", body: "Travel data maps cleanly onto the [[Photos 2019|photo timeline]]: a cluster in Goa (December 2019), scattered points in Pondicherry (September 2021), and a week-long trail through Himachal Pradesh. The [[The Goa Trip|Goa data]] shows the group's movement between Assagao, Anjuna Beach, and Panjim with remarkable precision. Airport visits are timestamped and match [[Screenshots Archive|booking confirmations]] almost exactly.", images: ["img_loc_goa_trail"] },
            { heading: "Outliers", body: "A 3 AM pin at the domestic terminal — the last-minute flight home referenced in the [[Financial Records (2021)|financial records]]. A cluster of points in a village in Himachal Pradesh from a trip that predates the photo archive. A single visit to a hospital in 2021 that has no corresponding photos, messages, or financial records, yet changed the trajectory of the following year.", images: ["img_loc_himachal"] },
            { heading: "Heatmap analysis", body: "The overall heatmap reveals three distinct eras: pre-pandemic (tight home-office corridor), pandemic (almost exclusively home), and post-pandemic (dispersed, with more weekend exploration). The data also reveals habits invisible to memory — a coffee shop visited every Tuesday for six months in 2018, a park that was a weekly destination until it wasn't.", images: ["img_loc_heatmap"] },
          ],
        },
      },
    ],
  },
];

const desktopFiles: { name: string; type: FileType; top: string; left: string; hideAt: number }[] = [
  { name: "Untitled folder", type: "folder", top: "3%", left: "46%", hideAt: 0.16 },
  { name: "backup_final_FINAL.zip", type: "zip", top: "68%", left: "4%", hideAt: 0.28 },
  { name: "transactions.csv", type: "csv", top: "25%", left: "92%", hideAt: 0.34 },
  { name: "notes.txt", type: "txt", top: "82%", left: "70%", hideAt: 0.44 },
  { name: "old_resume_v2.pdf", type: "pdf", top: "75%", left: "90%", hideAt: 0.50 },
  { name: "misc", type: "folder", top: "90%", left: "18%", hideAt: 0.54 },
  { name: "expenses.csv", type: "csv", top: "88%", left: "52%", hideAt: 0.58 },
];

// Flatten all items across windows, sorted by hideAt, for active page computation
const allItemsByHideAt = windows
  .flatMap((w) => w.items)
  .sort((a, b) => a.hideAt - b.hideAt);

export function DesktopScene() {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(ref);
  const [topZ, setTopZ] = useState(windows.length);
  const [zOverrides, setZOverrides] = useState<Record<string, number>>({});
  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>({});

  const bringToFront = useCallback(
    (key: string) => {
      setTopZ((z) => {
        const next = z + 1;
        setZOverrides((prev) => ({ ...prev, [key]: next }));
        return next;
      });
    },
    [],
  );

  const handleDrag = useCallback(
    (key: string, x: number, y: number) => {
      setOffsets((prev) => ({ ...prev, [key]: { x, y } }));
    },
    [],
  );

  // Active page = last consumed item across all windows
  let activePage: WikiPage | null = null;
  for (const item of allItemsByHideAt) {
    if (progress >= item.hideAt) {
      activePage = item.page;
    }
  }

  return (
    <div ref={ref} className="h-[300vh] relative">
      <div className="sticky top-0 h-dvh w-dvw bg-blue-200 dark:bg-neutral-800 flex items-center justify-center">
        {desktopFiles.map((f) =>
          progress < f.hideAt ? (
            <File key={f.name} name={f.name} type={f.type} top={f.top} left={f.left} />
          ) : null
        )}

        {windows.map((w) => {
          // Window visible while any of its items remain unconsumed
          const visible = w.items.some((item) => progress < item.hideAt);
          if (!visible) return null;
          const off = offsets[w.title];
          return (
            <AppWindow
              key={w.title}
              app={w.app}
              title={w.title}
              top={w.top}
              left={w.left}
              width={w.width}
              height={w.height}
              zIndex={zOverrides[w.title] ?? w.zIndex}
              onFocus={() => bringToFront(w.title)}
              onDrag={(x, y) => handleDrag(w.title, x, y)}
              offsetX={off?.x ?? 0}
              offsetY={off?.y ?? 0}
            />
          );
        })}

        <WikiWindow activePage={activePage} zIndex={topZ + 1} />
      </div>
    </div>
  );
}
