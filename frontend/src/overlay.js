import { Map, Control, DomEvent, DomUtil, Marker, LayerGroup, Icon, Polyline, Polygon } from "leaflet";
import "@kristjan.esperanto/leaflet.markercluster/dist/MarkerCluster.css";
import "@kristjan.esperanto/leaflet.markercluster/dist/MarkerCluster.Default.css";
import { MarkerClusterGroup } from "@kristjan.esperanto/leaflet.markercluster";

const colors = {
    black: ["#1d1d21", "black_banner.png"],
    blue: ["#4952ccff", "blue_banner.png"],
    brown: ["#a55e2aff", "brown_banner.png"],
    cyan: ["#1ccfc0ff", "cyan_banner.png"],
    gray: ["#747d80ff", "gray_banner.png"],
    green: ["#749a1aff", "green_banner.png"],
    light_blue: ["#3fc3efff", "light_blue_banner.png"],
    light_gray: ["#aeaeabff", "light_gray_banner.png"],
    lime: ["#80c71f", "lime_banner.png"],
    magenta: ["#d150c6ff", "magenta_banner.png"],
    orange: ["#f9801d", "orange_banner.png"],
    pink: ["#ff9bb9ff", "pink_banner.png"],
    purple: ["#8932b8", "purple_banner.png"],
    red: ["#e1372eff", "red_banner.png"],
    white: ["#eeeeee", "white_banner.png"],
    yellow: ["#fed83d", "yellow_banner.png"],
}

/**
 * @param {Map} map 
 * @param {Control.Layers} layerControl 
*/

export async function setupOverlay(map, layerControl) {
    // Get overlay data
    const res = await fetch("api/overlay.json")
    const data = await res.json()
    const layers = data["layers"]

    const res2 = await fetch("static/dimensions.json")
    /** @type {[]} */
    const dims = await res2.json()
    // Add refresh button
    var refreshButton = new RefreshButton()
    refreshButton.addTo(map)

    let activeOverlays = []


    map.on("baselayerchange", (e) => {
        const params = new URLSearchParams(window.location.search);
        params.set("dim", e["name"]);
        window.history.replaceState({}, "", `?${params}`);

        addLayers(map, e["name"]);
    });
    const params = new URLSearchParams(window.location.search)
    const dim = params.get("dim") || dims[0]["name"]
    addLayers(map, dim)

    function clearOverlays() {
        activeOverlays.forEach((layerGroup) => {
            layerControl.removeLayer(layerGroup)

            setTimeout(() => {
                layerGroup.removeFrom(map)
            }, 0);
        })
        activeOverlays = []
    }

    function setMouseType(e, mode) {
        if (e.target instanceof Polyline) {
            e.target._renderer._container.style.cursor = mode
        }
        else if (e.target instanceof Marker) {
            e.target._icon.style.cursor = mode
        }
    }

    //addLayers(map, "overworld")
    /**
     * 
     * @param {Map} map 
     * @param {String} target_dim 
     */
    function addLayers(map, target_dim) {
        clearOverlays()

        /**
         * @type {HTMLElement}
         */

        console.log("adding overlays for:", target_dim)
        layers.forEach(layer => {

            let markers = new MarkerClusterGroup({ maxClusterRadius: 50, clusterMarkerTitle: layer["name"], showCoverageOnHover: false });
            let features = []

            let dim = "overworld"
            if (layer["name"][0] === "@") {
                dim = layer["name"].split(" ")[0].substring(1)
            }

            // Regex blackmagic fuckery
            const name = layer["name"].replace(/@\w+|#\w+/g, '').trim().replace(/\s+/g, ' ');

            if (target_dim !== dim) return

            let layerColor = colors[layer["color"] || "white"]
            let iconUrl = `/static/markers/${layerColor[1]}`
            const icon = new Icon({
                iconUrl: iconUrl,
                iconSize: [24, 24],
                iconAnchor: [12, 24],
            })
            layer["features"].forEach(feature => {
                let color = layerColor
                let featureName = feature["name"]
                if (feature["name"].indexOf("#") > -1) {
                    color = colors[feature["name"].split("#")[1]]
                    featureName = feature["name"].split("#")[0]
                }
                let newFeature = null
                if (feature["type"] === "Pin") {
                    newFeature = new Marker(
                        feature["coordinate"],
                        { icon: icon}
                    )
                    newFeature.on('pointerover', function (e) {
                        if (feature["popup"])
                            setMouseType(e, "help")
                        else
                            setMouseType(e, "default")
                    });
                }

                if (feature["type"] === "Line") {
                    newFeature = new Polyline(
                        feature["coordinate"],
                        { color: color[0] }
                    )
                    newFeature.on('pointerover', function (e) {
                        var layer = e.target;

                        if (feature["popup"])
                            setMouseType(e, "help")
                        else
                            setMouseType(e, "default")

                        layer.setStyle({
                            weight: 8,
                        });
                    });
                    newFeature.on('pointerout', function (e) {
                        var layer = e.target;
                        setMouseType(e, "")

                        layer.setStyle({
                            weight: 3,
                        });
                    });
                }

                if (feature["type"] === "Polygon") {
                    newFeature = new Polygon(
                        feature["coordinate"],
                        { color: color[0] }
                    )
                    newFeature.on('pointerover', function (e) {
                        var layer = e.target;

                        if (feature["popup"])
                            setMouseType(e, "help")
                        else
                            setMouseType(e, "grab")


                        layer.setStyle({
                            weight: 5,
                        });
                    });
                    newFeature.on('pointerout', function (e) {
                        var layer = e.target;
                        setMouseType(e, "")

                        layer.setStyle({
                            weight: 3,
                        });
                    });
                }

                if (!newFeature) {
                    console.error("feature could not be parsed, skipping", feature)
                    return
                }

                // global to all features
                if (feature["name"])
                    newFeature.bindTooltip(featureName)
                if (feature["popup"])
                    newFeature.bindPopup(feature["popup"], { maxWidth: 1000 })
                else {
                    newFeature.options.className = "no-pointer"
                }

                if (feature["type"] === "Pin") {
                    markers.addLayer(newFeature)
                } else {
                    features.push(newFeature)
                }

            });
            var layerGroup = new LayerGroup(features)
            layerGroup.on("add", function (e) {
                markers.addTo(map)
            })
            layerGroup.on("remove", function (e) {
                markers.remove()
            })
            if (name[0] != ".") {
                layerGroup.addTo(map)
            }
            layerControl.addOverlay(layerGroup, name)
            activeOverlays.push(layerGroup)
        });
    }
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