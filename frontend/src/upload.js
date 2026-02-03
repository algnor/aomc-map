import { Control, DomEvent, DomUtil } from "leaflet";
export function setupUpload(map) {
    const UploadButton = Control.extend({
        options: {
            position: 'topleft'
        },
        onAdd: function (map) {
            var container = DomUtil.create('div', 'leaflet-bar leaflet-control');
            var button = DomUtil.create('a', 'leaflet-control-button', container);
            DomEvent.disableClickPropagation(button);
            DomEvent.on(button, 'click', upload);

            container.title = "Upload new Data";
            button.innerHTML = "<img src='static/upload-file.svg'>"
            container.style = "cursor: pointer;"

            return container;
        },
        onRemove: function (map) { },
    });

    let uploadButton = new UploadButton()
    uploadButton.addTo(map)

    function upload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.png,.jpg,.jpeg,.webp,.zip';

        input.onchange = async (e) => {
            const files = e.target.files;
            if (!files.length) return;

            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);

                try {
                    const response = await fetch('/api/map/upload', {
                        method: 'POST',
                        body: formData
                    });
                    const result = await response.json();
                    console.log(`${file.name}:`, result);
                } catch (err) {
                    console.error(`Failed to upload ${file.name}:`, err);
                }
            }
        };

        input.click();
    }
}