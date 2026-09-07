# Translucency — MVP Product & Build Specification

> Working title: **Translucency**  
> Product type: Personal anxiety-awareness and cognitive reappraisal app  
> Primary purpose: Help users understand *why they feel more sensitive on a given day*, recognise patterns that make their nervous system feel more “translucent,” and choose a healthier response without turning the app into a symptom-checking or reassurance tool.

---

## 1. Product Vision

Translucency is a mental wellness app built around a simple personal metaphor:

> **When stress and anxiety accumulate, I feel less like a brick wall and more like a damp sheet of material. The more saturated it becomes, the more translucent it feels. Bodily sensations, thoughts, and fears seem to pass through more easily and feel louder. When stress reduces, the material gradually dries and becomes more opaque again.**

The app makes that invisible internal state visible.

Instead of asking only:

- “How anxious am I?”
- “How bad is my mood?”
- “What symptom do I have?”

the app asks:

- **How translucent do I feel today?**
- **What has been adding water?**
- **What has been helping me dry?**
- **What signals are becoming louder because I am more sensitised?**
- **What perspective or role would help me respond differently right now?**

The product should help users move from:

> “Something must be wrong with me.”

toward:

> “My system is carrying more load today. I have been here before. I can understand the pattern and respond without treating every sensation as danger.”

---

## 2. Core Philosophy

The central metaphor is a **translucent material panel** rather than literal paper.

The panel represents the user’s current state of:

- nervous-system arousal,
- psychological threat sensitivity,
- somatic sensitivity,
- cognitive load,
- stress accumulation,
- vulnerability to rumination,
- and attentional “permeability.”

### Important clarification

**Translucency does NOT mean damage.**

A user who feels highly translucent is not physically weak, broken, or medically unsafe. The app must never imply that becoming translucent means the nervous system is damaged.

A better definition is:

> **Translucency = how sensitised and permeable my mind-body system feels right now.**

When more translucent:

- bodily sensations may feel louder,
- attention may lock onto symptoms more easily,
- uncertainty may feel harder to tolerate,
- muscle tension may increase,
- intrusive thoughts may stick more strongly,
- pain or discomfort may feel more threatening,
- reassurance-seeking may increase.

When more opaque:

- sensations can still exist,
- but they are less likely to dominate attention,
- thoughts feel less threatening,
- the person feels more grounded, resilient, and able to continue their day.

---

## 3. The Material Metaphor

The main visual element is a **frosted / translucent material panel**.

It should feel like a premium wellness object, not a medical gauge.

### Visual states

The panel gradually changes based on the user’s current state:

#### Opaque
- Dense
- Calm
- Stable
- Soft matte texture
- Little light passes through
- Represents groundedness and low sensitisation

#### Damp
- Slight transparency
- Soft internal bloom / diffusion
- Represents accumulating stress

#### Translucent
- More light passes through
- Internal texture is visible
- Soft ripples / moisture patterns may appear
- Represents increased nervous-system sensitivity

#### Highly Translucent
- Very permeable and delicate-looking
- Still intact
- Never cracked, broken, shattered, or damaged
- Represents high sensitivity, not danger

### Design principle

The panel should communicate:

> **“You are carrying more today.”**

not:

> **“You are failing.”**

---

## 4. The “Water” Model

Stressors are represented as **Water Sources**.

Restorative actions are represented as **Drying Sources**.

### Water Sources

Examples:

- Health uncertainty
- Upcoming event
- Poor sleep
- Work stress
- Relationship tension
- Rumination
- Body checking
- Reassurance-seeking
- Overthinking
- Conflict
- Too much caffeine
- Lack of movement
- Travel
- Financial pressure
- Social stress
- Pain / illness
- General uncertainty

Each logged water source can optionally be given an intensity:

- Light
- Moderate
- Heavy

The app should avoid presenting these as scientifically precise inputs. They are user-reported contributors.

### Drying Sources

Examples:

- Exercise
- Meditation
- Walk
- Good sleep
- Social connection
- Time with partner/family/friends
- Gaming
- Creative work
- Being outdoors
- Stretching
- Breathing
- Journaling
- Accepting uncertainty
- Completing a feared task
- Returning to normal routine
- Rest
- Music
- Therapy
- Talking to someone

Each drying source can also be:

- Light
- Moderate
- Strong

