// Global state for our application
const state = {
    audioContext: null,
    audioBuffers: {}, // Stores the decoded AudioBuffers (the song data)
    tracks: [],       // Stores active tracks (SourceNode, GainNode, UI elements)
    isInitialized: false,
    isPlayingAll: false,
};

// --- AUDIO FILE DATA (FIXED URLS) ---
// The URLs have been corrected to simple relative paths (e.g., 'sounds/drum.mp3')
const songData = [
    // Use exact filenames present in the repository (some files have double .mp3 suffix)
    { name: 'Drums', url: 'sounds/drum.mp3.mp3' },
    { name: 'Guitar_rock', url: 'sounds/rock_guitar_intro.mp3.mp3' },
    { name: 'Holdon_beat', url: 'sounds/HoldOnBeat.mp3.mp3' },
    { name: 'Electronic_wave', url: 'sounds/electronicWave.mp3.mp3' },
    { name: 'Cintanyer', url: 'sounds/cintanyer.mp3.mp3' },
    { name: 'Tribal_Drum', url: 'sounds/boomBoom_drum.mp3.mp3' },
];


// --- CORE AUDIO API FUNCTIONS (The Designer Logic) ---

/**
 * Initializes the AudioContext and loads all audio files.
 */
async function initializeAudio() {
    try {
        // Initialize the AudioContext (The Power Source)
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const loadingStatus = document.getElementById('loading-status');
        loadingStatus.textContent = 'Loading and decoding audio files...';
        
        // Load all songs asynchronously
        const loadPromises = songData.map(song => loadAudioFile(song.name, song.url));
        await Promise.all(loadPromises);

        state.isInitialized = true;
        loadingStatus.textContent = 'Audio ready! Add tracks to the mixer.';
        loadingStatus.style.color = '#10b981'; // Green color for success

        renderSongLibrary();
    } catch (error) {
        console.error("Error initializing audio:", error);
        // Display a helpful error message if loading fails
        document.getElementById('loading-status').textContent = `ERROR: Could not load audio. Check the 'sounds' folder and ensure file names match: ${error.message}`;
        document.getElementById('loading-status').style.color = '#ef4444'; // Red color for error
    }
}

/**
 * Fetches an audio file and decodes it into an AudioBuffer.
 */
