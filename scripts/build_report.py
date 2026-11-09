#!/usr/bin/env python3
"""生成通用 Manta 审核报告，不绑定任何示例场景。

用法：
  python scripts/build_report.py [--project-dir /path/to/project] [visual.json]

visual.json 条目支持：id、kind、image/img、timestamp、source，以及
review/autoReview 中的 issues、suggestions、rules。未提供 visual.json 时，
自动发现 build/slides/*.png 与 build/frames/*.png。
"""
import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_ROOT = Path(__file__).resolve().parent.parent


def relative_image(project: Path, value) -> str | None:
    if not value:
        return None
    path = Path(value)
    if path.is_absolute():
        return str(path.resolve().relative_to(project.resolve()))
    return str(path)


def visual_items(project: Path, entries: list) -> dict:
    items = {}
    for entry in entries:
        if not isinstance(entry, dict) or not entry.get("id"):
            raise ValueError("visual.json 每个条目都必须包含 id")
        review = entry.get("review", entry.get("autoReview", {}))
        image = relative_image(project, entry.get("image") or entry.get("img"))
        kind = entry.get("kind") or ("frame" if entry.get("timestamp") is not None else "slide")
        items[entry["id"]] = {
            "id": entry["id"], "kind": kind, "image": image,
            "timestamp": entry.get("timestamp"), "source": entry.get("source"),
            "autoReview": {
                "issues": review.get("issues", []),
                "suggestions": review.get("suggestions", []),
                "rules": review.get("rules", []),
            },
            "humanVerdict": entry.get("humanVerdict"),
            "humanComment": entry.get("humanComment"),
        }
    return items


def discover_items(project: Path) -> dict:
    items = {}
    for path in sorted((project / "build" / "slides").glob("*.png")):
        items[path.stem] = {
            "id": path.stem, "kind": "slide", "image": str(path.relative_to(project)),
            "timestamp": None, "source": None,
            "autoReview": {"issues": [], "suggestions": [], "rules": []},
            "humanVerdict": None, "humanComment": None,
        }
    for path in sorted((project / "build" / "frames").glob("*.png")):
        try:
            timestamp = float(path.stem.rsplit("_", 1)[1])
        except (ValueError, IndexError):
            timestamp = None
        items[path.stem] = {
            "id": path.stem, "kind": "frame", "image": str(path.relative_to(project)),
            "timestamp": timestamp, "source": None,
            "autoReview": {"issues": [], "suggestions": [], "rules": []},
            "humanVerdict": None, "humanComment": None,
        }
    return items


def source_items(project: Path) -> list:
    """对 slides/**/*.py 做通用结构检查，不假定场景或文件名。"""
    items = []
    for path in sorted((project / "slides").rglob("*.py")):
        src = path.read_text()
        issues, suggestions, rules = [], [], []
        boxes = src.count("m.RoundedRectangle(")
        arrows = src.count("m.Arrow(")
        if boxes > 9:
            issues.append(f"源码包含 {boxes} 个节点，超过单图 9 节点预算")
            suggestions.append("拆分为总览与详图，或按场景分组")
            rules.append("R3-复杂度预算")
        if arrows > 12:
            issues.append(f"源码包含 {arrows} 条连线，超过单图 12 连线预算")
            suggestions.append("减少跨层连线或拆图")
            rules.append("R3-复杂度预算")
        if re.search(r"rate_func\s*=\s*linear", src):
            issues.append("有机运动使用 linear easing")
            suggestions.append("改用 ease_in_out_cubic 等自然缓动")
            rules.append("R4-easing")
        if re.findall(r"['\"]#[0-9a-fA-F]{6}['\"]", src):
            issues.append("存在硬编码色值")
            suggestions.append("改用 Manta 主题 token")
            rules.append("R6-主题一致性")
        if issues:
            items.append({
                "id": f"source-{path.stem}", "kind": "slide", "image": None,
                "timestamp": None,
                "source": {"file": str(path.relative_to(project)), "line": 1},
                "autoReview": {"issues": issues, "suggestions": suggestions, "rules": rules},
                "humanVerdict": None, "humanComment": None,
            })
    return items


def apply_prefilter(project: Path, items: dict) -> None:
    result = subprocess.run(
        [sys.executable, str(SCRIPT_ROOT / "scripts" / "prefilter.py"), "build"],
        cwd=project, capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"图像预筛失败：{result.stderr.strip() or result.stdout.strip()}")
    prefilter = json.loads(result.stdout)
    by_file = {}
    for entry in prefilter["items"]:
        by_file.setdefault(entry["file"], []).append(entry)
    for item in items.values():
        image = item.get("image")
        if not image:
            continue
        matches = by_file.get(Path(image).name, [])
        if any(p["flat_frame"] for p in matches):
            review = item["autoReview"]
            review["issues"].append("检测到黑帧/纯色帧或近纯色画面")
            review["suggestions"].append("检查入场时间、渲染内容与抽帧区间")
            review["rules"].append("R5-黑帧")
    if not prefilter["size_consistent"]:
        items["global-size"] = {
            "id": "global-size", "kind": "slide", "image": None, "timestamp": None,
            "source": None,
            "autoReview": {
                "issues": ["幻灯片与视频帧分辨率不一致"],
                "suggestions": ["统一渲染分辨率，例如全部使用 -qm 1280x720"],
                "rules": ["R5-分辨率"],
            },
            "humanVerdict": None, "humanComment": None,
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("visual", nargs="?", help="视觉审核 JSON")
    parser.add_argument("--project-dir", default=str(SCRIPT_ROOT))
    args = parser.parse_args()
    project = Path(args.project_dir).resolve()
    items = discover_items(project)
    if args.visual:
        items.update(visual_items(project, json.loads(Path(args.visual).read_text())))
    for item in source_items(project):
        items[item["id"]] = item
    apply_prefilter(project, items)

    report_path = project / "review" / "report.json"
    previous = {}
    if report_path.exists():
        try:
            previous = {i["id"]: i for i in json.loads(report_path.read_text()).get("items", [])}
        except (json.JSONDecodeError, KeyError):
            previous = {}
    for item in items.values():
        old = previous.get(item["id"], {})
        item["humanVerdict"] = old.get("humanVerdict")
        item["humanComment"] = old.get("humanComment")

    report = {
        "project": project.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "items": list(items.values()),
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {report_path} ({len(items)} items)")


if __name__ == "__main__":
    main()