---

## 5. Body Signals

The app may allow users to briefly log body or mental signals, but this should be deliberately secondary.

The app must **not become a symptom tracker**.

### Preferred language

Use:

> **Signals noticed today**

rather than:

> Symptoms

Examples:

- Jaw tension
- Shoulder tension
- Abdominal tightness
- Ear pressure
- Racing heart
- Restlessness
- Head pressure
- Racing thoughts
- Body scanning
- Muscle tension
- Fatigue
- “Body feels loud”
- Difficulty settling
- Intrusive health thoughts

### Important UX rule

Do **not** encourage:

- repeated severity ratings,
- hourly symptom checking,
- anatomical diagrams,
- pain-location maps,
- repeated “is it still there?” prompts,
- diagnostic interpretation.

The body-signal area should be optional and lightweight.

The core app should remain:

> **State → Sources → Response → Reflection**

---

## 6. The Role System

The second major system is **Roles**.

The panel answers:

> **Why do I feel like this?**

Roles answer:

> **How do I want to respond while I feel like this?**

Roles are a cognitive reappraisal tool.

The user does not pretend to literally become another person. They temporarily **borrow the perspective, posture, or attitude** of someone who handles a similar type of discomfort or uncertainty calmly.

### Psychological basis

The role system combines ideas from:

- cognitive reappraisal,
- coping imagery,
- mental rehearsal,
- modelling,
- self-distancing,
- perspective-taking,
- self-efficacy.

### Default roles

#### The Boxer
Best for:
- physical discomfort,
- recovery,
- fear of pain,
- difficult procedures.

Core attitude:

> “The hard part is over. Recovery is the job now.”

Important:
The Boxer does **not** ignore pain or reject medication. The app should frame professional recovery as:

- rest,
- ice/heat when appropriate,
- treatment plan,
- medication as directed,
- support,
- hydration,
- patience.

#### The Soldier
Best for:
- situations outside the user’s control,
- turbulence,
- uncertainty,
- waiting,
- environmental discomfort.

Core attitude:

> “I do not need to control every bump. I can stay with the moment.”

#### The Observer
Best for:
- intrusive thoughts,
- body scanning,
- rumination,
- anxious sensations.

Core attitude:

> “I can notice this without immediately solving it.”

#### The Explorer
Best for:
- unfamiliar situations,
- change,
- uncertainty,
- new experiences.

Core attitude:

> “Unknown does not automatically mean dangerous.”

#### Future Me
Best for:
- catastrophising,
- situations that feel enormous in the present,
- long recovery periods,
- rumination.

Core attitude:

> “This will eventually become something that happened.”

#### The Athlete in Recovery
Best for:
- fatigue,
- soreness,
- healing,
- rest guilt.

Core attitude:

> “Recovery is active work, not weakness.”

---

## 7. Custom Roles

Users should be able to create their own roles.

Prompt:

> **Who represents calm, resilience, perspective, or steadiness to you?**

A custom role includes:

- Role name
- Optional emoji/icon
- “What do I borrow from them?”
- Best situations for this role
- One core reappraisal phrase
- Optional personal note

Examples:

### My Dad
Borrowed quality:
> “He rarely rushes to conclusions.”

### Me at 40
Borrowed quality:
> “This problem will feel smaller from there.”

### Calm Pilot
Borrowed quality:
> “Not every bump means danger.”

### Captain / Leader
Borrowed quality:
> “Observe first. Respond second.”

### Important language

The app should explicitly say:

> **You do not have to become someone else. Sometimes it helps to borrow their perspective.**

---

## 8. Cognitive Reappraisal

The app should teach reappraisal in simple language:

> **Reappraisal means changing the meaning you give to something, without pretending it is not happening.**

Example:

### Anxiety’s appraisal
> “My body feels strange. Something must be wrong.”

### Reappraisal
> “My system is highly sensitised today. This sensation may feel louder because my attention is locked onto it.”

Another:

### Anxiety’s appraisal
> “This discomfort proves I cannot handle recovery.”

### Boxer’s appraisal
> “Discomfort after a difficult event is expected. My job is to recover, not panic about the existence of discomfort.”

The app should avoid absolute medical reassurance.

Never generate:

- “You are definitely fine.”
- “This symptom is only anxiety.”
- “This cannot be dangerous.”

