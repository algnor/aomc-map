import { TileLayer, Util, Control, Map } from "leaflet";

/**
 * 
 * @param {Map} map 
 */
export async function setupLayers(map) {
    const res = await fetch("static/dimensions.json")
    /** @type {[]} */
    const layers = await res.json()

    const layerControls = new Control.Layers()
    layerControls.addTo(map)

    class MinecraftTileLayer extends TileLayer {
        getTileUrl(coords) {
            // Invert zoom since 0 = 1:1, 1 = 2:1 etc
            const zoomFolder = this.options.maxNativeZoom - coords.z;
            const subdomains = this.options.subdomains;
            const index = Math.abs(coords.x + coords.y) % subdomains.length;

            return Util.template(this._url, {
                z: zoomFolder,
                x: coords.x * 512 * (2 ** zoomFolder), // since tiles use top left coordinate as name
                y: coords.y * 512 * (2 ** zoomFolder),
                s: subdomains[index]
            });
        }
    }

    
    let first = true
    layers.forEach((layer) => {
        const tileLayer = new MinecraftTileLayer('https://{s}.aomc-map.game.algot.net/map/{z}/{x}_{y}.png?s={s}', {
            maxNativeZoom: 9,
            minNativeZoom: 0,
            maxZoom: 15,
            minZoom: 0,
            tileSize: 512,
            attribution: '©AOMC Players',
            subdomains: "abcd",
        }).addTo(map);

        if (first) {
            tileLayer.addTo(map)
            first = false
        }
        layerControls.addBaseLayer(tileLayer, layer["name"])
    })

    return layerControls
}