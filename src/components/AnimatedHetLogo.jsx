import React from "react";
import { motion } from "framer-motion";
import PropTypes from "prop-types";

export default function AnimatedHetLogo({ size = 90 }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      whileHover={{ scale: 1.03, filter: "brightness(1.12)" }}
      className="flex items-center justify-center"
    >
      <motion.img
        src="/het-logo.png"
        alt="het Logo"
        style={{ width: size, height: size }}
        className="rounded-full object-contain"
        animate={{
          boxShadow: [
            "0 0 10px rgba(255,255,255,0.08)",
            "0 0 20px rgba(255,255,255,0.15)",
            "0 0 10px rgba(255,255,255,0.08)",
          ],
        }}
        transition={{
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