Instead use:

- “This may be amplified by your current state.”
- “You have noticed similar patterns before.”
- “You do not have to interpret every sensation immediately.”
- “If something feels genuinely concerning or changes meaningfully, seek appropriate professional care.”

---

## 9. Main Product Loop

The MVP should centre on five stages:

### 1. NOTICE
> **How translucent do I feel?**

User selects or adjusts their current state.

### 2. UNDERSTAND
> **What has been adding water?**
> **What has been helping me dry?**

User logs contributors.

### 3. NOTICE SIGNALS
Optional:

> **Has your body or mind felt louder today?**

User can select a few signals.

### 4. REAPPRAISE / ASSUME A ROLE
> **What perspective would help you right now?**

User selects a role.

The app shows:
- anxiety’s likely appraisal,
- role-based reappraisal,
- a short instruction.

### 5. REFLECT
Later:

> **Did this perspective help?**

Options:
- Not really
- A little
- A lot

Optional note:
> “What changed?”

This feeds the user’s role history.

---

## 10. Daily Check-In

Keep check-ins short enough that the app does not become compulsive.

Ideal duration:

> **30–90 seconds**

Suggested default frequency:

- Morning check-in
- Evening check-in

Do **not** encourage continuous logging throughout the day.

### Morning Check-In

1. How does your panel feel?
   - Opaque
   - Slightly translucent
   - Moderately translucent
   - Highly translucent

2. What seems to be adding water?
   - Multi-select

3. What helped recently?
   - Multi-select

4. Optional:
   - “My body/mind feels louder today”
   - Add 1–3 signals

5. Suggested role
   - Based on current state + selected context

### Evening Check-In

1. How does your panel feel now?
2. What added water today?
3. What helped it dry?
4. Did you use a role?
5. Did it help?
6. Optional short reflection.

---

## 11. Home Screen

The Home screen should be visually dominated by the material panel.

### Suggested content hierarchy

#### Greeting
> Good morning

#### Main Panel
Large translucent material object.

Text:

> **Your panel feels moderately translucent today**

Supporting text:

> You may notice thoughts and body signals more easily when your system is carrying more load.

#### Water Added
Compact chips:
- Poor sleep
- Upcoming event
- Rumination

#### Drying
Compact chips:
- Walk
- Exercise
- Partner time

#### Insight
> **You have been here before.**
> Your last highly translucent period softened over 4 days.

#### Role suggestion
> **Perspective for today: The Observer**
> “Notice it. You do not need to solve it immediately.”

#### CTA
> Check in

---

## 12. History / Journey Screen

The History screen should visually show the user’s changing state over time.

### Primary visual

A calendar or timeline where each day contains a miniature material panel.

The user should be able to visually see:

> Opaque → damp → translucent → drying → opaque

This is more meaningful than a generic mood chart.

### Key insight

The app should be able to show:

> **You have been this translucent before, and you became opaque again.**

This is one of the emotional anchors of the product.

### MVP history data

For each day:

- Panel state
- Water sources
- Drying sources
- Optional signals
- Role used
- Role helpfulness
- Optional note

---

## 13. Pattern Insights

For MVP, keep insights simple and deterministic.

Do not claim clinical or causal conclusions.

Examples:

> **Poor sleep appears often on your more translucent days.**

> **Exercise appears frequently before your panel becomes more opaque.**

> **You often log body checking on days when your panel is highly translucent.**

> **The Soldier has helped in 4 of your last 5 “loss of control” situations.**

> **Your panel tends to recover after several days of normal routine.**

### Language rules

Use:

- “appears”
- “is associated in your logs”
- “you often report”
- “you may want to notice”

Avoid:

- “causes”
- “proves”
- “diagnoses”
- “predicts”

---

## 14. Critical Anti-Compulsion Design Rules

This is essential.

The app is aimed partly at users who may have health anxiety, somatic hypervigilance, or reassurance-seeking tendencies.

It must not become a better-looking checking ritual.

### Avoid

- Hourly reminders to check anxiety
- Symptom severity graphs
- Repeated body-area tracking
- “Scan your body now”
- Diagnostic suggestions
- Health-risk scoring
- AI reassurance loops
- Unlimited repeated check-ins
- Encouraging users to measure whether a sensation disappeared
- Comparing today’s symptom intensity to yesterday
- Red “danger” states based only on anxiety level

