#!/usr/bin/env python3
"""
Transcript Data Validator for Learning Chinese
Enforces all synchronization, timing, typography, and schema rules
established between Gemini (data pipeline) and Claude (design system).
"""

import json
import re
import sys
from pathlib import Path

HAN_RE = re.compile(r'[\u4e00-\u9fff]')

def pinyin_syllables(pinyin: str):
    """Extract individual syllables, stripping punctuation like ·, ,, ."""
    words = pinyin.split()
    cleaned = [re.sub(r'^[^\w]+|[^\w]+$', '', w) for w in words]
    return [w for w in cleaned if w]

def validate_transcript_file(file_path: Path):
    with open(file_path, encoding='utf-8') as f:
        data = json.load(f)

    errors = []
    warnings = []
    
    segments = data.get('segments', [])
    if not segments:
        errors.append("Transcript contains no segments.")
        return errors, warnings

    for i, seg in enumerate(segments):
        sid = seg.get('id', f'segment-{i}')
        start = seg.get('start', 0.0)
        end = seg.get('end', 0.0)
        lang = seg.get('language', 'en')
        words = seg.get('words', [])

        # Rule 1: Non-zero valid segment duration
        if end <= start:
            errors.append(f"[{sid}] Invalid segment duration: start={start}, end={end}")

        # Rule 2: Segments must not overlap in time
        if i > 0:
            prev_end = segments[i - 1].get('end', 0.0)
            if start < prev_end - 1e-4:
                errors.append(f"[{sid}] Segment overlaps with previous! Starts at {start}s, prev ended at {prev_end}s.")

        # Rule 3: Hanzi and Pinyin syllable counts must match 1:1
        hanzi = seg.get('hanzi', '')
        pinyin = seg.get('pinyin', '')
        if hanzi and pinyin:
            han_chars = [c for c in hanzi if HAN_RE.match(c)]
            sylls = pinyin_syllables(pinyin)
            if len(han_chars) != len(sylls):
                errors.append(
                    f"[{sid}] Hanzi count ({len(han_chars)}) != Pinyin syllables ({len(sylls)}).\n"
                    f"       Hanzi:  '{hanzi}'\n"
                    f"       Pinyin: '{pinyin}'"
                )

        # Rule 4: Word-level checks
        if words:
            for j, w in enumerate(words):
                w_start = w.get('start', 0.0)
                w_end = w.get('end', 0.0)

                if w_end <= w_start:
                    errors.append(f"[{sid} word #{j}] Invalid word duration: {w_start}s to {w_end}s")

                if j > 0:
                    prev_w_end = words[j - 1].get('end', 0.0)
                    if w_start < prev_w_end - 1e-4:
                        errors.append(f"[{sid} word #{j}] Word overlaps with previous word! {w_start}s < {prev_w_end}s")

                if w_start < start - 0.25 or w_end > end + 0.25:
                    warnings.append(f"[{sid} word #{j}] Word timing ({w_start}s - {w_end}s) extends outside segment ({start}s - {end}s)")

                # Rule 5: Spoken Mandarin lines (language: "zh") must have hanzi & pinyin and NO text
                if lang == 'zh':
                    if 'text' in w:
                        errors.append(f"[{sid} word #{j}] Spoken Mandarin lines (zh) must NOT have a 'text' property. Found: text='{w['text']}'")
                    if not w.get('hanzi'):
                        errors.append(f"[{sid} word #{j}] Spoken Mandarin lines (zh) must have 'hanzi'.")

            # Rule 6: English lines must cover the full text
            if lang != 'zh':
                raw_en = seg.get('english', '')
                en_word_tokens = [w for w in re.split(r'\s+', raw_en) if w.strip()]
                if len(words) < len(en_word_tokens) * 0.8:
                    warnings.append(
                        f"[{sid}] Word list count ({len(words)}) is much shorter than English words ({len(en_word_tokens)}). "
                        f"Phrases may have been omitted from display!"
                    )

    return errors, warnings

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'public/data/foundation_cd01_track01.json'
    target_path = Path(target)
    if not target_path.exists():
        print(f"File not found: {target}")
        sys.exit(1)

    errs, warns = validate_transcript_file(target_path)
    print(f"Validation for: {target_path.name}")
    print(f"Errors: {len(errs)}, Warnings: {len(warns)}")
    for e in errs:
        print("  [ERROR]", e)
    for w in warns:
        print("  [WARN] ", w)

    if errs:
        sys.exit(1)
    else:
        print("All validations PASSED successfully!")
