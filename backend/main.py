import json
from typing import Literal, Union
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

import gspread

import env as env

from map_generator import router as map_router

app = FastAPI()

app.include_router(map_router)

if env.ANALYTICS:
    from api_analytics.fastapi import Analytics
    app.add_middleware(Analytics, api_key=env.ANALYTICS_KEY)  # Add middleware
    print("added analytics")

mapPath = Path("/mnt/output")
staticPath = Path("./static")
frontend = Path("/data/frontend")

app.mount("/map", StaticFiles(directory=mapPath))
app.mount("/static", StaticFiles(directory=staticPath))
overlay = {}


@app.get("/api/overlay.json")
def get_overlay():
    if overlay:
        return overlay
    else:
        get_overlay_from_sheets()
        return overlay


@app.get("/api/update_overlay")
def get_overlay_from_sheets():
    gc = gspread.service_account(filename='creds.json')
    spreadsheet = gc.open_by_key("1MGYCzzKz-1IN-ajByRSGvNVZM784MGZjbDOWo_RSsf4")
    
    sheets = [s for s in spreadsheet.worksheets() if '!' not in s.title]
    
    ranges = [s.title for s in sheets]
    batch_data = spreadsheet.values_batch_get(ranges)['valueRanges']
    
    layers = []
    global overlay
    for sheet, data in zip(sheets, batch_data):
        values = data.get('values', [])
        if len(values) < 2:
            continue

        features = []

        sheet_name, color = sheet.title.split("#")

        if not color: color = "gray"

        print(sheet_name, color)
        
        rows = values[1:]
        for k, row in enumerate(rows):
            try:
                name: str = row[0]
                type: str = row[1]
                popup: str = row[2]
                coord_string: str = row[3]
                coord = []
                print(row)
                if type == "Pin":
                    coord = [int(c) for c in coord_string.split()]
                    coord.reverse()
                    assert len(coord) == 2, f"incorrect coordinate formatting, expected 2 values, found {len(coord)}"
                
                if type in ["Line", "Polygon"]:
                    coord = []
                    for pair in coord_string.split(","):
                        print(pair)
                        part = [int(c) for c in pair.strip().split(" ")]
                        part.reverse()
                        assert len(part) == 2, f"incorrect coordinate formatting, expected 2 values, found {len(part)}"
                        coord.append(part)

                features.append({
                    "name": name,
                    "type": type,
                    "popup": popup,
                    "coordinate": coord
                })

            except Exception as e:
                raise HTTPException(status_code=400, detail= {
                    "error": str(e),
                    "sheet": sheet.title,
                    "row_n": k,
                    "row_content": row
                })
        layers.append({
            "name": sheet_name,
            "color": color,
            "features": features
        })
    overlay = {"layers": layers}
    return


try:
    DIMENSIONS = json.loads(open("./static/dimensions.json").read())
    DIMENSION_NAMES: list[str] = [d["name"] for d in DIMENSIONS]
    
    frontend_html = (Path(frontend) / "index.html").read_text()

    @app.get("/")
    async def index(
        dim: str = next(iter(DIMENSION_NAMES)),
        x: int = 0,
        z: int = 0,
        zoom: int = 0
    ):
        og_tags = f"""
        <meta property="og:title" content="AOMC Webmap — {dim} ({x}, {z})">
        <meta property="og:description" content="Zoom level {zoom}">
        <meta property="og:image" content="https://map.diorite.xyz/api/map/preview?dim={dim}&x={x}&z={z}&zoom={zoom}">
        <meta property="og:url" content="https://map.diorite.xyz/?dim={dim}&x={x}&z={z}&zoom={zoom}">
        <meta property="og:type" content="website">
        """
        html = frontend_html.replace("<head>", f"<head>{og_tags}", 1)
        return HTMLResponse(html)

    app.mount("/", StaticFiles(directory=frontend, html=True))
except:
    pass
