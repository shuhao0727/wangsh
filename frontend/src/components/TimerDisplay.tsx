import React, { useEffect, useRef, useState } from "react";

interface TimerDisplayProps {
    startTime: number | null;
    isRunning: boolean;
    initialElapsed?: number;
    prefix?: string;
    suffix?: string;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ 
    startTime, 
    isRunning, 
    initialElapsed = 0, 
    prefix = "", 
    suffix = " s" 
}) => {
    const [displayTime, setDisplayTime] = useState(initialElapsed);
    const frameRef = useRef<number>();

    useEffect(() => {
        if (isRunning && startTime) {
            const update = () => {
                const now = Date.now();
                const elapsed = (now - startTime) / 1000;
                setDisplayTime(elapsed);
                frameRef.current = requestAnimationFrame(update);
            };
            frameRef.current = requestAnimationFrame(update);
        } else {
            // Stopped
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        }

        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, [isRunning, startTime]);

    // Format time (e.g., 1.23 s)
    if (!startTime && initialElapsed === 0 && !isRunning) return null;

    return (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {prefix}{displayTime.toFixed(2)}{suffix}
        </span>
    );
};
