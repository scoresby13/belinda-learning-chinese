import os
import re
import sys
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SRC_BASE = Path(os.environ.get("CHINESE_AUDIO_DIR", BASE_DIR.parent / "learningchinese" / "Chinese"))
DST_BASE = BASE_DIR / "public" / "audio"

def compress_cd(cd_folder_name: str):
    src_dir = SRC_BASE / cd_folder_name
    if not src_dir.exists():
        print(f"Source folder not found: {src_dir}")
        return

    m = re.search(r'Chinese\s+(\w+)\s+CD(\d+)', cd_folder_name)
    if not m:
        print(f"Could not parse folder: {cd_folder_name}")
        return

    lvl = m.group(1).lower()
    cd_num = int(m.group(2))
    dst_dir = DST_BASE / f"{lvl}-cd{cd_num:02d}"
    dst_dir.mkdir(parents=True, exist_ok=True)

    tracks = sorted(list(src_dir.glob("*.mp3")))
    print(f"\nCompressing {cd_folder_name} -> {dst_dir.name} ({len(tracks)} tracks)...")

    for t in tracks:
        tm = re.search(r'CD\d+-(\d+)', t.stem)
        if not tm:
            continue
        tr_num = int(tm.group(1))
        dst_file = dst_dir / f"track-{tr_num:02d}.mp3"

        if dst_file.exists() and dst_file.stat().st_size > 1000:
            print(f"  [Track {tr_num:02d}] Already compressed ({dst_file.stat().st_size / 1024 / 1024:.2f} MB)")
            continue

        cmd = [
            'ffmpeg', '-y', '-i', str(t),
            '-c:a', 'libmp3lame',
            '-b:a', '64k',
            '-ac', '1',
            str(dst_file)
        ]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if res.returncode == 0:
            print(f"  [Track {tr_num:02d}] Compressed: {t.stat().st_size / 1024 / 1024:.2f} MB -> {dst_file.stat().st_size / 1024 / 1024:.2f} MB")
        else:
            print(f"  [Track {tr_num:02d}] FAILED to compress {t.name}")

if __name__ == '__main__':
    all_cds = sorted([d.name for d in SRC_BASE.iterdir() if d.is_dir()])
    target = sys.argv[1] if len(sys.argv) > 1 else 'ALL'
    if target == 'ALL':
        for cd in all_cds:
            compress_cd(cd)
    else:
        compress_cd(target)
