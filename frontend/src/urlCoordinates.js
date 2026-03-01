import { Map } from "leaflet";

/**
 * 
 * @param {Map} map 
 */
export function setupUrlCoordinates(map) {
    const params = new URLSearchParams(window.location.search)
    
    if (params.has("x") && params.has("z") && params.has("zoom")) {
        const x = parseFloat(params.get("x"))
        const z = parseFloat(params.get("z"))
        const zoom = params.get("zoom") ?? map.getZoom()
        
        map.setView([z, x], zoom, {animate: false})
    }
    
    map.addEventListener("moveend", handleMove)
}
function handleMove(e) {
    const center = e.target.getCenter()
    const zoom = e.target.getZoom()
    
    const params = new URLSearchParams(window.location.search)
    params.set('x', Math.round(center.lng))
    params.set('z', Math.round(center.lat))
    params.set('zoom', zoom)
    
    window.history.replaceState({}, "", `?${params}`);
}