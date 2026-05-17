import type { ButtonHTMLAttributes } from "react";
import { ArchiveIcon } from "./ArchiveIcons";

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
    <button className={classes} type="button" onClick={onClick} aria-label={ariaLabel ?? label} data-press-feedback="true">
      <ArchiveIcon className="collection-return-button__arrow" name="back" />
      <span className="collection-return-button__label">{label}</span>
    </button>
  );
}

export function ArchiveArrowIcon({
  className,
  direction = "left",
}: {
  className?: string;
  direction?: "left" | "right";
}) {
  return <ArchiveIcon className={className} name={direction === "left" ? "back" : "forward"} />;
}

export const ArchiveChevronIcon = ArchiveArrowIcon;
