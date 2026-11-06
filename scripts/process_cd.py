import json
import re
import sys
from pathlib import Path
import pypinyin

HAN_RE = re.compile(r'[\u4e00-\u9fff]')

def generate_pinyin_syllables(hanzi_text):
    """Generate exact 1:1 pinyin syllables for each Hanzi character, preserving punctuation."""
    syllables = []
    for ch in hanzi_text:
        if HAN_RE.match(ch):
            py = pypinyin.pinyin(ch, style=pypinyin.Style.TONE)[0][0]
            syllables.append(py)
        elif ch in '，,':
            syllables.append(',')
        elif ch in '。.':
            syllables.append('.')
        elif ch in '？?':
            syllables.append('?')
        elif ch in '！!':
            syllables.append('!')
        elif ch in '·':
            syllables.append('·')
    return ' '.join(syllables)

def clean_word_token(word):
    return word.strip()

def process_raw_file(raw_path: Path, output_path: Path):
    with open(raw_path, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    track_name = raw_data['track_name']
    m = re.search(r'Chinese\s+(Foundation|Advanced|Vocabulary)\s+CD(\d+)-(\d+)', track_name)
    if not m:
        raise ValueError(f"Could not parse track info from {track_name}")

    course_name = f"Chinese {m.group(1)}"
    level_slug = m.group(1).lower()
    cd_num = int(m.group(2))
    track_num = int(m.group(3))

    track_id = f"{level_slug}-cd{cd_num:02d}-{track_num:02d}"
    title = f"{course_name} CD {cd_num} - Track {track_num}"
    audio_url = f"audio/{level_slug}-cd{cd_num:02d}/track-{track_num:02d}.mp3"
    duration = raw_data['duration_seconds']

    segments = []
    prev_end = 0.0

    raw_segs = raw_data['segments']
    for idx, s in enumerate(raw_segs):
        s_start = round(max(float(s['start']), prev_end), 2)
        s_end = round(max(float(s['end']), s_start + 0.1), 2)
        prev_end = s_end

        text = s['text'].strip()
        words = s.get('words', [])

        # Default classification
        speaker = "teacher"
        speaker_name = "Harold Goodman (Teacher)"
        seg_type = "instruction"

        # Check for intro announcer in CD1 Track 1
        if cd_num == 1 and track_num == 1 and s_start < 18.5:
            speaker = "announcer"
            speaker_name = "Narrator (Intro)"
            seg_type = "credits" if "Copyright" in text or "rights reserved" in text or "recording" in text else "course_title"

        # Determine language
        has_hanzi = bool(HAN_RE.search(text))
        is_zh_speech = False

        if has_hanzi:
            # If majority characters are Hanzi
            hanzi_count = len([c for c in text if HAN_RE.match(c)])
            total_chars = len([c for c in text if not c.isspace()])
            if hanzi_count / max(total_chars, 1) > 0.4:
                is_zh_speech = True

        processed_words = []
        if is_zh_speech:
            language = "zh"
            hanzi_str = text
            pinyin_str = generate_pinyin_syllables(hanzi_str)
            english_str = "" # Spoken Chinese turn

            # Word tokens for zh lines: MUST have hanzi and pinyin and NO text property
            # Distribute words across characters
            w_prev_end = s_start
            char_count = len(hanzi_str)
            dur_per_char = max((s_end - s_start) / max(char_count, 1), 0.06)
            for j, ch in enumerate(hanzi_str):
                ch_start = round(max(s_start + j * dur_per_char, w_prev_end), 2)
                ch_end = round(ch_start + dur_per_char, 2)
                w_prev_end = ch_end

                if HAN_RE.match(ch):
                    py_syll = pypinyin.pinyin(ch, style=pypinyin.Style.TONE)[0][0]
                    processed_words.append({
                        "hanzi": ch,
                        "pinyin": py_syll,
                        "start": ch_start,
                        "end": ch_end
                    })
            if processed_words:
                s_end = round(max(s_end, processed_words[-1]['end']), 2)
                prev_end = s_end
        else:
            language = "en"
            english_str = text
            # Gloss / placeholder Chinese translation for English instruction lines
            hanzi_str = ""
            pinyin_str = ""

            # English word tokens: MUST cover full English text
            raw_tokens = re.split(r'\s+', english_str)
            if words and len(words) >= len(raw_tokens) * 0.8:
                # Use Whisper word timestamps
                w_prev_end = s_start
                for w in words:
                    w_text = w['word'].strip()
                    if not w_text:
                        continue
                    w_start = round(max(float(w['start']), s_start, w_prev_end), 2)
                    w_end = round(max(float(w['end']), w_start + 0.05), 2)
                    w_prev_end = w_end
                    processed_words.append({
                        "text": w_text,
                        "start": w_start,
                        "end": w_end
                    })
                if processed_words:
                    s_end = round(max(s_end, processed_words[-1]['end']), 2)
                    prev_end = s_end
            else:
                # Synthesize word timestamps evenly across segment
                w_prev_end = s_start
                dur_per_w = max((s_end - s_start) / max(len(raw_tokens), 1), 0.06)
                for j, tok in enumerate(raw_tokens):
                    w_start = round(max(s_start + j * dur_per_w, w_prev_end), 2)
                    w_end = round(w_start + dur_per_w, 2)
                    w_prev_end = w_end
                    processed_words.append({
                        "text": tok,
                        "start": w_start,
                        "end": w_end
                    })
                if processed_words:
                    s_end = round(max(s_end, processed_words[-1]['end']), 2)
                    prev_end = s_end

        seg_obj = {
            "id": f"seg-{idx+1:03d}",
            "start": s_start,
            "end": s_end,
            "speaker": speaker,
            "speakerName": speaker_name,
            "type": seg_type,
            "language": language,
            "english": english_str,
            "hanzi": hanzi_str,
            "pinyin": pinyin_str,
            "words": processed_words
        }
        segments.append(seg_obj)

    out_doc = {
        "trackId": track_id,
        "course": course_name,
        "cd": cd_num,
        "track": track_num,
        "title": title,
        "audioUrl": audio_url,
        "durationSeconds": duration,
        "segments": segments
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(out_doc, f, ensure_ascii=False, indent=2)

    return out_doc
