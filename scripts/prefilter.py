#!/usr/bin/env python3
"""[P] 程序化预筛：黑帧/纯色帧检测（R5）+ 帧尺寸一致性。"""
import sys, json
from pathlib import Path
from PIL import Image
import numpy as np

def analyze(png: Path) -> dict:
    img = np.asarray(Image.open(png).convert("RGB"), dtype=np.int16)
    h, w, _ = img.shape
    std = float(img.std())
    flat = bool(std < 3.0)  # 近纯色帧
    edges = img[[0, -1], :, :].std() + img[:, [0, -1], :].std()
    return {"file": png.name, "w": w, "h": h, "std": round(std, 2),
            "flat_frame": flat, "edge_std": round(float(edges), 2)}

if __name__ == "__main__":
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("build")
    out = []
    for sub in ("slides", "frames"):
        d = root / sub
        if d.is_dir():
            for p in sorted(d.glob("*.png")):
                out.append(analyze(p))
    sizes = {(o["w"], o["h"]) for o in out}
    print(json.dumps({"items": out, "size_consistent": len(sizes) <= 1}, ensure_ascii=False, indent=1))
