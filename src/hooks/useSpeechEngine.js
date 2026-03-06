import { useState, useEffect, useCallback, useRef } from 'react';

export function useSpeechEngine(scriptNodes, pronunciationDictionary, settings, apiKeys, globalSpeed, onPlayNext) {
    const [localVoices, setLocalVoices] = useState([]);
    const [elevenLabsVoices, setElevenLabsVoices] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPausedManual, setIsPausedManual] = useState(false);

    const isPlayingRef = useRef(false);
    const currentIndexRef = useRef(0);
    const currentAudioRef = useRef(null); // Reference to active HTMLAudioElement
    const activeProcessIdRef = useRef(0); // Sequence ID for active playback promises

    // Combined voices list
    const googleVoices = apiKeys?.google ? [
        { id: 'google_en-US-Neural2-A', name: '[Google] Neural2 Male A', lang: 'en-US', type: 'google', voice_id: 'en-US-Neural2-A' },
        { id: 'google_en-US-Neural2-C', name: '[Google] Neural2 Female C', lang: 'en-US', type: 'google', voice_id: 'en-US-Neural2-C' },
        { id: 'google_en-US-Neural2-D', name: '[Google] Neural2 Male D', lang: 'en-US', type: 'google', voice_id: 'en-US-Neural2-D' },
        { id: 'google_en-US-Neural2-F', name: '[Google] Neural2 Female F', lang: 'en-US', type: 'google', voice_id: 'en-US-Neural2-F' },
        { id: 'google_en-US-Neural2-G', name: '[Google] Neural2 Female G', lang: 'en-US', type: 'google', voice_id: 'en-US-Neural2-G' },
        { id: 'google_en-US-Neural2-H', name: '[Google] Neural2 Female H', lang: 'en-US', type: 'google', voice_id: 'en-US-Neural2-H' },
        { id: 'google_en-US-Neural2-I', name: '[Google] Neural2 Male I', lang: 'en-US', type: 'google', voice_id: 'en-US-Neural2-I' },
        { id: 'google_en-US-Neural2-J', name: '[Google] Neural2 Male J', lang: 'en-US', type: 'google', voice_id: 'en-US-Neural2-J' }
    ] : [];

    const allVoices = [...localVoices, ...googleVoices, ...elevenLabsVoices];

    // Sync refs
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
        currentIndexRef.current = currentIndex;
    }, [currentIndex]);

    // Fetch Web Speech API local voices
    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            if (availableVoices.length > 0) {
                setLocalVoices(availableVoices.map(v => ({
                    id: v.voiceURI,
                    name: v.name,
                    lang: v.lang,
                    type: 'local',
                    originalVoice: v
                })));
            }
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, []);

    // Fetch ElevenLabs voices when key changes
    useEffect(() => {
        if (!apiKeys?.elevenlabs) {
            setElevenLabsVoices([]);
            return;
        }
        fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': apiKeys.elevenlabs }
        })
            .then(res => res.json())
            .then(data => {
                if (data && data.voices) {
                    const mapped = data.voices.map(v => ({
                        id: 'elevenlabs_' + v.voice_id,
                        name: `[ElevenLabs] ${v.name}`,
                        lang: 'en-US',
                        type: 'elevenlabs',
                        voice_id: v.voice_id
                    }));
                    setElevenLabsVoices(mapped);
                }
            })
            .catch(err => console.error("ElevenLabs voices fetch error:", err));
    }, [apiKeys?.elevenlabs]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
                currentAudioRef.current.src = "";
            }
        };
    }, []);

    // Helper to stop all active audio
    const _stopAllAudio = () => {
        activeProcessIdRef.current += 1;
        window.speechSynthesis.cancel();
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.src = "";
            currentAudioRef.current = null;
        }
    };

    // Google Cloud TTS Fetcher
    const fetchGoogleCloudAudio = async (text, voice_id, speed, pitch, apiKey) => {
        const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text },
                voice: { languageCode: 'en-US', name: voice_id },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: speed,
                    pitch: pitch !== 1.0 ? (pitch - 1.0) * 20 : 0 // approximate scale mapping if needed, GCP expects -20.0 to 20.0, UI gives 0 to 2
                }
            })
        });
        const data = await response.json();
        if (data.audioContent) {
            return `data:audio/mp3;base64,${data.audioContent}`;
        }
        throw new Error(data.error?.message || "Google Cloud TTS Failed");
    };

    // ElevenLabs TTS Fetcher
    const fetchElevenLabsAudio = async (text, voice_id, apiKey) => {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}?output_format=mp3_44100_128`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify({
                text,
                model_id: "eleven_monolingual_v1" // use standard model
            })
        });

        if (!response.ok) {
            throw new Error(`ElevenLabs TTS Failed: ${response.statusText}`);
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    };

    const processSpeech = (text, voiceURI, speed, pitch, volume) => {
        return new Promise(async (resolve) => {
            _stopAllAudio();
            const processId = activeProcessIdRef.current;

            if (!text.trim()) {
                return resolve();
            }

            const selectedVoice = allVoices.find(v => v.id === voiceURI);
            const voiceType = selectedVoice?.type || 'local';

            // Muted behavior
            if (volume === 0) {
                // Using a simple timeout for transparent/muted-timer modes
                const duration = Math.max(1000, (text.split(' ').length / 2.5) * 1000 * (1 / speed));
                setTimeout(() => {
                    if (processId === activeProcessIdRef.current) {
                        resolve();
                    }
                }, duration);
                return;
            }

            try {
                if (voiceType === 'google' && apiKeys?.google) {
                    const audioUrl = await fetchGoogleCloudAudio(text, selectedVoice.voice_id, speed, pitch, apiKeys.google);
                    if (processId !== activeProcessIdRef.current) return resolve();

                    const audio = new Audio(audioUrl);
                    audio.onended = resolve;
                    audio.onerror = resolve;
                    currentAudioRef.current = audio;
                    audio.play().catch((e) => {
                        console.error('Audio play error:', e);
                        resolve();
                    });

                } else if (voiceType === 'elevenlabs' && apiKeys?.elevenlabs) {
                    const audioUrl = await fetchElevenLabsAudio(text, selectedVoice.voice_id, apiKeys.elevenlabs);
                    if (processId !== activeProcessIdRef.current) return resolve();

                    const audio = new Audio(audioUrl);
                    // Elevenlabs doesn't support direct speed/pitch, we fallback to standard HTML playbackRate
                    audio.playbackRate = speed;
                    audio.onended = () => {
                        URL.revokeObjectURL(audioUrl);
                        resolve();
                    };
                    audio.onerror = () => {
                        URL.revokeObjectURL(audioUrl);
                        resolve();
                    }
                    currentAudioRef.current = audio;
                    audio.play().catch((e) => {
                        console.error('Audio play error:', e);
                        resolve();
                    });

                } else {
                    // Fallback to local Web Speech API
                    const utterance = new SpeechSynthesisUtterance(text);
                    if (selectedVoice?.type === 'local') {
                        utterance.voice = selectedVoice.originalVoice; // Assigning native SpeechSynthesisVoice
                    }
                    utterance.rate = speed;
                    utterance.pitch = pitch;
                    utterance.volume = volume;
                    utterance.onend = resolve;
                    utterance.onerror = (e) => {
                        console.warn("Speech synthesis error", e);
                        resolve();
                    };
                    window.speechSynthesis.speak(utterance);
                }
            } catch (error) {
                console.error("Audio generation failed, skipping segment:", error);
                resolve();
            }
        });
    };

    const playPreview = (voiceURI, speed = 1.0, pitch = 1.0) => {
        const text = "Testing voice playback.";
        const resolvedSpeed = speed === 1.0 ? globalSpeed : speed;
        processSpeech(text, voiceURI, resolvedSpeed, pitch, 1);
    };

    const stop = useCallback(() => {
        _stopAllAudio();
        setIsPlaying(false);
        setIsPausedManual(false);
    }, []);

    const pause = useCallback(() => {
        // Pausing HTMLAudio isn't cleanly resumable mid-utterance locally,
        // so we treat pause as "stop progressing to next line".
        _stopAllAudio();
        setIsPlaying(false);
    }, []);

    const speakLine = useCallback(async (index) => {
        if (index >= scriptNodes.length) {
            setIsPlaying(false);
            return;
        }

        const node = scriptNodes[index];
        setCurrentIndex(index);
        onPlayNext(index);

        const roleKey = node.character ? node.character : node.type;
        const roleSetting = settings[roleKey] || { mode: 'Active', voiceURI: null, speed: 1.0, pitch: 1.0 };

        if (roleSetting.mode === 'Hidden') {
            const wasPlaying = isPlayingRef.current;
            if (wasPlaying) {
                // Async push to prevent stack breaking on large hidden blocks
                setTimeout(() => {
                    if (isPlayingRef.current) {
                        speakLine(index + 1);
                    }
                }, 0);
            }
            return;
        }

        if (roleSetting.mode === 'Muted (Manual)' || roleSetting.mode === 'Transparent (Manual)') {
            setIsPlaying(false);
            setIsPausedManual(true);
            return;
        }

        let textToSpeak = node.text || '';

        // Apply phonetic replacements
        if (pronunciationDictionary) {
            Object.entries(pronunciationDictionary).forEach(([key, value]) => {
                const regex = new RegExp(`\\b${key}\\b`, 'gi');
                textToSpeak = textToSpeak.replace(regex, value);
            });
        }

        const roleSpeed = roleSetting.speed !== undefined ? roleSetting.speed : 1.0;
        const speed = roleSpeed === 1.0 ? globalSpeed : roleSpeed;
        const pitch = roleSetting.pitch !== undefined ? roleSetting.pitch : 1.0;
        const volume = (roleSetting.mode === 'Muted (Timer)' || roleSetting.mode === 'Transparent (Timed)') ? 0 : 1;

        await processSpeech(textToSpeak, roleSetting.voiceURI, speed, pitch, volume);

        if (isPlayingRef.current) {
            speakLine(currentIndexRef.current + 1);
        }

    }, [scriptNodes, settings, globalSpeed, onPlayNext, pronunciationDictionary, allVoices, apiKeys]);

    const resume = useCallback(() => {
        if (!isPlaying && scriptNodes.length > 0) {
            setIsPlaying(true);
            isPlayingRef.current = true; // Sync strictly for immediate access
            setIsPausedManual(false);
            speakLine(currentIndex);
        }
    }, [isPlaying, scriptNodes, currentIndex, speakLine]);

    const jumpToLine = useCallback((index) => {
        stop();
        setCurrentIndex(index);
        onPlayNext(index);
    }, [stop, onPlayNext]);

    const nextManual = useCallback(() => {
        setIsPausedManual(false);
        setIsPlaying(true);
        isPlayingRef.current = true; // Sync strictly
        speakLine(currentIndex + 1);
    }, [currentIndex, speakLine]);

    return {
        voices: allVoices,
        isPlaying,
        currentIndex,
        isPausedManual,
        playPreview,
        resume,
        pause,
        stop,
        jumpToLine,
        nextManual
    };
}
