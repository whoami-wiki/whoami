import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gradeCompleteness } from '../src/graders/completeness.js';

// ── Area page tests ──────────────────────────────────────────────────

const AREA_PAGE = `{{Infobox area
| name         = Primary Clarifiers
| area_number  = 03
| status       = Under Construction
| disciplines  = Civil, Structural, Mechanical, Electrical, I&C
| upstream     = [[Area 02 — Headworks]]
| downstream   = [[Area 04 — Aeration Basins]]
| key_drawings = [[Drawing:C-301]], [[Drawing:S-302]]
| key_specs    = [[Spec:03 30 00]], [[Spec:46 33 00]]
}}

Area 03 encompasses the primary clarifier complex at the Port Gardner Storage Facility, consisting of four 120-foot diameter circular clarifiers with associated sludge collection and scum removal systems. The clarifiers receive raw wastewater from the headworks via a 48-inch reinforced concrete influent pipe and provide primary settling before the aeration basins. The facility is designed to handle an average daily flow of 24 MGD with a peak wet-weather flow of 72 MGD.<ref name="dwg-c-301">{{Cite drawing|number=C-301|rev=3|date=2025-11-15|title=Primary Clarifier Site Plan}}</ref>

== Structural ==

The four primary clarifiers are cast-in-place reinforced concrete circular tanks. Each tank is 120 feet in diameter with a 12-foot side water depth and a floor slope of 1:12 toward the center sludge hopper. The tanks are arranged in a 2x2 grid with center-to-center spacing of 160 feet north-south and 165 feet east-west.<ref name="dwg-s-302">{{Cite drawing|number=S-302|rev=3|date=2025-11-15|title=Clarifier Foundation Plan}}</ref>

=== Walls ===

Wall thickness is 18 inches at the base tapering to 12 inches at the top of wall. Concrete is specified as 4,500 PSI at 28 days with a maximum water-cement ratio of 0.45. The approved concrete mix design uses Type I/II cement with 20 percent fly ash replacement. Reinforcement at wall penetrations greater than 6 inches diameter is number 5 bars at 8 inches on center each way per the RFI-042 response.<ref name="spec-concrete">{{Cite spec|section=03 30 00|paragraph=2.1.A|title=Cast-in-Place Concrete}}</ref>

=== Foundation ===

Clarifier foundations are 18-inch thick mat slabs on compacted structural fill. The geotechnical report recommends an allowable bearing pressure of 4,000 PSF for the primary clarifier area. Groundwater was encountered at elevation 38.5 during the subsurface investigation, approximately 4 feet below the proposed bottom of excavation.<ref name="geotech">{{Cite document|title=Geotechnical Report|author=GeoEngineers|date=2025-03-15|page=23}}</ref>

== Mechanical ==

Each clarifier is equipped with a center-driven sludge collector mechanism rated for 350 ft-lb steady-state torque at 120 feet diameter. The mechanism drives two diametrically opposed scraper arms along the tank floor, conveying settled sludge toward the center hopper.<ref name="spec-mech">{{Cite spec|section=46 33 00|paragraph=2.1.A|title=Center-Driven Sludge Collectors}}</ref> Primary sludge is pumped from the center hopper by dedicated centrifugal non-clog pumps. Each clarifier has one duty pump and shares a common standby pump with the adjacent clarifier at 500 GPM and 30 ft TDH with 25 HP motors.<ref name="dwg-m-401">{{Cite drawing|number=M-401|rev=2|date=2025-11-15|title=Mechanical Plan}}</ref>

A rotating scum skimmer on each clarifier directs floating material to a scum beach and trough. Scum is discharged by gravity to the scum wet well.

== Electrical ==

Power distribution for Area 03 is fed from MCC-3 located in the operations building. Each clarifier mechanism has a dedicated variable frequency drive for speed control. Emergency power is available via the standby generator for all clarifier drives and one sludge pump per clarifier pair.<ref name="dwg-e-301">{{Cite drawing|number=E-301|rev=2|date=2025-11-15|title=Electrical Single Line}}</ref>

== Instrumentation and Controls ==

Each clarifier is instrumented with sludge blanket level detectors using ultrasonic technology, influent and effluent turbidity analyzers, clarifier mechanism torque monitoring, and sludge pump magnetic flow meters. The sludge blanket detector automatically adjusts sludge pump runtime based on blanket depth, with high-level alarm at 6 feet and high-high alarm at 8 feet.<ref name="dwg-i-301">{{Cite drawing|number=I-301|rev=1|date=2025-11-15|title=Area 03 P&ID}}</ref>

== Connected Systems ==

* '''Upstream:''' Raw wastewater from [[Area 02 — Headworks]] via 48-inch RCP influent pipe at invert elevation 32.5
* '''Downstream:''' Primary effluent to [[Area 04 — Aeration Basins]] via 42-inch RCP at invert elevation 34.0; primary sludge to [[Area 09 — Solids Handling]] via 8-inch force main

== Construction Requirements ==

Clarifier construction follows a specific sequence mandated by the project specifications. The sequence includes excavation and dewatering, foundation preparation and mat slab placement, wall forming and placement in two lifts with maximum 12-foot lift height, center column and mechanism support structure, influent and effluent piping and wall penetrations, mechanism installation and alignment, and hydrostatic testing for a minimum 24 hours. Each clarifier must pass hydrostatic testing before the adjacent clarifier wall forms are removed to maintain site stability during construction.<ref name="spec-seq">{{Cite spec|section=01 10 00|paragraph=3.4.B|title=Summary of Work}}</ref>

== References ==
<references />

[[Category:Area 03]]
[[Category:Process Areas]]
`;

