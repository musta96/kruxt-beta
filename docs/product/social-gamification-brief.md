# KRUXT Social, Short-Video And Gamification Brief

Draft product strategy, 2026-10-22. Builds on the [journey map](user-journey-map.md)
and [competitive research](competitive-strategy-2026-10-22.md).
Proposed experience, not shipped functionality or confirmed product-market fit.

## Direct Answer

Social must be a first-class part of KRUXT, not a leaderboard tucked into account
settings. The earlier journey map covered activity sharing/community but did not
fully specify discovery, creation, creator incentives, moderation or social density.
This brief fills that gap. It does not turn KRUXT into an undifferentiated video clone.

Two legitimate entry modes must coexist:

- **I came to train:** go straight to a plan/logger and finish without social friction.
- **I came for people/inspiration:** discover enjoyable relevant content and people,
  with an easy path to an appropriate real activity when useful.

Fun, identity and belonging are valid value, not just conversion machinery.
Not every post needs a workout attached. Not every athlete needs to post.
The strategic distinction to test is a reliable bridge between community and
participation, alongside an excellent private training experience.

## Competitive Reality

The same individual ideas already exist. Hevy has discovery and reusable workout
objects; SugarWOD has gym-centered recognition; coach platforms have communities;
large social platforms have powerful media distribution. The opportunity is
execution for a chosen context, not claiming invention of social fitness.

