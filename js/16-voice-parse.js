// js/16-voice-parser.js

/**
 * Parser per comandi vocali multilingua (Italiano, Inglese, Spagnolo)
 * Estrae geometrie, orientamenti, attributi e comandi d'azione.
 */

// Mappature terminologiche multilingua
const TYPE_DICTIONARY = {
    // Italiano
    'faglia': 'Fault', 'stratificazione': 'Bedding', 'strato': 'Bedding', 'giunto': 'Joint',
    'frattura': 'Joint', 'foliazione': 'Foliation', 'clivaggio': 'Cleavage', 'lineazione': 'Lineation',
    'piega': 'Fold', 'veina': 'Vein', 'vena': 'Vein',
    // Inglese
    'fault': 'Fault', 'bedding': 'Bedding', 'joint': 'Joint', 'fracture': 'Joint',
    'foliation': 'Foliation', 'cleavage': 'Cleavage', 'lineation': 'Lineation',
    'fold': 'Fold', 'vein': 'Vein',
    // Spagnolo
    'falla': 'Fault', 'estratificación': 'Bedding', 'estrato': 'Bedding', 'diaclasa': 'Joint',
    'fractura': 'Joint', 'foliación': 'Foliation', 'esquistosidad': 'Cleavage',
    'lineación': 'Lineation', 'pliegue': 'Fold', 'veta': 'Vein'
};

const MODE_DICTIONARY = {
    // Italiano
    'punto': 'spot_point', 'orientazione manuale': 'spot_point', 'polilinea': 'polyline',
    'piano': 'polyline', 'poligono': 'draped_polygon', 'poligono drappeggiato': 'draped_polygon',
    'linea semplice': 'simple_polyline', 'nota': 'note', 'appunto': 'note',
    // Inglese
    'spot': 'spot_point', 'manual spot': 'spot_point', 'polyline': 'polyline',
    'plane': 'polyline', 'polygon': 'draped_polygon', 'draped polygon': 'draped_polygon',
    'simple line': 'simple_polyline', 'note': 'note',
    // Spagnolo
    'punto manual': 'spot_point', 'orientación manual': 'spot_point', 'polilínea': 'polyline',
    'plano': 'polyline', 'polígono': 'draped_polygon', 'polígono drapeado': 'draped_polygon',
    'línea simple': 'simple_polyline', 'nota': 'note'
};

const GEOMETRY_DICTIONARY = {
    // Italiano
    'piano': 'plane', 'linea': 'line', 'piano e linea': 'plane&line',
    // Inglese
    'plane': 'plane', 'line': 'line', 'plane and line': 'plane&line',
    // Spagnolo
    'plano': 'plane', 'línea': 'line', 'plano y línea': 'plane&line'
};

const SENSE_DICTIONARY = {
    // Italiano
    'normale': 'normal', 'inverso': 'reverse', 'rigetto inverso': 'reverse',
    'destro': 'right lateral', 'trascorrente destro': 'right lateral',
    'sinistro': 'left lateral', 'trascorrente sinistro': 'left lateral',
    // Inglese
    'normal': 'normal', 'reverse': 'reverse', 'right lateral': 'right lateral',
    'dextral': 'right lateral', 'left lateral': 'left lateral', 'sinistral': 'left lateral',
    // Spagnolo
    'normal': 'normal', 'inversa': 'reverse', 'falla inversa': 'reverse',
    'dextral': 'right lateral', 'dextra': 'right lateral',
    'sinistral': 'left lateral', 'sinestra': 'left lateral'
};

/**
 * Normalizza il testo rimuovendo punteggiatura e convertendo i numeri in parola a cifre
 */
function normalizeVoiceText(text) {
    if (!text) return '';
    let clean = text.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();

    // Sostituzione base per numeri comuni pronunciati a parole (IT/EN/ES)
    const numberWords = {
        'zero': '0', 'cero': '0',
        'uno': '1', 'one': '1',
        'due': '2', 'two': '2', 'dos': '2',
        'tre': '3', 'three': '3', 'tres': '3',
        'quattro': '4', 'four': '4', 'cuatro': '4',
        'cinque': '5', 'five': '5', 'cinco': '5'
    };

    Object.keys(numberWords).forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        clean = clean.replace(regex, numberWords[word]);
    });

    return clean;
}

/**
 * Funzione principale di Parsing del testo trasfomato da Speech-to-Text
 * @param {string} rawText - Testo trascritto
 * @returns {Object} Oggetto strutturato con i comandi estratti
 */
