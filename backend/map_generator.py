from fastapi import APIRouter, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import math
from PIL import Image
import zipfile
import io
import tempfile
import shutil
import numpy as np

router = APIRouter(prefix="/api/map", tags=["map"])

INPUT_DIR = Path("/mnt/input")
OUTPUT_DIR = Path("/mnt/output")
PROCESSED_DIR = Path("/mnt/processed")

INPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def get_image(path: Path):
    try:
        return Image.open(path).convert("RGB").resize((256, 256))
    except:
        return None


def process_image(file_path: Path, modified_tiles: set):
    im = Image.open(file_path).convert("RGB")
    img_width, img_height = im.size

    if img_width > 1024 or img_height > 1024:
        return False, f"Image dimensions {img_width}x{img_height} exceed 1024x1024"

    parts = file_path.stem.split("_")
    try:
        x = int(parts[2][1:])
        y = int(parts[3][1:])
    except (IndexError, ValueError):
        return False, f"Invalid filename format: {file_path.name}"

    OUTPUT_DIR.joinpath("0").mkdir(exist_ok=True)

    tile_size = 512

    tile_x_start = math.floor(x / tile_size) * tile_size
    tile_y_start = math.floor(y / tile_size) * tile_size
    tile_x_end = math.floor((x + img_width - 1) / tile_size) * tile_size
    tile_y_end = math.floor((y + img_height - 1) / tile_size) * tile_size

    for tile_x in range(tile_x_start, tile_x_end + 1, tile_size):
        for tile_y in range(tile_y_start, tile_y_end + 1, tile_size):
            src_left = max(0, tile_x - x)
            src_top = max(0, tile_y - y)
            src_right = min(img_width, tile_x + tile_size - x)
            src_bottom = min(img_height, tile_y + tile_size - y)

            dst_left = max(0, x - tile_x)
            dst_top = max(0, y - tile_y)

            region = im.crop((src_left, src_top, src_right, src_bottom))

            # Create mask: non-black pixels are opaque (255), black pixels are transparent (0)
            region_array = np.array(region)
            mask_array = np.any(region_array != 0, axis=2).astype(np.uint8) * 255
            mask = Image.fromarray(mask_array, mode="L")

            path = OUTPUT_DIR.joinpath("0", f"{tile_x}_{tile_y}.png")
            if path.exists():
                tile_img = Image.open(path).convert("RGB")
            else:
                tile_img = Image.new("RGB", (tile_size, tile_size))

            # Paste with mask - only non-black pixels get written
            tile_img.paste(region, (dst_left, dst_top), mask)
            tile_img.save(path)

            modified_tiles.add((tile_x, tile_y))

    return True, None


def regenerate_zoom_levels(modified_tiles: set):
    if not modified_tiles:
        return 0

    tiles_to_update = modified_tiles.copy()
    total_updated = 0

    for zoom in range(1, 10):
        if not tiles_to_update:
            break

        OUTPUT_DIR.joinpath(str(zoom)).mkdir(exist_ok=True)

        parent_tiles = set()
        dl = 512 * (2 ** zoom)

        for (tx, ty) in tiles_to_update:
            parent_x = math.floor(tx / dl) * dl
            parent_y = math.floor(ty / dl) * dl
            parent_tiles.add((parent_x, parent_y))

        for X, Y in parent_tiles:
            ds = int(dl / 2)

            positions = [
                (OUTPUT_DIR.joinpath(str(zoom - 1), f"{X}_{Y}.png"), (0, 0)),
                (OUTPUT_DIR.joinpath(str(zoom - 1), f"{X + ds}_{Y}.png"), (256, 0)),
                (OUTPUT_DIR.joinpath(str(zoom - 1), f"{X}_{Y + ds}.png"), (0, 256)),
                (OUTPUT_DIR.joinpath(str(zoom - 1), f"{X + ds}_{Y + ds}.png"), (256, 256)),
            ]

            output_path = OUTPUT_DIR.joinpath(str(zoom), f"{X}_{Y}.png")
            
            # Load existing parent tile or create new
            if output_path.exists():
                new_img = Image.open(output_path).convert("RGB")
            else:
                new_img = Image.new("RGB", (512, 512))

            # Only paste tiles that exist
            for path, pos in positions:
                img = get_image(path)
                if img:
                    new_img.paste(img, pos)

            new_img.save(output_path)

        total_updated += len(parent_tiles)
        tiles_to_update = parent_tiles

    return total_updated

@router.post("/upload")
async def upload_map(file: UploadFile):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    print("Generating:", file.filename)

    modified_tiles = set()
    processed_files = []
    errors = []

    content = await file.read()

    if file.filename.lower().endswith(".zip"):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            with zipfile.ZipFile(io.BytesIO(content), "r") as zf:
                zf.extractall(tmp_path)

            # Debug: print what was extracted
            all_files = list(tmp_path.rglob("*"))
            print("Extracted files:", all_files)

            for img_path in tmp_path.rglob("*"):
                if img_path.is_file() and img_path.suffix.lower() == ".png":
                    success, error = process_image(img_path, modified_tiles)
                    if success:
                        dest = PROCESSED_DIR.joinpath(img_path.name)
                        shutil.copy2(img_path, dest)
                        processed_files.append(img_path.name)
                    else:
                        errors.append({"file": img_path.name, "error": error})
    else:
        # Preserve original filename
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir) / file.filename
            tmp_path.write_bytes(content)

            success, error = process_image(tmp_path, modified_tiles)
            if success:
                dest = PROCESSED_DIR.joinpath(file.filename)
                shutil.copy2(tmp_path, dest)
                processed_files.append(file.filename)
            else:
                errors.append({"file": file.filename, "error": error})

    zoom_tiles_updated = regenerate_zoom_levels(modified_tiles)

    return JSONResponse({
        "processed_files": len(processed_files),
        "base_tiles_modified": len(modified_tiles),
        "zoom_tiles_updated": zoom_tiles_updated,
        "errors": errors
    })