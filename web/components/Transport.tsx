import { useEffect, useRef, useSyncExternalStore } from 'react';
import * as engine from '../audio/engine.ts';

export function Transport() {
  const { audio, transport } = useSyncExternalStore(engine.subscribe, engine.getSnapshot);

  if (audio === 'locked') {
    return (
      <button type="button" className="button primary" onClick={() => void engine.enableAudio()}>
        Enable audio
      </button>
    );
  }

  return (
    <div className="transport">
      {transport === 'playing' ? (
        <button type="button" className="button" onClick={() => engine.stop()}>
          Stop
        </button>
      ) : (
        <button type="button" className="button primary" onClick={() => engine.play()}>
          Play
        </button>
      )}
      <LevelMeter />
    </div>
  );
}

/** Shows the output level, redrawn every animation frame outside React's render cycle. */
function LevelMeter() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const peak = engine.outputPeak();
      const meter = ref.current;
      if (meter) {
        meter.style.setProperty('--level', String(Math.min(1, peak)));
        meter.dataset.active = String(peak > 0.001);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <div ref={ref} className="meter" title="Output level" data-active="false" />;
}
