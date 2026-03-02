from fastapi import APIRouter, UploadFile, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pathlib import Path
import math
from PIL import Image
import zipfile
import io
import numpy as np
import json
import asyncio

DIMENSIONS = json.loads(open("./static/dimensions.json").read())
DIMENSION_NAMES: list[str] = [d["name"] for d in DIMENSIONS]

router = APIRouter(prefix="/api/map", tags=["map"])

TEMP_DIR = Path("/mnt/temp")
OUTPUT_DIR = Path("/mnt/output")

TEMP_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def get_image(path: Path):
    try:
        return Image.open(path).convert("RGB").resize((256, 256))
    except:
        return None


def process_image(file_path: Path, output_dir: Path, modified_tiles: set):
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

    output_dir.joinpath("0").mkdir(exist_ok=True)

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

            region_array = np.array(region)
            mask_array = np.any(region_array != 0, axis=2).astype(np.uint8) * 255
            mask = Image.fromarray(mask_array, mode="L")

            path = output_dir.joinpath("0", f"{tile_x}_{tile_y}.png")
            if path.exists():
                tile_img = Image.open(path).convert("RGB")
            else:
                tile_img = Image.new("RGB", (tile_size, tile_size))

            tile_img.paste(region, (dst_left, dst_top), mask)
            tile_img.save(path)

            modified_tiles.add((tile_x, tile_y))

    return True, None


def regenerate_zoom_levels(output_dir: Path, modified_tiles: set):
    if not modified_tiles:
        yield "No tiles to update", 0
        return

    tiles_to_update = modified_tiles.copy()
    total_updated = 0

    for zoom in range(1, 10):
        if not tiles_to_update:
            break

        output_dir.joinpath(str(zoom)).mkdir(exist_ok=True)

        parent_tiles = set()
        dl = 512 * (2 ** zoom)

        for (tx, ty) in tiles_to_update:
            parent_x = math.floor(tx / dl) * dl
            parent_y = math.floor(ty / dl) * dl
            parent_tiles.add((parent_x, parent_y))

        for i, (X, Y) in enumerate(parent_tiles):
            ds = int(dl / 2)

            positions = [
                (output_dir.joinpath(str(zoom - 1), f"{X}_{Y}.png"), (0, 0)),
                (output_dir.joinpath(str(zoom - 1), f"{X + ds}_{Y}.png"), (256, 0)),
                (output_dir.joinpath(str(zoom - 1), f"{X}_{Y + ds}.png"), (0, 256)),
                (output_dir.joinpath(str(zoom - 1), f"{X + ds}_{Y + ds}.png"), (256, 256)),
            ]

            output_path = output_dir.joinpath(str(zoom), f"{X}_{Y}.png")

            if output_path.exists():
                new_img = Image.open(output_path).convert("RGB")
            else:
                new_img = Image.new("RGB", (512, 512))

            for path, pos in positions:
                img = get_image(path)
                if img:
                    new_img.paste(img, pos)

            new_img.save(output_path)

            if (i + 1) % 20 == 0 or (i + 1) == len(parent_tiles):
                yield f"Zoom {zoom}: {i + 1}/{len(parent_tiles)} tiles", None

        total_updated += len(parent_tiles)
        tiles_to_update = parent_tiles

    yield f"Complete: {total_updated} zoom tiles updated", total_updated


@router.post("/upload/{dim}")
async def upload_map(dim: str, file: UploadFile):
    if dim not in DIMENSION_NAMES:
        raise HTTPException(status_code=400, detail=f"Invalid dimension: {dim}")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    dim_temp_dir = TEMP_DIR / dim
    dim_temp_dir.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    saved_files = []

    if file.filename.lower().endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(content), "r") as zf:
            for name in zf.namelist():
                if name.lower().endswith(".png"):
                    data = zf.read(name)
                    dest = dim_temp_dir / Path(name).name
                    dest.write_bytes(data)
                    saved_files.append(dest.name)
    else:
        dest = dim_temp_dir / file.filename
        dest.write_bytes(content)
        saved_files.append(file.filename)

    return JSONResponse({
        "dimension": dim,
        "files_saved": len(saved_files),
        "files": saved_files
    })


@router.get("/unprocessed")
async def get_unprocessed():
    result = {}
    for dim in DIMENSION_NAMES:
        dim_path = TEMP_DIR / dim
        if dim_path.exists():
            files = [f.name for f in dim_path.iterdir() if f.is_file() and f.suffix.lower() == ".png"]
            if files:
                result[dim] = files
    return JSONResponse(result)


@router.post("/process")
async def process_all():
    async def stream_log():
        for dim in DIMENSION_NAMES:
            dim_temp = TEMP_DIR / dim
            dim_output = OUTPUT_DIR / dim

            if not dim_temp.exists():
                continue

            files = list(dim_temp.glob("*.png"))
            if not files:
                continue

            dim_output.mkdir(parents=True, exist_ok=True)
            yield f"[{dim}] Starting processing of {len(files)} files\n"

            modified_tiles = set()
            processed = 0
            errors = 0

            for img_path in files:
                success, error = process_image(img_path, dim_output, modified_tiles)
                if success:
                    processed += 1
                    img_path.unlink()
                else:
                    errors += 1
                    yield f"[{dim}] Error processing {img_path.name}: {error}\n"

                if processed % 10 == 0:
                    yield f"[{dim}] Processed {processed}/{len(files)} files\n"
                    await asyncio.sleep(0)

            yield f"[{dim}] Base tiles complete: {processed} processed, {errors} errors, {len(modified_tiles)} tiles modified\n"

            if modified_tiles:
                yield f"[{dim}] Regenerating zoom levels...\n"
                for msg, result in regenerate_zoom_levels(dim_output, modified_tiles):
                    yield f"[{dim}] {msg}\n"
                    await asyncio.sleep(0)

            yield f"[{dim}] Done\n"

        yield "Processing complete\n"

    return StreamingResponse(stream_log(), media_type="text/plain")

@router.get("/preview")
async def map_preview(x: int=0, z: int=0, zoom: int = 0, dim: str = DIMENSION_NAMES[0]):
    if dim not in DIMENSION_NAMES:
        raise HTTPException(status_code=400, detail=f"Invalid dimension: {dim}")

    zoom_dir = OUTPUT_DIR / dim / str(zoom)
    if not zoom_dir.exists():
        raise HTTPException(status_code=404, detail="No tiles for this dimension/zoom")

    tile_size = 512
    world_units_per_tile = tile_size * (2 ** zoom)

    origin_tile_x = math.floor(x / world_units_per_tile) * world_units_per_tile
    origin_tile_z = math.floor(z / world_units_per_tile) * world_units_per_tile

    canvas = Image.new("RGB", (tile_size * 3, tile_size * 3), (30, 30, 30))

    for row in range(-1, 2):
        for col in range(-1, 2):
            tx = origin_tile_x + col * world_units_per_tile
            tz = origin_tile_z + row * world_units_per_tile
            tile_path = zoom_dir / f"{int(tx)}_{int(tz)}.png"
            try:
                img = Image.open(tile_path).convert("RGB")
                canvas.paste(img, ((col + 1) * tile_size, (row + 1) * tile_size))
            except:
                pass

    # Scale pixel offset: (x - origin_tile_x) world units / (2^zoom) = pixels within tile
    cx = tile_size + (x - origin_tile_x) // (2 ** zoom)
    cz = tile_size + (z - origin_tile_z) // (2 ** zoom)

    output = canvas.crop((cx - 512, cz - 512, cx + 512, cz + 512))

    buf = io.BytesIO()
    output.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")
