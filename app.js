const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const TOLERANCIA_CENTS = 5;

// Variables para el suavizado fluido
let smoothedFrequency = 0;
const SMOOTHING_FACTOR = 0.2; // Entre 0 y 1. Menor = más lento/estable. Mayor = más rápido.

let audioContext;
let analyser;
let dataArray;

function getNoteFromFrequency(frequency) {
    const n = 12 * Math.log2(frequency / 440) + 69;
    const roundedN = Math.round(n);
    const expectedFreq = 440 * Math.pow(2, (roundedN - 69) / 12);
    return {
        name: noteNames[roundedN % 12] + (Math.floor(roundedN / 12) - 1),
        expectedFreq: expectedFreq
    };
}

const startBtn = document.getElementById('start-btn');
const noteDisplay = document.getElementById('note-display');
const freqDisplay = document.getElementById('frequency');
const indicator = document.getElementById('indicator');

startBtn.onclick = async () => {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const microphone = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        microphone.connect(analyser);
        dataArray = new Float32Array(analyser.fftSize);
        startBtn.style.display = 'none'; // Escondemos el botón al iniciar
        updateTuner();
    } catch (err) {
        alert("Error al acceder al micrófono: " + err);
    }
};

function updateTuner() {
    analyser.getFloatTimeDomainData(dataArray);
    let rawFrequency = autoCorrelate(dataArray, audioContext.sampleRate);

    // Filtro de rango de guitarra y volumen
    if (rawFrequency > 60 && rawFrequency < 1000) {
        
        // --- LA MAGIA DEL SUAVIZADO ---
        if (smoothedFrequency === 0) {
            smoothedFrequency = rawFrequency; // Primera detección
        } else {
            // "Leaky Integrator": La nueva frecuencia es un 20% de la actual y 80% de la anterior
            smoothedFrequency = (rawFrequency * SMOOTHING_FACTOR) + (smoothedFrequency * (1 - SMOOTHING_FACTOR));
        }

        const noteData = getNoteFromFrequency(smoothedFrequency);
        const centsOff = 1200 * Math.log2(smoothedFrequency / noteData.expectedFreq);
        
        // Actualizar Interfaz
        noteDisplay.innerText = noteData.name;
        freqDisplay.innerText = `Frecuencia: ${smoothedFrequency.toFixed(1)} Hz`;
        
        let position = 50 + centsOff;
        position = Math.max(0, Math.min(100, position));
        indicator.style.left = `${position}%`;

        if (Math.abs(centsOff) < TOLERANCIA_CENTS) {
            indicator.style.background = "#00e676";
            noteDisplay.style.color = "#00e676";
        } else {
            indicator.style.background = "#ff5252";
            noteDisplay.style.color = "#ffffff";
        }
    }

    requestAnimationFrame(updateTuner);
}

// Algoritmo de autocorrelación estándar (el que te funcionaba antes)
function autoCorrelate(buffer, sampleRate) {
    let size = buffer.length;
    let rms = 0;
    for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
    if (Math.sqrt(rms / size) < 0.01) return -1;

    let bestOffset = -1;
    let bestCorrelation = 0;
    let maxSamples = Math.floor(size / 2);
    
    for (let offset = 0; offset < maxSamples; offset++) {
        let correlation = 0;
        for (let i = 0; i < maxSamples; i++) {
            correlation += Math.abs(buffer[i] - buffer[i + offset]);
        }
        if (bestOffset === -1 || correlation < bestCorrelation) {
            bestCorrelation = correlation;
            bestOffset = offset;
        }
    }
    return sampleRate / bestOffset;
}