### Prefer

- 1–2 check-ins per day
- State-level reflection
- Context
- Trends
- Roles
- Reappraisal
- Returning attention outward
- Normal-life actions
- Recovery over time
- “No new decision needed” language

### Example guardrail

If the user attempts repeated check-ins within a short period:

> **You have already checked in recently. Unless something meaningful has changed, consider returning to your day and checking in later.**

---

## 15. “Observe, Don’t Re-Litigate” Feature

A useful feature for health-anxiety style rumination.

The user may decide:

> **This is currently in Observe mode.**

Examples:
- familiar mild body tension,
- a recurring intrusive thought,
- a non-urgent uncertainty.

The app can display:

> **Already assessed. No new decision required unless something meaningfully changes.**

This is meant to reduce repeated mental reopening of the same concern.

Important:
This is not a medical triage system.

The app should clearly state:

> “This app does not determine whether a symptom is medically serious. If you have a concerning or worsening health issue, seek professional care.”

---

## 16. Suggested MVP Screens

Build the first version around these screens only:

### 1. Onboarding
- Explain material metaphor
- Define translucency
- Explain water/drying
- Explain roles
- Emphasise “translucent does not mean damaged”
- Let user select common water/drying sources
- Let user choose 2–3 starting roles

### 2. Home
- Current panel
- Today’s water
- Today’s drying
- Suggested role
- Quick check-in
- One insight

### 3. Check-In
- Panel state
- Water sources
- Drying sources
- Optional signals
- Optional note
- Save

### 4. Roles
- Default roles
- Custom roles
- Role detail
- “Use this perspective”

### 5. Reappraisal Session
- Current concern/context
- Anxiety’s appraisal
- Role-based appraisal
- Carry-this-perspective prompt
- Later helpfulness rating

### 6. Journey / History
- Calendar/timeline
- Panel visual per day
- Tap a day to see contributors

### 7. Insights
- Simple recurring patterns
- Most helpful drying sources
- Most helpful roles
- “You have been here before” comparisons

### 8. Settings
- Reminder frequency
- Personal sources
- Roles
- Privacy
- Reset/delete local data

---

## 17. Suggested Data Model

Tech stack is open, but the data model can begin with the following objects.

### UserProfile

```ts
type UserProfile = {
  id: string
  name?: string
  createdAt: string
  preferredCheckInTimes?: string[]
  selectedRoleIds: string[]
  customWaterSources: string[]
  customDryingSources: string[]
  customSignals: string[]
}
```

### CheckIn

```ts
type CheckIn = {
  id: string
  userId: string
  timestamp: string

  translucency: number // 0–100, internal value
  translucencyLabel:
    | "opaque"
    | "slightly_translucent"
    | "moderately_translucent"
    | "highly_translucent"

  waterSources: LoggedFactor[]
  dryingSources: LoggedFactor[]
  signals?: string[]

  note?: string
}
```

### LoggedFactor

```ts
type LoggedFactor = {
  id: string
  label: string
  intensity?: "light" | "moderate" | "heavy"
}
```

### Role

```ts
type Role = {
  id: string
  name: string
  icon?: string
  description: string
  borrowedQuality: string
  bestFor: string[]
  corePhrase: string
  isCustom: boolean
}
```

### RoleSession

```ts
type RoleSession = {
  id: string
  userId: string
  roleId: string
  timestamp: string

  context?: string
  anxiousAppraisal?: string
  reappraisal?: string

  helpfulness?: "not_really" | "a_little" | "a_lot"
  reflection?: string
}
```

---

## 18. Translucency Calculation

For the MVP, do **not** pretend the app can objectively calculate nervous-system sensitivity.

The primary state should be **user-selected**.

Optional helper:

The user can select:
- current felt state,
- water sources,
- drying sources.

The app may suggest:

> “Based on your check-in, does 65% feel about right?”

But it should never say:

> “Your nervous system is 67% sensitised.”

### Internal visual mapping

Use a 0–100 value only to control visual appearance.

Example:

- 0–20: Opaque
- 21–40: Slightly translucent
- 41–70: Moderately translucent
- 71–100: Highly translucent

The percentage should be optional in the UI.

Preferred display:

> **Moderately translucent**

rather than:

