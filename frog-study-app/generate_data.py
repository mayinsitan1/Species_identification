#!/usr/bin/env python3
import csv
import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "NSII_无尾两栖类鸣声专题"
APP = ROOT / "frog-study-app"


def app_path(path):
    return "../" + Path(path).as_posix()


def thumb_path(media_id):
    path = APP / "thumbs" / f"photo_{media_id}.jpg"
    return f"thumbs/photo_{media_id}.jpg" if path.exists() else ""


def read_csv(path):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main():
    species_rows = read_csv(SOURCE / "species_manifest.csv")
    media_rows = read_csv(SOURCE / "media_manifest.csv")
    summary = json.loads((SOURCE / "summary.json").read_text(encoding="utf-8"))

    photos = defaultdict(list)
    audios = defaultdict(list)
    for row in media_rows:
        item = {
            "id": row["媒体ID"],
            "file": app_path(row["本地文件"]),
            "thumb": thumb_path(row["媒体ID"]) if row["媒体类型"] == "照片" else "",
            "source": row["原始URL"],
            "type": row["鸣声类型"],
            "author": row["作者/录制人"],
            "place": row["地点"],
            "date": row["日期"],
            "time": row["时间"],
            "remark": row["备注"],
        }
        if row["媒体类型"] == "照片":
            photos[row["spid"]].append(item)
        elif row["媒体类型"] == "鸣声":
            audios[row["spid"]].append(item)

    species = []
    for row in species_rows:
        spid = row["spid"]
        photo_list = photos[spid]
        audio_list = audios[spid]
        species.append({
            "index": int(row["序号"]),
            "spid": spid,
            "cname": row["中文名"],
            "latin": row["拉丁名"],
            "english": row["英文名"],
            "family": row["科中文名"],
            "familyLatin": row["科拉丁名"],
            "genus": row["属中文名"],
            "genusLatin": row["属拉丁名"],
            "taxonomy": row["分类地位"],
            "feature": row["鉴别特征"],
            "distribution": row["分布范围"],
            "habitat": row["生境信息"],
            "habits": row["习性"],
            "breeding": row["繁殖季节"],
            "detailUrl": row["详情页"],
            "cover": (photo_list[0]["thumb"] or photo_list[0]["file"]) if photo_list else "",
            "photos": photo_list,
            "audios": audio_list,
        })

    data = {
        "meta": {
            "source": summary["source"],
            "speciesCount": summary["species_count"],
            "photoCount": summary["photo_count"],
            "audioCount": summary["audio_count"],
        },
        "species": species,
    }
    target = APP / "data.js"
    target.write_text("window.FROG_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print(f"Wrote {target}")


if __name__ == "__main__":
    main()
