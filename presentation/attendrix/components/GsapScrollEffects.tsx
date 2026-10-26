"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function GsapScrollEffects() {
  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    // Small delay to ensure DOM is fully ready
    let timer: number | undefined;
    const refreshOnLoad = () => ScrollTrigger.refresh();
    const context = gsap.context(() => {
    timer = window.setTimeout(() => {
      // 1. Section Header Reveals
      const sectionHeaders = document.querySelectorAll("h2, .section-header");
      sectionHeaders.forEach((el) => {
        gsap.fromTo(
          el,
          { y: 35, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // 2. Glass Panel Cards Staggered Reveal
      const cards = document.querySelectorAll(".glass-panel");
      cards.forEach((card) => {
        gsap.fromTo(
          card,
          { y: 30, opacity: 0.2 },
          {
            y: 0,
            opacity: 1,
            duration: 0.85,
            ease: "power2.out",
            scrollTrigger: {
              trigger: card,
              start: "top 90%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // 3. Subtle Parallax on Hero Stat Badges
      const statPillars = document.querySelectorAll("#experience .glass-panel");
      if (statPillars.length > 0) {
        gsap.fromTo(
          statPillars,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.12,
            ease: "back.out(1.5)",
            delay: 0.3,
          }
        );
      }

      // Keep the dashboard narrative readable while its sample interface
      // transitions with scroll. Pin only on larger screens to avoid trapping
      // touch users in a long mobile animation.
      const dashboardPanel = document.querySelector("#dashboard .glass-panel");
      if (dashboardPanel && window.innerWidth > 900) {
        gsap.to(dashboardPanel, {
          y: -24,
          ease: "none",
          scrollTrigger: {
            trigger: "#dashboard",
            start: "top 12%",
            end: "+=520",
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
      }
      ScrollTrigger.refresh();
    }, 150);

    window.addEventListener("load", refreshOnLoad);
    });

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("load", refreshOnLoad);
      context.revert();
    };
  }, []);

  return null;
}