async function loadAudioFile(name, url) {
    console.log(`Attempting to load: ${name} from ${url}`);
    // Use the fetch API to get the audio data
    const response = await fetch(url);
    if (!response.ok) {
        // Throw an error with the status for easier debugging
        throw new Error(`Failed to load '${url}'. Status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    // decodeAudioData is asynchronous and converts raw data into a usable AudioBuffer
    state.audioBuffers[name] = await state.audioContext.decodeAudioData(arrayBuffer);
    console.log(`${name} loaded successfully.`);
}

/**
 * Creates and starts a new AudioBufferSourceNode.
 * Crucial logic: SourceNodes are single-use.
 */
function createAndStartSource(track) {
    const sourceNode = state.audioContext.createBufferSource();
    sourceNode.buffer = state.audioBuffers[track.songName];
    sourceNode.loop = true; // Loop the audio indefinitely
    
    // Connect Source -> GainNode (Volume)
    sourceNode.connect(track.gainNode);
    
    // Set playback rate and start
    sourceNode.playbackRate.setValueAtTime(track.speed, 0);

    // Record the new source and start playing
    track.sourceNode = sourceNode;
    sourceNode.start();
    track.isPlaying = true;

    // Update UI with custom classes
    track.playButton.textContent = '⏸️ Pause';
    track.playButton.classList.add('btn-pause'); 
    track.uiElement.classList.add('track-playing');
}

/**
 * Stops the current SourceNode for a track.
 */
function stopSource(track) {
    if (track.sourceNode) {
        // The `stop()` method must be called on the SourceNode
        track.sourceNode.stop();
        track.sourceNode = null;
    }
    track.isPlaying = false;
    
    // Update UI with custom classes
    track.playButton.textContent = '▶️ Play';
    track.playButton.classList.remove('btn-pause');
    track.uiElement.classList.remove('track-playing');
}


// --- UI AND EVENT HANDLING ---

/**
 * Adds a new track strip to the mixer UI and sets up audio nodes.
 */
function addTrack(songName) {
    document.getElementById('empty-message').style.display = 'none';

    // 1. Create Audio Nodes (The Signal Chain)
    const gainNode = state.audioContext.createGain();
    // Connect GainNode -> Destination (Speakers)
    gainNode.connect(state.audioContext.destination);

    // Set initial volume
    gainNode.gain.setValueAtTime(0.7, state.audioContext.currentTime);

    // 2. Create UI Elements (The Strip)
    const trackId = state.tracks.length;
    const trackDiv = document.createElement('div');
    trackDiv.id = `track-${trackId}`;
    trackDiv.className = 'track-strip'; 

    const trackName = document.createElement('span');
    trackName.textContent = songName;
    trackName.className = 'track-name';

    // Loudness Slider (Gain Control)
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '2'; 
    volumeSlider.step = '0.01';
    volumeSlider.value = '0.7';
    volumeSlider.className = 'slider';
    volumeSlider.title = 'Volume (Loudness)';
    
    const volumeContainer = document.createElement('div');
    volumeContainer.className = 'slider-container';
    volumeContainer.appendChild(volumeSlider);


    // Play/Pause Button
    const playButton = document.createElement('button');
    playButton.textContent = '▶️ Play';
    playButton.className = 'btn-track-control';

    // Speed Control (Playback Rate)
    const speedSlider = document.createElement('input');
    speedSlider.type = 'range';
    speedSlider.min = '0.5'; 
    speedSlider.max = '2';   
    speedSlider.step = '0.05';
    speedSlider.value = '1.0'; 
    speedSlider.className = 'slider';
    speedSlider.title = 'Speed (Playback Rate)';

    const speedContainer = document.createElement('div');
    speedContainer.className = 'slider-container';
    speedContainer.appendChild(speedSlider);


    trackDiv.append(trackName, volumeContainer, playButton, speedContainer);
    document.getElementById('track-strips').appendChild(trackDiv);

    // 3. Store Track State
    const newTrack = {
        id: trackId,
        songName,
        gainNode,
        sourceNode: null,
        isPlaying: false,
        speed: 1.0,
        uiElement: trackDiv,
        playButton,
        speedSlider,
    };
    state.tracks.push(newTrack);

    // Start playing immediately as requested
    createAndStartSource(newTrack);

    // 4. Connect UI to Audio Nodes (The Interactions)

    // Volume Control Logic
    volumeSlider.oninput = (e) => {
        // Set the gain node's value based on the slider input
        newTrack.gainNode.gain.setValueAtTime(parseFloat(e.target.value), state.audioContext.currentTime);
    };

    // Play/Pause Logic
    playButton.onclick = () => {
        if (newTrack.isPlaying) {
            stopSource(newTrack);
        } else {
            // Must create a new SourceNode to play again
            createAndStartSource(newTrack); 
        }
    };

    // Speed Control Logic
    speedSlider.oninput = (e) => {
        const newSpeed = parseFloat(e.target.value);
        newTrack.speed = newSpeed; 
        
        if (newTrack.sourceNode) {
            // Set the playback rate on the currently active SourceNode
            newTrack.sourceNode.playbackRate.setValueAtTime(newSpeed, state.audioContext.currentTime);
        }
    };
}

/**
 * Renders the song library buttons on the left.
 */
function renderSongLibrary() {
    const songListDiv = document.getElementById('song-list');
    songListDiv.innerHTML = '';
    songData.forEach(song => {
        const button = document.createElement('button');
        button.textContent = `➕ ADD ${song.name}`;
        button.className = 'btn btn-add'; 
        button.onclick = () => {
            // Must resume context on first user interaction in some browsers
            if (state.audioContext.state === 'suspended') {
                state.audioContext.resume();
            }
            if (state.isInitialized) {
                addTrack(song.name);
            } else {
                console.warn("Audio not initialized yet.");
            }
        };
        songListDiv.appendChild(button);
    });
}

// --- MASTER CONTROL LOGIC ---

function playAll() {
    if (state.audioContext.state === 'suspended') {
        state.audioContext.resume();
    }
    state.tracks.forEach(track => {
        if (!track.isPlaying) {
            createAndStartSource(track);
        }
    });
    state.isPlayingAll = true;
    document.getElementById('play-all').textContent = '▶️ All Playing';
    document.getElementById('play-all').style.backgroundColor = '#047857'; // Darker green when active
}

function stopAll() {
    state.tracks.forEach(track => {
        if (track.isPlaying) {
            stopSource(track);
        }
    });
    state.isPlayingAll = false;
    document.getElementById('play-all').textContent = '▶️ Play All';
    document.getElementById('play-all').style.backgroundColor = '#10b981'; // Revert to original green
}


// --- INITIALIZATION ---
window.onload = () => {
    initializeAudio();

    // Connect Master Control buttons
    document.getElementById('play-all').onclick = playAll;
    document.getElementById('stop-all').onclick = stopAll;
};