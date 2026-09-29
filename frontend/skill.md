# Frontend Design & UI System Skill

## Purpose

This skill defines how to design and maintain the frontend of a mobile-first Telegram Mini App focused on earning, rewards, games, spins, contests, referrals, and wallet-related experiences.

This phase is **frontend/design only**.

Do not implement or design backend systems, APIs, databases, authentication logic, payment processing, reward validation, or production earning logic unless explicitly requested later.

Use mock/static data where necessary.

---

## 1. Design Direction

The visual direction should feel like:

* A colorful game/reward application
* Crypto/earning focused
* Vibrant and energetic
* Modern rather than childish
* Visually engaging without becoming chaotic

The main visual identity should use an emerald-inspired green as the foundation.

The interface should use vibrant supporting colors such as purple, blue, pink, green, and yellow where appropriate.

The overall design should feel cohesive. Do not randomly apply bright colors to every element.

Cards should generally use slightly lighter emerald tones against the main emerald background.

Special reward/game components may intentionally use stronger colors or gradients when appropriate.

Cards should generally use moderate rounded corners, approximately 16–20px, while special game elements may use their own appropriate shape.

The Home screen should not feel overly dense. Maintain comfortable visual breathing room.

---

## 2. Mobile-First

The application is designed primarily for mobile use inside Telegram.

Prioritize:

* Touch interaction
* Clear hierarchy
* Readability
* Comfortable spacing
* Large enough interactive areas
* Simple navigation
* Fast visual understanding

Do not design the interface like a desktop dashboard and simply shrink it for mobile.

The mobile experience is the primary experience.

---

## 3. Home Screen Concept

The Home screen is centered around the Spin experience.

There should not be a conventional bottom navigation bar as the primary navigation model.

The central Spin Wheel is the main visual element of Home and should be immediately visible.

The surrounding interface can contain smaller feature cards such as:

* Raffle
* Contest
* Invite
* Gift
* Wallet
* Daily In
* * Spins

These supporting cards should complement the central Spin experience rather than compete with it.

When a user selects one of these features, its corresponding experience/page should open.

The exact layout can evolve during implementation as long as the central Spin concept and visual hierarchy remain intact.

---

## 4. Reusable Component System

The frontend must be built around reusable components.

Do not create one-off implementations when an existing component can be reused.

Examples include:

* Cards
* Feature cards
* Task cards
* Reward cards
* Wallet cards
* Spin Wheel
* Buttons
* Badges
* Progress indicators
* Modals/popups
* Sections
* Headers
* Icons
* Reward states
* Empty states
* Loading states

Components should accept configuration/data rather than having their content permanently hard-coded.

For example, a reusable card should be capable of receiving:

* Title
* Description
* Icon
* Reward
* Action
* Variant
* Theme
* Visual configuration

Design and content should remain conceptually separate.

---

## 5. Design Configuration

Components should support configurable design properties when useful.

For example:

```ts
design: {
  variant: "colorful",
  theme: "emerald",
  size: "medium",
  radius: "medium",
  animation: "soft"
}
```

Do not expose unnecessary configuration simply for the sake of flexibility.

Configuration should make meaningful visual changes easy without requiring the component to be rewritten.

Prefer theme/design tokens over repeatedly hard-coding colors throughout components.

---

## 6. Spin Wheel

The Spin Wheel is a core reusable component.

It should not be treated as a one-off graphic.

The wheel should be capable of receiving configurable rewards, icons, labels, themes, and visual variants.

The wheel may support:

* Emoji
* Icon-library icons
* Custom SVG icons
* Images
* Reward values
* Labels
* Different segment counts
* Different visual themes
* Different center treatments
* Different pointer styles
* Animation styles

The wheel should be designed so that its visual appearance can change without rebuilding its underlying component.

For the design phase, reward results may use mock data.

Do not implement real reward determination or financial logic in the frontend during this phase.

---

## 7. Popups and Feature Experiences

Feature cards should generally lead to focused experiences rather than making the Home screen contain everything.

Use appropriate:

* Modals
* Bottom sheets
* Dialogs
* Dedicated views/pages

depending on the experience.

Do not force every feature into the same interaction pattern.

Choose the interaction that makes the experience easiest to understand on mobile.

---

## 8. Visual Consistency

Reusable components should maintain a consistent design language.

Before creating a new component, check whether an existing component can be extended.

If two components perform similar visual functions, prefer a shared component with variants rather than two unrelated implementations.

Avoid unnecessary duplication.

---

## 9. Change Discipline

When the user requests a specific change, make the smallest appropriate change.

For example:

> "Change the color of the wallet card."

Change the wallet card.

Do not redesign the Home screen.

If the user says:

> "Make the Spin Wheel more playful."

Modify the Spin Wheel's design.

Do not independently redesign unrelated cards.

Preserve existing behavior and visual decisions unless the requested change requires otherwise.

Do not "improve" unrelated parts of the application without permission.

---

## 10. Clarification Before Implementation

If a request is ambiguous and implementing it could materially change the design, ask the user before making the change.

Ask specific questions.

Do not ask vague questions such as:

> "What style do you want?"

Instead ask concrete questions such as:

> "Should the wheel become brighter or darker?"

or:

> "Should this card open a popup or a separate page?"

If the request is sufficiently clear, implement it without unnecessary questions.

---

## 11. Component Catalogue

Maintain a visual component catalogue during the design phase.

The catalogue should allow the user to visually identify components and understand their names.

Prefer:

`components.html`

over a purely textual component list.

The catalogue should display actual reusable components, not disconnected mockups.

Each component should have an identifiable name.

For example:

* SpinWheel
* FeatureCard
* TaskCard
* WalletCard
* RewardPopup
* ReferralCard
* Button
* Badge

When a component is changed, the catalogue should reflect the current implementation.

The catalogue may also show useful variants and states.

The purpose is to make visual feedback easy.

The user should be able to say:

> "Change the FeatureCard shown in the catalogue."

and the agent should know exactly which reusable component is being discussed.

---

## 12. Component Naming

Use clear, stable, descriptive component names.

Prefer:

`SpinWheel`

`FeatureCard`

`TaskCard`

`RewardModal`

over vague names such as:

`Box1`

`CardNew`

`Thing`

Do not rename an established component without a good reason.

Stable names are important because the user will use them to request future changes.

---

## 13. Design Before Backend

During this phase:

* Use mock data.
* Focus on visual design.
* Focus on interactions.
* Focus on responsive behavior.
* Focus on reusable components.
* Focus on component variants.
* Focus on animation and visual states.

Do not introduce backend dependencies simply because the UI eventually needs them.

Use clear mock interfaces where backend behavior will eventually connect.

---

## 14. Preserve User Control

The user is the final design authority.

Do not silently make major design decisions that contradict explicit user instructions.

When there are multiple reasonable interpretations and the choice would significantly affect the interface, ask first.

When there is a small implementation detail that does not materially affect the requested design, make a sensible professional choice.

---

## 15. Implementation Philosophy

Build the frontend as a small reusable design system rather than a collection of unrelated screens.

Think in terms of:

**Components → Variants → Sections → Experiences → Screens**

rather than:

**Screen → custom HTML → custom CSS → repeat**

The goal is to make future design changes fast, isolated, predictable, and visually consistent.
