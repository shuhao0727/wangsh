import React, { useEffect, useRef, useState } from "react";

interface TimerDisplayProps {
    startTime: number | null;
    isRunning: boolean;
    initialElapsed?: number;
    prefix?: string;
    suffix?: string;
    alwaysShow?: boolean;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ 
    startTime, 
    isRunning, 
    initialElapsed = 0, 
    prefix = "", 
    suffix = " s",
    alwaysShow = false,
}) => {
    const [displayTime, setDisplayTime] = useState(initialElapsed);
    const frameRef = useRef<number | null>(null);

    useEffect(() => {
        if (isRunning && startTime) {
            const update = () => {
                const now = Date.now();
                const elapsed = initialElapsed + (now - startTime) / 1000;
                setDisplayTime(elapsed);
                frameRef.current = requestAnimationFrame(update);
            };
            frameRef.current = requestAnimationFrame(update);
        } else {
            setDisplayTime(initialElapsed);
            // Stopped
            if (frameRef.current != null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        }

        return () => {
            if (frameRef.current != null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        };
    }, [isRunning, startTime, initialElapsed]);

    // Format time (e.g., 1.23 s)
    if (!alwaysShow && !startTime && initialElapsed === 0 && !isRunning) return null;

    return (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {prefix}{displayTime.toFixed(2)}{suffix}
        </span>
    );
};
