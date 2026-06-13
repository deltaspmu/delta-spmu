"""
Delta SPMU Academy — canonical seed script.

Seeds:
- Categories (Permanent Makeup + supporting)
- Instructor + test student users
- 5 courses: Foundation, Advanced, Master Artist, Instructor Licensing,
  Professional Bridal Makeup
- All chapters and lessons (text bodies — videos uploaded later via admin)
- One quiz per chapter (SingleChoice + MultipleChoice mix)

Idempotent: wipes existing courses and re-seeds. Safe to re-run.

Run via (on the EC2 server, as the frappe user):
    cd /home/frappe/deltaspmu
    /home/frappe/deltaspmu/env/bin/python /tmp/seed_delta_spmu.py

Or from a workstation:
    scp scripts/seed_delta_spmu.py ubuntu@<EC2-IP>:/tmp/
    ssh ubuntu@<EC2-IP> "sudo -u frappe bash -c 'cd /home/frappe/deltaspmu && /home/frappe/deltaspmu/env/bin/python /tmp/seed_delta_spmu.py'"

Do NOT pipe this into ``bench console`` — IPython treats each top-level line
as its own cell and global variables get torn down between definitions.

Pricing: every course is 12,500 ETB. The "all courses" bundle is 20,000 ETB
(see lms.lms.payments_api.BUNDLE_PRICE).
"""

import os
import sys

# Initialise Frappe in standalone mode so the script can be run with the
# bench's venv Python directly (no IPython, no bench console).
import frappe

SITE = "api.deltaspmu.com"
BENCH_PATH = "/home/frappe/deltaspmu"


def _frappe_init():
    """Boot Frappe against the target site if we are not already inside a
    running Frappe context. No-op when imported from a bench console."""
    if not getattr(frappe.local, "site", None):
        # This frappe build builds its log paths RELATIVE to the cwd
        # (``<site>/logs`` and ``../logs``), so the working directory must be
        # the bench's ``sites`` dir — chdir-ing to the bench root makes
        # frappe.connect() crash trying to open ``<bench>/<site>/logs``.
        sites_path = os.path.join(BENCH_PATH, "sites")
        os.chdir(sites_path)
        frappe.init(site=SITE, sites_path=sites_path)
        frappe.connect()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
INSTRUCTOR_EMAIL = "instructor@deltaspmu.com"
INSTRUCTOR_FIRST = "Eden"
INSTRUCTOR_LAST = "Kassahun"
INSTRUCTOR_PASSWORD = "Eden@Delta2026!"

STUDENT_EMAIL = "student@deltaspmu.com"
STUDENT_FIRST = "Hanna"
STUDENT_LAST = "Bekele"
STUDENT_PASSWORD = "Hanna@Delta2026!"

CATEGORIES = [
    "Permanent Makeup",
    "Beauty & Aesthetics",
    "Business & Marketing",
    "Health & Safety",
]

COURSE_PRICE = 12500
DEFAULT_PASSING_PERCENTAGE = 70
DEFAULT_MAX_ATTEMPTS = 3


# ---------------------------------------------------------------------------
# Reusable lesson bodies — text drawn from the official Delta SPMU manual.
# Each body is plain HTML that will be rendered through DOMPurify on the
# student portal's Learn page.
# ---------------------------------------------------------------------------

LESSON_BODIES = {
    "skin_anatomy": """<p>The skin is composed of three primary layers: the epidermis, dermis, and subcutaneous layer. In semi-permanent makeup procedures, pigment is implanted into the upper dermis, just beneath the epidermis. Implanting pigment at the correct depth is critical. If the pigment is placed too superficially in the epidermis, it may fade quickly as the skin naturally exfoliates. If it is placed too deeply into the dermis, the pigment may spread or appear blurred.</p>
<p>The epidermis is the outermost layer of the skin and acts as the body's protective barrier. This layer continuously renews itself through natural skin cell turnover. The dermis, located beneath the epidermis, contains collagen, blood vessels, and connective tissue that support the skin's structure. Proper pigment implantation within the upper dermis allows color to remain visible while still fading gradually over time.</p>""",

    "fitzpatrick": """<p>The Fitzpatrick Skin Type Classification is a dermatological system used to classify human skin according to its reaction to ultraviolet (UV) exposure. It helps professionals predict how skin responds to sunlight, lasers, chemical treatments, and semi-permanent makeup procedures.</p>
<h4>The 6 Fitzpatrick Skin Types</h4>
<ul>
<li><strong>Type I — Very Fair Skin:</strong> Very pale or ivory skin, often freckles. Always burns, never tans. Use lighter pigment implantation; risk of redness during procedure.</li>
<li><strong>Type II — Fair Skin:</strong> Burns easily, tans slightly. Careful pigment choice to avoid ashy brows; healing may appear pinkish at first.</li>
<li><strong>Type III — Medium / Beige Skin:</strong> Sometimes burns, gradually tans. Ideal skin type for SPMU; good pigment retention.</li>
<li><strong>Type IV — Olive Skin:</strong> Rarely burns, tans easily. Pigments may heal cooler or darker; careful depth control needed.</li>
<li><strong>Type V — Brown Skin:</strong> Very rarely burns. Risk of hyperpigmentation; use warm pigments to prevent grey tones.</li>
<li><strong>Type VI — Deep Brown / Black Skin:</strong> Never burns, high melanin. Risk of keloid scarring or hyperpigmentation; technique must be gentle.</li>
</ul>
<p>In semi-permanent makeup, the skin type influences pigment color choice, needle depth, the healing process, the risk of complications, and the touch-up schedule.</p>""",

    "healing_science": """<p>Following a semi-permanent makeup procedure, the skin undergoes a natural healing process. Immediately after treatment, mild redness and slight swelling may occur as the body responds to the procedure. Over the following days, the treated area may appear darker before forming light scabbing as the skin begins to repair itself.</p>
<p>During the healing stage, pigment may appear lighter as the skin regenerates and settles. This is a normal part of the healing cycle, and final color results become visible once the skin has fully recovered. Because some pigment loss occurs during healing, follow-up treatments or touch-up sessions are typically recommended to perfect the final result.</p>
<p>A thorough understanding of skin anatomy and healing science allows practitioners to perform procedures with precision while minimizing complications and ensuring optimal pigment retention.</p>""",

    "hygiene": """<p>Maintaining strict hygiene and infection control standards is essential in semi-permanent makeup practice. Because permanent makeup procedures involve breaking the surface of the skin, practitioners must follow professional sanitation protocols to prevent cross-contamination and protect the health and safety of both the client and the practitioner.</p>
<p>Hand hygiene is the single most effective protective measure: hands must be washed with soap and warm water before glove-up, and re-sanitised between tasks. Long fingernails, jewellery, and watches should not be worn in the treatment area.</p>""",

    "infection_control": """<p>Before beginning any procedure, the workstation must be properly prepared and disinfected using approved sanitation products. All tools, surfaces, and equipment should be cleaned and organized in a manner that maintains a sterile working environment. Practitioners must thoroughly wash or sanitize their hands and wear appropriate personal protective equipment (PPE), such as disposable gloves, before handling any instruments or materials.</p>
<p>Semi-permanent makeup procedures must be performed using single-use sterile needles and disposable materials. Items such as needle cartridges, pigment rings, gloves, and protective barrier coverings must be discarded after each treatment and must never be reused.</p>
<p>Sharps, including used needles and cartridges, must be disposed of immediately in approved sharps disposal containers. Contaminated waste materials should be discarded in accordance with safe waste management practices. Workstations and equipment should be disinfected both before and after every procedure.</p>""",

    "color_theory": """<p>Color theory is a fundamental aspect of semi-permanent makeup, as it guides practitioners in selecting the appropriate pigments to achieve natural, balanced, and long-lasting results. Understanding how pigments interact with the client's skin tone, undertone, and natural hair color allows artists to create brow results that complement the client's overall facial harmony.</p>
<p>In permanent makeup, pigments are composed of carefully formulated color compounds designed to be implanted into the skin and gradually fade over time. Unlike traditional cosmetics, PMU pigments must be selected with consideration of how the color will heal and settle within the skin. The final healed result may appear slightly softer or cooler than the color initially implanted during the procedure.</p>
<p>The colour wheel still applies: warm tones counteract cool undertones, and vice versa. A pigment that heals too cool can be warmed by adding a complementary warm modifier in the next touch-up.</p>""",

    "pigment_selection": """<p>A key element of color theory involves recognizing skin undertones, which may be warm, cool, or neutral. Warm undertones typically contain golden or yellow hues, while cool undertones may appear pink, red, or bluish. Neutral undertones fall between these two categories. Selecting a pigment that harmonizes with the client's undertone helps prevent undesirable color shifts during healing.</p>
<p>Practitioners must also consider the client's natural brow hair color, skin depth, and desired aesthetic outcome when choosing pigments. For example, lighter skin tones may require softer pigment shades to maintain a natural appearance, while deeper skin tones may benefit from richer, more saturated pigments to ensure proper visibility and retention.</p>""",

    "face_shapes": """<p>Brow mapping is the process of measuring and outlining the ideal eyebrow shape based on facial proportions. This technique ensures that both brows are balanced and positioned correctly in relation to key facial landmarks.</p>
<h4>The 6 Face Shapes</h4>
<ol>
<li><strong>Oval:</strong> Balanced proportions, slightly longer than wide. Best brows: soft angled or natural arch. Avoid flat brows.</li>
<li><strong>Round:</strong> Full cheeks, equal width and height. Best brows: high arch with lifted tail. Avoid rounded brows.</li>
<li><strong>Square:</strong> Strong jawline, angular structure. Best brows: soft curved arch. Avoid sharp harsh angles.</li>
<li><strong>Heart:</strong> Wider forehead, narrow chin. Best brows: soft rounded brow with lower arch.</li>
<li><strong>Diamond:</strong> Wide cheekbones, narrow forehead and chin. Best brows: curved brows with slight arch.</li>
<li><strong>Long / Rectangular:</strong> Length greater than width. Best brows: flat or low arch. Avoid high arches.</li>
</ol>""",

    "golden_ratio": """<p>Before performing any semi-permanent makeup procedure, practitioners should carefully outline the proposed brow shape and review it with the client to ensure satisfaction with the design.</p>
<h4>The Three Key Points</h4>
<ol>
<li><strong>Start point:</strong> aligns with the side of the nose.</li>
<li><strong>Arch point:</strong> aligns with the outer iris — this point controls the expression of the brow.</li>
<li><strong>Tail point:</strong> aligns with the outer eye corner; the tail should never drop below the head of the brow.</li>
</ol>
<p><strong>The golden rule:</strong> the tail should never fall below the head of the brow!</p>""",

    "asymmetry": """<p>Personalised layering considers the client's natural brow growth pattern, hair density, and personality. A soft personality often pairs with a soft gradient brow; a bolder personality often pairs with a more defined ombré.</p>
<p>No face is perfectly symmetrical. The most common asymmetry issues are one brow sitting higher than the other, uneven eyes, and a slightly tilted forehead.</p>
<h4>Correction techniques</h4>
<ul>
<li>Adjusting arch height slightly on one side.</li>
<li>Modifying tail length to create a balanced visual frame.</li>
<li>Using illusion rather than forcing symmetry — the goal is harmony, not identical twins.</li>
</ul>""",

    "mapping_tools": """<p>Common mapping tools include thread mapping, brow pencils, and calipers.</p>
<h4>Steps for mapping</h4>
<ol>
<li>Clean the skin thoroughly.</li>
<li>Mark the facial centerline.</li>
<li>Map start, arch, and tail points.</li>
<li>Outline the brow shape.</li>
<li>Fill lightly with a brow pencil.</li>
<li>Show the client and discuss.</li>
<li>Adjust before beginning the procedure.</li>
</ol>""",

    "machine_needle": """<p>A clear understanding of permanent makeup machines and needle configurations is essential for performing safe and effective semi-permanent makeup procedures.</p>
<p>Permanent makeup machines typically operate with a motor-driven system that moves the needle cartridge in a controlled, repetitive motion. This minimises trauma to the surrounding tissue. Practitioners must understand how to adjust machine speed, depth, and pressure to achieve consistent pigment implantation.</p>
<p>Needle cartridges are available in different configurations: round liners and 1-prong nano needles are best suited for hair-stroke work, while magnums and shaders are better for soft shading techniques like ombré or powder brows.</p>""",

    "beginner_mistakes": """<p>Recognising common beginner mistakes helps practitioners improve their skills and avoid issues that may affect treatment results or skin health.</p>
<ul>
<li><strong>Incorrect pigment depth:</strong> Too superficial leads to quick fading; too deep causes spreading or blurring. Maintain consistent needle depth.</li>
<li><strong>Excessive pressure / oversaturation:</strong> Too much pigment in a single pass causes skin trauma and uneven retention. Use gradual layering.</li>
<li><strong>Inconsistent hand movement:</strong> Leads to uneven shading or patchy results. Maintain steady machine control and consistent movement patterns.</li>
<li><strong>Improper brow mapping:</strong> Skipping facial-proportion analysis leads to asymmetrical results. Always map carefully and get client approval before beginning.</li>
</ul>""",

    "ombre_theory": """<p>The ombré brow technique is one of the most popular methods used in semi-permanent makeup for creating soft, defined, and natural-looking eyebrows. It involves implanting pigment using a shading method that produces a gradual gradient — lighter at the front of the brow, progressively darker and more defined at the tail.</p>
<p>Unlike hairstroke techniques that mimic individual brow hairs, ombré brows rely on a pixelated shading pattern to create depth and fullness. The technique is achieved through controlled machine movements that deposit pigment in small, consistent layers.</p>
<p>A key principle is maintaining a balanced gradient across the brow structure. The inner portion is kept lighter for a soft, natural transition; the arch and tail receive more saturation to define the shape. Proper pressure, machine speed, and needle movement are essential — apply pigment evenly without oversaturating the skin.</p>""",

    "nano_theory": """<p>Nano brows are an advanced semi-permanent makeup technique designed to create ultra-fine, hair-like strokes that closely replicate the appearance of natural eyebrow hair. Unlike traditional microblading, which uses a manual blade, nano brows are performed using a permanent makeup machine with a very fine needle cartridge.</p>
<p>The nano brow technique focuses on creating delicate strokes that follow the natural growth pattern of the client's eyebrow hair. Because the procedure is performed with a machine rather than a manual blade, nano brows are often considered less traumatic to the skin and can be suitable for a wider range of skin types, including clients with oily or sensitive skin.</p>
<p>Successful application requires careful attention to stroke direction, spacing, and depth control. Each stroke must be placed with precision to mimic natural hair flow and avoid overcrowding the brow area.</p>""",

    "combo_theory": """<p>Combo brows blend the precision of hairstroke techniques with the fullness of shading, resulting in a balanced look that mimics natural brow hair while adding density and structure.</p>
<p>In a combo brow procedure, fine hairstrokes are typically placed in the front or upper section of the brow to replicate natural hair growth, while soft shading is applied through the body and tail of the brow to create depth and definition. This combination allows the practitioner to design brows that appear fuller while maintaining a soft and realistic appearance.</p>
<p>The technique requires careful planning and brow mapping to determine where strokes and shading should be placed. Proper balance between these elements is important to prevent the brows from appearing too heavy or overly saturated.</p>""",

    "powder_theory": """<p>Powder brows are a semi-permanent makeup technique designed to create a soft, powdered effect that resembles the look of lightly filled-in eyebrow makeup. This method uses a machine to implant pigment through a shading technique that produces a smooth, even gradient across the brow.</p>
<p>Unlike hairstroke techniques, powder brows rely on pixelated shading rather than individual strokes. The front of the brow is typically kept lighter, while the arch and tail areas are slightly darker to create definition and structure.</p>
<p>The powder brow technique is known for producing a soft, velvety finish that heals into a natural-looking result. It is suitable for a wide range of skin types, including oily or mature skin, where hairstroke techniques may not retain pigment as effectively.</p>""",

    "artificial_skin": """<p>Artificial skin practice is an essential step in the training process for semi-permanent makeup artists. Before performing procedures on live models, students must develop hand control, machine handling skills, and pigment implantation techniques through structured practice drills on artificial skin.</p>
<p>Practice drills typically include exercises such as line control, shading patterns, pixel placement, and gradient building, all of which are fundamental components of the ombré brow technique. Students learn to maintain consistent spacing, smooth machine movement, and controlled pigment layering to achieve even and balanced results.</p>
<p>Drills should be performed daily during the foundation phase: 30 minutes of line work, 30 minutes of shading, and 30 minutes of full-brow simulations. Repetition builds the muscle memory required for precision under real-skin conditions.</p>""",

    "consultation": """<p>Client consultation is a critical step in the semi-permanent makeup process. A thorough consultation allows the practitioner to understand the client's expectations, evaluate suitability for treatment, and ensure that the procedure can be performed safely and effectively.</p>
<p>During the consultation, the practitioner should discuss the client's desired brow shape, color preferences, and overall aesthetic goals. The practitioner must assess skin type, natural brow pattern, facial symmetry, and potential contraindications.</p>
<p>Before beginning any treatment, clients must complete and sign required forms: medical history form, consent form, and treatment record. The practitioner should also document the treatment plan including chosen pigment shade, brow design, and specific client preferences. Maintain accurate records to support future touch-up sessions and professional accountability.</p>""",

    "live_model": """<p>The live model procedure is an important stage in semi-permanent makeup training, allowing students to apply their theoretical knowledge and practical skills in a supervised clinical environment.</p>
<p>Before beginning, the student must conduct a full client consultation, review the model's medical history, and obtain signed consent forms. The treatment area must be properly prepared with a disinfected workstation and sterile equipment. The practitioner should cleanse the model's brow area and perform brow mapping to establish the appropriate shape and symmetry before beginning pigment implantation.</p>
<p>During the procedure, students must maintain proper machine control, consistent needle depth, and smooth shading movements. Instructors closely supervise the process. After completing the procedure, the practitioner cleans the treatment area and reviews aftercare instructions with the model.</p>""",

    "healing_touchup": """<p>The healing process determines how pigment settles within the skin and how final results appear. Immediately after an ombré brow procedure, the treated area may appear darker and slightly more defined than the expected healed result.</p>
<p>Within a few days, light scabbing or flaking may develop. As healing continues, some pigment may appear lighter or slightly faded — this is normal. A touch-up session is typically recommended several weeks after the initial procedure to refine shape, reinforce color, and correct any areas of uneven retention.</p>
<p>Clients should keep the treated area clean and dry, avoid excessive moisture, and refrain from picking or scratching the healing skin. Provide a printed aftercare card at the end of every procedure.</p>""",

    "business_branding": """<p>Successful permanent makeup artists must develop not only technical skills but also a strong understanding of business and personal branding. Establishing a professional presence requires strategic planning, ethical client management, and consistent service quality.</p>
<p>Branding begins with defining a clear professional identity that reflects the artist's style, values, and level of expertise. This includes a recognisable business name, a consistent visual identity, and a professional image across social media and online portfolios.</p>
<p>Practitioners should focus on building trust through high standards of hygiene, professionalism, and communication. Clear consultation processes, transparent pricing, and proper aftercare guidance contribute to positive client experiences and long-term client relationships.</p>
<p>Marketing through digital platforms — showcasing work, sharing educational content, and connecting with potential clients — helps build credibility and attract new business.</p>""",

    "assessment_cert": """<p>Assessment and certification at Delta Academy are based on a competency-based evaluation system designed to ensure that students demonstrate both theoretical knowledge and practical skill in semi-permanent makeup procedures.</p>
<p>Student progress is evaluated through multiple assessment methods throughout the training program. Theoretical knowledge is assessed through online modules and quizzes delivered through the academy's eLearning platform. Practical competency is assessed during supervised training sessions, where instructors observe each student's technique, hygiene practices, and overall procedural workflow.</p>
<p>Students must also submit portfolio documentation, including treatment practice records and before-and-after images from supervised procedures. Certification is awarded only when students have successfully completed all theoretical modules, participated in required practical training, and demonstrated competency in the techniques taught.</p>""",
}


