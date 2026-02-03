import './style.css'
import {CRS, Map, TileLayer, Util, Control, Transformation, Marker, Polyline, Icon} from "leaflet"
import 'leaflet/dist/leaflet.css'


import { setupMeasureTool } from './measure'
import "./measure.css"
import { setupOverlay } from './overlay'
import { setupUrlCoordinates } from './urlCoordinates'
import { setupUpload } from './upload'

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

const map = new Map('map', {
    crs: MinecraftCRS,
    center: [0, 0],
    zoom: 7
});

class MinecraftTileLayer extends TileLayer {
    getTileUrl(coords) {
        // Invert zoom since 0 = 1:1, 1 = 2:1 etc
        const zoomFolder = this.options.maxNativeZoom - coords.z;
        const subdomains = this.options.subdomains;
        const index = Math.abs(coords.x + coords.y) % subdomains.length;       

        return Util.template(this._url, {
            z: zoomFolder,
            x: coords.x*512*(2**zoomFolder), // since tiles use top left coordinate as name
            y: coords.y*512*(2**zoomFolder),
            s: subdomains[index]
        });
    }
}
// new MinecraftTileLayer('https://{s}.aomc-map.game.algot.net/map/{z}/{x}_{y}.png?s={s}', {
//     maxNativeZoom: 9,
//     minNativeZoom: 0,
//     maxZoom: 15,
//     minZoom: 0,
//     tileSize: 512,
//     attribution: '©AOMC Players',
//     subdomains: "abcd",
// }).addTo(map);


new MinecraftTileLayer('/map/{z}/{x}_{y}.png?s={s}', {
    maxNativeZoom: 9,
    minNativeZoom: 0,
    maxZoom: 15,
    minZoom: 0,
    tileSize: 512,
    attribution: '©AOMC Players',
}).addTo(map);

new Control.Scale({imperial: false}).addTo(map)

setupMeasureTool(map)
setupOverlay(map)
setupUrlCoordinates(map)
setupUpload(map)