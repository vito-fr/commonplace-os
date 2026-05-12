import type { CSSProperties } from "react";

type SettingSliderStyle = CSSProperties & {
  "--setting-slider-progress": string;
};

export type SettingSliderProps = {
  description?: string;
  formatValue?: (value: number) => string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
};

export function SettingSlider({
  description,
  formatValue = (value) => String(value),
  label,
  max,
  min,
  onChange,
  step = 1,
  value,
}: SettingSliderProps) {
  const range = max - min;
  const progress = range > 0 ? ((value - min) / range) * 100 : 0;
  const displayValue = formatValue(value);
  const sliderStyle: SettingSliderStyle = {
    "--setting-slider-progress": `${Math.min(100, Math.max(0, progress))}%`,
  };

  return (
    <label className="setting-slider">
      <span className="setting-slider__copy">
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <span className="setting-slider__control">
        <input
          aria-label={label}
          className="setting-slider__input"
          max={max}
          min={min}
          step={step}
          style={sliderStyle}
          type="range"
          value={value}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
        <output className="setting-slider__value" aria-live="polite">
          {displayValue}
        </output>
      </span>
    </label>
  );
}
