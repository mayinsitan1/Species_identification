#!/usr/bin/env python3
import csv
import json
import re
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit, urlunsplit
from urllib.request import Request, urlopen


BASE = "https://www.nsii.org.cn/2017/"
OUT_DIR = Path("NSII_无尾两栖类鸣声专题")
SPECIES_API = BASE + "api/AnuraVoice.php?a=species&page=1&pagesize=100"
USER_AGENT = "Mozilla/5.0 (compatible; NSII-Anura-Archive/1.0)"


def safe_name(value, fallback="unknown"):
    value = (value or fallback).strip()
    value = re.sub(r'[\\/:*?"<>|\r\n\t]+', "_", value)
    value = re.sub(r"\s+", " ", value)
    return value[:140].strip(" ._") or fallback


def encoded_url(url):
    parts = urlsplit(url)
    path = quote(parts.path, safe="/%")
    query = quote(parts.query, safe="=&%")
    return urlunsplit((parts.scheme, parts.netloc, path, query, parts.fragment))


def fetch_bytes(url, attempts=4):
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            req = Request(encoded_url(url), headers={"User-Agent": USER_AGENT})
            with urlopen(req, timeout=45) as response:
                return response.read(), response.headers.get("Content-Type", "")
        except (HTTPError, URLError, TimeoutError) as exc:
            last_error = exc
            time.sleep(min(2 * attempt, 8))
    raise last_error


def fetch_json(url):
    raw, _ = fetch_bytes(url)
    text = raw.decode("utf-8-sig").strip()
    return json.loads(text)


def extension_from(item, url):
    suffix = Path(urlsplit(url).path).suffix
    if suffix:
        return suffix.lower()
    ext = (item.get("extension") or "").strip().lower()
    if ext:
        return "." + ext.lstrip(".")
    return ".bin"


