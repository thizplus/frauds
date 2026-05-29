#!/bin/bash
# ===== Auto-trim video — ตัดจอขาว/ดำ หัว video =====
# Usage: bash trim.sh [seconds_to_skip] [input_dir]
# Default: ตัด 5 วินาทีแรก จากทุกไฟล์ใน recordings/

SKIP=${1:-5}
INPUT_DIR=${2:-recordings}
OUTPUT_DIR="output"

mkdir -p "$OUTPUT_DIR"

echo "===== Trimming videos (skip first ${SKIP}s) ====="

find "$INPUT_DIR" -name "*.webm" | while read -r file; do
  filename=$(basename "$file" .webm)
  parent=$(basename $(dirname "$file"))
  outdir="$OUTPUT_DIR/$parent"
  mkdir -p "$outdir"
  outfile="$outdir/${parent}.webm"

  echo "Trimming: $file → $outfile (skip ${SKIP}s)"
  ffmpeg -y -ss "$SKIP" -i "$file" -c:v libvpx-vp9 -b:v 2M "$outfile" 2>/dev/null

  if [ $? -eq 0 ]; then
    echo "  ✓ Done: $outfile"
  else
    echo "  ✗ Failed: $file"
  fi
done

echo ""
echo "===== Output files ====="
find "$OUTPUT_DIR" -name "*.webm" -exec ls -lh {} \;
