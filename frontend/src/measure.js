import { Map, Marker, Polyline, Icon, LatLng, Control, DomUtil, DomEvent } from "leaflet"


/**
 * Initialize measure tool
 * @param {Map} map 
*/
export function setupMeasureTool(map) {

    let copyMode = false


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

    const copyIcon = new Icon({
        iconUrl: "static/markers/light_gray_banner.png",
        iconSize: [24, 24],
        iconAnchor: [12, 24]
    })

    let lastClipboard = ""
    /**
    * @param {import("leaflet").LeafletMouseEvent} e 
    */
    async function onClick(e) {
        // if copy mode active
        if (copyMode) {
            let pointMarker = new Marker(e.latlng, { icon: copyIcon})
            pointMarker.bindTooltip(`x: ${Math.round(e.latlng.lng)}  z: ${Math.round(e.latlng.lat)}`)
            pointMarker.addTo(e.target)

            let clipboard = document.getElementById("clipboard")

            if (lastClipboard) lastClipboard += ", "

            let text = lastClipboard +  `${Math.round(e.latlng.lng)} ${Math.round(e.latlng.lat)}`
            lastClipboard = text
            navigator.clipboard.writeText(text)
            clipboard.innerHTML = text

            return

        }


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

        let clipboard = document.getElementById("clipboard")
        lastClipboard = ""
        clipboard.innerHTML = "&lt;empty&gt;"
    }

    infoStop.addEventListener('click', stopInfo)
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            stopInfo()
            lastClipboard = ""
        }
    })


    map.on('pointermove', onMouseMove);
    map.on('zoom', onZoomChange);
    map.on('click', onClick)
    onZoomChange()



    function copyCoordinateMode() {
        copyMode = !copyMode
    
        let button = document.getElementById("copyButton")
        let clipboard = document.getElementById("clipboard")
        if (copyMode) {
            stopInfo()
            button.classList.add("copyActive")
            clipboard.style.display = "block"
            clipboard.innerHTML = "&lt;empty&gt;"
        } else {
            button.classList.remove("copyActive")
            clipboard.style.display = "none"
        }
    }
    
    const CopyCoordinateButton = Control.extend({
        options: {
            position: 'topleft'
        },
        onAdd: function (map) {
            var container = DomUtil.create('div', 'leaflet-bar leaflet-control');
            var button = DomUtil.create('a', 'leaflet-control-button', container);
            DomEvent.disableClickPropagation(button);
            DomEvent.on(button, 'click', copyCoordinateMode, map);
    
            container.title = "Enable/Disable Copy Mode ";
            button.innerHTML = "<img src='static/copy-icon.svg'>"
            container.style = "cursor: pointer;"
            container.id = "copyButton"
    
            return container;
        },
        onRemove: function (map) { },
    });
    const copyCoordinateButton = new CopyCoordinateButton()
    copyCoordinateButton.addTo(map)
}
