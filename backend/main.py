from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

app = FastAPI()


mapPath = Path("./map_generator/output")
staticPath = Path("./static")
frontend = Path("/data/frontend")

app.mount("/map", StaticFiles(directory=mapPath))
app.mount("/static", StaticFiles(directory=staticPath))
app.mount("/", StaticFiles(directory=frontend, html=True, check_dir=False))

@app.get("hello")
def hello():
    return {"Hello": "World"}