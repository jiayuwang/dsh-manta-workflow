#!/usr/bin/env bash
# 视频抽帧：extract_frames.sh <video.mp4> <interval_sec> <outdir>
# 产物命名 <basename>_<秒>.png，供 review/report.json 的 timestamp 使用
set -euo pipefail
video="${1:?usage: extract_frames.sh <video.mp4> <interval_sec> <outdir>}"
interval="${2:?interval_sec}"
outdir="${3:?outdir}"
mkdir -p "$outdir"
base="$(basename "$video" .mp4)"
duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$video")
n=$(python3 -c "print(int(float('$duration') / float('$interval')))")
for i in $(seq 0 "$n"); do
  ts=$(python3 -c "print(f'{$i * float('$interval'):.1f}')")
  ffmpeg -v error -ss "$ts" -i "$video" -frames:v 1 -y "$outdir/${base}_${ts}.png"
done
echo "extracted $((n + 1)) frames to $outdir"
