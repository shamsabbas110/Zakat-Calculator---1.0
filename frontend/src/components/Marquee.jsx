import React from 'react';
import '../styles/Marquee.css';

/**
 * Marquee Component — Infinite horizontal scrolling text banner.
 *
 * How the seamless loop works:
 * - We render the text content TWICE inside a single flex track.
 * - CSS animates the track from translateX(0) to translateX(-50%).
 * - When it reaches -50% (exactly one copy's width), it snaps back to 0 — 
 *   but because the two copies are identical, the snap is invisible = seamless loop.
 */

// The repeating text items (bullet-separated)
const ITEMS = [
  'Calculate Your Zakat',
  'Purify Your Wealth',
  'Calculate Your Zakat',
  'Give & Be Blessed',
  'Calculate Your Zakat',
  'Track Every Year',
];

export default function Marquee() {
  // Build one full "set" of items as a string of spans
  const ItemSet = () => (
    <>
      {ITEMS.map((text, i) => (
        <span key={i} className="marquee__item">
          {text}
          {/* Bullet separator */}
          <span className="marquee__dot" aria-hidden="true">•</span>
        </span>
      ))}
    </>
  );

  return (
    // Outer container — hides overflow so text slides behind edges
    <div className="marquee" aria-label="Scrolling banner: Calculate Your Zakat">
      {/* 
        The track holds TWO copies of the items.
        CSS moves it left by 50% (= one full copy width) then resets → seamless.
      */}
      <div className="marquee__track">
        {/* Copy 1 */}
        <ItemSet />
        {/* Copy 2 — exact duplicate for the seamless wrap */}
        <ItemSet />
      </div>
    </div>
  );
}