describe('completeness grader — area role', () => {
  it('scores 1.0 for a complete area page', () => {
    const result = gradeCompleteness(AREA_PAGE, { role: 'area' });
    assert.equal(result.score, 1, `Failed checks: ${result.details.filter((d) => !d.passed).map((d) => d.check).join(', ')}`);
  });

  it('detects missing Infobox area', () => {
    const page = AREA_PAGE.replace(/\{\{Infobox area[\s\S]*?\}\}/, '');
    const result = gradeCompleteness(page, { role: 'area' });
    const check = result.details.find((d) => d.check.includes('Infobox area'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects missing discipline sections', () => {
    const page = `{{Infobox area\n| name = Test\n}}\n\nLead paragraph.\n\n== Overview ==\n\nSome content here.\n\n== References ==\n<references />\n\n[[Category:Test]]`;
    const result = gradeCompleteness(page, { role: 'area' });
    const check = result.details.find((d) => d.check.includes('discipline'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects missing Connected Systems', () => {
    // Remove the Connected Systems section AND the upstream/downstream infobox fields
    let page = AREA_PAGE.replace(/== Connected Systems ==[\s\S]*?(?=== Construction)/, '');
    page = page.replace(/\| upstream\s+=.*\n/, '');
    page = page.replace(/\| downstream\s+=.*\n/, '');
    const result = gradeCompleteness(page, { role: 'area' });
    const check = result.details.find((d) => d.check.includes('Connected Systems'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects insufficient citations', () => {
    const page = `{{Infobox area\n| name = Test\n}}\n\nLead paragraph.\n\n== Structural ==\n\nContent.\n\n== Mechanical ==\n\nContent.\n\n== References ==\n<references />\n\n[[Category:Test]]`;
    const result = gradeCompleteness(page, { role: 'area' });
    const check = result.details.find((d) => d.check.includes('citations'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });
});

// ── Equipment page tests ─────────────────────────────────────────────

const EQUIPMENT_PAGE = `{{Infobox equipment
| name         = Primary Sludge Pump PS-301A
| tag          = PS-301A
| type         = Centrifugal non-clog pump
| area         = [[Area 03 — Primary Clarifiers]]
| capacity     = 500 GPM at 30 ft TDH
| motor        = 25 HP, 460V/3Ph/60Hz
| power        = 25 HP
| spec_section = [[Spec:43 21 00]]
| status       = Not yet submitted
}}

PS-301A is the duty primary sludge pump serving Clarifiers 1 and 2.<ref name="spec-pump">{{Cite spec|section=43 21 00|paragraph=2.2.A|title=Centrifugal Sewage Pumps}}</ref>

== References ==
<references />

[[Category:Equipment]]
`;

describe('completeness grader — equipment role', () => {
  it('scores 1.0 for a complete equipment page', () => {
    const result = gradeCompleteness(EQUIPMENT_PAGE, { role: 'equipment' });
    assert.equal(result.score, 1, `Failed checks: ${result.details.filter((d) => !d.passed).map((d) => d.check).join(', ')}`);
  });

  it('detects missing tag number', () => {
    const page = EQUIPMENT_PAGE.replace(/\| tag\s+=\s+PS-301A\n/, '');
    const result = gradeCompleteness(page, { role: 'equipment' });
    const check = result.details.find((d) => d.check.includes('tag number'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects missing area link', () => {
    const page = EQUIPMENT_PAGE.replace(/\| area\s+=\s+\[\[Area 03.*?\]\]/, '| area         = Area 03');
    const result = gradeCompleteness(page, { role: 'equipment' });
    const check = result.details.find((d) => d.check.includes('area page'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('has 7 checks for equipment role', () => {
    const result = gradeCompleteness('', { role: 'equipment' });
    assert.equal(result.details.length, 7);
  });
});

// ── Drawing page tests ───────────────────────────────────────────────

const DRAWING_PAGE = `{{Infobox drawing
| number     = C-301
| title      = Primary Clarifier Site Plan
| discipline = Civil
| area       = [[Area 03 — Primary Clarifiers]]
| rev        = 3
| rev_date   = 2025-11-15
}}

Drawing C-301 is the primary site plan for the clarifier complex.

== Title Block ==

{| class="wikitable"
|-
! Field !! Value
|-
| Drawing Number || C-301
|-
| Title || Primary Clarifier Site Plan
|}

== Observations ==

* Four large circles labeled "120'-0" DIA"
* Dashed lines indicating underground piping
* Elevation markers at clarifier rim (44.0) and center (32.0)

== Dimensions and Elevations ==

{| class="wikitable"
|-
! Element !! Dimension
|-
| Clarifier diameter || 120'-0"
|-
| Influent pipe || 48"
|}

== Cross-References ==

{| class="wikitable"
|-
! Reference !! Target !! Verified
|-
| "See S-302" || [[Drawing:S-302]] || Yes
|}

== Engineering Interpretation ==

The site plan establishes a compact 2x2 grid layout with 40-45 feet clear between tank edges.

== References ==
<references />

[[Category:Civil drawings]]
`;

describe('completeness grader — drawing role', () => {
  it('scores 1.0 for a complete drawing page', () => {
    const result = gradeCompleteness(DRAWING_PAGE, { role: 'drawing' });
    assert.equal(result.score, 1, `Failed checks: ${result.details.filter((d) => !d.passed).map((d) => d.check).join(', ')}`);
  });

  it('detects missing Title Block section', () => {
    const page = DRAWING_PAGE.replace(/== Title Block ==[\s\S]*?(?=== Observations)/, '');
    const result = gradeCompleteness(page, { role: 'drawing' });
    const check = result.details.find((d) => d.check.includes('Title Block'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects missing Observations section', () => {
    const page = DRAWING_PAGE.replace(/== Observations ==[\s\S]*?(?=== Dimensions)/, '');
    const result = gradeCompleteness(page, { role: 'drawing' });
    const check = result.details.find((d) => d.check.includes('Observations'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects missing revision in infobox', () => {
    const page = DRAWING_PAGE.replace(/\| rev\s+=\s+3\n/, '');
    const result = gradeCompleteness(page, { role: 'drawing' });
    const check = result.details.find((d) => d.check.includes('revision'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('has 10 checks for drawing role', () => {
    const result = gradeCompleteness('', { role: 'drawing' });
    assert.equal(result.details.length, 10);
  });
});

// ── Spec page tests ──────────────────────────────────────────────────

const SPEC_PAGE = `{{Infobox spec
| section    = 03 30 00
| title      = Cast-in-Place Concrete
| division   = 03 — Concrete
| areas      = [[Area 03 — Primary Clarifiers]]
}}

Specification Section 03 30 00 governs all cast-in-place concrete work for the project including formwork, reinforcement, materials, placement, and testing for structural concrete in water-retaining structures, foundations, and miscellaneous work.

== Part 1 — General ==

=== 1.1 Summary ===

{{Verbatim|This Section specifies cast-in-place concrete including formwork, reinforcement, concrete materials, mix proportioning, placement, finishing, and curing.}}

=== 1.2 Submittals ===

Mix design submittals are required for each concrete class and must be submitted 30 days prior to first placement with supporting trial batch data per ASTM C192. Reinforcement shop drawings shall include bar bending schedules and placement drawings per ACI 315. Formwork drawings are required for all liquid-retaining structures and walls over 10 feet in height. A concrete placement plan is required for each liquid-retaining structure including sequence, lift heights, joint locations, and cold weather procedures.

=== 1.3 Quality Assurance ===

Concrete placement shall be performed by a firm with minimum 5 years documented experience in water-retaining concrete structures. The firm shall demonstrate successful completion of at least 3 liquid-retaining structures of comparable size and complexity. The testing agency shall be independent and meet ASTM C1077 requirements.

== Part 2 — Products ==

=== 2.1 Concrete Materials ===

{{Verbatim|Class A-4500 concrete shall be used for all liquid-retaining structures including clarifier walls and floors, aeration basin walls and floors, channel walls and floors, wet wells, and pump stations.}}

Cement: ASTM C150, Type I/II with 20 percent fly ash replacement maximum conforming to ASTM C618 Class F. Slag is not permitted without prior Engineer approval. Reinforcing steel: ASTM A615 Grade 60 deformed bars. Concrete strength: 4,500 PSI at 28 days with maximum water-cement ratio of 0.45 for liquid-retaining structures. Water-reducing admixtures conforming to ASTM C494 Type A or D are permitted. Air-entraining admixtures per ASTM C260 with a target of 5 to 7 percent for exterior elements.

== Part 3 — Execution ==

=== 3.1 Formwork ===

Forms for liquid-retaining structures shall produce surfaces meeting ACI 347 Class A finish. Maximum form tie hole diameter is 1 inch. All form tie holes in liquid-retaining walls shall be plugged with non-shrink grout and sealed with approved waterstop compound. Maximum lift height for liquid-retaining walls is 12 feet. Construction joints between lifts shall include waterstop and keyed joints per structural details.

=== 3.2 Reinforcement Placement ===

Minimum concrete cover for formed surfaces exposed to liquid is 2 inches. For formed surfaces not exposed to liquid the minimum cover is 1.5 inches. Slabs on grade require 3 inches of cover on the bottom. Reinforcement placement tolerances are per ACI 117 with cover tolerance of plus one-half inch minus three-eighths inch and spacing tolerance of plus or minus 1 inch.

=== 3.3 Concrete Placement ===

{{Verbatim|Concrete shall be placed within 90 minutes of batching. Maximum free-fall distance: 5 feet. Concrete temperature at placement minimum 50 degrees F maximum 90 degrees F. For liquid-retaining structures maximum placement rate shall not exceed 4 feet of vertical rise per hour.}}

Cold weather conditions require heated enclosures and maintenance of concrete temperature above 50 degrees F for 7 days minimum. Hot weather conditions require chilled water or ice and retarding admixtures.

=== 3.4 Curing ===

Liquid-retaining structures require moist curing for a minimum of 7 days. Maintain wet burlap or continuous water spray. Curing compound is not permitted on surfaces in contact with liquid.

=== 3.5 Hydrostatic Testing ===

{{Verbatim|All liquid-retaining structures shall be hydrostatically tested before backfill or equipment installation. Fill structure to overflow elevation and hold for minimum 24 hours. Maximum allowable leakage rate: 0.001 gallons per square foot of wetted surface per 24 hours.}}

== References ==
<references />

[[Category:Division 03]]
[[Category:Specifications]]
`;

describe('completeness grader — spec role', () => {
  it('scores 1.0 for a complete spec page', () => {
    const result = gradeCompleteness(SPEC_PAGE, { role: 'spec' });
    assert.equal(result.score, 1, `Failed checks: ${result.details.filter((d) => !d.passed).map((d) => d.check).join(', ')}`);
  });

  it('detects missing Part structure', () => {
    const page = `{{Infobox spec\n| section = 03 30 00\n| areas = [[Area 03]]\n}}\n\nLead paragraph.\n\n== Overview ==\n\n{{Verbatim|Some text.}}\n\nMore content here to hit word count. ` + 'word '.repeat(300) + `\n\n== References ==\n<references />\n\n[[Category:Specs]]`;
    const result = gradeCompleteness(page, { role: 'spec' });
    const check = result.details.find((d) => d.check.includes('Part structure'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects missing verbatim text', () => {
    const page = `{{Infobox spec\n| section = 03 30 00\n| areas = [[Area 03]]\n}}\n\nLead.\n\n== Part 1 ==\n\nContent.\n\n== Part 2 ==\n\n` + 'word '.repeat(300) + `\n\n== References ==\n<references />\n\n[[Category:Specs]]`;
    const result = gradeCompleteness(page, { role: 'spec' });
    const check = result.details.find((d) => d.check.includes('verbatim'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('has 7 checks for spec role', () => {
    const result = gradeCompleteness('', { role: 'spec' });
    assert.equal(result.details.length, 7);
  });
});

// ── Construction document page tests ─────────────────────────────────

const CONSTRUCTION_DOC_PAGE = `{{Infobox construction
| type          = RFI
| number        = RFI-042
| subject       = Clarifier Wall Reinforcement at Penetrations
| status        = Closed
| date_issued   = 2026-01-20
| date_response = 2026-01-22
| spec_section  = [[Spec:03 30 00]]
| areas         = [[Area 03 — Primary Clarifiers]]
| drawings      = [[Drawing:S-302]], [[Drawing:S-305]]
}}

RFI-042 was submitted to resolve a conflict between structural drawings for reinforcement at wall penetrations.

== Question ==

Drawing S-302 shows #5 at 12" O.C. at penetrations. Drawing S-305 Detail 7 shows #5 at 8" O.C. Which governs?

== Response ==

Detail 7 on S-305 governs for all penetrations greater than 6 inches diameter.

== Pages Updated ==

* [[Area 03 — Primary Clarifiers]] — Structural section updated
* [[Spec:03 30 00]] — Active Modifications table updated

== References ==
<references />

[[Category:RFIs]]
`;

describe('completeness grader — construction-doc role', () => {
  it('scores 1.0 for a complete construction doc page', () => {
    const result = gradeCompleteness(CONSTRUCTION_DOC_PAGE, { role: 'construction-doc' });
    assert.equal(result.score, 1, `Failed checks: ${result.details.filter((d) => !d.passed).map((d) => d.check).join(', ')}`);
  });

  it('detects missing Pages Updated section', () => {
    const page = CONSTRUCTION_DOC_PAGE.replace(/== Pages Updated ==[\s\S]*?(?=== References)/, '');
    const result = gradeCompleteness(page, { role: 'construction-doc' });
    const check = result.details.find((d) => d.check.includes('Pages Updated'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects missing content sections', () => {
    const page = `{{Infobox construction\n| type = RFI\n| status = Open\n}}\n\nLead.\n\n== Pages Updated ==\n\nNone.\n\n[[Category:RFIs]]`;
    const result = gradeCompleteness(page, { role: 'construction-doc' });
    const check = result.details.find((d) => d.check.includes('content sections'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('has 6 checks for construction-doc role', () => {
    const result = gradeCompleteness('', { role: 'construction-doc' });
    assert.equal(result.details.length, 6);
  });
});

// ── Issue page tests ─────────────────────────────────────────────────

const ISSUE_PAGE = `{{Infobox issue
| id            = 003
| type          = Missing Specification
| severity      = Moderate
| status        = Open
| areas         = [[Area 03 — Primary Clarifiers]]
| disciplines   = Civil, Geotechnical
| discovered    = 2026-02-13
}}

Issue 003 identifies a gap in the contract documents where dewatering is required but no specification exists.

== Description ==

The geotechnical report documents groundwater at elevation 38.5, approximately 4 feet below the proposed bottom of excavation. Spec 01 10 00 requires dewatering but no dewatering specification section was found.<ref name="geotech">{{Cite document|title=Geotechnical Report|author=GeoEngineers|date=2025-03-15|page=18}}</ref>

== Impact ==

Schedule impact: dewatering is on the critical path. Quality impact: inadequate dewatering can reduce bearing capacity. Cost impact: potential change order.

== Recommended Action ==

Issue an RFI requesting dewatering requirements. Require contractor to submit a dewatering plan.

== Resolution ==

Pending.

== References ==
<references />

[[Category:Open issues]]
`;

describe('completeness grader — issue role', () => {
  it('scores 1.0 for a complete issue page', () => {
    const result = gradeCompleteness(ISSUE_PAGE, { role: 'issue' });
    assert.equal(result.score, 1, `Failed checks: ${result.details.filter((d) => !d.passed).map((d) => d.check).join(', ')}`);
  });

  it('detects missing severity', () => {
    const page = ISSUE_PAGE.replace(/\| severity\s+=\s+Moderate\n/, '');
    const result = gradeCompleteness(page, { role: 'issue' });
    const check = result.details.find((d) => d.check.includes('severity'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects missing Description section', () => {
    const page = ISSUE_PAGE.replace(/== Description ==[\s\S]*?(?=== Impact)/, '');
    const result = gradeCompleteness(page, { role: 'issue' });
    const check = result.details.find((d) => d.check.includes('Description'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('detects missing Impact section', () => {
    const page = ISSUE_PAGE.replace(/== Impact ==[\s\S]*?(?=== Recommended)/, '');
    const result = gradeCompleteness(page, { role: 'issue' });
    const check = result.details.find((d) => d.check.includes('Impact'));
    assert.ok(check);
    assert.equal(check.passed, false);
  });

  it('has 8 checks for issue role', () => {
    const result = gradeCompleteness('', { role: 'issue' });
    assert.equal(result.details.length, 8);
  });
});

// ── Talk page with construction features ─────────────────────────────

describe('completeness grader — construction talk page', () => {
  const CONSTRUCTION_TALK = `== Verification status ==
{{Verification|status=in-progress|note=Structural sections from IFC Rev 3.|last_verified=2026-02-15|sources=C-301, S-302}}

== Active gaps ==

=== Clarifier mechanism vendor unknown ===
{{Open}}
Spec lists performance requirements but no basis-of-design manufacturer.

== Resolved ==

=== Wall rebar spacing ===
{{Closed}}
Resolved by RFI-042.

== Coordination issues ==

Mechanical penetrations need structural details for non-standard sizes.

== Document history ==

=== Initial creation ===
2026-02-10. Created from C-301 through C-310.

== Agent log ==

=== Task:0003 ===
2026-02-10. Created from civil drawing set.
`;

  it('scores 1.0 for a complete construction talk page', () => {
    const result = gradeCompleteness(CONSTRUCTION_TALK, { role: 'talk' });
    assert.equal(result.score, 1, `Failed checks: ${result.details.filter((d) => !d.passed).map((d) => d.check).join(', ')}`);
  });

  it('detects verification status template', () => {
    const result = gradeCompleteness(CONSTRUCTION_TALK, { role: 'talk' });
    const check = result.details.find((d) => d.check.includes('verification'));
    assert.ok(check);
    assert.equal(check.passed, true);
  });
});
