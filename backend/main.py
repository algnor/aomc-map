from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

app = FastAPI()


mapPath = Path("./map_generator/output")
staticPath = Path("./static")
frontend = Path("/data/frontend")

app.mount("/map", StaticFiles(directory=mapPath))
app.mount("/static", StaticFiles(directory=staticPath))
try:
    # this will fail in dev mode, but we dont care since it wont be used then
    app.mount("/", StaticFiles(directory=frontend, html=True))
except:
    pass

@app.get("hello")
def hello():
    return {"Hello": "World"}