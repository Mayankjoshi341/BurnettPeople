import { useEffect, useState } from "react";

const phrases = [
  "great things.",
  "stronger teams.",
  "better workdays.",
  "lasting impact.",
];

export default function TypingHeadline() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = phrases[phraseIndex];

    let delay = deleting ? 45 : 85;

    if (!deleting && text === phrase) delay = 1400;
    if (deleting && text === "") delay = 250;

    const timer = setTimeout(() => {
      if (!deleting && text === phrase) {
        setDeleting(true);
      } else if (deleting && text === "") {
        setDeleting(false);
        setPhraseIndex((i) => (i + 1) % phrases.length);
      } else {
        setText(
          deleting
            ? text.slice(0, -1)
            : phrase.slice(0, text.length + 1)
        );
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [text, deleting, phraseIndex]);

  return (
    <span className="typing-headline">
      {text}
      <span className="typing-cursor" aria-hidden="true">|</span>
    </span>
  );
}