| Reference | Documented pattern | Borrow | Do not assume |
| --- | --- | --- | --- |
| Hevy | Workout discovery, routine copying and media | Make useful training context portable | Workout-video attachment alone is differentiation. [Source](https://www.hevyapp.com/features/social-features/). |
| SugarWOD | Gym results, photos, comments and recognition | Familiar people and shared workout context | Local community/leaderboards are unoccupied space. [Source](https://www.sugarwod.com/athlete-features/). |
| TikTok | Feed refresh and explicit interest/filter controls | Simple discovery and visible negative feedback | Opaque engagement maximization is the right objective. [Source](https://newsroom.tiktok.com/introducing-a-way-to-refresh-your-for-you-feed-on-tiktok-us?lang=en). |
| Instagram | Distinct ranked surfaces and recommendation reset | Separate relationship-based content from discovery | One algorithm should drive every social surface. [Ranking](https://about.fb.com/news/2023/06/how-ai-ranks-content-on-facebook-and-instagram/), [reset](https://about.fb.com/news/2024/11/introducing-recommendations-reset-instagram/). |
| Duolingo | Its own metric work identifies shortcomings of raw session/time/XP incentives | Measure meaningful progress, not only engagement | More points or time necessarily improves the user's outcome. [Source](https://blog.duolingo.com/time-spent-learning-well/). |
| Myzone / Zwift | Relative-effort recognition / ability-grouped racing | Separate types of achievement and compare compatible contexts | Heart rate, raw strength and skill are one universal score. [Myzone](https://www.myzone.org/features/heart-rate-training-and-meps), [Zwift](https://www.zwift.com/uk/racing/racing-faq). |

"Borrow" and "do not assume" are analytical design recommendations, not vendor
defect findings or measured effectiveness claims.

## Proposed Social Architecture

Keep Feed/Social as a primary destination. Within it, use distinct views:

| View | User promise | Candidate content | Early ranking approach |
| --- | --- | --- | --- |
| Following | People I chose | Sessions, progress, tips, club moments | Recent permitted content; explicit controls. |
| Discover | Relevant people and ideas I do not yet follow | Short clips, useful sessions, creator/gym highlights | Curated eligible content using explicit interests; explainable ordering. |
| My gym/team | People and activity in my opted-in community | Announcements, shared sessions, events, team progress | Tenant/community permissions first, then relevance/freshness. |

Discover can support an immersive vertical-video viewer, while the broader feed
also supports images, text and structured session summaries. A vertical player
is a presentation mode, not a new navigation destination for every media type.
Keep a visible route back to training; don't replace the entire product with video.

Member navigation recommendation remains provisional: Plan, Feed, Log, Gyms,
Profile is one compact option. Feed must expose community and challenge access
in context, not bury them under Profile. Prototype a social-led home variant
against a training-led home before choosing the default for every user.

## Content And Creation Objects

| Object | Purpose | Optional structured link | Important distinction |
| --- | --- | --- | --- |
| Session recap | Celebrate an activity | Workout/session/result | Successful workout exists before publishing. |
| Technique/explanation | Teach or clarify | Exercise and reusable session | Educational content is not individualized medical advice. |
| Progress milestone | Personal achievement | Selected comparison/history | Do not publish body/health information automatically. |
| Club moment/event | Belonging and real-world participation | Gym event/class | Do not expose precise attendance/location or bystanders without a basis. |
| Challenge entry | Join or demonstrate an attempt | Versioned rules and result | Video is an attachment, not automatic verification. |
| Coach program preview | Help choose a suitable plan | Creator/versioned program | Clear prerequisites, attribution and commercial disclosure. |
| Training culture/entertainment | Enjoyment, identity and connection | None required | Relevant community standards still apply. |

Proposed creation flow: select type -> capture/upload -> accessible preview/caption
-> optionally attach session/exercise -> select audience -> review -> publish.
Persist draft and saved-workout identity separately. Upload/transcode failures
must preserve work and expose retry/cancel without repeating a workout submission.

Use an initial short-clip duration/size budget established by a real delivery
cost and usability test. Do not invent a universal duration from a rival's limit.
No licensed-music catalog, live streaming or unrestricted direct messaging in
the first slice; each creates separate safety, rights and operational requirements.

## New Journey S01 - Discover To Participate

```text
Open Feed -> choose Following/Discover/My gym -> inspect clip/post
 -> understand creator and relevant context
 -> enjoy/follow/save OR open linked session/class/challenge
 -> adapt/confirm an appropriate task -> perform -> save real outcome
 -> optionally respond/share -> return to community or training
```

Success can be enjoyment or a useful relationship; if the claim is training impact,
measure completed appropriate sessions, not only clicks or saves. Preserve creator
attribution and original plan version through the handoff. Copying must not silently
replace the user's plan or copy another athlete's working loads as safe prescriptions.

Failure states: unavailable/deleted/private source, blocked creator, unsupported
exercise, ineligible class, changed program, duplicate save, offline player,
missing media and upload pending. None should destroy the current training draft.

## New Journey S02 - Create, Publish, And Receive Feedback

```text
Finish activity OR start an original post -> draft/capture -> review accessibility
 -> choose audience -> publish -> see processing/success -> receive relevant response
 -> manage comments/audience -> edit or delete with clear downstream behavior
```

Before asking someone to film, show the value and keep it optional. Provide
captions, sound/motion controls, progress and processing states, and a usable
keyboard/screen-reader path. Pause offscreen media and honor user playback preferences.

Feedback should distinguish encouragement, a technique question and a report.
Do not present a large view count as evidence of training expertise. A published
video's deletion must have a defined effect on derived thumbnails, cached copies,
linked activity, moderation records and lawful retention requirements.

## New Journey S03 - Belong And Compete Fairly

```text
See suitable challenge -> inspect rules/audience/data use -> opt in
 -> choose compatible track -> complete accepted activity -> see provisional result
 -> resolve disputed result if needed -> receive recognition -> start next useful task
```

Separate three systems instead of one overloaded XP total:

1. **Consistency:** adherence to the person's chosen plan/frequency, with rest,
   time off, injury accommodations and sensible restart. No daily exertion mandate.
2. **Personal progress:** meaningful improvement against one's own appropriate
   baseline, with transparent calculations and uncertainty.
3. **Comparable competition:** opt-in benchmark/event results under compatible,
   versioned rules, with provisional states and appeals.

Gym/team collective goals should not reward only the strongest participant or
largest gym. Consider participation ratios or capped contributions, and test
small-team incentives for exclusion or farming before release.

Reward supportive participation carefully: uncapped likes/comments/referrals invite
spam and collusion. Start with recognition rather than fungible rewards. No paid
rank multipliers, monetary wager mechanics or loot-box-like rewards in the pilot.
Paid features must not buy supposedly performance-earned competitive advantage.

## Provenance And Integrity

Proposed labels, not implemented guarantees:

| Label | What it means | What it does not prove |
| --- | --- | --- |
| Self-reported | Person entered the result | True performance, form or identity. |
| Device-linked | Result arrived through a reviewed integration | Perfect sensor accuracy, honest context or competition eligibility. |
| Witness-attested | Authorized coach/event reviewer attested to a defined attempt | Universal independent verification; conflicts still matter. |
| Rules-validated event | A defined process checked the required evidence | Medical safety or validity outside that event/rule version. |

Never collapse these into a universal verified badge. A gym check-in is presence
evidence, not proof that a particular lift was performed. Video can be edited,
reused or ambiguous. Use competition-appropriate checks, deduplication, anomaly
review, rate limits, versioned scoring, reviewer conflict rules and appeals.
Do not introduce facial recognition or biometric identity collection to solve this
by default. Avoid publicly branding an athlete a cheater from an anomaly score.

## Recommendation Objective

Start with curated/community-based retrieval and explicit interests. Use eligible
content only: audience permission, block/mute, moderation status, creator attribution
and age policy are hard constraints before any relevance score.

Early signals can include intentional follows, explicit topics, useful saves,
completed linked tasks and freshness/diversity. Watch time can diagnose playback
quality, but should not become the sole product objective. A view does not prove
helpfulness, expertise or safety.

Provide Following and My gym independently of Discover, an accessible Not
interested/mute/report path, explanations and a way to reset explicit preferences.
Do not infer injury, illness, body-image insecurity or other sensitive traits to
target recommendations/ads. Evaluate legal basis and privacy impact before
profiling that involves health-related data. Explicit interests are not blanket
permission to repurpose private training records.

Any later ranking experiment needs predeclared user-value metrics and harm
guardrails, subgroup checks and enough sample size. A small gym pilot cannot
validate a large-scale recommender or prove clinical/fitness outcomes.

## Safety And Privacy Are Product Features

Prerequisites for public social expansion:

- Server-enforced audiences and block relationships, not only client hiding.
- Report content/account, mute, block, appeal and an actual staffed review process.
- Gym opt-in, careful location disclosure, bystander/media rights and creator ownership.
- Clear rules for harassment, body shaming, dangerous challenges, scams, impersonation,
  undisclosed commercial posts, copyright and misleading health claims.
- Risk-based age policy and enforceable access design. Do not assume a label saying
  adults-only removes obligations or prevents minors reaching the service.
- Purpose-bound retention/deletion covering originals and derived media; safe
  support/audit access and no sale of health-related activity data.
- Notification controls, reasonable pacing and no penalties for privacy choices.

Legal scope and applicable duties require qualified review. EU platform and minor
protection requirements are relevant design inputs, not a checkbox automatically
satisfied by these proposals. [European Commission DSA overview](https://digital-strategy.ec.europa.eu/en/policies/digital-services-act),
[2025 minor-protection guidance](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A52025XC05519).
Sensitive-data targeting needs particular care. [EDPB guidance](https://www.edpb.europa.eu/system/files/2021-04/edpb_guidelines_082020_on_the_targeting_of_social_media_users_en.pdf).

Imported competitor activity must not be reused as social feed seed without the
necessary rights. Strava's policy specifically restricts display of imported
user data to that authenticated user; do not assume public-on-Strava means
republishable in KRUXT. [Current API policy](https://m.strava.com/legal/api_policy).

## Supply, Cold Start, And Creator Value

Start with a bounded community where people already have a reason to care about
each other. Seed original coach/gym content with permission; never fake members,
engagement or results. Feed empty states should offer real people/tasks or a
useful private training experience, not invented activity.

Test a small repeatable content mix: a coach technique explanation, a session
preview users can actually perform, a shared gym event, and optional member wins.
Determine cadence with participants and moderation capacity, not a global daily
posting quota. Respect people and gyms that prohibit filming.

Early creator value: correct attribution, useful member questions, qualified plan
starts/completions and eligible local service demand. Later commerce needs explicit
rights, prices, payouts, refunds, consumer terms, taxes and channel-policy review.
Do not promise creator income or guaranteed reach. Reward usefulness, not only
follower count, while avoiding an unvalidated automated expertise score.

## Product Measurement

| Question | Candidate measurement | Guardrail |
| --- | --- | --- |
| Is the community alive? | Mutually active relationships, useful responses and relevant content coverage per cohort | Not registered accounts or fabricated engagement. |
| Does discovery help? | Correct linked session starts/completions and participant-rated usefulness | No misleading fitness attribution from a simple click. |
| Do creators benefit? | Qualified responses, attributed starts/completions, eventual legitimate conversions | No exposed private member activity or guaranteed earnings. |
| Is competition healthy? | Repeat eligible participation across levels and dispute resolution | Spam, exclusion, unsafe behavior, score farming and opt-out friction. |
| Does gym delivery improve? | Staff task time, appropriate follow-up and attended sessions | No causal retention claim from an uncontrolled small pilot. |
| Is video economical? | Delivery/transcode/storage/support/moderation cost per retained active participant | Include failed processing, derivatives and founder time. |

Proposed event taxonomy can reference content/program IDs only where needed and
lawful; keep product analytics separate from sensitive activity/audit records.
Measure refusal/opt-outs and non-posting users' utility as well as engagement.

## Reachability Check Against KRUXT Today

| Area | Source-backed baseline | Not established as a finished journey |
| --- | --- | --- |
| Web feed | Activity/media rendering, reactions and comments in `FeedScreen.tsx` | Complete short-form creation/discovery, creator supply and operational moderation. |
| Web rank/guild | Rank/challenge/community surfaces and service contracts | Fair scoring across contexts, fresh hosted computation and full anti-abuse acceptance. |
| Native active app | `index.js -> App.tsx -> NativeApp`, text activity feed and minimal logger | Rich media/social parity just because richer modules or dormant routes exist. |
| Workout proof | Attachment upload path after workout commit | Independent retry without duplicate-risk completion; repair remains prioritized. |
| Safety contracts | Existing visibility/private defaults and security work | Complete public-social safety program or GDPR certification. |

## Delivery Sequence

1. Fix training save/context/identity failures and integrate existing truthfulness
   work; an entertaining feed cannot compensate for unreliable training.
2. Ship useful Following/My gym media and creation with real privacy/report/block
   workflows, original content supply and measured processing/delivery costs.
3. Test Discover's short-video viewer and structured task links with curated rules;
   keep social a primary experience and retain direct private training access.
4. Test one opt-in fair community challenge with provisional results and appeals.
5. Expand ranking, creator monetization, cross-gym distribution and native parity
   only when reliability, safety, density and economics are evidenced.

No new app route, live social feature, provider, tracking system or recommender
was deployed by creating this brief. Owner priorities and research validation
still shape the first implementation slice.
