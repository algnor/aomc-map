import { Control, DomEvent, DomUtil } from "leaflet";

const res = await fetch("static/dimensions.json")
/** @type {[]} */
const layers = await res.json()

let dimensions = []

layers.forEach((dim) => {
    dimensions.push(dim["name"])
})


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
        const modal = document.createElement('div');
        modal.className = 'upload-modal';
        modal.innerHTML = `
            <span class="close">&times;</span>
            <h3>Upload Map Data</h3>
            <div>
                <label>Dimension:</label>
                <select id="dim-select">
                    ${dimensions.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
            </div>
            <input type="file" id="file-input" multiple accept=".png,.zip" style="margin:0.5rem 0">
            <pre id="log">Select files to upload</pre>
        `;
        document.body.appendChild(modal);

        const log = modal.querySelector('#log');
        const fileInput = modal.querySelector('#file-input');
        const dimSelect = modal.querySelector('#dim-select');

        modal.querySelector('.close').onclick = () => modal.remove();

        fileInput.onchange = async () => {
            const files = fileInput.files;
            if (!files.length) return;

            const dim = dimSelect.value;
            log.textContent = '';

            // Upload
            for (const file of files) {
                log.textContent += `Uploading ${file.name}...     `;
                const formData = new FormData();
                formData.append('file', file);
                try {
                    await fetch(`/api/map/upload/${dim}`, { method: 'POST', body: formData });
                } catch (e) {
                    log.textContent += `  Error: ${e.message}\n`;
                }
                log.textContent += `(done)`;
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
