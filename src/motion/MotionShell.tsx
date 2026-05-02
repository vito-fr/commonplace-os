import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

export type MotionShellProps = {
  children: ReactNode;
};

export function MotionShell({ children }: MotionShellProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!wrapperRef.current || !contentRef.current) {
      return;
    }

    const smoother = ScrollSmoother.create({
      wrapper: wrapperRef.current,
      content: contentRef.current,
      smooth: 1.2,
      smoothTouch: 0,
    });

    return () => {
      smoother.kill();
    };
  }, []);

  return (
    <div className="motion-shell" id="smooth-wrapper" ref={wrapperRef}>
      <div className="motion-shell__content" id="smooth-content" ref={contentRef}>
        {children}
      </div>
    </div>
  );
}

export { gsap, ScrollTrigger, ScrollSmoother };
