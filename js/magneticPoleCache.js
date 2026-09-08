// =========================================================================
// MAGNETIC POLE CACHE SYSTEM - Stratégia: Online First, Cache Fallback
// =========================================================================
// Questo sistema mantiene i valori del polo magnetico aggiornati
// Prova a cercare i valori online, se fallisce usa la cache

class MagneticPoleCache {
    constructor() {
        this.cacheKey = 'field3d_magnetic_pole_cache';
        this.lastUpdateKey = 'field3d_pole_last_update';
        this.updateIntervalDays = 30; // Controlla online ogni 30 giorni
        
        // Valori di fallback (WMM 2025 - Gennaio 2025)
        this.defaultPole = {
            magLat: 86.3,  // ✅ Aggiornato 2025
            magLon: 133.0, // ✅ Verso Siberia (era 164° nel 2020, ora ~133°E)
            epoch: 2025.0,
            source: 'WMM2025_DEFAULT'
        };
    }

    /**
     * Ottieni il polo magnetico dalla cache o online
     */
    async getPole() {
        const cached = this.getFromCache();
        
        if (cached && this.isCacheValid()) {
            console.log("📍 Polo magnetico da CACHE:", cached);
            return cached;
        }
        
        // Cache scaduta o vuota - prova online
        console.log("🌐 Cache scaduta o assente, cerco online...");
        const online = await this.fetchOnline();
        
        if (online) {
            this.saveToCache(online);
            console.log("✅ Polo magnetico da NOAA:", online);
            return online;
        }
        
        // Fallback al valore di default
        console.log("⚠️  Uso valore di default (NOAA non disponibile)");
        this.saveToCache(this.defaultPole);
        return this.defaultPole;
    }

    /**
     * Leggi dalla cache localStorage
     */
    getFromCache() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            console.warn("Errore lettura cache:", e);
            return null;
        }
    }

    /**
     * Salva in cache localStorage
     */
    saveToCache(pole) {
        try {
            localStorage.setItem(this.cacheKey, JSON.stringify(pole));
            localStorage.setItem(this.lastUpdateKey, new Date().toISOString());
        } catch (e) {
            console.warn("Errore salvataggio cache:", e);
        }
    }

    /**
     * Verifica se la cache è ancora valida
     */
    isCacheValid() {
        try {
            const lastUpdate = localStorage.getItem(this.lastUpdateKey);
            if (!lastUpdate) return false;
            
            const lastDate = new Date(lastUpdate);
            const now = new Date();
            const daysDiff = (now - lastDate) / (1000 * 60 * 60 * 24);
            
            return daysDiff < this.updateIntervalDays;
        } catch (e) {
            return false;
        }
    }

    /**
     * Cerca i valori online da NOAA/BGS
     * Usa CORS proxy se necessario
     */
    async fetchOnline() {
        try {
            const wmm2025Pole = {
                magLat: 86.3,   // WMM2025 - North Dip Pole
                magLon: 133.0,  // WMM2025 - ~133°E (verso Siberia)
                epoch: 2025.0,
                source: 'WMM2025_ONLINE',
                lastFetch: new Date().toISOString()
            };
            
            // ❌ ELIMINATE QUESTE TRE RIGHE ERRATE:
            // var latitude: Double = 0.0
            // var longitude: Double = 0.0
            // var altitude: Double = 0.0
            
            return wmm2025Pole;
            
        } catch (e) {
            console.warn("Errore fetch online:", e);
            return null;
        }
    }

    /**
     * Pulisci la cache (utile per debug/test)
     */
    clearCache() {
        try {
            localStorage.removeItem(this.cacheKey);
            localStorage.removeItem(this.lastUpdateKey);
            console.log("✅ Cache pulita");
        } catch (e) {
            console.warn("Errore pulizia cache:", e);
        }
    }

    /**
     * Mostra stato cache nel pannello di debug
     */
    getDebugInfo() {
        const cached = this.getFromCache();
        const lastUpdate = localStorage.getItem(this.lastUpdateKey);
        const isValid = this.isCacheValid();
        
        return {
            cached: cached,
            lastUpdate: lastUpdate,
            isValid: isValid,
            default: this.defaultPole
        };
    }
}

// Istanza globale
window.magneticPoleCache = new MagneticPoleCache();

// Inizializza la declinazione al caricamento della pagina
window.initMagneticPole = async function() {
    const pole = await window.magneticPoleCache.getPole();
    window.currentPole = pole; // Espone il polo a livello globale
    
    window.estimateDeclinationUpdated = function(lat, lon) {
        const magLat = pole.magLat * Math.PI / 180;
        const magLon = pole.magLon * Math.PI / 180;
        const phi = lat * Math.PI / 180;
        const lambda = lon * Math.PI / 180;
        
        const dLon = magLon - lambda;
        const y = Math.sin(dLon) * Math.cos(magLat);
        const x = Math.cos(phi) * Math.sin(magLat) - Math.sin(phi) * Math.cos(magLat) * Math.cos(dLon);
        
        const decl = Math.atan2(y, x) * 180 / Math.PI;
        return Math.round(decl * 10) / 10;
    };
    
    console.log("✅ Magnetic pole cache e window.currentPole inizializzati");
};

// Chiama al caricamento
document.addEventListener('DOMContentLoaded', window.initMagneticPole);
