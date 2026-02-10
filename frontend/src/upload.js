import { Control, DomEvent, DomUtil, Map } from "leaflet";

const res = await fetch("static/dimensions.json")
/** @type {[]} */
const layers = await res.json()

let dimensions = []

layers.forEach((dim) => {
    dimensions.push(dim["name"])
})


/**
 * 
 * @param {Map} map 
 */
export function setupUpload(map) {
    const UploadButton = Control.extend({
        options: { position: 'topleft' },
        onAdd: function () {
            const container = DomUtil.create('div', 'leaflet-bar leaflet-control');
            const button = DomUtil.create('a', 'leaflet-control-button', container);
            DomEvent.disableClickPropagation(button);
            DomEvent.on(button, 'click', openModal);
            container.title = "Upload new Data";
            button.innerHTML = "<img src='static/upload-file.svg'>";
            container.style.cursor = "pointer";
            return container;
        },
        onRemove: function () { },
    });

    new UploadButton().addTo(map);

    function openModal() {
        const params = new URLSearchParams(window.location.search)
        const dim = params.get("dim") || layers[0]["name"]
        const modal = document.createElement('div');
        modal.className = 'upload-modal';
        modal.innerHTML = `
            <span class="close">&times;</span>
            <h3>Upload Map Data</h3>
            <div>
                <label>Dimension: <b>${dim}</b></label>
            </div>
            <input type="file" id="file-input" multiple accept=".png,.zip" style="margin:0.5rem 0">
            <pre id="log">Select files to upload</pre>
        `;
        document.body.appendChild(modal);

        const log = modal.querySelector('#log');
        const fileInput = modal.querySelector('#file-input');

        modal.querySelector('.close').onclick = () => modal.remove();
        
        map.on("baselayerchange", (e) => {
            modal.remove()
            map.off("baselayerchange", modal.remove)
        })

        fileInput.onchange = async () => {
            const files = fileInput.files;
            if (!files.length) return;

            log.textContent = '';

            if (!confirm(`Your are uploading ${files.length} file(s) to ${dim}\nDo you want to proceed?`)) {
                modal.remove()
                return
            }

            // Upload
            for (const file of files) {
                log.textContent += `Uploading ${file.name}...  `;
                const formData = new FormData();
                formData.append('file', file);
                try {
                    await fetch(`/api/map/upload/${dim}`, { method: 'POST', body: formData });
                } catch (e) {
                    log.textContent += `  Error: ${e.message}\n`;
                }
                log.textContent += `(Done!) \n`;
            }

            // Process
            log.textContent += '\nProcessing...\n';
            try {
                const res = await fetch('/api/map/process', { method: 'POST' });
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    log.textContent += decoder.decode(value);
                    log.scrollTop = log.scrollHeight;
                }
            } catch (e) {
                log.textContent += `Error: ${e.message}\n`;
            }
        };
    }
}
