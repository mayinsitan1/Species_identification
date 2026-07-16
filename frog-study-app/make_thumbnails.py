#!/usr/bin/env python3
import csv
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "NSII_无尾两栖类鸣声专题"
THUMBS = ROOT / "frog-study-app" / "thumbs"


def read_media():
    with (SOURCE / "media_manifest.csv").open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main():
    THUMBS.mkdir(parents=True, exist_ok=True)
    made = 0
    for row in read_media():
        if row["媒体类型"] != "照片":
            continue
        source = ROOT / row["本地文件"]
        target = THUMBS / f"photo_{row['媒体ID']}.jpg"
        if target.exists() and target.stat().st_size > 0:
            continue
        subprocess.run(["sips", "-s", "format", "jpeg", "-Z", "520", str(source), "--out", str(target)], check=True, stdout=subprocess.DEVNULL)
        made += 1
    print(f"Created {made} thumbnails in {THUMBS}")


if __name__ == "__main__":
    main()
