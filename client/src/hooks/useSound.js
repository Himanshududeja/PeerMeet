import { useRef, useEffect } from 'react';

export const useSound = () => {
    const audioContext = useRef(null);

    useEffect(() => {
        // Initialize AudioContext
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioContext.current = new AudioContext();
        }
    }, []);

    const playTone = (freq, type, duration, startTime = 0) => {
        if (!audioContext.current) return;
        const ctx = audioContext.current;

        // Resume context if suspended (browser autoplay policy)
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

        gainNode.gain.setValueAtTime(0.1, ctx.currentTime + startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
    };

    const playJoinSound = () => {
        // Ascending chime
        playTone(440, 'sine', 0.2, 0);       // A4
        playTone(554.37, 'sine', 0.2, 0.15); // C#5
        playTone(659.25, 'sine', 0.3, 0.3);  // E5
    };

    const playPeerJoinSound = () => {
        // Subtle ping
        playTone(880, 'sine', 0.15, 0);      // A5
    };

    const playLeaveSound = () => {
        // Descending chime
        playTone(440, 'sine', 0.2, 0);       // A4
        playTone(349.23, 'sine', 0.3, 0.2);  // F4
    };

    const playMessageSound = () => {
        // Pop sound
        playTone(1200, 'sine', 0.1, 0);
    };

    return {
        playJoinSound,
        playPeerJoinSound,
        playLeaveSound,
        playMessageSound
    };
};
