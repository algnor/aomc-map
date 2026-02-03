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
        input.accept = '.png,.zip';

        input.onchange = async (e) => {
            const files = e.target.files;
            if (!files.length) return;

            const status = document.createElement('div');
            status.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:5px;z-index:9999;';
            document.body.appendChild(status);

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                status.textContent = `Uploading ${i + 1}/${files.length}: ${file.name}`;

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

            status.textContent = 'Upload complete';
            setTimeout(() => status.remove(), 2000);
        };

        input.click();
    }
}