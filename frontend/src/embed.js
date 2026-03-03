import { Map } from "leaflet";

/**
 * @param {Map} map 
 */
export function setupEmbed(map) {
    const params = new URLSearchParams(window.location.search)
    const embed = params.get("embed") || false
    if (!embed) return

    document.getElementsByClassName("leaflet-control-container")[0].style.display = "none"
    document.body.style.fontSize = "200%"
}