> **67% anxious**

---

## 19. Visual Design Direction

### Overall aesthetic

- Calm
- Premium
- Soft
- Minimal
- Gentle
- Non-clinical
- Not childish
- Not gamified
- Not “therapy worksheet” looking

### Visual references

Think:

- frosted glass,
- translucent resin,
- soft fibres,
- diffused light,
- premium wellness product,
- subtle moisture patterns,
- tactile materials,
- soft depth.

### Material panel

The panel can include:

- opacity shift,
- soft blur,
- internal moisture bloom,
- slight grain,
- diffused background visibility.

Never use:

- cracks,
- damage,
- holes,
- warning red,
- “broken” states.

### Colour direction

Use a restrained wellness palette:

- warm cream / off-white background,
- cool pale blue,
- desaturated violet,
- soft sage,
- subtle peach,
- low-saturation accent colours.

Dark mode can come later.

---

## 20. Tone of Voice

The app should sound:

- calm,
- intelligent,
- grounded,
- non-patronising,
- non-clinical,
- reassuring without promising certainty.

### Good examples

> **You are carrying more today.**

> **Your panel is more translucent than usual.**

> **Signals may feel louder when your system is sensitised.**

> **You have been here before.**

> **No new decision required.**

> **What helped you dry today?**

> **You do not have to solve this thought immediately.**

> **Borrow a perspective, not a personality.**

> **Translucent does not mean damaged.**

> **Your state can change without you forcing it.**

### Avoid

- “Calm down”
- “Everything is fine”
- “It is just anxiety”
- “You are overreacting”
- “Your symptom is harmless”
- “You must relax”
- “You failed your check-in”

---

## 21. Example User Journey

### Morning

User wakes after poor sleep and feels physically tense.

They open the app.

Panel:
> **Highly translucent**

They log:

Water:
- Poor sleep — heavy
- Upcoming meeting — moderate
- Health uncertainty — moderate

Drying:
- None yet

Signals:
- Jaw tension
- Body feels loud

App response:

> **You are carrying more than usual this morning.  
> When your panel is highly translucent, body signals may become easier to notice and harder to ignore.**

Suggested role:
> **The Observer**

Reappraisal:

Anxiety:
> “Something feels wrong. I need to figure it out.”

Observer:
> “Something feels noticeable. I do not need to decide what it means immediately.”

Action:
> **Carry this perspective for the next hour.**

---

### Afternoon

User works out and spends time with a friend.

Evening check-in:

Panel:
> Moderately translucent

Drying:
- Workout — strong
- Social time — moderate
- Normal routine — moderate

Insight:

> **Your panel softened after movement and social connection today.**

---

### Several months later

User has another highly translucent day.

App shows:

> **You have been here before.**

> Your last 5 highly translucent periods all moved back toward opaque.

This is evidence from the user’s own history rather than generic reassurance.

---

## 22. MVP Insight Logic

No AI is required for v1.

Use simple local calculations.

Examples:

### Most Common Water Sources

Count frequency of factors on check-ins where translucency >= 70.

### Most Helpful Drying Sources

Compare same-day or next-day translucency after drying source appears.

Phrase carefully:

> “Exercise often appears before lower translucency in your logs.”

### Helpful Roles

Count role sessions by helpfulness.

Example:

> “The Observer helped ‘a lot’ in 6 of 8 recent sessions.”

### Recovery Pattern

Find episodes where:
- translucency >= 70
- followed by <= 40 within N days

Show:

> “You have moved from highly translucent to mostly opaque 7 times.”

---

## 23. Notifications

Notifications should be minimal.

Suggested defaults:

### Morning
> **How does your panel feel today?**

### Evening
> **What added water today? What helped you dry?**

Do not send:

- “Your anxiety might be rising.”
- “Check your symptoms.”
- “You have not logged today.”
- repeated reminders.

No shame-based streaks.

---

## 24. No Streaks

Do not use:

- daily streaks,
- badges for logging,
- “7 days in a row!”,
- red missed-day warnings.

The product should not reward obsessive tracking.

Instead:

> **Logging is available when it helps. Life outside the app is the goal.**

This can even be explicit onboarding copy.

---

## 25. Safety / Medical Boundary

This app is not:

- a diagnostic tool,
- a medical triage tool,
- a therapist replacement,
- a panic detector,
- a pain calculator,
- a nervous-system measurement device.

