import './style.css'
import {CRS, Map, TileLayer, Util, Control, Transformation, Marker, Polyline, Icon} from "leaflet"
import 'leaflet/dist/leaflet.css'
// import Polydraw from "leaflet-polydraw";
// import "leaflet-polydraw/leaflet-polydraw.css";
//import "@geoman-io/leaflet-geoman-free";
//import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

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
        
        return Util.template(this._url, {
            z: zoomFolder,
            x: coords.x*512*(2**zoomFolder), // since tiles use top left coordinate as name
            y: coords.y*512*(2**zoomFolder)
        });
    }
    
}

new MinecraftTileLayer('map/{z}/{x}_{y}.png', {
    maxNativeZoom: 9,
    minNativeZoom: 0,
    maxZoom: 15,
    minZoom: 0,
    tileSize: 512,
    noWrap: true,
    attribution: '©AOMC Players'
}).addTo(map);

new Control.Scale({imperial: false}).addTo(map)

const coordText = document.getElementById("coordText")
const scaleText = document.getElementById("scaleText")

const infoCenter = document.getElementById("infoCenter")
const infoRight = document.getElementById("infoRight")
const infoStop = document.getElementById("infoStop")

const markerIcon = new Icon({
    iconUrl: "static/Marker.png",
    iconSize: [24, 24],
    iconAnchor: [12, 24]
})
const userCoordMarker = new Marker([0, 0], {icon: markerIcon})
const userCoordPolyLine = new Polyline([[0, 0], [0, 0]], {dashArray: "8 8", lineCap: "butt", color: "#ffffff", dashOffset: 8})
const userCoordText = document.getElementById("userCoordText")
const userCoordDistanceText = document.getElementById("userCoordDistanceText")
const userCoordDistanceText2 = document.getElementById("userCoordDistanceText2")
var userCoord = null

function onMouseMove(e) {
    coordText.innerHTML = `x: ${Math.round(e.latlng.lng)} z: ${Math.round(e.latlng.lat)}`
    if (userCoord) {
        userCoordDistanceText.innerHTML = `Δx: ${Math.round(e.latlng.lng - userCoord.lng)} Δz: ${Math.round(e.latlng.lat - userCoord.lat)}`
        userCoordDistanceText2.innerHTML = `dist: ${Math.round(Math.sqrt((e.latlng.lng - userCoord.lng)**2 + (e.latlng.lat - userCoord.lat)**2))}`
        
        userCoordPolyLine
            .setLatLngs([e.latlng, userCoord])
            .addTo(map)
    }
}
function onZoomChange() {
    scaleText.innerHTML = `Scale: ${Math.round(2**((map.getZoom() - 9)*-1)*1000)/1000}`
}

function onClick(e) {
    userCoord = e.latlng
    userCoordText.innerHTML = `x: ${Math.round(e.latlng.lng)} z: ${Math.round(e.latlng.lat)}`
    userCoordMarker
        .setLatLng(e.latlng)
        .addTo(map)
    infoCenter.style = 'display: block'
    infoRight.style = 'display: block'
    userCoordText.style = 'color: gold;'
    setTimeout(() => {
        userCoordText.style = 'display: block; color: white;'
    }, 400);
    
    onMouseMove(e)
}

function stopInfo() {
    userCoord = null
    infoCenter.style = 'display: none'
    infoRight.style = 'display: none'
    
    userCoordMarker.remove()
    userCoordPolyLine.remove()
}

infoStop.addEventListener('click', stopInfo)
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        stopInfo()
    }
})


map.on('pointermove', onMouseMove);
map.on('zoom', onZoomChange);
map.on('click', onClick)
onZoomChange()