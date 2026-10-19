"use client";

import { useState } from "react";
import "./faqSection.css";

type Faq = {
  question: string;
  answer: string;
};

// Placeholders until the real questions are written.
const faqs: Faq[] = Array.from({ length: 6 }, (_, i) => ({
  question: `Question ${i + 1}?`,
  answer: `Answer to question ${i + 1} goes here.`,
}));

// A stretched hexagon that flips over on click to show its answer.
function FaqCard({ question, answer }: Faq) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      type="button"
      className="faq-card"
      aria-pressed={flipped}
      onClick={() => setFlipped(!flipped)}
    >
      <span className="faq-card-inner">
        <span className="faq-face faq-front" aria-hidden={flipped}>
          <span className="faq-face-inner">{question}</span>
        </span>
        <span className="faq-face faq-back" aria-hidden={!flipped}>
          <span className="faq-face-inner">{answer}</span>
        </span>
      </span>
    </button>
  );
}

export function FaqSection() {
  return (
    <section id="faq" aria-label="FAQ" className="faq-page scroll-mt-16">
      <h1>Frequently asked questions</h1>
      <div className="faq-grid">
        {faqs.map((faq) => (
          <FaqCard key={faq.question} {...faq} />
        ))}
      </div>
    </section>
  );
}
