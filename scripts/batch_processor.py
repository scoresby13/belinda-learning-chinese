import sys
import os
import re
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from scripts.process_cd import process_raw_file
from scripts.validate_transcript import validate_transcript_file

sys.stdout.reconfigure(encoding='utf-8')

def process_cd_directory(cd_slug: str):
    raw_dir = BASE_DIR / "raw_transcripts" / cd_slug
    out_dir = BASE_DIR / "public" / "data"

    if not raw_dir.exists():
        print(f"Directory not found: {raw_dir}")
        return False

    raw_files = sorted(list(raw_dir.glob("*_raw.json")))
    print(f"\n==========================================")
    print(f"Processing {cd_slug}: {len(raw_files)} tracks")
    print(f"==========================================")

    all_passed = True
    for rf in raw_files:
        m = re.search(r'Chinese\s+(\w+)\s+CD(\d+)-(\d+)', rf.name)
        if not m:
            print(f"Skipping unrecognized file: {rf.name}")
            continue

        lvl = m.group(1).lower()
        cd = int(m.group(2))
        tr = int(m.group(3))
        out_file = out_dir / f"{lvl}_cd{cd:02d}_track{tr:02d}.json"

        doc = process_raw_file(rf, out_file)
        errors, warnings = validate_transcript_file(out_file)

        if errors:
            print(f"❌ {out_file.name} FAILED validation ({len(errors)} errors):")
            for err in errors[:3]:
                print(f"   - {err}")
            all_passed = False
        else:
            print(f"✅ {out_file.name} PASSED ({len(doc['segments'])} segs, {len(warnings)} warns)")

    return all_passed

if __name__ == '__main__':
    slugs = sys.argv[1:] if len(sys.argv) > 1 else ['foundation_cd01']
    overall = True
    for s in slugs:
        ok = process_cd_directory(s)
        if not ok:
            overall = False
    if overall:
        print("\n🎉 All requested CDs processed and validated with 0 ERRORS!")
    else:
        print("\n⚠️ Some tracks had errors.")
