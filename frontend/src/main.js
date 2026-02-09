import './style.css'
import {CRS, Map, Control, Transformation, Canvas} from "leaflet"
import 'leaflet/dist/leaflet.css'


import { setupMeasureTool } from './measure'
import "./measure.css"
import { setupLayers } from "./layers"
import { setupOverlay } from './overlay'
import { setupUrlCoordinates } from './urlCoordinates'
import { setupUpload } from './upload'
import "./upload.css"

console.log(L.version)

// Since User Zoom 0 (1:1) is level 9  (inverted)
const scaleFactor = 1 / Math.pow(2, 9); 

const MinecraftCRS = Object.create(CRS.Simple);
Object.assign(MinecraftCRS, {
    transformation: new Transformation(
        scaleFactor, 0,
        scaleFactor, 0
    )
});

const canvasRenderer = new Canvas({
  tolerance: 5,

});

const map = new Map('map', {
    renderer: canvasRenderer,
    crs: MinecraftCRS,
    center: [0, 0],
    zoom: 7
});


new Control.Scale({imperial: false}).addTo(map)

const layerControls = await setupLayers(map)
setupMeasureTool(map)
setupOverlay(map, layerControls)
setupUrlCoordinates(map)
setupUpload(map)