# ---------------------------------------------------------------------------
# Supplementary content for the thin tiers (not in the manual)
# ---------------------------------------------------------------------------

SUPPLEMENTARY_BODIES = {
    # Master Artist supplementary
    "advanced_color_correction": """<p>Color correction is the art of neutralising unwanted hues from pigment that has aged poorly. Old PMU work can heal into blue-grey, green, or warm red tones depending on the pigment's original formulation and the client's skin chemistry.</p>
<h4>Common discolouration patterns</h4>
<ul>
<li><strong>Blue-grey brows:</strong> usually from carbon-heavy black pigment placed too deep. Neutralise with orange / warm modifier.</li>
<li><strong>Red / orange brows:</strong> oxidised iron-oxide. Neutralise with a green or olive modifier.</li>
<li><strong>Green brows:</strong> result of pink-skewed pigment fading. Warm with a red-orange modifier.</li>
</ul>
<p>Before correcting, always perform a small patch test (1cm × 1cm) and observe healing for 6 weeks. Never assume the correction will land the first time — correction is iterative work, typically across 2-3 sessions spaced 8 weeks apart.</p>""",

    "complex_cases": """<p>The Master Artist is expected to handle cases that defeat less-experienced practitioners. The most common complex cases are severe facial asymmetry, scar tissue, alopecia (hair loss), and post-surgical reconstruction.</p>
<h4>Severe asymmetry</h4>
<p>When the underlying bone structure is markedly uneven, mapping must be done from facial landmarks alone — never from the existing (potentially uneven) brow hairs. Use the illusion of symmetry: a slightly shorter tail on the lower brow lifts it visually.</p>
<h4>Scar tissue</h4>
<p>Scarred skin retains pigment unpredictably. Reduce machine speed, use a shallower needle depth, and accept that 2-3 sessions may be needed for even coverage.</p>
<h4>Alopecia clients</h4>
<p>Clients with alopecia totalis or chemotherapy-induced hair loss benefit most from soft powder or ombré brows — hairstroke techniques look unnatural against a brow line with zero native hairs.</p>""",

    "touchup_mastery": """<p>Annual touch-ups maintain colour saturation and shape over time. A skilled Master Artist treats every touch-up as an opportunity to refine — not just to refresh.</p>
<h4>Annual assessment checklist</h4>
<ul>
<li>Photograph the brow under standardised lighting and compare to the original healed result.</li>
<li>Assess colour shift: has the pigment cooled? warmed? grown patchy?</li>
<li>Discuss any aesthetic changes the client wants (sometimes a face has matured into a slightly different shape).</li>
<li>Plan the touch-up: spot-fill faded areas, neutralise drift, then re-pass density only where needed.</li>
</ul>
<p>Resist the urge to "do more" on a touch-up. Less is almost always more — over-saturating a healed brow is the fastest way to lose a long-term client.</p>""",

    # Instructor Licensing supplementary
    "adult_learning": """<p>Adult learners differ from school-age students in important ways. They bring extensive life experience to the classroom, they need to see practical relevance immediately, and they are often self-directed.</p>
<h4>Malcolm Knowles' principles of andragogy</h4>
<ol>
<li><strong>Need to know:</strong> adults want to know <em>why</em> they're learning something before they engage.</li>
<li><strong>Self-concept:</strong> adults take responsibility for their own learning and resent being treated as children.</li>
<li><strong>Experience:</strong> adults' prior experience is a resource — incorporate it into discussion.</li>
<li><strong>Readiness:</strong> adults learn what they need to know to deal with real-life situations.</li>
<li><strong>Orientation to learning:</strong> task-centered, not subject-centered.</li>
<li><strong>Motivation:</strong> internal motivation (career progression, confidence) outweighs external.</li>
</ol>
<p>As an instructor, your job is less to "deliver content" and more to facilitate the learner's own construction of competence. Demonstrate, then guide, then step back.</p>""",

    "curriculum_design": """<p>Designing curriculum is the art of sequencing knowledge so that each lesson builds the foundation for the next. A well-designed course starts with the end in mind: what must the graduate be able to do?</p>
<h4>Backward design</h4>
<ol>
<li><strong>Identify outcomes:</strong> what specific competencies will the graduate demonstrate?</li>
<li><strong>Define assessments:</strong> what evidence proves the competency was achieved?</li>
<li><strong>Plan instruction:</strong> what content and practice gets the learner from zero to assessment-ready?</li>
</ol>
<h4>Lesson planning template</h4>
<ul>
<li>Objective (one sentence, observable behaviour)</li>
<li>Hook (the why — 2 minutes)</li>
<li>Demonstration (instructor shows — 10 minutes)</li>
<li>Guided practice (student does, instructor coaches — 20 minutes)</li>
<li>Independent practice (student does alone — variable)</li>
<li>Check for understanding (quick assessment — 5 minutes)</li>
</ul>""",

    "demonstration_supervision": """<p>The demonstration is the single most important teaching tool in a practical craft. Students learn more from one well-narrated demonstration than from twenty pages of theory.</p>
<h4>How to demonstrate</h4>
<ol>
<li><strong>Pre-frame:</strong> state what you're about to do and why before touching the tool.</li>
<li><strong>Slow it down:</strong> demonstrate at 50% of working speed so students can follow each movement.</li>
<li><strong>Narrate:</strong> say what your hand is doing, what your eye is checking, what your foot is doing on the pedal.</li>
<li><strong>Pause for questions:</strong> stop at natural break points and invite questions.</li>
<li><strong>Repeat at speed:</strong> do the same step at working speed so students see the target.</li>
</ol>
<h4>Supervising student procedures</h4>
<p>Stand close enough to intervene immediately but not so close that you crowd. Coach with your voice first ("watch your angle"), your hand second (gentle redirect), and take over only as a last resort. Every takeover undermines the student's confidence.</p>""",

    "student_assessment": """<p>Assessment exists to verify competency, not to gatekeep arbitrarily. A fair assessment is transparent (the student knows what's being measured), reliable (two assessors would score the same student the same way), and valid (it actually measures the competency in question).</p>
<h4>Practical assessment rubric</h4>
<p>For each procedure assess on a 5-point scale across these dimensions:</p>
<ul>
<li><strong>Hygiene:</strong> hand wash, glove change, sharps disposal, surface sanitation.</li>
<li><strong>Consultation:</strong> medical history check, consent capture, expectations setting.</li>
<li><strong>Mapping:</strong> symmetry, golden-ratio alignment, client approval before procedure.</li>
<li><strong>Technique:</strong> needle depth, machine speed, hand stability, layering control.</li>
<li><strong>Aftercare:</strong> clean-up, written instructions, follow-up appointment booked.</li>
</ul>
<h4>Giving feedback</h4>
<p>The "two-stars-and-a-wish" model works well for practical work: name two specific things the student did well, then one specific thing to improve next time. Always tie feedback to the rubric so it doesn't feel personal.</p>""",

    "mentorship": """<p>Certification day is not the end of the relationship — it's the beginning of an alumni network that protects your academy's reputation. Graduates carry your name; their long-term success is your long-term success.</p>
<h4>Ongoing mentorship structures</h4>
<ul>
<li><strong>30-60-90-day check-ins:</strong> scheduled calls in the first three months to troubleshoot real cases.</li>
<li><strong>Annual refresher:</strong> a one-day intensive each year covering new techniques, products, and regulatory changes.</li>
<li><strong>Private community:</strong> a closed group (Telegram, WhatsApp, or Discord) where alumni share work and ask each other questions, moderated by faculty.</li>
<li><strong>Case-review sessions:</strong> monthly group call where one alum presents a difficult case for collective troubleshooting.</li>
</ul>
<p>Healthy alumni networks generate the majority of word-of-mouth referrals for a training academy. Treat them as your most important marketing channel.</p>""",

    "instructor_ethics": """<p>Educators in regulated cosmetic procedures carry obligations beyond those of practising artists. The student is a future practitioner — every shortcut you take in their training becomes a risk to their future clients.</p>
<h4>Ethical responsibilities</h4>
<ul>
<li><strong>Do not pass students who are not competent.</strong> A diploma is a public claim of competence; issuing one to an unsafe graduate is a fraud on the public.</li>
<li><strong>Disclose limits of your own expertise.</strong> If a student asks about a technique you've never performed, say so and refer them onward.</li>
<li><strong>Maintain student records.</strong> Practice logs, assessment scores, and certifications must be retained for the legal retention period (typically 7 years in Ethiopia).</li>
<li><strong>Avoid conflicts of interest.</strong> If you sell pigments / machines that students must use, the conflict must be disclosed and ideally the requirement removed.</li>
<li><strong>Continuing professional development.</strong> Educators must demonstrate annual CPD — the field moves and so must you.</li>
</ul>""",
}