The app should include a clear but non-alarming disclaimer:

> **Translucency helps you reflect on stress, sensitivity, and coping patterns. It does not diagnose medical conditions. If you experience a concerning, severe, or worsening physical or mental-health problem, seek appropriate professional care.**

Do not surface medical emergency warnings during ordinary check-ins unless the user explicitly navigates to safety information.

---

## 26. Privacy

For MVP, prefer:

- local-first storage,
- no account required,
- no advertising,
- no selling health/wellness data,
- clear export/delete controls.

If cloud sync is added later:

- encrypted transport,
- explicit opt-in,
- privacy-focused product positioning.

---

## 27. Tech Suggestions for the Coding Agent

### Required V1 platform

Build Version 1 as a **responsive Next.js Progressive Web App (PWA)** designed for both **desktop and mobile**.

Desktop must be treated as a **first-class experience**, not as a stretched mobile layout.

The same codebase should work well across:

- Windows desktop browsers
- macOS desktop browsers
- Laptops
- Tablets
- Mobile browsers
- Installed PWA mode

The app should be installable from supported browsers so it can behave like a native-style application without requiring App Store or Play Store distribution during the MVP phase.

### Desktop experience

On desktop, use the extra horizontal space intentionally.

A recommended home/dashboard composition is:

- Large Translucency material panel as the primary visual anchor
- Water Sources and Drying Sources visible alongside it
- Suggested Role and Reappraisal content in a secondary panel
- Recent insight / “You have been here before” card
- Clear access to Journey and Insights

Do not simply scale up the mobile UI.

Desktop layouts should use:
- multi-column composition,
- generous whitespace,
- persistent navigation where appropriate,
- larger data visualisations,
- richer material-panel animation,
- side-by-side contextual information.

### Mobile experience

On mobile, collapse the same information into a calm vertical flow.

Prioritise:
1. Current Translucency state
2. Water / Drying
3. Suggested Role
4. Check-In
5. Journey / Insights

Touch targets should be comfortable and interactions should remain simple enough for a 30–90 second check-in.

### Suggested MVP architecture

- Next.js
- TypeScript
- Responsive component system
- PWA manifest + service worker
- Installable app experience
- Local-first persistence using IndexedDB, with localStorage only for lightweight preferences
- No backend required initially
- Component-driven UI
- SVG/CSS/WebGL only if necessary for the material-panel visual
- Deterministic insights
- Seeded default roles and factors
- Offline-friendly core experience where practical

### PWA requirements

The MVP should include:

- Web app manifest
- Installable PWA configuration
- App icons / splash assets
- Standalone display mode
- Responsive desktop and mobile layouts
- Local persistence between sessions
- Graceful offline access to previously saved data
- No account requirement for V1

The development goal is:

> **One polished codebase that feels intentionally designed on desktop and mobile, and can be installed as an app from the browser.**

### Suggested component list

```txt
MaterialPanel
TranslucencySelector
WaterSourcePicker
DryingSourcePicker
SignalPicker
RoleCard
RoleSelector
ReappraisalCard
CheckInForm
DailySummary
JourneyCalendar
InsightCard
FactorChip
RoleSessionCard
EmptyState
OnboardingStep
```

---

## 28. Material Panel Implementation Idea

The material panel can be generated with layered CSS rather than images.

Possible layers:

1. Base translucent panel
2. backdrop-filter blur
3. soft grain/noise overlay
4. internal radial highlights
5. moisture-like opacity texture
6. border + subtle inner light

Pseudo-style:

```css
.panel {
  background: rgba(255,255,255,var(--opacity));
  backdrop-filter: blur(var(--blur));
  border: 1px solid rgba(255,255,255,0.45);
  box-shadow: inset 0 1px rgba(255,255,255,0.45);
}

.panel::before {
  /* soft moisture / fibre texture */
}

.panel::after {
  /* diffused internal light */
}
```

As translucency increases:

- base opacity decreases,
- background visibility increases,
- moisture texture becomes more visible,
- blur changes subtly,
- panel should remain visually intact.

---

## 29. MVP Scope

### Must Have

- Onboarding
- Material panel
- Daily check-in
- Water sources
- Drying sources
- Optional signals
- Roles
- Role-based reappraisal
- History
- Simple insights
- Local data storage
- Privacy/delete data
- Minimal reminders

