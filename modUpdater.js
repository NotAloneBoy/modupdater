document.addEventListener('DOMContentLoaded', async () => {
    const versionSelector = document.getElementById('versionSelector');
    const logText = document.getElementById('logText');
    const includeSnapshotsCheckbox = document.getElementById('includeSnapshots');

    function log(message) {
        logText.textContent += message + '\n';
        logText.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    async function fetchMinecraftVersions() {
        try {
            log('Fetching Minecraft versions...');
            const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
            const data = await response.json();
            
            const includeSnapshots = includeSnapshotsCheckbox.checked;
            const filteredVersions = data.versions.filter(version => 
                includeSnapshots || version.type === 'release'
            );

            const latestVersions = filteredVersions.slice(0, 10);

            versionSelector.innerHTML = '';
            latestVersions.forEach(version => {
                const option = document.createElement('option');
                option.value = version.id;
                option.textContent = version.id;
                versionSelector.appendChild(option);
            });

            log('Minecraft versions fetched successfully.');
        } catch (error) {
            console.error('Failed to fetch Minecraft versions:', error);
            log('Failed to load versions: ' + error.message);
            versionSelector.innerHTML = '<option value="">Failed to load versions</option>';
        }
    }

    await fetchMinecraftVersions();

    includeSnapshotsCheckbox.addEventListener('change', async () => {
        await fetchMinecraftVersions();
    });
});

document.getElementById('updateButton').addEventListener('click', async function () {
    const fileInput = document.getElementById('modFile');
    const logText = document.getElementById('logText');
    const versionSelector = document.getElementById('versionSelector');
    const progress = document.getElementById('progress');

    function log(message) {
        logText.textContent += message + '\n';
        logText.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    if (!fileInput.files.length) {
        alert("Please upload a ZIP file containing your mods.");
        return;
    }

    const file = fileInput.files[0];
    progress.style.display = 'block';

    try {
        log('Processing file...');
        const zip = await JSZip.loadAsync(file);
        const modsList = await parseMods(zip);
        const targetVersion = versionSelector.value;
        const updatedMods = await getUpdatedMods(modsList, targetVersion);
        const updatedZip = await createUpdatedZip(updatedMods);

        const downloadLink = document.getElementById('downloadLink');
        const blob = await updatedZip.generateAsync({ type: "blob" });
        downloadLink.href = URL.createObjectURL(blob);
        document.getElementById('downloadSection').style.display = 'block';

        log('Mod update completed successfully.');
    } catch (error) {
        console.error("Error during mod update:", error);
        alert("An error occurred during the mod update process.");
        log('Error: ' + error.message);
    } finally {
        progress.style.display = 'none';
    }
});

async function parseMods(zip) {
    let modsList = [];
    const fabricModJson = 'fabric.mod.json';
    const logText = document.getElementById('logText');

    function log(message) {
        logText.textContent += message + '\n';
        logText.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    try {
        log('Parsing mods...');
        const files = Object.keys(zip.files);
        for (let i = 0; i < files.length; i++) {
            const filename = files[i];
            if (filename.endsWith('.jar')) {
                log(`Parsing ${filename} [${i + 1}/${files.length}]`);
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
        log('Mods parsed successfully.');
    } catch (error) {
        log('Error parsing mods: ' + error.message);
        throw error;
    }

    return modsList;
}

async function getUpdatedMods(modsList, targetVersion) {
    const updatedMods = [];
    const apiBase = "https://api.modrinth.com/v2/";
    const logText = document.getElementById('logText');

    function log(message) {
        logText.textContent += message + '\n';
        logText.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    try {
        log('Fetching mods...');
        for (let i = 0; i < modsList.length; i++) {
            const mod = modsList[i];
            log(`Searching for ${mod.name} [${i + 1}/${modsList.length}]`);
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
                    log(`Found update match for ${mod.name}: ${latestFile.filename}`);
                }
            }
        }
        log('Updates fetched successfully.');
    } catch (error) {
        log('Error fetching updates: ' + error.message);
        throw error;
    }

    return updatedMods;
}

async function createUpdatedZip(mods) {
    const newZip = new JSZip();
    const logText = document.getElementById('logText');

    function log(message) {
        logText.textContent += message + '\n';
        logText.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    try {
        log('Creating updated ZIP file...');
        for (let i = 0; i < mods.length; i++) {
            const mod = mods[i];
            log(`Downloading ${mod.filename} [${i + 1}/${mods.length}]`);
            const response = await fetch(mod.url);
            const blob = await response.blob();
            newZip.file(mod.filename, blob);
        }
        
        log('Updated ZIP file created successfully.');
    } catch (error) {
        log('Error creating updated ZIP file: ' + error.message);
        throw error;
    }

    return newZip;
}
