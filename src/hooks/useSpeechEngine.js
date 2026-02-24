import { useState, useEffect, useCallback, useRef } from 'react';

export function useSpeechEngine(scriptNodes, pronunciationDictionary, settings, globalSpeed, onPlayNext) {
    const [voices, setVoices] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPausedManual, setIsPausedManual] = useState(false);

    const isPlayingRef = useRef(false);
    const currentIndexRef = useRef(0);

    // Sync refs
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
        currentIndexRef.current = currentIndex;
    }, [currentIndex]);

    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            if (availableVoices.length > 0) {
                setVoices(availableVoices);
            }
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, []);

    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
        };
    }, []);

    const playPreview = (voiceURI, speed = 1.0, pitch = 1.0) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance("Testing voice playback.");
        const selectedVoice = voices.find(v => v.voiceURI === voiceURI);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.rate = speed === 1.0 ? globalSpeed : speed;
        utterance.pitch = pitch;

        window.speechSynthesis.speak(utterance);
    };

    const stop = useCallback(() => {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        setIsPausedManual(false);
    }, []);

    const pause = useCallback(() => {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    }, []);

    const speakLine = useCallback((index) => {
        if (index >= scriptNodes.length) {
            setIsPlaying(false);
            return;
        }

        const node = scriptNodes[index];
        setCurrentIndex(index);
        onPlayNext(index);

        const roleKey = node.character ? node.character : node.type;
        const roleSetting = settings[roleKey] || { mode: 'Active', voiceURI: null, speed: 1.0, pitch: 1.0 };

        if (roleSetting.mode === 'Muted (Manual)') {
            setIsPlaying(false);
            setIsPausedManual(true);
            return;
        }

        let textToSpeak = node.text || '';
        if (!textToSpeak.trim()) {
            if (isPlayingRef.current) speakLine(index + 1);
            return;
        }

        // Apply phonetic replacements
        if (pronunciationDictionary) {
            Object.entries(pronunciationDictionary).forEach(([key, value]) => {
                const regex = new RegExp(`\\b${key}\\b`, 'gi');
                textToSpeak = textToSpeak.replace(regex, value);
            });
        }

        const utterance = new SpeechSynthesisUtterance(textToSpeak);

        if (roleSetting.mode === 'Muted (Timer)' || roleSetting.mode === 'Transparent') {
            utterance.volume = 0;
        } else {
            utterance.volume = 1;
            const selectedVoice = voices.find(v => v.voiceURI === roleSetting.voiceURI);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
        }

        const roleSpeed = roleSetting.speed !== undefined ? roleSetting.speed : 1.0;
        if (roleSpeed === 1.0) {
            utterance.rate = globalSpeed;
        } else {
            utterance.rate = roleSpeed;
        }

        utterance.pitch = roleSetting.pitch !== undefined ? roleSetting.pitch : 1.0;

        utterance.onend = () => {
            if (isPlayingRef.current) {
                speakLine(currentIndexRef.current + 1);
            }
        };

        utterance.onerror = (e) => {
            console.warn("Speech synthesis error", e);
            if (isPlayingRef.current) {
                speakLine(currentIndexRef.current + 1);
            }
        };

        window.speechSynthesis.speak(utterance);

    }, [scriptNodes, settings, globalSpeed, onPlayNext, voices]);

    const resume = useCallback(() => {
        if (!isPlaying && scriptNodes.length > 0) {
            setIsPlaying(true);
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
        speakLine(currentIndex + 1);
    }, [currentIndex, speakLine]);

    return {
        voices,
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