# ---------------------------------------------------------------------------
# Professional Bridal Makeup — lesson bodies (text drawn from the official
# Delta SPMU Academy "Professional Bridal Makeup Training Module" by Birikty
# Haile). Distinct curriculum from the permanent-makeup courses above.
# ---------------------------------------------------------------------------

BRIDAL_BODIES = {
    # Chapter 1 — Introduction
    "bridal_what": """<p>Bridal makeup is a specialised branch of makeup artistry focused on creating elegant, long-lasting, camera-ready beauty looks for wedding ceremonies and bridal events. Unlike everyday makeup, a bridal look must survive a full day of emotion, movement, embraces, photography, and changing light — from soft morning preparation through to evening reception.</p>
<p>The bridal artist designs for longevity and for the camera at the same time. Products are layered and set so the finished face reads flawless both to the naked eye and through a photographer's lens, while remaining comfortable for the client to wear for twelve hours or more.</p>""",

    "bridal_role": """<p>A professional bridal artist must manage far more than colour and brushes. On the wedding day you are responsible for timing, emotional pressure, client expectations, sanitation, photography readiness, and the overall luxury customer experience.</p>
<p>Timing is critical: the bride's makeup must be complete on schedule so the rest of the day can proceed. The artist absorbs stress rather than adding to it — staying calm, organised, and reassuring keeps the bridal party relaxed. Managing expectations through consultation and a trial session ensures there are no surprises on the day itself.</p>""",

    "bridal_mindset": """<p>Professionalism is the foundation of a successful bridal career. Students learn punctuality, clear communication, confidence, and the ability to maintain calm, positive energy throughout the high-pressure environment of wedding preparation.</p>
<ul>
<li><strong>Punctuality:</strong> arrive early, set up methodically, and build a time buffer into every booking.</li>
<li><strong>Communication:</strong> listen to the bride's vision and confirm it back clearly before you begin.</li>
<li><strong>Composure:</strong> weddings are emotional — a steady, reassuring artist is part of the luxury experience.</li>
</ul>""",

    # Chapter 2 — Hygiene, Sanitation & Safety
    "bridal_sanitation": """<p>Sanitation protects both the client and the artist and is non-negotiable in professional practice. Brushes must be cleaned and disinfected after every client. Cream products should never be applied to the face directly from the pan — they should be depotted onto a clean palette using a spatula to prevent cross-contamination between clients.</p>
<p>Use disposable applicators (mascara wands, lip wands, sponges) wherever possible and never "double-dip" a used applicator back into product. A bride should never share a tool or product with a previous client.</p>""",

    "bridal_workspace": """<p>A luxury bridal station is organised, clean, and well-lit. Students learn how to set up a professional workspace including balanced lighting, an orderly brush layout, disposable tools, a clean mirror, and a sanitation system within easy reach.</p>
<p>Lighting should mimic neutral daylight so that colour matching is accurate and the makeup looks correct in any environment. Tools are arranged in the order they will be used, keeping the workflow fast and unhurried, and the station is wiped down and reset between clients.</p>""",

    "bridal_health_safety": """<p>Client health and safety must be assessed before any product touches the skin. This lesson covers allergies, skin reactions, patch testing, eye safety, and the careful handling of sensitive skin.</p>
<p>During consultation, always ask about known allergies and past reactions to cosmetics or adhesives. When in doubt — particularly with lash glue or a new product — perform a patch test ahead of the wedding day. Keep products away from the waterline if a client has sensitive eyes, and stop immediately if any irritation appears.</p>""",

    # Chapter 3 — Skin Anatomy & Preparation
    "bridal_skin_types": """<p>Identifying the client's skin type is the first step toward a flawless, long-lasting base. The four main types behave very differently under makeup:</p>
<ul>
<li><strong>Dry skin</strong> lacks oil and hydration and can show flaking or cakiness — prioritise hydration and creamy formulas.</li>
<li><strong>Oily skin</strong> produces excess sebum and can cause makeup to slide — use mattifying primers and powders.</li>
<li><strong>Combination skin</strong> is oily in some areas (often the T-zone) and dry in others — treat each zone differently.</li>
<li><strong>Sensitive skin</strong> reacts easily to products — choose gentle, fragrance-free formulas and patch test.</li>
</ul>""",

    "bridal_skin_prep": """<p>Proper preparation creates a flawless base and dramatically increases makeup longevity. Bridal skin prep follows a clear sequence: cleanse, moisturise, and prime before any complexion product is applied.</p>
<p>Cleansing removes oil and residue so products grip the skin; moisturising restores balance and prevents the foundation from clinging to dry patches; priming creates a smooth, even canvas and helps makeup last through the day. Allow each layer a moment to absorb before moving to the next.</p>""",

    "bridal_product_layering": """<p>Applying complexion products in the correct order prevents separation, pilling, and cakiness. Students learn the logic of layering: skincare first, then primer, then base and complexion products, finishing with setting products.</p>
<p>A reliable order is: moisturiser → primer → foundation → concealer → cream products (contour/blush) → powder to set → powder products → setting spray. Cream layers go before powders; powders lock everything in place. Respecting this sequence is what keeps a bridal look intact for hours.</p>""",

    # Chapter 4 — Color Theory & Foundation Matching
    "bridal_undertones": """<p>Recognising undertone is the key to a foundation that disappears into the skin. Undertones fall into three families:</p>
<ul>
<li><strong>Warm:</strong> golden or yellow hues.</li>
<li><strong>Cool:</strong> pink, red, or bluish hues.</li>
<li><strong>Neutral:</strong> a balance of both.</li>
</ul>
<p>Matching the foundation's undertone to the client's prevents the base from looking ashy, orange, or grey once it has set and oxidised on the skin.</p>""",

    "bridal_foundation_matching": """<p>A correct foundation match is invisible. Students practise matching foundation along the jaw and blending toward the neck and chest under natural lighting, so the face and body read as one continuous tone in person and on camera.</p>
<p>Test a shade on the lower face rather than the hand or wrist, let it settle for a minute to account for oxidation, and check the match in daylight. The neck and décolletage must be considered as well — a face that is lighter or darker than the body is the most common and most photographed mistake.</p>""",

    "bridal_corrective_color": """<p>Colour correction uses complementary colours to neutralise unwanted tones before foundation. The core corrective principles are:</p>
<ul>
<li><strong>Green</strong> cancels redness (blemishes, rosacea, irritation).</li>
<li><strong>Orange / peach</strong> neutralises dark circles and hyperpigmentation on deeper skin tones.</li>
<li><strong>Yellow</strong> brightens dullness and counteracts mild purple tones.</li>
</ul>
<p>Apply correctors sparingly and only where needed, then layer foundation and concealer on top for a seamless, natural finish.</p>""",

    # Chapter 5 — Face Shapes & Sculpting
    "bridal_face_analysis": """<p>Reading the face shape guides where contour and highlight are placed. Oval, round, square, heart, long, and diamond shapes each call for different sculpting to bring the face into balance.</p>
<p>The goal is never to "change" the bride but to enhance her natural structure — softening or defining where the photographer's lens and the day's lighting will benefit most. Analyse the face in good light before choosing a contour map.</p>""",

    "bridal_contouring": """<p>Contour defines facial structure while keeping a soft, romantic bridal finish. Students learn both cream and powder techniques and when to use each.</p>
<p>Cream contour, applied before powder, melts into the skin for the most natural sculpt and suits drier or mature skin; powder contour layered over a set base gives more control and longevity on oily skin. Whatever the medium, the rule for bridal is restraint and seamless blending — structure should be felt, not seen.</p>""",

    "bridal_blush": """<p>Blush placement changes the entire impression of the face, and the chosen effect depends on the bridal look:</p>
<ul>
<li><strong>Youthful:</strong> blush on the apples of the cheeks.</li>
<li><strong>Lifted:</strong> blush swept higher toward the cheekbone and temple.</li>
<li><strong>Soft glam:</strong> a diffused wash blended with the highlight.</li>
<li><strong>Dramatic:</strong> a deeper, more sculpted placement under the cheekbone.</li>
</ul>
<p>Build colour gradually and blend the edges so the flush looks like it comes from within.</p>""",

    # Chapter 6 — Eye Makeup Mastery
    "bridal_eye_shapes": """<p>Eye makeup must be tailored to the individual eye shape. Students learn how to flatter hooded eyes, almond eyes, monolids, downturned eyes, and protruding eyes — each of which responds differently to placement of shadow, liner, and lashes.</p>
<p>For example, hooded eyes benefit from shadow placed slightly above the natural crease so it remains visible when the eye is open, while downturned eyes are lifted by winging liner and shadow upward at the outer corner. Technique is practised on artificial skin, through self-application, and on live models, with photo or video documentation submitted for review.</p>""",

    "bridal_eye_looks": """<p>The bridal eye-look library gives the artist a range to match any bride and culture. Core looks include soft glam, smokey eyes, halo eyes, shimmer glam, matte elegance, and Arabic-inspired bridal styles.</p>
<p>Each look is a recipe of base, transition, definition, and accent shades, adjusted in intensity to suit the wedding style and the bride's comfort. Students learn to scale a look up for a dramatic evening reception or down for an intimate ceremony.</p>""",

    "bridal_lashes_liner": """<p>Lashes and eyeliner frame and finish the eye, and both are practised extensively. Students learn correct lash sizing, trimming the band to fit the eye, applying adhesive and waiting for the right tack, and placing the lash close to the natural lash line.</p>
<p>Eyeliner balance — matching wing length and thickness on both eyes, and adapting the line to the eye shape — is rehearsed until it is consistent and symmetrical. A well-fitted lash and balanced liner are what elevate a look from pretty to professional.</p>""",

    # Chapter 7 — Brow Perfection
    "bridal_brow_mapping": """<p>Symmetrical brows frame the entire face. Students learn brow mapping using facial measurements to find the ideal start, arch, and tail of each brow and to balance the two sides.</p>
<p>Mapping references fixed facial landmarks rather than the existing (often uneven) brow hairs, so the finished brows are balanced even when the natural brows are not. The mapped shape is reviewed before any colour is committed.</p>""",

    "bridal_brow_styles": """<p>Brow intensity is matched to the bride and the look. Different bridal styles call for different brow finishes — from soft, natural, feathered brows to fully defined, structured brows.</p>
<p>A natural bride suits a lightly filled, fluffy brow; a full-glam bride can carry a sharper, more defined brow with a crisp tail. The brow should always agree with the rest of the face: soft makeup pairs with soft brows, dramatic makeup with defined brows.</p>""",

    "bridal_brow_longwear": """<p>Bridal brows must last the entire day without fading or smudging. Long-wear brows are built by layering products: a tinted gel or pomade for shape, powder for soft fill, and a pencil for crisp hair-like strokes, finished with a clear or tinted setting gel.</p>
<p>Layering creates depth and dimension while locking the brow in place through heat, tears, and touch — exactly what a wedding day demands.</p>""",

    # Chapter 8 — Bridal Makeup Styles
    "bridal_soft_glam": """<p>Soft glam is the most requested modern bridal style. It focuses on neutral tones, radiant skin, and soft definition — polished and elegant without being heavy.</p>
<p>The base is luminous rather than matte, the eyes use warm neutral shades with a touch of shimmer, and definition is added with soft liner and natural-looking lashes. The result reads beautifully both in person and on camera.</p>""",

    "bridal_full_glam": """<p>Luxury full glam is the high-impact bridal style for brides who want drama. It features intense eye definition, stronger contour, bold lashes, and a flawless, fully sculpted base.</p>
<p>Even at maximum intensity, blending remains the priority — full glam should look rich and intentional, never muddy or harsh. This style photographs powerfully and suits grand evening receptions.</p>""",

    "bridal_natural": """<p>Natural bridal makeup enhances the bride's features while maintaining a minimal-makeup appearance. The goal is a fresh, "your-skin-but-better" finish that still holds up for photography and a long day.</p>
<p>Skin looks like skin, brows and lashes are softly defined, and colour is kept close to the bride's natural tones. Achieving a convincing natural look actually requires excellent prep and product control — there is nowhere to hide.</p>""",

    # Chapter 9 — Consultation & Client Experience
    "bridal_consultation": """<p>The consultation aligns the artist and the bride before the wedding. It is used to identify bridal preferences, allergies, the wedding theme, and the bride's makeup expectations.</p>
<p>Use reference images, discuss skin concerns and any sensitivities, and note the dress, venue, and time of day so the look suits the whole event. A clear consultation prevents misunderstandings and builds the bride's confidence in you.</p>""",

    "bridal_trial": """<p>A trial session is a rehearsal of the wedding-day look. It allows the artist to test makeup styles, confirm colour and longevity, and make adjustments before the day itself.</p>
<p>During the trial, photograph the look in different lighting, ask the bride to wear it for several hours to check wear and comfort, and refine the design together. By the wedding day there should be no surprises — only execution.</p>""",

    "bridal_luxury_exp": """<p>The luxury experience is what turns a bride into a referral. Beyond the makeup itself, the artist provides hospitality, calming communication, a touch-up kit, and excellent time management.</p>
<p>Small touches — a tidy station, a warm and unhurried manner, a prepared touch-up kit handed to the bridal party, and finishing exactly on schedule — create the premium feeling that justifies premium pricing and earns word-of-mouth.</p>""",

    # Chapter 10 — Photography & Social Media
    "bridal_photography": """<p>Bridal makeup is created to be photographed. Students learn flashback prevention — avoiding products with high SPF or heavy light-reflecting particles in areas hit by flash — and how to balance makeup so it looks correct both on camera and in real life.</p>
<p>Strategic use of matte and luminous products controls how the face catches light, ensuring the bride looks flawless in flash photography, natural daylight, and video alike.</p>""",

    "bridal_content": """<p>Content creation is a core business skill for the modern bridal artist. Students learn phone camera angles, lighting, recording short-form reels, and shooting before-and-after transitions that showcase their work.</p>
<p>Good lighting and consistent angles let an artist build a professional social-media presence using only a phone — turning everyday bookings into marketing assets.</p>""",

    "bridal_portfolio": """<p>A strong portfolio wins bookings. Students learn to build a bridal portfolio using professional editing, consistent branding, and a curated selection of their best work.</p>
<p>Consistency in editing style, framing, and presentation makes a portfolio look cohesive and premium. The portfolio is the artist's most powerful sales tool and should be refined continuously as new work is created.</p>""",

    # Chapter 11 — Business & Branding
    "bridal_pricing": """<p>Pricing bridal services correctly is essential to a sustainable business. Students learn to build pricing structures based on skill level, product cost, time required, travel, and the luxury of the experience offered.</p>
<p>Bridal pricing should account for the trial, the wedding-day timing, party members, and the premium nature of the service — not just an hourly rate. Confident, transparent pricing signals professionalism.</p>""",

    "bridal_marketing": """<p>Marketing builds a steady stream of bridal bookings. The lesson covers Instagram branding, TikTok growth, referrals, partnerships with wedding vendors, and maintaining a consistent online presence.</p>
<p>Bridal partnerships — with photographers, planners, and venues — are among the most reliable sources of high-quality referrals. A consistent brand across platforms makes the artist memorable and easy to recommend.</p>""",

    "bridal_retention": """<p>Client retention turns one wedding into a long relationship and a stream of referrals. Professional communication and thoughtful after-service follow-up increase repeat bookings and word-of-mouth.</p>
<p>A thank-you message, a request for a review, and staying in touch for future events (anniversaries, family weddings, events) keep an artist top-of-mind. In a referral-driven industry, the experience after the service matters as much as the service itself.</p>""",

    # Chapter 12 — Final Live Bridal Demonstration
    "bridal_transformation": """<p>The final assessment is a complete bridal transformation performed under timed conditions. The student executes a full bridal look from prep to finish, demonstrating command of every skill in the program within a realistic time limit.</p>
<p>This mirrors the real wedding-day environment: a fixed schedule, a single flawless result, and the composure to deliver it calmly.</p>""",

    "bridal_photoshoot": """<p>The professional photoshoot stage proves the makeup performs on camera. Students prepare a model for professional bridal photography and confirm that the look reads beautifully through the lens.</p>
<p>This step ties together the photography, styling, and technical lessons — the finished face must satisfy both the eye in the room and the final photographs.</p>""",

    "bridal_certification": """<p>Certification is awarded against clear, professional standards. Assessment is based on hygiene, blending, symmetry, professionalism, timing, and the final result.</p>
<h4>Assessment weighting</h4>
<ol>
<li>Theory Examination — 20%</li>
<li>Practical Assignments — 30%</li>
<li>Portfolio Submission — 20%</li>
<li>Final Live Model Assessment — 30%</li>
</ol>
<h4>Professional bridal kit essentials</h4>
<p>A complete kit includes a foundation palette, concealers and correctors, loose and pressed powders, cream and powder contour, eyeshadow palettes, professional brushes, disposable mascara wands, beauty sponges, setting spray, false lashes and adhesive, lip liners and lipsticks, and brush cleaner and disinfectant.</p>""",
}


