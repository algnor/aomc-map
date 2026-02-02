import { Map, Marker, Polyline, Icon, LatLng } from "leaflet"
/**
 * Initialize measure tool
 * @param {Map} map 
 */
export function setupMeasureTool(map) {
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
    const userCoordStartMarker = new Marker([0, 0], { icon: markerIcon })
    const userCoordEndMarker = new Marker([0, 0], { icon: markerIcon })
    const userCoordPolyLine = new Polyline([[0, 0], [0, 0]], { dashArray: "8 8", lineCap: "butt", color: "#ffffff", dashOffset: 8 })
    const userCoordText = document.getElementById("userCoordText")
    const userCoordDistanceText = document.getElementById("userCoordDistanceText")
    const userCoordDistanceText2 = document.getElementById("userCoordDistanceText2")
    var userCoordStart = null
    var userCoordEnd = null

    /**
     * 
     * @param {LatLng} start 
     * @param {LatLng} end 
     */
    function drawMeasure(start, end) {
        userCoordDistanceText.innerHTML = `Δx: ${Math.round(start.lng - end.lng)} Δz: ${Math.round(start.lat - end.lat)}`
        userCoordDistanceText2.innerHTML = `dist: ${Math.round(Math.sqrt((start.lng - end.lng) ** 2 + (start.lat - end.lat) ** 2))}`

        userCoordPolyLine
            .setLatLngs([start, end])
            .addTo(map)
    }

    /**
     * @param {import("leaflet").LeafletMouseEvent} e 
     */
    function onMouseMove(e) {
        // update coordinate display
        coordText.innerHTML = `x: ${Math.round(e.latlng.lng)} z: ${Math.round(e.latlng.lat)}`

        // draw measure line
        if (userCoordStart) {
            if (!userCoordEnd) {
                drawMeasure(e.latlng, userCoordStart)
            }
        }
    }
    function onZoomChange() {
        scaleText.innerHTML = `Scale: ${Math.round(2 ** ((map.getZoom() - 9) * -1) * 1000) / 1000}`
    }
    /**
    * @param {import("leaflet").LeafletMouseEvent} e 
    */
    function onClick(e) {
        // Reset visuals


        // update coordinates
        if (!userCoordStart) {
            userCoordStart = e.latlng
            userCoordStartMarker
                .setLatLng(userCoordStart)
                .addTo(map)
        }
        else if (!userCoordEnd) {
            userCoordEnd = e.latlng
            userCoordEndMarker
                .setLatLng(userCoordEnd)
                .addTo(map)
            drawMeasure(userCoordStart, userCoordEnd)

        }
        else {
            userCoordStart = null
            userCoordEnd = null
            userCoordPolyLine.remove()
            userCoordStartMarker.remove()
            userCoordEndMarker.remove()
            onClick(e)

        }
        userCoordText.innerHTML = `x: ${Math.round(e.latlng.lng)} z: ${Math.round(e.latlng.lat)}`

        infoCenter.style = 'display: block'
        infoRight.style = 'display: block'
        userCoordText.style = 'color: gold;'
        setTimeout(() => {
            userCoordText.style = 'display: block; color: white;'
        }, 400);

        onMouseMove(e)
    }

    function stopInfo() {
        userCoordStart = null
        userCoordEnd = null
        infoCenter.style = 'display: none'
        infoRight.style = 'display: none'

        userCoordStartMarker.remove()
        userCoordEndMarker.remove()
        userCoordPolyLine.remove()
    }

    infoStop.addEventListener('click', stopInfo)
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            stopInfo()
        }
    })


    map.on('pointermove', onMouseMove);
    map.on('zoom', onZoomChange);
    map.on('click', onClick)
    onZoomChange()
}