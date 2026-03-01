// 1. Configuración de notas y frecuencias (E2 a E4)
const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function getNoteFromFrequency(frequency) {
    // Fórmula para obtener el número de nota MIDI
    const n = 12 * Math.log2(frequency / 440) + 69;
    const roundedN = Math.round(n);
    
    // Calcular la frecuencia teórica perfecta para esa nota
    const expectedFreq = 440 * Math.pow(2, (roundedN - 69) / 12);
    
    // Obtener el nombre y la octava (ej. "E" + "2")
    const name = noteNames[roundedN % 12];
    const octave = Math.floor(roundedN / 12) - 1;
    
    return {
        name: name + octave,
        expectedFreq: expectedFreq,
        diffInHz: frequency - expectedFreq
    };
}

let audioContext;
let analyser;
let microphone;
let dataArray;

const startBtn = document.getElementById('start-btn');
const noteDisplay = document.getElementById('note-display');
const freqDisplay = document.getElementById('frequency');
const indicator = document.getElementById('indicator');

// 2. Función para iniciar el micrófono
startBtn.onclick = async () => {
    // Crear el contexto de audio (necesario en navegadores)
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphone = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // Tamaño de la muestra de audio
        
        microphone.connect(analyser);
        dataArray = new Float32Array(analyser.fftSize);
        
        startBtn.innerText = "Escuchando...";
        updateTuner(); // Iniciar el bucle de detección
    } catch (err) {
        alert("No se pudo acceder al micrófono: " + err);
    }
};

// 3. Algoritmo de detección de frecuencia (Autocorrelación simple)
function autoCorrelate(buffer, sampleRate) {
    let size = buffer.length;
    let rms = 0;

    // 1. Calcular el volumen (Root Mean Square)
    for (let i = 0; i < size; i++) {
        rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / size);

    // Si el volumen es muy bajo (silencio), no procesar
    if (rms < 0.01) return -1; 

    // 2. Recortar la señal para eliminar ruido de los bordes
    let r1 = 0, r2 = size - 1, thres = 0.2;
    for (let i = 0; i < size / 2; i++) if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
    for (let i = 1; i < size / 2; i++) if (Math.abs(buffer[size - i]) < thres) { r2 = size - i; break; }
    let bufferTrimmed = buffer.slice(r1, r2);
    let sizeTrimmed = bufferTrimmed.length;

    // 3. Autocorrelación
    let c = new Array(sizeTrimmed).fill(0);
    for (let i = 0; i < sizeTrimmed; i++) {
        for (let j = 0; j < sizeTrimmed - i; j++) {
            c[i] = c[i] + bufferTrimmed[j] * bufferTrimmed[j + i];
        }
    }

    // Buscar el primer pico después del descenso inicial
    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < sizeTrimmed; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }

    // 4. Validación de seguridad contra el "Infinity"
    if (maxpos > 0) {
        return sampleRate / maxpos;
    } else {
        return -1;
    }
}

// 4. Bucle de actualización visual
// --- NUEVAS VARIABLES DE CONTROL ---
let lastFrequencies = []; // Para el promedio móvil
const SMOOTHING_SAMPLES = 10; // Cantidad de muestras para suavizar
const TOLERANCIA_CENTS = 5; 

function getAverageFrequency(newFreq) {
    lastFrequencies.push(newFreq);
    if (lastFrequencies.length > SMOOTHING_SAMPLES) {
        lastFrequencies.shift();
    }
    // Calcular el promedio
    return lastFrequencies.reduce((a, b) => a + b) / lastFrequencies.length;
}

function updateTuner() {
    analyser.getFloatTimeDomainData(dataArray);
    let rawFrequency = autoCorrelate(dataArray, audioContext.sampleRate);

    // 1. Filtrar ruido y frecuencias absurdas para guitarra (Rango: 60Hz a 1000Hz)
    if (rawFrequency !== -1 && isFinite(rawFrequency) && rawFrequency > 60 && rawFrequency < 1000) {
        
        // 2. Aplicar Suavizado (Smoothing)
        const frequency = getAverageFrequency(rawFrequency);
        
        freqDisplay.innerText = `Frecuencia: ${frequency.toFixed(2)} Hz`;
        
        const noteData = getNoteFromFrequency(frequency);
        noteDisplay.innerText = noteData.name;

        // 3. Cálculo de Cents con la nueva frecuencia promediada
        const centsOff = 1200 * Math.log2(frequency / noteData.expectedFreq);
        
        // Mapeo: El centro es 50%. 
        // Dividimos por 2 para que la aguja no sea tan nerviosa (rango visual de +-50 cents)
        let position = 50 + (centsOff); 
        position = Math.max(0, Math.min(100, position));
        
        // Aplicamos la posición con una transición suave en CSS (opcional)
        indicator.style.left = `${position}%`;

        // 4. Lógica de Color (Zona de éxito)
        if (Math.abs(centsOff) < TOLERANCIA_CENTS) {
            indicator.style.background = "#00e676"; 
            noteDisplay.style.color = "#00e676";
        } else {
            indicator.style.background = "#ff5252"; 
            noteDisplay.style.color = "#ffffff";
        }
    } else {
        // Si no hay sonido claro, vamos vaciando el promedio poco a poco
        if (lastFrequencies.length > 0) lastFrequencies.shift();
    }

    requestAnimationFrame(updateTuner);
}