def download_file(url, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size > 0:
        return "exists", target.stat().st_size, ""
    try:
        data, content_type = fetch_bytes(url)
        target.write_bytes(data)
        return "downloaded", len(data), content_type
    except Exception as exc:
        return "failed", 0, repr(exc)


def write_csv(path, rows, fieldnames):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main():
    OUT_DIR.mkdir(exist_ok=True)
    species = fetch_json(SPECIES_API)

    species_rows = []
    media_rows = []
    failures = []

    for index, sp in enumerate(species, 1):
        spid = sp.get("spid", "")
        cname = sp.get("cname", "")
        sname = (sp.get("sname") or "").strip()
        family_c = sp.get("family_c", "")
        family = sp.get("family", "")
        genus_c = sp.get("genus_c", "")
        genus = sp.get("genus", "")

        folder_name = safe_name(f"{index:02d}_{cname}_{sname}")
        species_dir = OUT_DIR / folder_name
        photo_dir = species_dir / "照片"
        audio_dir = species_dir / "鸣声"
        species_dir.mkdir(parents=True, exist_ok=True)

        species_record = {
            "序号": index,
            "spid": spid,
            "中文名": cname,
            "拉丁名": sname,
            "英文名": sp.get("ename", ""),
            "科中文名": family_c,
            "科拉丁名": family,
            "属中文名": genus_c,
            "属拉丁名": genus,
            "分类地位": sp.get("class", ""),
            "鉴别特征": sp.get("desp", ""),
            "分布范围": sp.get("distribution", ""),
            "生境信息": sp.get("habitat", ""),
            "习性": sp.get("habits", ""),
            "繁殖季节": sp.get("breedingseason", ""),
            "详情页": f"https://www.nsii.org.cn/2017/AnuraVoiceD.php?spid={spid}",
            "物种文件夹": str(species_dir),
        }
        species_rows.append(species_record)

        (species_dir / "species_info.json").write_text(
            json.dumps(sp, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        for media_type, api_name, subdir in [
            ("照片", "photo", photo_dir),
            ("鸣声", "audio", audio_dir),
        ]:
            items_url = f"{BASE}api/AnuraVoice.php?a={api_name}&spid={spid}"
            try:
                items = fetch_json(items_url)
            except Exception as exc:
                failures.append({"spid": spid, "media_type": media_type, "url": items_url, "error": repr(exc)})
                continue

            for item_index, item in enumerate(items, 1):
                url = item.get("PhotoURL") or ""
                ext = extension_from(item, url)
                original = safe_name(item.get("filename") or f"{media_type}_{item_index:02d}")
                filename = safe_name(f"{media_type}_{item_index:02d}_ID{item.get('ID', '')}_{original}") + ext
                target = subdir / filename

                status, size, content_type_or_error = download_file(url, target)
                if status == "failed":
                    failures.append({
                        "spid": spid,
                        "media_type": media_type,
                        "url": url,
                        "target": str(target),
                        "error": content_type_or_error,
                    })

                media_rows.append({
                    "物种序号": index,
                    "spid": spid,
                    "中文名": cname,
                    "拉丁名": sname,
                    "科中文名": family_c,
                    "科拉丁名": family,
                    "属中文名": genus_c,
                    "属拉丁名": genus,
                    "媒体类型": media_type,
                    "媒体序号": item_index,
                    "媒体ID": item.get("ID", ""),
                    "鸣声类型": item.get("type", ""),
                    "作者/录制人": item.get("author", ""),
                    "地点": item.get("place", ""),
                    "日期": item.get("date", ""),
                    "时间": item.get("time", ""),
                    "备注": item.get("remark", ""),
                    "原始URL": url,
                    "本地文件": str(target),
                    "下载状态": status,
                    "文件大小bytes": size,
                    "Content-Type或错误": content_type_or_error,
                })

        print(f"[{index:02d}/{len(species):02d}] {cname} {sname}")
        time.sleep(0.15)

    species_fields = [
        "序号", "spid", "中文名", "拉丁名", "英文名", "科中文名", "科拉丁名", "属中文名", "属拉丁名",
        "分类地位", "鉴别特征", "分布范围", "生境信息", "习性", "繁殖季节", "详情页", "物种文件夹",
    ]
    media_fields = [
        "物种序号", "spid", "中文名", "拉丁名", "科中文名", "科拉丁名", "属中文名", "属拉丁名",
        "媒体类型", "媒体序号", "媒体ID", "鸣声类型", "作者/录制人", "地点", "日期", "时间", "备注",
        "原始URL", "本地文件", "下载状态", "文件大小bytes", "Content-Type或错误",
    ]

    write_csv(OUT_DIR / "species_manifest.csv", species_rows, species_fields)
    write_csv(OUT_DIR / "media_manifest.csv", media_rows, media_fields)
    (OUT_DIR / "species_manifest.json").write_text(json.dumps(species_rows, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_DIR / "media_manifest.json").write_text(json.dumps(media_rows, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_DIR / "download_failures.json").write_text(json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = {
        "source": "https://www.nsii.org.cn/2017/AnuraVoice.php",
        "species_count": len(species_rows),
        "photo_count": sum(1 for row in media_rows if row["媒体类型"] == "照片"),
        "audio_count": sum(1 for row in media_rows if row["媒体类型"] == "鸣声"),
        "failed_count": len(failures),
        "output_dir": str(OUT_DIR),
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    readme = "\n".join([
        "# NSII 无尾两栖类鸣声专题下载整理",
        "",
        f"来源：{summary['source']}",
        f"物种数：{summary['species_count']}",
        f"照片记录数：{summary['photo_count']}",
        f"鸣声记录数：{summary['audio_count']}",
        f"下载失败数：{summary['failed_count']}",
        "",
        "每个物种一个文件夹，内部含 `照片/`、`鸣声/` 和 `species_info.json`。",
        "`species_manifest.csv` 是物种与分类总表，`media_manifest.csv` 是所有媒体文件索引。",
        "请遵守来源网站和原作者对图片、录音的版权与引用要求。",
        "",
    ])
    (OUT_DIR / "README.md").write_text(readme, encoding="utf-8")

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
