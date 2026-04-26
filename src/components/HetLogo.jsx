import React from 'react';
import PropTypes from 'prop-types';

export default function HetLogo({
  size = 36,
  showText = false,
  title = 'het Database',
  subtitle = 'Enterprise SaaS Platform',
  className = '',
  imageClassName = '',
  textClassName = '',
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="rounded-xl border border-slate-700/70 bg-slate-900 p-1.5 shadow-sm">
        <img
          src="/het-logo.png"
          alt="het logo"
          style={{ width: `${size}px`, height: `${size}px` }}
          className={`object-contain ${imageClassName}`}
          loading="eager"
          decoding="async"
        />
      </div>
      {showText ? (
        <div className={textClassName}>
          <p className="text-base font-semibold leading-5 text-foreground">{title}</p>
          {subtitle ? <p className="text-xs leading-4 text-muted-foreground">{subtitle}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

HetLogo.propTypes = {
  size: PropTypes.number,
  showText: PropTypes.bool,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  className: PropTypes.string,
  imageClassName: PropTypes.string,
  textClassName: PropTypes.string,
};
