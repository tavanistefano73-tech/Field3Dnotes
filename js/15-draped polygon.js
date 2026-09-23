
/**
 * Modulo per la gestione dei poligoni drappeggiati (Sub-Mesh Extraction)
 */
const DrapedPolygonManager = {
    polygons: [],

    /**
     * Inizializza un nuovo poligono a partire da vertici di perimetro e lo aggiunge alla scena
     */
    createPolygon(boundaryPoints, unit = "", attributes = {}, terrainMesh, scene) {
        const id = 'poly_' + Date.now();
        
        // Genera la sub-mesh 3D estrando i triangoli dal terreno
        const mesh = this.extractSubMesh(terrainMesh, boundaryPoints);
        if (mesh) {
            mesh.userData = { id, type: 'drapedPolygon', unit, attributes, boundaryPoints };
            scene.add(mesh);

            const polygonData = { id, unit, attributes, boundaryPoints, meshRef: mesh };
            this.polygons.push(polygonData);
            return polygonData;
        }
        return null;
    },

    /**
     * Estrae i triangoli della superficie del terreno compresi all'interno del perimetro
     */
    extractSubMesh(terrainMesh, boundaryPoints) {
        if (!terrainMesh || boundaryPoints.length < 3) return null;

        const geometry = terrainMesh.geometry;
        const posAttr = geometry.attributes.position;
        const indexAttr = geometry.index;
        const worldMatrix = terrainMesh.matrixWorld;

        // Convertere i punti del perimetro in coordinate locali XY del terreno
        const poly2D = boundaryPoints.map(p => new THREE.Vector2(p.x, p.y));

        const extractedPositions = [];

        // Funzione per verificare se un punto 2D è dentro il poligono (Ray-casting algorithm)
        const isPointInPolygon = (point, vs) => {
            let x = point.x, y = point.y;
            let inside = false;
            for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                let xi = vs[i].x, yi = vs[i].y;
                let xj = vs[j].x, yj = vs[j].y;
                let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };

        const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
        const center2D = new THREE.Vector2();

        // Scansione dei triangoli del terreno
        const triangleCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

        for (let i = 0; i < triangleCount; i++) {
            let idxA, idxB, idxC;
            if (indexAttr) {
                idxA = indexAttr.getX(i * 3);
                idxB = indexAttr.getX(i * 3 + 1);
                idxC = indexAttr.getX(i * 3 + 2);
            } else {
                idxA = i * 3; idxB = i * 3 + 1; idxC = i * 3 + 2;
            }

            vA.fromBufferAttribute(posAttr, idxA).applyMatrix4(worldMatrix);
            vB.fromBufferAttribute(posAttr, idxB).applyMatrix4(worldMatrix);
            vC.fromBufferAttribute(posAttr, idxC).applyMatrix4(worldMatrix);

            // Calcolo del centro del triangolo nel piano XY
            center2D.set((vA.x + vB.x + vC.x) / 3, (vA.y + vB.y + vC.y) / 3);

            // Se il centro del triangolo ricade all'interno del perimetro
            if (isPointInPolygon(center2D, poly2D)) {
                extractedPositions.push(vA.x, vA.y, vA.z);
                extractedPositions.push(vB.x, vB.y, vB.z);
                extractedPositions.push(vC.x, vC.y, vC.z);
            }
        }

        if (extractedPositions.length === 0) return null;

        // Creazione nuova geometria pulita
        const subGeometry = new THREE.BufferGeometry();
        subGeometry.setAttribute('position', new THREE.Float32BufferAttribute(extractedPositions, 3));
        subGeometry.computeVertexNormals();

        // Materiale semitrasparente con PolygonOffset per evitare Z-fighting
        const material = new THREE.MeshBasicMaterial({
            color: 0x3388ff,
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2
        });

        return new THREE.Mesh(subGeometry, material);
    },

    /**
     * Serializzazione pulita per export JSON (esporta solo il bordo)
     */
    exportToJSONData() {
        return this.polygons.map(p => ({
            type: "drapedPolygon",
            id: p.id,
            unit: p.unit,
            attributes: p.attributes,
            boundaryPoints: p.boundaryPoints
        }));
    },

    /**
     * Rigenera tutti i poligoni partendo dal file JSON caricato
     */
    importFromJSONData(jsonDataArray, terrainMesh, scene) {
        this.clearAll(scene);
        
        jsonDataArray.forEach(item => {
            if (item.type === "drapedPolygon") {
                this.createPolygon(
                    item.boundaryPoints,
                    item.unit,
                    item.attributes,
                    terrainMesh,
                    scene
                );
            }
        });
    },

    /**
     * Rimuove tutti i poligoni dalla scena
     */
    clearAll(scene) {
        this.polygons.forEach(p => {
            if (p.meshRef) {
                scene.remove(p.meshRef);
                p.meshRef.geometry.dispose();
                p.meshRef.material.dispose();
            }
        });
        this.polygons = [];
    }
};