window.parseAdvancedVoiceCommand = parseAdvancedVoiceCommand;

function parseAdvancedVoiceCommand(rawText) {
    const text = normalizeVoiceText(rawText);
    const result = {
        raw: rawText,
        mode: null,
        geometry: null,
        type: null,
        unit: null,
        set: null,
        strike: null,
        dipdir: null,
        dip: null,
        trend: null,
        plunge: null,
        rake: null,
        sense: null,
        noteText: null,
        trigger_action: false
    };

    if (!text) return result;

    // 1. Estrazione Modalità di acquisizione
    for (const [key, value] of Object.entries(MODE_DICTIONARY)) {
        if (text.includes(key)) {
            result.mode = value;
            break;
        }
    }

    // 2. Estrazione Tipo di Geometria
    for (const [key, value] of Object.entries(GEOMETRY_DICTIONARY)) {
        if (text.includes(key)) {
            result.geometry = value;
            break;
        }
    }

    // 3. Estrazione Tipo di Struttura (Type)
    for (const [key, value] of Object.entries(TYPE_DICTIONARY)) {
        if (text.includes(key)) {
            result.type = value;
            break;
        }
    }

    // 4. Estrazione Senso di Movimento (Sense)
    for (const [key, value] of Object.entries(SENSE_DICTIONARY)) {
        if (text.includes(key)) {
            result.sense = value;
            break;
        }
    }

    // 5. Estrazione Valori Numerici (Strike, DipDir, Dip, Trend, Plunge, Rake)
    // IT: "immersione 120 inclinazione 45", EN: "dip direction 120 dip 45", ES: "direccion de manteo 120 manteo 45"
    
    // Dip Direction / Immersione / Dirección de manteo
    const dipDirMatch = text.match(/(?:dip\s*dir|dip\s*direction|immersione|direccio[nñ]\s*de\s*manteo)\s*(\d{1,3})/);
    if (dipDirMatch) result.dipdir = parseInt(dipDirMatch[1], 10);

    // Strike / Direzione / Rumbo
    const strikeMatch = text.match(/(?:strike|direzione|rumbo)\s*(\d{1,3})/);
    if (strikeMatch) result.strike = parseInt(strikeMatch[1], 10);

    // Dip / Inclinazione / Manteo / Inclinación
    const dipMatch = text.match(/(?:dip|inclinazione|inclinacio[nñ]|manteo)\s*(\d{1,2})/);
    if (dipMatch) result.dip = parseInt(dipMatch[1], 10);

    // Trend / Immersione linea / Tendencia
    const trendMatch = text.match(/(?:trend|immersione\s*linea|tendencia)\s*(\d{1,3})/);
    if (trendMatch) result.trend = parseInt(trendMatch[1], 10);

    // Plunge / Inclinazione linea / Inmersión
    const plungeMatch = text.match(/(?:plunge|inclinazione\s*linea|inmersio[nñ])\s*(\d{1,2})/);
    if (plungeMatch) result.plunge = parseInt(plungeMatch[1], 10);

    // Rake
    const rakeMatch = text.match(/(?:rake)\s*(\d{1,3})/);
    if (rakeMatch) result.rake = parseInt(rakeMatch[1], 10);

    // 6. Estrazione Unit / Unità / Formazione
    const unitMatch = text.match(/(?:unit|unita|unità|formazione|formacio[nñ])\s+([a-z0-9_\-]+)/);
    if (unitMatch) result.unit = unitMatch[1].toUpperCase();

    // 7. Estrazione Set / Famiglia
    const setMatch = text.match(/(?:set|famiglia|grupo)\s+([a-z0-9_\-]+)/);
    if (setMatch) result.set = setMatch[1].toUpperCase();

    // 8. Trigger d'azione immediata (Acquisisci, Scatta, Salva, Save, Capture, Tomar)
    if (/(?:scatta|acquisisci|salva|prendi|capture|save|take|tomar|guardar|capturar)/.test(text)) {
        result.trigger_action = true;
    }

    // 9. Se la modalità è "Note", isola il testo della nota
    if (result.mode === 'note' || text.startsWith('nota') || text.startsWith('note')) {
        result.mode = 'note';
        result.noteText = rawText.replace(/^(nota|note)\s*/i, '').trim();
    }

    return result;
}

// Esposizione per moduli ES6 e contesti globali
if (typeof window !== 'undefined') {
    window.parseAdvancedVoiceCommand = parseAdvancedVoiceCommand;
}
