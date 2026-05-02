import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gradeCompleteness } from '../src/graders/completeness.js';

// Total weight for person checks: structural (5.5) + depth (10) + richness (3) + link (0.5) = 19
const TOTAL_PERSON_WEIGHT = 19;

const FULL_PAGE = `:::infobox-person
name: Test Person
birth: 1995-06-22
birthPlace: Denver
occupation: Graphic designer
knownFor: Longest DM thread
:::

**Test Person** (born 22 June 1995 in Denver) is a graphic designer and photography enthusiast documented in the personal archive. She grew up in the Highlands neighbourhood, attended Westlake Academy, and completed a BFA in Graphic Design at Metro College before spending a year travelling through Southeast Asia.

![Test Person in September 2025.](/assets/test-person-photo.jpg)

## Background

Test Person was born in Denver and raised in the Highlands neighbourhood. Her family has a strong academic background with several relatives in education. Her father teaches at a local community college and her mother runs a small ceramics studio from their garage. The family is close-knit and creative. She tells her parents about her projects and discusses her friends' work with them. Growing up she was passionate about drawing and began formal art classes at age nine, continuing for six years before shifting focus to digital design. Her early sketchbooks showed an unusual combination of precise architectural detail and loose expressive figure work. Teachers encouraged her to pursue art seriously throughout middle school and high school.

### Education

She attended Westlake Academy in the Highlands for schooling. She initially intended to study architecture but changed direction after a summer workshop in typography convinced her that graphic design was a better fit. She subsequently enrolled at Metro College completing a BFA in Graphic Design. During her time at Metro she took electives in printmaking and photography that broadened her practice considerably.

:::blockquote{by="Test Person, 14 March 2022"}
I was sitting in this architecture lecture about load-bearing walls and I just knew this wasn't for me. I walked out and signed up for the typography elective the same afternoon.
:::

### Career

After completing a photography workshop in Portland in August 2022 she began freelancing as a graphic designer while selling prints at local markets. She took on both branding projects and editorial illustration commissions. She also volunteered with a nonprofit teaching digital literacy workshops at a community centre in her neighbourhood. The volunteer programme paired her with adult learners returning to formal education and she developed teaching materials that the centre still uses today.

## Connection with wiki owner

The wiki owner befriended Test Person over Instagram DMs in late 2022. They connected over design, bonded over shared musical taste, and met in person before the friendship evolved through several distinct phases over three months of intensive messaging. The progression of the conversation followed a clear arc that the wiki owner has documented in considerable detail across the message archive.

### Phase 1: Design exchange

Contact was initiated on 1 March 2022 with a message complimenting a recent poster design.[^ig-2022-03-01] She responded with enthusiasm and a slow asynchronous exchange began. On 4 March several messages were sent about a local gallery show with zero response and the conversation could easily have died there.

### Phase 2: Personality explosion

The conversation transformed on 5 March with 185 messages in a single session.[^ig-2022-03-05] Strong opinions served as a personality litmus test including a heated debate about serif versus sans-serif fonts. By the end of the day they had established nicknames and a running joke about kerning.

### Phase 3: The hometown discovery

The conversation reached over 500 messages on 13 March when they discovered they had both grown up within a few miles of each other.[^ig-2022-03-13] References to shared childhood landmarks flooded into the conversation and never left. The rest of the day covered local nostalgia and mutual acquaintances.

### Phase 4: Deepening

They exchanged 2214 messages in five days averaging 443 per day.[^ig-2022-03-15] Key milestones included the creation of a shared Spotify playlist on 15 March and the discovery of overlapping music libraries.[^ig-2022-03-21] The first voice note arrived on 21 March when she described an upcoming art residency.

![Test Person, 21 March 2022 — first voice note in the thread.](/assets/test-person-voice-note.mp4)

### Phase 5: The emotional peak

Spring break freed the wiki owner from coursework and the conversation hit its volume peak.[^ig-2022-03-27] On 27 March she explicitly acknowledged the friendship's significance. On 29 March they exchanged stories about past creative failures.[^ig-2022-03-29]

### Phase 6: Decline and meetings

The conversation began to taper from its March heights. The first ten days of April averaged 216 messages per day down from the peak of 400 plus.[^ig-2022-04-19] Three in-person meetings occurred in April: a coffee on the 19th, a gallery visit on the 20th, and a concert on the 22nd.[^ig-2022-04-20][^ig-2022-04-22]

### Phase 7: Fading out

On 3 May a message about collaborating on a project went unanswered for several days.[^ig-2022-05-03] A reconnection burst on 22 May produced 126 messages before the thread faded to its final message on 7 June 2022.[^ig-2022-05-22]

:::blockquote{by="Test Person, 4 May 2022"}
Honestly it has been so much fun talking about design and music. I really value this friendship even if we are both terrible at replying on time.
:::

## Music

The conversation began with a design exchange on 1 March but musical taste quickly became a recurring topic. She professed fierce loyalty to Radiohead and Bjork and equally fierce contempt for generic pop playlists. She had a sophisticated taxonomy of genres and could argue for hours about the distinction between shoegaze and dream pop. Her other major recommendation was a small local band whose debut EP she described as essential listening. She was musically eclectic transitioning from electronic to folk during the conversation period admitting she used to dismiss acoustic music but now finds it grounding. A collaborative Spotify playlist was created on 15 March and became a medium for mutual influence with both parties adding songs from their respective genres. When she played the playlist at a dinner party her friends were surprised by the range.

## Inside jokes

A running debate about the best local coffee shop became their signature disagreement born from a throwaway comment on 13 March and amplified into a recurring motif used whenever either needed to provoke the other. A score tally tracked who had made the better music recommendation each week with progression from an even score through to a consistent lead that was maintained throughout and used as leverage. The comic sans tease was consistently and dramatically rejected with mock outrage. References to a shared dislike of brutalist architecture became shorthand for aesthetic disagreement. Key recurring phrases included absolutely not and objectively wrong and I will die on this hill. A boundary signal was established on 20 March to pause uncomfortable lines of conversation though it was immediately repurposed as a joke. A persistent bit developed where the wiki owner pretended to be a demanding art director issuing absurd revision requests.

## Conversation statistics

| Metric | Value |
| --- | --- |
| Total messages | 10434 |
| Date range | Mar 2022 - Jun 2022 |

## Bibliography

::cite-vault{type="messages" snapshot="a1b2c3d4" timestamp="2022-03-01/2022-06-07" note="Instagram DM thread."}

::cite-vault{type="messages" snapshot="e5f6a7b8" timestamp="2022-04-18/2022-04-22" note="WhatsApp DMs."}

::category{name="People"}

[^ig-2022-03-01]: Cite message snapshot=a1b2c3d4 date=2022-03-01 thread=test_thread Opening message.
[^ig-2022-03-05]: Cite message snapshot=a1b2c3d4 date=2022-03-05 thread=test_thread First real-time conversation.
[^ig-2022-03-13]: Cite message snapshot=a1b2c3d4 date=2022-03-13 thread=test_thread Hometown discovery.
[^ig-2022-03-15]: Cite message snapshot=a1b2c3d4 date=2022-03-15 thread=test_thread Shared Spotify playlist.
[^ig-2022-03-21]: Cite message snapshot=a1b2c3d4 date=2022-03-21 thread=test_thread First voice note.
[^ig-2022-03-27]: Cite message snapshot=a1b2c3d4 date=2022-03-27 thread=test_thread First internet friend.
[^ig-2022-03-29]: Cite message snapshot=a1b2c3d4 date=2022-03-29 thread=test_thread Failure stories exchange.
[^ig-2022-04-19]: Cite message snapshot=a1b2c3d4 date=2022-04-19 thread=test_thread First meeting.
[^ig-2022-04-20]: Cite message snapshot=a1b2c3d4 date=2022-04-20 thread=test_thread Gallery visit.
[^ig-2022-04-22]: Cite message snapshot=a1b2c3d4 date=2022-04-22 thread=test_thread Concert.
[^ig-2022-05-03]: Cite message snapshot=a1b2c3d4 date=2022-05-03 thread=test_thread Unanswered message.
[^ig-2022-05-22]: Cite message snapshot=a1b2c3d4 date=2022-05-22 thread=test_thread Reconnection.
`;

