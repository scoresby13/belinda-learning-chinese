import os
import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SRC_BASE = Path(os.environ.get("CHINESE_AUDIO_DIR", BASE_DIR.parent / "learningchinese" / "Chinese"))
INDEX_PATH = BASE_DIR / "public" / "data" / "course_index.json"

levels_config = [
    {
        "id": "foundation",
        "title": "Chinese Foundation",
        "totalDiscs": 8,
        "folderPrefix": "Chinese Foundation CD"
    },
    {
        "id": "advanced",
        "title": "Chinese Advanced",
        "totalDiscs": 4,
        "folderPrefix": "Chinese Advanced CD"
    },
    {
        "id": "vocabulary",
        "title": "Chinese Vocabulary",
        "totalDiscs": 4,
        "folderPrefix": "Chinese Vocabulary CD"
    }
]

def build_index():
    course_data = {
        "title": "Michel Thomas Mandarin Chinese Course",
        "levels": []
    }

    for lvl in levels_config:
        lvl_obj = {
            "id": lvl["id"],
            "title": lvl["title"],
            "totalDiscs": lvl["totalDiscs"],
            "discs": []
        }

        for cd_idx in range(1, lvl["totalDiscs"] + 1):
            cd_folder = SRC_BASE / f"{lvl['folderPrefix']}{cd_idx}"
            tracks_files = sorted(list(cd_folder.glob("*.mp3")))

            cd_obj = {
                "cd": cd_idx,
                "title": f"{lvl['title'].replace('Chinese ', '')} CD {cd_idx}",
                "tracks": []
            }

            for t_file in tracks_files:
                tm = re.search(r'CD\d+-(\d+)', t_file.stem)
                if not tm:
                    continue
                tr_num = int(tm.group(1))
                track_id = f"{lvl['id']}-cd{cd_idx:02d}-{tr_num:02d}"
                data_file = f"data/{lvl['id']}_cd{cd_idx:02d}_track{tr_num:02d}.json"
                audio_url = f"audio/{lvl['id']}-cd{cd_idx:02d}/track-{tr_num:02d}.mp3"

                cd_obj["tracks"].append({
                    "track": tr_num,
                    "id": track_id,
                    "title": f"Track {tr_num}",
                    "dataFile": data_file,
                    "audioUrl": audio_url
                })

            lvl_obj["discs"].append(cd_obj)

        course_data["levels"].append(lvl_obj)

    with open(INDEX_PATH, 'w', encoding='utf-8') as f:
        json.dump(course_data, f, ensure_ascii=False, indent=2)

    total_t = sum(len(cd["tracks"]) for lvl in course_data["levels"] for cd in lvl["discs"])
    print(f"Built course_index.json with {total_t} tracks across {len(course_data['levels'])} levels!")

if __name__ == '__main__':
    build_index()
