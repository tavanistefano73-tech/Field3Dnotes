/**
 * Web Worker per il parsing a blocchi (Streaming Chunking) di file OBJ pesanti.
 * Riceve ArrayBuffer via Transferable Objects per evitare il blocco della RAM.
 */

let leftoverText = '';
const positions = [];
let detectedCRS = null;

// Regex per rilevare eventuali header di coordinate / CRS nelle prime righe
const crsRegex = /(?:PROJCS|GEOGCS|EPSG)\[.*?\]/i;

self.onmessage = function (e) {
    const { action, buffer } = e.data;

    if (action === 'PARSE_CHUNK') {
        // 1. Decodifica binaria del singolo chunk da 64MB
        const decoder = new TextDecoder('utf-8');
        let text = leftoverText + decoder.decode(buffer, { stream: true });

        // 2. Isolamento dell'ultima riga incompleta (a cavallo del chunk successivo)
        const lastNewLine = text.lastIndexOf('\n');
        if (lastNewLine !== -1) {
            leftoverText = text.substring(lastNewLine + 1);
            text = text.substring(0, lastNewLine);
        } else {
            leftoverText = text;
            text = '';
        }

        // 3. Rilevamento CRS facoltativo (solo se non ancora trovato)
        if (!detectedCRS) {
            const crsMatch = text.match(crsRegex);
            if (crsMatch) {
                detectedCRS = crsMatch[0];
            }
        }

        // 4. Parsing veloce per linee (Estrae vertici v x y z)
        parseObjLines(text);

        // 5. Segnala al Main Thread che il chunk è stato elaborato e richiede il successivo
        self.postMessage({ action: 'NEXT_CHUNK' });
    }
    
    else if (action === 'FINISH') {
        // Processa l'ultimo residuo di testo rasto nel buffer
        if (leftoverText.length > 0) {
            parseObjLines(leftoverText);
            leftoverText = '';
        }

        // Converti l'array Javascript standard in Float32Array per la GPU
        const floatPositions = new Float32Array(positions);

        // Calcola il centroide della geometria per il centraggio
        const centeredData = computeCentroidAndShift(floatPositions);

        // 6. Trasferisci il Float32Array finale al Main Thread usando Zero-Copy (Transferable)
        self.postMessage(
            {
                action: 'COMPLETE',
                positions: centeredData.positions.buffer, // Transferable ArrayBuffer
                center: centeredData.center,
                detectedCRS: detectedCRS
            },
            [centeredData.positions.buffer] // Liberazione istantanea di RAM nel Worker
        );

        // Reset dello stato interno del Worker
        positions.length = 0;
    }
};

/**
 * Funzione di parsing ad alta velocità per le linee del file OBJ
 */
function parseObjLines(textChunk) {
    const lines = textChunk.split('\n');
    const len = lines.length;

    for (let i = 0; i < len; i++) {
        const line = lines[i].trim();
        
        // Processa solo le righe che definiscono i vertici ("v x y z")
        if (line.startsWith('v ')) {
            const parts = line.split(/\s+/);
            if (parts.length >= 4) {
                const x = parseFloat(parts[1]);
                const y = parseFloat(parts[2]);
                const z = parseFloat(parts[3]);

                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    positions.push(x, y, z);
                }
            }
        }
    }
}

/**
 * Calcola il centroide e trasla le coordinate per evitare problemi di precisione float32
 */
function computeCentroidAndShift(coords) {
    const count = coords.length / 3;
    if (count === 0) return { positions: coords, center: [0, 0, 0] };

    let sumX = 0, sumY = 0, sumZ = 0;

    for (let i = 0; i < coords.length; i += 3) {
        sumX += coords[i];
        sumY += coords[i + 1];
        sumZ += coords[i + 2];
    }

    const centerX = sumX / count;
    const centerY = sumY / count;
    const centerZ = sumZ / count;

    // Centra i vertici rispetto all'origine
    for (let i = 0; i < coords.length; i += 3) {
        coords[i] -= centerX;
        coords[i + 1] -= centerY;
        coords[i + 2] -= centerZ;
    }

    return {
        positions: coords,
        center: [centerX, centerY, centerZ]
    };
}