describe('completeness grader', () => {
  it('scores 1.0 for a complete page', () => {
    const result = gradeCompleteness(FULL_PAGE);
    assert.equal(result.grader, 'completeness');
    assert.equal(
      result.score,
      1,
      `Failed checks: ${result.details.filter((d) => !d.passed).map((d) => d.check).join(', ')}`,
    );
    assert.ok(
      result.details.every((d) => d.passed),
      `Failed checks: ${result.details.filter((d) => !d.passed).map((d) => d.check).join(', ')}`,
    );
  });

  it('detects missing lead paragraph', () => {
    const page = `## Section\n\nSome content here that is longer than fifty characters to pass the check.`;
    const result = gradeCompleteness(page);
    const lead = result.details.find((d) => d.check.includes('Lead paragraph'));
    assert.ok(lead);
    assert.equal(lead.passed, false);
  });

  it('detects missing infobox', () => {
    const page = `Lead paragraph here.\n\n## Section\n\nContent.\n\n## Bibliography\n\n::cite-vault{snapshot="x"}\n\n::category{name="Test"}\n\n[^a]: source`;
    const result = gradeCompleteness(page);
    const infobox = result.details.find((d) => d.check.includes('Infobox'));
    assert.ok(infobox);
    assert.equal(infobox.passed, false);
  });

  it('detects missing body section with prose', () => {
    const page = `:::infobox-person\nname: X\n:::\n\nLead.\n\n## Bibliography\n\n::cite-vault{snapshot="x"}\n\n::category{name="Test"}\n\n[^a]: source`;
    const result = gradeCompleteness(page);
    const body = result.details.find((d) => d.check.includes('Body section'));
    assert.ok(body);
    assert.equal(body.passed, false);
  });

  it('detects missing references section', () => {
    const page = `:::infobox-person\nname: X\n:::\n\nLead.\n\n## Life\n\nThis is a body section with more than fifty characters of prose content here.\n\n## Bibliography\n\n::cite-vault{snapshot="x"}\n\n::category{name="Test"}`;
    const result = gradeCompleteness(page);
    const refs = result.details.find((d) =>
      d.check.includes('References / footnotes'),
    );
    assert.ok(refs);
    assert.equal(refs.passed, false);
  });

  it('detects missing bibliography section', () => {
    const page = `:::infobox-person\nname: X\n:::\n\nLead.\n\n## Life\n\nThis is a body section with more than fifty characters of prose content here.\n\n[^a]: source\n\n::category{name="Test"}`;
    const result = gradeCompleteness(page);
    const bib = result.details.find((d) => d.check.includes('Bibliography'));
    assert.ok(bib);
    assert.equal(bib.passed, false);
  });

  it('detects missing category tag', () => {
    const page = `:::infobox-person\nname: X\n:::\n\nLead.\n\n## Life\n\nThis is a body section with more than fifty characters of prose content here.\n\n## Bibliography\n\n::cite-vault{snapshot="x"}\n\n[^a]: source`;
    const result = gradeCompleteness(page);
    const cat = result.details.find((d) => d.check.includes('category'));
    assert.ok(cat);
    assert.equal(cat.passed, false);
  });

  it('scores very low for skeleton page with only boilerplate', () => {
    // Only passes: lead (1), refs (0.5), bib (0.5), category (0.5), episode links vacuous (0.5) = 3.0/19
    const page = `Lead paragraph.\n\n## Section\n\nShort content.\n\n## Bibliography\n\n::cite-vault{snapshot="x" type="y"}\n\n::category{name="Test"}\n\n[^a]: source`;
    const result = gradeCompleteness(page);
    assert.ok(
      result.score < 0.2,
      `Score ${result.score} should be < 0.2 for skeleton page`,
    );
  });

  it('scores near 0 for empty input', () => {
    // Only episode link check passes vacuously (0.5/19)
    const result = gradeCompleteness('');
    assert.ok(
      result.score < 0.05,
      `Score ${result.score} should be < 0.05 for empty input`,
    );
  });
});

