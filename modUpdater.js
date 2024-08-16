// https://github.com/NotAloneBoy/modupdater

// Code written with help of GPT-4o
// chatgpt.com

document.addEventListener('DOMContentLoaded', async () => {
    const versionSelector = document.getElementById('versionSelector');

    async function fetchMinecraftVersions() {
        try {
            const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
            const data = await response.json();

            const latestVersions = data.versions.slice(0, 10);

            versionSelector.innerHTML = '';
            latestVersions.forEach(version => {
                const option = document.createElement('option');
                option.value = version.id;
                option.textContent = version.id;
                versionSelector.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to fetch Minecraft versions:', error);
            versionSelector.innerHTML = '<option value="">Failed to load versions</option>';
        }
    }

    await fetchMinecraftVersions();
});

document.getElementById('updateButton').addEventListener('click', async function () {
    const fileInput = document.getElementById('modFile');
    if (!fileInput.files.length) {
        alert("Please upload a ZIP file containing your mods.");
        return;
    }

    const file = fileInput.files[0];
    const progress = document.getElementById('progress');
    progress.style.display = 'block';

    try {
        const zip = await JSZip.loadAsync(file);
        const modsList = await parseMods(zip);
        const targetVersion = versionSelector.value;
        const updatedMods = await getUpdatedMods(modsList, targetVersion);
        const updatedZip = await createUpdatedZip(updatedMods);

        const downloadLink = document.getElementById('downloadLink');
        const blob = await updatedZip.generateAsync({ type: "blob" });
        downloadLink.href = URL.createObjectURL(blob);
        document.getElementById('downloadSection').style.display = 'block';

    } catch (error) {
        console.error("Error during mod update:", error);
        alert("An error occurred during the mod update process.");
    } finally {
        progress.style.display = 'none';
    }
});

async function parseMods(zip) {
    let modsList = [];
    const fabricModJson = 'fabric.mod.json';

    for (const filename of Object.keys(zip.files)) {
        if (filename.endsWith('.jar')) {
            const jarFile = await zip.files[filename].async('blob');
            const innerZip = await JSZip.loadAsync(jarFile);
            if (innerZip.file(fabricModJson)) {
                const modJsonData = await innerZip.file(fabricModJson).async('string');
                const modInfo = JSON.parse(modJsonData);
                modsList.push({
                    id: modInfo.id,
                    version: modInfo.version,
                    name: modInfo.name,
                    description: modInfo.description
                });
            }
        }
    }
    return modsList;
}

async function getUpdatedMods(modsList, targetVersion) {
    const updatedMods = [];
    const apiBase = "https://api.modrinth.com/v2/";

    for (const mod of modsList) {
        const searchUrl = `${apiBase}search?query=${mod.name}&facets=[["project_type:mod"]]`;
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.hits && data.hits.length > 0) {
            const modInfo = data.hits[0];
            const versionUrl = `${apiBase}project/${modInfo.slug}/version?game_versions=["${targetVersion}"]&loaders=["fabric"]`;
            const versionResponse = await fetch(versionUrl);
            const versionData = await versionResponse.json();

            if (versionData.length > 0) {
                const latestFile = versionData[0].files[0];
                updatedMods.push({
                    url: latestFile.url,
                    filename: latestFile.filename
                });
            }
        }
    }
    return updatedMods;
}

async function createUpdatedZip(mods) {
    const newZip = new JSZip();

    for (const mod of mods) {
        const response = await fetch(mod.url);
        const blob = await response.blob();
        newZip.file(mod.filename, blob);
    }
    
    return newZip;
}
