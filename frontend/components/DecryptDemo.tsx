"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CHARSET = "01█▓▒░#$%&";
const ENCRYPTED = "██.██ ETH · pending cooldown";
const DECRYPTED = "12.40 ETH · decrypted by holder";

export function DecryptDemo() {
  const [text, setText] = useState(ENCRYPTED);
  const [unlocked, setUnlocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrambleTo = useCallback((target: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    let frame = 0;
    timerRef.current = setInterval(() => {
      let out = "";
      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        if (ch === " " || ch === "·" || ch === ".") {
          out += ch;
        } else if (i < frame - 4) {
          out += ch;
        } else {
          out += CHARSET[Math.floor(Math.random() * CHARSET.length)];
        }
      }
      setText(out);
      frame++;
      if (frame > target.length + 4 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setText(target);
      }
    }, 28);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const unlock = () => {
    setUnlocked(true);
    scrambleTo(DECRYPTED);
  };

  const relock = () => {
    setUnlocked(false);
    scrambleTo(ENCRYPTED);
  };

  const toggle = () => (unlocked ? relock() : unlock());

  return (
    <div className="decrypt-demo">
      <p className="decrypt-label">
        What a searcher sees: hover or tap to decrypt as the holder
      </p>
      <div
        className={unlocked ? "decrypt-row unlocked" : "decrypt-row"}
        role="button"
        tabIndex={0}
        aria-pressed={unlocked}
        aria-label="Toggle decrypted view of the confidential amount"
        onMouseEnter={unlock}
        onMouseLeave={relock}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
      >
        <svg
          className="lock-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          {unlocked ? (
            <g>
              <rect x="5.5" y="10.5" width="13" height="8.5" rx="1.5" />
              <path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.6-1.7" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              <rect x="5.5" y="10.5" width="13" height="8.5" rx="1.5" />
              <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" strokeLinecap="round" />
            </g>
          )}
        </svg>
        <span className="decrypt-text">{text}</span>
      </div>
      <p className="decrypt-caption">
        Encrypted by default. The amount is only decipherable by the holder,
        inside the Nox TEE.
      </p>
    </div>
  );
}