describe('completeness grader — person role with episode links', () => {
  it('passes when expected episode link is present', () => {
    const page = FULL_PAGE + '\nSee also: [[Trip to Pondicherry]]\n';
    const result = gradeCompleteness(page, {
      role: 'person',
      expectedEpisodes: ['Trip to Pondicherry'],
    });
    const check = result.details.find((d) => d.check.includes('episode'));
    assert.ok(check);
    assert.equal(check.passed, true);
  });

  it('fails when expected episode link is missing', () => {
    const result = gradeCompleteness(FULL_PAGE, {
      role: 'person',
      expectedEpisodes: ['Trip to Pondicherry'],
    });
    const check = result.details.find((d) => d.check.includes('episode'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('passes when no expected episodes (vacuous truth)', () => {
    const result = gradeCompleteness(FULL_PAGE, { role: 'person' });
    const check = result.details.find((d) => d.check.includes('episode'));
    assert.ok(check);
    assert.equal(check.passed, true);
  });
});

describe('completeness grader — episode role', () => {
  const EPISODE_PAGE = `:::infobox-episode
name: Trip to Pondicherry
date: 2024-01-15
:::

This is the lead paragraph about the trip to Pondicherry, a memorable three-day journey undertaken by the wiki owner and a close friend in January 2024, covering multiple locations along the southeastern coast of India and producing lasting memories documented across photos, voice notes, and diary entries.

![Promenade Beach during sunset, 15 January 2024.](/assets/pondicherry-beach.jpg)

## The journey

The trip to Pondicherry began early in the morning. They drove along the coast for several hours taking in the beautiful scenery along the way. The route took them through several small towns and villages, each with its own character and charm. They stopped multiple times for photographs and to sample local street food from roadside vendors. The drive itself took about four hours with multiple stops along the East Coast Road.

### Day one

The first day was spent exploring the French Quarter, visiting the Promenade Beach, and sampling the unique Franco-Tamil cuisine that Pondicherry is famous for. They visited the Sri Aurobindo Ashram and spent time at the Auroville township learning about its experimental community structure. The ashram grounds were peaceful and meditative. They walked through the garden and sat in the main meditation hall. At Auroville they visited the Matrimandir from a distance and explored the various community-run shops and cafes.

:::blockquote{by="Wiki owner, 15 January 2024"}
The Matrimandir looked like something from another world, this massive golden sphere surrounded by gardens. Even from the viewing point you could feel the energy of the place.
:::

[^vn-01]: Cite message snapshot=trip456 date=2024-01-15 thread=pondicherry Matrimandir voice note.

### Day two

The second day focused on the beach and the old colonial architecture. They rented bicycles and rode along the promenade in the early morning before the heat became unbearable. The French colonial buildings were painted in yellows and whites giving the neighbourhood a distinctly European feel. They visited the Pondicherry Museum and the old lighthouse before lunch at a small family-run restaurant.[^vn-02]

### Day three

The final day was a quiet one. They visited the botanical garden in the morning, packed their bags, and made one last stop at the fish market before driving home. The return journey was reflective and quiet with both travelers lost in thought about the experiences of the past three days.[^vn-03]

## The food

Pondicherry offered an incredible variety of food experiences. From traditional Tamil thalis to French-inspired bakeries, the culinary diversity was remarkable. They tried fresh seafood at a beachside restaurant and visited a local market where they purchased spices and handmade chocolates. The crepes at Cafe des Arts were particularly memorable. They also discovered a small Tamil restaurant near the bus stand that served the best fish curry either of them had ever tasted. Each meal became its own small adventure in the trip's narrative.[^food-01]

## The people

Along the way they met several interesting characters: a French expat who had lived in Pondicherry for thirty years and ran a small bookshop specialising in Tamil literature translated into French, a fisherman who told them stories about cyclone Thane and how the community rebuilt afterward, and the owner of their guesthouse who shared recipes for authentic Pondicherry rasam and taught them the difference between Pondicherry and Chennai cooking styles. These encounters enriched the trip beyond the standard tourist experience and gave them insights into the daily life of the town. The bookshop owner in particular made an impression, sharing stories about the early days of the Pondicherry literary scene and recommending several authors they had never heard of. The fisherman invited them to his home where his wife served fresh karimeen fry and they sat on the beach watching the sunset while he described how the fishing industry had changed over his lifetime. These personal connections transformed what could have been a routine tourist trip into something genuinely meaningful.[^people-01]

## Reflections

The trip left a lasting impression on both travelers. They discussed how the blend of French and Tamil cultures created something entirely unique, and how the peaceful atmosphere of the town provided a welcome contrast to their busy city lives. The quiet mornings on the beach and the long conversations over coffee became defining memories of the friendship. In retrospect this trip marked a turning point in their relationship as they moved from casual acquaintances to genuine close friends. They spent the drive home discussing what made the trip special: the absence of any fixed agenda, the willingness to change plans on a whim, and the discovery that they could spend three days together without running out of conversation. The experience reinforced their shared preference for spontaneous travel over meticulously planned itineraries. They agreed that the best moments were unplanned: stumbling upon the tiny Tamil restaurant near the bus stand, deciding to rent bicycles at six in the morning, and the impromptu conversation with the French bookshop owner that lasted two hours.[^reflect-01]

## Impact

This trip became a reference point in subsequent conversations. They would regularly say things like "remember that fish curry in Pondicherry" or "the Matrimandir energy" as shorthand for shared experiences. The photos from the trip were among the most frequently shared in their message thread in the months that followed. The bicycle ride along the promenade became a recurring suggestion whenever either of them needed to clear their head. The trip also introduced them to several new restaurants and food traditions that they continued to seek out in their home city. In many ways the Pondicherry trip marked the transition from acquaintances who happened to share mutual friends to genuine close friends who actively sought out each other's company. The shared vocabulary of inside jokes and references that emerged from those three days persisted for months and coloured nearly every subsequent interaction between them.[^impact-01][^impact-02][^impact-03][^impact-04]

See also: [[Jane Doe]]

## Bibliography

::cite-vault{snapshot="trip456" type="photos" description="Trip photos"}

::category{name="Episodes"}

[^vn-02]: Cite message snapshot=trip456 date=2024-01-16 thread=pondicherry Day two cycling.
[^vn-03]: Cite message snapshot=trip456 date=2024-01-17 thread=pondicherry Day three departure.
[^food-01]: Cite message snapshot=trip456 date=2024-01-15 thread=pondicherry Food experiences.
[^people-01]: Cite message snapshot=trip456 date=2024-01-16 thread=pondicherry People met.
[^reflect-01]: Cite message snapshot=trip456 date=2024-01-17 thread=pondicherry Reflections.
[^impact-01]: Cite message snapshot=trip456 date=2024-02-15 thread=pondicherry Impact.
[^impact-02]: Cite message snapshot=trip456 date=2024-03-01 thread=pondicherry Later references.
[^impact-03]: Cite message snapshot=trip456 date=2024-04-10 thread=pondicherry Photo sharing.
[^impact-04]: Cite message snapshot=trip456 date=2024-05-20 thread=pondicherry One of many callbacks.
`;

  it('scores 1.0 for a complete episode with person link', () => {
    const result = gradeCompleteness(EPISODE_PAGE, {
      role: 'episode',
      subject: 'Jane Doe',
    });
    assert.equal(
      result.score,
      1,
      `Failed checks: ${result.details.filter((d) => !d.passed).map((d) => d.check).join(', ')}`,
    );
    assert.ok(result.details.every((d) => d.passed));
  });

  it('fails when person link is missing', () => {
    const pageWithoutLink = EPISODE_PAGE.replace('See also: [[Jane Doe]]', '');
    const result = gradeCompleteness(pageWithoutLink, {
      role: 'episode',
      subject: 'Jane Doe',
    });
    const check = result.details.find((d) => d.check.includes('person page'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('passes when no subject provided (vacuous truth)', () => {
    const result = gradeCompleteness(EPISODE_PAGE, { role: 'episode' });
    const check = result.details.find((d) => d.check.includes('person page'));
    assert.ok(check);
    assert.equal(check.passed, true);
  });
});

describe('completeness grader — talk role', () => {
  const TALK_PAGE = `## Editorial decisions

::closed{note="Decided to focus on the Bangalore period."}

## Active gaps

::open{note="Missing birth date."}

## Research notes

Key findings from source review.
`;

  it('scores 1.0 for a complete talk page', () => {
    const result = gradeCompleteness(TALK_PAGE, { role: 'talk' });
    assert.equal(
      result.score,
      1,
      `Failed checks: ${result.details.filter((d) => !d.passed).map((d) => d.check).join(', ')}`,
    );
    assert.equal(result.details.length, 5);
    assert.ok(result.details.every((d) => d.passed));
  });

  it('has 5 checks for talk role', () => {
    const result = gradeCompleteness('', { role: 'talk' });
    assert.equal(result.details.length, 5);
  });

  it('detects missing section heading', () => {
    const page = 'Just some text with no headings.';
    const result = gradeCompleteness(page, { role: 'talk' });
    const check = result.details.find((d) =>
      d.check.includes('section heading'),
    );
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects missing editorial decisions', () => {
    const page = `## Notes\n\nSome notes.\n\n## Active gaps\n\n::open{note="Missing info."}`;
    const result = gradeCompleteness(page, { role: 'talk' });
    const check = result.details.find((d) =>
      d.check.includes('editorial decisions'),
    );
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects lead prose before first heading', () => {
    const page = `This is lead prose.\n\n## Editorial decisions\n\n::closed{note="Done."}\n\n## Active gaps\n\n::open{note="Gap."}`;
    const result = gradeCompleteness(page, { role: 'talk' });
    const check = result.details.find((d) => d.check.includes('lead prose'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('passes editorial decisions check via closed directive', () => {
    const page = `## Work\n\n::closed{note="Resolved."}\n\n## Active gaps\n\n::open{note="Gap."}`;
    const result = gradeCompleteness(page, { role: 'talk' });
    const check = result.details.find((d) =>
      d.check.includes('editorial decisions'),
    );
    assert.ok(check);
    assert.equal(check.passed, true);
  });
});

describe('completeness grader — source role', () => {
  const SOURCE_PAGE = `::cite-vault{snapshot="facebook-export" type="facebook" description="Facebook archive export"}

## Contents

This source page documents the Facebook data archive. It contains posts, messages, photos, and profile metadata exported from the platform. The archive was created on 2024-01-15 and spans approximately six years of activity. The export includes structured JSON files for each data category, along with media attachments stored in their original format. The total size of the archive is approximately 2.3 GB.

### Posts

Timeline posts and status updates spanning from 2018 to 2024. Includes 1,247 text posts, 892 photo posts, and 156 video posts. Posts are organized chronologically in JSON format with associated metadata including timestamps, privacy settings, and engagement metrics.

### Messages

Direct message conversations with 42 contacts. The messages archive contains approximately 15,000 individual messages across all threads. Each conversation is stored as a separate JSON file containing sender information, timestamps, message content, and any attached media references.

## Querying

The archive can be queried using standard JSON parsing tools. Each data category is stored in a separate directory with consistent file naming conventions. The posts directory contains yearly JSON files, while the messages directory contains per-conversation JSON files.

::category{name="Sources"}
`;

  it('scores 1.0 for a complete source page', () => {
    const result = gradeCompleteness(SOURCE_PAGE, { role: 'source' });
    assert.equal(result.grader, 'completeness');
    assert.equal(
      result.score,
      1,
      `Failed checks: ${result.details.filter((d) => !d.passed).map((d) => d.check).join(', ')}`,
    );
    assert.equal(result.details.length, 6);
    assert.ok(result.details.every((d) => d.passed));
  });

  it('has 6 checks for source role', () => {
    const result = gradeCompleteness('', { role: 'source' });
    assert.equal(result.details.length, 6);
  });

  it('detects missing snapshot identifier', () => {
    const page = `## Contents\n\nSome content here that is longer than one hundred characters to pass the content summary check. It goes on for a while to make sure it is long enough.\n\n::category{name="Sources"}`;
    const result = gradeCompleteness(page, { role: 'source' });
    const check = result.details.find((d) => d.check.includes('snapshot'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects missing source type metadata', () => {
    const page = `::cite-vault{snapshot="abc123"}\n\n## Contents\n\nSome content here that is longer than one hundred characters to pass the content summary check. It goes on for a while to make sure it is long enough.\n\n::category{name="Sources"}`;
    const result = gradeCompleteness(page, { role: 'source' });
    const check = result.details.find((d) => d.check.includes('source type'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects missing content summary', () => {
    const page = `::cite-vault{snapshot="abc123" type="photos"}\n\nShort.\n\n::category{name="Sources"}`;
    const result = gradeCompleteness(page, { role: 'source' });
    const check = result.details.find((d) => d.check.includes('file listing'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects missing category tag', () => {
    const page = `::cite-vault{snapshot="abc123" type="photos"}\n\n## Contents\n\nThis source page documents the photo archive. It contains many photos spanning multiple years with detailed metadata and location information attached to each one.`;
    const result = gradeCompleteness(page, { role: 'source' });
    const check = result.details.find((d) => d.check.includes('category'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });
});