# ---------------------------------------------------------------------------
# Course definitions
# ---------------------------------------------------------------------------

def L(title, body_key):
    """Shortcut for building a lesson record."""
    body = (
        LESSON_BODIES.get(body_key)
        or SUPPLEMENTARY_BODIES.get(body_key)
        or BRIDAL_BODIES.get(body_key)
    )
    if body is None:
        raise KeyError(f"No body for key '{body_key}'")
    return {"title": title, "body": body}


COURSES = [
    # -----------------------------------------------------------------------
    # 1. Foundation Certification
    # -----------------------------------------------------------------------
    {
        "title": "Foundation Certification",
        "image": "/images/course-foundation.jpg",
        "short_introduction": (
            "Build the core knowledge every SPMU artist needs before touching skin: "
            "anatomy, hygiene, color theory, brow mapping, and machine fundamentals."
        ),
        "description": """<p><strong>Foundation Certification</strong> is the entry point for new SPMU artists. No prior experience is required.</p>
<p>By the end of this course you will:</p>
<ul>
<li>Understand the three layers of the skin and the depth at which pigment must be implanted.</li>
<li>Identify all six Fitzpatrick skin types and adjust technique accordingly.</li>
<li>Maintain a fully compliant sterile workstation.</li>
<li>Select pigments that harmonise with the client's undertone.</li>
<li>Map a balanced brow on any of the six face shapes.</li>
<li>Operate a PMU machine with the correct settings and needle configurations.</li>
<li>Recognise and avoid the four most common beginner mistakes.</li>
</ul>""",
        "chapters": [
            {
                "title": "Skin Anatomy & Healing Science",
                "lessons": [
                    L("Skin Anatomy", "skin_anatomy"),
                    L("Fitzpatrick Skin Types", "fitzpatrick"),
                    L("Healing Science", "healing_science"),
                ],
                "quiz": {
                    "title": "Skin Anatomy & Healing Quiz",
                    "questions": [
                        {
                            "question": "Into which skin layer is SPMU pigment correctly implanted?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Epidermis (outermost layer)", "is_correct": 0},
                                {"option": "Upper dermis (just beneath the epidermis)", "is_correct": 1},
                                {"option": "Subcutaneous layer", "is_correct": 0},
                                {"option": "Hypodermis", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Which Fitzpatrick skin type carries the highest risk of keloid scarring?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Type I — Very Fair Skin", "is_correct": 0},
                                {"option": "Type III — Medium / Beige", "is_correct": 0},
                                {"option": "Type IV — Olive Skin", "is_correct": 0},
                                {"option": "Type VI — Deep Brown / Black Skin", "is_correct": 1},
                            ],
                        },
                        {
                            "question": "Which of the following are normal during the healing window? (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Mild redness in the first 24-48 hours", "is_correct": 1},
                                {"option": "Light scabbing / flaking", "is_correct": 1},
                                {"option": "Pigment appearing lighter as the skin regenerates", "is_correct": 1},
                                {"option": "Bleeding heavier than menstrual flow", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Why is the upper dermis specifically the target depth?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "It heals faster than other layers.", "is_correct": 0},
                                {"option": "It retains pigment visibly while still allowing gradual fade.", "is_correct": 1},
                                {"option": "It has the most blood vessels.", "is_correct": 0},
                                {"option": "It is the only sterile layer of the skin.", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Hygiene & Infection Control Protocol",
                "lessons": [
                    L("Hygiene Standards", "hygiene"),
                    L("Infection Control Protocol", "infection_control"),
                ],
                "quiz": {
                    "title": "Hygiene & Infection Control Quiz",
                    "questions": [
                        {
                            "question": "Which items must always be single-use and discarded after every client?",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Needle cartridges", "is_correct": 1},
                                {"option": "Pigment rings", "is_correct": 1},
                                {"option": "Gloves", "is_correct": 1},
                                {"option": "The PMU machine body", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Used needles and cartridges must be disposed of in:",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "The regular bin lined with a plastic bag", "is_correct": 0},
                                {"option": "An approved sharps disposal container", "is_correct": 1},
                                {"option": "The autoclave for re-sterilisation", "is_correct": 0},
                                {"option": "A sealed envelope mailed to the supplier", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "When must hand hygiene be performed?",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Before gloving up", "is_correct": 1},
                                {"option": "Between tasks during the procedure", "is_correct": 1},
                                {"option": "After degloving at the end", "is_correct": 1},
                                {"option": "Only once at the start of the day", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Color Theory & Pigment Selection",
                "lessons": [
                    L("Color Theory", "color_theory"),
                    L("Pigment Selection", "pigment_selection"),
                ],
                "quiz": {
                    "title": "Color Theory & Pigment Quiz",
                    "questions": [
                        {
                            "question": "A client has a cool (pink-toned) undertone. Which pigment family is most likely to heal naturally on them?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "A warm ash-brown with a yellow-orange base", "is_correct": 1},
                                {"option": "A cool blue-black", "is_correct": 0},
                                {"option": "A pure carbon black", "is_correct": 0},
                                {"option": "A grey-toned taupe", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "How does a healed pigment usually compare to the colour seen at the end of the procedure?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Brighter and more saturated", "is_correct": 0},
                                {"option": "Identical", "is_correct": 0},
                                {"option": "Slightly softer or cooler", "is_correct": 1},
                                {"option": "Always shifts to green", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Why does a deeper skin tone often require a more saturated pigment?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Deeper skin heals more slowly.", "is_correct": 0},
                                {"option": "Deeper skin filters the visible pigment and requires more density for visibility and retention.", "is_correct": 1},
                                {"option": "Deeper skin rejects black pigments entirely.", "is_correct": 0},
                                {"option": "Deeper skin is always cool-toned.", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Face Shape & Brow Mapping",
                "lessons": [
                    L("Face Shapes", "face_shapes"),
                    L("The Golden Ratio Mapping System", "golden_ratio"),
                    L("Personalization & Facial Asymmetry Correction", "asymmetry"),
                    L("Mapping Tools & Pre-Drawing Process", "mapping_tools"),
                ],
                "quiz": {
                    "title": "Face Shape & Brow Mapping Quiz",
                    "questions": [
                        {
                            "question": "The arch point of the brow should align with which facial landmark?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "The inner corner of the eye", "is_correct": 0},
                                {"option": "The outer iris of the eye", "is_correct": 1},
                                {"option": "The outer corner of the eye", "is_correct": 0},
                                {"option": "The tip of the nose", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Which face shape is best balanced by a flat or low-arch brow?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Round", "is_correct": 0},
                                {"option": "Heart", "is_correct": 0},
                                {"option": "Long / Rectangular", "is_correct": 1},
                                {"option": "Square", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "The 'golden rule' of brow mapping states:",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Both brows must be perfectly identical.", "is_correct": 0},
                                {"option": "The tail should never fall below the head of the brow.", "is_correct": 1},
                                {"option": "The arch must always be exactly above the pupil.", "is_correct": 0},
                                {"option": "Every brow should be the same length as the eye.", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Which steps belong in the pre-drawing process? (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Clean the skin", "is_correct": 1},
                                {"option": "Mark the facial centerline", "is_correct": 1},
                                {"option": "Show and discuss the design with the client before pigment", "is_correct": 1},
                                {"option": "Skip the consultation if the client is in a hurry", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Machine & Needle Knowledge",
                "lessons": [
                    L("Machine & Needle Fundamentals", "machine_needle"),
                ],
                "quiz": {
                    "title": "Machine & Needle Quiz",
                    "questions": [
                        {
                            "question": "Which needle configuration is best suited to soft shading techniques like ombré or powder brows?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "1-prong nano liner", "is_correct": 0},
                                {"option": "Magnum / shader", "is_correct": 1},
                                {"option": "Round liner with 3 prongs", "is_correct": 0},
                                {"option": "Flat tip with no shading capability", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Machine settings that the practitioner must adjust per technique include: (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Speed", "is_correct": 1},
                                {"option": "Needle depth", "is_correct": 1},
                                {"option": "Pressure / hand-down force", "is_correct": 1},
                                {"option": "The colour of the machine casing", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Common Beginner Mistakes",
                "lessons": [
                    L("Common Mistakes & How to Avoid Them", "beginner_mistakes"),
                ],
                "quiz": {
                    "title": "Common Mistakes Quiz",
                    "questions": [
                        {
                            "question": "Pigment placed too superficially in the epidermis tends to:",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Stay visible for life", "is_correct": 0},
                                {"option": "Fade quickly as the skin exfoliates", "is_correct": 1},
                                {"option": "Spread and blur", "is_correct": 0},
                                {"option": "Become permanently darker", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "What is the recommended approach to building pigment density?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Saturate the skin in one heavy pass", "is_correct": 0},
                                {"option": "Build colour through gradual, controlled layering", "is_correct": 1},
                                {"option": "Press as hard as possible on the first pass", "is_correct": 0},
                                {"option": "Skip layering on darker skin types", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
        ],
    },

    # -----------------------------------------------------------------------
    # 2. Advanced Certification
    # -----------------------------------------------------------------------
    {
        "title": "Advanced Certification",
        "image": "/images/course-advanced.jpg",
        "short_introduction": (
            "Master the four signature brow techniques — ombré, nano, combo, and powder — "
            "and refine your hand control through structured artificial-skin practice."
        ),
        "description": """<p><strong>Advanced Certification</strong> picks up where Foundation leaves off. You will study the theory of all four signature brow looks and develop hand control through structured drills before progressing to live models.</p>
<p>By the end of this course you will:</p>
<ul>
<li>Explain the underlying technique behind ombré, nano, combo, and powder brows.</li>
<li>Match each technique to the appropriate skin type and client preference.</li>
<li>Perform daily artificial-skin drills targeting line work, shading, and gradient control.</li>
</ul>""",
        "chapters": [
            {
                "title": "Ombré Brow Technique Theory",
                "lessons": [L("Ombré Brow Theory", "ombre_theory")],
                "quiz": {
                    "title": "Ombré Brow Quiz",
                    "questions": [
                        {
                            "question": "Ombré brows produce their gradient effect through:",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Individual hair-like strokes", "is_correct": 0},
                                {"option": "Pixelated shading deposited in controlled layers", "is_correct": 1},
                                {"option": "A single saturated pass", "is_correct": 0},
                                {"option": "Manual blading without a machine", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Where on the brow is pigment saturation kept lightest?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "The inner / front portion", "is_correct": 1},
                                {"option": "The arch", "is_correct": 0},
                                {"option": "The tail", "is_correct": 0},
                                {"option": "Above the arch", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Nano Brows Theory",
                "lessons": [L("Nano Brow Theory", "nano_theory")],
                "quiz": {
                    "title": "Nano Brow Quiz",
                    "questions": [
                        {
                            "question": "How do nano brows differ from traditional microblading?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Nano brows use a manual blade; microblading uses a machine.", "is_correct": 0},
                                {"option": "Nano brows are performed with a machine and a very fine needle, not a blade.", "is_correct": 1},
                                {"option": "Nano brows do not require pigment.", "is_correct": 0},
                                {"option": "Nano brows can only be done on dry skin.", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Nano brows tend to be more suitable than manual microblading for which clients?",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Oily skin", "is_correct": 1},
                                {"option": "Sensitive skin", "is_correct": 1},
                                {"option": "Skin types that struggle to retain manual-blade strokes", "is_correct": 1},
                                {"option": "Skin with active infection", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Combo Brows Theory",
                "lessons": [L("Combo Brow Theory", "combo_theory")],
                "quiz": {
                    "title": "Combo Brow Quiz",
                    "questions": [
                        {
                            "question": "Combo brows combine which two techniques?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Powder brows + microblading", "is_correct": 0},
                                {"option": "Hairstrokes + shading", "is_correct": 1},
                                {"option": "Lip blush + eyeliner", "is_correct": 0},
                                {"option": "Ombré + nano only", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "In a combo brow, where are the hairstrokes typically placed?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Only along the tail", "is_correct": 0},
                                {"option": "In the front / upper section of the brow", "is_correct": 1},
                                {"option": "Below the arch only", "is_correct": 0},
                                {"option": "Across the entire brow uniformly", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Powder Brows Theory",
                "lessons": [L("Powder Brow Theory", "powder_theory")],
                "quiz": {
                    "title": "Powder Brow Quiz",
                    "questions": [
                        {
                            "question": "What kind of finish do powder brows produce when fully healed?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "A sharp, hairstroke-like finish", "is_correct": 0},
                                {"option": "A soft, velvety, filled-in-makeup look", "is_correct": 1},
                                {"option": "A bright neon gradient", "is_correct": 0},
                                {"option": "A flat block of solid colour", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Powder brows are particularly suitable for clients with: (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Oily skin", "is_correct": 1},
                                {"option": "Mature skin", "is_correct": 1},
                                {"option": "Skin that does not retain individual hairstrokes well", "is_correct": 1},
                                {"option": "Active acne in the brow area", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Artificial Skin Practice Drills",
                "lessons": [L("Practice Drill Fundamentals", "artificial_skin")],
                "quiz": {
                    "title": "Practice Drills Quiz",
                    "questions": [
                        {
                            "question": "Which skills are developed by artificial-skin practice? (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Line control", "is_correct": 1},
                                {"option": "Shading patterns", "is_correct": 1},
                                {"option": "Pixel placement and gradient building", "is_correct": 1},
                                {"option": "Tax accounting for the studio", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Artificial-skin practice should happen:",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Only on the first day of training", "is_correct": 0},
                                {"option": "Daily during the foundation phase to build muscle memory", "is_correct": 1},
                                {"option": "Once a year as a refresher", "is_correct": 0},
                                {"option": "Only after the first live model", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
        ],
    },

    # -----------------------------------------------------------------------
    # 3. Master Artist Program
    # -----------------------------------------------------------------------
    {
        "title": "Master Artist Program",
        "image": "/images/course-master.jpg",
        "short_introduction": (
            "Real-client mastery: consultation, live models, healing protocols, advanced "
            "colour correction, and complex case management."
        ),
        "description": """<p><strong>Master Artist</strong> is for certified practitioners who already work on clients and want to take on the difficult cases that defeat less-experienced artists.</p>
<p>By the end of this course you will:</p>
<ul>
<li>Conduct a thorough, legally-compliant client consultation.</li>
<li>Perform supervised live-model procedures with confidence.</li>
<li>Guide clients through healing and touch-up cycles.</li>
<li>Correct mis-aged PMU work — blue-grey, red, green discolouration.</li>
<li>Handle complex cases including severe asymmetry, scar tissue, and alopecia.</li>
<li>Treat every annual touch-up as a refinement opportunity, not just a refresh.</li>
</ul>""",
        "chapters": [
            {
                "title": "Client Consultation & Documentation",
                "lessons": [L("Consultation & Documentation", "consultation")],
                "quiz": {
                    "title": "Consultation Quiz",
                    "questions": [
                        {
                            "question": "Before beginning treatment, the client must complete and sign: (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Medical history form", "is_correct": 1},
                                {"option": "Informed consent form", "is_correct": 1},
                                {"option": "Treatment record", "is_correct": 1},
                                {"option": "A non-disclosure agreement about the studio's pigment brand", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Maintaining accurate treatment records supports:",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Consistency for future touch-ups", "is_correct": 1},
                                {"option": "Professional accountability", "is_correct": 1},
                                {"option": "Legal record-keeping requirements", "is_correct": 1},
                                {"option": "Public social-media bragging", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Live Model Procedure Guide",
                "lessons": [L("Live Model Procedure", "live_model")],
                "quiz": {
                    "title": "Live Model Quiz",
                    "questions": [
                        {
                            "question": "What must be completed before pigment implantation begins on a live model?",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Signed consent and medical history review", "is_correct": 1},
                                {"option": "Workstation disinfection and sterile setup", "is_correct": 1},
                                {"option": "Brow mapping with client approval", "is_correct": 1},
                                {"option": "Posting before-and-after photos publicly", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "An instructor supervising a student's live-model procedure should primarily:",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Take over the machine the moment the student hesitates", "is_correct": 0},
                                {"option": "Coach with voice cues first, hand redirects second, takeover only as a last resort", "is_correct": 1},
                                {"option": "Leave the room so the student can build independence", "is_correct": 0},
                                {"option": "Make jokes about the client to reduce tension", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Healing & Touch-Up Protocol",
                "lessons": [L("Healing & Touch-Up", "healing_touchup")],
                "quiz": {
                    "title": "Healing & Touch-Up Quiz",
                    "questions": [
                        {
                            "question": "Why is a touch-up session typically recommended several weeks after the initial procedure?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "To increase revenue per client", "is_correct": 0},
                                {"option": "To refine shape, reinforce colour, and correct any uneven retention", "is_correct": 1},
                                {"option": "To remove all the pigment that healed in", "is_correct": 0},
                                {"option": "Touch-ups are not actually recommended", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Client aftercare instructions should include: (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Keep the area clean and dry", "is_correct": 1},
                                {"option": "Avoid excessive moisture (hot showers, sweating, swimming) until healed", "is_correct": 1},
                                {"option": "Do not pick or scratch scabbing", "is_correct": 1},
                                {"option": "Rub the brows daily to settle the pigment", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Advanced Color Correction",
                "lessons": [L("Correcting Mis-Aged PMU Work", "advanced_color_correction")],
                "quiz": {
                    "title": "Color Correction Quiz",
                    "questions": [
                        {
                            "question": "Brows that have healed to a blue-grey tone are usually best neutralised with a modifier in which family?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Cool blue", "is_correct": 0},
                                {"option": "Warm orange", "is_correct": 1},
                                {"option": "Green", "is_correct": 0},
                                {"option": "Pink", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Realistic expectations for colour correction work include: (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Multiple sessions spaced several weeks apart", "is_correct": 1},
                                {"option": "Patch testing before a full correction", "is_correct": 1},
                                {"option": "A single perfect result in one session", "is_correct": 0},
                                {"option": "Documenting every stage with photographs", "is_correct": 1},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Complex Cases",
                "lessons": [L("Severe Asymmetry, Scarring & Alopecia", "complex_cases")],
                "quiz": {
                    "title": "Complex Cases Quiz",
                    "questions": [
                        {
                            "question": "When mapping severe facial asymmetry, the artist should:",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Follow whatever brow hair the client has", "is_correct": 0},
                                {"option": "Reference facial bone landmarks, then design for the illusion of symmetry", "is_correct": 1},
                                {"option": "Use identical measurements on both sides regardless of structure", "is_correct": 0},
                                {"option": "Refuse to treat the client", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Which technique tends to look most natural on an alopecia client with no native brow hairs?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Pure hairstroke", "is_correct": 0},
                                {"option": "Soft powder or ombré", "is_correct": 1},
                                {"option": "Microblading only", "is_correct": 0},
                                {"option": "Aggressive saturation on the first pass", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Touch-Up Mastery",
                "lessons": [L("Annual Touch-Up Assessment & Refinement", "touchup_mastery")],
                "quiz": {
                    "title": "Touch-Up Mastery Quiz",
                    "questions": [
                        {
                            "question": "The annual touch-up assessment should include:",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Standardised-lighting photographs", "is_correct": 1},
                                {"option": "Colour-shift assessment vs the original healed result", "is_correct": 1},
                                {"option": "Client conversation about aesthetic changes desired", "is_correct": 1},
                                {"option": "Re-pigmenting the entire brow regardless of retention", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "What is the master's rule for touch-up density?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Always saturate fully — it heals 50% lighter anyway", "is_correct": 0},
                                {"option": "Less is more — re-pass density only where it has actually faded", "is_correct": 1},
                                {"option": "Replace the entire brow design every visit", "is_correct": 0},
                                {"option": "Never re-pigment, only refresh shape", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
        ],
    },

    # -----------------------------------------------------------------------
    # 4. Instructor Licensing
    # -----------------------------------------------------------------------
    {
        "title": "Instructor Licensing",
        "image": "/images/course-instructor.jpg",
        "short_introduction": (
            "Train to become a Delta SPMU Academy educator. Adult-learning theory, "
            "curriculum design, demonstration craft, student assessment, mentorship, "
            "business fundamentals, and educator ethics."
        ),
        "description": """<p><strong>Instructor Licensing</strong> qualifies senior practitioners to teach the next generation of SPMU artists. This course assumes you have already mastered the technical craft — its focus is the discipline of <em>teaching</em>.</p>
<p>By the end of this course you will:</p>
<ul>
<li>Apply adult-learning principles to your classroom.</li>
<li>Design backward-engineered curricula and individual lesson plans.</li>
<li>Demonstrate procedures in a way students can actually replicate.</li>
<li>Supervise live-model procedures with minimal but well-timed intervention.</li>
<li>Assess student competency fairly and reliably.</li>
<li>Build long-term alumni networks and ongoing mentorship.</li>
<li>Operate a profitable SPMU academy in line with educator ethics.</li>
</ul>""",
        "chapters": [
            {
                "title": "Business & Branding Fundamentals",
                "lessons": [L("Business & Branding", "business_branding")],
                "quiz": {
                    "title": "Business & Branding Quiz",
                    "questions": [
                        {
                            "question": "Which of the following contribute most to long-term client trust?",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Consistently high hygiene standards", "is_correct": 1},
                                {"option": "Transparent pricing", "is_correct": 1},
                                {"option": "Clear aftercare guidance", "is_correct": 1},
                                {"option": "Discounting heavily on the first visit", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Where do most repeat clients in a healthy SPMU practice come from?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Cold paid advertising", "is_correct": 0},
                                {"option": "Word-of-mouth referrals from satisfied existing clients", "is_correct": 1},
                                {"option": "Buying email lists", "is_correct": 0},
                                {"option": "Random walk-ins", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Adult Learning Theory",
                "lessons": [L("How Adults Learn (Andragogy)", "adult_learning")],
                "quiz": {
                    "title": "Adult Learning Quiz",
                    "questions": [
                        {
                            "question": "Adult learners differ from school-age learners in which of these ways? (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "They bring significant prior life experience", "is_correct": 1},
                                {"option": "They need to see practical relevance quickly", "is_correct": 1},
                                {"option": "They are often self-directed", "is_correct": 1},
                                {"option": "They prefer being told exactly what to think", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "The instructor's role in an adult-learning classroom is best described as:",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "A pure content-delivery channel", "is_correct": 0},
                                {"option": "A facilitator of the learner's own construction of competence", "is_correct": 1},
                                {"option": "An authority figure who punishes mistakes", "is_correct": 0},
                                {"option": "A passive observer", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Curriculum Design & Lesson Planning",
                "lessons": [L("Backward Design & Lesson Templates", "curriculum_design")],
                "quiz": {
                    "title": "Curriculum Design Quiz",
                    "questions": [
                        {
                            "question": "What is the correct order of steps in backward design?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Plan instruction → identify outcomes → define assessments", "is_correct": 0},
                                {"option": "Identify outcomes → define assessments → plan instruction", "is_correct": 1},
                                {"option": "Define assessments → plan instruction → identify outcomes", "is_correct": 0},
                                {"option": "Plan instruction → define assessments → identify outcomes", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "A well-structured single lesson typically includes: (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Hook / motivation", "is_correct": 1},
                                {"option": "Instructor demonstration", "is_correct": 1},
                                {"option": "Guided practice with coaching", "is_correct": 1},
                                {"option": "Three hours of uninterrupted lecture", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Demonstration & Supervision Techniques",
                "lessons": [L("Demonstrating Craft & Supervising Practice", "demonstration_supervision")],
                "quiz": {
                    "title": "Demonstration & Supervision Quiz",
                    "questions": [
                        {
                            "question": "At what speed should the first demonstration of a new technique typically be performed?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Full working speed so the student sees it real", "is_correct": 0},
                                {"option": "About 50% of working speed, with narration", "is_correct": 1},
                                {"option": "As fast as possible to save time", "is_correct": 0},
                                {"option": "Without narration so the student stays focused", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "When a student begins to struggle mid-procedure, the supervising instructor should:",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Immediately take over the machine", "is_correct": 0},
                                {"option": "Coach with voice first; physical redirect second; takeover only as a last resort", "is_correct": 1},
                                {"option": "Leave the student to figure it out alone", "is_correct": 0},
                                {"option": "Reprimand the student in front of the client", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Student Assessment & Feedback",
                "lessons": [L("Rubrics & Effective Feedback", "student_assessment")],
                "quiz": {
                    "title": "Student Assessment Quiz",
                    "questions": [
                        {
                            "question": "A fair practical assessment should be: (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Transparent — the student knows what's being measured", "is_correct": 1},
                                {"option": "Reliable — two assessors would score similarly", "is_correct": 1},
                                {"option": "Valid — it actually measures the competency in question", "is_correct": 1},
                                {"option": "Secret — students must not know the rubric in advance", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "The 'two-stars-and-a-wish' feedback model means:",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Two random compliments and a generic warning", "is_correct": 0},
                                {"option": "Two specific things the student did well, then one specific improvement for next time", "is_correct": 1},
                                {"option": "Two failing scores and one passing score", "is_correct": 0},
                                {"option": "Two lessons of lecture per practical wish", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Mentorship & Ongoing Development",
                "lessons": [L("Alumni Networks & Continuing Support", "mentorship")],
                "quiz": {
                    "title": "Mentorship Quiz",
                    "questions": [
                        {
                            "question": "Which structures support a healthy alumni network? (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Scheduled 30-60-90-day post-graduation check-ins", "is_correct": 1},
                                {"option": "Annual one-day refresher courses", "is_correct": 1},
                                {"option": "A moderated private community for alumni-only discussion", "is_correct": 1},
                                {"option": "Cutting all contact after certification day", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "What is the primary marketing channel of a healthy training academy?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Cold paid advertising", "is_correct": 0},
                                {"option": "Word-of-mouth referrals from satisfied alumni", "is_correct": 1},
                                {"option": "Email blasts to purchased lists", "is_correct": 0},
                                {"option": "Random social-media virality", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Educator Ethics & Responsibility",
                "lessons": [L("Professional Ethics for SPMU Educators", "instructor_ethics")],
                "quiz": {
                    "title": "Educator Ethics Quiz",
                    "questions": [
                        {
                            "question": "An educator who passes a clearly incompetent student is committing:",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "A minor administrative oversight", "is_correct": 0},
                                {"option": "A fraud on the public, who will be served by that graduate", "is_correct": 1},
                                {"option": "An act of mercy", "is_correct": 0},
                                {"option": "A neutral, victimless decision", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Which of the following are core ethical obligations of SPMU educators? (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Disclose any conflicts of interest (e.g. pigments the school sells)", "is_correct": 1},
                                {"option": "Maintain student records for the legal retention period", "is_correct": 1},
                                {"option": "Pursue annual continuing professional development", "is_correct": 1},
                                {"option": "Inflate pass rates to attract more enrolments", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Assessment & Certification Standards",
                "lessons": [L("Delta Academy Certification Framework", "assessment_cert")],
                "quiz": {
                    "title": "Certification Standards Quiz",
                    "questions": [
                        {
                            "question": "Delta SPMU certification is awarded only when the student has:",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Completed all theoretical modules", "is_correct": 1},
                                {"option": "Participated in required practical training", "is_correct": 1},
                                {"option": "Demonstrated competency in the techniques taught", "is_correct": 1},
                                {"option": "Paid an extra fee on top of the course price", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Portfolio documentation submitted by students for certification typically includes:",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Treatment practice records", "is_correct": 1},
                                {"option": "Before-and-after images from supervised procedures", "is_correct": 1},
                                {"option": "Signed consent forms", "is_correct": 1},
                                {"option": "Personal social-media analytics", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
        ],
    },

    # -----------------------------------------------------------------------
    # 5. Professional Bridal Makeup
    # -----------------------------------------------------------------------
    {
        "title": "Professional Bridal Makeup",
        "image": "/images/course-bridal.jpg",
        "short_introduction": (
            "Become a professional bridal makeup artist: skin prep, colour matching, "
            "sculpting, eyes, brows, bridal styles, consultation, photography, and "
            "the business of bridal beauty — finished with a timed live demonstration."
        ),
        "description": """<p><strong>Professional Bridal Makeup</strong> trains you to deliver elegant, long-lasting, camera-ready bridal looks across all skin tones, face shapes, bridal cultures, and lighting conditions — while providing a luxury client experience.</p>
<p>By the end of this course you will:</p>
<ul>
<li>Prepare any skin type for a flawless, long-wearing bridal base.</li>
<li>Match foundation and correct colour for a seamless, photo-ready complexion.</li>
<li>Sculpt and balance the face with contour, highlight, and blush.</li>
<li>Design eye looks and brows tailored to each eye and face shape.</li>
<li>Execute soft glam, full glam, and natural bridal styles.</li>
<li>Run professional consultations and trial sessions.</li>
<li>Create makeup that performs on camera and build a bridal portfolio and business.</li>
<li>Complete a full bridal transformation under timed assessment conditions.</li>
</ul>""",
        "chapters": [
            {
                "title": "Introduction to Professional Bridal Makeup",
                "lessons": [
                    L("What Is Bridal Makeup?", "bridal_what"),
                    L("Role of a Bridal Makeup Artist", "bridal_role"),
                    L("Professionalism & Artist Mindset", "bridal_mindset"),
                ],
                "quiz": {
                    "title": "Bridal Introduction Quiz",
                    "questions": [
                        {
                            "question": "What primarily distinguishes bridal makeup from everyday makeup?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "It must be long-lasting and camera-ready for a full event day", "is_correct": 1},
                                {"option": "It uses no foundation", "is_correct": 0},
                                {"option": "It is only ever applied in matte finishes", "is_correct": 0},
                                {"option": "It is always completed in under ten minutes", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Which responsibilities fall to a professional bridal artist on the wedding day? (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Managing timing so makeup finishes on schedule", "is_correct": 1},
                                {"option": "Maintaining sanitation", "is_correct": 1},
                                {"option": "Keeping calm and managing client expectations", "is_correct": 1},
                                {"option": "Choosing the wedding venue for the couple", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Hygiene, Sanitation & Safety",
                "lessons": [
                    L("Sanitation Standards", "bridal_sanitation"),
                    L("Workspace Preparation", "bridal_workspace"),
                    L("Health & Safety", "bridal_health_safety"),
                ],
                "quiz": {
                    "title": "Bridal Hygiene & Safety Quiz",
                    "questions": [
                        {
                            "question": "How should cream products be taken from the pan to avoid cross-contamination?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Applied directly from the pan to each client's face", "is_correct": 0},
                                {"option": "Depotted onto a clean palette with a spatula", "is_correct": 1},
                                {"option": "Scooped with a used finger", "is_correct": 0},
                                {"option": "Diluted with water first", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "When is a patch test most important?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Only for foundation", "is_correct": 0},
                                {"option": "Ahead of the wedding day for products like lash glue or when a client has sensitivities", "is_correct": 1},
                                {"option": "Never — patch tests are unnecessary for makeup", "is_correct": 0},
                                {"option": "Only on the wedding day itself", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "A professional bridal station should include: (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Neutral, daylight-balanced lighting", "is_correct": 1},
                                {"option": "Disposable tools within easy reach", "is_correct": 1},
                                {"option": "An organised brush layout and clean mirror", "is_correct": 1},
                                {"option": "Shared, unwashed brushes between clients", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Skin Anatomy & Skin Preparation",
                "lessons": [
                    L("Understanding Skin Types", "bridal_skin_types"),
                    L("Bridal Skin Preparation", "bridal_skin_prep"),
                    L("Product Layering", "bridal_product_layering"),
                ],
                "quiz": {
                    "title": "Bridal Skin Preparation Quiz",
                    "questions": [
                        {
                            "question": "What is the correct bridal skin-prep sequence before complexion products?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Cleanse → moisturise → prime", "is_correct": 1},
                                {"option": "Prime → cleanse → moisturise", "is_correct": 0},
                                {"option": "Moisturise → cleanse → prime", "is_correct": 0},
                                {"option": "Powder → cleanse → moisturise", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "In product layering, which products are applied before powders?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Cream products such as cream contour and blush", "is_correct": 1},
                                {"option": "Setting powder always goes first", "is_correct": 0},
                                {"option": "Powder blush before foundation", "is_correct": 0},
                                {"option": "Setting spray before foundation", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Oily skin is best supported by which approach?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Heavy facial oils only", "is_correct": 0},
                                {"option": "Mattifying primers and powders to control excess sebum", "is_correct": 1},
                                {"option": "Skipping primer entirely", "is_correct": 0},
                                {"option": "No setting products at all", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Color Theory & Foundation Matching",
                "lessons": [
                    L("Undertones", "bridal_undertones"),
                    L("Foundation Matching", "bridal_foundation_matching"),
                    L("Corrective Color Theory", "bridal_corrective_color"),
                ],
                "quiz": {
                    "title": "Bridal Color & Foundation Quiz",
                    "questions": [
                        {
                            "question": "Which corrector neutralises redness?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Green", "is_correct": 1},
                                {"option": "Orange", "is_correct": 0},
                                {"option": "Yellow", "is_correct": 0},
                                {"option": "Blue", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Where should a foundation shade be tested and checked?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "On the wrist under indoor light", "is_correct": 0},
                                {"option": "On the lower face, blended toward the neck, checked in natural light", "is_correct": 1},
                                {"option": "On the back of the hand only", "is_correct": 0},
                                {"option": "It does not matter where", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Match the corrector to its job: (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Orange/peach neutralises dark circles on deeper skin tones", "is_correct": 1},
                                {"option": "Yellow brightens dullness", "is_correct": 1},
                                {"option": "Green cancels redness", "is_correct": 1},
                                {"option": "Red brightens under-eyes on fair skin", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Face Shapes & Bridal Sculpting",
                "lessons": [
                    L("Face Shape Analysis", "bridal_face_analysis"),
                    L("Contouring", "bridal_contouring"),
                    L("Blush Placement", "bridal_blush"),
                ],
                "quiz": {
                    "title": "Bridal Sculpting Quiz",
                    "questions": [
                        {
                            "question": "Cream contour (vs powder) is generally best for which skin?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Drier or mature skin, applied before powder", "is_correct": 1},
                                {"option": "Only very oily skin", "is_correct": 0},
                                {"option": "It can never be used on bridal looks", "is_correct": 0},
                                {"option": "Only over a fully powdered base", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "For a youthful blush effect, where is blush placed?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "On the apples of the cheeks", "is_correct": 1},
                                {"option": "Only on the forehead", "is_correct": 0},
                                {"option": "Along the jawline", "is_correct": 0},
                                {"option": "On the tip of the nose", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Eye Makeup Mastery",
                "lessons": [
                    L("Eye Shapes", "bridal_eye_shapes"),
                    L("Bridal Eye Looks", "bridal_eye_looks"),
                    L("Lashes & Eyeliner", "bridal_lashes_liner"),
                ],
                "quiz": {
                    "title": "Bridal Eye Makeup Quiz",
                    "questions": [
                        {
                            "question": "For hooded eyes, shadow is best placed where so it stays visible when the eye is open?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Slightly above the natural crease", "is_correct": 1},
                                {"option": "Only on the waterline", "is_correct": 0},
                                {"option": "Only under the lower lash", "is_correct": 0},
                                {"option": "Hooded eyes cannot wear shadow", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Which are part of correct false-lash application? (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Trimming the band to fit the eye", "is_correct": 1},
                                {"option": "Letting adhesive reach the right tack before placing", "is_correct": 1},
                                {"option": "Placing the lash close to the natural lash line", "is_correct": 1},
                                {"option": "Applying glue directly into the eye", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Which is a recognised bridal eye look in this module?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Halo eyes", "is_correct": 1},
                                {"option": "Block-colour clown eyes", "is_correct": 0},
                                {"option": "Bare un-prepped lids", "is_correct": 0},
                                {"option": "Random glitter only", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Brow Perfection",
                "lessons": [
                    L("Brow Mapping", "bridal_brow_mapping"),
                    L("Natural vs Defined Brows", "bridal_brow_styles"),
                    L("Long-Wear Brows", "bridal_brow_longwear"),
                ],
                "quiz": {
                    "title": "Bridal Brow Quiz",
                    "questions": [
                        {
                            "question": "When mapping brows, what should the artist reference for symmetry?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Fixed facial landmarks rather than the uneven natural brow hairs", "is_correct": 1},
                                {"option": "Only the existing brow hairs", "is_correct": 0},
                                {"option": "The hairline", "is_correct": 0},
                                {"option": "Nothing — brows are freehanded", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "How are long-wear bridal brows built to last all day?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Layering gel/pomade, powder, and pencil, then setting with a brow gel", "is_correct": 1},
                                {"option": "A single swipe of pencil", "is_correct": 0},
                                {"option": "Only clear gel with no colour", "is_correct": 0},
                                {"option": "Lip liner applied to the brows", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Bridal Makeup Styles",
                "lessons": [
                    L("Soft Glam Bridal", "bridal_soft_glam"),
                    L("Luxury Full Glam", "bridal_full_glam"),
                    L("Natural Bridal", "bridal_natural"),
                ],
                "quiz": {
                    "title": "Bridal Styles Quiz",
                    "questions": [
                        {
                            "question": "Soft glam bridal is characterised by:",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Neutral tones, radiant skin, and soft definition", "is_correct": 1},
                                {"option": "Heavy black smokey eyes only", "is_correct": 0},
                                {"option": "No base products", "is_correct": 0},
                                {"option": "Bold neon colours", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Which statement about natural bridal makeup is true?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "It enhances features for a minimal-makeup look but still requires excellent prep and product control", "is_correct": 1},
                                {"option": "It requires no skill because less product is used", "is_correct": 0},
                                {"option": "It cannot be photographed", "is_correct": 0},
                                {"option": "It always uses the heaviest contour", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Bridal Consultation & Client Experience",
                "lessons": [
                    L("Client Consultation", "bridal_consultation"),
                    L("Trial Sessions", "bridal_trial"),
                    L("Luxury Experience", "bridal_luxury_exp"),
                ],
                "quiz": {
                    "title": "Bridal Consultation Quiz",
                    "questions": [
                        {
                            "question": "What is the main purpose of a bridal trial session?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "To rehearse and refine the look, and confirm wear and colour before the wedding day", "is_correct": 1},
                                {"option": "To replace the consultation entirely", "is_correct": 0},
                                {"option": "To upsell unrelated products", "is_correct": 0},
                                {"option": "It is unnecessary if there was a consultation", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Elements of a luxury bridal experience include: (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Hospitality and calming communication", "is_correct": 1},
                                {"option": "A prepared touch-up kit", "is_correct": 1},
                                {"option": "Excellent time management", "is_correct": 1},
                                {"option": "Arriving late and rushing the bride", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Photography & Social Media",
                "lessons": [
                    L("Makeup for Photography", "bridal_photography"),
                    L("Content Creation", "bridal_content"),
                    L("Portfolio Building", "bridal_portfolio"),
                ],
                "quiz": {
                    "title": "Bridal Photography & Social Media Quiz",
                    "questions": [
                        {
                            "question": "How is flashback in photos prevented?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Avoiding high-SPF and heavy light-reflecting products where flash hits", "is_correct": 1},
                                {"option": "Using more SPF in those areas", "is_correct": 0},
                                {"option": "Adding extra shimmer everywhere", "is_correct": 0},
                                {"option": "It cannot be prevented", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "What makes a bridal portfolio look premium and cohesive?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Consistent editing style, framing, and branding across curated best work", "is_correct": 1},
                                {"option": "Posting every photo unedited and unsorted", "is_correct": 0},
                                {"option": "Mixing many random filters", "is_correct": 0},
                                {"option": "Only stock images", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Business & Branding",
                "lessons": [
                    L("Pricing Bridal Services", "bridal_pricing"),
                    L("Marketing", "bridal_marketing"),
                    L("Client Retention", "bridal_retention"),
                ],
                "quiz": {
                    "title": "Bridal Business & Branding Quiz",
                    "questions": [
                        {
                            "question": "Bridal pricing should be based on: (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Skill level", "is_correct": 1},
                                {"option": "Product cost and time required", "is_correct": 1},
                                {"option": "The luxury of the experience offered", "is_correct": 1},
                                {"option": "Charging less than every competitor regardless of cost", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Which is among the most reliable sources of high-quality bridal referrals?",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Partnerships with photographers, planners, and venues", "is_correct": 1},
                                {"option": "Buying email lists", "is_correct": 0},
                                {"option": "Cold-calling strangers", "is_correct": 0},
                                {"option": "Ignoring past clients", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
            {
                "title": "Final Live Bridal Demonstration",
                "lessons": [
                    L("Full Bridal Transformation", "bridal_transformation"),
                    L("Professional Photoshoot", "bridal_photoshoot"),
                    L("Certification Standards", "bridal_certification"),
                ],
                "quiz": {
                    "title": "Bridal Certification Standards Quiz",
                    "questions": [
                        {
                            "question": "The final live assessment requires the student to:",
                            "type": "SingleChoice",
                            "options": [
                                {"option": "Complete a full bridal look under timed assessment conditions", "is_correct": 1},
                                {"option": "Only answer written questions", "is_correct": 0},
                                {"option": "Submit a single selfie", "is_correct": 0},
                                {"option": "Skip practical work entirely", "is_correct": 0},
                            ],
                        },
                        {
                            "question": "Which criteria are used to assess bridal certification? (Select all that apply.)",
                            "type": "MultipleChoice",
                            "options": [
                                {"option": "Hygiene and sanitation", "is_correct": 1},
                                {"option": "Blending and symmetry", "is_correct": 1},
                                {"option": "Professionalism, timing, and final result", "is_correct": 1},
                                {"option": "The brand of phone used to film", "is_correct": 0},
                            ],
                        },
                    ],
                },
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# Seeders
# ---------------------------------------------------------------------------

def seed_users():
    for email, first, last, pwd, role in [
        (INSTRUCTOR_EMAIL, INSTRUCTOR_FIRST, INSTRUCTOR_LAST, INSTRUCTOR_PASSWORD, "Course Creator"),
        (STUDENT_EMAIL, STUDENT_FIRST, STUDENT_LAST, STUDENT_PASSWORD, "LMS Student"),
    ]:
        if frappe.db.exists("User", email):
            print(f"  User exists: {email}")
            continue
        doc = frappe.get_doc({
            "doctype": "User",
            "email": email,
            "first_name": first,
            "last_name": last,
            "enabled": 1,
            "new_password": pwd,
            "send_welcome_email": 0,
        })
        doc.insert(ignore_permissions=True)
        try:
            doc.add_roles(role)
        except Exception:
            pass
        frappe.db.commit()
        print(f"  Created user: {email}")


def seed_categories():
    for cat in CATEGORIES:
        if frappe.db.exists("LMS Category", cat):
            print(f"  Category exists: {cat}")
            continue
        frappe.get_doc({"doctype": "LMS Category", "category": cat}).insert(ignore_permissions=True)
        frappe.db.commit()
        print(f"  Created category: {cat}")


def wipe_existing_courses():
    """Delete every existing course + its chapters, lessons, quizzes.

    Schema notes for this Frappe install:
      - Course Lesson.quiz_id (not .quiz) links a lesson to its LMS Quiz.
      - LMS Quiz Question (child of LMS Quiz) holds a `question` FK to LMS Question.
      - Options live inline on LMS Question as option_1..4 / is_correct_1..4.
      - There is NO LMS Quiz Option table.

    This also wipes orphan LMS Quiz / LMS Question rows left behind by
    partial runs (the LMS Quiz.title column is UNIQUE — orphans would block
    re-seeding with a "Duplicate entry" error).
    """
    print("Wiping existing courses (idempotent)...")

    # 1) Wipe course graph
    for course_name in frappe.get_all("LMS Course", pluck="name"):
        for ch in frappe.get_all("Course Chapter", filters={"course": course_name}, pluck="name"):
            for lesson in frappe.get_all(
                "Course Lesson", filters={"chapter": ch}, fields=["name", "quiz_id"]
            ):
                qid = lesson.get("quiz_id")
                if qid and frappe.db.exists("LMS Quiz", qid):
                    child_rows = frappe.get_all(
                        "LMS Quiz Question",
                        filters={"parent": qid},
                        fields=["name", "question"],
                    )
                    for row in child_rows:
                        if row.get("question") and frappe.db.exists("LMS Question", row.question):
                            frappe.db.delete("LMS Question", row.question)
                    frappe.db.sql("DELETE FROM `tabLMS Quiz Question` WHERE parent=%s", qid)
                    frappe.db.delete("LMS Quiz", qid)
                frappe.db.delete("Course Lesson", lesson.name)
            frappe.db.delete("Course Chapter", ch)
        frappe.db.sql("DELETE FROM `tabCourse Instructor` WHERE parent=%s", course_name)
        frappe.db.sql("DELETE FROM `tabChapter Reference` WHERE parent=%s", course_name)
        frappe.db.delete("LMS Course", course_name)
        frappe.db.commit()
        print(f"  Deleted course: {course_name}")

    # 2) Cleanup orphans (quizzes/questions/quiz-question rows that survived
    # partial runs). Safe because we control the entire course catalogue from
    # this seed; nothing else creates these rows.
    orphan_quiz_titles = (
        "Skin Anatomy & Healing Quiz",
        "Hygiene & Infection Control Quiz",
        "Color Theory & Pigment Quiz",
        "Face Shape & Brow Mapping Quiz",
        "Machine & Needle Quiz",
        "Common Mistakes Quiz",
        "Ombré Brow Quiz",
        "Nano Brow Quiz",
        "Combo Brow Quiz",
        "Powder Brow Quiz",
        "Practice Drills Quiz",
        "Consultation Quiz",
        "Live Model Quiz",
        "Healing & Touch-Up Quiz",
        "Color Correction Quiz",
        "Complex Cases Quiz",
        "Touch-Up Mastery Quiz",
        "Business & Branding Quiz",
        "Adult Learning Quiz",
        "Curriculum Design Quiz",
        "Demonstration & Supervision Quiz",
        "Student Assessment Quiz",
        "Mentorship Quiz",
        "Educator Ethics Quiz",
        "Certification Standards Quiz",
        # Professional Bridal Makeup
        "Bridal Introduction Quiz",
        "Bridal Hygiene & Safety Quiz",
        "Bridal Skin Preparation Quiz",
        "Bridal Color & Foundation Quiz",
        "Bridal Sculpting Quiz",
        "Bridal Eye Makeup Quiz",
        "Bridal Brow Quiz",
        "Bridal Styles Quiz",
        "Bridal Consultation Quiz",
        "Bridal Photography & Social Media Quiz",
        "Bridal Business & Branding Quiz",
        "Bridal Certification Standards Quiz",
    )
    for qtitle in orphan_quiz_titles:
        for qname in frappe.get_all("LMS Quiz", filters={"title": qtitle}, pluck="name"):
            for row in frappe.get_all(
                "LMS Quiz Question",
                filters={"parent": qname},
                fields=["question"],
            ):
                if row.get("question") and frappe.db.exists("LMS Question", row.question):
                    frappe.db.delete("LMS Question", row.question)
            frappe.db.sql("DELETE FROM `tabLMS Quiz Question` WHERE parent=%s", qname)
            frappe.db.delete("LMS Quiz", qname)
            print(f"  Deleted orphan quiz: {qname}")
    frappe.db.commit()


def create_quiz(quiz_data):
    """Create an LMS Quiz with its questions. Returns the quiz name.

    For each question in ``quiz_data["questions"]`` we:
      1. Create an LMS Question with option_1..4 / is_correct_1..4 inline.
         (Only the first 4 options are used; the schema does not have more.)
      2. Append an LMS Quiz Question child row that points to that question.
    """
    quiz_doc = frappe.get_doc({
        "doctype": "LMS Quiz",
        "title": quiz_data["title"],
        "passing_percentage": quiz_data.get("passing_percentage", DEFAULT_PASSING_PERCENTAGE),
        "max_attempts": quiz_data.get("max_attempts", DEFAULT_MAX_ATTEMPTS),
        "show_answers": 1,
        "show_submission_history": 1,
    })
    quiz_doc.insert(ignore_permissions=True)
    frappe.db.commit()

    for q_idx, q in enumerate(quiz_data["questions"], 1):
        # 1) Standalone LMS Question with inline options.
        # LMS Question.type valid values on this install: "Choices" / "User Input" / "Open Ended".
        # The author-facing "SingleChoice" vs "MultipleChoice" distinction is
        # carried by the `multiple` int flag (0 = single, 1 = multi).
        is_multiple = 1 if q.get("type") == "MultipleChoice" else 0
        opts = (q.get("options") or [])[:4]  # schema only supports 4
        question_payload = {
            "doctype": "LMS Question",
            "question": q["question"],
            "type": "Choices",
            "multiple": is_multiple,
        }
        for i, opt in enumerate(opts, 1):
            question_payload[f"option_{i}"] = opt["option"]
            question_payload[f"is_correct_{i}"] = 1 if opt.get("is_correct") else 0
        question_doc = frappe.get_doc(question_payload)
        question_doc.insert(ignore_permissions=True)

        # 2) Child row linking this question to the quiz.
        link = frappe.get_doc({
            "doctype": "LMS Quiz Question",
            "parent": quiz_doc.name,
            "parenttype": "LMS Quiz",
            "parentfield": "questions",
            "question": question_doc.name,
            "marks": q.get("marks", 1),
            "idx": q_idx,
        })
        link.insert(ignore_permissions=True)

    frappe.db.commit()
    return quiz_doc.name


def seed_courses():
    for course in COURSES:
        print(f"\nCreating course: {course['title']}")
        course_doc = frappe.get_doc({
            "doctype": "LMS Course",
            "title": course["title"],
            "image": course.get("image"),
            "short_introduction": course["short_introduction"],
            "description": course["description"],
            "course_price": COURSE_PRICE,
            "currency": "ETB",
            "paid_course": 1,
            "published": 1,
            "category": "Permanent Makeup",
            "status": "Approved",
            "instructors": [{"instructor": INSTRUCTOR_EMAIL}],
        })
        course_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        course_name = course_doc.name
        print(f"  -> {course_name}")

        total_lessons = 0
        for ch_idx, ch in enumerate(course["chapters"], 1):
            ch_doc = frappe.get_doc({
                "doctype": "Course Chapter",
                "course": course_name,
                "title": ch["title"],
                "chapter_number": ch_idx,
                "idx": ch_idx,
            })
            ch_doc.insert(ignore_permissions=True)
            frappe.db.commit()

            # Build quiz first so we can attach it to the last lesson
            quiz_name = None
            if ch.get("quiz"):
                quiz_name = create_quiz(ch["quiz"])

            last_idx = len(ch["lessons"])
            for ls_idx, lesson in enumerate(ch["lessons"], 1):
                lesson_payload = {
                    "doctype": "Course Lesson",
                    "chapter": ch_doc.name,
                    "title": lesson["title"],
                    "body": lesson["body"],
                    "idx": ls_idx,
                    "include_in_preview": 1 if (ch_idx == 1 and ls_idx == 1) else 0,
                }
                # Attach quiz to the LAST lesson of the chapter so completion gates on it
                if quiz_name and ls_idx == last_idx:
                    lesson_payload["quiz_id"] = quiz_name
                frappe.get_doc(lesson_payload).insert(ignore_permissions=True)
                total_lessons += 1
            frappe.db.commit()
            print(f"  Ch {ch_idx}: {ch['title']} ({len(ch['lessons'])} lessons, "
                  f"{'1 quiz' if quiz_name else 'no quiz'})")

        frappe.db.set_value("LMS Course", course_name, "lessons", total_lessons)
        frappe.db.commit()
        print(f"  Total: {len(course['chapters'])} chapters, {total_lessons} lessons")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    _frappe_init()
    print("=" * 60)
    print("Delta SPMU Academy — seed_delta_spmu.py")
    print("=" * 60)

    seed_categories()
    seed_users()
    wipe_existing_courses()
    seed_courses()

    print("\n" + "=" * 60)
    print("DONE")
    print("=" * 60)


if __name__ == "__main__":
    try:
        main()
    finally:
        if getattr(frappe.local, "site", None):
            frappe.destroy()
    sys.exit(0)
