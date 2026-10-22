"use client";

import { useState } from "react";
import "./faqSection.css";

type Faq = {
  question: string;
  answer: string;
};

const faqs: Faq[] = [
  {
    question: "Do I need to be experienced to join?",
    answer: "First-time hackers are welcome, you do not need previous experience to join.",
  },
  {
    question: "Do I need to be an Ontario Tech student?",
    answer: "Nope, we encourage students from all colleges/universities to apply.",
  },
  {
    question: "If I have graduated university, can I participate?",
    answer:
      "Unfortunately no, you can only participate if you have not yet graduated from university but are studying as a student.",
  },
  {
    question: "Do I need to be in-person for the event?",
    answer:
      "Yes, every team member needs to have attended at least one of the days in-person. Each team additionally needs to have at least one team member present for the opening ceremony and closing ceremony.",
  },
  {
    question: "I have dietary restrictions or allergies, will there be accommodations?",
    answer:
      "We try our best to accommodate everyone's dietary restrictions and allergies, please make sure to include it when you register!",
  },
  {
    question: "How many people can I have on my team?",
    answer: "The maximum amount of team members for this challenge is 4, so that's 3 other team members including you!",
  },
];

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
      <p className="faq-contact">
        Have more questions? Contact us at <strong>otu.csclub.com</strong> with the subject
        &quot;Hackhive 2027 question&quot;.
      </p>
    </section>
  );
}
