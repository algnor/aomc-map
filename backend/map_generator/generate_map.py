import os
from pathlib import Path
import shutil
import numpy as np
import math
from PIL import Image


root = Path(__file__).parent
input = root.joinpath(Path("input"))
output = root.joinpath(Path("output"))


files = input.iterdir()
files = list(files)

try:
    shutil.rmtree(output)
except:
    pass

Path.mkdir(input, exist_ok=True)
Path.mkdir(output, exist_ok=True)

def crop(im, height, width):
    imgwidth, imgheight = im.size
    rows = np.int16(imgheight/height)
    cols = np.int16(imgwidth/width)
    for i in range(rows):
        for j in range(cols):
            box = (j*width, i*height, (j+1)*width, (i+1)*height)
            yield im.crop(box)

for k, file in enumerate(files):
    print("base-layer:", f"{k}/{len(files)}", f'"{file.name}"')
    im = Image.open(file)
    dim = [im.width, im.height]
    assert dim == [1024, 1024], "input image dimensions not 1024x1024"

    parts = file.stem.split("_")
    x = int(parts[2][1:])  # top-left x coordinate in world space
    y = int(parts[3][1:])  # top-left y coordinate in world space

    Path.mkdir(output.joinpath("0"), exist_ok=True)

    # Calculate the 512-aligned grid cells this image overlaps
    tile_size = 512
    
    # Find the range of 512-aligned tiles this image covers
    tile_x_start = math.floor(x / tile_size) * tile_size
    tile_y_start = math.floor(y / tile_size) * tile_size
    tile_x_end = math.floor((x + 1024 - 1) / tile_size) * tile_size
    tile_y_end = math.floor((y + 1024 - 1) / tile_size) * tile_size

    for tile_x in range(tile_x_start, tile_x_end + 1, tile_size):
        for tile_y in range(tile_y_start, tile_y_end + 1, tile_size):
            # Calculate overlap between this 512x512 tile and the source image
            # In source image coordinates:
            src_left = max(0, tile_x - x)
            src_top = max(0, tile_y - y)
            src_right = min(1024, tile_x + tile_size - x)
            src_bottom = min(1024, tile_y + tile_size - y)

            # In destination tile coordinates:
            dst_left = max(0, x - tile_x)
            dst_top = max(0, y - tile_y)

            # Extract the region from source
            region = im.crop((src_left, src_top, src_right, src_bottom))

            # Load existing tile or create new one
            path = output.joinpath("0", f"{tile_x}_{tile_y}.png")
            if path.exists():
                tile_img = Image.open(path).convert("RGB")
            else:
                tile_img = Image.new("RGB", (tile_size, tile_size))

            # Paste the region
            tile_img.paste(region, (dst_left, dst_top))
            tile_img.save(path)

#helper function to open image or get empty map for stitching
def get_image(path: Path):
    empty = Image.new("RGB", [256, 256], (0, 0, 0, 0))
    try:
        return Image.open(path).resize([256, 256])
    except:
        return empty

# Generate zoom levels
for zoom in range(1, 10):
    level = output.joinpath(str(zoom - 1)).iterdir()
    level = list(level)
    output.joinpath(str(zoom)).mkdir(exist_ok=True)
    for i, image in enumerate(level):
        parts = image.stem.split("_")
        x = int(parts[0])
        y = int(parts[1])

        dl = 512*(2**zoom)
        ds = int(dl/2)

        X = math.floor(x / dl) * dl
        Y = math.floor(y / dl) * dl

        output_path = output.joinpath(str(zoom), f"{X}_{Y}.png")
        if output_path.is_file(): 
            print("Zoom:", zoom, f"{i}/{len(level)}", "Skipped (already covered)")
            continue # skip if this is already made


        im1_path = output.joinpath(str(zoom - 1), f"{X}_{Y}.png")
        im2_path = output.joinpath(str(zoom - 1), f"{X + ds}_{Y}.png")
        im3_path = output.joinpath(str(zoom - 1), f"{X}_{Y + ds}.png")
        im4_path = output.joinpath(str(zoom - 1), f"{X + ds}_{Y + ds}.png")

        im1 = get_image(im1_path)
        im2 = get_image(im2_path)
        im3 = get_image(im3_path)
        im4 = get_image(im4_path)

        new_img = Image.new("RGB", [512, 512])
        new_img.paste(im1, (0, 0))
        new_img.paste(im2, (256, 0))
        new_img.paste(im3, (0, 256))
        new_img.paste(im4, (256, 256))

        new_img.save(output_path)

        print("Zoom:", zoom, f"{i}/{len(level)}", f'"{output_path.name}"')