### Nice to Have

- Custom roles
- Custom factors
- Export data
- Animated panel transitions
- Suggested role based on context

### Later

- AI-generated reappraisal
- Therapist mode
- Wearable integrations
- Sleep integration
- Apple Health / Google Fit
- Advanced correlation analysis
- Cross-device sync
- Shared therapy reports
- Crisis/support resources by region
- Voice journaling

---

## 30. Explicit Non-Goals for V1

Do NOT build:

- symptom diagnosis,
- medical chatbot,
- medication advice,
- emergency triage,
- mood-streak gamification,
- social feed,
- public profiles,
- community reassurance boards,
- symptom heatmaps,
- pain tracking,
- body diagrams,
- compulsive check-in loops,
- “anxiety score” leaderboards,
- pseudo-scientific nervous-system scores.

---

## 31. Success Criteria for Version 1

A successful first version should make a user able to say:

> **“I can see why I feel more sensitive today.”**

> **“I can see what tends to add water.”**

> **“I can see what usually helps me dry.”**

> **“I do not have to interpret every bodily sensation as danger.”**

> **“I have a perspective I can borrow when I feel overwhelmed.”**

> **“I have been this translucent before, and I became opaque again.”**

The user should leave the app feeling:

- more oriented,
- less confused,
- less compelled to investigate every sensation,
- and more willing to return to ordinary life.

---

## 32. North-Star Product Principle

> **The app should help the user understand themselves without teaching them to monitor themselves more.**

If a feature increases checking, measuring, reassurance-seeking, or symptom fixation, it conflicts with the core product philosophy.

If a feature helps the user understand the pattern, choose a response, and then return to life outside the app, it belongs.

---

## 33. Suggested First Build Task for the Coding Agent

Build a polished, responsive MVP prototype with:

1. **Onboarding**
   - Explain translucency, water, drying, and roles.

2. **Home Dashboard**
   - Large interactive translucent material panel.
   - Current state.
   - Water added.
   - Drying sources.
   - Suggested role.
   - One historical insight.

3. **Daily Check-In**
   - State selector.
   - Factor chips.
   - Optional signals.
   - Save locally.

4. **Roles**
   - Boxer
   - Soldier
   - Observer
   - Explorer
   - Future Me
   - Athlete in Recovery

5. **Reappraisal Flow**
   - Concern/context input.
   - Anxiety appraisal.
   - Role-based appraisal.
   - “Carry this perspective” state.
   - Helpfulness reflection.

6. **Journey**
   - 30-day view using mini material panels.

7. **Insights**
   - Most frequent water sources.
   - Most frequent drying sources.
   - Most helpful roles.
   - Previous high-translucency recovery episodes.

8. **Local-first persistence**
   - Use IndexedDB for core user data.
   - Use localStorage only for lightweight UI/preferences where appropriate.
   - No authentication required in v1.

9. **Responsive Next.js PWA**
   - Desktop and mobile are both first-class targets.
   - Desktop must use an intentional multi-column layout rather than a stretched mobile interface.
   - Make the app installable from supported browsers.
   - Include a PWA manifest, service worker, app icons, standalone mode, and offline-friendly access to saved local data.

The first build should prioritise **interaction quality, visual polish, cross-device responsiveness, and emotional clarity** over backend complexity.

---

## 34. One-Sentence Product Pitch

> **Translucency is a visual anxiety-awareness app that helps you understand what is making your nervous system feel more sensitive, see what helps you recover, and borrow healthier perspectives when thoughts or sensations become loud.**

---

## 35. Shorter App Store-Style Description

> **See your stress before it becomes your story.**  
> Translucency turns accumulated stress into a visual material state, helping you understand what adds pressure, what restores you, and which perspectives help you respond differently when your mind or body feels unusually loud.

---

## 36. Key Brand Lines

Possible reusable copy:

> **Translucent does not mean damaged.**

> **You are carrying more today.**

> **What added water?**

> **What helped you dry?**

> **You have been here before.**

> **Signals can be loud without being dangerous.**

> **Borrow a perspective, not a personality.**

> **You do not have to solve every sensation.**

> **Your state can change without you forcing it.**

> **Understand yourself. Then return to your life.**
