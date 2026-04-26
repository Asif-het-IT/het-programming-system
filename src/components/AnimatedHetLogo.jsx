import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import PropTypes from "prop-types";

export default function AnimatedHetLogo({ size = 90 }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: prefersReducedMotion ? 0.2 : 0.7, ease: "easeOut" }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.03, filter: "brightness(1.12)" }}
      style={{ willChange: "transform" }}
      className="flex items-center justify-center"
    >
      <motion.img
        src="/het-logo.png"
        alt="het Logo"
        style={{ width: size, height: size, willChange: prefersReducedMotion ? "auto" : "box-shadow" }}
        className="rounded-full object-contain"
        animate={prefersReducedMotion ? {} : {
          boxShadow: [
            "0 0 8px rgba(255,255,255,0.06)",
            "0 0 18px rgba(255,255,255,0.13)",
            "0 0 8px rgba(255,255,255,0.06)",
          ],
        }}
        transition={prefersReducedMotion ? {} : {
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}

AnimatedHetLogo.propTypes = {
  size: PropTypes.number,
};
