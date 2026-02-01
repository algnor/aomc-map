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
    x = int(parts[2][1:])
    y = int(parts[3][1:])

    # crop to 4x 512x512 images
    Path.mkdir(output.joinpath("0"), exist_ok=True)
    for k, piece in enumerate(crop(im, 512, 512)):
        img = Image.new("RGB", (512, 512))
        img.paste(piece)
        if k == 0:
            img.save(output.joinpath("0", f"{x}_{y}.png"))
        if k == 1:
            img.save(output.joinpath("0", f"{x + 512}_{y}.png"))
        if k == 2:
            img.save(output.joinpath("0", f"{x}_{y + 512}.png"))
        if k == 3: 
            img.save(output.joinpath("0", f"{x + 512}_{y + 512}.png"))

#helper function to open image or get empty map for stitching
def get_image(path: Path):
    empty = Image.new("RGBA", [256, 256], (0, 0, 0, 0))
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

        new_img = Image.new("RGBA", [512, 512])
        new_img.paste(im1, (0, 0))
        new_img.paste(im2, (256, 0))
        new_img.paste(im3, (0, 256))
        new_img.paste(im4, (256, 256))

        new_img.save(output_path)

        print("Zoom:", zoom, f"{i}/{len(level)}", f'"{output_path.name}"')