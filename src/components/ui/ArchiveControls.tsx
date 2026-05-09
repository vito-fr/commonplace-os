import type { ButtonHTMLAttributes } from "react";

type ArchiveReturnButtonProps = {
  className?: string;
  label?: string;
  onClick: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  ariaLabel?: string;
};

export function ArchiveReturnButton({
  ariaLabel,
  className = "",
  label = "Return",
  onClick,
}: ArchiveReturnButtonProps) {
  const classes = ["collection-return-button", className].filter(Boolean).join(" ");

  return (
    <button className={classes} type="button" onClick={onClick} aria-label={ariaLabel ?? label}>
      <ArchiveChevronIcon className="collection-return-button__arrow" direction="left" />
      <span className="collection-return-button__label">{label}</span>
    </button>
  );
}

export function ArchiveChevronIcon({
  className,
  direction = "left",
}: {
  className?: string;
  direction?: "left" | "right";
}) {
  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 11 11" focusable="false">
      {direction === "left" ? (
        <path d="M2.35 5.5 7.7 1.35v8.3Z" />
      ) : (
        <path d="M8.65 5.5 3.3 1.35v8.3Z" />
      )}
    </svg>
  );
}
