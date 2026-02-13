"use client";

import { useRef, useState, useCallback, useEffect } from "react";
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
  quote?: string; // blockquote text
  quoteAttrib?: string; // attribution, e.g. "— Sid, 2019"
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
    width: "720px",
    height: "495px",
    zIndex: 2,
    items: [
      {
        hideAt: 0.12,
        page: {
          title: "Canon PowerShot A2300",
          toc: [
            {
              label: "History",
              children: [{ label: "Purchase" }, { label: "The blue pouch" }],
            },
            { label: "The Rajasthan Trip (2008)" },
            {
              label: "Family events",
              children: [{ label: "Diwali" }, { label: "School functions" }],
            },
            { label: "Borrowed by Jay" },
            { label: "Retirement" },
          ],
          infoboxImage: "img_ib_canon",
          infobox: [
            { label: "Make", value: "Canon" },
            { label: "Model", value: "PowerShot A2300" },
            { label: "Bought", value: "2008" },
            { label: "Photos", value: "~14,000" },
            { label: "Status", value: "Retired (Pune)" },
          ],
          intro:
            "The family camera. Bought by [[Aai|Appa]] in 2008 for a Rajasthan trip, used at every family event for a decade, borrowed by Jay for the [[Mumbai Dance Competition]] trip, and last fired in anger at [[The Goa Trip]] before phone cameras made it redundant. Now lives in a drawer in Pune. 14,000+ photos across the family.",
          scrollTop: 0,
          sections: [
            {
              heading: "History",
              body: "Appa bought the A2300 from a Croma in Pune (ironically, the same branch as [[The Croma Heist]]) in March 2008, specifically for a family trip to Rajasthan planned that summer. It cost ₹6,500. He read the entire manual on the Pune–Jaipur train while [[Aai]] managed two kids in the next berth. For the next decade it was the default camera at every birthday, Diwali, school function, and family gathering. Aai kept it in a blue pouch in the living room cupboard.",
              quote: "Is the camera still working?",
              quoteAttrib:
                "— Appa, every six months, knowing Jay hasn't used it in years",
            },
            {
              heading: "The Rajasthan Trip (2008)",
              body: "The camera's first outing. Jay was nine. The family drove from Pune to Jaipur, Jodhpur, and Udaipur over two weeks. Appa took 400 photos — the first real photo archive in the family. Jay was allowed to use it exactly once, at Mehrangarh Fort, and the resulting photo is blurry but still in the collection.",
              images: ["img_canon_rajasthan"],
            },
            {
              heading: "Family events",
              body: "Between 2008 and 2018, the camera documented roughly 12,000 photos of family life: Diwali celebrations, [[Aai|Kavya's]] school annual days, Nana and Nani visiting from Kolhapur, the annual Ganesh Chaturthi setup on the balcony, and Jay's science fair second-place trophy ceremony at St. Vincent's. The EXIF timestamps form an unbroken record of a decade of family weekends.",
              images: ["img_canon_family"],
            },
            {
              heading: "Borrowed by Jay",
              body: 'Jay took the camera to BITS in 2017 for the [[Mumbai Dance Competition]] trip and never quite returned it. It traveled to Mumbai for the competition, back to campus for the rest of second year, and eventually to [[The Goa Trip]] in December 2019 — its last significant use. Appa occasionally asks if the camera is "still working."',
            },
            {
              heading: "Retirement",
              body: "By 2020, phone cameras had made the A2300 redundant. Jay brought it back to Pune during [[March 2020 – June 2021|lockdown]] and it went back in the cupboard. [[Aai]] sometimes pulls it out for school annual day photos when her phone storage is full. Kavya once suggested selling it; Appa changed the subject. The blue pouch is still there, next to the old Panasonic charger and a stack of SD card adapters nobody uses.",
            },
          ],
        },
      },
      {
        hideAt: 0.2,
        page: {
          title: "Mumbai Dance Competition",
          toc: [
            { label: "The idea" },
            {
              label: "Rehearsals at BITS",
              children: [{ label: "Choreography" }, { label: "The music mix" }],
            },
            { label: "The train to Mumbai" },
            { label: "The performance" },
            { label: "Marine Drive afterward" },
          ],
          infoboxImage: "img_ib_mumbai",
          infobox: [
            { label: "Date", value: "Feb 2018" },
            { label: "Location", value: "Mumbai" },
            { label: "Team", value: "6" },
            { label: "Placement", value: "DNP" },
            { label: "Photos", value: "340" },
          ],
          intro:
            "In February 2018, Jay's college dance crew went to a competition in Mumbai. They didn't win — they didn't even place — but the train ride, the backstage panic, and the post-competition Marine Drive walk became one of those stories. [[Sid]] choreographed. Priya did the music. Jay was technically the weakest dancer but had the most enthusiasm.",
          scrollTop: 120,
          sections: [
            {
              heading: "The idea",
              body: 'It started as a joke in the C-204 common room in November 2017, during the post-OASIS slump when nobody had anything to do. [[Sid]] said they should enter Groove Circuit, an intercollegiate dance competition in Mumbai. Nobody took it seriously until Sid actually registered the team as "Hostel C Rejects." By then it felt too embarrassing to back out. Six people committed, including two who had never danced in front of anyone. Vik, who wasn\'t on the team, announced he\'d come to Mumbai anyway "for moral support" (he went shopping in Colaba).',
            },
            {
              heading: "Rehearsals at BITS",
              body: "Three months of rehearsals in the hostel common room after 10 PM, when the space was free. [[Sid]] took choreography seriously — he'd watched YouTube tutorials for weeks. Jay's contribution was mostly energy and willingness to look foolish. Priya assembled the music mix on Audacity. The setlist was three Bollywood songs mashed together. Nobody agreed on the ending until the night before departure.",
              images: ["img_mumbai_train"],
            },
            {
              heading: "The train to Mumbai",
              body: "The Garib Rath from Pilani to Mumbai Central, 14 hours. Six people in one compartment, rehearsing arm movements in their berths. Meera taught everyone the opening formation using water bottles as markers. Someone's phone died at 3 AM and they spent an hour sharing a single charger — the guy in the next berth was not happy. Jay brought the [[Canon PowerShot A2300]] and took 80 photos on the train alone, including a 12-photo series of Rohit sleeping with his mouth open.",
            },
            {
              heading: "The performance",
              body: 'They were slot 23 of 40 teams. The stage was bigger than anything they\'d rehearsed for. [[Sid]]\'s opening move worked. Everything after that was controlled chaos. Jay forgot the second transition and improvised something that Priya later described as "a very confident mistake." They did not place. The judges\' feedback form said "good energy."',
              images: ["img_mumbai_stage"],
              quote: "A very confident mistake.",
              quoteAttrib: "— Priya, on Jay's improvised transition",
            },
            {
              heading: "Marine Drive afterward",
              body: "After the results, the six of them walked to Marine Drive and sat on the sea wall until midnight. Nobody was upset about losing. The conversation drifted from the competition to futures to nothing in particular. [[Sid]] said it was his favorite night of college. The [[Canon PowerShot A2300]] photos from Marine Drive are some of the best in the collection — the city lights, the group silhouetted against the water.",
              images: ["img_mumbai_marine", "img_mumbai_night"],
              quote: "Best night of college. We didn't even do anything.",
              quoteAttrib: "— Sid, Marine Drive, Feb 2018",
            },
          ],
        },
      },
      {
        hideAt: 0.38,
        page: {
          title: "The Goa Trip",
          toc: [
            {
              label: "Planning",
              children: [
                { label: "Vik's booking" },
                { label: "Rohit's spreadsheet" },
              ],
            },
            {
              label: "The villa",
              children: [{ label: "The pool light incident" }],
            },
            { label: "The Dosa Incident" },
            { label: "Daily life" },
            { label: "Photos" },
            { label: "Aftermath" },
          ],
          infoboxImage: "img_ib_goa",
          infobox: [
            { label: "Date", value: "Dec 2019" },
            { label: "Location", value: "Assagao, Goa" },
            { label: "People", value: "6" },
            { label: "Photos", value: "847" },
            { label: "Duration", value: "7 days" },
          ],
          intro:
            "December 2019, Assagao villa. Six people who'd been threatening to take a trip since BITS. Vik booked the villa without telling anyone. Rohit made a spreadsheet nobody followed. Priya drove the entire week. The pool light incident on night two. The Dosa Incident in Mapusa that birthed the phrase \"server's down again.\" 847 photos across three phones and one [[Canon PowerShot A2300]].",
          scrollTop: 90,
          sections: [
            {
              heading: "Planning",
              body: 'The trip had been "planned" since graduation in 2021. In practice, nothing happened until Vik booked an Assagao villa in October 2019 and dropped the confirmation in the College Gang group with "booked, figure out flights." Rohit responded with a 14-tab Google Sheet covering budgets, meal plans, and a "day-by-day itinerary" that was abandoned by hour three of day one. Flights were booked separately, resulting in arrivals spread across 14 hours.',
              quote: "Booked. Figure out flights.",
              quoteAttrib: "— Vik, College Gang group, Oct 2019",
            },
            {
              heading: "The villa",
              body: "Three bedrooms, a small pool, and a kitchen nobody used for the first three days. The owner left a handwritten note with restaurant recommendations — all excellent. The WiFi password was taped to the fridge. On night two, someone (everyone blames Vik) knocked a pool light loose while doing a cannonball. It still worked, but at an angle, which became the villa's defining aesthetic for the rest of the week.",
              images: ["img_goa_villa", "img_goa_pool"],
            },
            {
              heading: "The Dosa Incident",
              body: "Day four. The group went to a dosa cart in Mapusa market. Jay's dosa arrived wrong — masala instead of plain. He said \"server's down again\" without thinking. Meera laughed so hard she knocked over her coconut water. The phrase stuck. It became the default response in the College Gang group for anything going wrong, and later the name of the error channel on [[prakash-smp]].",
              images: ["img_goa_dosa"],
            },
            {
              heading: "Daily life",
              body: "Mornings started slow — Priya made pour-over coffee on the balcony while everyone else surfaced. Meera read a Murakami novel in the hammock for three straight days. Plans materialized around noon. Afternoons at Anjuna Beach or exploring Panjim — Rohit insisted on visiting the Basilica of Bom Jesus, which nobody else cared about but everyone agreed was worth it. Evenings revolved around finding a restaurant; a place called Gunpowder near Assagao became the default after night three. [[Sid]] kept a running list of sunset times and insisted on catching every one from the balcony.",
              images: ["img_goa_beach", "img_goa_sunset"],
            },
            {
              heading: "Photos",
              body: "847 photos across three phones and the [[Canon PowerShot A2300]], which Jay had borrowed from Appa. The camera's last real outing. A shared Google Photos album was created and never properly organized. The best group shot — all six on the villa steps — was taken by Priya on a self-timer after 11 attempts.",
              images: ["img_goa_group"],
            },
            {
              heading: "Aftermath",
              body: "The Goa Trip 2019 group chat is still active — separate from the main [[College Gang]] group, used exclusively for Goa-related nostalgia and reunion planning that never materializes. Rohit has proposed a Goa 2.0 spreadsheet every December since. Jay found a Hot Wheels at a flea market in Mapusa and logged it as a [[The Goa Trip]] souvenir in [[Hot Wheels Collection|the spreadsheet]]. [[Sid]] got Jay a framed photo from the villa steps for his birthday — it hangs above the TV in [[The Indiranagar Apartment]].",
            },
          ],
        },
      },
    ],
  },
  {
    app: "messages",
    title: "Messages",
    top: "15%",
    left: "30%",
    width: "432px",
    height: "468px",
    zIndex: 5,
    items: [
      {
        hideAt: 0.22,
        page: {
          title: "Astral Projection (band)",
          toc: [
            { label: "Formation" },
            {
              label: "The one show",
              children: [
                { label: "Setlist" },
                { label: "The five-string incident" },
              ],
            },
            { label: "The original song" },
            { label: "Dissolution" },
            { label: "Legacy in the group chat" },
          ],
          infoboxImage: "img_ib_band",
          infobox: [
            { label: "Active", value: "Aug–Nov 2018" },
            { label: "Members", value: "4" },
            { label: "Shows", value: "1" },
            { label: "Original songs", value: "1" },
            { label: "Status", value: "Dissolved" },
          ],
          intro:
            'A band that existed for exactly four months in second year at BITS. Jay on guitar (badly — he\'d had an Ibanez GRX20 for six months), [[Sid]] on drums (a practice pad, not real drums), Meera singing, and a fourth-year named Kartik on bass who graduated and ended the whole thing. They played one show at the hostel common room. The WhatsApp group "Astral Projection Official" has 847 messages and the last one is from 2019.',
          scrollTop: 240,
          sections: [
            {
              heading: "Formation",
              body: 'August 2018, two weeks after the [[Mumbai Dance Competition]] high had worn off. [[Sid]] proposed a band. Jay had been learning guitar for six months on an Ibanez GRX20 and could play exactly four chords confidently. Meera could actually sing. Kartik, a fourth-year, had a bass and was willing. The name "Astral Projection" was Meera\'s idea and everyone hated it but nobody suggested anything better.',
              images: ["img_band_practice"],
            },
            {
              heading: "The one show",
              body: 'October 2018, hostel common room, open mic night. The setlist was three covers — "Wonderwall" (of course), "Tera Hone Laga Hoon" (Meera\'s choice), and "Come As You Are" (Jay\'s only other song). Plus the original. Roughly 40 people watched. Jay broke a string during "Come As You Are" and played the rest with five strings. [[Sid]] kept time on a practice pad balanced on a chair. Kartik was the only one who looked like a real musician.',
              images: ["img_band_show"],
            },
            {
              heading: "The original song",
              body: 'Meera wrote a song called "3 AM Chai" about late-night hostel conversations over instant Wagh Bakri chai. It was genuinely good — three verses, a bridge, and a chorus that people actually hummed afterward. Jay played the same four chords throughout (Em–G–D–C, the only progression he knew). Meera refuses to acknowledge the song exists and changes the subject whenever it comes up. The only recording is a 47-second phone video that [[Sid]] posted in the group chat. Priya once suggested Meera record a proper version; Meera said she\'d "rather do another PhD."',
              quote: "I'd rather do another PhD.",
              quoteAttrib: "— Meera, when asked to record '3 AM Chai' properly",
            },
            {
              heading: "Dissolution",
              body: 'Kartik graduated in November 2018. Without a bassist, and with Jay\'s guitar skills plateauing at "functional," the band quietly stopped existing. No breakup announcement. The WhatsApp group went from daily messages to silence over two weeks. The last message, from January 2019, is Sid posting a meme about one-hit-wonder bands.',
              images: ["img_band_group"],
            },
            {
              heading: "Legacy in the group chat",
              body: 'The "Astral Projection Official" group chat has 847 messages, 90% from the first two months. It\'s referenced in the [[College Gang]] group whenever anyone mentions learning an instrument. Meera\'s standard response: "don\'t." Jay still has the Ibanez — it lives in a corner of [[The Indiranagar Apartment]], next to the [[Hot Wheels Collection|display cases]]. He learned the "Comfortably Numb" solo during [[March 2020 – June 2021|lockdown]], which Sid considers the band\'s greatest legacy — "four months of nonsense produced one Pink Floyd solo two years later."',
              quote:
                "Four months of nonsense produced one Pink Floyd solo two years later.",
              quoteAttrib: "— Sid",
            },
          ],
        },
      },
      {
        hideAt: 0.48,
        page: {
          title: "The Croma Heist",
          toc: [
            { label: "The plan" },
            {
              label: "The execution",
              children: [
                { label: "Jay freezes" },
                { label: "Sid and the washing machines" },
              ],
            },
            { label: "The batteries" },
            { label: "Discovery (2022)" },
            { label: "Annual retelling" },
          ],
          infoboxImage: "img_ib_croma",
          infobox: [
            { label: "Date", value: "Jul 2014" },
            { label: "Location", value: "Croma, Pune" },
            { label: "Participants", value: "4" },
            { label: "Items stolen", value: "0" },
            { label: "Items purchased", value: "AA batteries (₹120)" },
          ],
          intro:
            'The legendary failed "heist" — four 15-year-olds trying to steal a PS3 controller from the Pune Croma in July 2014. Nobody actually stole anything. The plan fell apart when Jay got nervous and bought a pack of batteries to "look normal." [[Sid]] was the lookout. The entire story lives in WhatsApp messages and gets retold with increasing exaggeration every year.',
          scrollTop: 40,
          sections: [
            {
              heading: "The plan",
              body: "Summer 2014. Jay, [[Sid]], and two school friends — Ankit and Devesh, both of whom Jay has since lost touch with — wanted a PS3 controller but nobody had ₹2,500. The plan was simple: one person distracts the staff, one grabs the controller, two act as lookouts. They spent three days planning over Frooti boxes in Sid's room while his parents were at work. The plan was written on the back of a Croma flyer. In retrospect, it had no exit strategy and relied on the assumption that Croma had no security cameras (it did).",
              images: ["img_croma_store"],
            },
            {
              heading: "The execution",
              body: "They entered the store on a Tuesday afternoon. Jay was supposed to ask a staff member about laptops while Sid grabbed the controller. Instead, Jay froze at the entrance, wandered into the wrong aisle, and spent ten minutes staring at batteries while his heart rate doubled. Sid, seeing Jay had gone off-script, panicked and pretended to browse washing machines. The other two waited outside the whole time.",
            },
            {
              heading: "The batteries",
              body: 'After 15 minutes of aimless wandering, Jay bought a pack of Eveready AA batteries for ₹120 to "look normal" on the way out. He already had batteries at home. Sid bought nothing. Ankit and Devesh had been waiting outside the whole time eating vada pav from a cart. They reconvened at the Shree Krishna chai stall across the street and collectively decided the heist was off. Nobody mentioned it for three years. Jay eventually saved up and bought the controller legitimately in October.',
              images: ["img_croma_batteries"],
            },
            {
              heading: "Discovery (2022)",
              body: 'In 2022, during a Diwali visit to Pune, [[Aai]] overheard Jay and Sid retelling the story and asked what "the Croma thing" was. Jay tried to explain. Aai was more confused than angry — "you went to steal a controller and bought batteries?" She brought it up at dinner with Appa, who laughed for five minutes.',
              quote: "You went to steal a controller and bought batteries?",
              quoteAttrib: "— Aai, 2022",
            },
            {
              heading: "Annual retelling",
              body: "The Croma Heist has been retold at least once a year since 2017, each time with escalating details. In Sid's version, a security guard chased them. In Jay's version, he made eye contact with a camera and panicked. The College Gang group chat has at least four written retellings. Meera, who wasn't there, tells the best version.",
            },
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
    width: "547px",
    height: "432px",
    zIndex: 3,
    items: [
      {
        hideAt: 0.25,
        page: {
          title: "The Indiranagar Apartment",
          toc: [
            {
              label: "The search",
              children: [
                { label: "The spreadsheet" },
                { label: "Natural light column" },
              ],
            },
            { label: "Moving in" },
            {
              label: "The balcony",
              children: [{ label: "Sid's plants" }, { label: "Jay's chair" }],
            },
            { label: "Mr. Krishnamurthy's texts" },
            { label: "Current state" },
          ],
          infoboxImage: "img_ib_flat",
          infobox: [
            { label: "Type", value: "2BHK" },
            { label: "Location", value: "Indiranagar, Bangalore" },
            { label: "Since", value: "Aug 2021" },
            { label: "Rent", value: "₹28,000/mo" },
            { label: "Roommate", value: "Sid" },
          ],
          intro:
            "The current flat. A 2BHK in Indiranagar that Jay and [[Sid]] found in August 2021 after a three-week search that generated 58 apartment listing screenshots, 14 Google Maps distance calculations, and one spreadsheet comparing rent-to-commute ratios. The winning factor was the balcony (Sid wanted it for plants, Jay wanted it for morning coffee).",
          scrollTop: 180,
          sections: [
            {
              heading: "The search",
              body: "After [[March 2020 – June 2021|moving to Bangalore together]], Jay and Sid spent three weeks on NoBroker and 99acres, visiting 11 apartments across Indiranagar, Koramangala, and HSR Layout. One place in Koramangala had a bathroom window opening directly into the neighbor's kitchen. Jay built a spreadsheet comparing rent, commute distance to both offices (Jay's fintech in Whitefield, Sid's data science firm near MG Road), and \"vibe\" (rated 1–5). Sid added a column for \"natural light\" that ended up being the deciding factor. 58 listing screenshots survive in Jay's phone gallery.",
            },
            {
              heading: "Moving in",
              body: "Moving day was August 14, 2021. Everything they owned fit in a Tata Ace mini truck plus two auto-rickshaws. The first night they sat on the floor eating biryani from a Swiggy order because the dining table hadn't arrived yet. [[Sid]] set up the WiFi before unpacking anything.",
              images: ["img_flat_moving"],
            },
            {
              heading: "The balcony",
              body: "The flat's best feature. Sid has gradually filled it with plants — a monstera, two snake plants, herbs that keep dying, and a jasmine that actually thrives. Jay's contribution is one plastic chair where he drinks coffee every morning. On clear days you can see the Indiranagar metro station. Most [[Nandi Hills]] rides start here at 4:30 AM, with bikes leaned against the balcony railing the night before.",
              images: ["img_flat_balcony"],
            },
            {
              heading: "Mr. Krishnamurthy's texts",
              body: 'The landlord, Mr. Krishnamurthy, texts "all ok?" on the first of every month. It always means "rent?" Jay and Sid have a running bet on the exact time the text will arrive — it\'s always between 9:15 and 9:45 AM. Mr. Krishnamurthy once visited unannounced and was visibly concerned about [[Hot Wheels Collection|the display cases]].',
              quote: "All ok?",
              quoteAttrib:
                "— Mr. Krishnamurthy, 1st of every month (meaning: rent?)",
            },
            {
              heading: "Current state",
              body: "The flat has settled into a comfortable state: Jay's room has the [[Hot Wheels Collection|Hot Wheels display cases]] and the Ibanez GRX20 in the corner. Sid's room has more plants than furniture and a whiteboard with ML model diagrams that never get erased. The living room has a couch, a TV permanently logged into Jay's Hotstar, and the old TP-Link router that once hosted [[prakash-smp]] before it moved to Hetzner. The kitchen is functional but underused — their Swiggy accounts have gold status. Toit Brewpub is a 7-minute walk, which Priya considers \"dangerously close\" for two people with no impulse control.",
            },
          ],
        },
      },
      {
        hideAt: 0.3,
        page: {
          title: "Hot Wheels Collection",
          toc: [
            {
              label: "The spreadsheet",
              children: [{ label: "Columns" }, { label: "The notes column" }],
            },
            { label: "Childhood era (2005–2015)" },
            { label: "The revival (2018)" },
            {
              label: "Notable cars",
              children: [
                { label: "'67 Camaro Super TH" },
                { label: "The birthday Civic" },
              ],
            },
            { label: "The group chat's reaction" },
          ],
          infoboxImage: "img_ib_hw",
          infobox: [
            { label: "Cars", value: "247" },
            { label: "Since", value: "2005 (age 6)" },
            { label: "Rarest", value: "'67 Camaro Super TH" },
            { label: "Storage", value: "3 display cases + 2 shoeboxes" },
          ],
          intro:
            "A spreadsheet-tracked collection of 247 Hot Wheels cars spanning 2005 to present. What started as a childhood hobby never stopped — it just got a spreadsheet. The collection is split between Appa's house in Pune (childhood cars, two shoeboxes) and three display cases in [[The Indiranagar Apartment]].",
          scrollTop: 280,
          sections: [
            {
              heading: "The spreadsheet",
              body: 'The tracking spreadsheet has columns for model, year, series, condition, acquisition date, cost, and notes. The notes column is the most entertaining part: "birthday gift from Kavya, she doesn\'t know what a Treasure Hunt is but she tried" and "Vik said this was ugly, Vik is wrong" and "found at a stall in Goa, technically a [[The Goa Trip]] souvenir." Meera once described the spreadsheet as "genuinely concerning."',
              images: ["img_hw_spreadsheet"],
            },
            {
              heading: "Childhood era (2005–2015)",
              body: "Appa bought Jay his first Hot Wheels — a red Dodge Viper — from Jagtap's Toy Store on Fergusson College Road when he was six. By age twelve, the collection had hit 80 cars, stored in two Nike shoeboxes under his bed. Jay used to race them on a plastic track that took up the entire hallway; [[Aai]] stepped on a '69 Mustang once and still brings it up. The hobby faded during high school when cricket and then the PS3 took over. The shoeboxes sat untouched at Appa's house for years.",
            },
            {
              heading: "The revival (2018)",
              body: "During a visit home in 2018, Jay found the shoeboxes while looking for something else. He spent an afternoon cataloguing every car, started the spreadsheet that night, and ordered three new cars from Amazon before the weekend was over. The revival coincided with the [[Astral Projection (band)|Astral Projection]] period — apparently Jay processes stress through collecting.",
            },
            {
              heading: "Notable cars",
              body: "The crown jewel is a 2015 '67 Camaro Super Treasure Hunt, found at a flea market in Bangalore for ₹150 (worth roughly ₹8,000). The most sentimental is the birthday Civic that [[Sid]] custom-painted in Jay's favorite colors. The oldest is the original red Dodge Viper from 2005, slightly chipped but still in the collection.",
              images: ["img_hw_camaro"],
            },
            {
              heading: "The group chat's reaction",
              body: "The College Gang group has mixed feelings about the collection. Sid is supportive (he painted the birthday Civic). Priya thinks it's sweet. Vik once asked \"aren't you 26?\" Meera's position is that the spreadsheet is weirder than the collection. Rohit made a graph of Jay's acquisition rate over time, which Jay immediately added to the spreadsheet.",
              images: ["img_hw_display"],
              quote: "The spreadsheet is weirder than the collection.",
              quoteAttrib: "— Meera",
            },
          ],
        },
      },
      {
        hideAt: 0.42,
        page: {
          title: "prakash-smp",
          toc: [
            { label: "Origin (lockdown week 1)" },
            {
              label: "The world",
              children: [
                { label: "Spawn village" },
                { label: "The Nether hub" },
              ],
            },
            { label: "Server ops" },
            { label: "Vik's arson" },
            {
              label: "Notable builds",
              children: [
                { label: "Mountain fortress" },
                { label: "Sid's railway" },
              ],
            },
          ],
          infoboxImage: "img_ib_mc",
          infobox: [
            { label: "Server", value: "prakash-smp" },
            { label: "Since", value: "Mar 2020" },
            { label: "Players", value: "8 (peak 12)" },
            { label: "Uptime", value: "99.2%" },
            { label: "World size", value: "4.2 GB" },
          ],
          intro:
            "A Minecraft survival server that Jay set up in March 2020 when the first lockdown hit. [[Sid]] is co-admin. Peaked at 12 players, settled to 4–5 core. Runs on a Hetzner VPS (€8/month). The world has never been reset. Vik joined and immediately burned down Sid's house — the \"server's down again\" meme from [[The Goa Trip]] was reborn.",
          scrollTop: 200,
          sections: [
            {
              heading: "Origin (lockdown week 1)",
              body: "March 25, 2020 — five days into India's first COVID lockdown. Jay was at [[Aai|Appa's house in Pune]], the startup had just folded (see [[March 2020 – June 2021]]), and he needed a project. He spun up a Minecraft server on his laptop, posted the IP in the College Gang group, and six people joined within an hour. By the end of week one, there were 12 players and the server had been migrated to a Hetzner VPS.",
            },
            {
              heading: "The world",
              body: "The world has never been reset — four years of continuous civilization. Spawn has evolved from a dirt hut to a proper village with farms, an enchanting library, and a communal storage hall that [[Sid]] maintains with terrifying organization. The Nether has a hub system that Sid built. The End was defeated in month three but nobody goes there anymore.",
              images: ["img_mc_spawn"],
            },
            {
              heading: "Server ops",
              body: "Jay handles server administration. [[Sid]] handles builds and community management. The server runs Paper MC on a Hetzner CX21 (€8/month, split between Jay and Sid). Backups run daily. The one real outage — 16 hours in June 2021 — was caused by a plugin conflict during an update. Jay was at work and didn't notice until Vik texted \"server's down again\" in the main group.",
              images: ["img_mc_railway"],
            },
            {
              heading: "Vik's arson",
              body: 'Vik joined prakash-smp in April 2020 and within two hours had "accidentally" burned down [[Sid]]\'s first house using a flint and steel near a wooden wall. Sid\'s reaction in the [[College Gang]] group was a single message: "Vik." Rohit called an emergency server meeting on Discord — the only time anyone has used voice chat for Minecraft governance. The event is referenced every time anything goes wrong on the server. Vik has since been responsible for two more fires, a creeper farm malfunction, the loss of Meera\'s horse (named Murakami, after her favorite author), and flooding the Nether hub during what he described as "an experiment."',
              quote: "Vik.",
              quoteAttrib: "— Sid, College Gang group, after the fire",
            },
            {
              heading: "Notable builds",
              body: "Jay's mountain fortress is the server's largest build — a multi-level base carved into a mountain, including a [[Hot Wheels Collection|Hot Wheels display room]] recreated in Minecraft with item frames and colored blocks. Sid's railway system connects every major build across 3,000 blocks. Meera built a pixel art of the [[Astral Projection (band)|Astral Projection]] logo at spawn, which nobody asked for but nobody wants to remove.",
              images: ["img_mc_mountain", "img_mc_nether"],
            },
          ],
        },
      },
    ],
  },
  {
    app: "numbers",
    title: "Lab Report — Jan 2026.pdf",
    top: "15%",
    left: "5%",
    width: "605px",
    height: "495px",
    zIndex: 1,
    items: [
      {
        hideAt: 0.32,
        page: {
          title: "March 2020 – June 2021",
          toc: [
            { label: "The startup folds" },
            { label: "Moving home" },
            {
              label: "The Pune months",
              children: [
                { label: "prakash-smp" },
                { label: "The guitar" },
                { label: "Hot Wheels revival" },
              ],
            },
            { label: "Moving to Bangalore with Sid" },
            { label: "What survived" },
          ],
          infoboxImage: "img_ib_lockdown",
          infobox: [
            { label: "Period", value: "Mar 2020 – Jun 2021" },
            { label: "Locations", value: "Pune → Bangalore" },
            { label: "Jobs", value: "1 lost, 1 gained" },
            { label: "Minecraft hours", value: "~400" },
          ],
          intro:
            "The lockdown period. Jay's startup folded two weeks in. He picked up the fintech job remotely. Moved back to Pune for four months, then to Bangalore with [[Sid]]. Started [[prakash-smp]]. Finally learned the \"Comfortably Numb\" solo on the Ibanez. [[Aai]]'s Sunday calls became daily for three months.",
          scrollTop: 60,
          sections: [
            {
              heading: "The startup folds",
              body: "Jay had been at Brevity, a SaaS startup building invoicing tools for freelancers, for eighteen months when COVID hit. They were six people in a WeWork in Koramangala. By April 10, 2020, the Series A fell through, the Slack went quiet, and Jay found out via a two-paragraph email from the founder. The fintech job at PayGrid came through a BITS alumni referral — a senior engineer named Tanvi who'd been two years above Jay — three weeks later. He started remotely from his childhood bedroom in Pune, debugging payment APIs while Kavya attended online lectures in the next room.",
              images: ["img_lockdown_desk"],
            },
            {
              heading: "Moving home",
              body: "Jay moved back to Pune in the first week of lockdown, before the trains stopped. Four months in his old room. [[Aai]]'s Sunday 11 AM calls became daily calls at all hours. Appa set up a desk in the spare room. Kavya was finishing her degree online from the next room. The location history shows a single dot for 127 consecutive days.",
              images: ["img_lockdown_pune"],
            },
            {
              heading: "The Pune months",
              body: 'Unexpectedly productive in some ways. Jay set up [[prakash-smp]] in week one. Found the [[Hot Wheels Collection|Hot Wheels shoeboxes]] at Appa\'s house and revived the collection. Spent evenings learning guitar from a YouTube channel called JustinGuitar — the Ibanez GRX20 from the [[Astral Projection (band)|Astral Projection]] era finally got serious use. By September 2020, he could play the "Comfortably Numb" solo cleanly. [[Aai]] tolerated the noise but drew the line at anything past 9:30 PM. He also stress-baked exactly twice — both times producing inedible banana bread that Appa politely ate.',
            },
            {
              heading: "Moving to Bangalore with Sid",
              body: "In June 2021, with offices partially reopening, Jay and [[Sid]] decided to move to Bangalore together. Sid was also working remotely from Pune. They found [[The Indiranagar Apartment]] after a three-week search. The move marked the end of the longest stretch Jay had lived at home since leaving for BITS in 2017.",
              images: ["img_lockdown_move"],
            },
            {
              heading: "What survived",
              body: "The lockdown period produced things that lasted: [[prakash-smp]] is still running. The [[Hot Wheels Collection]] spreadsheet is still maintained. The guitar skills stuck — Jay plays most evenings, working through a Radiohead phase that [[Sid]] tolerates with headphones. The fintech job became a career; he's now a senior engineer. And the daily calls with [[Aai]] eventually settled back to Sundays, but something about the rhythm had shifted — they talk more easily now.",
            },
          ],
        },
      },
      {
        hideAt: 0.52,
        page: {
          title: "Sid",
          toc: [
            {
              label: "BITS years",
              children: [{ label: "C-204" }, { label: "Dance and band" }],
            },
            { label: "The Pune years (before BITS)" },
            { label: "Moving to Bangalore together" },
            {
              label: "Daily life",
              children: [
                { label: "Coffee and groceries" },
                { label: "The couch debugging" },
              ],
            },
            { label: "The birthday Civic" },
          ],
          infoboxImage: "img_ib_sid",
          infobox: [
            { label: "Met", value: "2017 (BITS orientation)" },
            { label: "Hometown", value: "Pune" },
            { label: "Lives", value: "Bangalore (Indiranagar)" },
            { label: "Shared", value: "C-204, current flat" },
            {
              label: "Known for",
              value: '"the quiet one who\'s always there"',
            },
          ],
          intro:
            "Best friend since BITS orientation week (2017). Roommate in C-204, then [[The Indiranagar Apartment|Indiranagar]]. Co-conspirator in [[The Croma Heist]] (age 15), co-founder of [[Astral Projection (band)]], co-admin of [[prakash-smp]], and the person who once gave Jay a custom-painted Hot Wheels Civic for his birthday. Works in data science. Quiet in groups, relentless in DMs. The kind of friend where you can not talk for three days while living in the same apartment and it's fine.",
          scrollTop: 300,
          sections: [
            {
              heading: "BITS years",
              body: "Jay and Sid met during BITS orientation week in 2017 and discovered they were both from Pune. By second week they were sharing mess meals daily. By second month, Sid had moved into C-204. Sid choreographed the [[Mumbai Dance Competition]], played drums (practice pad) in [[Astral Projection (band)]], and was the person Jay called at 2 AM when the first-semester physics exam went badly.",
              images: ["img_sid_bits"],
            },
            {
              heading: "The Pune years (before BITS)",
              body: "Jay and Sid actually attended different schools in Pune — Jay at St. Vincent's, Sid at Loyola — but ran in overlapping circles through a shared tuition class for JEE prep at Mahesh Tutorials. They first met properly at age 14 through a mutual friend named Devesh (one of the [[The Croma Heist|Croma Heist]] accomplices). They weren't close in school, just friendly. BITS is where the friendship actually formed.",
            },
            {
              heading: "Moving to Bangalore together",
              body: 'After [[March 2020 – June 2021|lockdown]], moving to Bangalore together was obvious — both had jobs there, neither wanted to apartment-hunt alone. Sid found [[The Indiranagar Apartment]] listing. Jay built the comparison spreadsheet. Sid added the "natural light" column that settled the debate. They\'ve been roommates since August 2021.',
              images: ["img_sid_flat"],
            },
            {
              heading: "Daily life",
              body: "They have the easy rhythm of people who've lived together a long time. Sid makes coffee first (he's up earlier — his standup is at 9 AM, Jay's isn't until 10:30). Jay handles groceries from the BigBasket app because Sid once bought three kilos of onions by accident. They can go three days without a real conversation and neither finds it weird. Saturday mornings are for the Indiranagar farmers' market — Sid for herbs, Jay for the egg vendor's kheema pav. Sid's plants have taken over the balcony. Jay's [[Hot Wheels Collection]] has taken over his room. The [[prakash-smp]] server occasionally needs attention at odd hours and they debug it together from opposite ends of the couch.",
            },
            {
              heading: "The birthday Civic",
              body: "For Jay's 25th birthday in 2024, Sid hand-painted a Hot Wheels Honda Civic in Jay's favorite color scheme — dark green with gold accents. He'd watched YouTube tutorials for two weeks. The paint job is slightly uneven but it's Jay's favorite car in the [[Hot Wheels Collection|collection]]. It sits front-center in the main display case. The spreadsheet entry notes: \"Custom. Sid. Best one.\"",
              images: ["img_sid_civic"],
              quote: "Custom. Sid. Best one.",
              quoteAttrib: "— Hot Wheels spreadsheet, entry #247",
            },
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
    width: "504px",
    height: "315px",
    zIndex: 4,
    items: [
      {
        hideAt: 0.56,
        page: {
          title: "Nandi Hills",
          toc: [
            { label: "The first ride" },
            {
              label: "The route",
              children: [{ label: "The climb" }, { label: "Summit dosa" }],
            },
            { label: "The ritual" },
            { label: "Stats (Strava)" },
            { label: "The group chat negotiations" },
            {
              label: "Gear",
              children: [{ label: "Jay's Btwin" }, { label: "Priya's Triban" }],
            },
          ],
          infoboxImage: "img_ib_nandi",
          infobox: [
            { label: "Route", value: "Indiranagar → Nandi Hills" },
            { label: "Distance", value: "62 km" },
            { label: "Rides", value: "34" },
            { label: "Best time", value: "2h 04m" },
            { label: "Partner", value: "Priya" },
          ],
          intro:
            'A cycling tradition that started in October 2022 when Priya texted "want to ride to Nandi Hills Friday?" 34 rides and counting. 62 km from [[The Indiranagar Apartment|Indiranagar]] to the summit, 4:30 AM departure, sunrise dosa at the top.',
          scrollTop: 160,
          sections: [
            {
              heading: "The first ride",
              body: "October 2022. Priya had been cycling for months and needed a partner for the Nandi Hills route. She texted Jay on a Wednesday. Jay owned a bicycle he'd ridden exactly twice. He said yes anyway. The first ride took 3 hours 20 minutes and Jay couldn't walk properly for two days. He was hooked.",
              images: ["img_nh_sunrise", "img_nh_roads"],
            },
            {
              heading: "The route",
              body: "62 km from the Indiranagar apartment to the summit. Leave at 4:30 AM, hit the base by 6:00, summit by 6:45 if the legs cooperate. The climb is the hard part — 600m elevation gain in 8 km. The reward is sunrise over the Bangalore plateau and the dosa stall at the top that opens at 6 AM.",
              images: ["img_nh_route"],
            },
            {
              heading: "The ritual",
              body: 'Every Wednesday, the same exchange in the College Gang group: Priya types "hills friday?" Jay responds "4:30?" Priya: "4:45." Jay: "4:30." Priya: "fine." Rohit once calculated this exact exchange has happened 30+ times verbatim. Sid occasionally joins but prefers sleep. The dosa at the summit is non-negotiable — always masala, always with extra chutney.',
              images: ["img_nh_dosa"],
            },
            {
              heading: "Stats (Strava)",
              body: "34 rides logged on Strava since October 2022. Best time: 2h 04m (Priya's record is 1h 52m — she doesn't let Jay forget this). Average: 2h 28m. Total elevation gained: 20,400m. Jay's Strava bio says \"chasing Priya's PR.\" He has never beaten it.",
            },
            {
              heading: "The group chat negotiations",
              body: 'The Wednesday negotiation has become a running joke. Vik once set a reminder in the College Gang group that auto-posted "hills friday?" at 8 PM every Wednesday. It ran for three weeks before Priya asked him to stop. Meera, who has never joined a ride, comments "you\'re both insane" every time.',
              quote: "You're both insane.",
              quoteAttrib: "— Meera, who has never joined a ride",
            },
            {
              heading: "Gear",
              body: "Jay rides a Btwin Riverside 500, bought secondhand for ₹8,000 from a guy in Koramangala who'd used it twice. Priya rides a Triban RC520 that she maintains with the discipline of a pro mechanic — she can change a tube in under four minutes and judges Jay for not knowing how. Jay's gear knowledge is limited — he knows his tire pressure and that's about it. On ride 14, Jay got a flat near Devanahalli and Priya fixed it while he held the flashlight and apologized. One voice memo is titled \"Nandi Hills gear idea\" and is 47 seconds of Jay talking himself into buying clipless pedals. He hasn't bought them yet. [[Sid]] joined exactly once, in January 2023, and declared \"never again\" at the base of the climb.",
            },
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
    width: "547px",
    height: "342px",
    zIndex: 0,
    items: [
      {
        hideAt: 0.6,
        page: {
          title: "Aai",
          toc: [
            { label: "Early life" },
            { label: "Education and teaching" },
            {
              label: "The Sunday call",
              children: [
                { label: '"khana khaya?"' },
                { label: "The Kavya relay" },
              ],
            },
            { label: "Lockdown calls" },
            {
              label: "Pune visits",
              children: [{ label: "Diwali" }, { label: "The 3 AM flight" }],
            },
          ],
          infoboxImage: "img_ib_aai",
          infobox: [
            { label: "Relation", value: "Mother" },
            { label: "Location", value: "Pune" },
            { label: "Occupation", value: "School teacher" },
            { label: "Call schedule", value: "Sundays, 11 AM" },
            { label: "Signature phrase", value: '"khana khaya?"' },
          ],
          intro:
            'Jay\'s mother. School teacher in Pune. The Sunday 11 AM call is a fixture — always opens with "khana khaya?" (have you eaten?). Found out about [[The Croma Heist]] in 2022 and was more puzzled than upset. Sends festival forwards in the family WhatsApp group. During [[March 2020 – June 2021|lockdown]], calls went daily for three months. Gave Jay the [[Canon PowerShot A2300]] to take to Goa.',
          scrollTop: 150,
          sections: [
            {
              heading: "Early life",
              body: "Born Sunita Joshi in Kolhapur, Maharashtra. The youngest of three sisters — her older sisters, Mala-mavshi and Sujata-mavshi, still live in Kolhapur and visit Pune twice a year. Grew up in a joint family near Rankala Lake. Her father was a post office clerk; her mother ran the household and was, by all accounts, an extraordinary cook — the thepla recipe Aai packs for Jay is her mother's. Moved to Pune after marriage in 1996.",
            },
            {
              heading: "Education and teaching",
              body: "B.Ed from Shivaji University, Kolhapur. Started teaching Marathi and Hindi at Jnana Prabodhini school in Kothrud in 1998 — the same year Jay was born. She's been there 28 years now, teaching classes 5 through 8. Her students call her Sunita-bai. She's the teacher who stays late for the slow readers, who organizes the annual Marathi Day recitation competition, and who keeps a jar of Parle-G biscuits in her desk drawer for kids who forget their lunch. Jay once visited the school and was startled by how many students knew his name — she talks about her children more than she realizes.",
              images: ["img_aai_school"],
            },
            {
              heading: "The Sunday call",
              body: 'Every Sunday at 11 AM, without exception since Jay moved to Bangalore. The call always opens with "khana khaya?" regardless of the time. If Jay doesn\'t pick up by 11:05, a WhatsApp message arrives: "busy?" If he doesn\'t respond to that, Kavya texts: "call Aai." The calls run 15–40 minutes. Topics cycle through: work ("how\'s office?" — she doesn\'t fully understand what backend engineering is but asks anyway), food (always, with comparisons to Pune food that Bangalore can never win), weather (comparative Pune vs Bangalore), and whether Jay has "met anyone" (tactfully asked roughly every third call, less tactfully relayed to Kavya afterward).',
            },
            {
              heading: "Lockdown calls",
              body: "During [[March 2020 – June 2021|lockdown]], the Sunday call became a daily call. Jay was living at home in Pune, so the calls were sometimes just Aai knocking on his door. When he moved to Bangalore, the calls stayed daily for three months before settling back to Sundays. The transition wasn't negotiated — it just happened naturally as both adjusted to the distance again.",
              images: ["img_aai_diwali"],
            },
            {
              heading: "Pune visits",
              body: "The location history shows Pune trips clustering around three events: Diwali (always), Aai's birthday in September (usually), and emergencies (once — a 3 AM airport run when Appa was hospitalized in 2023, which Jay doesn't talk about much). Each visit follows a pattern: arrival at Pune station, auto-rickshaw to the flat in Kothrud, Aai's cooking for two straight days — poha in the morning, misal pav for lunch, and whatever Jay requests for dinner. He always requests chicken biryani. She always says \"I already started making it.\" The departure involves Aai packing enough theplas and laddoos for the entire week in Bangalore, plus a separate bag for [[Sid]].",
              quote: "I already started making it.",
              quoteAttrib: "— Aai, every time Jay requests chicken biryani",
            },
          ],
        },
      },
    ],
  },
];

const desktopFiles: {
  name: string;
  type: FileType;
  top: string;
  left: string;
  hideAt: number;
}[] = [
  {
    name: "Untitled folder",
    type: "folder",
    top: "3%",
    left: "46%",
    hideAt: 0.16,
  },
  {
    name: "backup_final_FINAL.zip",
    type: "zip",
    top: "68%",
    left: "4%",
    hideAt: 0.28,
  },
  {
    name: "transactions.csv",
    type: "csv",
    top: "25%",
    left: "92%",
    hideAt: 0.34,
  },
  { name: "notes.txt", type: "txt", top: "82%", left: "70%", hideAt: 0.44 },
  {
    name: "old_resume_v2.pdf",
    type: "pdf",
    top: "75%",
    left: "90%",
    hideAt: 0.5,
  },
  { name: "misc", type: "folder", top: "90%", left: "18%", hideAt: 0.54 },
  { name: "expenses.csv", type: "csv", top: "88%", left: "52%", hideAt: 0.58 },
];

// Pages that appear after all windows and files have closed
const standalonePages: WindowItem[] = [
  {
    hideAt: 0.68,
    page: {
      title: "Priya",
      toc: [
        { label: "How they met" },
        { label: "The designated driver" },
        {
          label: "Cycling partner",
          children: [
            { label: "The Triban RC520" },
            { label: "Strava rivalry" },
          ],
        },
        { label: "The reliable one" },
      ],
      infoboxImage: "img_ib_priya",
      infobox: [
        { label: "Met", value: "2017 (BITS)" },
        { label: "Lives", value: "Bangalore (HSR Layout)" },
        { label: "Job", value: "UX designer" },
        {
          label: "Known for",
          value: '"the one who actually has her life together"',
        },
      ],
      intro:
        'UX designer, cycling partner, the reliable one. Priya is the person who drove the entire [[The Goa Trip|Goa trip]], who texts "hills friday?" every Wednesday (see [[Nandi Hills]]), and who once described Jay\'s [[Hot Wheels Collection]] spreadsheet as "actually kind of sweet, in a concerning way."',
      scrollTop: 0,
      sections: [
        {
          heading: "How they met",
          body: "BITS orientation week, 2017 — the same week Jay met [[Sid]]. Priya was in the CS section one row behind Jay and corrected a professor's typo on day one, which Jay found simultaneously impressive and terrifying. They didn't become close until second year, when Priya mixed the music for the [[Mumbai Dance Competition]] using Audacity on her ThinkPad at 2 AM. She was the only one who treated the rehearsals seriously, which made her essential and slightly intimidating.",
        },
        {
          heading: "The designated driver",
          body: "Priya is the permanent designated driver. She drove the rental car for the entire [[The Goa Trip|Goa trip]] — seven days, every restaurant run, every beach trip. She drove Jay and [[Sid]] to the airport at 4 AM when they moved to Bangalore. She drove Rohit to the hospital when he had food poisoning in Panjim. Nobody else in the group is insured on rental cars because nobody else has ever needed to be.",
        },
        {
          heading: "Cycling partner",
          body: "The [[Nandi Hills]] tradition is Priya's creation. She'd been cycling seriously for a year before texting Jay. Her Triban RC520 is better-maintained than Jay's entire apartment. She holds the Nandi Hills PR at 1h 52m and brings it up at least once per ride. She tracks everything on Strava with the precision of a professional athlete, which she is not — she designs onboarding flows for a fintech app.",
          images: ["img_nh_bikes"],
        },
        {
          heading: "The reliable one",
          body: "Priya is the person who remembers birthdays without Facebook, who shows up 10 minutes early, and who once drove across Bangalore at midnight because Meera's flight from Chennai was cancelled. She organized Jay's surprise 25th birthday, kept [[Sid]]'s gift a secret for two weeks, and coordinated Vik flying in from Mumbai without a single leak. The [[College Gang]] group's running joke is that Priya is the only functional adult among them. She disagrees. Her counter-evidence is that she has watched every season of Temptation Island and gets genuinely invested in the outcomes.",
        },
      ],
    },
  },
  {
    hideAt: 0.76,
    page: {
      title: "College Gang",
      toc: [
        { label: "Members" },
        {
          label: "The group chat",
          children: [
            { label: "Message stats" },
            { label: "The name change prank" },
          ],
        },
        {
          label: "Recurring bits",
          children: [
            { label: '"server\'s down again"' },
            { label: '"hills friday?"' },
          ],
        },
        { label: "The annual trip debate" },
      ],
      infoboxImage: "img_ib_gang",
      infobox: [
        { label: "Formed", value: "2017 (BITS)" },
        { label: "Members", value: "6" },
        { label: "Messages", value: "94,000+" },
        { label: "Trips completed", value: "1" },
        { label: "Trips planned", value: "7" },
      ],
      intro:
        'The WhatsApp group that holds everything together. Six people: Jay, [[Sid]], Priya, Rohit, Vik, and Meera. Active since 2017, 94,000 messages, one completed trip ([[The Goa Trip]]), and six more that never made it past the planning stage. The group where "server\'s down again" means anything from [[prakash-smp]] being offline to someone having a bad day.',
      scrollTop: 200,
      sections: [
        {
          heading: "Members",
          body: 'Jay (backend engineer at PayGrid, Bangalore). [[Sid]] (data science at an ML startup near MG Road, Bangalore — the quiet one). Priya (UX designer at a fintech, HSR Layout, Bangalore — the reliable one). Rohit (product manager at a SaaS company, Hyderabad — the planner who nobody listens to). Vik (sales at a pharma company, Mumbai — chaotic, voice-notes-only, once sent a 7-minute voice note about a parking ticket). Meera (PhD in computational linguistics, IIT Madras, Chennai — quiet but funniest one-liners, once silenced a 40-message argument with "lol"). They met at BITS between 2017–2018 and have been inseparable since, despite living in four different cities.',
        },
        {
          heading: "The group chat",
          body: '94,000 messages since 2017. Peak activity: December 2019 ([[The Goa Trip]]). Quietest month: July 2020. The chat has survived two accidental exits (Vik, both times), one name change prank (Vik renamed it to "Vik\'s Fan Club" at 3 AM), and one sincere conversation about mental health that nobody has ever referenced again but everyone remembers.',
        },
        {
          heading: "Recurring bits",
          body: '"server\'s down again" — universal response to anything going wrong, from [[prakash-smp]] outages to bad dates. "hills friday?" — Priya\'s weekly [[Nandi Hills]] recruitment. "the spreadsheet" — Rohit\'s answer to any planning question, always ignored. Vik sending voice notes that are always too long. Meera responding to any drama with a single "lol" that somehow captures the whole situation.',
        },
        {
          heading: "The annual trip debate",
          body: "Every December since [[The Goa Trip]], someone (usually Rohit) starts a thread about the next group trip. A spreadsheet is created. Dates are debated. Vik books something without asking. Meera says she can't take time off — her thesis advisor, Dr. Krishnan, apparently doesn't believe in vacations. The trip doesn't happen. Failed destinations include: Hampi (2020, COVID), Pondicherry (2021, Vik booked the wrong weekend), Coorg (2022, Meera's conference), Goa Again (2023, everyone blamed everyone else), and Manali (2024, Rohit's spreadsheet grew to 23 tabs and nobody wanted to look at it). The Goa trip remains the only completed College Gang trip. The group's collective delusion that \"this year we'll definitely go\" is one of its most enduring features.",
        },
      ],
    },
  },
  {
    hideAt: 0.84,
    page: {
      title: "Kavya",
      toc: [
        { label: "The younger sister" },
        {
          label: "BITS (following Jay)",
          children: [{ label: "C-204 pilgrimage" }],
        },
        { label: "The Hot Wheels birthday" },
        { label: "The family mediator" },
      ],
      infoboxImage: "img_ib_kavya",
      infobox: [
        { label: "Relation", value: "Younger sister" },
        { label: "Age", value: "22" },
        { label: "College", value: "BITS Pilani (final year)" },
        { label: "Known for", value: '"call Aai"' },
      ],
      intro:
        "Jay's younger sister, 22, final year at BITS. The person who texts \"call Aai\" when Jay doesn't pick up the Sunday call. Knew about [[The Croma Heist]] for years before [[Aai]] found out. Bought Jay a [[Hot Wheels Collection|Hot Wheels car]] for his birthday without knowing what a Treasure Hunt was, but she tried.",
      scrollTop: 0,
      sections: [
        {
          heading: "The younger sister",
          body: "Four years younger than Jay. Grew up watching him collect [[Hot Wheels Collection|Hot Wheels]], fail to learn guitar, leave for BITS, and somehow turn into an adult with an apartment and a job. By the time she was in high school, Jay was already a voice on the phone who sent money on Paytm for her birthday. The sibling relationship is conducted almost entirely through Instagram reels, the Prakash Family WhatsApp group (four members, 80% [[Aai]]'s forwards), and Kavya's role as unofficial relay between Jay and their parents.",
        },
        {
          heading: "BITS (following Jay)",
          body: "Kavya got into BITS Pilani in 2022 — the same campus Jay attended. She refuses to acknowledge this is related to Jay's influence. She's studying electrical engineering, not CS. She lives in a different hostel. She has, however, found C-204 and sent Jay a photo of the room where [[Astral Projection (band)]] used to practice. He didn't ask her to.",
        },
        {
          heading: "The Hot Wheels birthday",
          body: "For Jay's 24th birthday, Kavya bought him a Hot Wheels car from a toy store in Pilani. She didn't know the model, the series, or what a Treasure Hunt was — she picked it because it was blue and Jay likes blue. The spreadsheet entry reads: \"birthday gift from Kavya, she doesn't know what a Treasure Hunt is but she tried.\" It's in the display case.",
          quote:
            "Birthday gift from Kavya. She doesn't know what a Treasure Hunt is but she tried.",
          quoteAttrib: "— Hot Wheels spreadsheet",
        },
        {
          heading: "The family mediator",
          body: "Kavya is the unofficial communication bridge in the Prakash family. When [[Aai]]'s Sunday call goes unanswered, Kavya texts Jay. When Appa wants to ask Jay something but won't call, he tells Kavya. When Jay wants to know how Appa is actually doing (not the \"I'm fine\" version), he asks Kavya. She manages this without complaint, mostly because she finds her family entertaining.",
        },
      ],
    },
  },
  {
    hideAt: 0.92,
    page: {
      title: "Appa",
      toc: [
        { label: "Early life" },
        { label: "Education" },
        {
          label: "The bank officer",
          children: [{ label: "The ledger books" }],
        },
        { label: "Retirement" },
        { label: "The hospital, 2023" },
      ],
      infoboxImage: "img_ib_appa",
      infobox: [
        { label: "Relation", value: "Father" },
        { label: "Location", value: "Pune" },
        { label: "Born", value: "Satara" },
        { label: "Education", value: "B.Com, Garware College" },
        { label: "Occupation", value: "Retired bank officer" },
        { label: "Gave Jay", value: "The Canon PowerShot" },
      ],
      intro:
        "Jay's father. Retired bank officer. The man who bought the [[Canon PowerShot A2300]] in 2008, set up a desk in the spare room during [[March 2020 – June 2021|lockdown]], and laughed for five minutes when [[Aai]] told him about [[The Croma Heist]]. Quieter than Aai in calls, louder in cricket opinions.",
      scrollTop: 100,
      sections: [
        {
          heading: "Early life",
          body: "Born Ramesh Prakash in Satara, the middle of three brothers. His father ran a small provisions shop near the old bus stand — the kind with glass jars of biscuits and a wooden counter worn smooth. Appa grew up helping with the shop ledger before he could ride a bicycle, which [[Aai]] says explains everything about him. The family moved to Pune when he was fourteen, after his older brother got a government job at the Collector's office. They settled in Sahakar Nagar — the same neighbourhood where Jay would grow up — in a one-bedroom flat that Appa still talks about with more nostalgia than the current three-bedroom.",
        },
        {
          heading: "Education",
          body: 'B.Com from Garware College, Pune (class of 1988). Appa was not a remarkable student by his own admission — "I passed, that was enough" — but he cleared the Bank of Maharashtra entrance exam on his first attempt, which in the late \'80s was considered a lifetime achievement in middle-class Pune. He joined as a probationary officer in 1989 and never looked anywhere else. The decision to stay at one bank for 34 years was not loyalty so much as contentment: the work made sense to him, the numbers balanced, and he could walk to the Kothrud branch in twelve minutes.',
          quote: "I passed. That was enough.",
          quoteAttrib: "— Appa, on his Garware College years",
        },
        {
          heading: "The bank officer",
          body: "Appa worked at Bank of Maharashtra for 34 years — the Kothrud branch, then the Deccan Gymkhana branch, then back to Kothrud — retiring in 2022. Jay inherited the spreadsheet habit from him: Appa tracked household expenses in ruled ledger books with the precision of a man who spent his career reconciling accounts. He commuted by the same PMPML bus route for three decades. The location history for Pune, if it existed, would be a single line.",
        },
        {
          heading: "Retirement",
          body: "Appa retired in March 2022 and immediately needed a project. He reorganized the entire house, including Jay's old room (the [[Hot Wheels Collection|Hot Wheels shoeboxes]] were relocated twice). He digitized the ledger books into an Excel file — 34 years of household expenses, formatted immaculately. He started a walk every morning at 6 AM to Sahakar Nagar park, where he's joined a group of retired men who discuss cricket and municipal politics. [[Aai]] says he's calmer now. Kavya says he's the same but with more free time to have opinions about things — he once called Jay to discuss the IPL retention rules for twenty minutes.",
        },
        {
          heading: "The hospital, 2023",
          body: "In August 2023, Appa was hospitalized for a cardiac event. Jay took the 3 AM flight from Bangalore — the one that shows up as a single outlier point in his location history. Appa recovered fully. The event is referenced obliquely in the [[Aai]] page and not at all in the College Gang group chat. Some things stay in the family.",
        },
      ],
    },
  },
];

// Flatten all items across windows + standalone, sorted by hideAt
const allItemsByHideAt = [
  ...windows.flatMap((w) => w.items),
  ...standalonePages,
].sort((a, b) => a.hideAt - b.hideAt);

export function DesktopScene() {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(ref);
  const [topZ, setTopZ] = useState(windows.length);
  const [zOverrides, setZOverrides] = useState<Record<string, number>>({});
  const [offsets, setOffsets] = useState<
    Record<string, { x: number; y: number }>
  >({
    Photos: { x: 35, y: 39 },
    Messages: { x: 150, y: 75 },
    Downloads: { x: 67, y: 75 },
    "Lab Report — Jan 2026.pdf": { x: 65, y: 275 },
    "Voice Memos": { x: 92, y: 152 },
    "Location History": { x: 87, y: 22 },
  });

  const bringToFront = useCallback((key: string) => {
    setTopZ((z) => {
      const next = z + 1;
      setZOverrides((prev) => ({ ...prev, [key]: next }));
      return next;
    });
  }, []);

  const handleDrag = useCallback((key: string, x: number, y: number) => {
    setOffsets((prev) => ({ ...prev, [key]: { x, y } }));
  }, []);

  // Debug: press Shift+P to log window positions with drag offsets applied
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === "P") {
        const config = windows.map((w) => {
          const off = offsets[w.title];
          return {
            title: w.title,
            top: w.top,
            left: w.left,
            width: w.width,
            height: w.height,
            offsetX: off?.x ?? 0,
            offsetY: off?.y ?? 0,
          };
        });
        console.log(JSON.stringify(config, null, 2));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [offsets]);

  // Active page = last consumed item across all windows + standalone
  let activePage: WikiPage | null = null;
  for (const item of allItemsByHideAt) {
    if (progress >= item.hideAt) {
      activePage = item.page;
    }
  }

  return (
    <div ref={ref} className="h-[500vh] relative">
      <div className="sticky top-0 h-dvh w-dvw bg-blue-200 dark:bg-neutral-900 flex items-center justify-center">
        {/* Centered container for app windows — positions resolve against 1440px */}
        <div className="relative w-full max-w-[1440px] h-full overflow-hidden">
          {desktopFiles.map((f) =>
            progress < f.hideAt ? (
              <File
                key={f.name}
                name={f.name}
                type={f.type}
                top={f.top}
                left={f.left}
              />
            ) : null,
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
        </div>

        <WikiWindow activePage={activePage} zIndex={topZ + 1} />
      </div>
    </div>
  );
}
