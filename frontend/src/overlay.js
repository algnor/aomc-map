import { Map, Control, DomEvent, DomUtil, Marker, LatLng, LayerGroup, Icon, Polyline, Polygon } from "leaflet";

const colors = {
    black: ["#1d1d21", "black_banner.png"],
    blue: ["#4952ccff", "blue_banner.png"],
    brown: ["#835432", "brown_banner.png"],
    cyan: ["#169c9c", "cyan_banner.png"],
    gray: ["#474f52", "gray_banner.png"],
    green: ["#5e7c16", "green_banner.png"],
    light_blue: ["#3ab3da", "light_blue_banner.png"],
    light_gray: ["#9d9d97", "light_gray_banner.png"],
    lime: ["#80c71f", "lime_banner.png"],
    magenta: ["#c74ebd", "magenta_banner.png"],
    orange: ["#f9801d", "orange_banner.png"],
    pink: ["#f38baa", "pink_banner.png"],
    purple: ["#8932b8", "purple_banner.png"],
    red: ["#b02e26", "red_banner.png"],
    white: ["#eeeeee", "white_banner.png"],
    yellow: ["#fed83d", "yellow_banner.png"],
}

/**
 * @param {Map} map 
 */
export async function setupOverlay(map) {
    // Add refresh button
    var refreshButton = new RefreshButton()
    refreshButton.addTo(map)

    // Get overlay data
    const res = await fetch("api/overlay.json")
    const data = await res.json()
    const layers = data["layers"]
    const layerControl = new Control.Layers().addTo(map)



    layers.forEach(layer => {
        let features = []

        let layerColor = colors[layer["color"] || "white"]
        let iconUrl = `/static/markers/${layerColor[1]}`
        const icon = new Icon({
            iconUrl: iconUrl,
            iconSize: [24, 24],
            iconAnchor: [12, 24],
        })
        layer["features"].forEach(feature => {
            let color = layerColor
            if (feature["name"].indexOf("#") > -1) {
                color = colors[feature["name"].split("#")[1]]
            }
            let newFeature = null
            if (feature["type"] === "Pin") {
                newFeature = new Marker(
                    feature["coordinate"],
                    { icon: icon }
                )
            }

            if (feature["type"] === "Line") {
                newFeature = new Polyline(
                    feature["coordinate"],
                    { color: color[0] }
                )
            }

            if (feature["type"] === "Polygon") {
                newFeature = new Polygon(
                    feature["coordinate"],
                    { color: color[0] }
                )
            }

            if (!newFeature) {
                console.error("feature could not be parsed, skipping", feature)
                return
            }

            // global to all features
            if (feature["name"])
                newFeature.bindTooltip(feature["name"])
            if (feature["popup"])
                newFeature.bindPopup(feature["popup"], { maxWidth: 1000 })

            features.push(newFeature)

        });
        let layerGroup = new LayerGroup(features)
        if (layer["name"][0] != ".") {
            layerGroup.addTo(map)
        }
        layerControl.addOverlay(layerGroup, layer["name"])
    });
}

/**
 * 
 * @this Map
 */
async function refresh() {
    console.log("Refreshing overlays")
    this.remove()
    let res = await fetch("api/update_overlay")
    if (res.ok)
        location.reload()
    else {
        let info = await res.json()
        console.log(info)
        alert(JSON.stringify(info, null, " "))
    }
}

const RefreshButton = Control.extend({
    options: {
        position: 'topleft'
    },
    onAdd: function (map) {
        var container = DomUtil.create('div', 'leaflet-bar leaflet-control');
        var button = DomUtil.create('a', 'leaflet-control-button', container);
        DomEvent.disableClickPropagation(button);
        DomEvent.on(button, 'click', refresh, map);

        container.title = "Refresh overlay data";
        button.innerHTML = "<img src='static/refresh.svg'>"
        container.style = "cursor: pointer;"

        return container;
    },
    onRemove: function (map) { },
});